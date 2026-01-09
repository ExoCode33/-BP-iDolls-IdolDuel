import redis from '../../database/redis.js';
console.log('✅ Cache manager loaded correctly (no selector import)');

class CacheManager {
  async cacheImageUrl(s3Key, url, expirationSeconds = 3600) {
    return await redis.cacheImageUrl(s3Key, url, expirationSeconds);
  }
  async getCachedImageUrl(s3Key) {
    return await redis.getCachedImageUrl(s3Key);
  }
  async cacheLeaderboard(guildId, data, expirationSeconds = 300) {
    return await redis.cacheLeaderboard(guildId, data, expirationSeconds);
  }
  async getCachedLeaderboard(guildId) {
    return await redis.getCachedLeaderboard(guildId);
  }
  async setActiveDuel(guildId, duelData) {
    return await redis.setActiveDuel(guildId, duelData);
  }
  async getActiveDuel(guildId) {
    return await redis.getActiveDuel(guildId);
  }
  async clearActiveDuel(guildId) {
    return await redis.clearActiveDuel(guildId);
  }
  async cacheDuelResult(duelId, result, expirationSeconds = 3600) {
    return await redis.cacheDuelResult(duelId, result, expirationSeconds);
  }
  async getCachedDuelResult(duelId) {
    return await redis.getCachedDuelResult(duelId);
  }
  async get(key) {
    return await redis.get(key);
  }
  async set(key, value, expirationSeconds = 3600) {
    return await redis.set(key, value, expirationSeconds);
  }
  async del(key) {
    return await redis.del(key);
  }
  async clearAll() {
    return await redis.clearAll();
  }
  getStatus() {
    return redis.getStatus();
  }
}

export default new CacheManager();
