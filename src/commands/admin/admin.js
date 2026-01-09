/**
 * Admin Command
 * Simple admin panel with stats and controls
 */

import { 
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags
} from 'discord.js';
import database from '../../database/database.js';
import embedUtils from '../../utils/embeds.js';
import retirement from '../../services/image/retirement.js';

export default {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Admin control panel'),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const guildId = interaction.guild.id;

      // Get config
      const configResult = await database.query(
        'SELECT * FROM guild_config WHERE guild_id = $1',
        [guildId]
      );

      if (configResult.rows.length === 0) {
        const embed = embedUtils.createErrorEmbed(
          'Please run `/setup` first to configure the bot!'
        );
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const config = configResult.rows[0];

      // Get stats
      const stats = await database.query(
        `SELECT 
          COUNT(*) FILTER (WHERE retired = false) as active,
          COUNT(*) FILTER (WHERE retired = true) as retired,
          COUNT(*) as total,
          MAX(elo) as max_elo,
          MIN(elo) FILTER (WHERE retired = false) as min_elo
         FROM images WHERE guild_id = $1`,
        [guildId]
      );

      const imageStats = stats.rows[0];

      // Get duel stats
      const duelStats = await database.query(
        'SELECT COUNT(*) as total FROM duels WHERE guild_id = $1',
        [guildId]
      );

      // Check for active duel
      const activeDuel = await database.query(
        'SELECT * FROM active_duels WHERE guild_id = $1',
        [guildId]
      );

      const hasActiveDuel = activeDuel.rows.length > 0;

      // Create embed
      const embed = embedUtils.createBaseEmbed();
      embed.setTitle('⚙️ IdolDuel Admin Panel');
      
      const scheduleHours = config.duel_interval / 3600;
      const retirementInfo = retirement.getRetirementInfo(config.duel_interval);

      embed.setDescription(
        `**Status:** ${config.duel_active ? (config.duel_paused ? '⏸️ Paused' : '✅ Active') : '❌ Stopped'}\n` +
        `**Schedule:** Every ${scheduleHours}h for ${scheduleHours}h\n` +
        `**Season:** ${config.season_number}\n\n` +
        `**📊 Statistics:**\n` +
        `• Images: ${imageStats.active} active, ${imageStats.retired} retired\n` +
        `• Total Duels: ${duelStats.rows[0].total}\n` +
        `• Current Duel: ${hasActiveDuel ? 'Yes' : 'No'}\n\n` +
        `**⚙️ Settings:**\n` +
        `• Starting ELO: ${config.starting_elo}\n` +
        `• K-Factor: ${config.k_factor}\n` +
        `• ${retirementInfo}\n\n` +
        `Use the buttons below to control the system.`
      );

      // Control buttons
      const controlRow = new ActionRowBuilder();

      if (!config.duel_active) {
        controlRow.addComponents(
          new ButtonBuilder()
            .setCustomId('admin_start_duel')
            .setLabel('Start Duel System')
            .setStyle(ButtonStyle.Success)
            .setEmoji('▶️')
        );
      } else if (config.duel_paused) {
        controlRow.addComponents(
          new ButtonBuilder()
            .setCustomId('admin_resume_duel')
            .setLabel('Resume')
            .setStyle(ButtonStyle.Success)
            .setEmoji('▶️'),
          new ButtonBuilder()
            .setCustomId('admin_stop_duel')
            .setLabel('Stop')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⏹️')
        );
      } else {
        controlRow.addComponents(
          new ButtonBuilder()
            .setCustomId('admin_pause_duel')
            .setLabel('Pause')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⏸️'),
          new ButtonBuilder()
            .setCustomId('admin_skip_duel')
            .setLabel('Skip')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⏭️'),
          new ButtonBuilder()
            .setCustomId('admin_stop_duel')
            .setLabel('Stop')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⏹️')
        );
      }

      await interaction.editReply({ 
        embeds: [embed], 
        components: [controlRow]
      });
    } catch (error) {
      console.error('Error in admin command:', error);
      const embed = embedUtils.createErrorEmbed('Failed to load admin panel!');
      await interaction.editReply({ embeds: [embed] });
    }
  }
};
