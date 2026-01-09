/**
 * Image Retirement Service
 * Smart auto-retirement based on duel frequency
 */

import database from '../../database/database.js';

class RetirementService {
  /**
   * Calculate retirement threshold based on duel frequency
   * Images get ~2 days worth of duels to prove themselves
   * 
   * @param {number} duelInterval - Seconds between duels
   * @returns {number} Number of losses before retirement
   */
  calculateThreshold(duelInterval) {
    const duelsPerDay = 86400 / duelInterval;
    const threshold = Math.max(3, Math.floor(duelsPerDay * 2));
    
    return threshold;
  }

  /**
   * Check if an image should be retired
   * @param {Object} image - Image record
   * @param {number} threshold - Retirement threshold
   * @returns {boolean} True if should retire
   */
  shouldRetire(image, threshold) {
    // Already retired
    if (image.retired) return false;
    
    // Check consecutive losses
    return image.losses >= threshold;
  }

  /**
   * Retire an image
   * @param {string} guildId - Guild ID
   * @param {number} imageId - Image ID
   * @param {string} reason - Retirement reason
   */
  async retireImage(guildId, imageId, reason = 'auto_retirement') {
    await database.query(
      `UPDATE images 
       SET retired = true, retired_at = NOW() 
       WHERE guild_id = $1 AND id = $2`,
      [guildId, imageId]
    );

    console.log(`🗑️ Image ${imageId} retired (${reason})`);
  }

  /**
   * Check and retire images after a duel
   * @param {string} guildId - Guild ID
   * @param {number} loserId - Loser image ID
   * @param {number} duelInterval - Duel interval in seconds
   * @returns {Promise<boolean>} True if image was retired
   */
  async checkAndRetire(guildId, loserId, duelInterval) {
    // Get loser's stats
    const result = await database.query(
      'SELECT * FROM images WHERE guild_id = $1 AND id = $2',
      [guildId, loserId]
    );

    if (result.rows.length === 0) return false;

    const loser = result.rows[0];

    // Calculate threshold
    const threshold = this.calculateThreshold(duelInterval);

    // Check if should retire
    if (this.shouldRetire(loser, threshold)) {
      await this.retireImage(guildId, loserId, 'consecutive_losses');
      return true;
    }

    return false;
  }

  /**
   * Get retirement status message
   * @param {number} duelInterval - Duel interval in seconds
   * @returns {string} Human-readable retirement info
   */
  getRetirementInfo(duelInterval) {
    const threshold = this.calculateThreshold(duelInterval);
    const duelsPerDay = Math.round((86400 / duelInterval) * 10) / 10;
    const daysToRetire = Math.round((threshold / duelsPerDay) * 10) / 10;

    return `Smart Retirement: ${threshold} losses (≈${daysToRetire} days with ${duelsPerDay} duels/day)`;
  }

  /**
   * Unretire an image (admin action)
   * @param {string} guildId - Guild ID
   * @param {number} imageId - Image ID
   */
  async unretireImage(guildId, imageId) {
    await database.query(
      `UPDATE images 
       SET retired = false, retired_at = NULL 
       WHERE guild_id = $1 AND id = $2`,
      [guildId, imageId]
    );

    console.log(`♻️ Image ${imageId} unretired`);
  }

  /**
   * Get retirement statistics
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Stats object
   */
  async getStats(guildId) {
    const result = await database.query(
      `SELECT 
        COUNT(*) FILTER (WHERE retired = false) as active,
        COUNT(*) FILTER (WHERE retired = true) as retired,
        COUNT(*) as total
       FROM images 
       WHERE guild_id = $1`,
      [guildId]
    );

    return result.rows[0];
  }
}

export default new RetirementService();
