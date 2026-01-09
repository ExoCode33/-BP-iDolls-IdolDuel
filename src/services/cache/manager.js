/**
 * Redis Cache Manager
 * Handles caching for signed URLs and hot data
 */

import redis from '../../database/redis.js';

class CacheManager {
  /**
   * Cache a signed URL
   * @param {string} s3Key - S3 key
   * @param {string} url - Signed URL
   * @param {number} ttl - Time to live in seconds (default 3600)
   */
  async cacheUrl(s3Key, url, ttl = 3600) {
    const key = `url:${s3Key}`;
    await redis.set(key, url, ttl);
  }

  /**
   * Get cached URL
   * @param {string} s3Key - S3 key
   * @returns {Promise<string|null>} Cached URL or null
   */
  async getUrl(s3Key) {
    const key = `url:${s3Key}`;
    return await redis.get(key);
  }

  /**
   * Invalidate URL cache
   * @param {string} s3Key - S3 key
   */
  async invalidateUrl(s3Key) {
    const key = `url:${s3Key}`;
    await redis.del(key);
  }

  /**
   * Cache active duel data
   * @param {string} guildId - Guild ID
   * @param {Object} duelData - Duel data
   * @param {number} ttl - Time to live in seconds
   */
  async cacheDuel(guildId, duelData, ttl) {
    const key = `duel:${guildId}`;
    await redis.set(key, JSON.stringify(duelData), ttl);
  }

  /**
   * Get cached duel data
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object|null>} Duel data or null
   */
  async getDuel(guildId) {
    const key = `duel:${guildId}`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Clear duel cache
   * @param {string} guildId - Guild ID
   */
  async clearDuel(guildId) {
    const key = `duel:${guildId}`;
    await redis.del(key);
  }

  /**
   * Cache leaderboard data
   * @param {string} guildId - Guild ID
   * @param {Array} data - Leaderboard data
   * @param {number} ttl - Time to live (default 300 = 5 minutes)
   */
  async cacheLeaderboard(guildId, data, ttl = 300) {
    const key = `leaderboard:${guildId}`;
    await redis.set(key, JSON.stringify(data), ttl);
  }

  /**
   * Get cached leaderboard
   * @param {string} guildId - Guild ID
   * @returns {Promise<Array|null>} Leaderboard data or null
   */
  async getLeaderboard(guildId) {
    const key = `leaderboard:${guildId}`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Invalidate leaderboard cache
   * @param {string} guildId - Guild ID
   */
  async invalidateLeaderboard(guildId) {
    const key = `leaderboard:${guildId}`;
    await redis.del(key);
  }

  /**
   * Clear all caches for a guild
   * @param {string} guildId - Guild ID
   */
  async clearGuildCache(guildId) {
    await this.clearDuel(guildId);
    await this.invalidateLeaderboard(guildId);
    console.log(`🗑️ Cleared all caches for guild ${guildId}`);
  }
}

export default new CacheManager();
