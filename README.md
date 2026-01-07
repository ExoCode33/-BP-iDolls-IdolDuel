# 🏆 IdolDuel Bot

A Discord bot for game guilds that runs picture duels where users vote anonymously on pairs of images. Features ELO ranking, streak bonuses, roles for ranks, and a cute competitive vibe!

## ✨ Features

- **⚔️ Image Duels**: Automated duels between pairs of images with anonymous voting
- **📊 ELO Ranking System**: Dynamic ELO ratings for both images and users
- **🔥 Streak Bonuses**: Win streaks increase ELO gains
- **🎲 Wildcard Duels**: Random chance for high-stakes duels with bigger ELO swings
- **💬 Anonymous Captions**: Users can add captions to images during duels
- **📈 Leaderboards**: View top users and images by ELO
- **⚙️ Full Admin Control**: Comprehensive admin panel for configuration
- **🔄 Season Management**: Soft resets for new competitive seasons
- **🗄️ Automatic Retirement**: Images retire after configurable number of losses
- **📥 Bulk Import**: Import images from Discord channels automatically

## 🛠️ Tech Stack

- **Node.js** - Runtime environment
- **Discord.js v14** - Discord API wrapper
- **PostgreSQL** - Primary database for all metadata
- **Redis** - Optional caching layer (with automatic fallback)
- **Railway S3 Bucket** - Image storage (S3-compatible)

## 📦 Installation

### Prerequisites

- Node.js 18+ installed
- PostgreSQL database
- Redis instance (optional but recommended)
- Railway S3-compatible bucket
- Discord bot token and application

### Step 1: Clone and Install

```bash
cd idolduel-bot
npm install
```

### Step 2: Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
```env
# Discord Configuration
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
ADMIN_ROLE_ID=your_admin_role_id

# PostgreSQL
DATABASE_URL=postgresql://user:password@host:port/database

# Redis (Optional - will fallback to PostgreSQL if not available)
REDIS_URL=redis://host:port
REDIS_PASSWORD=your_redis_password

# S3 Storage (Railway Bucket)
S3_ENDPOINT=your_s3_endpoint
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=your_bucket_name
S3_REGION=us-east-1

# Season Reset
SEASON_RESET_PASSWORD=your_secure_password
```

### Step 3: Deploy Commands

Register slash commands with Discord:

```bash
npm run deploy
```

### Step 4: Start the Bot

```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

## 🚀 Railway Deployment

### Railway Setup

1. **Create a new Railway project**
2. **Add PostgreSQL**:
   - Go to your project
   - Click "New" → "Database" → "PostgreSQL"
   - Copy the `DATABASE_URL` from the Variables tab

3. **Add Redis** (Optional):
   - Click "New" → "Database" → "Redis"
   - Copy the `REDIS_URL` from the Variables tab

4. **Add S3 Bucket**:
   - Go to your project settings
   - Add a new service or enable S3 storage
   - Copy credentials to environment variables

5. **Deploy the Bot**:
   - Connect your GitHub repository
   - Railway will auto-detect the Node.js app
   - Add all environment variables from `.env.example`
   - Deploy!

### Environment Variables on Railway

Add these in the Variables tab:
- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `ADMIN_ROLE_ID`
- `DATABASE_URL` (from PostgreSQL service)
- `REDIS_URL` (from Redis service)
- `REDIS_PASSWORD` (from Redis service)
- `S3_ENDPOINT`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_BUCKET_NAME`
- `S3_REGION`
- `SEASON_RESET_PASSWORD`

## 🎮 Usage

### User Commands

- `/idolduel profile` - View your ELO, stats, and top image
- `/idolduel leaderboard` - View top 15 users and top 3 images

### Admin Commands

- `/idolduel admin config` - Access the full admin control panel

