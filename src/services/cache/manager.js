/**
 * Duel Manager with Redis Persistence Recovery
 * Fixed to handle embed arrays properly
 */

import database from '../../database/database.js';
import redis from '../../database/redis.js';
import selector from './selector.js';
import resolver from './resolver.js';
import embedUtils from '../../utils/embeds.js';
import storage from '../image/storage.js';

class DuelManager {
  constructor() {
    this.client = null;
    this.activeTimers = new Map();
  }

  setClient(client) {
    this.client = client;
  }

  /**
   * Start duel system for all guilds (called on bot startup)
   */
  async startAllGuilds() {
    try {
      const result = await database.query(
        'SELECT guild_id FROM guild_config WHERE duel_active = true'
      );

      for (const row of result.rows) {
        const guildId = row.guild_id;
        
        // Check for existing active duel in database
        const activeDuel = await database.query(
          'SELECT * FROM active_duels WHERE guild_id = $1',
          [guildId]
        );

        if (activeDuel.rows.length > 0) {
          console.log(`🔄 Resuming active duel for guild ${guildId}...`);
          await this.resumeActiveDuel(guildId, activeDuel.rows[0]);
        } else {
          console.log(`✅ Starting duel scheduler for guild ${guildId}...`);
          await this.checkGuild(guildId);
        }
      }

      console.log('✅ Duel system initialized for all guilds');
    } catch (error) {
      console.error('Error starting duel system:', error);
    }
  }

  /**
   * Resume an active duel after bot restart
   */
  async resumeActiveDuel(guildId, activeDuelRow) {
    try {
      const duelId = activeDuelRow.duel_id;
      const endsAt = new Date(activeDuelRow.ends_at);
      const now = new Date();

      // Check if duel has already ended
      if (endsAt <= now) {
        console.log(`⏰ Duel ${duelId} expired, ending now...`);
        await this.endDuel(guildId);
        await this.checkGuild(guildId); // Start next duel
        return;
      }

      // Get duel details
      const duelResult = await database.query(
        `SELECT d.*, 
          i1.s3_key as image1_s3_key, i1.elo as image1_elo, i1.wins as image1_wins, i1.losses as image1_losses,
          i2.s3_key as image2_s3_key, i2.elo as image2_elo, i2.wins as image2_wins, i2.losses as image2_losses
         FROM duels d
         JOIN images i1 ON d.image1_id = i1.id
         JOIN images i2 ON d.image2_id = i2.id
         WHERE d.id = $1`,
        [duelId]
      );

      if (duelResult.rows.length === 0) {
        console.error(`Duel ${duelId} not found in database!`);
        await database.query('DELETE FROM active_duels WHERE guild_id = $1', [guildId]);
        await this.checkGuild(guildId);
        return;
      }

      const duel = duelResult.rows[0];

      // Restore to Redis
      const duelData = {
        duelId: duel.id,
        image1: {
          id: duel.image1_id,
          s3_key: duel.image1_s3_key,
          elo: duel.image1_elo,
          wins: duel.image1_wins,
          losses: duel.image1_losses
        },
        image2: {
          id: duel.image2_id,
          s3_key: duel.image2_s3_key,
          elo: duel.image2_elo,
          wins: duel.image2_wins,
          losses: duel.image2_losses
        },
        startedAt: new Date(duel.started_at),
        endsAt: endsAt,
        messageId: activeDuelRow.message_id
      };

      // Save to Redis
      await redis.setActiveDuel(guildId, duelData);

      console.log(`✅ Restored duel ${duelId} for guild ${guildId}`);

      // Set timer for remaining time
      const remainingTime = endsAt - now;
      const timer = setTimeout(() => {
        this.endDuel(guildId);
      }, remainingTime);

      this.activeTimers.set(guildId, timer);

      console.log(`⏰ Duel will end in ${Math.round(remainingTime / 1000)}s`);

    } catch (error) {
      console.error('Error resuming active duel:', error);
      // If resumption fails, clean up and start fresh
      await database.query('DELETE FROM active_duels WHERE guild_id = $1', [guildId]);
      await this.checkGuild(guildId);
    }
  }

