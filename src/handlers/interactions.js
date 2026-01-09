/**
 * Unified Interaction Handler
 * Routes all Discord interactions (buttons, selects, modals)
 * Clean, single source of truth for all interactions
 */

import database from '../database/database.js';
import duelManager from '../services/duel/manager.js';
import embedUtils from '../utils/embeds.js';
import { MessageFlags } from 'discord.js';

export async function handleInteractions(interaction) {
  // Button interactions
  if (interaction.isButton()) {
    await handleButton(interaction);
    return;
  }

  // Select menu interactions
  if (interaction.isStringSelectMenu()) {
    await handleSelect(interaction);
    return;
  }

  // Modal submissions
  if (interaction.isModalSubmit()) {
    await handleModal(interaction);
    return;
  }
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

  // Admin controls
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
}

/**
 * Handle select menu choices
 */
async function handleSelect(interaction) {
  const customId = interaction.customId;

  // Add handlers as needed
  // Example: if (customId === 'schedule_select') { ... }
}

/**
 * Handle modal submissions
 */
async function handleModal(interaction) {
  const customId = interaction.customId;

  // Add handlers as needed
  // Example: if (customId === 'modal_setup_channels') { ... }
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

    // Get active duel
    const activeDuel = await duelManager.getActiveDuel(guildId);

    if (!activeDuel) {
      const embed = embedUtils.createErrorEmbed('No active duel found!');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Verify image is in this duel
    if (imageId !== activeDuel.image1.id && imageId !== activeDuel.image2.id) {
      const embed = embedUtils.createErrorEmbed('Invalid vote - this image is not in the current duel!');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Check if already voted
    const existingVote = await database.query(
      'SELECT image_id FROM votes WHERE duel_id = $1 AND user_id = $2',
      [activeDuel.duelId, userId]
    );

    if (existingVote.rows.length > 0) {
      const votedImageId = existingVote.rows[0].image_id;

      if (votedImageId === imageId) {
        const embed = embedUtils.createErrorEmbed('You already voted for this image!');
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Change vote
      await database.query(
        'UPDATE votes SET image_id = $1, voted_at = NOW() WHERE duel_id = $2 AND user_id = $3',
        [imageId, activeDuel.duelId, userId]
      );

      const embed = embedUtils.createSuccessEmbed('Vote changed! ♡');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Record new vote
    await database.query(
      'INSERT INTO votes (duel_id, user_id, image_id, voted_at) VALUES ($1, $2, $3, NOW())',
      [activeDuel.duelId, userId, imageId]
    );

    const embed = embedUtils.createSuccessEmbed('Vote recorded! ♡');
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error handling vote:', error);
    const embed = embedUtils.createErrorEmbed('Failed to record vote. Please try again!');
    await interaction.editReply({ embeds: [embed] });
  }
}

/**
 * Handle start duel button
 */
async function handleStartDuel(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const guildId = interaction.guild.id;

    // Get config
    const configResult = await database.query(
      'SELECT * FROM guild_config WHERE guild_id = $1',
      [guildId]
    );

    if (configResult.rows.length === 0) {
      const embed = embedUtils.createErrorEmbed('Please run setup first!');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const config = configResult.rows[0];

    if (!config.duel_channel_id) {
      const embed = embedUtils.createErrorEmbed('Please set a duel channel first!');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Start duel
    await duelManager.startDuel(guildId);

    const embed = embedUtils.createSuccessEmbed('Duel system started!');
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error starting duel:', error);
    const embed = embedUtils.createErrorEmbed('Failed to start duel system.');
    await interaction.editReply({ embeds: [embed] });
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
  } catch (error) {
    console.error('Error stopping duel:', error);
    const embed = embedUtils.createErrorEmbed('Failed to stop duel system.');
    await interaction.editReply({ embeds: [embed] });
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

    const embed = embedUtils.createSuccessEmbed('Duel skipped! Starting next duel...');
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error skipping duel:', error);
    const embed = embedUtils.createErrorEmbed('Failed to skip duel.');
    await interaction.editReply({ embeds: [embed] });
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
  } catch (error) {
    console.error('Error pausing duel:', error);
    const embed = embedUtils.createErrorEmbed('Failed to pause duel system.');
    await interaction.editReply({ embeds: [embed] });
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

    // Check if should start a duel
    await duelManager.checkGuild(guildId);
  } catch (error) {
    console.error('Error resuming duel:', error);
    const embed = embedUtils.createErrorEmbed('Failed to resume duel system.');
    await interaction.editReply({ embeds: [embed] });
  }
}

export default { handleInteractions };
