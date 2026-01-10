/**
 * Image Browser Handler
 * Browse, delete, retire, unretire images
 */

import database from '../../database/database.js';
import storage from '../../services/image/storage.js';
import embedUtils from '../../utils/embeds.js';
import { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';

export async function handleImageBrowser(interaction) {
  const customId = interaction.customId;

  // Button handlers
  if (customId === 'admin_browse_images') {
    return await showImageBrowser(interaction, 0, 'elo', null);
  }

  if (customId.startsWith('browse_')) {
    return await handleBrowseNavigation(interaction);
  }

  if (customId.startsWith('image_delete_')) {
    return await handleImageDelete(interaction);
  }

  if (customId.startsWith('image_retire_')) {
    return await handleImageRetire(interaction);
  }

  if (customId.startsWith('image_unretire_')) {
    return await handleImageUnretire(interaction);
  }

  // Select menu handlers
  if (customId.startsWith('browse_filter_')) {
    return await handleBrowseFilter(interaction);
  }

  if (customId.startsWith('browse_user_')) {
    return await handleBrowseUserSelect(interaction);
  }
}

/**
 * Auto-delete ephemeral message
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
 * Handle browse filter change
 */
async function handleBrowseFilter(interaction) {
  const parts = interaction.customId.split('_');
  const page = parseInt(parts[2]);
  
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
