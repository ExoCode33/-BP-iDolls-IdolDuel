/**
 * Complete Interaction Handler
 * Enhanced image browser with filters (ELO/User) and fixed pagination
 * FIXED: BigInt handling throughout + Admin panel updates
 */

import database from '../database/database.js';
import duelManager from '../services/duel/manager.js';
import importer from '../services/image/importer.js';
import storage from '../services/image/storage.js';
import embedUtils from '../utils/embeds.js';
import systemReset from '../commands/admin/systemReset.js';
import { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';

export async function handleInteractions(interaction) {
  if (interaction.isButton()) {
    await handleButton(interaction);
    return;
  }

  if (interaction.isModalSubmit()) {
    await handleModal(interaction);
    return;
  }

  if (interaction.isStringSelectMenu()) {
    await handleSelectMenu(interaction);
    return;
  }
}

/**
 * Auto-delete ephemeral message after delay
 */
async function autoDeleteEphemeral(interaction, delay = 3000) {
  setTimeout(async () => {
    try {
      await interaction.deleteReply();
    } catch (error) {
      // Silently fail
    }
  }, delay);
}

/**
 * Handle button clicks
 */
async function handleButton(interaction) {
  const customId = interaction.customId;

  // Admin refresh panel
  if (customId === 'admin_refresh_panel') {
    const adminCommand = (await import('../commands/admin/admin.js')).default;
    await adminCommand.showAdminPanel(interaction, true);
    return;
  }

  // Vote buttons
  if (customId.startsWith('vote_')) {
    await handleVote(interaction);
    return;
  }

  // Image browser navigation
  if (customId.startsWith('browse_')) {
    await handleBrowseNavigation(interaction);
    return;
  }

  // Image actions
  if (customId.startsWith('image_delete_')) {
    await handleImageDelete(interaction);
    return;
  }

  if (customId.startsWith('image_retire_')) {
    await handleImageRetire(interaction);
    return;
  }

  if (customId.startsWith('image_unretire_')) {
    await handleImageUnretire(interaction);
    return;
  }

  // Duel controls
  if (customId === 'admin_start_duel') {
    await handleStartDuel(interaction);
    return;
  }

  if (customId === 'admin_stop_duel') {
    await handleStopDuel(interaction);
    return;
  }

  if (customId === 'admin_skip_duel') {
    await handleSkipDuel(interaction);
    return;
  }

  if (customId === 'admin_pause_duel') {
    await handlePauseDuel(interaction);
    return;
  }

  if (customId === 'admin_resume_duel') {
    await handleResumeDuel(interaction);
    return;
  }

  // Settings modals
  if (customId === 'admin_edit_schedule') {
    await showScheduleModal(interaction);
    return;
  }

  if (customId === 'admin_edit_elo') {
    await showEloModal(interaction);
    return;
  }

  if (customId === 'admin_edit_retirement') {
    await showRetirementModal(interaction);
    return;
  }

  if (customId === 'admin_import_images') {
    await showImportModal(interaction);
    return;
  }

  // Browse images
  if (customId === 'admin_browse_images') {
    await showImageBrowser(interaction, 0, 'elo', null);
    return;
  }

  // System reset
  if (customId === 'admin_system_reset') {
    await systemReset.showResetWarning(interaction);
    return;
  }

  if (customId === 'confirm_system_reset') {
    await systemReset.showPasswordModal(interaction);
    return;
  }

  if (customId === 'cancel_system_reset') {
    const embed = embedUtils.createSuccessEmbed('System reset cancelled.');
    await interaction.update({ embeds: [embed], components: [] });
    autoDeleteEphemeral(interaction);
    return;
  }
}

/**
 * Handle select menu
 */
async function handleSelectMenu(interaction) {
  const customId = interaction.customId;

  if (customId.startsWith('browse_filter_')) {
    await handleBrowseFilter(interaction);
    return;
  }

  if (customId.startsWith('browse_user_')) {
    await handleBrowseUserSelect(interaction);
    return;
  }
}

/**
 * Handle browse filter change
 */
async function handleBrowseFilter(interaction) {
  const parts = interaction.customId.split('_');
  const page = parseInt(parts[2]);
  const currentUserId = parts[3] || null;
  
  const selectedFilter = interaction.values[0];

  if (selectedFilter === 'by_user') {
    await showUserSelectMenu(interaction, page);
  } else {
    await showImageBrowser(interaction, 0, selectedFilter, null);
  }
}

/**
 * Show user select menu
 * FIXED: BigInt handling
 */
async function showUserSelectMenu(interaction, page = 0) {
  // FIXED: Convert BigInt to string
  const guildId = interaction.guild.id.toString();

  // Get all unique uploaders
  const usersResult = await database.query(
    `SELECT DISTINCT uploader_id, COUNT(*) as image_count
     FROM images 
     WHERE guild_id = $1
     GROUP BY uploader_id
     ORDER BY image_count DESC
     LIMIT 25`,
    [guildId]
  );

  if (usersResult.rows.length === 0) {
    const embed = embedUtils.createErrorEmbed('No users found!');
    await interaction.update({ embeds: [embed], components: [] });
    return;
  }

  const embed = embedUtils.createBaseEmbed();
  embed.setTitle('🔍 Select User to Filter');
  embed.setDescription('Choose a user to view only their images:');

  const options = [];
  for (const user of usersResult.rows) {
    try {
      const member = await interaction.guild.members.fetch(user.uploader_id);
      options.push({
        label: member.user.username,
        description: `${user.image_count} images`,
        value: user.uploader_id
      });
    } catch (error) {
      // User left server
      options.push({
        label: `User ${user.uploader_id}`,
        description: `${user.image_count} images`,
        value: user.uploader_id
      });
    }
  }

  const userSelect = new StringSelectMenuBuilder()
    .setCustomId(`browse_user_${page}`)
    .setPlaceholder('Select a user...')
    .addOptions(options);

  const selectRow = new ActionRowBuilder().addComponents(userSelect);

  const backButton = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('admin_browse_images')
        .setLabel('◀ Back to All Images')
        .setStyle(ButtonStyle.Secondary)
    );

  await interaction.update({
    embeds: [embed],
    components: [selectRow, backButton]
  });
}

