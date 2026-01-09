/**
 * Deploy Commands Script
 * Registers slash commands with Discord
 * Automatically removes old commands
 */

import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const commands = [
  {
    name: 'setup',
    description: 'Set up IdolDuel bot (3 simple steps)',
    options: [
      {
        type: 7, // CHANNEL
        name: 'image_channel',
        description: 'Channel where users post images',
        required: true,
        channel_types: [0] // GUILD_TEXT
      },
      {
        type: 7, // CHANNEL
        name: 'duel_channel',
        description: 'Channel where duels will run',
        required: true,
        channel_types: [0] // GUILD_TEXT
      },
      {
        type: 3, // STRING
        name: 'schedule',
        description: 'How often should duels run?',
        required: true,
        choices: [
          { name: 'Every 6 hours (4 per day)', value: '6h' },
          { name: 'Every 12 hours (2 per day) - Recommended', value: '12h' },
          { name: 'Every 24 hours (1 per day)', value: '24h' }
        ]
      }
    ]
  },
  {
    name: 'admin',
    description: 'Admin control panel'
  },
  {
    name: 'leaderboard',
    description: 'View top rankings'
  },
  {
    name: 'profile',
    description: 'View your profile and stats'
  }
];

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('╔════════════════════════════════════╗');
    console.log('║   Command Deployment Started       ║');
    console.log('╚════════════════════════════════════╝');
    console.log('');

    // Step 1: Get existing commands
    console.log('🔍 Checking for existing commands...');
    const existingCommands = await rest.get(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID)
    );

    console.log(`   Found ${existingCommands.length} existing command(s)`);

    // Step 2: Identify commands to remove
    const commandsToRemove = existingCommands.filter(cmd => {
      const isNewCommand = commands.some(newCmd => newCmd.name === cmd.name);
      return !isNewCommand;
    });

    if (commandsToRemove.length > 0) {
      console.log('');
      console.log('🗑️  Removing old commands:');
      for (const cmd of commandsToRemove) {
        console.log(`   ❌ /${cmd.name}`);
        await rest.delete(
          Routes.applicationCommand(process.env.DISCORD_CLIENT_ID, cmd.id)
        );
      }
      console.log(`   ✅ Removed ${commandsToRemove.length} old command(s)`);
    } else {
      console.log('   ✅ No old commands to remove');
    }

    // Step 3: Deploy new commands
    console.log('');
    console.log(`🔄 Deploying ${commands.length} new command(s)...`);

    const data = await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands },
    );

    console.log('');
    console.log('✅ Successfully deployed commands!');
    console.log('');
    console.log('📋 Registered commands:');
    data.forEach(cmd => console.log(`   ✅ /${cmd.name}`));
    
    console.log('');
    console.log('╔════════════════════════════════════╗');
    console.log('║   Deployment Complete! ♡           ║');
    console.log('╚════════════════════════════════════╝');
    console.log('');
    console.log('🎉 Your bot is ready to use!');
    console.log('💡 Restart your bot to load the new commands.');
    console.log('');
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
})();
