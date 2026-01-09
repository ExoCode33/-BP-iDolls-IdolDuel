import { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  StringSelectMenuBuilder,
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

    // Create default config with smart defaults
    await database.query(
      `INSERT INTO guild_config (
        guild_id, 
        duel_duration, 
        duel_interval, 
        losses_before_retirement,
        auto_approve_images
      ) VALUES ($1, $2, $3, $4, $5)`,
      [guildId, 43200, 43200, null, false] // 12hr duels, smart retirement, manual approval
    );

    const newResult = await database.query(
      'SELECT * FROM guild_config WHERE guild_id = $1',
      [guildId]
    );

    return newResult.rows[0];
  },

  /**
   * Show main admin menu with dropdown
   */
  async showMainMenu(interaction, config) {
    // Get stats
    const stats = await database.query(
      `SELECT 
        COUNT(*) FILTER (WHERE retired = false) as active,
        COUNT(*) FILTER (WHERE retired = true) as retired,
        COUNT(*) FILTER (WHERE approved = false) as pending
       FROM images WHERE guild_id = $1`,
      [config.guild_id]
    );

    const { active, retired, pending } = stats.rows[0];
    const duelHours = Math.floor(config.duel_duration / 3600);
    const intervalHours = Math.floor(config.duel_interval / 3600);

    const embed = embedUtils.createBaseEmbed();
    embed.setTitle('⚙️ IdolDuel Admin Panel');
    embed.setDescription(
      `**Status:** ${config.duel_active ? (config.duel_paused ? '⏸️ Paused' : '✅ Active') : '❌ Stopped'}\n` +
      `**Schedule:** Every ${intervalHours}h, ${duelHours}h duration\n` +
      `**Season:** ${config.season_number}\n\n` +
      `📊 **Images:**\n` +
      `• Active: **${active}**\n` +
      `• Retired: **${retired}**\n` +
      `• Pending Approval: **${pending || 0}**\n\n` +
      `Use the dropdown below to navigate ♡`
    );

    // Dropdown menu for navigation
    const menuSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_menu_select')
      .setPlaceholder('📋 Select a section...')
      .addOptions([
        {
          label: 'Quick Setup',
          description: 'Essential settings to get started',
          value: 'quick_setup',
          emoji: '⚡'
        },
        {
          label: 'Approve Images',
          description: `${pending || 0} images waiting for approval`,
          value: 'approve_images',
          emoji: '✅'
        },
        {
          label: 'Schedule & Duration',
          description: 'When duels run and for how long',
          value: 'schedule_settings',
          emoji: '🕐'
        },
        {
          label: 'Auto-Import Settings',
          description: 'Which channels to watch for images',
          value: 'import_settings',
          emoji: '📥'
        },
        {
          label: 'Smart Retirement',
          description: 'Automatic image retirement settings',
          value: 'retirement_settings',
          emoji: '🤖'
        },
        {
          label: 'Advanced Settings',
          description: 'ELO, bonuses, and fine-tuning',
          value: 'advanced_settings',
          emoji: '⚙️'
        },
        {
          label: 'View Logs',
          description: 'Recent bot activity',
          value: 'view_logs',
          emoji: '📋'
        }
      ]);

    const menuRow = new ActionRowBuilder().addComponents(menuSelect);

    // Duel control buttons
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

    // Quick action buttons
    const quickRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_image_management')
          .setLabel('Browse Images')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🖼️'),
        new ButtonBuilder()
          .setCustomId('admin_approve_queue')
          .setLabel(`Approve (${pending || 0})`)
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅')
          .setDisabled(pending === 0)
      );

    await interaction.editReply({
      embeds: [embed],
      components: [menuRow, controlRow, quickRow]
    });
  },

  /**
   * Show quick setup (first-time setup wizard)
   */
  async showQuickSetup(interaction, config) {
    const embed = embedUtils.createBaseEmbed();
    embed.setTitle('⚡ Quick Setup');
    embed.setDescription(
      `Get started with IdolDuel in 3 easy steps!\n\n` +
      `**Current Setup:**\n` +
      `1️⃣ Duel Channel: ${config.duel_channel_id ? `<#${config.duel_channel_id}>` : '❌ Not set'}\n` +
      `2️⃣ Import Channel: ${config.import_channel_ids?.length > 0 ? '✅ Set' : '❌ Not set'}\n` +
      `3️⃣ Schedule: Every ${Math.floor(config.duel_interval / 3600)}h\n\n` +
      `Click the buttons below to configure each step.`
    );

    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_set_duel_channel')
          .setLabel('1. Set Duel Channel')
          .setStyle(config.duel_channel_id ? ButtonStyle.Success : ButtonStyle.Primary)
          .setEmoji('📺'),
        new ButtonBuilder()
          .setCustomId('admin_set_import_channel')
          .setLabel('2. Set Import Channel')
          .setStyle(config.import_channel_ids?.length > 0 ? ButtonStyle.Success : ButtonStyle.Primary)
          .setEmoji('📥'),
        new ButtonBuilder()
          .setCustomId('admin_set_schedule_preset')
          .setLabel('3. Set Schedule')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🕐')
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
   * Show schedule presets (simple selection)
   */
  async showSchedulePresets(interaction, config) {
    const embed = embedUtils.createBaseEmbed();
    embed.setTitle('🕐 Schedule Presets');
    embed.setDescription(
      `Choose how often duels should run.\n\n` +
      `**Current:** Every ${Math.floor(config.duel_interval / 3600)}h for ${Math.floor(config.duel_duration / 3600)}h\n\n` +
      `Select a preset below:`
    );

    const presetSelect = new StringSelectMenuBuilder()
      .setCustomId('schedule_preset_select')
      .setPlaceholder('Choose a schedule...')
      .addOptions([
        {
          label: 'Every 6 hours (4 per day)',
          description: '6h voting period, frequent engagement',
          value: 'preset_6h',
          emoji: '⚡'
        },
        {
          label: 'Every 12 hours (2 per day)',
          description: '12h voting period, balanced pace',
          value: 'preset_12h',
          emoji: '⭐'
        },
        {
          label: 'Every 24 hours (1 per day)',
          description: '24h voting period, casual pace',
          value: 'preset_24h',
          emoji: '🌙'
        },
        {
          label: 'Custom',
          description: 'Set your own schedule',
          value: 'preset_custom',
          emoji: '⚙️'
        }
      ]);

    const row1 = new ActionRowBuilder().addComponents(presetSelect);
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
   * Show smart retirement settings
   */
  async showRetirementSettings(interaction, config) {
    // Calculate smart retirement threshold based on schedule
    const duelsPerDay = 86400 / config.duel_interval;
    const smartLosses = Math.max(2, Math.floor(duelsPerDay * 1.5)); // 1.5 days worth

    const embed = embedUtils.createBaseEmbed();
    embed.setTitle('🤖 Smart Retirement');
    embed.setDescription(
      `Automatically retire underperforming images.\n\n` +
      `**Current Settings:**\n` +
      `• Mode: ${config.losses_before_retirement ? 'Manual' : '**Smart (Recommended)**'}\n` +
      `• Threshold: ${config.losses_before_retirement || `${smartLosses} losses (auto-calculated)`}\n` +
      `• Based on: ${Math.round(duelsPerDay * 10) / 10} duels per day\n\n` +
      `**Smart Mode** automatically adjusts retirement based on your duel frequency.\n` +
      `With ${Math.round(duelsPerDay * 10) / 10} duels/day, images retire after ${smartLosses} losses (≈1.5 days).`
    );

    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('retirement_enable_smart')
          .setLabel('Enable Smart Mode')
          .setStyle(config.losses_before_retirement ? ButtonStyle.Primary : ButtonStyle.Success)
          .setEmoji('🤖')
          .setDisabled(!config.losses_before_retirement),
        new ButtonBuilder()
          .setCustomId('retirement_set_manual')
          .setLabel('Set Manual Threshold')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⚙️')
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
   * Show import settings (auto-import channels)
   */
  async showImportSettings(interaction, config) {
    const channels = config.import_channel_ids || [];
    const channelList = channels.length > 0
      ? channels.map(id => `<#${id}>`).join(', ')
      : 'None set';

    const embed = embedUtils.createBaseEmbed();
    embed.setTitle('📥 Auto-Import Settings');
    embed.setDescription(
      `**How it works:**\n` +
      `1. Users post images in watched channels\n` +
      `2. Bot automatically imports them\n` +
      `3. ${config.auto_approve_images ? 'Images go live immediately' : 'You approve before they go live'}\n\n` +
      `**Watched Channels:** ${channelList}\n` +
      `**Auto-Approve:** ${config.auto_approve_images ? '✅ Enabled' : '❌ Disabled (manual approval)'}`
    );

    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_set_import_channel')
          .setLabel('Set Import Channels')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📥'),
        new ButtonBuilder()
          .setCustomId('import_toggle_auto_approve')
          .setLabel(config.auto_approve_images ? 'Disable Auto-Approve' : 'Enable Auto-Approve')
          .setStyle(config.auto_approve_images ? ButtonStyle.Danger : ButtonStyle.Success)
          .setEmoji('🤖')
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
   * Show advanced settings
   */
  async showAdvancedSettings(interaction, config) {
    const embed = embedUtils.createBaseEmbed();
    embed.setTitle('⚙️ Advanced Settings');
    embed.setDescription(
      `**ELO System:**\n` +
      `• Starting ELO: ${config.starting_elo}\n` +
      `• K-Factor: ${config.k_factor}\n\n` +
      `**Bonuses:**\n` +
      `• 2-win streak: +${(config.streak_bonus_2 * 100).toFixed(0)}%\n` +
      `• 3+ win streak: +${(config.streak_bonus_3 * 100).toFixed(0)}%\n` +
      `• Upset bonus: +${(config.upset_bonus * 100).toFixed(0)}%\n\n` +
      `**Other:**\n` +
      `• Minimum votes: ${config.min_votes}\n` +
      `• Wildcard chance: ${(config.wildcard_chance * 100).toFixed(1)}%`
    );

    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_set_starting_elo')
          .setLabel('Starting ELO')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('admin_set_k_factor')
          .setLabel('K-Factor')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('admin_set_min_votes')
          .setLabel('Min Votes')
          .setStyle(ButtonStyle.Secondary)
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
   * Calculate smart retirement threshold
   */
  getSmartRetirementThreshold(duelInterval) {
    const duelsPerDay = 86400 / duelInterval;
    // Retire after 1.5 days worth of losses, minimum 2
    return Math.max(2, Math.floor(duelsPerDay * 1.5));
  },

  // ========================================
  // MODAL CREATORS (same as before)
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
      .setLabel('Duration in hours')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 12')
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
      .setLabel('Interval in hours')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 12')
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
      .setTitle('Set Manual Retirement Threshold');

    const input = new TextInputBuilder()
      .setCustomId('losses_retirement')
      .setLabel('Consecutive losses before retirement')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 5')
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
      .setLabel('Duel Channel ID or URL')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Paste channel link or ID')
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
      .setLabel('Channel ID or URL')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Paste channel link or ID')
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
      .setLabel('Channel IDs or URLs (comma-separated)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Paste channel links, one per line or comma-separated')
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
  },

  /**
   * Execute function for slash command
   */
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const config = await this.getOrCreateConfig(interaction.guild.id);
      await this.showMainMenu(interaction, config);
    } catch (error) {
      console.error('Error executing config command:', error);
      const errorEmbed = embedUtils.createErrorEmbed('Failed to load admin panel.');
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
