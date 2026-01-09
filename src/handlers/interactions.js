/**
 * Enhanced Interaction Handler
 * Auto-deletes ephemeral messages after 3 seconds
 * Refreshes admin panel after settings changes
 */

import database from '../database/database.js';
import duelManager from '../services/duel/manager.js';
import importer from '../services/image/importer.js';
import embedUtils from '../utils/embeds.js';
import adminCommand from '../commands/admin/admin.js';
import { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

export async function handleInteractions(interaction) {
  // Button interactions
  if (interaction.isButton()) {
    await handleButton(interaction);
    return;
  }

  // Modal submissions
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
      // Message already deleted or interaction expired
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

  if (customId === 'admin_import_images') {
    await showImportModal(interaction);
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

  if (customId === 'modal_import_images') {
    await handleImportSubmit(interaction);
    return;
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

    // Validate
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

    // Convert to seconds
    const intervalSeconds = intervalMinutes * 60;
    const durationSeconds = durationMinutes * 60;

    // Update database
    await database.query(
      'UPDATE guild_config SET duel_interval = $1, duel_duration = $2 WHERE guild_id = $3',
      [intervalSeconds, durationSeconds, guildId]
    );

    // Show success message
    const embed = embedUtils.createSuccessEmbed(
      `Schedule updated to ${intervalMinutes} min!\n\nRestart duels for changes to take effect.`
    );
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);

    // Refresh admin panel in original message
    const originalMessage = await interaction.channel.messages.fetch(interaction.message.id);
    if (originalMessage) {
      await adminCommand.showAdminPanel({ 
        guild: interaction.guild,
        editReply: async (data) => {
          await originalMessage.edit(data);
        }
      }, true);
    }
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

    // Validate
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

    // Update database
    await database.query(
      'UPDATE guild_config SET starting_elo = $1, k_factor = $2 WHERE guild_id = $3',
      [startingElo, kFactor, guildId]
    );

    // Show success message
    const embed = embedUtils.createSuccessEmbed(
      `ELO settings updated!\n\nStarting ELO: ${startingElo}\nK-Factor: ${kFactor}`
    );
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);

    // Refresh admin panel
    const originalMessage = await interaction.channel.messages.fetch(interaction.message.id);
    if (originalMessage) {
      await adminCommand.showAdminPanel({ 
        guild: interaction.guild,
        editReply: async (data) => {
          await originalMessage.edit(data);
        }
      }, true);
    }
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

    // Extract channel ID from mention or use directly
    const channelIdMatch = channelInput.match(/(\d+)/);
    if (!channelIdMatch) {
      const embed = embedUtils.createErrorEmbed('Invalid channel! Please provide a channel ID or mention.');
      await interaction.editReply({ embeds: [embed] });
      autoDeleteEphemeral(interaction);
      return;
    }

    const channelId = channelIdMatch[1];

    // Validate limit
    if (isNaN(messageLimit) || messageLimit < 1 || messageLimit > 100) {
      const embed = embedUtils.createErrorEmbed('Message limit must be between 1 and 100!');
      await interaction.editReply({ embeds: [embed] });
      autoDeleteEphemeral(interaction);
      return;
    }

    // Get channel
    const channel = await interaction.guild.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      const embed = embedUtils.createErrorEmbed('Invalid channel or bot cannot access it!');
      await interaction.editReply({ embeds: [embed] });
      autoDeleteEphemeral(interaction);
      return;
    }

    const progressEmbed = embedUtils.createBaseEmbed();
    progressEmbed.setTitle('📥 Importing Images...');
    progressEmbed.setDescription(`Scanning ${channel} for images...\n\nThis may take a moment.`);
    await interaction.editReply({ embeds: [progressEmbed] });

    // Fetch messages
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
      `Import complete!\n\n✅ Imported: ${imported}\n⏭️ Skipped: ${skipped}`
    );

    await interaction.editReply({ embeds: [successEmbed] });
    autoDeleteEphemeral(interaction, 5000); // 5 seconds for import success

    // Refresh admin panel
    const originalMessage = await interaction.channel.messages.fetch(interaction.message.id);
    if (originalMessage) {
      await adminCommand.showAdminPanel({ 
        guild: interaction.guild,
        editReply: async (data) => {
          await originalMessage.edit(data);
        }
      }, true);
    }
  } catch (error) {
    console.error('Error importing images:', error);
    const embed = embedUtils.createErrorEmbed('Failed to import images! Check bot permissions.');
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);
  }
}

/**
 * Handle vote button
 */
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

/**
 * Handle start duel button
 */
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
    const embed = embedUtils.createErrorEmbed('Failed to start duel system.');
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);
  }
}

/**
 * Handle stop duel button
 */
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
    const embed = embedUtils.createErrorEmbed('Failed to stop duel system.');
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);
  }
}

/**
 * Handle skip duel button
 */
async function handleSkipDuel(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const guildId = interaction.guild.id;
    await duelManager.skipDuel(guildId);

    const embed = embedUtils.createSuccessEmbed('Duel skipped! Starting next...');
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);
  } catch (error) {
    console.error('Error skipping duel:', error);
    const embed = embedUtils.createErrorEmbed('Failed to skip duel.');
    await interaction.editReply({ embeds: [embed] });
    autoDeleteEphemeral(interaction);
  }
}

/**
 * Handle pause duel button
 */
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

/**
 * Handle resume duel button
 */
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
