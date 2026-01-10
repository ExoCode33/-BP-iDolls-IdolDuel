/**
 * Main Interaction Router - Clean and Simple
 */

import { handleDuelControls } from './duelControls.js';
import { handleAdminSettings } from './adminSettings.js';
import { handleImageBrowser } from './imageBrowser.js';
import { handleVoting } from './voting.js';

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
  return await handleAdminSettings(interaction);
}

async function handleSelectMenuInteraction(interaction) {
  return await handleImageBrowser(interaction);
}

export default { handleInteractions };