  /**
   * Check if a guild should start a new duel
   */
  async checkGuild(guildId) {
    try {
      // Get guild config
      const configResult = await database.query(
        'SELECT * FROM guild_config WHERE guild_id = $1',
        [guildId]
      );

      if (configResult.rows.length === 0) return;

      const config = configResult.rows[0];

      // Check if duels are active and not paused
      if (!config.duel_active || config.duel_paused) return;

      // Check if there's already an active duel
      const activeDuelCheck = await database.query(
        'SELECT * FROM active_duels WHERE guild_id = $1',
        [guildId]
      );

      if (activeDuelCheck.rows.length > 0) {
        console.log(`Guild ${guildId} already has an active duel`);
        return;
      }

      // Start new duel
      await this.createNewDuel(guildId, config);
    } catch (error) {
      console.error(`Error checking guild ${guildId}:`, error);
    }
  }

  /**
   * Create and start a new duel
   */
  async createNewDuel(guildId, config) {
    try {
      // Select two images
      const pair = await selector.selectPair(guildId);

      if (!pair) {
        console.log(`No images available for duel in guild ${guildId}`);
        return;
      }

      // Create duel in database
      const result = await database.query(
        `INSERT INTO duels (guild_id, image1_id, image2_id, started_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING id`,
        [guildId, pair.image1.id, pair.image2.id]
      );

      const duelId = result.rows[0].id;

      // Calculate end time
      const now = new Date();
      const endsAt = new Date(now.getTime() + config.duel_duration * 1000);

      // Store in active_duels table
      await database.query(
        `INSERT INTO active_duels (guild_id, duel_id, ends_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (guild_id) 
         DO UPDATE SET duel_id = $2, ends_at = $3`,
        [guildId, duelId, endsAt]
      );

      // Store in Redis
      const duelData = {
        duelId,
        image1: pair.image1,
        image2: pair.image2,
        startedAt: now,
        endsAt: endsAt
      };

      await redis.setActiveDuel(guildId, duelData);

      // Post duel message (pass endsAt separately)
      const messageId = await this.postDuelMessage(guildId, config, pair, endsAt);

      // Update message_id in database
      await database.query(
        'UPDATE active_duels SET message_id = $1 WHERE guild_id = $2',
        [messageId, guildId]
      );

      duelData.messageId = messageId;
      await redis.setActiveDuel(guildId, duelData);

      // Set timer
      const timer = setTimeout(() => {
        this.endDuel(guildId);
      }, config.duel_duration * 1000);

      this.activeTimers.set(guildId, timer);

      console.log(`🎮 Started duel ${duelId} for guild ${guildId}`);
    } catch (error) {
      console.error('Error creating new duel:', error);
    }
  }

  /**
   * Post duel message to channel
   */
  async postDuelMessage(guildId, config, pair, endsAt) {
    try {
      const channel = await this.client.channels.fetch(config.duel_channel_id);

      if (!channel) {
        throw new Error('Duel channel not found');
      }

      // Get image URLs
      const url1 = await storage.getImageUrl(pair.image1.s3_key);
      const url2 = await storage.getImageUrl(pair.image2.s3_key);

      // Create embeds (returns array of 3 embeds)
      const embeds = embedUtils.createDuelEmbed(pair.image1, pair.image2, url1, url2, endsAt);

      // Create buttons
      const row = embedUtils.createVoteButtons(pair.image1.id, pair.image2.id);

      // Send with embeds array directly (embeds is already an array)
      const message = await channel.send({ embeds: embeds, components: [row] });

      return message.id;
    } catch (error) {
      console.error('Error posting duel message:', error);
      throw error;
    }
  }

