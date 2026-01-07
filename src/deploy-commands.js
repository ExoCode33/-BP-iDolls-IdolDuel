import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

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

(async () => {
  try {
    console.log(`🔄 Started refreshing ${commands.length} application (/) commands.`);

    const data = await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands },
    );

    console.log(`✅ Successfully reloaded ${data.length} application (/) commands.`);
    console.log('Commands registered:');
    data.forEach(cmd => console.log(`  - /${cmd.name}`));
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
})();
