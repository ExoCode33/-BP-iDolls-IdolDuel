/**
 * Duel Resolver Service
 * Resolves duels by counting votes and updating ELO
 */

import database from '../../database/database.js';
import eloCalculator from '../elo/calculator.js';
import retirement from '../image/retirement.js';
import cache from '../cache/manager.js';

class DuelResolver {
  /**
   * Resolve a duel
   * @param {string} guildId - Guild ID
   * @param {number} duelId - Duel ID
   * @param {number} image1Id - Image 1 ID
   * @param {number} image2Id - Image 2 ID
   * @param {number} kFactor - K-factor for ELO
   * @param {number} duelInterval - Duel interval for retirement check
   * @returns {Promise<Object>} Results object
   */
  async resolveDuel(guildId, duelId, image1Id, image2Id, kFactor, duelInterval) {
    // Count votes
    const voteCounts = await this.countVotes(duelId);

    // No votes = skip
    if (voteCounts.total === 0) {
      await this.markDuelSkipped(duelId);
      return {
        skipped: true,
        winner: null,
        loser: null
      };
    }

    // Determine winner
    const winnerId = voteCounts.image1 > voteCounts.image2 ? image1Id : image2Id;
    const loserId = winnerId === image1Id ? image2Id : image1Id;
    const winnerVotes = winnerId === image1Id ? voteCounts.image1 : voteCounts.image2;
    const loserVotes = winnerId === image1Id ? voteCounts.image2 : voteCounts.image1;

    // Get image records
    const images = await this.getImages(guildId, [winnerId, loserId]);
    const winner = images.find(img => img.id === winnerId);
    const loser = images.find(img => img.id === loserId);

    // Calculate ELO changes
    const eloChanges = eloCalculator.calculateDuelResults(
      winner.elo,
      loser.elo,
      kFactor
    );

    // Update database
    await this.updateDuelRecord(duelId, winnerId);
    await this.updateImageStats(winnerId, loserId, eloChanges);

    // Check for retirement
    const retired = await retirement.checkAndRetire(guildId, loserId, duelInterval);

    // Invalidate caches
    await cache.invalidateLeaderboard(guildId);

    console.log(`✅ Duel resolved: Winner #${winnerId} (${eloChanges.winnerChange >= 0 ? '+' : ''}${eloChanges.winnerChange} ELO)`);

    return {
      skipped: false,
      winner,
      loser,
      winnerVotes,
      loserVotes,
      eloChanges,
      retired
    };
  }

  /**
   * Count votes for a duel
   * @param {number} duelId - Duel ID
   * @returns {Promise<Object>} {image1, image2, total}
   */
  async countVotes(duelId) {
    const result = await database.query(
      `SELECT image_id, COUNT(*) as votes
       FROM votes
       WHERE duel_id = $1
       GROUP BY image_id`,
      [duelId]
    );

    const counts = {
      image1: 0,
      image2: 0,
      total: 0
    };

    for (const row of result.rows) {
      counts[row.image_id] = parseInt(row.votes);
      counts.total += parseInt(row.votes);
    }

    // Determine which is image1 and image2
    const duelInfo = await database.query(
      'SELECT image1_id, image2_id FROM duels WHERE id = $1',
      [duelId]
    );

    if (duelInfo.rows.length > 0) {
      const { image1_id, image2_id } = duelInfo.rows[0];
      counts.image1 = counts[image1_id] || 0;
      counts.image2 = counts[image2_id] || 0;
      delete counts[image1_id];
      delete counts[image2_id];
    }

    return counts;
  }

  /**
   * Get multiple images by ID
   * @param {string} guildId - Guild ID
   * @param {Array} imageIds - Array of image IDs
   * @returns {Promise<Array>} Array of image records
   */
  async getImages(guildId, imageIds) {
    const result = await database.query(
      'SELECT * FROM images WHERE guild_id = $1 AND id = ANY($2)',
      [guildId, imageIds]
    );

    return result.rows;
  }

  /**
   * Update duel record with winner
   * @param {number} duelId - Duel ID
   * @param {number} winnerId - Winner image ID
   */
  async updateDuelRecord(duelId, winnerId) {
    await database.query(
      'UPDATE duels SET winner_id = $1, ended_at = NOW() WHERE id = $2',
      [winnerId, duelId]
    );
  }

  /**
   * Update image statistics after duel
   * @param {number} winnerId - Winner ID
   * @param {number} loserId - Loser ID
   * @param {Object} eloChanges - ELO changes
   */
  async updateImageStats(winnerId, loserId, eloChanges) {
    // Update winner
    await database.query(
      `UPDATE images 
       SET elo = $1, wins = wins + 1, last_duel_at = NOW()
       WHERE id = $2`,
      [eloChanges.winnerNewElo, winnerId]
    );

    // Update loser
    await database.query(
      `UPDATE images 
       SET elo = $1, losses = losses + 1, last_duel_at = NOW()
       WHERE id = $2`,
      [eloChanges.loserNewElo, loserId]
    );
  }

  /**
   * Mark duel as skipped (no votes)
   * @param {number} duelId - Duel ID
   */
  async markDuelSkipped(duelId) {
    await database.query(
      'UPDATE duels SET ended_at = NOW() WHERE id = $1',
      [duelId]
    );
  }
}

export default new DuelResolver();
