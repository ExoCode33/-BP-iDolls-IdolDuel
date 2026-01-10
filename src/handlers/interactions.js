/**
 * Complete Interaction Handler
 * Enhanced image browser with filters (ELO/User) and fixed pagination
 * FIXED: BigInt handling throughout + Admin panel updates
 * Auto-refresh enabled - no manual refresh button needed
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
 */
async function showUserSelectMenu(interaction, page = 0) {
  const guildId = interaction.guild.id.toString();

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
 */
async function showImageBrowser(interaction, page = 0, sortBy = 'elo', userId = null) {
  const isUpdate = interaction.deferred || interaction.replied;
  
  if (!isUpdate) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }

  try {
    const guildId = interaction.guild.id.toString();
    const limit = 1;
    const offset = page * limit;

    let query = 'SELECT * FROM images WHERE guild_id = $1';
    let queryParams = [guildId];
    let orderBy = 'elo DESC';

    if (userId) {
      query += ' AND uploader_id = $2';
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

    let uploaderName = 'Unknown User';
    try {
      const uploaderId = currentImage.uploader_id.toString();
      const member = await interaction.guild.members.fetch(uploaderId);
      uploaderName = member.user.username;
    } catch (error) {
      uploaderName = `User ${currentImage.uploader_id}`;
    }

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
 */
async function showImageBrowserOnMessage(message, page, sortBy, userId, guild) {
  try {
    const guildId = guild.id.toString();
    const limit = 1;
    const offset = page * limit;

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

    let uploaderName = 'Unknown User';
    try {
      const uploaderId = currentImage.uploader_id.toString();
      const member = await guild.members.fetch(uploaderId);
      uploaderName = member.user.username;
    } catch (error) {
      uploaderName = `User ${currentImage.uploader_id}`;
    }

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

    await message.edit({ 
      embeds: [embed], 
      components: [filterRow, navRow, actionRow]
    });
  } catch (error) {
    console.error('Error updating image browser:', error);
  }
}

/**
 * Handle browse navigation
 */
async function handleBrowseNavigation(interaction) {
  await interaction.deferUpdate();

  const parts = interaction.customId.split('_');
  const action = parts[1];
  const currentPage = parseInt(parts[2]);
  const sortBy = parts[3] || 'elo';
  const userId = parts[4] !== 'null' ? parts[4] : null;

  if (action === 'close') {
    await interaction.message.edit({ components: [] });
    return;
  }

  const newPage = action === 'next' ? currentPage + 1 : currentPage - 1;
  await showImageBrowserOnMessage(interaction.message, newPage, sortBy, userId, interaction.guild);
}

/**
 * Handle image delete
 */
async function handleImageDelete(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const parts = interaction.customId.split('_');
    const imageId = parseInt(parts[2]);
    const page = parseInt(parts[3]);
    const sortBy = parts[4] || 'elo';
    const userId = parts[5] !== 'null' ? parts[5] : null;
    const guildId = interaction.guild.id.toString();

    const imageResult = await database.query(
      'SELECT * FROM images WHERE guild_id = $1 AND id = $2',
      [guildId, imageId]
    );

    if (imageResult.rows.length === 0) {
      const embed = embedUtils.createErrorEmbed('Image not found!');
      await interaction.editReply({ embeds: [embed] });
      autoDeleteEphemeral(interaction);
      return;
    }

    const image = imageResult.rows[0];
    await storage.deleteImage(image.s3_key);
    await database.query('DELETE FROM images WHERE guild_id = $1 AND id = $2', [guildId, imageId]);

    const embed = embedUtils.createSuccessEmbed(`Image #${imageId} deleted!`);
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction, 2000);

    setTimeout(async () => {
      try {
        let countQuery = 'SELECT COUNT(*) as total FROM images WHERE guild_id = $1';
        let countParams = [guildId];
        
        if (userId) {
          countQuery += ' AND uploader_id = $2';
          countParams.push(userId);
        }

        const totalResult = await database.query(countQuery, countParams);
        const totalImages = parseInt(totalResult.rows[0].total);
        const totalPages = Math.ceil(totalImages / 1);

        let newPage = page;
        if (page >= totalPages && page > 0) {
          newPage = page - 1;
        }

        const originalMessage = interaction.message;
        if (originalMessage) {
          await showImageBrowserOnMessage(originalMessage, newPage, sortBy, userId, interaction.guild);
        }
      } catch (error) {
        console.error('Error refreshing browser after delete:', error);
      }
    }, 2000);
  } catch (error) {
    console.error('Error deleting image:', error);
    const embed = embedUtils.createErrorEmbed('Failed to delete image!');
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);
  }
}

