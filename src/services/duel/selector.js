/**
 * Duel Selector Service
 * Selects pairs of images for duels
 * Smart selection to avoid recent matchups
 */

import database from '../../database/database.js';

class DuelSelector {
  /**
   * Select two images for a duel
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object|null>} {image1, image2} or null
   */
  async selectPair(guildId) {
    // Get all active images
    const result = await database.query(
      `SELECT * FROM images 
       WHERE guild_id = $1 AND retired = false
       ORDER BY RANDOM()`,
      [guildId]
    );

    const images = result.rows;

    if (images.length < 2) {
      console.log(`⚠️ Not enough images for duel (need 2, have ${images.length})`);
      return null;
    }

    // Get recent matchups to avoid
    const recentMatchups = await this.getRecentMatchups(guildId, 5);

    // Find a pair that hasn't dueled recently
    for (let i = 0; i < images.length - 1; i++) {
      for (let j = i + 1; j < images.length; j++) {
        const pair = [images[i].id, images[j].id].sort();
        const pairKey = `${pair[0]}-${pair[1]}`;

        if (!recentMatchups.has(pairKey)) {
          return {
            image1: images[i],
            image2: images[j]
          };
        }
      }
    }

    // If all pairs have dueled recently, just use first two
    return {
      image1: images[0],
      image2: images[1]
    };
  }

  /**
   * Get recent matchups to avoid repeating
   * @param {string} guildId - Guild ID
   * @param {number} limit - Number of recent duels to check
   * @returns {Promise<Set>} Set of matchup keys
   */
  async getRecentMatchups(guildId, limit = 5) {
    const result = await database.query(
      `SELECT image1_id, image2_id 
       FROM duels 
       WHERE guild_id = $1 
       ORDER BY started_at DESC 
       LIMIT $2`,
      [guildId, limit]
    );

    const matchups = new Set();

    for (const duel of result.rows) {
      const pair = [duel.image1_id, duel.image2_id].sort();
      matchups.add(`${pair[0]}-${pair[1]}`);
    }

    return matchups;
  }

  /**
   * Get image count for a guild
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} {total, active, retired}
   */
  async getImageCount(guildId) {
    const result = await database.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE retired = false) as active,
        COUNT(*) FILTER (WHERE retired = true) as retired
       FROM images 
       WHERE guild_id = $1`,
      [guildId]
    );

    return result.rows[0];
  }
}

export default new DuelSelector();