  /**
   * End the current duel
   */
  async endDuel(guildId) {
    try {
      console.log(`⏰ Ending duel for guild ${guildId}...`);

      // Get active duel
      const activeDuel = await this.getActiveDuel(guildId);

      if (!activeDuel) {
        console.log('No active duel found');
        return;
      }

      // Resolve duel (count votes, update ELO, check retirement)
      await resolver.resolveDuel(guildId, activeDuel.duelId, this.client);

      // Clear from database
      await database.query('DELETE FROM active_duels WHERE guild_id = $1', [guildId]);

      // Clear from Redis
      await redis.clearActiveDuel(guildId);

      // Clear timer
      if (this.activeTimers.has(guildId)) {
        clearTimeout(this.activeTimers.get(guildId));
        this.activeTimers.delete(guildId);
      }

      // Get guild config
      const configResult = await database.query(
        'SELECT * FROM guild_config WHERE guild_id = $1',
        [guildId]
      );

      if (configResult.rows.length === 0) return;

      const config = configResult.rows[0];

      // Schedule next duel
      const nextDuelTimer = setTimeout(() => {
        this.checkGuild(guildId);
      }, config.duel_interval * 1000);

      this.activeTimers.set(`${guildId}_next`, nextDuelTimer);

      console.log(`✅ Duel ended, next duel in ${config.duel_interval / 60} minutes`);
    } catch (error) {
      console.error('Error ending duel:', error);
    }
  }

  /**
   * Get active duel from Redis (with database fallback)
   */
  async getActiveDuel(guildId) {
    try {
      // Try Redis first
      let duel = await redis.getActiveDuel(guildId);

      // Fallback to database if not in Redis
      if (!duel) {
        const result = await database.query(
          `SELECT ad.*, d.*,
            i1.s3_key as image1_s3_key, i1.elo as image1_elo, i1.wins as image1_wins, i1.losses as image1_losses,
            i2.s3_key as image2_s3_key, i2.elo as image2_elo, i2.wins as image2_wins, i2.losses as image2_losses
           FROM active_duels ad
           JOIN duels d ON ad.duel_id = d.id
           JOIN images i1 ON d.image1_id = i1.id
           JOIN images i2 ON d.image2_id = i2.id
           WHERE ad.guild_id = $1`,
          [guildId]
        );

        if (result.rows.length > 0) {
          const row = result.rows[0];
          duel = {
            duelId: row.duel_id,
            image1: {
              id: row.image1_id,
              s3_key: row.image1_s3_key,
              elo: row.image1_elo,
              wins: row.image1_wins,
              losses: row.image1_losses
            },
            image2: {
              id: row.image2_id,
              s3_key: row.image2_s3_key,
              elo: row.image2_elo,
              wins: row.image2_wins,
              losses: row.image2_losses
            },
            startedAt: new Date(row.started_at),
            endsAt: new Date(row.ends_at),
            messageId: row.message_id
          };

          // Restore to Redis
          await redis.setActiveDuel(guildId, duel);
        }
      }

      return duel;
    } catch (error) {
      console.error('Error getting active duel:', error);
      return null;
    }
  }

  /**
   * Start duel system (admin action)
   */
  async startDuel(guildId) {
    await database.query(
      'UPDATE guild_config SET duel_active = true, duel_paused = false WHERE guild_id = $1',
      [guildId]
    );

    await this.checkGuild(guildId);
  }

  /**
   * Stop duel system (admin action)
   */
  async stopDuel(guildId) {
    await database.query(
      'UPDATE guild_config SET duel_active = false, duel_paused = false WHERE guild_id = $1',
      [guildId]
    );

    // Clear timers
    if (this.activeTimers.has(guildId)) {
      clearTimeout(this.activeTimers.get(guildId));
      this.activeTimers.delete(guildId);
    }

    if (this.activeTimers.has(`${guildId}_next`)) {
      clearTimeout(this.activeTimers.get(`${guildId}_next`));
      this.activeTimers.delete(`${guildId}_next`);
    }
  }

  /**
   * Skip current duel (admin action)
   */
  async skipDuel(guildId) {
    await this.endDuel(guildId);
    
    // Immediately start next duel
    setTimeout(() => {
      this.checkGuild(guildId);
    }, 2000);
  }
}

export default new DuelManager();
