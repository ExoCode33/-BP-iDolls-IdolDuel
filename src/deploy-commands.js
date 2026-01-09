/**
 * Deploy Commands Script
 * Registers slash commands with Discord
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
    console.log(`🔄 Deploying ${commands.length} application commands...`);

    const data = await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands },
    );

    console.log(`✅ Successfully deployed ${data.length} application commands!`);
    console.log('Commands registered:');
    data.forEach(cmd => console.log(`  - /${cmd.name}`));
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
})();