/**
 * Handle image retire
 */
async function handleImageRetire(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const parts = interaction.customId.split('_');
    const imageId = parseInt(parts[2]);
    const page = parseInt(parts[3]);
    const sortBy = parts[4] || 'elo';
    const userId = parts[5] !== 'null' ? parts[5] : null;
    const guildId = interaction.guild.id.toString();

    await database.query(
      'UPDATE images SET retired = true, retired_at = NOW() WHERE guild_id = $1 AND id = $2',
      [guildId, imageId]
    );

    const embed = embedUtils.createSuccessEmbed(`Image #${imageId} retired!`);
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction, 2000);

    setTimeout(async () => {
      try {
        const originalMessage = interaction.message;
        if (originalMessage) {
          await showImageBrowserOnMessage(originalMessage, page, sortBy, userId, interaction.guild);
        }
      } catch (error) {
        console.error('Error refreshing browser after retire:', error);
      }
    }, 2000);
  } catch (error) {
    console.error('Error retiring image:', error);
    const embed = embedUtils.createErrorEmbed('Failed to retire image!');
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);
  }
}

/**
 * Handle image unretire
 */
async function handleImageUnretire(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const parts = interaction.customId.split('_');
    const imageId = parseInt(parts[2]);
    const page = parseInt(parts[3]);
    const sortBy = parts[4] || 'elo';
    const userId = parts[5] !== 'null' ? parts[5] : null;
    const guildId = interaction.guild.id.toString();

    await database.query(
      'UPDATE images SET retired = false, retired_at = NULL WHERE guild_id = $1 AND id = $2',
      [guildId, imageId]
    );

    const embed = embedUtils.createSuccessEmbed(`Image #${imageId} unretired!`);
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction, 2000);

    setTimeout(async () => {
      try {
        const originalMessage = interaction.message;
        if (originalMessage) {
          await showImageBrowserOnMessage(originalMessage, page, sortBy, userId, interaction.guild);
        }
      } catch (error) {
        console.error('Error refreshing browser after unretire:', error);
      }
    }, 2000);
  } catch (error) {
    console.error('Error unretiring image:', error);
    const embed = embedUtils.createErrorEmbed('Failed to unretire image!');
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);
  }
}

/**
 * Handle modal submissions
 */
async function handleModal(interaction) {
  const customId = interaction.customId;

  if (customId === 'modal_edit_schedule') {
    await handleScheduleSubmit(interaction);
    return;
  }

  if (customId === 'modal_edit_elo') {
    await handleEloSubmit(interaction);
    return;
  }

  if (customId === 'modal_edit_retirement') {
    await handleRetirementSubmit(interaction);
    return;
  }

  if (customId === 'modal_import_images') {
    await handleImportSubmit(interaction);
    return;
  }

  if (customId === 'modal_system_reset') {
    const password = interaction.fields.getTextInputValue('reset_password');
    const confirmation = interaction.fields.getTextInputValue('reset_confirmation');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await systemReset.executeReset(interaction, password, confirmation);
    return;
  }
}

/**
 * Show retirement settings modal
 */
async function showRetirementModal(interaction) {
  const guildId = interaction.guild.id.toString();
  
  const config = await database.query(
    'SELECT retire_after_losses, retire_below_elo FROM guild_config WHERE guild_id = $1',
    [guildId]
  );

  const currentLosses = config.rows[0].retire_after_losses || 0;
  const currentElo = config.rows[0].retire_below_elo || 0;

  const modal = new ModalBuilder()
    .setCustomId('modal_edit_retirement')
    .setTitle('Auto-Retirement Settings');

  const lossesInput = new TextInputBuilder()
    .setCustomId('retire_after_losses')
    .setLabel('Retire after X losses (0 = disabled)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 5, 10, 15 (0 to disable)')
    .setValue(currentLosses.toString())
    .setRequired(true);

  const eloInput = new TextInputBuilder()
    .setCustomId('retire_below_elo')
    .setLabel('Retire below X ELO (0 = disabled)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 800, 700, 600 (0 to disable)')
    .setValue(currentElo.toString())
    .setRequired(true);

  const noteInput = new TextInputBuilder()
    .setCustomId('note')
    .setLabel('Note: You can enable both or just one')
    .setStyle(TextInputStyle.Paragraph)
    .setValue('If both enabled: Retire if EITHER condition is met.\nSet both to 0 to disable auto-retirement.')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(lossesInput),
    new ActionRowBuilder().addComponents(eloInput),
    new ActionRowBuilder().addComponents(noteInput)
  );

  await interaction.showModal(modal);
}

