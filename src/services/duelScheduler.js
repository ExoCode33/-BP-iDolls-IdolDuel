import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import database from '../database/database.js';
import duelManager from './duelManager.js';
import storage from './storage.js';
import embedUtils from '../utils/embeds.js';

class DuelScheduler {
  constructor(client) {
    this.client = client;
    this.activeTimers = new Map(); // guildId -> { timer, endTime }
  }

  /**
   * Start the scheduler for all guilds
   */
  async start() {
    console.log('🕐 Starting duel scheduler...');

    // Check all guilds for active duels
    const result = await database.query(
      'SELECT DISTINCT guild_id FROM guild_config WHERE duel_channel_id IS NOT NULL'
    );

    for (const row of result.rows) {
      await this.checkAndScheduleDuel(row.guild_id);
    }

    // Set up recurring check every minute
    setInterval(() => {
      this.checkAllGuilds();
    }, 60000); // Check every minute

    console.log('✅ Duel scheduler started');
  }

  /**
   * Check all guilds for duels that need to be started or ended
   */
  async checkAllGuilds() {
    const result = await database.query(
      'SELECT guild_id FROM guild_config WHERE duel_channel_id IS NOT NULL AND duel_paused = false'
    );

    for (const row of result.rows) {
      await this.checkAndScheduleDuel(row.guild_id);
    }
  }

  /**
   * Check if a guild needs a duel started or ended
   */
  async checkAndScheduleDuel(guildId) {
    try {
      const config = await database.query(
        'SELECT * FROM guild_config WHERE guild_id = $1',
        [guildId]
      );

      if (config.rows.length === 0) return;

      const guildConfig = config.rows[0];

      // Skip if paused
      if (guildConfig.duel_paused) return;

      // Check for active duel
      const activeDuel = await duelManager.getActiveDuel(guildId);

      if (activeDuel) {
        // Check if duel should end
        const now = new Date();
        const endsAt = new Date(activeDuel.endsAt);

        if (now >= endsAt) {
          await this.endDuel(guildId);
          // Schedule next duel after interval
          setTimeout(() => {
            this.startDuel(guildId);
          }, guildConfig.duel_interval * 1000);
        } else {
          // Set timer for when it should end
          const timeUntilEnd = endsAt.getTime() - now.getTime();
          if (!this.activeTimers.has(guildId)) {
            const timer = setTimeout(() => {
              this.endDuel(guildId);
              setTimeout(() => {
                this.startDuel(guildId);
              }, guildConfig.duel_interval * 1000);
            }, timeUntilEnd);

            this.activeTimers.set(guildId, { timer, endTime: endsAt });
          }
        }
      } else {
        // No active duel, check if it's time to start one
        const lastDuelTime = guildConfig.last_duel_time || 0;
        const now = Date.now();
        const timeSinceLastDuel = now - lastDuelTime;

        if (timeSinceLastDuel >= guildConfig.duel_interval * 1000) {
          await this.startDuel(guildId);
        }
      }
    } catch (error) {
      console.error(`Error checking duel for guild ${guildId}:`, error);
    }
  }

  /**
   * Start a new duel for a guild
   */
  async startDuel(guildId) {
    try {
      const configResult = await database.query(
        'SELECT * FROM guild_config WHERE guild_id = $1',
        [guildId]
      );

      if (configResult.rows.length === 0) return;

      const config = configResult.rows[0];

      if (!config.duel_channel_id) {
        console.log(`⚠️  Guild ${guildId} has no duel channel set`);
        return;
      }

      // Start duel
      const duelData = await duelManager.startDuel(guildId, config);
      
      if (!duelData) {
        console.log(`⚠️  Could not start duel for guild ${guildId}`);
        return;
      }

      // Get channel
      const channel = await this.client.channels.fetch(config.duel_channel_id);
      if (!channel) return;

      // Get signed URLs (await because they're async now)
      const image1Url = await storage.getImageUrl(duelData.image1.s3_key);
      const image2Url = await storage.getImageUrl(duelData.image2.s3_key);

      // Create embeds (now returns an array)
      const embeds = embedUtils.createDuelEmbed(duelData, image1Url, image2Url, duelData.endsAt);

      // Create buttons
      const buttons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`vote_image_${duelData.image1.id}`)
            .setLabel('Vote A')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📸'),
          new ButtonBuilder()
            .setCustomId(`vote_image_${duelData.image2.id}`)
            .setLabel('Vote B')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📸'),
          new ButtonBuilder()
            .setCustomId('add_caption')
            .setLabel('Add Caption')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('💬')
        );

