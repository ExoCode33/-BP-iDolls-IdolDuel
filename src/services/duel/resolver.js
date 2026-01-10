/**
 * Duel Resolver Service
 * Resolves duels by counting votes and updating ELO
 * FIXED: BigInt handling for image IDs
 */

import database from '../../database/database.js';
import eloCalculator from '../elo/calculator.js';
import retirement from '../image/retirement.js';

class DuelResolver {
  /**
   * Resolve a duel (called by manager.js)
   * @param {string} guildId - Guild ID
   * @param {number} duelId - Duel ID
   * @param {Client} client - Discord client
   */
  async resolveDuel(guildId, duelId, client) {
    try {
      // Ensure guildId is string
      const guildIdStr = typeof guildId === 'bigint' ? guildId.toString() : String(guildId);

      // Get duel info
      const duelInfo = await database.query(
        'SELECT * FROM duels WHERE id = $1',
        [duelId]
      );

      if (duelInfo.rows.length === 0) {
        console.error('Duel not found:', duelId);
        return { skipped: true };
      }

      const duel = duelInfo.rows[0];
      const image1Id = duel.image1_id;
      const image2Id = duel.image2_id;

      // Get guild config for K-factor
      const configResult = await database.query(
        'SELECT k_factor, retire_after_losses, retire_below_elo FROM guild_config WHERE guild_id = $1',
        [guildIdStr]
      );

      const config = configResult.rows[0];
      const kFactor = config?.k_factor || 32;

      // Count votes
      const voteCounts = await this.countVotes(duelId, image1Id, image2Id);

      // No votes = skip
      if (voteCounts.total === 0) {
        await this.markDuelSkipped(duelId);
        console.log(`⏭️ Duel ${duelId} skipped (no votes)`);
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
      const images = await this.getImages(guildIdStr, [winnerId, loserId]);
      const winner = images.find(img => img.id === winnerId);
      const loser = images.find(img => img.id === loserId);

      if (!winner || !loser) {
        console.error('Winner or loser not found in database');
        await this.markDuelSkipped(duelId);
        return { skipped: true };
      }

      // Calculate ELO changes
      const eloChanges = eloCalculator.calculateDuelResults(
        winner.elo,
        loser.elo,
        kFactor
      );

      // Update database
      await this.updateDuelRecord(duelId, winnerId, voteCounts.image1, voteCounts.image2);
      await this.updateImageStats(winnerId, loserId, eloChanges);

      // Check for retirement
      const retired = await retirement.checkAndRetire(guildIdStr, loserId);

      // Get updated records
      const updatedImages = await this.getImages(guildIdStr, [winnerId, loserId]);
      const updatedWinner = updatedImages.find(img => img.id === winnerId);
      const updatedLoser = updatedImages.find(img => img.id === loserId);

      console.log(`✅ Duel ${duelId} resolved: Winner #${winnerId} (${eloChanges.winnerChange >= 0 ? '+' : ''}${eloChanges.winnerChange} ELO)`);

      return {
        skipped: false,
        winner: updatedWinner,
        loser: updatedLoser,
        winnerVotes,
        loserVotes,
        eloChanges,
        retired
      };
    } catch (error) {
      console.error('Error resolving duel:', error);
      throw error;
    }
  }

  /**
   * Count votes for a duel
   * @param {number} duelId - Duel ID
   * @param {number} image1Id - Image 1 ID
   * @param {number} image2Id - Image 2 ID
   * @returns {Promise<Object>} {image1, image2, total}
   */
  async countVotes(duelId, image1Id, image2Id) {
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
      const imageId = parseInt(row.image_id);
      const voteCount = parseInt(row.votes);
      
      if (imageId === image1Id) {
        counts.image1 = voteCount;
      } else if (imageId === image2Id) {
        counts.image2 = voteCount;
      }
      
      counts.total += voteCount;
    }

    return counts;
  }

  /**
   * Get multiple images by ID
   * FIXED: Ensure proper type handling for BigInt
   * @param {string} guildId - Guild ID
   * @param {Array} imageIds - Array of image IDs
   * @returns {Promise<Array>} Array of image records
   */
  async getImages(guildId, imageIds) {
    // Ensure guildId is string
    const guildIdStr = typeof guildId === 'bigint' ? guildId.toString() : String(guildId);
    
    // Ensure imageIds are integers (not BigInts)
    const imageIdsArray = imageIds.map(id => {
      if (typeof id === 'bigint') {
        return parseInt(id.toString());
      }
      return parseInt(id);
    });
    
    const result = await database.query(
      'SELECT * FROM images WHERE guild_id = $1 AND id = ANY($2)',
      [guildIdStr, imageIdsArray]
    );

    return result.rows;
  }

  /**
   * Update duel record with winner and vote counts
   * @param {number} duelId - Duel ID
   * @param {number} winnerId - Winner image ID
   * @param {number} image1Votes - Image 1 votes
   * @param {number} image2Votes - Image 2 votes
   */
  async updateDuelRecord(duelId, winnerId, image1Votes, image2Votes) {
    await database.query(
      `UPDATE duels 
       SET winner_id = $1, image1_votes = $2, image2_votes = $3, ended_at = NOW() 
       WHERE id = $4`,
      [winnerId, image1Votes, image2Votes, duelId]
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
