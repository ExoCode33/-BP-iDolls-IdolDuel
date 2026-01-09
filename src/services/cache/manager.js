/**
 * ============================================
 * CACHE MANAGER - ABSOLUTELY FINAL VERSION
 * ============================================
 * 
 * IF YOU SEE AN ERROR ABOUT 'selector.js'
 * IT MEANS THIS FILE WAS NOT PROPERLY REPLACED!
 * 
 * THIS FILE SHOULD BE AT:
 * src/services/cache/manager.js
 * 
 * FIRST LINE MUST BE:
 * import redis from '../../database/redis.js';
 * 
 * IF YOU SEE 'import selector' ANYWHERE,
 * YOU HAVE THE WRONG FILE!
 * ============================================
 */

import redis from '../../database/redis.js';

// Validation check - this file is correct
console.log('✅ Cache manager loaded correctly (no selector import)');

class CacheManager {
  constructor() {
    // Extra validation
    if (!redis) {
      throw new Error('Redis not available!');
    }
  }

  /**
   * Cache image URL
   */
  async cacheImageUrl(s3Key, url, expirationSeconds = 3600) {
    return await redis.cacheImageUrl(s3Key, url, expirationSeconds);
  }

  /**
   * Get cached image URL
   */
  async getCachedImageUrl(s3Key) {
    return await redis.getCachedImageUrl(s3Key);
  }

  /**
   * Cache leaderboard
   */
  async cacheLeaderboard(guildId, data, expirationSeconds = 300) {
    return await redis.cacheLeaderboard(guildId, data, expirationSeconds);
  }

  /**
   * Get cached leaderboard
   */
  async getCachedLeaderboard(guildId) {
    return await redis.getCachedLeaderboard(guildId);
  }

  /**
   * Set active duel
   */
  async setActiveDuel(guildId, duelData) {
    return await redis.setActiveDuel(guildId, duelData);
  }

  /**
   * Get active duel
   */
  async getActiveDuel(guildId) {
    return await redis.getActiveDuel(guildId);
  }

  /**
   * Clear active duel
   */
  async clearActiveDuel(guildId) {
    return await redis.clearActiveDuel(guildId);
  }

  /**
   * Cache duel result
   */
  async cacheDuelResult(duelId, result, expirationSeconds = 3600) {
    return await redis.cacheDuelResult(duelId, result, expirationSeconds);
  }

  /**
   * Get cached duel result
   */
  async getCachedDuelResult(duelId) {
    return await redis.getCachedDuelResult(duelId);
  }

  /**
   * Generic cache operations
   */
  async get(key) {
    return await redis.get(key);
  }

  async set(key, value, expirationSeconds = 3600) {
    return await redis.set(key, value, expirationSeconds);
  }

  async del(key) {
    return await redis.del(key);
  }

  /**
   * Clear all cached data
   */
  async clearAll() {
    return await redis.clearAll();
  }

  /**
   * Get cache status
   */
  getStatus() {
    return redis.getStatus();
  }
}

export default new CacheManager();
