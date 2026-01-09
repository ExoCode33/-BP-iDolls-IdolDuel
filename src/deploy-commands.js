/**
 * Force Clean Deploy Script
 * Removes ALL existing commands, then deploys new ones
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
    console.log('║   FORCE CLEAN DEPLOYMENT           ║');
    console.log('╚════════════════════════════════════╝');
    console.log('');

    // Step 1: DELETE ALL existing commands
    console.log('🗑️  Deleting ALL existing commands...');
    
    try {
      await rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
        { body: [] } // Empty array = delete all
      );
      console.log('   ✅ All old commands deleted!');
    } catch (error) {
      console.log('   ⚠️  No commands to delete (or error)');
    }

    console.log('');
    console.log('⏳ Waiting 2 seconds for Discord to sync...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Deploy new commands
    console.log('');
    console.log(`🔄 Deploying ${commands.length} NEW commands...`);

    const data = await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands }
    );

    console.log('');
    console.log('✅ Successfully deployed commands!');
    console.log('');
    console.log('📋 New commands registered:');
    data.forEach(cmd => console.log(`   ✅ /${cmd.name}`));
    
    console.log('');
    console.log('╔════════════════════════════════════╗');
    console.log('║   Deployment Complete! ♡           ║');
    console.log('╚════════════════════════════════════╝');
    console.log('');
    console.log('🎉 All old commands removed!');
    console.log('💡 Restart Discord app to see changes immediately');
    console.log('⏱️  Or wait 1-2 minutes for Discord to sync');
    console.log('');
  } catch (error) {
    console.error('❌ Error during deployment:', error);
  }
})();
