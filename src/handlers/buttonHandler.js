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

  if (customId === 'admin_pause_duel') {
    await handlePauseDuelButton(interaction);
    return;
  }

  if (customId === 'admin_resume_duel') {
    await handleResumeDuelButton(interaction);
    return;
  }

  if (customId === 'admin_skip_duel') {
    await handleSkipDuelButton(interaction);
    return;
  }

  // Admin buttons - image management
  if (customId === 'admin_image_management') {
    await interaction.deferUpdate();
    const config = await adminConfig.getOrCreateConfig(interaction.guild.id);
    await imageManagement.showImageManagement(interaction, config);
    return;
  }

  if (customId === 'admin_import_images') {
    await interaction.showModal(adminConfig.createImportChannelsModal());
    return;
  }

  // NEW: Start gallery view
  if (customId === 'start_gallery_view') {
    await imageManagement.showGallery(interaction, 0, 'elo', 'all');
    return;
  }

  // NEW: Gallery actions
  if (customId.startsWith('gallery_')) {
    await handleGalleryActions(interaction);
    return;
  }

  // NEW: Quick bulk operations
  if (customId === 'quick_bulk_retire') {
    await imageManagement.showQuickBulkRetire(interaction);
    return;
  }

  if (customId === 'quick_bulk_unretire') {
    await imageManagement.showQuickBulkUnretire(interaction);
    return;
  }

  if (customId.startsWith('bulk_retire_')) {
    const threshold = customId === 'bulk_retire_custom' ? null : parseInt(customId.split('_')[2]);
    if (threshold) {
      await imageManagement.executeBulkRetire(interaction, threshold);
    } else {
      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
      const modal = new ModalBuilder()
        .setCustomId('modal_bulk_retire_custom')
        .setTitle('Custom ELO Threshold');
      
      const input = new TextInputBuilder()
        .setCustomId('threshold')
        .setLabel('Retire all images below this ELO')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., 950')
        .setRequired(true);
      
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }
    return;
  }

  if (customId.startsWith('bulk_unretire_')) {
    const threshold = customId === 'bulk_unretire_custom' ? null : parseInt(customId.split('_')[2]);
    if (threshold) {
      await imageManagement.executeBulkUnretire(interaction, threshold);
    } else {
      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
      const modal = new ModalBuilder()
        .setCustomId('modal_bulk_unretire_custom')
        .setTitle('Custom ELO Threshold');
      
      const input = new TextInputBuilder()
        .setCustomId('threshold')
        .setLabel('Unretire all images above this ELO')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., 1050')
        .setRequired(true);
      
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }
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

  if (customId === 'admin_bulk_unretire') {
    await imageManagement.showBulkUnretire(interaction);
    return;
  }

  if (customId === 'admin_export_stats') {
    await handleExportStats(interaction);
    return;
  }

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

  // Admin logs navigation
  if (customId.startsWith('logs_')) {
    await handleLogsNavigation(interaction);
    return;
  }

  if (customId === 'admin_list_images') {
    await imageManagement.listImages(interaction);
    return;
  }

  if (customId === 'admin_view_logs') {
    await adminLogs.showLogs(interaction);
    return;
  }

  // NEW: Quick setup navigation
  if (customId === 'admin_set_schedule_preset') {
    await interaction.deferUpdate();
    const config = await adminConfig.getOrCreateConfig(interaction.guild.id);
    await adminConfig.showSchedulePresets(interaction, config);
    return;
  }

  if (customId === 'admin_set_import_channel') {
    await interaction.showModal(adminConfig.createImportChannelsModal());
    return;
  }

  // NEW: Smart retirement
  if (customId === 'retirement_enable_smart') {
    await interaction.deferUpdate();
    
    await database.query(
      'UPDATE guild_config SET losses_before_retirement = NULL WHERE guild_id = $1',
      [interaction.guild.id]
    );
    
    const successEmbed = embedUtils.createSuccessEmbed('Smart retirement enabled!');
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
    
    const config = await adminConfig.getOrCreateConfig(interaction.guild.id);
    await adminConfig.showRetirementSettings(interaction, config);
    return;
  }

  if (customId === 'retirement_set_manual') {
    await interaction.showModal(adminConfig.createLossesRetirementModal());
    return;
  }

  // NEW: Auto-approve toggle
  if (customId === 'import_toggle_auto_approve') {
    await interaction.deferUpdate();
    
    const result = await database.query(
      'SELECT auto_approve_images FROM guild_config WHERE guild_id = $1',
      [interaction.guild.id]
    );
    
    const currentValue = result.rows[0].auto_approve_images;
    
    await database.query(
      'UPDATE guild_config SET auto_approve_images = $1 WHERE guild_id = $2',
      [!currentValue, interaction.guild.id]
    );
    
    const successEmbed = embedUtils.createSuccessEmbed(
      `Auto-approve ${!currentValue ? 'enabled' : 'disabled'}!`
    );
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
    
    const config = await adminConfig.getOrCreateConfig(interaction.guild.id);
    await adminConfig.showImportSettings(interaction, config);
    return;
  }

  // Admin buttons - advanced settings (keeping for compatibility)
  if (customId === 'admin_basic_settings') {
    await interaction.deferUpdate();
    const config = await adminConfig.getOrCreateConfig(interaction.guild.id);
    await adminConfig.handleBasicSettings(interaction, config);
    return;
  }

  if (customId === 'admin_elo_settings') {
    await interaction.deferUpdate();
    const config = await adminConfig.getOrCreateConfig(interaction.guild.id);
    await adminConfig.handleEloSettings(interaction, config);
    return;
  }

  if (customId === 'admin_retirement_settings') {
    await interaction.deferUpdate();
    const config = await adminConfig.getOrCreateConfig(interaction.guild.id);
    await adminConfig.handleRetirementSettings(interaction, config);
    return;
  }

  if (customId === 'admin_import_settings') {
    await interaction.deferUpdate();
    const config = await adminConfig.getOrCreateConfig(interaction.guild.id);
    await adminConfig.handleImportSettings(interaction, config);
    return;
  }

  if (customId === 'admin_dangerous_actions') {
    await interaction.deferUpdate();
    const config = await adminConfig.getOrCreateConfig(interaction.guild.id);
    await adminConfig.handleDangerousActions(interaction, config);
    return;
  }

  if (customId === 'admin_season_reset') {
    await interaction.showModal(adminConfig.createSeasonResetModal());
    return;
  }

  if (customId === 'admin_system_reset') {
    await interaction.showModal(adminConfig.createSystemResetModal());
    return;
  }

  if (customId === 'admin_set_elo_threshold') {
    await interaction.showModal(adminConfig.createEloThresholdModal());
    return;
  }

  if (customId === 'admin_clear_elo_threshold') {
    await handleClearEloThreshold(interaction);
    return;
  }
}

