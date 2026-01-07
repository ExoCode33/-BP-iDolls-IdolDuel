import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import dotenv from 'dotenv';
import database from './database/database.js';
import redis from './database/redis.js';
import DuelScheduler from './services/duelScheduler.js';
import { handleButtonInteraction } from './handlers/buttonHandler.js';
import { handleModalSubmit } from './handlers/modalHandler.js';
import { handleSelectMenu } from './handlers/selectHandler.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';

// Load environment variables
dotenv.config();

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Load commands
client.commands = new Collection();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function loadCommands() {
  const commandsPath = join(__dirname, 'commands');
  const items = readdirSync(commandsPath, { withFileTypes: true });

  for (const item of items) {
    if (item.isFile() && item.name.endsWith('.js')) {
      // Load command file directly from commands folder
      const filePath = join(commandsPath, item.name);
      const command = await import(`file://${filePath}`);
      
      if ('data' in command.default && 'execute' in command.default) {
        client.commands.set(command.default.data.name, command.default);
        console.log(`✅ Loaded command: ${command.default.data.name}`);
      }
    } else if (item.isDirectory()) {
      // Load commands from subfolder
      const folderPath = join(commandsPath, item.name);
      const commandFiles = readdirSync(folderPath).filter(file => file.endsWith('.js'));

      for (const file of commandFiles) {
        const filePath = join(folderPath, file);
        const command = await import(`file://${filePath}`);
        
        if ('data' in command.default && 'execute' in command.default) {
          client.commands.set(command.default.data.name, command.default);
          console.log(`✅ Loaded command: ${command.default.data.name}`);
        }
      }
    }
  }
}

// Bot ready event
client.once(Events.ClientReady, async () => {
  console.log('╔════════════════════════════════════╗');
  console.log('║     IdolDuel Bot Started! ♡        ║');
  console.log('╚════════════════════════════════════╝');
  console.log(`📱 Logged in as ${client.user.tag}`);
  console.log(`🏠 Serving ${client.guilds.cache.size} guild(s)`);

  try {
    // Auto-deploy commands
    await deployCommands();

    // Initialize database
    await database.initialize();

    // Initialize Redis (optional)
    await redis.initialize();

    // Load commands
    await loadCommands();

    // Initialize and start duel scheduler
    client.duelScheduler = new DuelScheduler(client);
    await client.duelScheduler.start();

    console.log('✅ All systems operational!');
    console.log('═══════════════════════════════════');
  } catch (error) {
    console.error('❌ Initialization error:', error);
    process.exit(1);
  }
});

async function deployCommands() {
  try {
    console.log('🔄 Deploying slash commands...');
    
    const { REST, Routes, SlashCommandBuilder } = await import('discord.js');
    
    const commands = [
      new SlashCommandBuilder()
        .setName('idolduel')
        .setDescription('IdolDuel bot commands')
        .addSubcommand(subcommand =>
          subcommand
            .setName('profile')
            .setDescription('View your IdolDuel profile and stats')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('leaderboard')
            .setDescription('View the top users and images')
        )
        .addSubcommandGroup(group =>
          group
            .setName('admin')
            .setDescription('Admin commands')
            .addSubcommand(subcommand =>
              subcommand
                .setName('config')
                .setDescription('Access admin configuration panel')
            )
        )
    ].map(command => command.toJSON());

    const rest = new REST().setToken(process.env.DISCORD_TOKEN);

    const data = await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands },
    );

    console.log(`✅ Successfully deployed ${data.length} application (/) commands`);
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
    throw error;
  }
}

// Command interaction handler
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
      
      const reply = {
        content: '❌ There was an error executing this command! (>﹏<)',
        ephemeral: true
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  }

  // Handle button interactions
  if (interaction.isButton()) {
    try {
      await handleButtonInteraction(interaction);
    } catch (error) {
      console.error('Error handling button:', error);
    }
  }

  // Handle modal submissions
  if (interaction.isModalSubmit()) {
    try {
      await handleModalSubmit(interaction);
    } catch (error) {
      console.error('Error handling modal:', error);
    }
  }

  // Handle select menu interactions
  if (interaction.isStringSelectMenu()) {
    try {
      await handleSelectMenu(interaction);
    } catch (error) {
      console.error('Error handling select menu:', error);
    }
  }
});

// Error handling
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⏹️  Shutting down gracefully...');
  
  if (client.duelScheduler) {
    client.duelScheduler.stop();
  }
  
  await database.close();
  await redis.close();
  
  client.destroy();
  process.exit(0);
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);
