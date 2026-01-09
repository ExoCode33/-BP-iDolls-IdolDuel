import pkg from 'pg';
const { Pool } = pkg;

class Database {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  async initialize() {
    try {
      // First ensure tables exist (without log channel index)
      await this.createTables();
      // Then run migrations to add missing columns to existing installations
      await this.runMigrations();
      console.log('✅ Database initialized successfully');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  async createTables() {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Guild Configuration Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS guild_config (
          guild_id VARCHAR(20) PRIMARY KEY,
          duel_channel_id VARCHAR(20),
          log_channel_id VARCHAR(20),
          import_channel_ids TEXT[],
          duel_duration INTEGER DEFAULT 1800,
          duel_interval INTEGER DEFAULT 1800,
          starting_elo INTEGER DEFAULT 1000,
          k_factor INTEGER DEFAULT 30,
          streak_bonus_2 DECIMAL DEFAULT 0.05,
          streak_bonus_3 DECIMAL DEFAULT 0.10,
          upset_bonus DECIMAL DEFAULT 0.15,
          wildcard_chance DECIMAL DEFAULT 0.05,
          min_votes INTEGER DEFAULT 1,
          losses_before_retirement INTEGER DEFAULT 3,
          max_active_images INTEGER DEFAULT 500,
          elo_clear_threshold INTEGER,
          duel_active BOOLEAN DEFAULT false,
          duel_paused BOOLEAN DEFAULT false,
          last_duel_time BIGINT,
          season_number INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Images Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS images (
          id SERIAL PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          image_hash VARCHAR(64) UNIQUE NOT NULL,
          s3_key VARCHAR(255) NOT NULL,
          discord_message_id VARCHAR(20),
          discord_channel_id VARCHAR(20),
          uploader_id VARCHAR(20) NOT NULL,
          elo INTEGER DEFAULT 1000,
          wins INTEGER DEFAULT 0,
          losses INTEGER DEFAULT 0,
          current_streak INTEGER DEFAULT 0,
          best_streak INTEGER DEFAULT 0,
          total_votes_received INTEGER DEFAULT 0,
          retired BOOLEAN DEFAULT false,
          retired_at TIMESTAMP,
          imported_at TIMESTAMP DEFAULT NOW(),
          last_duel_at TIMESTAMP,
          UNIQUE(guild_id, image_hash)
        )
      `);

      // Users Table (for ELO tracking)
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          user_id VARCHAR(20) NOT NULL,
          elo INTEGER DEFAULT 1000,
          total_votes_cast INTEGER DEFAULT 0,
          current_streak INTEGER DEFAULT 0,
          best_streak INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(guild_id, user_id)
        )
      `);

      // Captions Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS captions (
          id SERIAL PRIMARY KEY,
          image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
          user_id VARCHAR(20) NOT NULL,
          caption TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(image_id, user_id)
        )
      `);

      // Duels Table (history)
      await client.query(`
        CREATE TABLE IF NOT EXISTS duels (
          id SERIAL PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          image1_id INTEGER REFERENCES images(id),
          image2_id INTEGER REFERENCES images(id),
          winner_id INTEGER REFERENCES images(id),
          image1_votes INTEGER DEFAULT 0,
          image2_votes INTEGER DEFAULT 0,
          is_wildcard BOOLEAN DEFAULT false,
          elo_change INTEGER,
          started_at TIMESTAMP DEFAULT NOW(),
          ended_at TIMESTAMP
        )
      `);

      // Active Duel Table (current duel state)
      await client.query(`
        CREATE TABLE IF NOT EXISTS active_duels (
          guild_id VARCHAR(20) PRIMARY KEY,
          duel_id INTEGER REFERENCES duels(id),
          image1_id INTEGER REFERENCES images(id),
          image2_id INTEGER REFERENCES images(id),
          message_id VARCHAR(20),
          started_at TIMESTAMP DEFAULT NOW(),
          ends_at TIMESTAMP NOT NULL
        )
      `);

      // Votes Table (for tracking who voted)
      await client.query(`
        CREATE TABLE IF NOT EXISTS votes (
          id SERIAL PRIMARY KEY,
          duel_id INTEGER REFERENCES duels(id) ON DELETE CASCADE,
          user_id VARCHAR(20) NOT NULL,
          image_id INTEGER REFERENCES images(id),
          voted_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(duel_id, user_id)
        )
      `);

      // Logs Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS logs (
          id SERIAL PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          action_type VARCHAR(50) NOT NULL,
          admin_id VARCHAR(20),
          details JSONB,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Create indexes for performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_images_guild_active ON images(guild_id, retired) WHERE retired = false;
        CREATE INDEX IF NOT EXISTS idx_images_elo ON images(elo DESC);
        CREATE INDEX IF NOT EXISTS idx_users_guild ON users(guild_id, user_id);
        CREATE INDEX IF NOT EXISTS idx_duels_guild ON duels(guild_id, ended_at DESC);
        CREATE INDEX IF NOT EXISTS idx_votes_duel ON votes(duel_id, user_id);
      `);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async runMigrations() {
    const client = await this.pool.connect();
    try {
      console.log('🔄 Running database migrations...');

      // Migration: Add log_channel_id if it doesn't exist (for existing databases)
      // This will do nothing if column already exists (from fresh install)
      try {
        await client.query(`
          ALTER TABLE guild_config 
          ADD COLUMN IF NOT EXISTS log_channel_id VARCHAR(20)
        `);
        console.log('✅ Added log_channel_id column (if needed)');
      } catch (err) {
        console.log('ℹ️  log_channel_id column already exists or table not ready');
      }

      // Add index for log_channel_id (safe to run multiple times)
      try {
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_guild_config_log_channel 
          ON guild_config(log_channel_id) 
          WHERE log_channel_id IS NOT NULL
        `);
        console.log('✅ Created log_channel_id index');
      } catch (err) {
        console.log('ℹ️  log_channel_id index already exists');
      }

      console.log('✅ Migrations completed successfully');
    } catch (error) {
      console.error('⚠️  Migration error:', error.message);
      // Don't throw - migrations might fail if table doesn't exist yet
    } finally {
      client.release();
    }
  }

  async query(text, params) {
    return this.pool.query(text, params);
  }

  async getClient() {
    return this.pool.connect();
  }

  async close() {
    await this.pool.end();
  }
}

export default new Database();
