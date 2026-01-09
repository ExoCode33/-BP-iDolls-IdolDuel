/**
 * Setup Command
 * Simple 3-step wizard to get started
 */

import { 
  SlashCommandBuilder, 
  ChannelType,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  MessageFlags
} from 'discord.js';
import database from '../database/database.js';
import embedUtils from '../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Set up IdolDuel bot (3 simple steps)')
    .addChannelOption(option =>
      option
        .setName('image_channel')
        .setDescription('Channel where users post images')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addChannelOption(option =>
      option
        .setName('duel_channel')
        .setDescription('Channel where duels will run')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('schedule')
        .setDescription('How often should duels run?')
        .setRequired(true)
        .addChoices(
          { name: 'Every 6 hours (4 per day)', value: '6h' },
          { name: 'Every 12 hours (2 per day) - Recommended', value: '12h' },
          { name: 'Every 24 hours (1 per day)', value: '24h' }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const guildId = interaction.guild.id;
      const imageChannel = interaction.options.getChannel('image_channel');
      const duelChannel = interaction.options.getChannel('duel_channel');
      const schedule = interaction.options.getString('schedule');

      // Convert schedule to seconds
      let interval, duration;
      switch (schedule) {
        case '6h':
          interval = duration = 21600; // 6 hours
          break;
        case '12h':
          interval = duration = 43200; // 12 hours
          break;
        case '24h':
          interval = duration = 86400; // 24 hours
          break;
      }

      // Create or update config
      await database.query(
        `INSERT INTO guild_config (
          guild_id, 
          image_channel_id, 
          duel_channel_id, 
          duel_interval, 
          duel_duration,
          starting_elo,
          k_factor
        )
        VALUES ($1, $2, $3, $4, $5, 1000, 32)
        ON CONFLICT (guild_id) 
        DO UPDATE SET
          image_channel_id = $2,
          duel_channel_id = $3,
          duel_interval = $4,
          duel_duration = $5`,
        [guildId, imageChannel.id, duelChannel.id, interval, duration]
      );

      const embed = embedUtils.createSuccessEmbed(
        `✅ **Setup Complete!**\n\n` +
        `📥 **Image Channel:** ${imageChannel}\n` +
        `⚔️ **Duel Channel:** ${duelChannel}\n` +
        `🕐 **Schedule:** Every ${interval / 3600} hours\n\n` +
        `**Next Steps:**\n` +
        `1. Post images in ${imageChannel} (bot will auto-import)\n` +
        `2. Use \`/admin\` to start duels\n` +
        `3. That's it! The bot runs itself ♡`
      );

      await interaction.editReply({ embeds: [embed] });

      console.log(`✅ Setup completed for guild ${guildId}`);
    } catch (error) {
      console.error('Error in setup command:', error);
      const embed = embedUtils.createErrorEmbed('Setup failed. Please try again!');
      await interaction.editReply({ embeds: [embed] });
    }
  }
};
