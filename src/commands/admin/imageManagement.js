import { 
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
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
    embed.setTitle('🖼️ Image Management');
    embed.setDescription(
      `**📊 Statistics**\n` +
      `Total: **${total}** images\n` +
      `Active: **${active}** • Retired: **${retired}**\n` +
      `Average ELO: **${Math.round(avg_elo || 0)}**\n` +
      `Range: **${min_elo || 0}** - **${max_elo || 0}**\n\n` +
      `Select a view below to manage images ♡`
    );

    const viewButtons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('start_gallery_view')
          .setLabel('🖼️ Gallery View')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🖼️'),
        new ButtonBuilder()
          .setCustomId('admin_import_images')
          .setLabel('Import Images')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📥'),
        new ButtonBuilder()
          .setCustomId('admin_export_stats')
          .setLabel('Export Stats')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📊')
      );

    const bulkButtons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('quick_bulk_retire')
          .setLabel('Bulk Retire Low ELO')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️'),
        new ButtonBuilder()
          .setCustomId('quick_bulk_unretire')
          .setLabel('Bulk Unretire High ELO')
          .setStyle(ButtonStyle.Success)
          .setEmoji('♻️')
          .setDisabled(parseInt(retired) === 0)
      );

    const backButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_back_main')
          .setLabel('◀ Back to Admin Menu')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.editReply({ 
      embeds: [embed], 
      components: [viewButtons, bulkButtons, backButton] 
    });
  },

  /**
   * Gallery view with smooth navigation
   */
  async showGallery(interaction, index = 0, sortBy = 'elo', filterActive = 'all') {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
    }

    const guildId = interaction.guild.id;

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

    // Get all images
    const result = await database.query(
      `SELECT id, elo, wins, losses, uploader_id, retired, imported_at, 
              current_streak, best_streak, total_votes_received, s3_key, retired_at
       FROM images 
       WHERE guild_id = $1 ${filterClause}
       ${sortClause}`,
      [guildId]
    );

    if (result.rows.length === 0) {
      const errorEmbed = embedUtils.createErrorEmbed('No images found. Import some images first!');
      await interaction.editReply({ embeds: [errorEmbed], components: [] });
      return;
    }

    const images = result.rows;
    const totalImages = images.length;

    // Clamp index
    if (index < 0) index = 0;
    if (index >= totalImages) index = totalImages - 1;

    const image = images[index];
    const imageUrl = await storage.getImageUrl(image.s3_key);
    const winRate = eloService.calculateWinRate(image.wins, image.losses);

    // Create beautiful embed
    const embed = new EmbedBuilder()
      .setColor(image.retired ? 0x808080 : 0x5865F2)
      .setTitle(`${image.retired ? '❌ RETIRED' : '✅ ACTIVE'} • Image #${image.id}`)
      .setDescription(
        `${eloService.getRankEmoji(image.elo)} **ELO ${image.elo}** • Rank #${index + 1} of ${totalImages}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `**Record:** ${image.wins}W - ${image.losses}L (${winRate}% win rate)\n` +
        `**Streaks:** ${image.current_streak}🔥 current • ${image.best_streak}⭐ best\n` +
        `**Votes:** ${image.total_votes_received} total received\n` +
        `**Uploader:** <@${image.uploader_id}>\n` +
        `**Added:** <t:${Math.floor(new Date(image.imported_at).getTime() / 1000)}:R>\n` +
        `${image.retired ? `**Retired:** <t:${Math.floor(new Date(image.retired_at).getTime() / 1000)}:R>` : ''}`
      )
      .setImage(imageUrl)
      .setFooter({ text: `Viewing ${index + 1} of ${totalImages} • Use arrows to navigate` });

    // Navigation row - clean and simple
    const navRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('gallery_first')
          .setEmoji('⏮️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(index === 0),
        new ButtonBuilder()
          .setCustomId('gallery_prev')
          .setEmoji('◀️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(index === 0),
        new ButtonBuilder()
          .setCustomId('gallery_info')
          .setLabel(`${index + 1}/${totalImages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('gallery_next')
          .setEmoji('▶️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(index === totalImages - 1),
        new ButtonBuilder()
          .setCustomId('gallery_last')
          .setEmoji('⏭️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(index === totalImages - 1)
      );

    // Quick actions row - one click operations
    const actionRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('gallery_toggle_retire')
          .setLabel(image.retired ? 'Unretire' : 'Retire')
          .setEmoji(image.retired ? '♻️' : '🗑️')
          .setStyle(image.retired ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('gallery_delete_confirm')
          .setLabel('Delete')
          .setEmoji('🔥')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('gallery_jump')
          .setLabel('Jump')
          .setEmoji('🔢')
          .setStyle(ButtonStyle.Secondary)
      );

    // View controls - sort and filter
    const sortSelect = new StringSelectMenuBuilder()
      .setCustomId('gallery_sort')
      .setPlaceholder('📊 Sort by...')
      .addOptions([
        { label: '⭐ Highest ELO', value: 'elo', default: sortBy === 'elo', emoji: '⭐' },
        { label: '🏆 Most Wins', value: 'wins', default: sortBy === 'wins', emoji: '🏆' },
        { label: '💔 Most Losses', value: 'losses', default: sortBy === 'losses', emoji: '💔' },
        { label: '🆕 Newest First', value: 'recent', default: sortBy === 'recent', emoji: '🆕' },
        { label: '⏰ Oldest First', value: 'oldest', default: sortBy === 'oldest', emoji: '⏰' }
      ]);

    const filterSelect = new StringSelectMenuBuilder()
      .setCustomId('gallery_filter')
      .setPlaceholder('🔍 Filter...')
      .addOptions([
        { label: '📋 All Images', value: 'all', default: filterActive === 'all', emoji: '📋' },
        { label: '✅ Active Only', value: 'active', default: filterActive === 'active', emoji: '✅' },
        { label: '❌ Retired Only', value: 'retired', default: filterActive === 'retired', emoji: '❌' }
      ]);

    const controlRow1 = new ActionRowBuilder().addComponents(sortSelect);
    const controlRow2 = new ActionRowBuilder().addComponents(filterSelect);

    // Exit row
    const exitRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('gallery_exit')
          .setLabel('Exit Gallery')
          .setEmoji('🚪')
          .setStyle(ButtonStyle.Secondary)
      );

    // Store state
    const state = { index, sortBy, filterActive, imageId: image.id };

    await interaction.editReply({
      embeds: [embed],
      components: [navRow, actionRow, controlRow1, controlRow2, exitRow],
      content: `__GALLERY:${JSON.stringify(state)}__`
    });
  },

  /**
   * Show delete confirmation inline
   */
  async showDeleteConfirmation(interaction, imageId, state) {
    await interaction.deferUpdate();

    const guildId = interaction.guild.id;
    
    const result = await database.query(
      'SELECT s3_key FROM images WHERE guild_id = $1 AND id = $2',
      [guildId, imageId]
    );

    if (result.rows.length === 0) {
      const errorEmbed = embedUtils.createErrorEmbed('Image not found.');
      await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('⚠️ Confirm Deletion')
      .setDescription(
        `**Are you sure you want to permanently delete image #${imageId}?**\n\n` +
        `This action:\n` +
        `• Deletes from S3 storage\n` +
        `• Removes from database\n` +
        `• Deletes all votes & captions\n` +
        `• **CANNOT BE UNDONE**\n\n` +
        `Click "Yes, Delete" to confirm or "Cancel" to go back.`
      );

    const confirmRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('gallery_delete_yes')
          .setLabel('Yes, Delete Forever')
          .setEmoji('🔥')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('gallery_delete_cancel')
          .setLabel('Cancel')
          .setEmoji('❌')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.editReply({
      embeds: [embed],
      components: [confirmRow],
      content: `__GALLERY:${JSON.stringify(state)}__`
    });
  },

  /**
   * Quick bulk retire with preset thresholds
   */
  async showQuickBulkRetire(interaction) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
    }

    const embed = embedUtils.createBaseEmbed();
    embed.setTitle('🗑️ Quick Bulk Retire');
    embed.setDescription(
      `Select an ELO threshold below to retire all images below that ELO.\n\n` +
      `**Common Thresholds:**\n` +
      `• **800** - Remove very low performers\n` +
      `• **900** - Remove below average\n` +
      `• **1000** - Remove starting ELO and below\n\n` +
      `You can also enter a custom threshold.`
    );

    const thresholdRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('bulk_retire_800')
          .setLabel('Below 800')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('bulk_retire_900')
          .setLabel('Below 900')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('bulk_retire_1000')
          .setLabel('Below 1000')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('bulk_retire_custom')
          .setLabel('Custom')
          .setStyle(ButtonStyle.Secondary)
      );

    const backRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_back_image_mgmt')
          .setLabel('◀ Back')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.editReply({
      embeds: [embed],
      components: [thresholdRow, backRow]
    });
  },

  /**
   * Quick bulk unretire with preset thresholds
   */
  async showQuickBulkUnretire(interaction) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
    }

    const embed = embedUtils.createBaseEmbed();
    embed.setTitle('♻️ Quick Bulk Unretire');
    embed.setDescription(
      `Select an ELO threshold below to unretire all retired images above that ELO.\n\n` +
      `**Common Thresholds:**\n` +
      `• **1000** - Unretire average and above\n` +
      `• **1100** - Unretire above average\n` +
      `• **1200** - Unretire good performers\n\n` +
      `You can also enter a custom threshold.`
    );

    const thresholdRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('bulk_unretire_1000')
          .setLabel('Above 1000')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('bulk_unretire_1100')
          .setLabel('Above 1100')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('bulk_unretire_1200')
          .setLabel('Above 1200')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('bulk_unretire_custom')
          .setLabel('Custom')
          .setStyle(ButtonStyle.Secondary)
      );

    const backRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_back_image_mgmt')
          .setLabel('◀ Back')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.editReply({
      embeds: [embed],
      components: [thresholdRow, backRow]
    });
  },

  /**
   * Execute bulk retire
   */
  async executeBulkRetire(interaction, threshold) {
    await interaction.deferUpdate();

    const guildId = interaction.guild.id;

    const countResult = await database.query(
      'SELECT COUNT(*) as total FROM images WHERE guild_id = $1 AND elo < $2 AND retired = false',
      [guildId, threshold]
    );

    const count = parseInt(countResult.rows[0].total);

    if (count === 0) {
      const embed = embedUtils.createSuccessEmbed(`No images found with ELO below ${threshold}.`);
      await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    // Retire them
    await database.query(
      'UPDATE images SET retired = true, retired_at = NOW() WHERE guild_id = $1 AND elo < $2 AND retired = false',
      [guildId, threshold]
    );

    // Log
    await database.query(
      `INSERT INTO logs (guild_id, action_type, admin_id, details)
       VALUES ($1, 'bulk_retire', $2, $3)`,
      [guildId, interaction.user.id, JSON.stringify({ threshold, count })]
    );

    const embed = embedUtils.createSuccessEmbed(
      `✅ Retired **${count}** image(s) with ELO below ${threshold}!`
    );

    await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });

    // Go back to image management
    const config = await database.query(
      'SELECT * FROM guild_config WHERE guild_id = $1',
      [guildId]
    );
    await this.showImageManagement(interaction, config.rows[0]);
  },

  /**
   * Execute bulk unretire
   */
  async executeBulkUnretire(interaction, threshold) {
    await interaction.deferUpdate();

    const guildId = interaction.guild.id;

    const countResult = await database.query(
      'SELECT COUNT(*) as total FROM images WHERE guild_id = $1 AND elo >= $2 AND retired = true',
      [guildId, threshold]
    );

    const count = parseInt(countResult.rows[0].total);

    if (count === 0) {
      const embed = embedUtils.createSuccessEmbed(`No retired images found with ELO above ${threshold}.`);
      await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    // Unretire them
    await database.query(
      'UPDATE images SET retired = false, retired_at = NULL WHERE guild_id = $1 AND elo >= $2 AND retired = true',
      [guildId, threshold]
    );

    // Log
    await database.query(
      `INSERT INTO logs (guild_id, action_type, admin_id, details)
       VALUES ($1, 'bulk_unretire', $2, $3)`,
      [guildId, interaction.user.id, JSON.stringify({ threshold, count })]
    );

    const embed = embedUtils.createSuccessEmbed(
      `✅ Unretired **${count}** image(s) with ELO above ${threshold}!`
    );

    await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });

    // Go back to image management
    const config = await database.query(
      'SELECT * FROM guild_config WHERE guild_id = $1',
      [guildId]
    );
    await this.showImageManagement(interaction, config.rows[0]);
  }
};
