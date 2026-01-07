import database from '../database/database.js';
import redis from '../database/redis.js';
import eloService from './elo.js';

class DuelManager {
  /**
   * Find two images for a duel using smart matchmaking
   * @param {string} guildId - Guild ID
   * @param {Object} config - Guild configuration
   * @returns {Promise<{image1: Object, image2: Object, isWildcard: boolean} | null>}
   */
  async findDuelPair(guildId, config) {
    try {
      // Get all active images
      const result = await database.query(
        `SELECT * FROM images 
         WHERE guild_id = $1 AND retired = false 
         ORDER BY RANDOM()`,
        [guildId]
      );

      if (result.rows.length < 2) {
        console.log('⚠️  Not enough active images for a duel');
        return null;
      }

      const images = result.rows;
      
      // Determine if this is a wildcard duel
      const isWildcard = eloService.isWildcardDuel(config.wildcard_chance);

      if (isWildcard) {
        // Wildcard: any two images from different uploaders
        return this.findWildcardPair(images);
      } else {
        // Normal: similar ELO, different uploaders
        return this.findBalancedPair(images);
      }
    } catch (error) {
      console.error('❌ Error finding duel pair:', error);
      return null;
    }
  }

  /**
   * Find a balanced pair with similar ELO
   * @param {Array} images - Array of image objects
   * @returns {Object | null}
   */
  findBalancedPair(images) {
    // Sort by ELO
    const sorted = [...images].sort((a, b) => a.elo - b.elo);

    // Try to find pairs with increasing ELO difference tolerance
    const tolerances = [100, 200, 300, 500, 1000];

    for (const tolerance of tolerances) {
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const img1 = sorted[i];
          const img2 = sorted[j];

          // Must be from different uploaders
          if (img1.uploader_id === img2.uploader_id) continue;

          // Check ELO difference
          const eloDiff = Math.abs(img1.elo - img2.elo);
          if (eloDiff <= tolerance) {
            return {
              image1: img1,
              image2: img2,
              isWildcard: false
            };
          }
        }
      }
    }

    // If no good match found with same uploader restriction, allow it as fallback
    console.log('⚠️  No balanced pair found, using fallback');
    return this.findWildcardPair(images);
  }

  /**
   * Find a wildcard pair (any two from different uploaders)
   * @param {Array} images - Array of image objects
   * @returns {Object | null}
   */
  findWildcardPair(images) {
    // Shuffle array
    const shuffled = [...images].sort(() => Math.random() - 0.5);

    // Find first two images from different uploaders
    for (let i = 0; i < shuffled.length; i++) {
      for (let j = i + 1; j < shuffled.length; j++) {
        if (shuffled[i].uploader_id !== shuffled[j].uploader_id) {
          return {
            image1: shuffled[i],
            image2: shuffled[j],
            isWildcard: true
          };
        }
      }
    }

    // Last resort: allow same uploader
    if (shuffled.length >= 2) {
      return {
        image1: shuffled[0],
        image2: shuffled[1],
        isWildcard: true
      };
    }

    return null;
  }

  /**
   * Start a new duel
   * @param {string} guildId - Guild ID
   * @param {Object} config - Guild configuration
   * @returns {Promise<Object | null>}
   */
  async startDuel(guildId, config) {
    try {
      // Check if duel already active
      const activeCheck = await database.query(
        'SELECT * FROM active_duels WHERE guild_id = $1',
        [guildId]
      );

      if (activeCheck.rows.length > 0) {
        console.log('⚠️  Duel already active for this guild');
        return null;
      }

      // Find duel pair
      const pair = await this.findDuelPair(guildId, config);
      if (!pair) return null;

      const { image1, image2, isWildcard } = pair;

      // Create duel record
      const duelResult = await database.query(
        `INSERT INTO duels (guild_id, image1_id, image2_id, is_wildcard, started_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING *`,
        [guildId, image1.id, image2.id, isWildcard]
      );

      const duel = duelResult.rows[0];

      // Calculate end time
      const endsAt = new Date(Date.now() + config.duel_duration * 1000);

      // Create active duel record
      await database.query(
        `INSERT INTO active_duels (guild_id, duel_id, image1_id, image2_id, ends_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [guildId, duel.id, image1.id, image2.id, endsAt]
      );

      // Initialize vote cache in Redis if available
      if (redis.isConnected) {
        await redis.hSet(`duel:${guildId}:votes`, 'image1', '0');
        await redis.hSet(`duel:${guildId}:votes`, 'image2', '0');
      }

      console.log(`✅ Duel started: Image ${image1.id} vs Image ${image2.id}`);

      return {
        duel,
        image1,
        image2,
        isWildcard,
        endsAt
      };
    } catch (error) {
      console.error('❌ Error starting duel:', error);
      return null;
    }
  }

  /**
   * Get current active duel
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object | null>}
   */
  async getActiveDuel(guildId) {
    try {
      const result = await database.query(
        `SELECT ad.*, d.is_wildcard, d.started_at,
                i1.*, i2.*,
                i1.id as image1_id, i1.s3_key as image1_s3_key, i1.elo as image1_elo,
                i1.wins as image1_wins, i1.losses as image1_losses, i1.uploader_id as image1_uploader,
                i1.current_streak as image1_streak,
                i2.id as image2_id, i2.s3_key as image2_s3_key, i2.elo as image2_elo,
                i2.wins as image2_wins, i2.losses as image2_losses, i2.uploader_id as image2_uploader,
                i2.current_streak as image2_streak
         FROM active_duels ad
         JOIN duels d ON ad.duel_id = d.id
         JOIN images i1 ON ad.image1_id = i1.id
         JOIN images i2 ON ad.image2_id = i2.id
         WHERE ad.guild_id = $1`,
        [guildId]
      );

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      
      return {
        duelId: row.duel_id,
        messageId: row.message_id,
        endsAt: row.ends_at,
        isWildcard: row.is_wildcard,
        image1: {
          id: row.image1_id,
          s3_key: row.image1_s3_key,
          elo: row.image1_elo,
          wins: row.image1_wins,
          losses: row.image1_losses,
          uploader_id: row.image1_uploader,
          current_streak: row.image1_streak || 0
        },
        image2: {
          id: row.image2_id,
          s3_key: row.image2_s3_key,
          elo: row.image2_elo,
          wins: row.image2_wins,
          losses: row.image2_losses,
          uploader_id: row.image2_uploader,
          current_streak: row.image2_streak || 0
        }
      };
    } catch (error) {
      console.error('❌ Error getting active duel:', error);
      return null;
    }
  }

  /**
   * Cast a vote in active duel
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @param {number} imageId - Image ID being voted for
   * @returns {Promise<boolean>}
   */
  async castVote(guildId, userId, imageId) {
    try {
      // Get active duel
      const activeDuel = await this.getActiveDuel(guildId);
      if (!activeDuel) return false;

      // Check if user already voted
      const existingVote = await database.query(
        'SELECT * FROM votes WHERE duel_id = $1 AND user_id = $2',
        [activeDuel.duelId, userId]
      );

      if (existingVote.rows.length > 0) {
        // User already voted, don't allow change (once per duel rule)
        return false;
      }

      // Record vote in database
      await database.query(
        `INSERT INTO votes (duel_id, user_id, image_id, voted_at)
         VALUES ($1, $2, $3, NOW())`,
        [activeDuel.duelId, userId, imageId]
      );

      // Update vote count in Redis if available
      if (redis.isConnected) {
        const field = imageId === activeDuel.image1.id ? 'image1' : 'image2';
        const current = await redis.hGet(`duel:${guildId}:votes`, field) || '0';
        await redis.hSet(`duel:${guildId}:votes`, field, String(parseInt(current) + 1));
      }

      return true;
    } catch (error) {
      console.error('❌ Error casting vote:', error);
      return false;
    }
  }

  /**
   * Get vote counts for active duel
   * @param {string} guildId - Guild ID
   * @returns {Promise<{image1Votes: number, image2Votes: number}>}
   */
  async getVoteCounts(guildId) {
    const activeDuel = await this.getActiveDuel(guildId);
    if (!activeDuel) return { image1Votes: 0, image2Votes: 0 };

    // Try Redis first
    if (redis.isConnected) {
      const votes = await redis.hGetAll(`duel:${guildId}:votes`);
      if (votes && votes.image1 !== undefined) {
        return {
          image1Votes: parseInt(votes.image1) || 0,
          image2Votes: parseInt(votes.image2) || 0
        };
      }
    }

    // Fallback to database
    const result = await database.query(
      `SELECT image_id, COUNT(*) as count
       FROM votes
       WHERE duel_id = $1
       GROUP BY image_id`,
      [activeDuel.duelId]
    );

    let image1Votes = 0;
    let image2Votes = 0;

    result.rows.forEach(row => {
      if (row.image_id === activeDuel.image1.id) {
        image1Votes = parseInt(row.count);
      } else if (row.image_id === activeDuel.image2.id) {
        image2Votes = parseInt(row.count);
      }
    });

    return { image1Votes, image2Votes };
  }

  /**
   * End current duel and calculate results
   * @param {string} guildId - Guild ID
   * @param {Object} config - Guild configuration
   * @returns {Promise<Object | null>}
   */
  async endDuel(guildId, config) {
    try {
      const activeDuel = await this.getActiveDuel(guildId);
      if (!activeDuel) return null;

      // Get vote counts
      const { image1Votes, image2Votes } = await this.getVoteCounts(guildId);

      // Check if uploader was only voter
      const uploaderOnlyVoted = await this.checkUploaderOnlyVoted(
        activeDuel.duelId,
        activeDuel.image1.uploader_id,
        activeDuel.image2.uploader_id
      );

      let winner = null;
      let loser = null;
      let winnerVotes = 0;
      let loserVotes = 0;

      if (image1Votes === 0 && image2Votes === 0) {
        // No votes - no winner
        console.log('⚠️  No votes cast, duel skipped');
      } else if (image1Votes > image2Votes) {
        winner = activeDuel.image1;
        loser = activeDuel.image2;
        winnerVotes = image1Votes;
        loserVotes = image2Votes;
      } else if (image2Votes > image1Votes) {
        winner = activeDuel.image2;
        loser = activeDuel.image1;
        winnerVotes = image2Votes;
        loserVotes = image1Votes;
      } else {
        // Tie - no winner
        console.log('⚠️  Tie vote, no winner');
      }

      // Update duel record
      await database.query(
        `UPDATE duels 
         SET winner_id = $1, image1_votes = $2, image2_votes = $3, ended_at = NOW()
         WHERE id = $4`,
        [winner?.id || null, image1Votes, image2Votes, activeDuel.duelId]
      );

      let eloChanges = null;

      // Calculate ELO if there's a winner and valid votes
      if (winner && !uploaderOnlyVoted && (winnerVotes + loserVotes) >= config.min_votes) {
        eloChanges = await this.updateEloAndStats(
          winner,
          loser,
          winnerVotes,
          loserVotes,
          activeDuel.isWildcard,
          config
        );
      }

      // Remove active duel
      await database.query('DELETE FROM active_duels WHERE guild_id = $1', [guildId]);

      // Clear Redis cache
      if (redis.isConnected) {
        await redis.del(`duel:${guildId}:votes`);
      }

      return {
        winner,
        loser,
        winnerVotes,
        loserVotes,
        eloChanges,
        skipped: !winner
      };
    } catch (error) {
      console.error('❌ Error ending duel:', error);
      return null;
    }
  }

  /**
   * Check if only the uploader voted
   * @param {number} duelId - Duel ID
   * @param {string} uploader1Id - Image 1 uploader ID
   * @param {string} uploader2Id - Image 2 uploader ID
   * @returns {Promise<boolean>}
   */
  async checkUploaderOnlyVoted(duelId, uploader1Id, uploader2Id) {
    const result = await database.query(
      'SELECT user_id FROM votes WHERE duel_id = $1',
      [duelId]
    );

    if (result.rows.length === 0) return false;
    if (result.rows.length > 1) return false;

    const voterId = result.rows[0].user_id;
    return voterId === uploader1Id || voterId === uploader2Id;
  }

  /**
   * Update ELO and stats after duel
   * @param {Object} winner - Winner image object
   * @param {Object} loser - Loser image object
   * @param {number} winnerVotes - Number of votes for winner
   * @param {number} loserVotes - Number of votes for loser
   * @param {boolean} isWildcard - Is wildcard duel
   * @param {Object} config - Guild configuration
   * @returns {Promise<Object>}
   */
  async updateEloAndStats(winner, loser, winnerVotes, loserVotes, isWildcard, config) {
    // Ensure all values are valid numbers
    const winnerElo = parseInt(winner.elo) || 1000;
    const loserElo = parseInt(loser.elo) || 1000;
    const winnerCurrentStreak = parseInt(winner.current_streak) || 0;
    const loserLosses = parseInt(loser.losses) || 0;
    
    const isUpset = winnerElo < loserElo;
    const winnerStreak = winnerCurrentStreak + 1;

    const eloChanges = eloService.calculateEloChange({
      winner: { ...winner, elo: winnerElo, current_streak: winnerCurrentStreak },
      loser: { ...loser, elo: loserElo },
      winnerVotes,
      loserVotes,
      isWildcard,
      config,
      winnerStreak,
      isUpset
    });

    // Ensure ELO changes are valid numbers
    const winnerNewElo = parseInt(eloChanges.winnerNewElo) || winnerElo;
    const loserNewElo = parseInt(eloChanges.loserNewElo) || loserElo;

    // Update winner
    await database.query(
      `UPDATE images
       SET elo = $1, wins = wins + 1, current_streak = $2, 
           best_streak = GREATEST(best_streak, $2),
           total_votes_received = total_votes_received + $3,
           last_duel_at = NOW()
       WHERE id = $4`,
      [winnerNewElo, winnerStreak, winnerVotes, winner.id]
    );

    // Update loser
    const newLosses = loserLosses + 1;
    await database.query(
      `UPDATE images
       SET elo = $1, losses = losses + 1, current_streak = 0,
           total_votes_received = total_votes_received + $2,
           last_duel_at = NOW()
       WHERE id = $3`,
      [loserNewElo, loserVotes, loser.id]
    );

    // Check if loser should retire
    if (newLosses >= config.losses_before_retirement) {
      await database.query(
        `UPDATE images SET retired = true, retired_at = NOW() WHERE id = $1`,
        [loser.id]
      );
      
      await database.query(
        `INSERT INTO logs (guild_id, action_type, details)
         VALUES ($1, 'image_retired', $2)`,
        [winner.guild_id, JSON.stringify({ imageId: loser.id, losses: newLosses })]
      );
    }

    return {
      ...eloChanges,
      winnerNewElo,
      loserNewElo
    };
  }
}

export default new DuelManager();
