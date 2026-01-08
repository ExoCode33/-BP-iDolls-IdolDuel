import duelManager from '../services/duelManager.js';
import database from '../database/database.js';
import embedUtils from '../utils/embeds.js';
import adminConfig from '../commands/admin/config.js';
import leaderboardCmd from '../commands/user/leaderboard.js';
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

  // Admin buttons - image management
  if (customId === 'admin_import_images') {
    await interaction.showModal(adminConfig.createImportChannelsModal());
    return;
  }

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

  if (customId === 'admin_back_image_mgmt') {
    await interaction.deferUpdate();
    const config = await adminConfig.getOrCreateConfig(interaction.guild.id);
    await adminConfig.handleImageManagement(interaction, config);
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
    const imageUrl = await storage.getImageUrl(image.s3_key); // AWAIT added for signed URLs
    
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
    // Set both thumbnail AND image for better display
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
    const imageUrl = await storage.getImageUrl(image.s3_key); // AWAIT added for signed URLs
    
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
    // Set both thumbnail AND image for better display
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

export default { handleButtonInteraction };
