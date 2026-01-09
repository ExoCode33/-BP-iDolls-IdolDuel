/**
 * Complete Interaction Handler
 * Includes retirement settings, image browser, and system reset
 */

import database from '../database/database.js';
import duelManager from '../services/duel/manager.js';
import importer from '../services/image/importer.js';
import storage from '../services/image/storage.js';
import embedUtils from '../utils/embeds.js';
import systemReset from '../commands/admin/systemReset.js';
import { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export async function handleInteractions(interaction) {
  if (interaction.isButton()) {
    await handleButton(interaction);
    return;
  }

  if (interaction.isModalSubmit()) {
    await handleModal(interaction);
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
    await showImageBrowser(interaction);
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
  const guildId = interaction.guild.id;
  
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
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const guildId = interaction.guild.id;
    const retireAfterLosses = parseInt(interaction.fields.getTextInputValue('retire_after_losses'));
    const retireBelowElo = parseInt(interaction.fields.getTextInputValue('retire_below_elo'));

    // Validate
    if (isNaN(retireAfterLosses) || retireAfterLosses < 0) {
      const embed = embedUtils.createErrorEmbed('Invalid losses value! Must be 0 or greater.');
      await interaction.editReply({ embeds: [embed] });
      autoDeleteEphemeral(interaction);
      return;
    }

    if (isNaN(retireBelowElo) || retireBelowElo < 0) {
      const embed = embedUtils.createErrorEmbed('Invalid ELO value! Must be 0 or greater.');
      await interaction.editReply({ embeds: [embed] });
      autoDeleteEphemeral(interaction);
      return;
    }

    // Update database
    await database.query(
      'UPDATE guild_config SET retire_after_losses = $1, retire_below_elo = $2 WHERE guild_id = $3',
      [retireAfterLosses, retireBelowElo, guildId]
    );

    // Create success message
    let message = '✅ Auto-retirement updated!\n\n';
    
    if (retireAfterLosses > 0 && retireBelowElo > 0) {
      message += `Images will retire after:\n• ${retireAfterLosses} losses, OR\n• Falling below ${retireBelowElo} ELO`;
    } else if (retireAfterLosses > 0) {
      message += `Images will retire after ${retireAfterLosses} losses`;
    } else if (retireBelowElo > 0) {
      message += `Images will retire below ${retireBelowElo} ELO`;
    } else {
      message += 'Auto-retirement disabled';
    }

    message += '\n\nRe-open /admin to see changes.';

    const embed = embedUtils.createSuccessEmbed(message);
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction, 4000);

  } catch (error) {
    console.error('Error updating retirement settings:', error);
    const embed = embedUtils.createErrorEmbed('Failed to update retirement settings!');
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);
  }
}

/**
 * Show image browser
 */
