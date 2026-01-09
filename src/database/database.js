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
          image_channel_id VARCHAR(20),
          duel_duration INTEGER DEFAULT 43200,
          duel_interval INTEGER DEFAULT 43200,
          starting_elo INTEGER DEFAULT 1000,
          k_factor INTEGER DEFAULT 32,
          duel_active BOOLEAN DEFAULT false,
          duel_paused BOOLEAN DEFAULT false,
          season_number INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Images
      await this.query(`
        CREATE TABLE IF NOT EXISTS images (
          id SERIAL PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL,
          s3_key TEXT NOT NULL UNIQUE,
          elo INTEGER DEFAULT 1000,
          wins INTEGER DEFAULT 0,
          losses INTEGER DEFAULT 0,
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
          image1_id INTEGER REFERENCES images(id) ON DELETE SET NULL,
          image2_id INTEGER REFERENCES images(id) ON DELETE SET NULL,
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

      // Create indexes
      await this.query('CREATE INDEX IF NOT EXISTS idx_images_guild ON images(guild_id)');
      await this.query('CREATE INDEX IF NOT EXISTS idx_images_elo ON images(guild_id, elo DESC)');
      await this.query('CREATE INDEX IF NOT EXISTS idx_images_retired ON images(guild_id, retired)');
      await this.query('CREATE INDEX IF NOT EXISTS idx_duels_guild ON duels(guild_id)');
      await this.query('CREATE INDEX IF NOT EXISTS idx_votes_duel ON votes(duel_id)');

      console.log('✅ Database tables created successfully');
    } catch (error) {
      console.error('❌ Error creating tables:', error);
      throw error;
    }
  }

  async initialize() {
    try {
      await this.createTables();
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
