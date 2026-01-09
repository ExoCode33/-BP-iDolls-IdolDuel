import { 
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags
} from 'discord.js';
import database from '../../database/database.js';
import embedUtils from '../../utils/embeds.js';
import storage from '../../services/storage.js';

export default {
  async execute(interaction) {
    // Check if user has admin role
    if (!this.isAdmin(interaction)) {
      const errorEmbed = embedUtils.createErrorEmbed('You need the admin role to use this command!');
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const guildId = interaction.guild.id;

      // Get or create guild config
      let config = await this.getOrCreateConfig(guildId);

      await this.showMainMenu(interaction, config);
    } catch (error) {
      console.error('Error in admin command:', error);
      const errorEmbed = embedUtils.createErrorEmbed('Failed to load admin panel. Please try again!');
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },

  isAdmin(interaction) {
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    return interaction.member.roles.cache.has(adminRoleId);
  },

  async getOrCreateConfig(guildId) {
    let result = await database.query(
      'SELECT * FROM guild_config WHERE guild_id = $1',
      [guildId]
    );

    if (result.rows.length === 0) {
      await database.query(
        'INSERT INTO guild_config (guild_id) VALUES ($1)',
        [guildId]
      );

      result = await database.query(
        'SELECT * FROM guild_config WHERE guild_id = $1',
        [guildId]
      );
    }

    return result.rows[0];
  },

  async showMainMenu(interaction, config) {
    const embed = embedUtils.createAdminConfigEmbed(config);

    const dropdown = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('admin_menu')
          .setPlaceholder('Select a section to manage')
          .addOptions([
            {
              label: '⚙️ Basic Settings',
              description: 'Configure channels and duel timing',
              value: 'basic_settings',
            },
            {
              label: '🎮 ELO Settings',
              description: 'Configure ELO calculation parameters',
              value: 'elo_settings',
            },
            {
              label: '🎲 Duel Controls',
              description: 'Start, stop, pause, or skip duels',
              value: 'duel_controls',
            },
            {
              label: '🖼️ Image Management',
              description: 'Import, list, and manage images',
              value: 'image_management',
            },
            {
              label: '🔄 Season Management',
              description: 'Reset season and manage archives',
              value: 'season_management',
            },
            {
              label: '📋 Admin Logs',
              description: 'View system events and errors',
              value: 'admin_logs',
            },
            {
              label: '⚠️ System Reset',
              description: 'Complete system wipe and restart (requires password)',
              value: 'system_reset',
            },
          ])
      );

    await interaction.editReply({ embeds: [embed], components: [dropdown] });
  },

  async handleBasicSettings(interaction, config) {
    await interaction.deferUpdate();

    const embed = embedUtils.createBaseEmbed();
    embed.setTitle('⚙️ Basic Settings');
    embed.setDescription(
      `\`\`\`css\n` +
      `[ Channel & Timing Configuration ]\n` +
      `\`\`\`\n` +
      `**Duel Channel:** ${config.duel_channel_id ? `<#${config.duel_channel_id}>` : 'Not set'}\n` +
      `**Log Channel:** ${config.log_channel_id ? `<#${config.log_channel_id}>` : 'Not set (logs disabled)'}\n` +
      `**Duel Duration:** ${config.duel_duration / 60} minutes\n` +
      `**Duel Interval:** ${config.duel_interval / 60} minutes\n` +
      `**Max Active Images:** ${config.max_active_images}\n\n` +
      `*Log channel receives notifications about duel starts, ends, errors, and image retirements.*\n\n` +
      `Use the buttons below to modify these settings ♡`
    );

    const buttons1 = new ActionRowBuilder()
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
          .setStyle(ButtonStyle.Danger)
          .setDisabled(!config.log_channel_id)
      );

    const buttons2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_set_duel_duration')
          .setLabel('Set Duel Duration')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('admin_set_duel_interval')
          .setLabel('Set Duel Interval')
          .setStyle(ButtonStyle.Secondary)
      );

    const backButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_back_main')
          .setLabel('◀ Back to Main Menu')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.editReply({ embeds: [embed], components: [buttons1, buttons2, backButton] });
  },

  async handleEloSettings(interaction, config) {
    await interaction.deferUpdate();

    const embed = embedUtils.createBaseEmbed();
    embed.setTitle('🎮 ELO Settings');
    embed.setDescription(
      `\`\`\`css\n` +
      `[ ELO Calculation Parameters ]\n` +
      `\`\`\`\n` +
      `**Starting ELO:** ${config.starting_elo}\n` +
      `**K-Factor:** ${config.k_factor}\n` +
      `**Min Votes for ELO:** ${config.min_votes}\n` +
      `**Streak Bonus (2 wins):** ${(config.streak_bonus_2 * 100).toFixed(0)}%\n` +
      `**Streak Bonus (3+ wins):** ${(config.streak_bonus_3 * 100).toFixed(0)}%\n` +
      `**Upset Bonus:** ${(config.upset_bonus * 100).toFixed(0)}%\n` +
      `**Wildcard Chance:** ${(config.wildcard_chance * 100).toFixed(0)}%\n` +
      `**Losses Before Retirement:** ${config.losses_before_retirement}\n\n` +
      `Use the buttons below to modify these settings ♡`
    );

    const buttons1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_set_k_factor')
          .setLabel('Set K-Factor')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_set_starting_elo')
          .setLabel('Set Starting ELO')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_set_min_votes')
          .setLabel('Set Min Votes')
          .setStyle(ButtonStyle.Primary)
      );

    const buttons2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_set_losses_retirement')
          .setLabel('Set Losses Before Retirement')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_set_wildcard_chance')
          .setLabel('Set Wildcard Chance')
          .setStyle(ButtonStyle.Primary)
      );

    const backButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_back_main')
          .setLabel('◀ Back to Main Menu')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.editReply({ embeds: [embed], components: [buttons1, buttons2, backButton] });
  },

  async handleDuelControls(interaction, config) {
    // Only defer if not already replied/deferred
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
    }

    const embed = embedUtils.createBaseEmbed();
    embed.setTitle('🎲 Duel Controls');
    embed.setDescription(
      `\`\`\`css\n` +
      `[ Manual Duel Management ]\n` +
      `\`\`\`\n` +
      `**Current Status:** ${config.duel_active ? '✅ Active' : '❌ Inactive'}\n` +
      `**Paused:** ${config.duel_paused ? 'Yes' : 'No'}\n\n` +
      `Use the buttons below to control duels manually ♡\n\n` +
      `⚠️ **Note:** Automatic scheduling is based on your interval settings.`
    );

    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_start_duel')
          .setLabel('▶ Start Duel Now')
          .setStyle(ButtonStyle.Success)
          .setDisabled(config.duel_active),
        new ButtonBuilder()
          .setCustomId('admin_stop_duel')
          .setLabel('⏹ Stop Current Duel')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(!config.duel_active),
        new ButtonBuilder()
          .setCustomId('admin_skip_duel')
          .setLabel('⏭ Skip to Next')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(!config.duel_active)
      );

    const buttons2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_pause_duel')
          .setLabel('⏸ Pause Scheduling')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(config.duel_paused),
        new ButtonBuilder()
          .setCustomId('admin_resume_duel')
          .setLabel('▶ Resume Scheduling')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(!config.duel_paused)
      );

    const backButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_back_main')
          .setLabel('◀ Back to Main Menu')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.editReply({ embeds: [embed], components: [buttons, buttons2, backButton] });
  },

  async handleSeasonManagement(interaction, config) {
    await interaction.deferUpdate();

    const embed = embedUtils.createBaseEmbed();
    embed.setTitle('🔄 Season Management');
    embed.setDescription(
      `\`\`\`css\n` +
      `[ Current Season Information ]\n` +
      `\`\`\`\n` +
      `**Current Season:** ${config.season_number}\n\n` +
      `⚠️ **Warning:** Resetting the season will:\n` +
      `• Soft reset all ELO ratings\n` +
      `• Archive current season data\n` +
      `• Remove low-ranking images\n` +
      `• Require password confirmation\n\n` +
      `This action cannot be undone! ♡`
    );

    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_reset_season')
          .setLabel('🔄 Reset Season')
          .setStyle(ButtonStyle.Danger)
      );

    const backButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_back_main')
          .setLabel('◀ Back to Main Menu')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.editReply({ embeds: [embed], components: [buttons, backButton] });
  },

  async handleSystemReset(interaction, config) {
    const systemReset = await import('./systemReset.js');
    await systemReset.default.showResetWarning(interaction);
  },

  // Modal creators
  createKFactorModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_k_factor')
      .setTitle('Set K-Factor');

    const input = new TextInputBuilder()
      .setCustomId('k_factor_input')
      .setLabel('K-Factor (default: 30)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('30')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(3);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  },

  createStartingEloModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_starting_elo')
      .setTitle('Set Starting ELO');

    const input = new TextInputBuilder()
      .setCustomId('starting_elo_input')
      .setLabel('Starting ELO (default: 1000)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('1000')
      .setRequired(true)
      .setMinLength(3)
      .setMaxLength(5);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  },

  createDuelDurationModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_duel_duration')
      .setTitle('Set Duel Duration');

    const input = new TextInputBuilder()
      .setCustomId('duel_duration_input')
      .setLabel('Duration in minutes (default: 30)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('30')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(4);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  },

  createDuelIntervalModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_duel_interval')
      .setTitle('Set Duel Interval');

    const input = new TextInputBuilder()
      .setCustomId('duel_interval_input')
      .setLabel('Interval in minutes (default: 30)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('30')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(4);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  },

  createMinVotesModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_min_votes')
      .setTitle('Set Minimum Votes');

    const input = new TextInputBuilder()
      .setCustomId('min_votes_input')
      .setLabel('Min votes for ELO change (default: 1)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('1')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(2);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  },

  createLossesRetirementModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_losses_retirement')
      .setTitle('Set Losses Before Retirement');

    const input = new TextInputBuilder()
      .setCustomId('losses_retirement_input')
      .setLabel('Number of losses (default: 3)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('3')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(2);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  },

  createWildcardChanceModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_wildcard_chance')
      .setTitle('Set Wildcard Chance');

    const input = new TextInputBuilder()
      .setCustomId('wildcard_chance_input')
      .setLabel('Percentage (0-100, default: 5)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('5')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(3);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  },

  createImportChannelsModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_import_channels')
      .setTitle('Import Images from Channels');

    const input = new TextInputBuilder()
      .setCustomId('import_channels_input')
      .setLabel('Channel IDs (comma-separated)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('123456789,987654321')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  },

  createEloThresholdModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_elo_threshold')
      .setTitle('Clear Images Below ELO');

    const input = new TextInputBuilder()
      .setCustomId('elo_threshold_input')
      .setLabel('ELO Threshold')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('800')
      .setRequired(true)
      .setMinLength(3)
      .setMaxLength(4);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  },

  createSeasonResetModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_season_reset')
      .setTitle('Confirm Season Reset');

    const input = new TextInputBuilder()
      .setCustomId('season_reset_password')
      .setLabel('Enter season reset password')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter password')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  },

  createDuelChannelModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_duel_channel')
      .setTitle('Set Duel Channel');

    const input = new TextInputBuilder()
      .setCustomId('duel_channel_input')
      .setLabel('Channel ID')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('123456789')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  },

  // NEW: Log channel modal
  createLogChannelModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_log_channel')
      .setTitle('Set Log Channel');

    const input = new TextInputBuilder()
      .setCustomId('log_channel_input')
      .setLabel('Channel ID for admin logs')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('123456789')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  },
};
