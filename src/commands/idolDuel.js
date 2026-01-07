import { SlashCommandBuilder } from 'discord.js';
import profileCmd from './user/profile.js';
import leaderboardCmd from './user/leaderboard.js';
import adminConfigCmd from './admin/config.js';

export default {
  data: new SlashCommandBuilder()
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
    ),

  async execute(interaction) {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    // Route to appropriate handler
    if (subcommandGroup === 'admin' && subcommand === 'config') {
      await adminConfigCmd.execute(interaction);
    } else if (subcommand === 'profile') {
      await profileCmd.execute(interaction);
    } else if (subcommand === 'leaderboard') {
      await leaderboardCmd.execute(interaction);
    }
  },
};
