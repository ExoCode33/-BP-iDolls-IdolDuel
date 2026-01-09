/**
 * Duel Manager Service
 * Coordinates the entire duel lifecycle
 * Handles scheduling, starting, and ending duels
 */

import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import database from '../../database/database.js';
import selector from './selector.js';
import resolver from './resolver.js';
import storage from '../image/storage.js';
import embedUtils from '../../utils/embeds.js';
import cache from '../cache/manager.js';

class DuelManager {
  constructor() {
    this.timers = new Map(); // guildId -> timeout
    this.client = null;
  }

  /**
   * Initialize with Discord client
   * @param {Client} client - Discord.js client
   */
  setClient(client) {
    this.client = client;
  }

  /**
   * Start scheduling for all guilds
   */
  async startAllGuilds() {
    const result = await database.query(
      'SELECT guild_id FROM guild_config WHERE duel_channel_id IS NOT NULL'
    );

    for (const row of result.rows) {
      await this.checkGuild(row.guild_id);
    }

    console.log('✅ Duel system initialized for all guilds');
  }

  /**
   * Check and schedule duel for a guild
   * @param {string} guildId - Guild ID
   */
  async checkGuild(guildId) {
    try {
      // Get config
      const configResult = await database.query(
        'SELECT * FROM guild_config WHERE guild_id = $1',
        [guildId]
      );

      if (configResult.rows.length === 0) return;

      const config = configResult.rows[0];

      // Skip if paused or no channel set
      if (config.duel_paused || !config.duel_channel_id) return;

      // Check for active duel
      const activeDuel = await this.getActiveDuel(guildId);

      if (activeDuel) {
        // Schedule end if not already scheduled
        const now = Date.now();
        const endsAt = new Date(activeDuel.ends_at).getTime();

        if (endsAt > now && !this.timers.has(guildId)) {
          this.scheduleEnd(guildId, endsAt - now);
        } else if (endsAt <= now) {
          // Duel should have ended
          await this.endDuel(guildId);
        }
      } else {
        // No active duel, start one
        await this.startDuel(guildId);
      }
    } catch (error) {
      console.error(`Error checking guild ${guildId}:`, error);
    }
  }

