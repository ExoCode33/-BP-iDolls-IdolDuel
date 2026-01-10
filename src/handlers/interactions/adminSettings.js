/**
 * Admin Settings Handlers
 * Schedule, ELO, Retirement, Import modals
 */

import database from '../../database/database.js';
import embedUtils from '../../utils/embeds.js';
import importer from '../../services/image/importer.js';
import { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

export async function handleAdminSettings(interaction) {
  const customId = interaction.customId;

  // Button handlers (show modals)
  if (customId === 'admin_edit_schedule') {
    return await showScheduleModal(interaction);
  }

  if (customId === 'admin_edit_elo') {
    return await showEloModal(interaction);
  }

  if (customId === 'admin_edit_retirement') {
    return await showRetirementModal(interaction);
  }

  if (customId === 'admin_import_images') {
    return await showImportModal(interaction);
  }

  // Modal submit handlers
  if (customId === 'modal_edit_schedule') {
    return await handleScheduleSubmit(interaction);
  }

  if (customId === 'modal_edit_elo') {
    return await handleEloSubmit(interaction);
  }

  if (customId === 'modal_edit_retirement') {
    return await handleRetirementSubmit(interaction);
  }

  if (customId === 'modal_import_images') {
    return await handleImportSubmit(interaction);
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

// ════════════════════════════════════════════════════════════
// SCHEDULE SETTINGS
// ════════════════════════════════════════════════════════════

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

    const adminCommand = (await import('../../commands/admin/admin.js')).default;
    await adminCommand.showAdminPanel(interaction, true);
    
    console.log(`⏱️ Schedule updated for guild ${guildId}`);
  } catch (error) {
    console.error('Error updating schedule:', error);
    const embed = embedUtils.createErrorEmbed('Failed to update!');
    await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

// ════════════════════════════════════════════════════════════
// ELO SETTINGS
// ════════════════════════════════════════════════════════════

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

    const adminCommand = (await import('../../commands/admin/admin.js')).default;
    await adminCommand.showAdminPanel(interaction, true);
    
    console.log(`📊 ELO settings updated for guild ${guildId}`);
  } catch (error) {
    console.error('Error updating ELO:', error);
    const embed = embedUtils.createErrorEmbed('Failed to update!');
    await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

// ════════════════════════════════════════════════════════════
// RETIREMENT SETTINGS
// ════════════════════════════════════════════════════════════

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

    const adminCommand = (await import('../../commands/admin/admin.js')).default;
    await adminCommand.showAdminPanel(interaction, true);
    
    console.log(`🗑️ Retirement settings updated for guild ${guildId}`);
  } catch (error) {
    console.error('Error updating retirement settings:', error);
    const embed = embedUtils.createErrorEmbed('Failed to update!');
    await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

// ════════════════════════════════════════════════════════════
// IMAGE IMPORT
// ════════════════════════════════════════════════════════════

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
