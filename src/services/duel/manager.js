/**
 * Duel Manager - 2 EMBED VERSION
 * Handles array of 2 embeds properly
 * FIXED: BigInt handling throughout + Vote counter updates
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
    this.voteUpdateIntervals = new Map();
  }

  setClient(client) {
    this.client = client;
  }

  async startAllGuilds() {
    try {
      const result = await database.query(
        'SELECT guild_id FROM guild_config WHERE duel_active = true'
      );

      for (const row of result.rows) {
        const guildId = row.guild_id;
        
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

  async resumeActiveDuel(guildId, activeDuelRow) {
    try {
      const duelId = activeDuelRow.duel_id;
      const endsAt = new Date(activeDuelRow.ends_at);
      const now = new Date();

      if (endsAt <= now) {
        console.log(`⏰ Duel ${duelId} expired, ending now...`);
        await this.endDuel(guildId);
        await this.checkGuild(guildId);
        return;
      }

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

      await redis.setActiveDuel(guildId, duelData);
      console.log(`✅ Restored duel ${duelId} for guild ${guildId}`);

      const remainingTime = endsAt - now;
      const timer = setTimeout(() => {
        this.endDuel(guildId);
      }, remainingTime);

      this.activeTimers.set(guildId, timer);
      console.log(`⏰ Duel will end in ${Math.round(remainingTime / 1000)}s`);

    } catch (error) {
      console.error('Error resuming active duel:', error);
      await database.query('DELETE FROM active_duels WHERE guild_id = $1', [guildId]);
      await this.checkGuild(guildId);
    }
  }

  async checkGuild(guildId) {
    try {
      // FIXED: Ensure guildId is string
      const guildIdStr = typeof guildId === 'bigint' ? guildId.toString() : String(guildId);

      const configResult = await database.query(
        'SELECT * FROM guild_config WHERE guild_id = $1',
        [guildIdStr]
      );

      if (configResult.rows.length === 0) return;

      const config = configResult.rows[0];

      if (!config.duel_active || config.duel_paused) return;

      const activeDuelCheck = await database.query(
        'SELECT * FROM active_duels WHERE guild_id = $1',
        [guildIdStr]
      );

      if (activeDuelCheck.rows.length > 0) {
        console.log(`Guild ${guildIdStr} already has an active duel`);
        return;
      }

      await this.createNewDuel(guildIdStr, config);
    } catch (error) {
      console.error(`Error checking guild ${guildId}:`, error);
    }
  }

  async createNewDuel(guildId, config) {
    try {
      const pair = await selector.selectPair(guildId);

      if (!pair) {
        console.log(`No images available for duel in guild ${guildId}`);
        return;
      }

      const result = await database.query(
        `INSERT INTO duels (guild_id, image1_id, image2_id, started_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING id`,
        [guildId, pair.image1.id, pair.image2.id]
      );

      const duelId = result.rows[0].id;

      const now = new Date();
      const endsAt = new Date(now.getTime() + config.duel_duration * 1000);

      await database.query(
        `INSERT INTO active_duels (guild_id, duel_id, ends_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (guild_id) 
         DO UPDATE SET duel_id = $2, ends_at = $3`,
        [guildId, duelId, endsAt]
      );

      const duelData = {
        duelId,
        image1: pair.image1,
        image2: pair.image2,
        startedAt: now,
        endsAt: endsAt
      };

      await redis.setActiveDuel(guildId, duelData);

      const messageId = await this.postDuelMessage(guildId, config, pair, endsAt);

      await database.query(
        'UPDATE active_duels SET message_id = $1 WHERE guild_id = $2',
        [messageId, guildId]
      );

      duelData.messageId = messageId;
      await redis.setActiveDuel(guildId, duelData);

      const timer = setTimeout(() => {
        this.endDuel(guildId);
      }, config.duel_duration * 1000);

      this.activeTimers.set(guildId, timer);

      console.log(`🎮 Started duel ${duelId} for guild ${guildId}`);
    } catch (error) {
      console.error('Error creating new duel:', error);
    }
  }

  async postDuelMessage(guildId, config, pair, endsAt) {
    try {
      const channel = await this.client.channels.fetch(config.duel_channel_id);

      if (!channel) {
        throw new Error('Duel channel not found');
      }

      const url1 = await storage.getImageUrl(pair.image1.s3_key);
      const url2 = await storage.getImageUrl(pair.image2.s3_key);

      // Create embeds (returns array of 2 embeds)
      const embeds = embedUtils.createDuelEmbed(pair.image1, pair.image2, url1, url2, endsAt);

      // Create buttons
      const row = embedUtils.createVoteButtons(pair.image1.id, pair.image2.id);

      // Send with embeds array
      const message = await channel.send({ embeds: embeds, components: [row] });

      // Set up vote counter update (every 30 seconds)
      const updateInterval = setInterval(async () => {
        try {
          // Check if duel is still active
          const activeDuelCheck = await database.query(
            'SELECT * FROM active_duels WHERE guild_id = $1',
            [guildId]
          );

          if (activeDuelCheck.rows.length === 0) {
            clearInterval(updateInterval);
            this.voteUpdateIntervals.delete(guildId);
            return;
          }

          const duelId = activeDuelCheck.rows[0].duel_id;

          // Get current vote counts
          const votes = await database.query(
            `SELECT image_id, COUNT(*) as votes
             FROM votes
             WHERE duel_id = $1
             GROUP BY image_id`,
            [duelId]
          );

          let image1Votes = 0;
          let image2Votes = 0;

          for (const row of votes.rows) {
            if (row.image_id === pair.image1.id) {
              image1Votes = parseInt(row.votes);
            } else if (row.image_id === pair.image2.id) {
              image2Votes = parseInt(row.votes);
            }
          }

          // Update the embeds with vote counts
          const updatedEmbeds = embedUtils.createDuelEmbed(
            pair.image1, 
            pair.image2, 
            url1, 
            url2, 
            endsAt,
            image1Votes,
            image2Votes
          );

          await message.edit({ embeds: updatedEmbeds });
        } catch (error) {
          console.error('Error updating vote counts:', error);
          clearInterval(updateInterval);
          this.voteUpdateIntervals.delete(guildId);
        }
      }, 30000); // Update every 30 seconds

      // Store the interval so we can clear it later
      this.voteUpdateIntervals.set(guildId, updateInterval);

      return message.id;
    } catch (error) {
      console.error('Error posting duel message:', error);
      throw error;
    }
  }

  async endDuel(guildId) {
    try {
      console.log(`⏰ Ending duel for guild ${guildId}...`);

      // FIXED: Ensure guildId is string
      const guildIdStr = typeof guildId === 'bigint' ? guildId.toString() : String(guildId);

      const activeDuel = await this.getActiveDuel(guildIdStr);

      if (!activeDuel) {
        console.log('No active duel found');
        return;
      }

      // Clear vote update interval
      if (this.voteUpdateIntervals.has(guildIdStr)) {
        clearInterval(this.voteUpdateIntervals.get(guildIdStr));
        this.voteUpdateIntervals.delete(guildIdStr);
      }

      // FIXED: Call resolver with correct parameters
      await resolver.resolveDuel(guildIdStr, activeDuel.duelId, this.client);

      await database.query('DELETE FROM active_duels WHERE guild_id = $1', [guildIdStr]);
      await redis.clearActiveDuel(guildIdStr);

      if (this.activeTimers.has(guildIdStr)) {
        clearTimeout(this.activeTimers.get(guildIdStr));
        this.activeTimers.delete(guildIdStr);
      }

      const configResult = await database.query(
        'SELECT * FROM guild_config WHERE guild_id = $1',
        [guildIdStr]
      );

      if (configResult.rows.length === 0) return;

      const config = configResult.rows[0];

      const nextDuelTimer = setTimeout(() => {
        this.checkGuild(guildIdStr);
      }, config.duel_interval * 1000);

      this.activeTimers.set(`${guildIdStr}_next`, nextDuelTimer);

      console.log(`✅ Duel ended, next duel in ${config.duel_interval / 60} minutes`);
    } catch (error) {
      console.error('Error ending duel:', error);
    }
  }

  async getActiveDuel(guildId) {
    try {
      let duel = await redis.getActiveDuel(guildId);

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

          await redis.setActiveDuel(guildId, duel);
        }
      }

      return duel;
    } catch (error) {
      console.error('Error getting active duel:', error);
      return null;
    }
  }

  async startDuel(guildId) {
    const guildIdStr = typeof guildId === 'bigint' ? guildId.toString() : String(guildId);
    
    await database.query(
      'UPDATE guild_config SET duel_active = true, duel_paused = false WHERE guild_id = $1',
      [guildIdStr]
    );

    await this.checkGuild(guildIdStr);
  }

  async stopDuel(guildId) {
    const guildIdStr = typeof guildId === 'bigint' ? guildId.toString() : String(guildId);
    
    await database.query(
      'UPDATE guild_config SET duel_active = false, duel_paused = false WHERE guild_id = $1',
      [guildIdStr]
    );

    if (this.activeTimers.has(guildIdStr)) {
      clearTimeout(this.activeTimers.get(guildIdStr));
      this.activeTimers.delete(guildIdStr);
    }

    if (this.activeTimers.has(`${guildIdStr}_next`)) {
      clearTimeout(this.activeTimers.get(`${guildIdStr}_next`));
      this.activeTimers.delete(`${guildIdStr}_next`);
    }

    if (this.voteUpdateIntervals.has(guildIdStr)) {
      clearInterval(this.voteUpdateIntervals.get(guildIdStr));
      this.voteUpdateIntervals.delete(guildIdStr);
    }
  }

  async skipDuel(guildId) {
    const guildIdStr = typeof guildId === 'bigint' ? guildId.toString() : String(guildId);
    
    await this.endDuel(guildIdStr);
    
    setTimeout(() => {
      this.checkGuild(guildIdStr);
    }, 2000);
  }
}

export default new DuelManager();
