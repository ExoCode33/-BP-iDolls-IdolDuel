/**
 * Redis Cache Manager
 * FIXED: Use ioredis instead of redis
 */

import Redis from 'ioredis';

class RedisManager {
  constructor() {
    this.client = null;
  }

  async initialize() {
    try {
      this.client = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) {
            return null;
          }
          return Math.min(times * 200, 1000);
        }
      });

      this.client.on('error', (err) => {
        console.error('Redis error:', err);
      });

      this.client.on('connect', () => {
        console.log('✅ Redis connected');
      });

      await this.client.ping();
      
    } catch (error) {
      console.error('Failed to initialize Redis:', error);
      throw error;
    }
  }

  async setActiveDuel(guildId, duelData) {
    try {
      const key = `active_duel:${guildId}`;
      await this.client.setex(key, 86400, JSON.stringify(duelData));
    } catch (error) {
      console.error('Error setting active duel in Redis:', error);
    }
  }

  async getActiveDuel(guildId) {
    try {
      const key = `active_duel:${guildId}`;
      const data = await this.client.get(key);
      
      if (!data) return null;
      
      const duel = JSON.parse(data);
      duel.startedAt = new Date(duel.startedAt);
      duel.endsAt = new Date(duel.endsAt);
      
      return duel;
    } catch (error) {
      console.error('Error getting active duel from Redis:', error);
      return null;
    }
  }

  async clearActiveDuel(guildId) {
    try {
      const key = `active_duel:${guildId}`;
      await this.client.del(key);
    } catch (error) {
      console.error('Error clearing active duel from Redis:', error);
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
    }
  }
}

export default new RedisManager();