/**
 * Handle user selection
 */
async function handleBrowseUserSelect(interaction) {
  const parts = interaction.customId.split('_');
  const page = parseInt(parts[2]);
  const selectedUserId = interaction.values[0];

  await showImageBrowser(interaction, 0, 'user', selectedUserId);
}

/**
 * Show image browser with filters
 * FIXED: BigInt handling for guildId and userId
 */
async function showImageBrowser(interaction, page = 0, sortBy = 'elo', userId = null) {
  const isUpdate = interaction.deferred || interaction.replied;
  
  if (!isUpdate) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }

  try {
    // FIXED: Convert BigInt to string
    const guildId = interaction.guild.id.toString();
    const limit = 1; // Show 1 image per page for better UX
    const offset = page * limit;

    // Build query based on filter
    let query = 'SELECT * FROM images WHERE guild_id = $1';
    let queryParams = [guildId];
    let orderBy = 'elo DESC';

    if (userId) {
      query += ' AND uploader_id = $2';
      // FIXED: Ensure userId is string
      queryParams.push(typeof userId === 'bigint' ? userId.toString() : String(userId));
      orderBy = 'elo DESC';
    }

    switch (sortBy) {
      case 'elo':
        orderBy = 'elo DESC';
        break;
      case 'wins':
        orderBy = 'wins DESC';
        break;
      case 'losses':
        orderBy = 'losses DESC';
        break;
      case 'recent':
        orderBy = 'imported_at DESC';
        break;
    }

    query += ` ORDER BY ${orderBy} LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const imagesResult = await database.query(query, queryParams);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM images WHERE guild_id = $1';
    let countParams = [guildId];
    
    if (userId) {
      countQuery += ' AND uploader_id = $2';
      countParams.push(typeof userId === 'bigint' ? userId.toString() : String(userId));
    }

    const totalResult = await database.query(countQuery, countParams);
    const totalImages = parseInt(totalResult.rows[0].total);
    const totalPages = Math.ceil(totalImages / limit);

    if (imagesResult.rows.length === 0) {
      const embed = embedUtils.createErrorEmbed('No images found with this filter!');
      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }

    const currentImage = imagesResult.rows[0];
    const imageUrl = await storage.getImageUrl(currentImage.s3_key);

    // Get uploader name - FIXED: Ensure uploader_id is string
    let uploaderName = 'Unknown User';
    try {
      const uploaderId = currentImage.uploader_id.toString();
      const member = await interaction.guild.members.fetch(uploaderId);
      uploaderName = member.user.username;
    } catch (error) {
      uploaderName = `User ${currentImage.uploader_id}`;
    }

    // Create embed
    const embed = embedUtils.createBaseEmbed();
    
    let filterText = '';
    switch (sortBy) {
      case 'elo':
        filterText = 'Sorted by ELO';
        break;
      case 'wins':
        filterText = 'Sorted by Wins';
        break;
      case 'losses':
        filterText = 'Sorted by Losses';
        break;
      case 'recent':
        filterText = 'Sorted by Recent';
        break;
      case 'user':
        filterText = `By User: ${uploaderName}`;
        break;
    }

    embed.setTitle(`🖼️ Image Browser - Image #${currentImage.id}`);
    embed.setDescription(
      `**ELO:** ${currentImage.elo} ${currentImage.elo >= 1200 ? '🏆' : currentImage.elo <= 800 ? '💀' : ''}\n` +
      `**Record:** ${currentImage.wins}W - ${currentImage.losses}L (${currentImage.wins + currentImage.losses} total)\n` +
      `**Win Rate:** ${currentImage.wins + currentImage.losses > 0 ? Math.round((currentImage.wins / (currentImage.wins + currentImage.losses)) * 100) : 0}%\n` +
      `**Status:** ${currentImage.retired ? '🔴 Retired' : '🟢 Active'}\n` +
      `**Uploader:** ${uploaderName}\n` +
      `**Imported:** <t:${Math.floor(new Date(currentImage.imported_at).getTime() / 1000)}:R>\n\n` +
      `**Filter:** ${filterText}\n` +
      `Page ${page + 1} of ${totalPages} • ${totalImages} total images`
    );
    embed.setImage(imageUrl);

    // Filter dropdown
    const filterSelect = new StringSelectMenuBuilder()
      .setCustomId(`browse_filter_${page}_${userId || 'null'}`)
      .setPlaceholder('🔍 Change Filter')
      .addOptions([
        {
          label: 'Sort by ELO (Highest First)',
          value: 'elo',
          emoji: '📊',
          default: sortBy === 'elo'
        },
        {
          label: 'Sort by Wins (Most First)',
          value: 'wins',
          emoji: '🏆',
          default: sortBy === 'wins'
        },
        {
          label: 'Sort by Losses (Most First)',
          value: 'losses',
          emoji: '💀',
          default: sortBy === 'losses'
        },
        {
          label: 'Sort by Recent (Newest First)',
          value: 'recent',
          emoji: '🕐',
          default: sortBy === 'recent'
        },
        {
          label: 'Filter by User',
          value: 'by_user',
          emoji: '👤',
          default: sortBy === 'user'
        }
      ]);

    const filterRow = new ActionRowBuilder().addComponents(filterSelect);

    // Navigation buttons
    const navRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`browse_prev_${page}_${sortBy}_${userId || 'null'}`)
          .setLabel('◀ Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId(`browse_next_${page}_${sortBy}_${userId || 'null'}`)
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1),
        new ButtonBuilder()
          .setCustomId(`browse_close`)
          .setLabel('Close')
          .setStyle(ButtonStyle.Danger)
      );

    // Action buttons
    const actionRow = new ActionRowBuilder();
    
    if (currentImage.retired) {
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`image_unretire_${currentImage.id}_${page}_${sortBy}_${userId || 'null'}`)
          .setLabel('♻️ Unretire')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`image_delete_${currentImage.id}_${page}_${sortBy}_${userId || 'null'}`)
          .setLabel('🗑️ Delete')
          .setStyle(ButtonStyle.Danger)
      );
    } else {
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`image_retire_${currentImage.id}_${page}_${sortBy}_${userId || 'null'}`)
          .setLabel('📦 Retire')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`image_delete_${currentImage.id}_${page}_${sortBy}_${userId || 'null'}`)
          .setLabel('🗑️ Delete')
          .setStyle(ButtonStyle.Danger)
      );
    }

    if (isUpdate) {
      await interaction.update({ 
        embeds: [embed], 
        components: [filterRow, navRow, actionRow]
      });
    } else {
      await interaction.editReply({ 
        embeds: [embed], 
        components: [filterRow, navRow, actionRow]
      });
    }
  } catch (error) {
    console.error('Error showing image browser:', error);
    const embed = embedUtils.createErrorEmbed('Failed to load images!');
    
    if (isUpdate) {
      await interaction.update({ embeds: [embed], components: [] });
    } else {
      await interaction.editReply({ embeds: [embed], components: [] });
    }
  }
}

