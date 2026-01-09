/**
 * Image Retirement Service
 * Configurable retirement based on losses or ELO threshold
 */

import database from '../../database/database.js';

class RetirementService {
  /**
   * Check if an image should be retired based on guild settings
   * @param {Object} image - Image record
   * @param {number} retireAfterLosses - Retire after X losses (0 = disabled)
   * @param {number} retireBelowElo - Retire below X ELO (0 = disabled)
   * @returns {boolean} True if should retire
   */
  shouldRetire(image, retireAfterLosses, retireBelowElo) {
    // Already retired
    if (image.retired) return false;
    
    // Check losses threshold
    if (retireAfterLosses > 0 && image.losses >= retireAfterLosses) {
      return true;
    }

    // Check ELO threshold
    if (retireBelowElo > 0 && image.elo < retireBelowElo) {
      return true;
    }

    return false;
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
   * @returns {Promise<boolean>} True if image was retired
   */
  async checkAndRetire(guildId, loserId) {
    // Get guild config
    const configResult = await database.query(
      'SELECT retire_after_losses, retire_below_elo FROM guild_config WHERE guild_id = $1',
      [guildId]
    );

    if (configResult.rows.length === 0) return false;

    const config = configResult.rows[0];

    // Get loser's stats
    const result = await database.query(
      'SELECT * FROM images WHERE guild_id = $1 AND id = $2',
      [guildId, loserId]
    );

    if (result.rows.length === 0) return false;

    const loser = result.rows[0];

    // Check if should retire
    if (this.shouldRetire(loser, config.retire_after_losses, config.retire_below_elo)) {
      const reason = config.retire_after_losses > 0 && loser.losses >= config.retire_after_losses
        ? `${loser.losses} losses`
        : `ELO below ${config.retire_below_elo}`;
      
      await this.retireImage(guildId, loserId, reason);
      return true;
    }

    return false;
  }

  /**
   * Get retirement info string for display
   * @param {number} retireAfterLosses - Retire after X losses
   * @param {number} retireBelowElo - Retire below X ELO
   * @returns {string} Human-readable retirement info
   */
  getRetirementInfo(retireAfterLosses, retireBelowElo) {
    if (retireAfterLosses > 0 && retireBelowElo > 0) {
      return `Auto-Retire: ${retireAfterLosses} losses OR below ${retireBelowElo} ELO`;
    } else if (retireAfterLosses > 0) {
      return `Auto-Retire: After ${retireAfterLosses} losses`;
    } else if (retireBelowElo > 0) {
      return `Auto-Retire: Below ${retireBelowElo} ELO`;
    }
    return 'Auto-Retirement: Disabled';
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