async function showImageBrowser(interaction, page = 0) {
  const isUpdate = interaction.deferred || interaction.replied;
  
  if (!isUpdate) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }

  try {
    const guildId = interaction.guild.id;

    const offset = page * 10;
    const imagesResult = await database.query(
      `SELECT * FROM images 
       WHERE guild_id = $1 
       ORDER BY elo DESC 
       LIMIT 10 OFFSET $2`,
      [guildId, offset]
    );

    const totalResult = await database.query(
      'SELECT COUNT(*) as total FROM images WHERE guild_id = $1',
      [guildId]
    );

    const totalImages = parseInt(totalResult.rows[0].total);
    const totalPages = Math.ceil(totalImages / 10);

    if (imagesResult.rows.length === 0) {
      const embed = embedUtils.createErrorEmbed('No images found!');
      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }

    const currentImage = imagesResult.rows[0];
    const imageUrl = await storage.getImageUrl(currentImage.s3_key);

    const embed = embedUtils.createBaseEmbed();
    embed.setTitle(`🖼️ Image Browser - Image #${currentImage.id}`);
    embed.setDescription(
      `**ELO:** ${currentImage.elo}\n` +
      `**Record:** ${currentImage.wins}W - ${currentImage.losses}L\n` +
      `**Status:** ${currentImage.retired ? '🔴 Retired' : '🟢 Active'}\n` +
      `**Uploader:** <@${currentImage.uploader_id}>\n` +
      `**Imported:** <t:${Math.floor(new Date(currentImage.imported_at).getTime() / 1000)}:R>\n\n` +
      `Page ${page + 1} of ${totalPages} • ${totalImages} total images`
    );
    embed.setImage(imageUrl);

    const navRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`browse_prev_${page}`)
          .setLabel('◀ Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId(`browse_next_${page}`)
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
          .setCustomId(`image_unretire_${currentImage.id}_${page}`)
          .setLabel('♻️ Unretire')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`image_delete_${currentImage.id}_${page}`)
          .setLabel('🗑️ Delete')
          .setStyle(ButtonStyle.Danger)
      );
    } else {
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`image_retire_${currentImage.id}_${page}`)
          .setLabel('📦 Retire')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`image_delete_${currentImage.id}_${page}`)
          .setLabel('🗑️ Delete')
          .setStyle(ButtonStyle.Danger)
      );
    }

    if (isUpdate) {
      await interaction.update({ 
        embeds: [embed], 
        components: [navRow, actionRow]
      });
    } else {
      await interaction.editReply({ 
        embeds: [embed], 
        components: [navRow, actionRow]
      });
    }
  } catch (error) {
    console.error('Error showing image browser:', error);
    const embed = embedUtils.createErrorEmbed('Failed to load images!');
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

/**
 * Handle browse navigation
 */
async function handleBrowseNavigation(interaction) {
  const parts = interaction.customId.split('_');
  const action = parts[1];
  const currentPage = parseInt(parts[2] || 0);

  if (action === 'close') {
    await interaction.update({ components: [] });
    autoDeleteEphemeral(interaction);
    return;
  }

  const newPage = action === 'next' ? currentPage + 1 : currentPage - 1;
  await showImageBrowser(interaction, newPage);
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
    const guildId = interaction.guild.id;

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

    await database.query(
      'DELETE FROM images WHERE guild_id = $1 AND id = $2',
      [guildId, imageId]
    );

    const embed = embedUtils.createSuccessEmbed(`Image #${imageId} deleted!`);
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);

    await showImageBrowser(interaction.message, page);
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
    const guildId = interaction.guild.id;

    await database.query(
      'UPDATE images SET retired = true, retired_at = NOW() WHERE guild_id = $1 AND id = $2',
      [guildId, imageId]
    );

    const embed = embedUtils.createSuccessEmbed(`Image #${imageId} retired!`);
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);

    await showImageBrowser(interaction.message, page);
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
    const guildId = interaction.guild.id;

    await database.query(
      'UPDATE images SET retired = false, retired_at = NULL WHERE guild_id = $1 AND id = $2',
      [guildId, imageId]
    );

    const embed = embedUtils.createSuccessEmbed(`Image #${imageId} unretired!`);
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);

    await showImageBrowser(interaction.message, page);
  } catch (error) {
    console.error('Error unretiring image:', error);
    const embed = embedUtils.createErrorEmbed('Failed to unretire image!');
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);
  }
}

/**
 * Show schedule edit modal
 */
async function showScheduleModal(interaction) {
  const guildId = interaction.guild.id;
  
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
    .setPlaceholder('e.g., 13, 30, 60, 360')
    .setValue(currentInterval.toString())
    .setRequired(true);

  const durationInput = new TextInputBuilder()
    .setCustomId('duel_duration')
    .setLabel('Duel Duration (minutes)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 13, 30, 60, 360')
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
  const guildId = interaction.guild.id;
  
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
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const guildId = interaction.guild.id;
    const intervalMinutes = parseInt(interaction.fields.getTextInputValue('duel_interval'));
    const durationMinutes = parseInt(interaction.fields.getTextInputValue('duel_duration'));

    if (isNaN(intervalMinutes) || intervalMinutes < 1) {
      const embed = embedUtils.createErrorEmbed('Invalid interval! Must be at least 1 minute.');
      await interaction.editReply({ embeds: [embed] });
      autoDeleteEphemeral(interaction);
      return;
    }

    if (isNaN(durationMinutes) || durationMinutes < 1) {
      const embed = embedUtils.createErrorEmbed('Invalid duration! Must be at least 1 minute.');
      await interaction.editReply({ embeds: [embed] });
      autoDeleteEphemeral(interaction);
      return;
    }

    const intervalSeconds = intervalMinutes * 60;
    const durationSeconds = durationMinutes * 60;

    await database.query(
      'UPDATE guild_config SET duel_interval = $1, duel_duration = $2 WHERE guild_id = $3',
      [intervalSeconds, durationSeconds, guildId]
    );

    const embed = embedUtils.createSuccessEmbed(
      `✅ Schedule updated!\n\nInterval: ${intervalMinutes} min\nDuration: ${durationMinutes} min\n\nRe-open /admin to see changes.`
    );
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);

  } catch (error) {
    console.error('Error updating schedule:', error);
    const embed = embedUtils.createErrorEmbed('Failed to update schedule!');
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);
  }
}

/**
 * Handle ELO modal submit
 */
