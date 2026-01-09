/**
 * ELO Calculator Service
 * Pure mathematical functions for ELO calculations
 * No database access, no side effects - just math
 */

class EloCalculator {
  /**
   * Calculate expected score for a matchup
   * @param {number} playerElo - Player's current ELO
   * @param {number} opponentElo - Opponent's current ELO
   * @returns {number} Expected score (0-1)
   */
  calculateExpectedScore(playerElo, opponentElo) {
    return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  }

  /**
   * Calculate new ELO after a match
   * @param {number} currentElo - Current ELO
   * @param {number} expectedScore - Expected score (0-1)
   * @param {number} actualScore - Actual score (1 for win, 0 for loss)
   * @param {number} kFactor - K-factor (volatility)
   * @returns {number} New ELO (rounded)
   */
  calculateNewElo(currentElo, expectedScore, actualScore, kFactor) {
    const eloChange = kFactor * (actualScore - expectedScore);
    const newElo = currentElo + eloChange;
    return Math.round(newElo);
  }

  /**
   * Calculate ELO changes for both players in a duel
   * @param {number} winnerElo - Winner's current ELO
   * @param {number} loserElo - Loser's current ELO
   * @param {number} kFactor - K-factor
   * @returns {Object} { winnerNewElo, loserNewElo, winnerChange, loserChange }
   */
  calculateDuelResults(winnerElo, loserElo, kFactor) {
    // Calculate expected scores
    const winnerExpected = this.calculateExpectedScore(winnerElo, loserElo);
    const loserExpected = this.calculateExpectedScore(loserElo, winnerElo);

    // Calculate new ELOs
    const winnerNewElo = this.calculateNewElo(winnerElo, winnerExpected, 1, kFactor);
    const loserNewElo = this.calculateNewElo(loserElo, loserExpected, 0, kFactor);

    // Calculate changes
    const winnerChange = winnerNewElo - winnerElo;
    const loserChange = loserNewElo - loserElo;

    return {
      winnerNewElo,
      loserNewElo,
      winnerChange,
      loserChange
    };
  }

  /**
   * Get rank emoji based on ELO
   * @param {number} elo - ELO rating
   * @returns {string} Rank emoji
   */
  getRankEmoji(elo) {
    if (elo >= 1400) return '👑'; // Master
    if (elo >= 1300) return '💎'; // Diamond
    if (elo >= 1200) return '⭐'; // Platinum
    if (elo >= 1100) return '🔷'; // Gold
    if (elo >= 1000) return '🔹'; // Silver
    return '⚪'; // Bronze
  }

  /**
   * Get rank name based on ELO
   * @param {number} elo - ELO rating
   * @returns {string} Rank name
   */
  getRankName(elo) {
    if (elo >= 1400) return 'Master';
    if (elo >= 1300) return 'Diamond';
    if (elo >= 1200) return 'Platinum';
    if (elo >= 1100) return 'Gold';
    if (elo >= 1000) return 'Silver';
    return 'Bronze';
  }

  /**
   * Calculate win rate percentage
   * @param {number} wins - Number of wins
   * @param {number} losses - Number of losses
   * @returns {string} Win rate as percentage (e.g., "65.5")
   */
  calculateWinRate(wins, losses) {
    const total = wins + losses;
    if (total === 0) return '0.0';
    return ((wins / total) * 100).toFixed(1);
  }
}

export default new EloCalculator();