The admin panel provides dropdown navigation to:
- ⚙️ **Basic Settings** - Configure channels and timing
- 🎮 **ELO Settings** - Adjust ELO calculation parameters
- 🎲 **Duel Controls** - Manually start, stop, pause, or skip duels
- 🖼️ **Image Management** - Import, list, and manage images
- 🔄 **Season Management** - Reset seasons and manage archives

### During Duels

Users interact with duels via buttons on the duel message:
- **Vote A / Vote B** - Cast your vote (once per duel)
- **Add Caption** - Submit an anonymous caption

## ⚙️ Configuration

All settings are configurable through the admin panel. Default values:

| Setting | Default | Description |
|---------|---------|-------------|
| Starting ELO | 1000 | Initial ELO for users and images |
| K-Factor | 30 | ELO sensitivity |
| Duel Duration | 30 min | How long each duel lasts |
| Duel Interval | 30 min | Time between duels |
| Min Votes | 1 | Minimum non-uploader votes for ELO change |
| Losses Before Retirement | 3 | Auto-retire after this many losses |
| Wildcard Chance | 5% | Chance of high-stakes wildcard duel |
| Upset Bonus | 15% | Bonus for defeating higher ELO |
| Streak Bonuses | 5% (2nd), 10% (3rd+) | Win streak multipliers |

## 🗄️ Database Schema

The bot automatically creates all necessary tables on first run:

- **guild_config** - Per-guild configuration
- **images** - Image metadata and stats
- **users** - User ELO and stats
- **duels** - Duel history
- **active_duels** - Current duel state
- **votes** - Vote tracking
- **captions** - Anonymous captions
- **logs** - Admin action logs

## 🔒 Security Features

- **Admin Role Check**: Only users with the configured admin role can access admin commands
- **Season Reset Password**: Requires password confirmation for season resets
- **Anonymous Captions**: Captions are anonymous but admins can see authors if needed
- **Vote Limits**: Users can only vote once per duel
- **Image Deduplication**: Prevents duplicate images via hash comparison

## 🎨 UI Style

All bot messages use:
- **Pink color theme** (#FF69B4)
- **ASCII emoticons** (>^u^<, ☆, ♡)
- **Code block formatting** for headers
- **Emojis** for visual appeal
- **Cute, friendly tone**

## 🐛 Troubleshooting

### Bot not responding
- Check bot token is correct
- Verify bot has necessary permissions in your server
- Check console logs for errors

### Duels not starting automatically
- Verify duel channel is set in admin config
- Check that scheduling is not paused
- Ensure at least 2 images are active

### Redis connection issues
- Bot will automatically fallback to PostgreSQL
- Check Redis URL and password
- Redis is optional - bot works without it

### Image import failing
- Verify channel IDs are correct
- Check bot has permission to read message history
- Ensure images are PNG or JPG format
- Limit: 100 images per import batch

## 📝 Development

### Project Structure

```
idolduel-bot/
├── src/
│   ├── commands/
│   │   ├── admin/
│   │   │   └── config.js
│   │   └── user/
│   │       ├── profile.js
│   │       └── leaderboard.js
│   ├── database/
│   │   ├── database.js
│   │   └── redis.js
│   ├── handlers/
│   │   ├── buttonHandler.js
│   │   ├── modalHandler.js
│   │   └── selectHandler.js
│   ├── services/
│   │   ├── duelManager.js
│   │   ├── duelScheduler.js
│   │   ├── elo.js
│   │   └── storage.js
│   ├── utils/
│   │   └── embeds.js
│   ├── index.js
│   └── deploy-commands.js
├── package.json
├── .env.example
└── README.md
```

### Adding New Features

1. **New Commands**: Add to `src/commands/`
2. **New Services**: Add to `src/services/`
3. **New Handlers**: Add to `src/handlers/`
4. **Database Changes**: Update `src/database/database.js`

## 📄 License

MIT License - Feel free to use and modify!

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 💖 Support

For issues or questions, please open an issue on the GitHub repository.

---

Made with ♡ for gaming communities everywhere! >^u^
