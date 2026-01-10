/**
 * Setup Command
 * Simple 3-step wizard to get started
 * FIXED: Proper schedule conversion
 */

import { 
  SlashCommandBuilder, 
  ChannelType,
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
          { name: 'Every 2 minutes (testing)', value: '2m' },
          { name: 'Every 30 minutes', value: '30m' },
          { name: 'Every 1 hour', value: '1h' },
          { name: 'Every 6 hours (4 per day)', value: '6h' },
          { name: 'Every 12 hours (2 per day) - Recommended', value: '12h' },
          { name: 'Every 24 hours (1 per day)', value: '24h' }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const guildId = interaction.guild.id.toString();
      const imageChannel = interaction.options.getChannel('image_channel');
      const duelChannel = interaction.options.getChannel('duel_channel');
      const schedule = interaction.options.getString('schedule');

      // FIXED: Convert schedule to seconds properly
      let interval, duration;
      switch (schedule) {
        case '2m':
          interval = duration = 120; // 2 minutes
          break;
        case '30m':
          interval = duration = 1800; // 30 minutes
          break;
        case '1h':
          interval = duration = 3600; // 1 hour
          break;
        case '6h':
          interval = duration = 21600; // 6 hours
          break;
        case '12h':
          interval = duration = 43200; // 12 hours
          break;
        case '24h':
          interval = duration = 86400; // 24 hours
          break;
        default:
          interval = duration = 120; // Default 2 minutes
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
          k_factor,
          duel_active,
          duel_paused
        )
        VALUES ($1, $2, $3, $4, $5, 1000, 32, false, false)
        ON CONFLICT (guild_id) 
        DO UPDATE SET
          image_channel_id = $2,
          duel_channel_id = $3,
          duel_interval = $4,
          duel_duration = $5`,
        [guildId, imageChannel.id.toString(), duelChannel.id.toString(), interval, duration]
      );

      const scheduleText = schedule === '2m' ? '2 minutes' :
                          schedule === '30m' ? '30 minutes' :
                          schedule === '1h' ? '1 hour' :
                          schedule === '6h' ? '6 hours' :
                          schedule === '12h' ? '12 hours' : '24 hours';

      const embed = embedUtils.createSuccessEmbed(
        `✅ **Setup Complete!**\n\n` +
        `📥 **Image Channel:** ${imageChannel}\n` +
        `⚔️ **Duel Channel:** ${duelChannel}\n` +
        `🕐 **Schedule:** Every ${scheduleText}\n\n` +
        `**Next Steps:**\n` +
        `1. Post images in ${imageChannel} (bot will auto-import)\n` +
        `2. Use \`/admin\` to start the duel system\n` +
        `3. That's it! The bot runs itself ♡`
      );

      await interaction.editReply({ embeds: [embed] });

      console.log(`✅ Setup completed for guild ${guildId} with ${scheduleText} schedule`);
    } catch (error) {
      console.error('Error in setup command:', error);
      const embed = embedUtils.createErrorEmbed('Setup failed. Please try again!');
      await interaction.editReply({ embeds: [embed] });
    }
  }
};
