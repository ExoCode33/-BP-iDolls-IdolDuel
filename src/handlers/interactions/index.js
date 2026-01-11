/**
 * Main Interaction Router - Clean and Simple
 * UPDATED: Includes System Reset handlers
 */

import { handleDuelControls } from './duelControls.js';
import { handleAdminSettings } from './adminSettings.js';
import { handleImageBrowser } from './imageBrowser.js';
import { handleVoting } from './voting.js';
import systemReset from '../../commands/admin/systemReset.js';
import embedUtils from '../../utils/embeds.js';
import { MessageFlags } from 'discord.js';

export async function handleInteractions(interaction) {
  try {
    if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModalInteraction(interaction);
    } else if (interaction.isStringSelectMenu()) {
      await handleSelectMenuInteraction(interaction);
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
  }
}

async function handleButtonInteraction(interaction) {
  const customId = interaction.customId;

  // System reset
  if (customId === 'admin_system_reset') {
    return await systemReset.showResetWarning(interaction);
  }

  if (customId === 'confirm_system_reset') {
    return await systemReset.showPasswordModal(interaction);
  }

  if (customId === 'cancel_system_reset') {
    const embed = embedUtils.createSuccessEmbed('System reset cancelled.');
    await interaction.update({ embeds: [embed], components: [] });
    return;
  }

  // Voting
  if (customId.startsWith('vote_')) {
    return await handleVoting(interaction);
  }

  // Duel controls
  if (customId.startsWith('admin_start_') || 
      customId.startsWith('admin_stop_') || 
      customId.startsWith('admin_skip_') || 
      customId.startsWith('admin_pause_') || 
      customId.startsWith('admin_resume_')) {
    return await handleDuelControls(interaction);
  }

  // Admin settings
  if (customId.startsWith('admin_edit_') || customId.startsWith('admin_import_')) {
    return await handleAdminSettings(interaction);
  }

  // Image browser
  if (customId.startsWith('browse_') || 
      customId.startsWith('image_') || 
      customId.startsWith('admin_browse_')) {
    return await handleImageBrowser(interaction);
  }
}

async function handleModalInteraction(interaction) {
  // System reset modal
  if (interaction.customId === 'modal_system_reset') {
    const password = interaction.fields.getTextInputValue('reset_password');
    const confirmation = interaction.fields.getTextInputValue('reset_confirmation');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    return await systemReset.executeReset(interaction, password, confirmation);
  }

  // Other modals
  return await handleAdminSettings(interaction);
}

async function handleSelectMenuInteraction(interaction) {
  return await handleImageBrowser(interaction);
}

export default { handleInteractions };
