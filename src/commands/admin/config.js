import { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import database from '../../database/database.js';
import embedUtils from '../../utils/embeds.js';

export default {
  /**
   * Get or create guild configuration
   */
  async getOrCreateConfig(guildId) {
    const result = await database.query(
      'SELECT * FROM guild_config WHERE guild_id = $1',
      [guildId]
    );

    if (result.rows.length > 0) {
      return result.rows[0];
    }

    // Create default config
    await database.query(
      `INSERT INTO guild_config (guild_id) VALUES ($1)`,
      [guildId]
    );

    const newResult = await database.query(
      'SELECT * FROM guild_config WHERE guild_id = $1',
      [guildId]
    );

    return newResult.rows[0];
  },

  /**
   * Show main admin menu
   */
  async showMainMenu(interaction, config) {
    const embed = embedUtils.createBaseEmbed();
    embed.setTitle('⚙️ IdolDuel Admin Panel');
    embed.setDescription(
      `**Server:** ${interaction.guild.name}\n` +
      `**Status:** ${config.duel_active ? (config.duel_paused ? '⏸️ Paused' : '✅ Active') : '❌ Stopped'}\n` +
      `**Season:** ${config.season_number}\n\n` +
      `Select a category below to configure your duel system ♡`
    );

    // Main menu buttons
    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_basic_settings')
          .setLabel('Basic Settings')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⚙️'),
        new ButtonBuilder()
          .setCustomId('admin_elo_settings')
          .setLabel('ELO Settings')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📊'),
        new ButtonBuilder()
          .setCustomId('admin_retirement_settings')
          .setLabel('Retirement')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🗑️')
      );

    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_image_management')
          .setLabel('Image Management')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🖼️'),
        new ButtonBuilder()
          .setCustomId('admin_import_settings')
          .setLabel('Import Settings')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📥'),
        new ButtonBuilder()
          .setCustomId('admin_view_logs')
          .setLabel('View Logs')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📋')
      );

    // Duel control buttons
    const row3 = new ActionRowBuilder();
    
    if (!config.duel_active) {
      row3.addComponents(
        new ButtonBuilder()
          .setCustomId('admin_start_duel')
          .setLabel('Start Duel System')
          .setStyle(ButtonStyle.Success)
          .setEmoji('▶️')
      );
    } else if (config.duel_paused) {
      row3.addComponents(
        new ButtonBuilder()
          .setCustomId('admin_resume_duel')
          .setLabel('Resume Duel')
          .setStyle(ButtonStyle.Success)
          .setEmoji('▶️'),
        new ButtonBuilder()
          .setCustomId('admin_stop_duel')
          .setLabel('Stop Duel System')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('⏹️')
      );
    } else {
      row3.addComponents(
        new ButtonBuilder()
          .setCustomId('admin_pause_duel')
          .setLabel('Pause Duel')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⏸️'),
        new ButtonBuilder()
          .setCustomId('admin_skip_duel')
          .setLabel('Skip Current Duel')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⏭️'),
        new ButtonBuilder()
          .setCustomId('admin_stop_duel')
          .setLabel('Stop Duel System')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('⏹️')
      );
    }

    const row4 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_dangerous_actions')
          .setLabel('⚠️ Dangerous Actions')
          .setStyle(ButtonStyle.Danger)
      );

    await interaction.editReply({
      embeds: [embed],
      components: [row1, row2, row3, row4]
    });
  },

  /**
   * Show basic settings
   */
  async handleBasicSettings(interaction, config) {
    const embed = embedUtils.createBaseEmbed();
    embed.setTitle('⚙️ Basic Settings');
    embed.setDescription(
      `**Duel Channel:** ${config.duel_channel_id ? `<#${config.duel_channel_id}>` : 'Not set'}\n` +
      `**Log Channel:** ${config.log_channel_id ? `<#${config.log_channel_id}>` : 'Not set'}\n` +
      `**Duel Duration:** ${config.duel_duration} seconds (${Math.floor(config.duel_duration / 60)} minutes)\n` +
      `**Duel Interval:** ${config.duel_interval} seconds (${Math.floor(config.duel_interval / 60)} minutes)\n` +
      `**Minimum Votes:** ${config.min_votes}\n` +
      `**Wildcard Chance:** ${(config.wildcard_chance * 100).toFixed(1)}%`
    );

    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_set_duel_channel')
          .setLabel('Set Duel Channel')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_set_log_channel')
          .setLabel('Set Log Channel')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_clear_log_channel')
          .setLabel('Disable Logs')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(!config.log_channel_id)
      );

    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_set_duel_duration')
          .setLabel('Duel Duration')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('admin_set_duel_interval')
          .setLabel('Duel Interval')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('admin_set_min_votes')
          .setLabel('Min Votes')
          .setStyle(ButtonStyle.Secondary)
      );

    const row3 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_set_wildcard_chance')
          .setLabel('Wildcard Chance')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('admin_back_main')
          .setLabel('◀ Back')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.editReply({
      embeds: [embed],
      components: [row1, row2, row3]
    });
  },

  /**
   * Show ELO settings
   */
  async handleEloSettings(interaction, config) {
    const embed = embedUtils.createBaseEmbed();
    embed.setTitle('📊 ELO Settings');
    embed.setDescription(
      `**Starting ELO:** ${config.starting_elo}\n` +
      `**K-Factor:** ${config.k_factor}\n` +
      `**Streak Bonus (2 wins):** +${(config.streak_bonus_2 * 100).toFixed(0)}%\n` +
      `**Streak Bonus (3+ wins):** +${(config.streak_bonus_3 * 100).toFixed(0)}%\n` +
      `**Upset Bonus:** +${(config.upset_bonus * 100).toFixed(0)}%`
    );

    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_set_starting_elo')
          .setLabel('Starting ELO')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_set_k_factor')
          .setLabel('K-Factor')
          .setStyle(ButtonStyle.Primary)
      );

    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_back_main')
          .setLabel('◀ Back')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.editReply({
      embeds: [embed],
      components: [row1, row2]
    });
  },

  /**
   * Show retirement settings
   */
  async handleRetirementSettings(interaction, config) {
    const embed = embedUtils.createBaseEmbed();
    embed.setTitle('🗑️ Retirement Settings');
    embed.setDescription(
      `**Losses Before Retirement:** ${config.losses_before_retirement}\n` +
      `**Max Active Images:** ${config.max_active_images}\n` +
      `**Auto-Retire Threshold:** ${config.elo_clear_threshold ? `Below ${config.elo_clear_threshold} ELO` : 'Disabled'}`
    );

    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_set_losses_retirement')
          .setLabel('Losses Before Retirement')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_set_elo_threshold')
          .setLabel('Set ELO Threshold')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_clear_elo_threshold')
          .setLabel('Clear Threshold')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(!config.elo_clear_threshold)
      );

    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_back_main')
          .setLabel('◀ Back')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.editReply({
      embeds: [embed],
      components: [row1, row2]
    });
  },

  /**
   * Show import settings
   */
  async handleImportSettings(interaction, config) {
    const channels = config.import_channel_ids || [];
    const channelList = channels.length > 0
      ? channels.map(id => `<#${id}>`).join(', ')
      : 'None set';

    const embed = embedUtils.createBaseEmbed();
    embed.setTitle('📥 Import Settings');
    embed.setDescription(
      `**Import Channels:** ${channelList}\n\n` +
      `Images posted in these channels will be automatically imported into the duel system.`
    );

    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_import_images')
          .setLabel('Set Import Channels')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_back_main')
          .setLabel('◀ Back')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.editReply({
      embeds: [embed],
      components: [row1]
    });
  },

  /**
   * Show dangerous actions
   */
  async handleDangerousActions(interaction, config) {
    const embed = embedUtils.createBaseEmbed();
    embed.setTitle('⚠️ Dangerous Actions');
    embed.setDescription(
      `**Warning:** These actions cannot be undone!\n\n` +
      `**Season Reset:** Resets all image ELO to starting value, preserves images\n` +
      `**System Reset:** Deletes ALL data including images, duels, and votes`
    );
    embed.setColor(0xFF0000);

    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_season_reset')
          .setLabel('Season Reset')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('admin_system_reset')
          .setLabel('⚠️ System Reset')
          .setStyle(ButtonStyle.Danger)
      );

    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_back_main')
          .setLabel('◀ Back')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.editReply({
      embeds: [embed],
      components: [row1, row2]
    });
  },

  // ========================================
  // MODAL CREATORS
  // ========================================

  createKFactorModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_k_factor')
      .setTitle('Set K-Factor');

    const input = new TextInputBuilder()
      .setCustomId('k_factor')
      .setLabel('K-Factor (default: 30)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 30')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  },

  createStartingEloModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_starting_elo')
      .setTitle('Set Starting ELO');

    const input = new TextInputBuilder()
      .setCustomId('starting_elo')
      .setLabel('Starting ELO (default: 1000)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 1000')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  },

  createDuelDurationModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_duel_duration')
      .setTitle('Set Duel Duration');

    const input = new TextInputBuilder()
      .setCustomId('duel_duration')
      .setLabel('Duration in seconds (default: 1800)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 1800 (30 minutes)')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  },

  createDuelIntervalModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_duel_interval')
      .setTitle('Set Duel Interval');

    const input = new TextInputBuilder()
      .setCustomId('duel_interval')
      .setLabel('Interval in seconds (default: 1800)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 1800 (30 minutes)')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  },

  createMinVotesModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_min_votes')
      .setTitle('Set Minimum Votes');

    const input = new TextInputBuilder()
      .setCustomId('min_votes')
      .setLabel('Minimum votes required (default: 1)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 1')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  },

  createLossesRetirementModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_losses_retirement')
      .setTitle('Set Losses Before Retirement');

    const input = new TextInputBuilder()
      .setCustomId('losses_retirement')
      .setLabel('Consecutive losses (default: 3)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 3')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  },

  createWildcardChanceModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_wildcard_chance')
      .setTitle('Set Wildcard Chance');

    const input = new TextInputBuilder()
      .setCustomId('wildcard_chance')
      .setLabel('Chance as decimal (default: 0.05 = 5%)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 0.05')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  },

  createDuelChannelModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_duel_channel')
      .setTitle('Set Duel Channel');

    const input = new TextInputBuilder()
      .setCustomId('duel_channel')
      .setLabel('Duel Channel ID')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Right-click channel, Copy ID')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  },

  createLogChannelModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_log_channel')
      .setTitle('Set Log Channel');

    const input = new TextInputBuilder()
      .setCustomId('log_channel_input')
      .setLabel('Log Channel ID')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Right-click channel, Copy ID')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  },

  createImportChannelsModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_import_channels')
      .setTitle('Set Import Channels');

    const input = new TextInputBuilder()
      .setCustomId('import_channels')
      .setLabel('Channel IDs (comma-separated)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('e.g., 123456789,987654321')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  },

  createEloThresholdModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_elo_threshold')
      .setTitle('Set Auto-Retire ELO Threshold');

    const input = new TextInputBuilder()
      .setCustomId('elo_threshold')
      .setLabel('Retire images below this ELO')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 800')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  },

  createSeasonResetModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_season_reset')
      .setTitle('⚠️ Confirm Season Reset');

    const input = new TextInputBuilder()
      .setCustomId('confirm_reset')
      .setLabel('Type RESET to confirm')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('RESET')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  },

  createSystemResetModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_system_reset')
      .setTitle('⚠️ DANGER: System Reset');

    const input = new TextInputBuilder()
      .setCustomId('confirm_delete')
      .setLabel('Type DELETE ALL to confirm')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('DELETE ALL')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  }
};