// Helper function: Handle vote button
async function handleVoteButton(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const imageId = parseInt(interaction.customId.split('_')[2]);
    const guildId = interaction.guild.id;

    // Get active duel
    const activeDuelResult = await database.query(
      'SELECT duel_id, image1_id, image2_id FROM active_duels WHERE guild_id = $1',
      [guildId]
    );

    if (activeDuelResult.rows.length === 0) {
      const errorEmbed = embedUtils.createErrorEmbed('No active duel found.');
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    const { duel_id, image1_id, image2_id } = activeDuelResult.rows[0];

    // Check if image is in this duel
    if (imageId !== image1_id && imageId !== image2_id) {
      const errorEmbed = embedUtils.createErrorEmbed('Invalid vote - this image is not in the current duel.');
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    // Check if user already voted
    const existingVote = await database.query(
      'SELECT image_id FROM votes WHERE duel_id = $1 AND user_id = $2',
      [duel_id, interaction.user.id]
    );

    if (existingVote.rows.length > 0) {
      const votedImageId = existingVote.rows[0].image_id;
      
      if (votedImageId === imageId) {
        const errorEmbed = embedUtils.createErrorEmbed('You already voted for this image!');
        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      // Change vote
      await database.query(
        'UPDATE votes SET image_id = $1, voted_at = NOW() WHERE duel_id = $2 AND user_id = $3',
        [imageId, duel_id, interaction.user.id]
      );

      const successEmbed = embedUtils.createSuccessEmbed('Vote changed! ♡');
      await interaction.editReply({ embeds: [successEmbed] });

      // Update duel message
      await duelManager.updateDuelMessage(guildId);
      return;
    }

    // Record new vote
    await database.query(
      'INSERT INTO votes (duel_id, user_id, image_id) VALUES ($1, $2, $3)',
      [duel_id, interaction.user.id, imageId]
    );

    // Update user voting stats
    await database.query(
      `INSERT INTO users (guild_id, user_id, total_votes_cast)
       VALUES ($1, $2, 1)
       ON CONFLICT (guild_id, user_id)
       DO UPDATE SET total_votes_cast = users.total_votes_cast + 1`,
      [guildId, interaction.user.id]
    );

    const successEmbed = embedUtils.createSuccessEmbed('Vote recorded! ♡');
    await interaction.editReply({ embeds: [successEmbed] });

    // Update duel message
    await duelManager.updateDuelMessage(guildId);
  } catch (error) {
    console.error('Error handling vote:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to record vote.');
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

// Helper function: Handle caption button
async function handleCaptionButton(interaction) {
  const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
  
  const modal = new ModalBuilder()
    .setCustomId('modal_add_caption')
    .setTitle('Add Caption');

  const captionInput = new TextInputBuilder()
    .setCustomId('caption_text')
    .setLabel('Your caption')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Enter a fun caption for this image...')
    .setRequired(true)
    .setMaxLength(500);

  modal.addComponents(new ActionRowBuilder().addComponents(captionInput));
  await interaction.showModal(modal);
}

// Helper function: Handle start duel button
async function handleStartDuelButton(interaction) {
  await interaction.deferUpdate();

  try {
    const guildId = interaction.guild.id;
    
    // Get config
    const config = await adminConfig.getOrCreateConfig(guildId);
    
    if (!config.duel_channel_id) {
      const errorEmbed = embedUtils.createErrorEmbed('Please set a duel channel first!');
      await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      return;
    }

    // Start duel system
    await duelManager.startDuelSystem(guildId, interaction.client);
    
    const successEmbed = embedUtils.createSuccessEmbed('Duel system started! ♡');
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

    // Refresh main menu
    const newConfig = await adminConfig.getOrCreateConfig(guildId);
    await adminConfig.showMainMenu(interaction, newConfig);
  } catch (error) {
    console.error('Error starting duel:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to start duel system: ' + error.message);
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

// Helper function: Handle stop duel button
async function handleStopDuelButton(interaction) {
  await interaction.deferUpdate();

  try {
    const guildId = interaction.guild.id;
    
    await duelManager.stopDuelSystem(guildId);
    
    const successEmbed = embedUtils.createSuccessEmbed('Duel system stopped.');
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

    // Refresh main menu
    const config = await adminConfig.getOrCreateConfig(guildId);
    await adminConfig.showMainMenu(interaction, config);
  } catch (error) {
    console.error('Error stopping duel:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to stop duel system.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

// Helper function: Handle pause duel button
async function handlePauseDuelButton(interaction) {
  await interaction.deferUpdate();

  try {
    const guildId = interaction.guild.id;
    
    await database.query(
      'UPDATE guild_config SET duel_paused = true WHERE guild_id = $1',
      [guildId]
    );
    
    const successEmbed = embedUtils.createSuccessEmbed('Duel system paused.');
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

    // Refresh main menu
    const config = await adminConfig.getOrCreateConfig(guildId);
    await adminConfig.showMainMenu(interaction, config);
  } catch (error) {
    console.error('Error pausing duel:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to pause duel system.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

// Helper function: Handle resume duel button
async function handleResumeDuelButton(interaction) {
  await interaction.deferUpdate();

  try {
    const guildId = interaction.guild.id;
    
    await database.query(
      'UPDATE guild_config SET duel_paused = false WHERE guild_id = $1',
      [guildId]
    );
    
    const successEmbed = embedUtils.createSuccessEmbed('Duel system resumed.');
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

    // Refresh main menu
    const config = await adminConfig.getOrCreateConfig(guildId);
    await adminConfig.showMainMenu(interaction, config);
  } catch (error) {
    console.error('Error resuming duel:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to resume duel system.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

// Helper function: Handle skip duel button  
async function handleSkipDuelButton(interaction) {
  await interaction.deferUpdate();

  try {
    const guildId = interaction.guild.id;
    
    // End current duel without winner (will trigger new duel with NEW images)
    await duelManager.endCurrentDuel(guildId, null);
    
    const successEmbed = embedUtils.createSuccessEmbed('Current duel skipped! Starting next duel...');
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

    // Refresh main menu
    const config = await adminConfig.getOrCreateConfig(guildId);
    await adminConfig.showMainMenu(interaction, config);
  } catch (error) {
    console.error('Error skipping duel:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to skip duel: ' + error.message);
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

// Helper function: Handle export stats
async function handleExportStats(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const guildId = interaction.guild.id;
    
    // Get all images with stats
    const result = await database.query(
      `SELECT id, elo, wins, losses, current_streak, best_streak, total_votes_received, 
              retired, uploader_id, imported_at
       FROM images 
       WHERE guild_id = $1 
       ORDER BY elo DESC`,
      [guildId]
    );

    if (result.rows.length === 0) {
      const errorEmbed = embedUtils.createErrorEmbed('No images to export.');
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    // Create CSV
    const headers = 'ID,ELO,Wins,Losses,Win Rate,Current Streak,Best Streak,Total Votes,Status,Uploader ID,Import Date\n';
    const rows = result.rows.map(img => {
      const winRate = img.wins + img.losses > 0 
        ? ((img.wins / (img.wins + img.losses)) * 100).toFixed(1)
        : '0.0';
      const status = img.retired ? 'Retired' : 'Active';
      return `${img.id},${img.elo},${img.wins},${img.losses},${winRate},${img.current_streak},${img.best_streak},${img.total_votes_received},${status},${img.uploader_id},${img.imported_at}`;
    }).join('\n');

    const csv = headers + rows;
    
    // Create buffer and send as attachment
    const buffer = Buffer.from(csv, 'utf-8');
    const { AttachmentBuilder } = await import('discord.js');
    const attachment = new AttachmentBuilder(buffer, { name: 'image_stats.csv' });

    const successEmbed = embedUtils.createSuccessEmbed(
      `Exported stats for ${result.rows.length} images!`
    );

    await interaction.editReply({ embeds: [successEmbed], files: [attachment] });
  } catch (error) {
    console.error('Error exporting stats:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to export stats.');
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

// Helper function: Handle browse navigation
async function handleBrowseNavigation(interaction) {
  await interaction.deferUpdate();

  try {
    const customId = interaction.customId;
    const content = interaction.message.content;
    const match = content.match(/__BROWSE_STATE:(.+?)__/);
    
    if (!match) {
      const errorEmbed = embedUtils.createErrorEmbed('Navigation state lost. Please browse again.');
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    const state = JSON.parse(match[1]);
    let { page, sortBy, filterActive } = state;

    if (customId === 'browse_images_first') {
      page = 1;
    } else if (customId === 'browse_images_prev') {
      page--;
    } else if (customId === 'browse_images_next') {
      page++;
    } else if (customId === 'browse_images_last') {
      // Get total pages
      const guildId = interaction.guild.id;
      let filterClause = '';
      if (filterActive === 'active') filterClause = 'AND retired = false';
      if (filterActive === 'retired') filterClause = 'AND retired = true';
      
      const countResult = await database.query(
        `SELECT COUNT(*) as total FROM images WHERE guild_id = $1 ${filterClause}`,
        [guildId]
      );
      const totalItems = parseInt(countResult.rows[0].total);
      page = Math.ceil(totalItems / 25);
    }

    await imageManagement.browseImages(interaction, page, sortBy, filterActive);
  } catch (error) {
    console.error('Error navigating browse:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Navigation error.');
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

// Helper function: Handle logs navigation
async function handleLogsNavigation(interaction) {
  const customId = interaction.customId;
  
  if (customId === 'logs_prev') {
    await adminLogs.handlePrevPage(interaction);
  } else if (customId === 'logs_next') {
    await adminLogs.handleNextPage(interaction);
  }
}

// Helper function: Clear ELO threshold
async function handleClearEloThreshold(interaction) {
  await interaction.deferUpdate();

  try {
    const guildId = interaction.guild.id;
    
    await database.query(
      'UPDATE guild_config SET elo_clear_threshold = NULL WHERE guild_id = $1',
      [guildId]
    );

    const successEmbed = embedUtils.createSuccessEmbed('ELO threshold cleared.');
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

    // Refresh settings page
    const config = await adminConfig.getOrCreateConfig(guildId);
    await adminConfig.handleRetirementSettings(interaction, config);
  } catch (error) {
    console.error('Error clearing ELO threshold:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to clear ELO threshold.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

// Helper function: Clear log channel
async function handleClearLogChannel(interaction) {
  await interaction.deferUpdate();

  try {
    const guildId = interaction.guild.id;
    
    await database.query(
      'UPDATE guild_config SET log_channel_id = NULL WHERE guild_id = $1',
      [guildId]
    );

    const successEmbed = embedUtils.createSuccessEmbed('Log channel disabled.');
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

// NEW GALLERY HANDLER
async function handleGalleryActions(interaction) {
  const customId = interaction.customId;
  const content = interaction.message.content;
  const match = content.match(/__GALLERY:(.+?)__/);
  
  if (!match) {
    await interaction.reply({ 
      content: 'Session expired. Please start over.', 
      flags: MessageFlags.Ephemeral 
    });
    return;
  }
  
  const state = JSON.parse(match[1]);
  let { index, sortBy, filterActive, imageId } = state;

  if (customId === 'gallery_first') {
    await imageManagement.showGallery(interaction, 0, sortBy, filterActive);
    return;
  }
  
  if (customId === 'gallery_prev') {
    await imageManagement.showGallery(interaction, index - 1, sortBy, filterActive);
    return;
  }
  
  if (customId === 'gallery_next') {
    await imageManagement.showGallery(interaction, index + 1, sortBy, filterActive);
    return;
  }
  
  if (customId === 'gallery_last') {
    const guildId = interaction.guild.id;
    let filterClause = '';
    if (filterActive === 'active') filterClause = 'AND retired = false';
    if (filterActive === 'retired') filterClause = 'AND retired = true';
    
    const result = await database.query(
      `SELECT COUNT(*) as total FROM images WHERE guild_id = $1 ${filterClause}`,
      [guildId]
    );
    const total = parseInt(result.rows[0].total);
    await imageManagement.showGallery(interaction, total - 1, sortBy, filterActive);
    return;
  }

  if (customId === 'gallery_toggle_retire') {
    await interaction.deferUpdate();
    
    const guildId = interaction.guild.id;
    
    const result = await database.query(
      'SELECT retired FROM images WHERE guild_id = $1 AND id = $2',
      [guildId, imageId]
    );
    
    const isRetired = result.rows[0].retired;
    
    if (isRetired) {
      await database.query(
        'UPDATE images SET retired = false, retired_at = NULL WHERE guild_id = $1 AND id = $2',
        [guildId, imageId]
      );
      
      await database.query(
        `INSERT INTO logs (guild_id, action_type, admin_id, details)
         VALUES ($1, 'image_unretired', $2, $3)`,
        [guildId, interaction.user.id, JSON.stringify({ imageId })]
      );
      
      const embed = embedUtils.createSuccessEmbed(`✅ Image #${imageId} unretired!`);
      await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else {
      await database.query(
        'UPDATE images SET retired = true, retired_at = NOW() WHERE guild_id = $1 AND id = $2',
        [guildId, imageId]
      );
      
      await database.query(
        `INSERT INTO logs (guild_id, action_type, admin_id, details)
         VALUES ($1, 'image_retired', $2, $3)`,
        [guildId, interaction.user.id, JSON.stringify({ imageId, method: 'manual' })]
      );
      
      const embed = embedUtils.createSuccessEmbed(`✅ Image #${imageId} retired!`);
      await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
    
    await imageManagement.showGallery(interaction, index, sortBy, filterActive);
    return;
  }

  if (customId === 'gallery_delete_confirm') {
    await imageManagement.showDeleteConfirmation(interaction, imageId, state);
    return;
  }

  if (customId === 'gallery_delete_yes') {
    await interaction.deferUpdate();
    
    const guildId = interaction.guild.id;
    
    const result = await database.query(
      'SELECT s3_key FROM images WHERE guild_id = $1 AND id = $2',
      [guildId, imageId]
    );
    
    if (result.rows.length === 0) {
      const embed = embedUtils.createErrorEmbed('Image not found.');
      await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }
    
    const s3Key = result.rows[0].s3_key;
    
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
    
    const embed = embedUtils.createSuccessEmbed(`🔥 Image #${imageId} permanently deleted!`);
    await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
    
    const newIndex = index > 0 ? index - 1 : 0;
    await imageManagement.showGallery(interaction, newIndex, sortBy, filterActive);
    return;
  }

  if (customId === 'gallery_delete_cancel') {
    await imageManagement.showGallery(interaction, index, sortBy, filterActive);
    return;
  }

  if (customId === 'gallery_jump') {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
    const modal = new ModalBuilder()
      .setCustomId('modal_gallery_jump')
      .setTitle('Jump to Image');
    
    const input = new TextInputBuilder()
      .setCustomId('jump_index')
      .setLabel('Image number')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter 1 to jump to first image')
      .setRequired(true);
    
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
    return;
  }

  if (customId === 'gallery_exit') {
    const guildId = interaction.guild.id;
    const config = await database.query(
      'SELECT * FROM guild_config WHERE guild_id = $1',
      [guildId]
    );
    await imageManagement.showImageManagement(interaction, config.rows[0]);
    return;
  }
}

export default { handleButtonInteraction };
