/**
 * Enhanced Admin Command
 * FIXED: Shows single "Duel Cycle" instead of interval + duration
 */

import { 
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} from 'discord.js';
import database from '../../database/database.js';
import embedUtils from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Admin control panel'),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      await this.showAdminPanel(interaction, false);
    } catch (error) {
      console.error('Error in admin command:', error);
      const embed = embedUtils.createErrorEmbed('Failed to load admin panel!');
      await interaction.editReply({ embeds: [embed] });
    }
  },

  async showAdminPanel(interaction, isUpdate = false) {
    const guildId = interaction.guild.id.toString();

    const configResult = await database.query(
      'SELECT * FROM guild_config WHERE guild_id = $1',
      [guildId]
    );

    if (configResult.rows.length === 0) {
      const embed = embedUtils.createErrorEmbed(
        'Please run `/setup` first to configure the bot!'
      );
      
      if (isUpdate) {
        if (interaction.isModalSubmit()) {
          await interaction.editReply({ embeds: [embed], components: [] });
        } else {
          await interaction.update({ embeds: [embed], components: [] });
        }
      } else {
        await interaction.editReply({ embeds: [embed] });
      }
      return;
    }

    const config = configResult.rows[0];

    const stats = await database.query(
      `SELECT 
        COUNT(*) FILTER (WHERE retired = false) as active,
        COUNT(*) FILTER (WHERE retired = true) as retired,
        COUNT(*) as total
       FROM images WHERE guild_id = $1`,
      [guildId]
    );

    const imageStats = stats.rows[0];

    const duelStats = await database.query(
      'SELECT COUNT(*) as total FROM duels WHERE guild_id = $1',
      [guildId]
    );

    const activeDuel = await database.query(
      'SELECT * FROM active_duels WHERE guild_id = $1',
      [guildId]
    );

    const hasActiveDuel = activeDuel.rows.length > 0;

    const embed = embedUtils.createBaseEmbed();
    embed.setTitle('⚙️ IdolDuel Admin Panel');
    
    const cycleMinutes = Math.floor(config.duel_duration / 60);

    let retirementInfo = '• Auto-Retirement: Disabled';
    if (config.retire_after_losses && config.retire_after_losses > 0) {
      retirementInfo = `• Auto-Retire: ${config.retire_after_losses} losses`;
    } else if (config.retire_below_elo && config.retire_below_elo > 0) {
      retirementInfo = `• Auto-Retire: Below ${config.retire_below_elo} ELO`;
    }

    let systemStatus = '❌ Stopped';
    let duelStatus = '❌ None';

    if (config.duel_active) {
      if (config.duel_paused) {
        systemStatus = '⏸️ Paused';
        duelStatus = hasActiveDuel ? '⏸️ Paused' : '❌ None';
      } else {
        systemStatus = '✅ Running';
        duelStatus = hasActiveDuel ? '✅ Active' : '⏳ Starting...';
      }
    }

    embed.setDescription(
      `**System Status:** ${systemStatus}\n` +
      `**Current Duel:** ${duelStatus}\n` +
      `**Duel Cycle:** ${cycleMinutes} minutes\n\n` +
      `**📊 Statistics:**\n` +
      `• Images: ${imageStats.active} active, ${imageStats.retired} retired\n` +
      `• Total Duels: ${duelStats.rows[0].total}\n\n` +
      `**⚙️ Settings:**\n` +
      `• Starting ELO: ${config.starting_elo}\n` +
      `• K-Factor: ${config.k_factor}\n` +
      `${retirementInfo}`
    );

    const controlRow = new ActionRowBuilder();

    if (!config.duel_active) {
      controlRow.addComponents(
        new ButtonBuilder()
          .setCustomId('admin_start_duel')
          .setLabel('▶️ Start System')
          .setStyle(ButtonStyle.Success)
      );
    } else if (config.duel_paused) {
      controlRow.addComponents(
        new ButtonBuilder()
          .setCustomId('admin_resume_duel')
          .setLabel('▶️ Resume')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('admin_stop_duel')
          .setLabel('⏹️ Stop')
          .setStyle(ButtonStyle.Danger)
      );
    } else {
      controlRow.addComponents(
        new ButtonBuilder()
          .setCustomId('admin_pause_duel')
          .setLabel('⏸️ Pause')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('admin_skip_duel')
          .setLabel('⏭️ Skip Duel')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(!hasActiveDuel),
        new ButtonBuilder()
          .setCustomId('admin_stop_duel')
          .setLabel('⏹️ Stop')
          .setStyle(ButtonStyle.Danger)
      );
    }

    const settingsRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_edit_schedule')
          .setLabel('⏱️ Duel Cycle')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_edit_elo')
          .setLabel('📊 ELO Settings')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_edit_retirement')
          .setLabel('🗑️ Auto-Retire')
          .setStyle(ButtonStyle.Primary)
      );

    const managementRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_import_images')
          .setLabel('📥 Import Images')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('admin_browse_images')
          .setLabel('🖼️ Browse Images')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('admin_system_reset')
          .setLabel('🔥 System Reset')
          .setStyle(ButtonStyle.Danger)
      );

    const components = [controlRow, settingsRow, managementRow];

    if (isUpdate) {
      if (interaction.isModalSubmit()) {
        await interaction.editReply({ embeds: [embed], components: components });
      } else if (interaction.isButton()) {
        await interaction.update({ embeds: [embed], components: components });
      }
    } else {
      await interaction.editReply({ embeds: [embed], components: components });
    }
  }
};
