import pkg from 'pg';
const { Pool } = pkg;

class Database {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  async query(text, params) {
    const client = await this.pool.connect();
    try {
      return await client.query(text, params);
    } finally {
      client.release();
    }
  }

  async createTables() {
    try {
      // Guild configuration
      await this.query(`
        CREATE TABLE IF NOT EXISTS guild_config (
          guild_id VARCHAR(20) PRIMARY KEY,
          duel_channel_id VARCHAR(20),
          duel_duration INTEGER DEFAULT 1800,
          duel_interval INTEGER DEFAULT 1800,
          min_votes INTEGER DEFAULT 1,
          starting_elo INTEGER DEFAULT 1000,
          k_factor INTEGER DEFAULT 30,
          losses_before_retirement INTEGER,
          max_active_images INTEGER DEFAULT 100,
          wildcard_chance DECIMAL(3,2) DEFAULT 0.05,
          import_channel_ids TEXT[],
          elo_clear_threshold INTEGER,
          duel_active BOOLEAN DEFAULT false,
          duel_paused BOOLEAN DEFAULT false,
          season_number INTEGER DEFAULT 1,
          streak_bonus_2 DECIMAL(3,2) DEFAULT 0.10,
          streak_bonus_3 DECIMAL(3,2) DEFAULT 0.15,
          upset_bonus DECIMAL(3,2) DEFAULT 0.20,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Images
      await this.query(`
        CREATE TABLE IF NOT EXISTS images (
          id SERIAL PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          s3_key TEXT NOT NULL,
          url TEXT NOT NULL,
          elo INTEGER DEFAULT 1000,
          wins INTEGER DEFAULT 0,
          losses INTEGER DEFAULT 0,
          total_votes_received INTEGER DEFAULT 0,
          current_streak INTEGER DEFAULT 0,
          best_streak INTEGER DEFAULT 0,
          retired BOOLEAN DEFAULT false,
          retired_at TIMESTAMP,
          uploader_id VARCHAR(20),
          imported_at TIMESTAMP DEFAULT NOW(),
          last_duel_at TIMESTAMP
        )
      `);

      // Duels
      await this.query(`
        CREATE TABLE IF NOT EXISTS duels (
          id SERIAL PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          image1_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
          image2_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
          winner_id INTEGER REFERENCES images(id) ON DELETE SET NULL,
          started_at TIMESTAMP DEFAULT NOW(),
          ended_at TIMESTAMP
        )
      `);

      // Active duels
      await this.query(`
        CREATE TABLE IF NOT EXISTS active_duels (
          guild_id VARCHAR(20) PRIMARY KEY,
          duel_id INTEGER REFERENCES duels(id) ON DELETE CASCADE,
          image1_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
          image2_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
          message_id VARCHAR(20),
          ends_at TIMESTAMP NOT NULL
        )
      `);

      // Votes
      await this.query(`
        CREATE TABLE IF NOT EXISTS votes (
          id SERIAL PRIMARY KEY,
          duel_id INTEGER REFERENCES duels(id) ON DELETE CASCADE,
          user_id VARCHAR(20) NOT NULL,
          image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
          voted_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(duel_id, user_id)
        )
      `);

      // Users
      await this.query(`
        CREATE TABLE IF NOT EXISTS users (
          guild_id VARCHAR(20) NOT NULL,
          user_id VARCHAR(20) NOT NULL,
          total_votes_cast INTEGER DEFAULT 0,
          PRIMARY KEY (guild_id, user_id)
        )
      `);

      // Captions
      await this.query(`
        CREATE TABLE IF NOT EXISTS captions (
          id SERIAL PRIMARY KEY,
          duel_id INTEGER REFERENCES duels(id) ON DELETE CASCADE,
          user_id VARCHAR(20) NOT NULL,
          caption_text TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Logs
      await this.query(`
        CREATE TABLE IF NOT EXISTS logs (
          id SERIAL PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          action_type VARCHAR(50) NOT NULL,
          admin_id VARCHAR(20),
          details JSONB,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Create indexes
      await this.query('CREATE INDEX IF NOT EXISTS idx_images_guild ON images(guild_id)');
      await this.query('CREATE INDEX IF NOT EXISTS idx_images_elo ON images(guild_id, elo DESC)');
      await this.query('CREATE INDEX IF NOT EXISTS idx_images_retired ON images(guild_id, retired)');
      await this.query('CREATE INDEX IF NOT EXISTS idx_duels_guild ON duels(guild_id)');
      await this.query('CREATE INDEX IF NOT EXISTS idx_votes_duel ON votes(duel_id)');
      await this.query('CREATE INDEX IF NOT EXISTS idx_logs_guild ON logs(guild_id, created_at DESC)');

      console.log('✅ Database tables created successfully');
    } catch (error) {
      console.error('❌ Error creating tables:', error);
      throw error;
    }
  }

  async runMigrations() {
    try {
      console.log('🔄 Running database migrations...');

      // MIGRATION 1: log_channel_id
      try {
        await this.query(`
          ALTER TABLE guild_config 
          ADD COLUMN IF NOT EXISTS log_channel_id VARCHAR(20)
        `);
        console.log('✅ Added log_channel_id column (if needed)');
      } catch (error) {
        console.log('⚠️ log_channel_id column already exists or error:', error.message);
      }

      try {
        await this.query(`
          CREATE INDEX IF NOT EXISTS idx_guild_config_log_channel 
          ON guild_config(log_channel_id) 
          WHERE log_channel_id IS NOT NULL
        `);
        console.log('✅ Created log_channel_id index');
      } catch (error) {
        console.log('⚠️ log_channel_id index already exists or error:', error.message);
      }

      // MIGRATION 2: Auto-approve system
      try {
        await this.query(`
          ALTER TABLE guild_config 
          ADD COLUMN IF NOT EXISTS auto_approve_images BOOLEAN DEFAULT false
        `);
        console.log('✅ Added auto_approve_images column (if needed)');
      } catch (error) {
        console.log('⚠️ auto_approve_images column already exists or error:', error.message);
      }

      try {
        await this.query(`
          ALTER TABLE images 
          ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT true
        `);
        console.log('✅ Added approved column to images (if needed)');
      } catch (error) {
        console.log('⚠️ approved column already exists or error:', error.message);
      }

      try {
        await this.query(`
          CREATE INDEX IF NOT EXISTS idx_images_pending 
          ON images(guild_id, approved) 
          WHERE approved = false
        `);
        console.log('✅ Created pending images index');
      } catch (error) {
        console.log('⚠️ Pending images index already exists or error:', error.message);
      }

      try {
        await this.query(`
          CREATE INDEX IF NOT EXISTS idx_images_approved_active 
          ON images(guild_id, approved, retired) 
          WHERE approved = true AND retired = false
        `);
        console.log('✅ Created approved active images index');
      } catch (error) {
        console.log('⚠️ Approved active images index already exists or error:', error.message);
      }

      console.log('✅ Migrations completed successfully');
    } catch (error) {
      console.error('❌ Migration error:', error);
      throw error;
    }
  }

  async initialize() {
    try {
      await this.createTables();
      await this.runMigrations();
      console.log('✅ Database initialized successfully');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  async close() {
    await this.pool.end();
  }
}

const database = new Database();
export default database;