  /**
   * Get active duel for a guild
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object|null>} Active duel or null
   */
  async getActiveDuel(guildId) {
    const result = await database.query(
      `SELECT ad.*, 
        i1.s3_key as image1_s3_key, i1.elo as image1_elo,
        i2.s3_key as image2_s3_key, i2.elo as image2_elo
       FROM active_duels ad
       JOIN images i1 ON ad.image1_id = i1.id
       JOIN images i2 ON ad.image2_id = i2.id
       WHERE ad.guild_id = $1`,
      [guildId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      duelId: row.duel_id,
      image1: { id: row.image1_id, s3_key: row.image1_s3_key, elo: row.image1_elo },
      image2: { id: row.image2_id, s3_key: row.image2_s3_key, elo: row.image2_elo },
      messageId: row.message_id,
      ends_at: row.ends_at
    };
  }

  /**
   * Start a new duel
   * @param {string} guildId - Guild ID
   */
  async startDuel(guildId) {
    try {
      // Get config
      const configResult = await database.query(
        'SELECT * FROM guild_config WHERE guild_id = $1',
        [guildId]
      );

      if (configResult.rows.length === 0) return;

      const config = configResult.rows[0];

      // Select pair
      const pair = await selector.selectPair(guildId);

      if (!pair) {
        console.log(`⚠️ Could not select pair for guild ${guildId}`);
        return;
      }

      // Calculate end time
      const endsAt = new Date(Date.now() + config.duel_duration * 1000);

      // Create duel record
      const duelResult = await database.query(
        `INSERT INTO duels (guild_id, image1_id, image2_id, started_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING id`,
        [guildId, pair.image1.id, pair.image2.id]
      );

      const duelId = duelResult.rows[0].id;

      // Create active duel record
      await database.query(
        `INSERT INTO active_duels (guild_id, duel_id, image1_id, image2_id, ends_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (guild_id) DO UPDATE
         SET duel_id = $2, image1_id = $3, image2_id = $4, ends_at = $5, message_id = NULL`,
        [guildId, duelId, pair.image1.id, pair.image2.id, endsAt]
      );

      // Get channel
      const channel = await this.client.channels.fetch(config.duel_channel_id);

      if (!channel) {
        console.log(`⚠️ Could not fetch channel for guild ${guildId}`);
        return;
      }

      // Get signed URLs
      const image1Url = await storage.getImageUrl(pair.image1.s3_key);
      const image2Url = await storage.getImageUrl(pair.image2.s3_key);

      // Create embeds
      const embeds = embedUtils.createDuelEmbed(
        { image1: pair.image1, image2: pair.image2, isWildcard: false },
        image1Url,
        image2Url,
        endsAt,
        { image1: [], image2: [] }
      );

      // Create buttons
      const buttons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`vote_${pair.image1.id}`)
            .setLabel('Vote A')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📸'),
          new ButtonBuilder()
            .setCustomId(`vote_${pair.image2.id}`)
            .setLabel('Vote B')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📸')
        );

      // Send message
      const message = await channel.send({ embeds, components: [buttons] });

      // Update active duel with message ID
      await database.query(
        'UPDATE active_duels SET message_id = $1 WHERE guild_id = $2',
        [message.id, guildId]
      );

      // Update config
      await database.query(
        'UPDATE guild_config SET duel_active = true WHERE guild_id = $1',
        [guildId]
      );

      // Schedule end
      this.scheduleEnd(guildId, config.duel_duration * 1000);

      console.log(`✅ Duel started for guild ${guildId}`);
    } catch (error) {
      console.error(`Error starting duel for guild ${guildId}:`, error);
    }
  }

  /**
   * End current duel
   * @param {string} guildId - Guild ID
   */
  async endDuel(guildId) {
    try {
      // Clear timer
      if (this.timers.has(guildId)) {
        clearTimeout(this.timers.get(guildId));
        this.timers.delete(guildId);
      }

      // Get config
      const configResult = await database.query(
        'SELECT * FROM guild_config WHERE guild_id = $1',
        [guildId]
      );

      if (configResult.rows.length === 0) return;

      const config = configResult.rows[0];

      // Get active duel
      const activeDuel = await this.getActiveDuel(guildId);

      if (!activeDuel) return;

      // Resolve duel
      const results = await resolver.resolveDuel(
        guildId,
        activeDuel.duelId,
        activeDuel.image1.id,
        activeDuel.image2.id,
        config.k_factor,
        config.duel_interval
      );

      // Delete active duel
      await database.query(
        'DELETE FROM active_duels WHERE guild_id = $1',
        [guildId]
      );

      // Update config
      await database.query(
        'UPDATE guild_config SET duel_active = false WHERE guild_id = $1',
        [guildId]
      );

      // Get channel
      const channel = await this.client.channels.fetch(config.duel_channel_id);

      if (channel) {
        // Remove buttons from original message
        if (activeDuel.messageId) {
          try {
            const originalMessage = await channel.messages.fetch(activeDuel.messageId);
            await originalMessage.edit({ components: [] });
          } catch (err) {
            // Message might be deleted, ignore
          }
        }

        // Post results
        if (!results.skipped) {
          const winnerUrl = await storage.getImageUrl(results.winner.s3_key);
          const loserUrl = await storage.getImageUrl(results.loser.s3_key);
          
          const resultsEmbed = embedUtils.createDuelResultsEmbed(
            results,
            winnerUrl,
            loserUrl
          );

          await channel.send({ embeds: [resultsEmbed] });
        } else {
          const skipEmbed = embedUtils.createDuelResultsEmbed(results, null, null);
          await channel.send({ embeds: [skipEmbed] });
        }
      }

      // Schedule next duel
      setTimeout(() => {
        this.startDuel(guildId);
      }, config.duel_interval * 1000);

      console.log(`✅ Duel ended for guild ${guildId}`);
    } catch (error) {
      console.error(`Error ending duel for guild ${guildId}:`, error);
    }
  }

  /**
   * Schedule duel end
   * @param {string} guildId - Guild ID
   * @param {number} delay - Delay in milliseconds
   */
  scheduleEnd(guildId, delay) {
    const timer = setTimeout(() => {
      this.endDuel(guildId);
    }, delay);

    this.timers.set(guildId, timer);
  }

  /**
   * Stop duels for a guild
   * @param {string} guildId - Guild ID
   */
  async stopDuel(guildId) {
    // Clear timer
    if (this.timers.has(guildId)) {
      clearTimeout(this.timers.get(guildId));
      this.timers.delete(guildId);
    }

    // Delete active duel
    await database.query(
      'DELETE FROM active_duels WHERE guild_id = $1',
      [guildId]
    );

    // Update config
    await database.query(
      'UPDATE guild_config SET duel_active = false, duel_paused = false WHERE guild_id = $1',
      [guildId]
    );

    console.log(`⏹️ Duels stopped for guild ${guildId}`);
  }

  /**
   * Skip current duel
   * @param {string} guildId - Guild ID
   */
  async skipDuel(guildId) {
    // End current duel
    await this.endDuel(guildId);

    // Clear active duel to force new pair
    await database.query(
      'DELETE FROM active_duels WHERE guild_id = $1',
      [guildId]
    );

    console.log(`⏭️ Duel skipped for guild ${guildId}`);
  }
}

export default new DuelManager();
