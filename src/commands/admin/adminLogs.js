import { 
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags
} from 'discord.js';
import database from '../../database/database.js';
import embedUtils from '../../utils/embeds.js';

export default {
  /**
   * Show admin logs interface
   */
  async showAdminLogs(interaction, page = 1, filterType = 'all') {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
    }

    const guildId = interaction.guild.id;
    const itemsPerPage = 10;
    const offset = (page - 1) * itemsPerPage;

    // Build filter
    let filterClause = '';
    if (filterType !== 'all') {
      filterClause = `AND action_type = '${filterType}'`;
    }

    // Get total count
    const countResult = await database.query(
      `SELECT COUNT(*) as total FROM logs WHERE guild_id = $1 ${filterClause}`,
      [guildId]
    );
    const totalItems = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Get logs
    const result = await database.query(
      `SELECT * FROM logs 
       WHERE guild_id = $1 ${filterClause}
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [guildId, itemsPerPage, offset]
    );

    const embed = embedUtils.createBaseEmbed();
    embed.setTitle('━━━━━ 📋 Admin Logs ━━━━━');
    embed.setDescription(
      `**Page ${page} of ${totalPages}** (${totalItems} events)\n` +
      `**Filter:** ${filterType}\n` +
      `━━━━━━━━━━━━━━━━━━━\n`
    );

    if (result.rows.length === 0) {
      embed.setDescription(embed.data.description + '\n*No logs found*');
    } else {
      result.rows.forEach((log, idx) => {
        const timestamp = Math.floor(new Date(log.created_at).getTime() / 1000);
        const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
        const detailsPreview = JSON.stringify(details).substring(0, 50);
        
        const typeEmojis = {
          'duel_started': '▶️',
          'duel_ended': '⏹️',
          'duel_skipped': '⏭️',
          'duel_error': '❌',
          'image_retired': '🗑️',
          'season_reset': '🔄',
          'system_reset': '⚠️'
        };
        
        const emoji = typeEmojis[log.action_type] || '📝';
        
        embed.addFields({
          name: `${emoji} ${log.action_type.replace(/_/g, ' ')}`,
          value: `<t:${timestamp}:R> • \`${detailsPreview}...\``,
          inline: false
        });
      });
    }

    // Navigation buttons
    const navButtons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('logs_prev')
          .setLabel('◀ Prev')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 1),
        new ButtonBuilder()
          .setCustomId('logs_page')
          .setLabel(`${page}/${totalPages}`)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('logs_next')
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === totalPages),
        new ButtonBuilder()
          .setCustomId('logs_refresh')
          .setLabel('🔄 Refresh')
          .setStyle(ButtonStyle.Success)
      );

    // Filter menu
    const filterMenu = new StringSelectMenuBuilder()
      .setCustomId('logs_filter')
      .setPlaceholder('Filter by type...')
      .addOptions([
        { label: 'All Events', value: 'all', default: filterType === 'all' },
        { label: 'Duel Started', value: 'duel_started', default: filterType === 'duel_started' },
        { label: 'Duel Ended', value: 'duel_ended', default: filterType === 'duel_ended' },
        { label: 'Duel Skipped', value: 'duel_skipped', default: filterType === 'duel_skipped' },
        { label: 'Errors', value: 'duel_error', default: filterType === 'duel_error' },
        { label: 'Image Retired', value: 'image_retired', default: filterType === 'image_retired' }
      ]);

    const filterRow = new ActionRowBuilder().addComponents(filterMenu);

    const backButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_back_main')
          .setLabel('◀ Back')
          .setStyle(ButtonStyle.Secondary)
      );

    // Store state
    const stateData = JSON.stringify({ page, filterType });

    await interaction.editReply({ 
      embeds: [embed], 
      components: [navButtons, filterRow, backButton],
      content: `__LOGS_STATE:${stateData}__`
    });
  },

  /**
   * Export logs to text file
   */
  async exportLogs(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guildId = interaction.guild.id;

    const result = await database.query(
      `SELECT * FROM logs 
       WHERE guild_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1000`,
      [guildId]
    );

    if (result.rows.length === 0) {
      const errorEmbed = embedUtils.createErrorEmbed('No logs found to export.');
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    // Format logs as text
    let logText = '=== IDOLDUEL ADMIN LOGS ===\n\n';
    
    result.rows.forEach((log, idx) => {
      const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
      logText += `[${log.created_at}] ${log.action_type}\n`;
      logText += `Details: ${JSON.stringify(details, null, 2)}\n`;
      logText += '---\n\n';
    });

    // Create file
    const buffer = Buffer.from(logText, 'utf-8');
    const attachment = {
      attachment: buffer,
      name: `admin-logs-${Date.now()}.txt`
    };

    const embed = embedUtils.createSuccessEmbed(
      `Exported ${result.rows.length} log entries.\nCheck the attached file.`
    );

    await interaction.editReply({ embeds: [embed], files: [attachment] });
  }
};
