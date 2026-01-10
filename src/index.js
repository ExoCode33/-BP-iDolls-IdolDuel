/**
 * IdolDuel Bot - Main Entry Point
 * UPDATED: Modular interactions, silent imports, aspect ratio filtering
 * FIXED: Command loader handles both files and folders
 */

import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync, statSync } from 'fs';
import database from './database/database.js';
import redis from './database/redis.js';
import storage from './services/image/storage.js';
import duelManager from './services/duel/manager.js';
import importer from './services/image/importer.js';
import { handleInteractions } from './handlers/interactions/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Command collection
client.commands = new Collection();

/**
 * Load all commands - handles both files and folders
 */
async function loadCommands() {
  const commandsPath = join(__dirname, 'commands');
  const items = readdirSync(commandsPath);

  for (const item of items) {
    const itemPath = join(commandsPath, item);
    const stats = statSync(itemPath);
    
    if (stats.isDirectory()) {
      // It's a folder - scan for .js files inside
      const commandFiles = readdirSync(itemPath).filter(file => file.endsWith('.js'));
      
      for (const file of commandFiles) {
        const filePath = join(itemPath, file);
        const command = (await import(`file://${filePath}`)).default;

        if ('data' in command && 'execute' in command) {
          client.commands.set(command.data.name, command);
          console.log(`✅ Loaded command: ${command.data.name}`);
        }
      }
    } else if (item.endsWith('.js')) {
      // It's a .js file directly in commands folder
      const command = (await import(`file://${itemPath}`)).default;

      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`✅ Loaded command: ${command.data.name}`);
      }
    }
  }
}

/**
 * Register slash commands with Discord
 */
async function registerCommands() {
  try {
    const commands = [];
    client.commands.forEach(command => {
      commands.push(command.data.toJSON());
    });

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands }
    );

    console.log('✅ Slash commands registered');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

/**
 * Bot ready event
 */
client.once('ready', async () => {
  console.log('\n╔════════════════════════════════════╗');
  console.log('║     IdolDuel Bot Started! ♡        ║');
  console.log('╚════════════════════════════════════╝');
  console.log(`📱 Logged in as ${client.user.tag}`);
  console.log(`🏠 Serving ${client.guilds.cache.size} guild(s)`);
  console.log(`📋 Loaded ${client.commands.size} commands`);

  try {
    // Initialize systems
    await database.initialize();
    console.log('✅ Database initialized');

    await storage.initialize();
    console.log('✅ S3 connection successful');
    console.log('   ✅ URL caching enabled for faster loading');

    await redis.initialize();
    console.log('✅ Redis initialized');

    // Set client for duel manager
    duelManager.setClient(client);

    // Start duel scheduler
    console.log('🕐 Starting duel scheduler...');
    await duelManager.startAllGuilds();
    console.log('✅ Duel scheduler started');

    console.log('✅ All systems operational!');
    console.log('═══════════════════════════════════\n');

  } catch (error) {
    console.error('Error during initialization:', error);
  }
});

/**
 * Handle slash commands
 */
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`Command not found: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing command ${interaction.commandName}:`, error);

    const errorMessage = {
      content: 'There was an error executing this command!',
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

/**
 * Handle button/modal/select interactions
 * UPDATED: Now uses modular handler system
 */
client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton() || 
      interaction.isModalSubmit() || 
      interaction.isStringSelectMenu()) {
    try {
      await handleInteractions(interaction);
    } catch (error) {
      console.error('Error handling interaction:', error);
    }
  }
});

/**
 * Handle new messages with image attachments
 * UPDATED: Silent import with aspect ratio filtering
 */
client.on('messageCreate', async (message) => {
  // Ignore bots
  if (message.author.bot) return;
  
  // Only process guild messages
  if (!message.guild) return;
  
  // Only process messages with attachments
  if (message.attachments.size === 0) return;

  try {
    const guildId = message.guild.id.toString();

    // Get guild config
    const configResult = await database.query(
      'SELECT image_channel_id FROM guild_config WHERE guild_id = $1',
      [guildId]
    );

    if (configResult.rows.length === 0) return;

    const imageChannelId = configResult.rows[0].image_channel_id;

    // Only process messages in the designated image channel
    if (message.channel.id !== imageChannelId) return;

    // SILENT IMPORT - NO REACTIONS OR FEEDBACK
    const attachments = Array.from(message.attachments.values());
    const results = await importer.importMultiple(guildId, message.author.id, attachments);

    // Log only (no user feedback)
    if (results.length > 0) {
      console.log(`📥 Imported ${results.length}/${attachments.length} images from ${message.author.tag} (filtered by aspect ratio)`);
    } else if (attachments.length > 0) {
      console.log(`⏭️ Skipped ${attachments.length} images from ${message.author.tag} (wrong aspect ratio)`);
    }

  } catch (error) {
    console.error('Error handling message:', error);
  }
});

/**
 * Handle errors
 */
client.on('error', error => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

/**
 * Graceful shutdown
 */
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  
  try {
    await redis.disconnect();
    console.log('✅ Redis disconnected');
    
    await database.disconnect();
    console.log('✅ Database disconnected');
    
    client.destroy();
    console.log('✅ Discord client disconnected');
    
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

/**
 * Start the bot
 */
async function start() {
  try {
    // Load commands
    await loadCommands();

    // Register commands with Discord
    await registerCommands();

    // Login to Discord
    await client.login(process.env.DISCORD_TOKEN);

  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

// Start the bot
start();
