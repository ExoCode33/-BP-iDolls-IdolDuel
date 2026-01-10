/**
 * Duel Control Handlers
 * START, STOP, SKIP, PAUSE, RESUME
 */

import duelManager from '../../services/duel/manager.js';
import embedUtils from '../../utils/embeds.js';
import { MessageFlags } from 'discord.js';

export async function handleDuelControls(interaction) {
  const customId = interaction.customId;

  if (customId === 'admin_start_duel') {
    return await handleStartDuel(interaction);
  }

  if (customId === 'admin_stop_duel') {
    return await handleStopDuel(interaction);
  }

  if (customId === 'admin_skip_duel') {
    return await handleSkipDuel(interaction);
  }

  if (customId === 'admin_pause_duel') {
    return await handlePauseDuel(interaction);
  }

  if (customId === 'admin_resume_duel') {
    return await handleResumeDuel(interaction);
  }
}

async function handleStartDuel(interaction) {
  try {
    const guildId = interaction.guild.id.toString();
    await duelManager.startDuel(guildId);

    const adminCommand = (await import('../../commands/admin/admin.js')).default;
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

    const adminCommand = (await import('../../commands/admin/admin.js')).default;
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

    const adminCommand = (await import('../../commands/admin/admin.js')).default;
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
    await duelManager.pauseDuel(guildId);

    const adminCommand = (await import('../../commands/admin/admin.js')).default;
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
    await duelManager.resumeDuel(guildId);

    const adminCommand = (await import('../../commands/admin/admin.js')).default;
    await adminCommand.showAdminPanel(interaction, true);
    
    console.log(`▶️ Duel system resumed for guild ${guildId}`);
  } catch (error) {
    console.error('Error resuming:', error);
    const embed = embedUtils.createErrorEmbed('Failed to resume.');
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}
