/**
 * Logger Utility
 * Logs actions to Discord channel (replaces logs table)
 */

import embedUtils from './embeds.js';
import database from '../database/database.js';

class Logger {
  constructor() {
    this.client = null;
  }

  /**
   * Set Discord client
   * @param {Client} client - Discord.js client
   */
  setClient(client) {
    this.client = client;
  }

  /**
   * Log an action to Discord channel
   * @param {string} guildId - Guild ID
   * @param {string} action - Action type
   * @param {string} message - Log message
   * @param {Object} details - Additional details
   */
  async log(guildId, action, message, details = {}) {
    try {
      // Get log channel from config
      const result = await database.query(
        'SELECT log_channel_id FROM guild_config WHERE guild_id = $1',
        [guildId]
      );

      if (result.rows.length === 0 || !result.rows[0].log_channel_id) {
        // No log channel configured
        return;
      }

      const logChannelId = result.rows[0].log_channel_id;

      // Get channel
      const channel = await this.client.channels.fetch(logChannelId);

      if (!channel) {
        console.log(`⚠️ Log channel not found for guild ${guildId}`);
        return;
      }

      // Create embed
      const embed = embedUtils.createBaseEmbed();
      
      // Color based on action
      const colors = {
        'duel_started': 0x00FF88,
        'duel_ended': 0x5865F2,
        'duel_skipped': 0xFFAA00,
        'image_imported': 0x00D4FF,
        'image_retired': 0xFF69B4,
        'error': 0xFF6B6B
      };

      embed.setColor(colors[action] || 0xFF69B4);
      embed.setTitle(`📋 ${action.toUpperCase().replace(/_/g, ' ')}`);
      embed.setDescription(message);

      if (Object.keys(details).length > 0) {
        embed.addFields({
          name: 'Details',
          value: `\`\`\`json\n${JSON.stringify(details, null, 2)}\`\`\``
        });
      }

      embed.setTimestamp();

      // Send to channel
      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error logging to Discord:', error);
    }
  }

  /**
   * Log duel start
   * @param {string} guildId - Guild ID
   * @param {number} duelId - Duel ID
   * @param {Object} image1 - Image 1
   * @param {Object} image2 - Image 2
   */
  async logDuelStart(guildId, duelId, image1, image2) {
    await this.log(
      guildId,
      'duel_started',
      `Duel #${duelId} started!`,
      {
        image1_id: image1.id,
        image1_elo: image1.elo,
        image2_id: image2.id,
        image2_elo: image2.elo
      }
    );
  }

  /**
   * Log duel end
   * @param {string} guildId - Guild ID
   * @param {number} duelId - Duel ID
   * @param {Object} results - Duel results
   */
  async logDuelEnd(guildId, duelId, results) {
    if (results.skipped) {
      await this.log(
        guildId,
        'duel_skipped',
        `Duel #${duelId} ended with no votes.`,
        {}
      );
    } else {
      await this.log(
        guildId,
        'duel_ended',
        `Duel #${duelId} completed!\n\nWinner: Image #${results.winner.id} (+${results.eloChanges.winnerChange} ELO)`,
        {
          winner_id: results.winner.id,
          loser_id: results.loser.id,
          winner_votes: results.winnerVotes,
          loser_votes: results.loserVotes,
          elo_changes: results.eloChanges
        }
      );
    }
  }

  /**
   * Log image import
   * @param {string} guildId - Guild ID
   * @param {Object} image - Image record
   */
  async logImageImport(guildId, image) {
    await this.log(
      guildId,
      'image_imported',
      `New image imported!\n\nImage #${image.id} by <@${image.uploader_id}>`,
      {
        image_id: image.id,
        starting_elo: image.elo
      }
    );
  }

  /**
   * Log image retirement
   * @param {string} guildId - Guild ID
   * @param {number} imageId - Image ID
   * @param {string} reason - Retirement reason
   */
  async logImageRetirement(guildId, imageId, reason) {
    await this.log(
      guildId,
      'image_retired',
      `Image #${imageId} retired\n\nReason: ${reason}`,
      {
        image_id: imageId,
        reason
      }
    );
  }

  /**
   * Log error
   * @param {string} guildId - Guild ID
   * @param {string} error - Error message
   * @param {Object} details - Error details
   */
  async logError(guildId, error, details = {}) {
    await this.log(
      guildId,
      'error',
      `⚠️ Error occurred:\n\n${error}`,
      details
    );
  }
}

export default new Logger();
