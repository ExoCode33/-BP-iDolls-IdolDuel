/**
 * Redis Cache Manager
 * Handles caching for image URLs, duels, and leaderboards
 */

import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

class RedisCache {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async initialize() {
    try {
      if (!process.env.REDIS_URL) {
        console.log('⚠️ Redis URL not found, caching disabled');
        return;
      }

      this.client = createClient({
        url: process.env.REDIS_URL,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              return new Error('Redis max reconnection attempts reached');
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      this.client.on('error', (err) => {
        console.error('Redis error:', err.message);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('✅ Redis connected');
        this.isConnected = true;
      });

      await this.client.connect();
    } catch (error) {
      console.error('❌ Redis initialization failed:', error.message);
      this.isConnected = false;
    }
  }

  /**
   * Get cached value
   */
  async get(key) {
    if (!this.isConnected) return null;
    
    try {
      return await this.client.get(key);
    } catch (error) {
      console.error('Redis get error:', error.message);
      return null;
    }
  }

  /**
   * Set cached value with expiration
   */
  async set(key, value, expirationSeconds = 3600) {
    if (!this.isConnected) return false;
    
    try {
      await this.client.setEx(key, expirationSeconds, value);
      return true;
    } catch (error) {
      console.error('Redis set error:', error.message);
      return false;
    }
  }

  /**
   * Delete cached value
   */
  async del(key) {
    if (!this.isConnected) return false;
    
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('Redis del error:', error.message);
      return false;
    }
  }

  /**
   * Cache image URL
   */
  async cacheImageUrl(s3Key, url, expirationSeconds = 3600) {
    const key = `image_url:${s3Key}`;
    return await this.set(key, url, expirationSeconds);
  }

  /**
   * Get cached image URL
   */
  async getCachedImageUrl(s3Key) {
    const key = `image_url:${s3Key}`;
    return await this.get(key);
  }

  /**
   * Cache leaderboard
   */
  async cacheLeaderboard(guildId, data, expirationSeconds = 300) {
    const key = `leaderboard:${guildId}`;
    return await this.set(key, JSON.stringify(data), expirationSeconds);
  }

  /**
   * Get cached leaderboard
   */
  async getCachedLeaderboard(guildId) {
    const key = `leaderboard:${guildId}`;
    const data = await this.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Set active duel data
   */
  async setActiveDuel(guildId, duelData) {
    if (!this.isConnected) return false;
    
    try {
      const key = `active_duel:${guildId}`;
      // Store for 24 hours max (safety measure)
      await this.client.setEx(key, 86400, JSON.stringify(duelData));
      return true;
    } catch (error) {
      console.error('Redis setActiveDuel error:', error.message);
      return false;
    }
  }

  /**
   * Get active duel data
   */
  async getActiveDuel(guildId) {
    if (!this.isConnected) return null;
    
    try {
      const key = `active_duel:${guildId}`;
      const data = await this.client.get(key);
      
      if (!data) return null;
      
      const duel = JSON.parse(data);
      
      // Convert date strings back to Date objects
      if (duel.startedAt) duel.startedAt = new Date(duel.startedAt);
      if (duel.endsAt) duel.endsAt = new Date(duel.endsAt);
      
      return duel;
    } catch (error) {
      console.error('Redis getActiveDuel error:', error.message);
      return null;
    }
  }

  /**
   * Clear active duel data
   */
  async clearActiveDuel(guildId) {
    if (!this.isConnected) return false;
    
    try {
      const key = `active_duel:${guildId}`;
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('Redis clearActiveDuel error:', error.message);
      return false;
    }
  }

  /**
   * Cache duel result temporarily
   */
  async cacheDuelResult(duelId, result, expirationSeconds = 3600) {
    const key = `duel_result:${duelId}`;
    return await this.set(key, JSON.stringify(result), expirationSeconds);
  }

  /**
   * Get cached duel result
   */
  async getCachedDuelResult(duelId) {
    const key = `duel_result:${duelId}`;
    const data = await this.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Clear all cached data (useful for testing)
   */
  async clearAll() {
    if (!this.isConnected) return false;
    
    try {
      await this.client.flushDb();
      console.log('🗑️ Redis cache cleared');
      return true;
    } catch (error) {
      console.error('Redis clearAll error:', error.message);
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      console.log('Redis connection closed');
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      url: process.env.REDIS_URL ? 'configured' : 'not configured'
    };
  }
}

const redis = new RedisCache();

export default redis;
