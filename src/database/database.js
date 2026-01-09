/**
 * Database Connection and Schema
 * PostgreSQL with retirement settings support
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

class Database {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  async query(text, params) {
    const start = Date.now();
    const res = await this.pool.query(text, params);
    const duration = Date.now() - start;
    
    if (duration > 100) {
      console.log('Slow query:', { text, duration, rows: res.rowCount });
    }
    
    return res;
  }

  async initialize() {
    try {
      // Create guild_config table with retirement settings
      await this.query(`
        CREATE TABLE IF NOT EXISTS guild_config (
          guild_id TEXT PRIMARY KEY,
          image_channel_id TEXT,
          duel_channel_id TEXT,
          duel_active BOOLEAN DEFAULT false,
          duel_paused BOOLEAN DEFAULT false,
          duel_interval INTEGER DEFAULT 21600,
          duel_duration INTEGER DEFAULT 21600,
          starting_elo INTEGER DEFAULT 1000,
          k_factor INTEGER DEFAULT 32,
          season_number INTEGER DEFAULT 1,
          retire_after_losses INTEGER DEFAULT 0,
          retire_below_elo INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Create images table
      await this.query(`
        CREATE TABLE IF NOT EXISTS images (
          id SERIAL PRIMARY KEY,
          guild_id TEXT NOT NULL,
          s3_key TEXT NOT NULL UNIQUE,
          uploader_id TEXT NOT NULL,
          elo INTEGER DEFAULT 1000,
          wins INTEGER DEFAULT 0,
          losses INTEGER DEFAULT 0,
          retired BOOLEAN DEFAULT false,
          retired_at TIMESTAMP,
          imported_at TIMESTAMP DEFAULT NOW(),
          last_duel_at TIMESTAMP
        )
      `);

      // Create duels table
      await this.query(`
        CREATE TABLE IF NOT EXISTS duels (
          id SERIAL PRIMARY KEY,
          guild_id TEXT NOT NULL,
          image1_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
          image2_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
          winner_id INTEGER REFERENCES images(id) ON DELETE SET NULL,
          image1_votes INTEGER DEFAULT 0,
          image2_votes INTEGER DEFAULT 0,
          started_at TIMESTAMP DEFAULT NOW(),
          ended_at TIMESTAMP
        )
      `);

      // Create votes table
      await this.query(`
        CREATE TABLE IF NOT EXISTS votes (
          id SERIAL PRIMARY KEY,
          duel_id INTEGER REFERENCES duels(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL,
          image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
          voted_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(duel_id, user_id)
        )
      `);

      // Create active_duels table (simplified - no created_at column)
      await this.query(`
        CREATE TABLE IF NOT EXISTS active_duels (
          guild_id TEXT PRIMARY KEY,
          duel_id INTEGER REFERENCES duels(id) ON DELETE CASCADE,
          message_id TEXT,
          ends_at TIMESTAMP NOT NULL
        )
      `);

      // Create indexes
      await this.query('CREATE INDEX IF NOT EXISTS idx_images_guild_id ON images(guild_id)');
      await this.query('CREATE INDEX IF NOT EXISTS idx_images_elo ON images(elo DESC)');
      await this.query('CREATE INDEX IF NOT EXISTS idx_images_retired ON images(retired)');
      await this.query('CREATE INDEX IF NOT EXISTS idx_duels_guild_id ON duels(guild_id)');
      await this.query('CREATE INDEX IF NOT EXISTS idx_votes_duel_id ON votes(duel_id)');
      await this.query('CREATE INDEX IF NOT EXISTS idx_active_duels_guild_id ON active_duels(guild_id)');

      // Add columns to existing guild_config if they don't exist (migration)
      await this.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='guild_config' AND column_name='retire_after_losses') THEN
            ALTER TABLE guild_config ADD COLUMN retire_after_losses INTEGER DEFAULT 0;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='guild_config' AND column_name='retire_below_elo') THEN
            ALTER TABLE guild_config ADD COLUMN retire_below_elo INTEGER DEFAULT 0;
          END IF;
        END $$;
      `);

      // Remove created_at column from active_duels if it exists (migration)
      await this.query(`
        DO $$ 
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_name='active_duels' AND column_name='created_at') THEN
            ALTER TABLE active_duels DROP COLUMN created_at;
          END IF;
        END $$;
      `);

      console.log('✅ Database tables created successfully');
    } catch (error) {
      console.error('❌ Database initialization error:', error);
      throw error;
    }
  }

  async close() {
    await this.pool.end();
  }
}

const database = new Database();

// Initialize on startup
await database.initialize();
console.log('✅ Database initialized successfully');

export default database;
