/**
 * PostgreSQL Database Manager
 * FIXED: Added vote count columns to duels table
 */

import pg from 'pg';
const { Pool } = pg;

class Database {
  constructor() {
    this.pool = null;
  }

  async initialize() {
    try {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });

      await this.createTables();
      console.log('✅ Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  async createTables() {
    const queries = [
      // Guild Configuration
      `CREATE TABLE IF NOT EXISTS guild_config (
        guild_id TEXT PRIMARY KEY,
        image_channel_id TEXT,
        duel_channel_id TEXT,
        duel_active BOOLEAN DEFAULT false,
        duel_paused BOOLEAN DEFAULT false,
        duel_interval INTEGER DEFAULT 21600,
        duel_duration INTEGER DEFAULT 21600,
        starting_elo INTEGER DEFAULT 1000,
        k_factor INTEGER DEFAULT 32,
        retire_after_losses INTEGER DEFAULT 0,
        retire_below_elo INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )`,

      // Images
      `CREATE TABLE IF NOT EXISTS images (
        id SERIAL PRIMARY KEY,
        guild_id TEXT NOT NULL,
        uploader_id TEXT NOT NULL,
        s3_key TEXT NOT NULL,
        elo INTEGER DEFAULT 1000,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        retired BOOLEAN DEFAULT false,
        retired_at TIMESTAMP,
        imported_at TIMESTAMP DEFAULT NOW()
      )`,

      // Duels - FIXED: Added vote count columns
      `CREATE TABLE IF NOT EXISTS duels (
        id SERIAL PRIMARY KEY,
        guild_id TEXT NOT NULL,
        image1_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
        image2_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
        winner_id INTEGER REFERENCES images(id) ON DELETE SET NULL,
        image1_votes INTEGER DEFAULT 0,
        image2_votes INTEGER DEFAULT 0,
        started_at TIMESTAMP DEFAULT NOW(),
        ended_at TIMESTAMP
      )`,

      // Active Duels
      `CREATE TABLE IF NOT EXISTS active_duels (
        guild_id TEXT PRIMARY KEY,
        duel_id INTEGER REFERENCES duels(id) ON DELETE CASCADE,
        message_id TEXT,
        ends_at TIMESTAMP NOT NULL
      )`,

      // Votes
      `CREATE TABLE IF NOT EXISTS votes (
        id SERIAL PRIMARY KEY,
        duel_id INTEGER REFERENCES duels(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
        voted_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(duel_id, user_id)
      )`
    ];

    for (const query of queries) {
      await this.pool.query(query);
    }

    // Add columns if they don't exist (migration)
    await this.pool.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='duels' AND column_name='image1_votes') THEN
          ALTER TABLE duels ADD COLUMN image1_votes INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='duels' AND column_name='image2_votes') THEN
          ALTER TABLE duels ADD COLUMN image2_votes INTEGER DEFAULT 0;
        END IF;
      END $$;
    `);

    console.log('✅ Database tables created successfully');
  }

  async query(text, params) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      if (duration > 100) {
        console.log('Slow query:', { text, duration, rows: result.rowCount });
      }
      
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

export default new Database();
