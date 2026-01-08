import { Client, GatewayIntentBits, Collection, Events, ActivityType } from 'discord.js';
import dotenv from 'dotenv';
import database from './database/database.js';
import redis from './database/redis.js';
import storage from './services/storage.js';
import DuelScheduler from './services/duelScheduler.js';
import { handleButtonInteraction } from './handlers/buttonHandler.js';
import { handleModalSubmit } from './handlers/modalHandler.js';
import { handleSelectMenu } from './handlers/selectHandler.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = await import(`file://${filePath}`);
  
  if ('data' in command.default && 'execute' in command.default) {
    client.commands.set(command.default.data.name, command.default);
    console.log(`✅ Loaded command: ${command.default.data.name}`);
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log('╔════════════════════════════════════╗');
  console.log('║     IdolDuel Bot Started! ♡        ║');
  console.log('╚════════════════════════════════════╝');
  console.log(`📱 Logged in as ${c.user.tag}`);
  console.log(`🏠 Serving ${c.guilds.cache.size} guild(s)`);
  
  // Deploy commands
  console.log('🔄 Deploying slash commands...');
  try {
    const { REST, Routes } = await import('discord.js');
    const rest = new REST().setToken(process.env.DISCORD_TOKEN);
    
    const commands = [];
    for (const [name, command] of client.commands) {
      commands.push(command.data.toJSON());
    }
    
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    
    console.log('✅ Successfully deployed ' + commands.length + ' application (/) commands');
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
  
  // Initialize database
  try {
    await database.initialize();
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
  
  // Connect to Redis
  try {
    await redis.connect();
    console.log('✅ Redis connected');
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
  }

  // Test S3 connection
  try {
    await storage.testConnection();
  } catch (error) {
    console.error('⚠️  S3 connection test failed:', error.message);
  }
  
  // Initialize and attach duel scheduler
  console.log('🕐 Starting duel scheduler...');
  client.duelScheduler = new DuelScheduler(client);
  await client.duelScheduler.start();
  console.log('✅ Duel scheduler started');
  
  // Set bot status
  client.user.setActivity('idol battles ♡', { type: ActivityType.Watching });
  
  console.log('✅ All systems operational!');
  console.log('═══════════════════════════════════');
});

client.on(Events.InteractionCreate, async interaction => {
  // Handle slash commands
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
        content: 'There was an error executing this command! Please try again. (>﹏<)', 
        ephemeral: true 
      };
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }
  
  // Handle button interactions
  else if (interaction.isButton()) {
    try {
      await handleButtonInteraction(interaction);
    } catch (error) {
      console.error('Error handling button:', error);
      
      const errorMessage = { 
        content: 'There was an error processing your action! Please try again. (>﹏<)', 
        ephemeral: true 
      };
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }
  
  // Handle select menu interactions
  else if (interaction.isStringSelectMenu()) {
    try {
      await handleSelectMenu(interaction);
    } catch (error) {
      console.error('Error handling select menu:', error);
      
      const errorMessage = { 
        content: 'There was an error processing your selection! Please try again. (>﹏<)', 
        ephemeral: true 
      };
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }
  
  // Handle modal submissions
  else if (interaction.isModalSubmit()) {
    try {
      await handleModalSubmit(interaction);
    } catch (error) {
      console.error('Error handling modal:', error);
      
      const errorMessage = { 
        content: 'There was an error processing your submission! Please try again. (>﹏<)', 
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

// Error handlers
client.on(Events.Error, error => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

process.on('SIGINT', async () => {
  console.log('\n⏹️  Shutting down gracefully...');
  
  if (client.duelScheduler) {
    client.duelScheduler.stop();
  }
  
  await redis.disconnect();
  await database.close();
  
  process.exit(0);
});

// Login
client.login(process.env.DISCORD_TOKEN);