/**
 * Handle retirement modal submit
 */
async function handleRetirementSubmit(interaction) {
  await interaction.deferUpdate();

  try {
    const guildId = interaction.guild.id.toString();
    const retireAfterLosses = parseInt(interaction.fields.getTextInputValue('retire_after_losses'));
    const retireBelowElo = parseInt(interaction.fields.getTextInputValue('retire_below_elo'));

    if (isNaN(retireAfterLosses) || retireAfterLosses < 0) {
      const embed = embedUtils.createErrorEmbed('Invalid losses value!');
      await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (isNaN(retireBelowElo) || retireBelowElo < 0) {
      const embed = embedUtils.createErrorEmbed('Invalid ELO value!');
      await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    await database.query(
      'UPDATE guild_config SET retire_after_losses = $1, retire_below_elo = $2 WHERE guild_id = $3',
      [retireAfterLosses, retireBelowElo, guildId]
    );

    const adminCommand = (await import('../commands/admin/admin.js')).default;
    await adminCommand.showAdminPanel(interaction, true);
    
    console.log(`🗑️ Retirement settings updated for guild ${guildId}`);
  } catch (error) {
    console.error('Error updating retirement settings:', error);
    const embed = embedUtils.createErrorEmbed('Failed to update!');
    await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

/**
 * Show schedule edit modal
 */
async function showScheduleModal(interaction) {
  const guildId = interaction.guild.id.toString();
  
  const config = await database.query(
    'SELECT duel_interval, duel_duration FROM guild_config WHERE guild_id = $1',
    [guildId]
  );

  const currentInterval = Math.floor(config.rows[0].duel_interval / 60);
  const currentDuration = Math.floor(config.rows[0].duel_duration / 60);

  const modal = new ModalBuilder()
    .setCustomId('modal_edit_schedule')
    .setTitle('Edit Duel Schedule');

  const intervalInput = new TextInputBuilder()
    .setCustomId('duel_interval')
    .setLabel('Duel Interval (minutes)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 2, 30, 60, 360')
    .setValue(currentInterval.toString())
    .setRequired(true);

  const durationInput = new TextInputBuilder()
    .setCustomId('duel_duration')
    .setLabel('Duel Duration (minutes)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 2, 30, 60, 360')
    .setValue(currentDuration.toString())
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(intervalInput),
    new ActionRowBuilder().addComponents(durationInput)
  );

  await interaction.showModal(modal);
}

/**
 * Show ELO settings modal
 */
async function showEloModal(interaction) {
  const guildId = interaction.guild.id.toString();
  
  const config = await database.query(
    'SELECT starting_elo, k_factor FROM guild_config WHERE guild_id = $1',
    [guildId]
  );

  const modal = new ModalBuilder()
    .setCustomId('modal_edit_elo')
    .setTitle('Edit ELO Settings');

  const startingEloInput = new TextInputBuilder()
    .setCustomId('starting_elo')
    .setLabel('Starting ELO')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 1000')
    .setValue(config.rows[0].starting_elo.toString())
    .setRequired(true);

  const kFactorInput = new TextInputBuilder()
    .setCustomId('k_factor')
    .setLabel('K-Factor (ELO sensitivity)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 32')
    .setValue(config.rows[0].k_factor.toString())
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(startingEloInput),
    new ActionRowBuilder().addComponents(kFactorInput)
  );

  await interaction.showModal(modal);
}

/**
 * Show import images modal
 */
async function showImportModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('modal_import_images')
    .setTitle('Import Images from Channel');

  const channelInput = new TextInputBuilder()
    .setCustomId('channel_id')
    .setLabel('Channel ID or #mention')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 1234567890 or #past-images')
    .setRequired(true);

  const limitInput = new TextInputBuilder()
    .setCustomId('message_limit')
    .setLabel('How many messages to scan? (max 100)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 50')
    .setValue('50')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(channelInput),
    new ActionRowBuilder().addComponents(limitInput)
  );

  await interaction.showModal(modal);
}

/**
 * Handle schedule modal submit
 */