async function handleEloSubmit(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const guildId = interaction.guild.id;
    const startingElo = parseInt(interaction.fields.getTextInputValue('starting_elo'));
    const kFactor = parseInt(interaction.fields.getTextInputValue('k_factor'));

    if (isNaN(startingElo) || startingElo < 0) {
      const embed = embedUtils.createErrorEmbed('Invalid starting ELO!');
      await interaction.editReply({ embeds: [embed] });
      autoDeleteEphemeral(interaction);
      return;
    }

    if (isNaN(kFactor) || kFactor < 1) {
      const embed = embedUtils.createErrorEmbed('Invalid K-Factor! Must be at least 1.');
      await interaction.editReply({ embeds: [embed] });
      autoDeleteEphemeral(interaction);
      return;
    }

    await database.query(
      'UPDATE guild_config SET starting_elo = $1, k_factor = $2 WHERE guild_id = $3',
      [startingElo, kFactor, guildId]
    );

    const embed = embedUtils.createSuccessEmbed(
      `✅ ELO settings updated!\n\nStarting ELO: ${startingElo}\nK-Factor: ${kFactor}\n\nRe-open /admin to see changes.`
    );
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);

  } catch (error) {
    console.error('Error updating ELO settings:', error);
    const embed = embedUtils.createErrorEmbed('Failed to update ELO settings!');
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);
  }
}

/**
 * Handle import images modal submit
 */
async function handleImportSubmit(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const guildId = interaction.guild.id;
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
      const embed = embedUtils.createErrorEmbed('Message limit must be between 1 and 100!');
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
    progressEmbed.setTitle('📥 Importing Images...');
    progressEmbed.setDescription(`Scanning ${channel}...\n\nThis may take a moment.`);
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
      `✅ Import complete!\n\nImported: ${imported}\nSkipped: ${skipped}\n\nRe-open /admin to see stats.`
    );

    await interaction.editReply({ embeds: [successEmbed] });
    autoDeleteEphemeral(interaction, 5000);

  } catch (error) {
    console.error('Error importing images:', error);
    const embed = embedUtils.createErrorEmbed('Failed to import images!');
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);
  }
}

// Vote and duel control handlers (same as before)

async function handleVote(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const imageId = parseInt(interaction.customId.split('_')[1]);
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    const activeDuel = await duelManager.getActiveDuel(guildId);

    if (!activeDuel) {
      const embed = embedUtils.createErrorEmbed('No active duel found!');
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
        const embed = embedUtils.createErrorEmbed('You already voted for this image!');
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
    console.error('Error handling vote:', error);
    const embed = embedUtils.createErrorEmbed('Failed to record vote!');
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);
  }
}

async function handleStartDuel(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const guildId = interaction.guild.id;
    await duelManager.startDuel(guildId);

    const embed = embedUtils.createSuccessEmbed('Duel system started!');
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);
  } catch (error) {
    console.error('Error starting duel:', error);
    const embed = embedUtils.createErrorEmbed('Failed to start.');
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);
  }
}

async function handleStopDuel(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const guildId = interaction.guild.id;
    await duelManager.stopDuel(guildId);

    const embed = embedUtils.createSuccessEmbed('Duel system stopped.');
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);
  } catch (error) {
    console.error('Error stopping duel:', error);
    const embed = embedUtils.createErrorEmbed('Failed to stop.');
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);
  }
}

async function handleSkipDuel(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const guildId = interaction.guild.id;
    await duelManager.skipDuel(guildId);

    const embed = embedUtils.createSuccessEmbed('Duel skipped!');
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);
  } catch (error) {
    console.error('Error skipping duel:', error);
    const embed = embedUtils.createErrorEmbed('Failed to skip.');
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);
  }
}

async function handlePauseDuel(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const guildId = interaction.guild.id;

    await database.query(
      'UPDATE guild_config SET duel_paused = true WHERE guild_id = $1',
      [guildId]
    );

    const embed = embedUtils.createSuccessEmbed('Duel system paused.');
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);
  } catch (error) {
    console.error('Error pausing duel:', error);
    const embed = embedUtils.createErrorEmbed('Failed to pause.');
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);
  }
}

async function handleResumeDuel(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const guildId = interaction.guild.id;

    await database.query(
      'UPDATE guild_config SET duel_paused = false WHERE guild_id = $1',
      [guildId]
    );

    const embed = embedUtils.createSuccessEmbed('Duel system resumed.');
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);

    await duelManager.checkGuild(guildId);
  } catch (error) {
    console.error('Error resuming duel:', error);
    const embed = embedUtils.createErrorEmbed('Failed to resume.');
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);
  }
}

export default { handleInteractions };
