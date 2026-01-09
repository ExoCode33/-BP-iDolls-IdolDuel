/**
 * IdolDuel Bot - Main Entry Point
 * Simplified, clean architecture
 */

import { Client, GatewayIntentBits, Collection, Events, ActivityType } from 'discord.js';
import dotenv from 'dotenv';
import database from './database/database.js';
import redis from './database/redis.js';
import storage from './services/image/storage.js';
import duelManager from './services/duel/manager.js';
import logger from './utils/logger.js';
import { handleInteractions } from './handlers/interactions.js';
import { handleMessage } from './handlers/messages.js';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

// Load commands dynamically
const commands = [
  (await import('./commands/setup.js')).default,
  (await import('./commands/admin/admin.js')).default,
  (await import('./commands/user/leaderboard.js')).default,
  (await import('./commands/user/profile.js')).default,
];

for (const command of commands) {
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    console.log(`✅ Loaded command: ${command.data.name}`);
  }
}

// Bot ready event
client.once(Events.ClientReady, async (c) => {
  console.log('╔════════════════════════════════════╗');
  console.log('║     IdolDuel Bot Started! ♡        ║');
  console.log('╚════════════════════════════════════╝');
  console.log(`📱 Logged in as ${c.user.tag}`);
  console.log(`🏠 Serving ${c.guilds.cache.size} guild(s)`);
  
  // Initialize database
  try {
    await database.initialize();
    console.log('✅ Database initialized');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
  
  // Initialize Redis
  try {
    await redis.initialize();
    console.log('✅ Redis initialized');
  } catch (error) {
    console.error('⚠️ Redis initialization failed (will use fallback):', error.message);
  }

  // Test S3 connection
  try {
    await storage.testConnection();
  } catch (error) {
    console.error('⚠️ S3 connection test failed:', error.message);
  }
  
  // Initialize duel manager
  duelManager.setClient(client);
  logger.setClient(client);
  
  console.log('🕐 Starting duel scheduler...');
  await duelManager.startAllGuilds();
  console.log('✅ Duel scheduler started');
  
  // Set bot status
  client.user.setActivity('idol battles ♡', { type: ActivityType.Watching });
  
  console.log('✅ All systems operational!');
  console.log('═══════════════════════════════════');
});

// Command handler
client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    
    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }
    
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error('Error executing command:', error);
      
      const errorMessage = { 
        content: 'There was an error executing this command! (>﹏<)', 
        ephemeral: true 
      };
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  } else {
    // Handle buttons, selects, modals
    try {
      await handleInteractions(interaction);
    } catch (error) {
      console.error('Error handling interaction:', error);
      
      const errorMessage = { 
        content: 'There was an error processing your action! (>﹏<)', 
        ephemeral: true 
      };
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }
});

// Message handler (auto-import)
client.on(Events.MessageCreate, async message => {
  try {
    await handleMessage(message);
  } catch (error) {
    console.error('Error handling message:', error);
  }
});

// Error handlers
client.on(Events.Error, error => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

process.on('SIGINT', async () => {
  console.log('\n⏹️ Shutting down gracefully...');
  
  if (redis.isConnected) {
    await redis.close();
  }
  await database.close();
  
  process.exit(0);
});

// Login
client.login(process.env.DISCORD_TOKEN);
