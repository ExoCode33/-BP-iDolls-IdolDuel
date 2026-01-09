import duelManager from '../services/duelManager.js';
import database from '../database/database.js';
import embedUtils from '../utils/embeds.js';
import adminConfig from '../commands/admin/config.js';
import leaderboardCmd from '../commands/user/leaderboard.js';
import imageManagement from '../commands/admin/imageManagement.js';
import adminLogs from '../commands/admin/adminLogs.js';
import storage from '../services/storage.js';
import eloService from '../services/elo.js';
import { MessageFlags } from 'discord.js';

export async function handleButtonInteraction(interaction) {
  const customId = interaction.customId;

  // Duel voting buttons
  if (customId.startsWith('vote_image_')) {
    await handleVoteButton(interaction);
    return;
  }

  // Caption button
  if (customId === 'add_caption') {
    await handleCaptionButton(interaction);
    return;
  }

  // Leaderboard buttons
  if (customId === 'leaderboard_top_images') {
    await leaderboardCmd.handleTopImages(interaction);
    return;
  }

  if (customId === 'top_image_prev') {
    await leaderboardCmd.handleImageNavigation(interaction, 'prev');
    return;
  }

  if (customId === 'top_image_next') {
    await leaderboardCmd.handleImageNavigation(interaction, 'next');
    return;
  }

  if (customId === 'leaderboard_back') {
    await leaderboardCmd.handleBackToLeaderboard(interaction);
    return;
  }

  // Admin buttons - navigation
  if (customId === 'admin_back_main') {
    await interaction.deferUpdate();
    const config = await adminConfig.getOrCreateConfig(interaction.guild.id);
    await adminConfig.showMainMenu(interaction, config);
    return;
  }

  // Admin buttons - settings
  if (customId === 'admin_set_k_factor') {
    await interaction.showModal(adminConfig.createKFactorModal());
    return;
  }

  if (customId === 'admin_set_starting_elo') {
    await interaction.showModal(adminConfig.createStartingEloModal());
    return;
  }

  if (customId === 'admin_set_duel_duration') {
    await interaction.showModal(adminConfig.createDuelDurationModal());
    return;
  }

  if (customId === 'admin_set_duel_interval') {
    await interaction.showModal(adminConfig.createDuelIntervalModal());
    return;
  }

  if (customId === 'admin_set_min_votes') {
    await interaction.showModal(adminConfig.createMinVotesModal());
    return;
  }

  if (customId === 'admin_set_losses_retirement') {
    await interaction.showModal(adminConfig.createLossesRetirementModal());
    return;
  }

  if (customId === 'admin_set_wildcard_chance') {
    await interaction.showModal(adminConfig.createWildcardChanceModal());
    return;
  }

  if (customId === 'admin_set_duel_channel') {
    await interaction.showModal(adminConfig.createDuelChannelModal());
    return;
  }

  // NEW: Log channel configuration buttons
  if (customId === 'admin_set_log_channel') {
    await interaction.showModal(adminConfig.createLogChannelModal());
    return;
  }

  if (customId === 'admin_clear_log_channel') {
    await handleClearLogChannel(interaction);
    return;
  }

  // Admin buttons - duel controls
  if (customId === 'admin_start_duel') {
    await handleStartDuelButton(interaction);
    return;
  }

  if (customId === 'admin_stop_duel') {
    await handleStopDuelButton(interaction);
    return;
  }

  if (customId === 'admin_skip_duel') {
    await handleSkipDuelButton(interaction);
    return;
  }

  if (customId === 'admin_pause_duel') {
    await handlePauseDuelButton(interaction);
    return;
  }

  if (customId === 'admin_resume_duel') {
    await handleResumeDuelButton(interaction);
    return;
  }

  // Admin buttons - image management (NEW)
  if (customId === 'admin_import_images') {
    await interaction.showModal(adminConfig.createImportChannelsModal());
    return;
  }

  if (customId === 'admin_browse_images') {
    await imageManagement.browseImages(interaction);
    return;
  }

  if (customId === 'admin_filter_images') {
    await imageManagement.showFilterInterface(interaction);
    return;
  }

  if (customId === 'admin_bulk_retire') {
    await imageManagement.showBulkRetire(interaction);
    return;
  }

  // NEW: Bulk unretire button
  if (customId === 'admin_bulk_unretire') {
    await imageManagement.showBulkUnretire(interaction);
    return;
  }

  if (customId === 'admin_export_stats') {
    await handleExportStats(interaction);
    return;
  }

  // NEW: Image browser action buttons
  if (customId === 'browse_view_image') {
    await interaction.showModal(imageManagement.createViewImageModal());
    return;
  }

  if (customId === 'browse_retire_image') {
    await interaction.showModal(imageManagement.createRetireImageModal());
    return;
  }

  if (customId === 'browse_unretire_image') {
    await interaction.showModal(imageManagement.createUnretireImageModal());
    return;
  }

  if (customId === 'browse_delete_image') {
    await interaction.showModal(imageManagement.createDeleteImageModal());
    return;
  }

  // NEW: Individual image action buttons (from view screen)
  if (customId.startsWith('image_action_retire_')) {
    const imageId = parseInt(customId.split('_')[3]);
    await handleRetireImageDirect(interaction, imageId);
    return;
  }

  if (customId.startsWith('image_action_unretire_')) {
    const imageId = parseInt(customId.split('_')[3]);
    await handleUnretireImageDirect(interaction, imageId);
    return;
  }

  if (customId.startsWith('image_action_delete_')) {
    const imageId = parseInt(customId.split('_')[3]);
    await handleDeleteImageDirect(interaction, imageId);
    return;
  }

  // NEW: Delete confirmation buttons
  if (customId.startsWith('confirm_delete_')) {
    const imageId = parseInt(customId.split('_')[2]);
    await handleConfirmDelete(interaction, imageId);
    return;
  }

  if (customId === 'cancel_delete') {
    await interaction.deferUpdate();
    const embed = embedUtils.createSuccessEmbed('Deletion cancelled.');
    await interaction.editReply({ embeds: [embed], components: [] });
    return;
  }

  // Image browser navigation (NEW)
  if (customId.startsWith('browse_images_')) {
    await handleBrowseNavigation(interaction);
    return;
  }

  if (customId === 'admin_back_image_mgmt') {
    await interaction.deferUpdate();
    const config = await adminConfig.getOrCreateConfig(interaction.guild.id);
    await imageManagement.showImageManagement(interaction, config);
    return;
  }

  // Admin logs navigation (NEW)
  if (customId.startsWith('logs_')) {
    await handleLogsNavigation(interaction);
    return;
  }

  // Old image list buttons (kept for backward compatibility)
  if (customId === 'admin_list_images') {
    await handleListImagesButton(interaction);
    return;
  }

  if (customId === 'image_list_prev') {
    await handleImageListNavigation(interaction, 'prev');
    return;
  }

  if (customId === 'image_list_next') {
    await handleImageListNavigation(interaction, 'next');
    return;
  }

  if (customId === 'admin_clear_low_elo') {
    await interaction.showModal(adminConfig.createEloThresholdModal());
    return;
  }

  // Admin buttons - season management
  if (customId === 'admin_reset_season') {
    await interaction.showModal(adminConfig.createSeasonResetModal());
    return;
  }

  // System reset buttons
  if (customId === 'confirm_system_reset') {
    const systemReset = await import('../commands/admin/systemReset.js');
    await systemReset.default.showPasswordModal(interaction);
    return;
  }

  if (customId === 'cancel_system_reset') {
    await interaction.deferUpdate();
    const embed = embedUtils.createSuccessEmbed('System reset cancelled.');
    await interaction.editReply({ embeds: [embed], components: [] });
    return;
  }
}

