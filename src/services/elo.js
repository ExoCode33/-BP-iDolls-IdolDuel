class EloService {
  /**
   * Calculate ELO changes for a duel
   * @param {Object} params - Calculation parameters
   * @returns {Object} - ELO changes and updated stats
   */
  calculateEloChange(params) {
    const {
      winner,
      loser,
      winnerVotes,
      loserVotes,
      isWildcard,
      config,
      winnerStreak,
      isUpset
    } = params;

    const totalVotes = winnerVotes + loserVotes;
    
    // No ELO change if no valid votes
    if (totalVotes === 0) {
      return {
        winnerEloChange: 0,
        loserEloChange: 0,
        winnerNewElo: winner.elo,
        loserNewElo: loser.elo
      };
    }

    // Base ELO calculation
    const kFactor = config.k_factor;
    const expectedWinner = this.expectedScore(winner.elo, loser.elo);
    const expectedLoser = this.expectedScore(loser.elo, winner.elo);

    let winnerChange = Math.round(kFactor * (1 - expectedWinner));
    let loserChange = Math.round(kFactor * (0 - expectedLoser));

    // Apply streak bonus to winner
    if (winnerStreak >= 3) {
      const streakMultiplier = 1 + config.streak_bonus_3;
      winnerChange = Math.round(winnerChange * streakMultiplier);
    } else if (winnerStreak === 2) {
      const streakMultiplier = 1 + config.streak_bonus_2;
      winnerChange = Math.round(winnerChange * streakMultiplier);
    }

    // Apply upset bonus (lower ELO beats higher ELO)
    if (isUpset && winner.elo < loser.elo) {
      const eloDifference = loser.elo - winner.elo;
      // Scale upset bonus with ELO difference
      const upsetScale = Math.min(eloDifference / 200, 1); // Max at 200+ ELO difference
      const upsetMultiplier = 1 + (config.upset_bonus * upsetScale);
      winnerChange = Math.round(winnerChange * upsetMultiplier);
    }

    // Apply wildcard multiplier (larger swings)
    if (isWildcard) {
      winnerChange = Math.round(winnerChange * 1.5);
      loserChange = Math.round(loserChange * 1.5);
    }

    // Ensure loser change is negative
    loserChange = Math.abs(loserChange) * -1;

    return {
      winnerEloChange: winnerChange,
      loserEloChange: loserChange,
      winnerNewElo: winner.elo + winnerChange,
      loserNewElo: Math.max(0, loser.elo + loserChange) // ELO can't go below 0
    };
  }

  /**
   * Calculate expected score using ELO formula
   * @param {number} eloA - Rating of player A
   * @param {number} eloB - Rating of player B
   * @returns {number} - Expected score (0-1)
   */
  expectedScore(eloA, eloB) {
    return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
  }

  /**
   * Determine if this is a wildcard duel
   * @param {number} wildcardChance - Chance as decimal (e.g., 0.05 for 5%)
   * @returns {boolean}
   */
  isWildcardDuel(wildcardChance) {
    return Math.random() < wildcardChance;
  }

  /**
   * Soft reset ELO for season
   * @param {number} currentElo - Current ELO
   * @param {number} defaultElo - Default starting ELO
   * @returns {number} - New ELO after soft reset
   */
  softResetElo(currentElo, defaultElo) {
    // Soft reset: (current + default) / 2
    return Math.round((currentElo + defaultElo) / 2);
  }

  /**
   * Calculate win rate percentage
   * @param {number} wins - Number of wins
   * @param {number} losses - Number of losses
   * @returns {number} - Win rate as percentage
   */
  calculateWinRate(wins, losses) {
    const total = wins + losses;
    if (total === 0) return 0;
    return Math.round((wins / total) * 100);
  }

  /**
   * Get rank name based on ELO
   * @param {number} elo - Current ELO
   * @returns {string} - Rank name
   */
  getRankName(elo) {
    if (elo >= 2000) return '💎 Diamond';
    if (elo >= 1800) return '🏆 Platinum';
    if (elo >= 1600) return '⭐ Gold';
    if (elo >= 1400) return '🥈 Silver';
    if (elo >= 1200) return '🥉 Bronze';
    return '🌱 Rookie';
  }

  /**
   * Get rank emoji based on ELO
   * @param {number} elo - Current ELO
   * @returns {string} - Rank emoji
   */
  getRankEmoji(elo) {
    if (elo >= 2000) return '💎';
    if (elo >= 1800) return '🏆';
    if (elo >= 1600) return '⭐';
    if (elo >= 1400) return '🥈';
    if (elo >= 1200) return '🥉';
    return '🌱';
  }
}

export default new EloService();