      // Send message with multiple embeds
      const message = await channel.send({ embeds: embeds, components: [buttons] });

      // Update active duel with message ID
      await database.query(
        'UPDATE active_duels SET message_id = $1 WHERE guild_id = $2',
        [message.id, guildId]
      );

      // Update last duel time and set active
      await database.query(
        'UPDATE guild_config SET last_duel_time = $1, duel_active = true WHERE guild_id = $2',
        [Date.now(), guildId]
      );

      console.log(`✅ Duel started for guild ${guildId}`);

      // Set timer for end
      const timeUntilEnd = duelData.endsAt.getTime() - Date.now();
      const timer = setTimeout(() => {
        this.endDuel(guildId);
        setTimeout(() => {
          this.startDuel(guildId);
        }, config.duel_interval * 1000);
      }, timeUntilEnd);

      this.activeTimers.set(guildId, { timer, endTime: duelData.endsAt });
    } catch (error) {
      console.error(`Error starting duel for guild ${guildId}:`, error);
    }
  }

  /**
   * End the current duel for a guild
   */
  async endDuel(guildId) {
    try {
      // Clear timer
      if (this.activeTimers.has(guildId)) {
        clearTimeout(this.activeTimers.get(guildId).timer);
        this.activeTimers.delete(guildId);
      }

      const configResult = await database.query(
        'SELECT * FROM guild_config WHERE guild_id = $1',
        [guildId]
      );

      if (configResult.rows.length === 0) return;

      const config = configResult.rows[0];

      // Get active duel before ending
      const activeDuel = await duelManager.getActiveDuel(guildId);
      if (!activeDuel) return;

      // End duel
      const results = await duelManager.endDuel(guildId, config);
      
      if (!results) return;

      // Get channel
      const channel = await this.client.channels.fetch(config.duel_channel_id);
      if (!channel) return;

      // Get signed URLs for results (await because they're async)
      const winnerUrl = results.winner ? await storage.getImageUrl(results.winner.s3_key) : null;
      const loserUrl = results.loser ? await storage.getImageUrl(results.loser.s3_key) : null;

      // Create results embed
      const embed = embedUtils.createDuelResultsEmbed(results, winnerUrl, loserUrl);

      // Send results
      await channel.send({ embeds: [embed] });

      // Try to edit original message to remove buttons
      if (activeDuel.messageId) {
        try {
          const originalMessage = await channel.messages.fetch(activeDuel.messageId);
          await originalMessage.edit({ components: [] });
        } catch (err) {
          console.log('Could not edit original duel message:', err.message);
        }
      }

      // Update guild config
      await database.query(
        'UPDATE guild_config SET duel_active = false WHERE guild_id = $1',
        [guildId]
      );

      console.log(`✅ Duel ended for guild ${guildId}`);
    } catch (error) {
      console.error(`Error ending duel for guild ${guildId}:`, error);
    }
  }

  /**
   * Manually start a duel now (admin command)
   */
  async startDuelNow(guildId) {
    // Clear any existing timer
    if (this.activeTimers.has(guildId)) {
      clearTimeout(this.activeTimers.get(guildId).timer);
      this.activeTimers.delete(guildId);
    }

    await this.startDuel(guildId);
  }

  /**
   * Manually end current duel (admin command)
   */
  async endDuelNow(guildId) {
    await this.endDuel(guildId);
  }

  /**
   * Stop the scheduler
   */
  stop() {
    // Clear all timers
    for (const [guildId, data] of this.activeTimers) {
      clearTimeout(data.timer);
    }
    this.activeTimers.clear();
    console.log('⏹️  Duel scheduler stopped');
  }
}

export default DuelScheduler;