async function handleVoteButton(interaction) {
  const imageId = parseInt(interaction.customId.split('_')[2]);
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;

  const success = await duelManager.castVote(guildId, userId, imageId);

  if (success) {
    await interaction.reply({ 
      content: '✅ Your vote has been recorded! ♡', 
      flags: MessageFlags.Ephemeral 
    });
  } else {
    await interaction.reply({ 
      content: '❌ You\'ve already voted in this duel! You can only vote once. (>﹏<)', 
      flags: MessageFlags.Ephemeral 
    });
  }
}

async function handleCaptionButton(interaction) {
  const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
  
  const modal = new ModalBuilder()
    .setCustomId('modal_add_caption')
    .setTitle('Add Anonymous Caption');

  const captionInput = new TextInputBuilder()
    .setCustomId('caption_input')
    .setLabel('Your caption (keep it friendly!)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Write your caption here...')
    .setRequired(true)
    .setMaxLength(200);

  const imageSelect = new TextInputBuilder()
    .setCustomId('image_select')
    .setLabel('Which image? (Type A or B)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('A or B')
    .setRequired(true)
    .setMaxLength(1);

  modal.addComponents(
    new ActionRowBuilder().addComponents(imageSelect),
    new ActionRowBuilder().addComponents(captionInput)
  );

  await interaction.showModal(modal);
}

async function handleStartDuelButton(interaction) {
  await interaction.deferUpdate();

  try {
    const guildId = interaction.guild.id;
    const config = await adminConfig.getOrCreateConfig(guildId);

    // Start duel via duel scheduler
    await interaction.client.duelScheduler.startDuelNow(guildId);

    const successEmbed = embedUtils.createSuccessEmbed('Duel started successfully!');
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

    // Refresh the control panel
    const updatedConfig = await adminConfig.getOrCreateConfig(guildId);
    await adminConfig.handleDuelControls(interaction, updatedConfig);
  } catch (error) {
    console.error('Error starting duel:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to start duel.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

async function handleStopDuelButton(interaction) {
  await interaction.deferUpdate();

  try {
    const guildId = interaction.guild.id;
    
    // End current duel
    await interaction.client.duelScheduler.endDuelNow(guildId);

    const successEmbed = embedUtils.createSuccessEmbed('Current duel stopped!');
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

    // Refresh the control panel
    const updatedConfig = await adminConfig.getOrCreateConfig(guildId);
    await adminConfig.handleDuelControls(interaction, updatedConfig);
  } catch (error) {
    console.error('Error stopping duel:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to stop duel.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

async function handleSkipDuelButton(interaction) {
  await interaction.deferUpdate();

  try {
    const guildId = interaction.guild.id;
    
    // End current and start new
    await interaction.client.duelScheduler.endDuelNow(guildId);
    await interaction.client.duelScheduler.startDuelNow(guildId);

    const successEmbed = embedUtils.createSuccessEmbed('Skipped to next duel!');
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

    // Refresh the control panel
    const updatedConfig = await adminConfig.getOrCreateConfig(guildId);
    await adminConfig.handleDuelControls(interaction, updatedConfig);
  } catch (error) {
    console.error('Error skipping duel:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to skip duel.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

async function handlePauseDuelButton(interaction) {
  await interaction.deferUpdate();

  try {
    const guildId = interaction.guild.id;
    
    await database.query(
      'UPDATE guild_config SET duel_paused = true WHERE guild_id = $1',
      [guildId]
    );

    const successEmbed = embedUtils.createSuccessEmbed('Duel scheduling paused!');
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

    // Refresh the control panel
    const updatedConfig = await adminConfig.getOrCreateConfig(guildId);
    await adminConfig.handleDuelControls(interaction, updatedConfig);
  } catch (error) {
    console.error('Error pausing duels:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to pause scheduling.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

async function handleResumeDuelButton(interaction) {
  await interaction.deferUpdate();

  try {
    const guildId = interaction.guild.id;
    
    await database.query(
      'UPDATE guild_config SET duel_paused = false WHERE guild_id = $1',
      [guildId]
    );

    const successEmbed = embedUtils.createSuccessEmbed('Duel scheduling resumed!');
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

    // Refresh the control panel
    const updatedConfig = await adminConfig.getOrCreateConfig(guildId);
    await adminConfig.handleDuelControls(interaction, updatedConfig);
  } catch (error) {
    console.error('Error resuming duels:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to resume scheduling.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

// NEW: Handle browse images navigation
async function handleBrowseNavigation(interaction) {
  const content = interaction.message.content;
  const match = content.match(/__BROWSE_STATE:(.+?)__/);
  
  if (!match) {
    await interaction.reply({ 
      content: 'Navigation data not found. Please start over.', 
      flags: MessageFlags.Ephemeral 
    });
    return;
  }
  
  const state = JSON.parse(match[1]);
  let { page, sortBy, filterActive } = state;
  
  if (interaction.customId === 'browse_images_next') {
    page++;
  } else if (interaction.customId === 'browse_images_prev') {
    page--;
  } else if (interaction.customId === 'browse_images_first') {
    page = 1;
  } else if (interaction.customId === 'browse_images_last') {
    // Calculate last page
    let filterClause = '';
    if (filterActive === 'active') filterClause = 'AND retired = false';
    if (filterActive === 'retired') filterClause = 'AND retired = true';
    
    const countResult = await database.query(
      `SELECT COUNT(*) as total FROM images WHERE guild_id = $1 ${filterClause}`,
      [interaction.guild.id]
    );
    const totalPages = Math.ceil(parseInt(countResult.rows[0].total) / 25);
    page = totalPages;
  }
  
  await imageManagement.browseImages(interaction, page, sortBy, filterActive);
}

// NEW: Handle admin logs navigation
async function handleLogsNavigation(interaction) {
  if (interaction.customId === 'logs_export') {
    await adminLogs.exportLogs(interaction);
    return;
  }

  const content = interaction.message.content;
  const match = content.match(/__LOGS_STATE:(.+?)__/);
  
  if (!match) {
    await interaction.reply({ 
      content: 'Navigation data not found. Please start over.', 
      flags: MessageFlags.Ephemeral 
    });
    return;
  }
  
  const state = JSON.parse(match[1]);
  let { page, filterType } = state;
  
  if (interaction.customId === 'logs_next') {
    page++;
  } else if (interaction.customId === 'logs_prev') {
    page--;
  } else if (interaction.customId === 'logs_refresh') {
    page = 1;
  }
  
  await adminLogs.showAdminLogs(interaction, page, filterType);
}

// NEW: Handle export stats
async function handleExportStats(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const guildId = interaction.guild.id;

    // Get all image stats
    const result = await database.query(
      `SELECT id, elo, wins, losses, current_streak, best_streak, 
              total_votes_received, uploader_id, retired, imported_at
       FROM images 
       WHERE guild_id = $1 
       ORDER BY elo DESC`,
      [guildId]
    );

    if (result.rows.length === 0) {
      const errorEmbed = embedUtils.createErrorEmbed('No images found to export.');
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    // Format as CSV
    let csv = 'ID,ELO,Wins,Losses,Win Rate,Current Streak,Best Streak,Total Votes,Uploader ID,Status,Imported At\n';
    
    result.rows.forEach(img => {
      const winRate = eloService.calculateWinRate(img.wins, img.losses);
      const status = img.retired ? 'Retired' : 'Active';
      csv += `${img.id},${img.elo},${img.wins},${img.losses},${winRate}%,${img.current_streak},${img.best_streak},${img.total_votes_received},${img.uploader_id},${status},${img.imported_at}\n`;
    });

    // Create file
    const buffer = Buffer.from(csv, 'utf-8');
    const attachment = {
      attachment: buffer,
      name: `image-stats-${Date.now()}.csv`
    };

    const embed = embedUtils.createSuccessEmbed(
      `Exported stats for ${result.rows.length} images.\nCheck the attached CSV file.`
    );

    await interaction.editReply({ embeds: [embed], files: [attachment] });
  } catch (error) {
    console.error('Error exporting stats:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to export stats.');
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

// OLD: Keep for backward compatibility
async function handleListImagesButton(interaction) {
  await interaction.deferUpdate();

  try {
    const guildId = interaction.guild.id;
    
    const result = await database.query(
      `SELECT id, elo, wins, losses, uploader_id, retired, s3_key 
       FROM images 
       WHERE guild_id = $1 
       ORDER BY elo DESC 
       LIMIT 10`,
      [guildId]
    );

    if (result.rows.length === 0) {
      const errorEmbed = embedUtils.createErrorEmbed('No images found in database.');
      await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      return;
    }

    // Show first image with navigation
    const images = result.rows;
    const currentIndex = 0;
    const image = images[currentIndex];
    const imageUrl = await storage.getImageUrl(image.s3_key);
    
    const embed = embedUtils.createBaseEmbed();
    const winRate = eloService.calculateWinRate(image.wins, image.losses);
    const status = image.retired ? '❌ RETIRED' : '✅ ACTIVE';
    
    embed.setTitle(`📋 Image #${image.id} — Rank ${currentIndex + 1}/${images.length}`);
    embed.setDescription(
      `\`\`\`css\n` +
      `[ Image Details ]\n` +
      `\`\`\`\n` +
      `**Status:** ${status}\n` +
      `${eloService.getRankEmoji(image.elo)} **ELO:** \`${image.elo}\`\n` +
      `**Record:** ${image.wins}W - ${image.losses}L\n` +
      `**Win Rate:** ${winRate}%\n` +
      `**Uploader:** <@${image.uploader_id}>`
    );
    embed.setThumbnail(imageUrl);
    embed.setImage(imageUrl);
    embed.setFooter({ text: `Image ${currentIndex + 1} of ${images.length} | Navigate with buttons ♡` });

    // Navigation buttons
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
    const navButtons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('image_list_prev')
          .setLabel('◀ Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('image_list_next')
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(images.length === 1),
        new ButtonBuilder()
          .setCustomId('admin_back_image_mgmt')
          .setLabel('Back to Image Management')
          .setStyle(ButtonStyle.Primary)
      );

    await interaction.followUp({ 
      embeds: [embed], 
      components: [navButtons],
      flags: MessageFlags.Ephemeral,
      content: `__IMAGE_LIST_DATA:${JSON.stringify(images.map(i => i.id))}:0__`
    });
  } catch (error) {
    console.error('Error listing images:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to list images.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

async function handleImageListNavigation(interaction, direction) {
  await interaction.deferUpdate();

  try {
    const content = interaction.message.content;
    const match = content.match(/__IMAGE_LIST_DATA:(.+?):(\d+)__/);
    
    if (!match) throw new Error('Navigation data not found');

    const imageIds = JSON.parse(match[1]);
    let currentIndex = parseInt(match[2]);

    if (direction === 'next') currentIndex++;
    if (direction === 'prev') currentIndex--;

    // Get images
    const result = await database.query(
      `SELECT id, elo, wins, losses, uploader_id, retired, s3_key 
       FROM images WHERE id = ANY($1) ORDER BY elo DESC`,
      [imageIds]
    );

    const images = result.rows;
    const image = images[currentIndex];
    const imageUrl = await storage.getImageUrl(image.s3_key);
    
    const embed = embedUtils.createBaseEmbed();
    const winRate = eloService.calculateWinRate(image.wins, image.losses);
    const status = image.retired ? '❌ RETIRED' : '✅ ACTIVE';
    
    embed.setTitle(`📋 Image #${image.id} — Rank ${currentIndex + 1}/${images.length}`);
    embed.setDescription(
      `\`\`\`css\n` +
      `[ Image Details ]\n` +
      `\`\`\`\n` +
      `**Status:** ${status}\n` +
      `${eloService.getRankEmoji(image.elo)} **ELO:** \`${image.elo}\`\n` +
      `**Record:** ${image.wins}W - ${image.losses}L\n` +
      `**Win Rate:** ${winRate}%\n` +
      `**Uploader:** <@${image.uploader_id}>`
    );
    embed.setThumbnail(imageUrl);
    embed.setImage(imageUrl);
    embed.setFooter({ text: `Image ${currentIndex + 1} of ${images.length} | Navigate with buttons ♡` });

    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
    const navButtons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('image_list_prev')
          .setLabel('◀ Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentIndex === 0),
        new ButtonBuilder()
          .setCustomId('image_list_next')
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentIndex === images.length - 1),
        new ButtonBuilder()
          .setCustomId('admin_back_image_mgmt')
          .setLabel('Back to Image Management')
          .setStyle(ButtonStyle.Primary)
      );

    await interaction.editReply({
      embeds: [embed],
      components: [navButtons],
      content: `__IMAGE_LIST_DATA:${JSON.stringify(imageIds)}:${currentIndex}__`
    });
  } catch (error) {
    console.error('Error navigating images:', error);
  }
}

// NEW HELPER FUNCTIONS FOR PART 2 FEATURES

async function handleClearLogChannel(interaction) {
  await interaction.deferUpdate();

  try {
    const guildId = interaction.guild.id;
    
    await database.query(
      'UPDATE guild_config SET log_channel_id = NULL WHERE guild_id = $1',
      [guildId]
    );

    const successEmbed = embedUtils.createSuccessEmbed('Log channel disabled. No more automatic log messages will be sent.');
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

    // Refresh settings page
    const config = await adminConfig.getOrCreateConfig(guildId);
    await adminConfig.handleBasicSettings(interaction, config);
  } catch (error) {
    console.error('Error clearing log channel:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to clear log channel.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

async function handleRetireImageDirect(interaction, imageId) {
  await interaction.deferUpdate();

  try {
    const guildId = interaction.guild.id;

    const checkResult = await database.query(
      'SELECT retired FROM images WHERE guild_id = $1 AND id = $2',
      [guildId, imageId]
    );

    if (checkResult.rows.length === 0) {
      const errorEmbed = embedUtils.createErrorEmbed('Image not found.');
      await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (checkResult.rows[0].retired) {
      const errorEmbed = embedUtils.createErrorEmbed('This image is already retired.');
      await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      return;
    }

    await database.query(
      'UPDATE images SET retired = true, retired_at = NOW() WHERE guild_id = $1 AND id = $2',
      [guildId, imageId]
    );

    await database.query(
      `INSERT INTO logs (guild_id, action_type, admin_id, details)
       VALUES ($1, 'image_retired', $2, $3)`,
      [guildId, interaction.user.id, JSON.stringify({ imageId, method: 'manual' })]
    );

    const successEmbed = embedUtils.createSuccessEmbed(`Image #${imageId} has been retired.`);
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

    await imageManagement.viewImage(interaction, imageId);
  } catch (error) {
    console.error('Error retiring image:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to retire image.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

async function handleUnretireImageDirect(interaction, imageId) {
  await interaction.deferUpdate();

  try {
    const guildId = interaction.guild.id;

    const checkResult = await database.query(
      'SELECT retired FROM images WHERE guild_id = $1 AND id = $2',
      [guildId, imageId]
    );

    if (checkResult.rows.length === 0) {
      const errorEmbed = embedUtils.createErrorEmbed('Image not found.');
      await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (!checkResult.rows[0].retired) {
      const errorEmbed = embedUtils.createErrorEmbed('This image is not retired.');
      await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      return;
    }

    await database.query(
      'UPDATE images SET retired = false, retired_at = NULL WHERE guild_id = $1 AND id = $2',
      [guildId, imageId]
    );

    await database.query(
      `INSERT INTO logs (guild_id, action_type, admin_id, details)
       VALUES ($1, 'image_unretired', $2, $3)`,
      [guildId, interaction.user.id, JSON.stringify({ imageId })]
    );

    const successEmbed = embedUtils.createSuccessEmbed(`Image #${imageId} has been unretired and is now active again.`);
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

    await imageManagement.viewImage(interaction, imageId);
  } catch (error) {
    console.error('Error unretiring image:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to unretire image.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

async function handleDeleteImageDirect(interaction, imageId) {
  await interaction.deferUpdate();

  try {
    const guildId = interaction.guild.id;

    const imageResult = await database.query(
      'SELECT s3_key FROM images WHERE guild_id = $1 AND id = $2',
      [guildId, imageId]
    );

    if (imageResult.rows.length === 0) {
      const errorEmbed = embedUtils.createErrorEmbed('Image not found.');
      await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      return;
    }

    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
    
    const embed = embedUtils.createBaseEmbed();
    embed.setColor(0xFF0000);
    embed.setTitle('⚠️ Confirm Permanent Deletion');
    embed.setDescription(
      `**Are you absolutely sure you want to delete image #${imageId}?**\n\n` +
      `This action will:\n` +
      `• Permanently delete the image from S3 storage\n` +
      `• Remove all database records\n` +
      `• Delete all associated votes and captions\n` +
      `• Cannot be undone\n\n` +
      `**Think carefully before proceeding!**`
    );

    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`confirm_delete_${imageId}`)
          .setLabel('Yes, Delete Forever')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('cancel_delete')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.followUp({ 
      embeds: [embed], 
      components: [buttons],
      flags: MessageFlags.Ephemeral 
    });
  } catch (error) {
    console.error('Error in delete confirmation:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to show delete confirmation.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

async function handleConfirmDelete(interaction, imageId) {
  await interaction.deferUpdate();

  try {
    const guildId = interaction.guild.id;

    const imageResult = await database.query(
      'SELECT s3_key FROM images WHERE guild_id = $1 AND id = $2',
      [guildId, imageId]
    );

    if (imageResult.rows.length === 0) {
      const errorEmbed = embedUtils.createErrorEmbed('Image not found.');
      await interaction.editReply({ embeds: [errorEmbed], components: [] });
      return;
    }

    const s3Key = imageResult.rows[0].s3_key;

    await storage.deleteImage(s3Key);

    await database.query(
      'DELETE FROM images WHERE guild_id = $1 AND id = $2',
      [guildId, imageId]
    );

    await database.query(
      `INSERT INTO logs (guild_id, action_type, admin_id, details)
       VALUES ($1, 'image_deleted', $2, $3)`,
      [guildId, interaction.user.id, JSON.stringify({ imageId, s3Key })]
    );

    const successEmbed = embedUtils.createSuccessEmbed(
      `Image #${imageId} has been permanently deleted.\n\n` +
      `The image has been removed from S3 storage and all database records have been deleted.`
    );

    await interaction.editReply({ embeds: [successEmbed], components: [] });
  } catch (error) {
    console.error('Error deleting image:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to delete image: ' + error.message);
    await interaction.editReply({ embeds: [errorEmbed], components: [] });
  }
}

export default { handleButtonInteraction };