async function handleScheduleSubmit(interaction) {
  await interaction.deferUpdate();

  try {
    const guildId = interaction.guild.id.toString();
    const intervalMinutes = parseInt(interaction.fields.getTextInputValue('duel_interval'));
    const durationMinutes = parseInt(interaction.fields.getTextInputValue('duel_duration'));

    if (isNaN(intervalMinutes) || intervalMinutes < 1) {
      const embed = embedUtils.createErrorEmbed('Invalid interval!');
      await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (isNaN(durationMinutes) || durationMinutes < 1) {
      const embed = embedUtils.createErrorEmbed('Invalid duration!');
      await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    const intervalSeconds = intervalMinutes * 60;
    const durationSeconds = durationMinutes * 60;

    await database.query(
      'UPDATE guild_config SET duel_interval = $1, duel_duration = $2 WHERE guild_id = $3',
      [intervalSeconds, durationSeconds, guildId]
    );

    const adminCommand = (await import('../commands/admin/admin.js')).default;
    await adminCommand.showAdminPanel(interaction, true);
    
    console.log(`⏱️ Schedule updated for guild ${guildId}: ${intervalMinutes}min interval, ${durationMinutes}min duration`);
  } catch (error) {
    console.error('Error updating schedule:', error);
    const embed = embedUtils.createErrorEmbed('Failed to update!');
    await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

/**
 * Handle ELO modal submit
 */
async function handleEloSubmit(interaction) {
  await interaction.deferUpdate();

  try {
    const guildId = interaction.guild.id.toString();
    const startingElo = parseInt(interaction.fields.getTextInputValue('starting_elo'));
    const kFactor = parseInt(interaction.fields.getTextInputValue('k_factor'));

    if (isNaN(startingElo) || startingElo < 0) {
      const embed = embedUtils.createErrorEmbed('Invalid starting ELO!');
      await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (isNaN(kFactor) || kFactor < 1) {
      const embed = embedUtils.createErrorEmbed('Invalid K-Factor!');
      await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    await database.query(
      'UPDATE guild_config SET starting_elo = $1, k_factor = $2 WHERE guild_id = $3',
      [startingElo, kFactor, guildId]
    );

    const adminCommand = (await import('../commands/admin/admin.js')).default;
    await adminCommand.showAdminPanel(interaction, true);
    
    console.log(`📊 ELO settings updated for guild ${guildId}`);
  } catch (error) {
    console.error('Error updating ELO:', error);
    const embed = embedUtils.createErrorEmbed('Failed to update!');
    await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

/**
 * Handle import images modal submit
 */
async function handleImportSubmit(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const guildId = interaction.guild.id.toString();
    let channelInput = interaction.fields.getTextInputValue('channel_id');
    const messageLimit = parseInt(interaction.fields.getTextInputValue('message_limit'));

    const channelIdMatch = channelInput.match(/(\d+)/);
    if (!channelIdMatch) {
      const embed = embedUtils.createErrorEmbed('Invalid channel!');
      await interaction.editReply({ embeds: [embed] });
      autoDeleteEphemeral(interaction);
      return;
    }

    const channelId = channelIdMatch[1];

    if (isNaN(messageLimit) || messageLimit < 1 || messageLimit > 100) {
      const embed = embedUtils.createErrorEmbed('Limit must be 1-100!');
      await interaction.editReply({ embeds: [embed] });
      autoDeleteEphemeral(interaction);
      return;
    }

    const channel = await interaction.guild.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      const embed = embedUtils.createErrorEmbed('Invalid channel!');
      await interaction.editReply({ embeds: [embed] });
      autoDeleteEphemeral(interaction);
      return;
    }

    const progressEmbed = embedUtils.createBaseEmbed();
    progressEmbed.setTitle('📥 Importing...');
    progressEmbed.setDescription(`Scanning ${channel}...`);
    await interaction.editReply({ embeds: [progressEmbed] });

    const messages = await channel.messages.fetch({ limit: messageLimit });
    let imported = 0;
    let skipped = 0;

    for (const message of messages.values()) {
      if (message.attachments.size > 0) {
        const attachments = Array.from(message.attachments.values());
        const results = await importer.importMultiple(guildId, message.author.id, attachments);
        imported += results.length;
        skipped += (attachments.length - results.length);
      }
    }

    const successEmbed = embedUtils.createSuccessEmbed(
      `✅ Import complete!\n\nImported: ${imported}\nSkipped: ${skipped}`
    );

    await interaction.editReply({ embeds: [successEmbed] });
    autoDeleteEphemeral(interaction, 5000);

  } catch (error) {
    console.error('Error importing:', error);
    const embed = embedUtils.createErrorEmbed('Failed to import!');
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);
  }
}

/**
 * Handle vote
 */
async function handleVote(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const imageId = parseInt(interaction.customId.split('_')[1]);
    const guildId = interaction.guild.id.toString();
    const userId = interaction.user.id.toString();

    const activeDuel = await duelManager.getActiveDuel(guildId);

    if (!activeDuel) {
      const embed = embedUtils.createErrorEmbed('No active duel!');
      await interaction.editReply({ embeds: [embed] });
      autoDeleteEphemeral(interaction);
      return;
    }

    if (imageId !== activeDuel.image1.id && imageId !== activeDuel.image2.id) {
      const embed = embedUtils.createErrorEmbed('Invalid vote!');
      await interaction.editReply({ embeds: [embed] });
      autoDeleteEphemeral(interaction);
      return;
    }

    const existingVote = await database.query(
      'SELECT image_id FROM votes WHERE duel_id = $1 AND user_id = $2',
      [activeDuel.duelId, userId]
    );

    if (existingVote.rows.length > 0) {
      const votedImageId = existingVote.rows[0].image_id;

      if (votedImageId === imageId) {
        const embed = embedUtils.createErrorEmbed('Already voted!');
        await interaction.editReply({ embeds: [embed] });
        autoDeleteEphemeral(interaction);
        return;
      }

      await database.query(
        'UPDATE votes SET image_id = $1, voted_at = NOW() WHERE duel_id = $2 AND user_id = $3',
        [imageId, activeDuel.duelId, userId]
      );

      const embed = embedUtils.createSuccessEmbed('Vote changed! ♡');
      await interaction.editReply({ embeds: [embed] });
      autoDeleteEphemeral(interaction);
      return;
    }

    await database.query(
      'INSERT INTO votes (duel_id, user_id, image_id, voted_at) VALUES ($1, $2, $3, NOW())',
      [activeDuel.duelId, userId, imageId]
    );

    const embed = embedUtils.createSuccessEmbed('Vote recorded! ♡');
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);
  } catch (error) {
    console.error('Error voting:', error);
    const embed = embedUtils.createErrorEmbed('Failed to vote!');
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);
  }
}

/**
 * DUEL CONTROL HANDLERS - FIXED
 */

async function handleStartDuel(interaction) {
  try {
    const guildId = interaction.guild.id.toString();
    await duelManager.startDuel(guildId);

    const adminCommand = (await import('../commands/admin/admin.js')).default;
    await adminCommand.showAdminPanel(interaction, true);
    
    console.log(`✅ Duel system started for guild ${guildId}`);
  } catch (error) {
    console.error('Error starting duel:', error);
    const embed = embedUtils.createErrorEmbed('Failed to start duel system.');
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

async function handleStopDuel(interaction) {
  try {
    const guildId = interaction.guild.id.toString();
    await duelManager.stopDuel(guildId);

    const adminCommand = (await import('../commands/admin/admin.js')).default;
    await adminCommand.showAdminPanel(interaction, true);
    
    console.log(`⏹️ Duel system stopped for guild ${guildId}`);
  } catch (error) {
    console.error('Error stopping duel:', error);
    const embed = embedUtils.createErrorEmbed('Failed to stop.');
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

async function handleSkipDuel(interaction) {
  try {
    const guildId = interaction.guild.id.toString();
    await duelManager.skipDuel(guildId);

    const adminCommand = (await import('../commands/admin/admin.js')).default;
    await adminCommand.showAdminPanel(interaction, true);
    
    console.log(`⏭️ Duel skipped for guild ${guildId}`);
  } catch (error) {
    console.error('Error skipping duel:', error);
    const embed = embedUtils.createErrorEmbed('Failed to skip.');
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

async function handlePauseDuel(interaction) {
  try {
    const guildId = interaction.guild.id.toString();

    await database.query(
      'UPDATE guild_config SET duel_paused = true WHERE guild_id = $1',
      [guildId]
    );

    const adminCommand = (await import('../commands/admin/admin.js')).default;
    await adminCommand.showAdminPanel(interaction, true);
    
    console.log(`⏸️ Duel system paused for guild ${guildId}`);
  } catch (error) {
    console.error('Error pausing:', error);
    const embed = embedUtils.createErrorEmbed('Failed to pause.');
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

async function handleResumeDuel(interaction) {
  try {
    const guildId = interaction.guild.id.toString();

    await database.query(
      'UPDATE guild_config SET duel_paused = false WHERE guild_id = $1',
      [guildId]
    );

    const adminCommand = (await import('../commands/admin/admin.js')).default;
    await adminCommand.showAdminPanel(interaction, true);

    await duelManager.checkGuild(guildId);
    
    console.log(`▶️ Duel system resumed for guild ${guildId}`);
  } catch (error) {
    console.error('Error resuming:', error);
    const embed = embedUtils.createErrorEmbed('Failed to resume.');
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

export default { handleInteractions };