/**
 * Helper function to update image browser on an existing message
 * FIXED: Proper message update for navigation
 */
async function showImageBrowserOnMessage(message, page, sortBy, userId, guild) {
  try {
    const guildId = guild.id.toString();
    const limit = 1;
    const offset = page * limit;

    // Build query based on filter
    let query = 'SELECT * FROM images WHERE guild_id = $1';
    let queryParams = [guildId];
    let orderBy = 'elo DESC';

    if (userId) {
      query += ' AND uploader_id = $2';
      queryParams.push(userId);
      orderBy = 'elo DESC';
    }

    switch (sortBy) {
      case 'elo':
        orderBy = 'elo DESC';
        break;
      case 'wins':
        orderBy = 'wins DESC';
        break;
      case 'losses':
        orderBy = 'losses DESC';
        break;
      case 'recent':
        orderBy = 'imported_at DESC';
        break;
    }

    query += ` ORDER BY ${orderBy} LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const imagesResult = await database.query(query, queryParams);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM images WHERE guild_id = $1';
    let countParams = [guildId];
    
    if (userId) {
      countQuery += ' AND uploader_id = $2';
      countParams.push(userId);
    }

    const totalResult = await database.query(countQuery, countParams);
    const totalImages = parseInt(totalResult.rows[0].total);
    const totalPages = Math.ceil(totalImages / limit);

    if (imagesResult.rows.length === 0) {
      const embed = embedUtils.createErrorEmbed('No images found!');
      await message.edit({ embeds: [embed], components: [] });
      return;
    }

    const currentImage = imagesResult.rows[0];
    const imageUrl = await storage.getImageUrl(currentImage.s3_key);

    // Get uploader name
    let uploaderName = 'Unknown User';
    try {
      const uploaderId = currentImage.uploader_id.toString();
      const member = await guild.members.fetch(uploaderId);
      uploaderName = member.user.username;
    } catch (error) {
      uploaderName = `User ${currentImage.uploader_id}`;
    }

    // Create embed
    const embed = embedUtils.createBaseEmbed();
    
    let filterText = '';
    switch (sortBy) {
      case 'elo':
        filterText = 'Sorted by ELO';
        break;
      case 'wins':
        filterText = 'Sorted by Wins';
        break;
      case 'losses':
        filterText = 'Sorted by Losses';
        break;
      case 'recent':
        filterText = 'Sorted by Recent';
        break;
      case 'user':
        filterText = `By User: ${uploaderName}`;
        break;
    }

    embed.setTitle(`🖼️ Image Browser - Image #${currentImage.id}`);
    embed.setDescription(
      `**ELO:** ${currentImage.elo} ${currentImage.elo >= 1200 ? '🏆' : currentImage.elo <= 800 ? '💀' : ''}\n` +
      `**Record:** ${currentImage.wins}W - ${currentImage.losses}L (${currentImage.wins + currentImage.losses} total)\n` +
      `**Win Rate:** ${currentImage.wins + currentImage.losses > 0 ? Math.round((currentImage.wins / (currentImage.wins + currentImage.losses)) * 100) : 0}%\n` +
      `**Status:** ${currentImage.retired ? '🔴 Retired' : '🟢 Active'}\n` +
      `**Uploader:** ${uploaderName}\n` +
      `**Imported:** <t:${Math.floor(new Date(currentImage.imported_at).getTime() / 1000)}:R>\n\n` +
      `**Filter:** ${filterText}\n` +
      `Page ${page + 1} of ${totalPages} • ${totalImages} total images`
    );
    embed.setImage(imageUrl);

    // Filter dropdown
    const filterSelect = new StringSelectMenuBuilder()
      .setCustomId(`browse_filter_${page}_${userId || 'null'}`)
      .setPlaceholder('🔍 Change Filter')
      .addOptions([
        {
          label: 'Sort by ELO (Highest First)',
          value: 'elo',
          emoji: '📊',
          default: sortBy === 'elo'
        },
        {
          label: 'Sort by Wins (Most First)',
          value: 'wins',
          emoji: '🏆',
          default: sortBy === 'wins'
        },
        {
          label: 'Sort by Losses (Most First)',
          value: 'losses',
          emoji: '💀',
          default: sortBy === 'losses'
        },
        {
          label: 'Sort by Recent (Newest First)',
          value: 'recent',
          emoji: '🕐',
          default: sortBy === 'recent'
        },
        {
          label: 'Filter by User',
          value: 'by_user',
          emoji: '👤',
          default: sortBy === 'user'
        }
      ]);

    const filterRow = new ActionRowBuilder().addComponents(filterSelect);

    // Navigation buttons
    const navRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`browse_prev_${page}_${sortBy}_${userId || 'null'}`)
          .setLabel('◀ Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId(`browse_next_${page}_${sortBy}_${userId || 'null'}`)
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1),
        new ButtonBuilder()
          .setCustomId(`browse_close`)
          .setLabel('Close')
          .setStyle(ButtonStyle.Danger)
      );

    // Action buttons
    const actionRow = new ActionRowBuilder();
    
    if (currentImage.retired) {
      actionRow.ad
