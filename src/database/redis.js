import { createClient } from 'redis';

class RedisCache {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async initialize() {
    if (!process.env.REDIS_URL) {
      console.log('⚠️  Redis URL not configured, using PostgreSQL fallback');
      return;
    }

    try {
      this.client = createClient({
        url: process.env.REDIS_URL,
        password: process.env.REDIS_PASSWORD,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 3) {
              console.log('⚠️  Redis reconnection failed, falling back to PostgreSQL');
              this.isConnected = false;
              return new Error('Redis reconnection limit reached');
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      this.client.on('error', (err) => {
        console.error('⚠️  Redis error:', err.message);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('✅ Redis connected');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        console.log('⚠️  Redis disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      console.error('⚠️  Redis initialization failed, using PostgreSQL fallback:', error.message);
      this.isConnected = false;
    }
  }

  async get(key) {
    if (!this.isConnected || !this.client) return null;
    
    try {
      return await this.client.get(key);
    } catch (error) {
      console.error('⚠️  Redis get error:', error.message);
      return null;
    }
  }

  async set(key, value, expirationSeconds = null) {
    if (!this.isConnected || !this.client) return false;
    
    try {
      if (expirationSeconds) {
        await this.client.setEx(key, expirationSeconds, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      console.error('⚠️  Redis set error:', error.message);
      return false;
    }
  }

  async del(key) {
    if (!this.isConnected || !this.client) return false;
    
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('⚠️  Redis del error:', error.message);
      return false;
    }
  }

  async hGet(key, field) {
    if (!this.isConnected || !this.client) return null;
    
    try {
      return await this.client.hGet(key, field);
    } catch (error) {
      console.error('⚠️  Redis hGet error:', error.message);
      return null;
    }
  }

  async hSet(key, field, value) {
    if (!this.isConnected || !this.client) return false;
    
    try {
      await this.client.hSet(key, field, value);
      return true;
    } catch (error) {
      console.error('⚠️  Redis hSet error:', error.message);
      return false;
    }
  }

  async hGetAll(key) {
    if (!this.isConnected || !this.client) return null;
    
    try {
      return await this.client.hGetAll(key);
    } catch (error) {
      console.error('⚠️  Redis hGetAll error:', error.message);
      return null;
    }
  }

  async hDel(key, field) {
    if (!this.isConnected || !this.client) return false;
    
    try {
      await this.client.hDel(key, field);
      return true;
    } catch (error) {
      console.error('⚠️  Redis hDel error:', error.message);
      return false;
    }
  }

  async exists(key) {
    if (!this.isConnected || !this.client) return false;
    
    try {
      return (await this.client.exists(key)) === 1;
    } catch (error) {
      console.error('⚠️  Redis exists error:', error.message);
      return false;
    }
  }

  async close() {
    if (this.client) {
      await this.client.quit();
    }
  }
}

export default new RedisCache();
