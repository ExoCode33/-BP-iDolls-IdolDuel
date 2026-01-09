import { 
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
import storage from '../../services/storage.js';
import eloService from '../../services/elo.js';

export default {
  /**
   * Show main image management interface
   */
  async showImageManagement(interaction, config) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
    }

    const guildId = interaction.guild.id;

    // Get image statistics
    const stats = await database.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE retired = false) as active,
        COUNT(*) FILTER (WHERE retired = true) as retired,
        AVG(elo) FILTER (WHERE retired = false) as avg_elo,
        MAX(elo) FILTER (WHERE retired = false) as max_elo,
        MIN(elo) FILTER (WHERE retired = false) as min_elo
       FROM images
       WHERE guild_id = $1`,
      [guildId]
    );

    const { total, active, retired, avg_elo, max_elo, min_elo } = stats.rows[0];

    const embed = embedUtils.createBaseEmbed();
    embed.setTitle('━━━━━ 🖼️ Image Management ━━━━━');
    embed.setDescription(
      `**Image Statistics**\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `**Total Images:** ${total}\n` +
      `**Active:** ${active}  •  **Retired:** ${retired}\n` +
      `**Average ELO:** ${Math.round(avg_elo || 0)}\n` +
      `**Range:** ${min_elo || 0} - ${max_elo || 0}\n` +
      `**Max Active:** ${config.max_active_images}\n\n` +
      `*Select an action below*`
    );

    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_import_images')
          .setLabel('📥 Import Images')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('admin_browse_images')
          .setLabel('📋 Browse All Images')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_filter_images')
          .setLabel('🔍 Filter Images')
          .setStyle(ButtonStyle.Secondary)
      );

    const buttons2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_bulk_retire')
          .setLabel('🗑️ Bulk Retire')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('admin_export_stats')
          .setLabel('📊 Export Stats')
          .setStyle(ButtonStyle.Secondary)
      );

    const backButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_back_main')
          .setLabel('◀ Back to Main Menu')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.editReply({ 
      embeds: [embed], 
      components: [buttons, buttons2, backButton] 
    });
  },

  /**
   * Browse all images with pagination (25 per page)
   */
  async browseImages(interaction, page = 1, sortBy = 'elo', filterActive = 'all') {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
    }

    const guildId = interaction.guild.id;
    const itemsPerPage = 25;
    const offset = (page - 1) * itemsPerPage;

    // Build filter query
    let filterClause = '';
    if (filterActive === 'active') filterClause = 'AND retired = false';
    if (filterActive === 'retired') filterClause = 'AND retired = true';

    // Build sort clause
    let sortClause = 'ORDER BY elo DESC';
    if (sortBy === 'wins') sortClause = 'ORDER BY wins DESC';
    if (sortBy === 'losses') sortClause = 'ORDER BY losses DESC';
    if (sortBy === 'recent') sortClause = 'ORDER BY imported_at DESC';
    if (sortBy === 'oldest') sortClause = 'ORDER BY imported_at ASC';

    // Get total count
    const countResult = await database.query(
      `SELECT COUNT(*) as total FROM images WHERE guild_id = $1 ${filterClause}`,
      [guildId]
    );
    const totalItems = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Get images for current page
    const result = await database.query(
      `SELECT id, elo, wins, losses, uploader_id, retired, imported_at, current_streak
       FROM images 
       WHERE guild_id = $1 ${filterClause}
       ${sortClause}
       LIMIT $2 OFFSET $3`,
      [guildId, itemsPerPage, offset]
    );

    if (result.rows.length === 0) {
      const errorEmbed = embedUtils.createErrorEmbed('No images found with the current filters.');
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    const embed = embedUtils.createBaseEmbed();
    embed.setTitle(`━━━━━ 📋 Image Browser ━━━━━`);
    embed.setDescription(
      `**Page ${page} of ${totalPages}** (${totalItems} images)\n` +
      `**Sort:** ${sortBy}  •  **Filter:** ${filterActive}\n` +
      `━━━━━━━━━━━━━━━━━━━\n`
    );

    // Create compact list
    const imageList = result.rows.map((img, idx) => {
      const globalIndex = offset + idx + 1;
      const status = img.retired ? '❌' : '✅';
      const rankEmoji = eloService.getRankEmoji(img.elo);
      const winRate = eloService.calculateWinRate(img.wins, img.losses);
      return `\`${globalIndex.toString().padStart(3, ' ')}.\` ${status} ${rankEmoji} **${img.elo}** | ${img.wins}W-${img.losses}L (${winRate}%) | <@${img.uploader_id}>`;
    }).join('\n');

    embed.setDescription(embed.data.description + imageList);
    embed.setFooter({ text: `Click image ID to view details • Use buttons to navigate` });

    // Create navigation buttons
    const navButtons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`browse_images_first`)
          .setLabel('⏮️ First')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 1),
        new ButtonBuilder()
          .setCustomId(`browse_images_prev`)
          .setLabel('◀ Prev')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 1),
        new ButtonBuilder()
          .setCustomId(`browse_images_page`)
          .setLabel(`${page}/${totalPages}`)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`browse_images_next`)
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === totalPages),
        new ButtonBuilder()
          .setCustomId(`browse_images_last`)
          .setLabel('Last ⏭️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === totalPages)
      );

    // Sort and filter controls
    const sortMenu = new StringSelectMenuBuilder()
      .setCustomId('browse_images_sort')
      .setPlaceholder('Sort by...')
      .addOptions([
        { label: 'ELO (High to Low)', value: 'elo', default: sortBy === 'elo' },
        { label: 'Most Wins', value: 'wins', default: sortBy === 'wins' },
        { label: 'Most Losses', value: 'losses', default: sortBy === 'losses' },
        { label: 'Recently Added', value: 'recent', default: sortBy === 'recent' },
        { label: 'Oldest First', value: 'oldest', default: sortBy === 'oldest' }
      ]);

    const filterMenu = new StringSelectMenuBuilder()
      .setCustomId('browse_images_filter')
      .setPlaceholder('Filter...')
      .addOptions([
        { label: 'All Images', value: 'all', default: filterActive === 'all' },
        { label: 'Active Only', value: 'active', default: filterActive === 'active' },
        { label: 'Retired Only', value: 'retired', default: filterActive === 'retired' }
      ]);

    const controlRow1 = new ActionRowBuilder().addComponents(sortMenu);
    const controlRow2 = new ActionRowBuilder().addComponents(filterMenu);

    const backButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_back_image_mgmt')
          .setLabel('◀ Back')
          .setStyle(ButtonStyle.Secondary)
      );

    // Store state in content for navigation
    const stateData = JSON.stringify({ page, sortBy, filterActive });

    await interaction.editReply({ 
      embeds: [embed], 
      components: [navButtons, controlRow1, controlRow2, backButton],
      content: `__BROWSE_STATE:${stateData}__`
    });
  },

  /**
   * Show filter/search interface
   */
  async showFilterInterface(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('modal_filter_images')
      .setTitle('Filter Images');

    const eloMinInput = new TextInputBuilder()
      .setCustomId('elo_min')
      .setLabel('Minimum ELO (optional)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 800')
      .setRequired(false);

    const eloMaxInput = new TextInputBuilder()
      .setCustomId('elo_max')
      .setLabel('Maximum ELO (optional)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 1500')
      .setRequired(false);

    const uploaderInput = new TextInputBuilder()
      .setCustomId('uploader_id')
      .setLabel('Uploader ID (optional)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Discord user ID')
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(eloMinInput),
      new ActionRowBuilder().addComponents(eloMaxInput),
      new ActionRowBuilder().addComponents(uploaderInput)
    );

    await interaction.showModal(modal);
  },

  /**
   * Handle filter results
   */
  async handleFilterResults(interaction, filters) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { eloMin, eloMax, uploaderId } = filters;
    const guildId = interaction.guild.id;

    let whereClauses = ['guild_id = $1'];
    let params = [guildId];
    let paramIndex = 2;

    if (eloMin) {
      whereClauses.push(`elo >= $${paramIndex}`);
      params.push(parseInt(eloMin));
      paramIndex++;
    }

    if (eloMax) {
      whereClauses.push(`elo <= $${paramIndex}`);
      params.push(parseInt(eloMax));
      paramIndex++;
    }

    if (uploaderId) {
      whereClauses.push(`uploader_id = $${paramIndex}`);
      params.push(uploaderId);
      paramIndex++;
    }

    const whereClause = whereClauses.join(' AND ');

    const result = await database.query(
      `SELECT COUNT(*) as total,
              COUNT(*) FILTER (WHERE retired = false) as active,
              AVG(elo) as avg_elo
       FROM images
       WHERE ${whereClause}`,
      params
    );

    const { total, active, avg_elo } = result.rows[0];

    const embed = embedUtils.createBaseEmbed();
    embed.setTitle('━━━━━ 🔍 Filter Results ━━━━━');
    embed.setDescription(
      `**Filters Applied:**\n` +
      `${eloMin ? `• Min ELO: ${eloMin}\n` : ''}` +
      `${eloMax ? `• Max ELO: ${eloMax}\n` : ''}` +
      `${uploaderId ? `• Uploader: <@${uploaderId}>\n` : ''}` +
      `\n**Results:**\n` +
      `Total: ${total}  •  Active: ${active}\n` +
      `Average ELO: ${Math.round(avg_elo || 0)}`
    );

    await interaction.editReply({ embeds: [embed] });
  },

  /**
   * Show bulk retire interface
   */
  async showBulkRetire(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('modal_bulk_retire')
      .setTitle('Bulk Retire Images');

    const thresholdInput = new TextInputBuilder()
      .setCustomId('elo_threshold')
      .setLabel('Retire all images below this ELO')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 800')
      .setRequired(true);

    const confirmInput = new TextInputBuilder()
      .setCustomId('confirm_text')
      .setLabel('Type CONFIRM to proceed')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('CONFIRM')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(thresholdInput),
      new ActionRowBuilder().addComponents(confirmInput)
    );

    await interaction.showModal(modal);
  }
};
