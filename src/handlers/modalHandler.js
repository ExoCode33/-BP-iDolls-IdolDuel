import database from '../database/database.js';
import storage from '../services/storage.js';
import embedUtils from '../utils/embeds.js';
import adminConfig from '../commands/admin/config.js';
import imageManagement from '../commands/admin/imageManagement.js';
import eloService from '../services/elo.js';
import duelManager from '../services/duelManager.js';
import { MessageFlags } from 'discord.js';

export async function handleModalSubmit(interaction) {
  const modalId = interaction.customId;

  // Admin modals
  if (modalId === 'modal_k_factor') {
    await handleKFactorModal(interaction);
    return;
  }

  if (modalId === 'modal_starting_elo') {
    await handleStartingEloModal(interaction);
    return;
  }

  if (modalId === 'modal_duel_duration') {
    await handleDuelDurationModal(interaction);
    return;
  }

  if (modalId === 'modal_duel_interval') {
    await handleDuelIntervalModal(interaction);
    return;
  }

  if (modalId === 'modal_min_votes') {
    await handleMinVotesModal(interaction);
    return;
  }

  if (modalId === 'modal_losses_retirement') {
    await handleLossesRetirementModal(interaction);
    return;
  }

  if (modalId === 'modal_wildcard_chance') {
    await handleWildcardChanceModal(interaction);
    return;
  }

  if (modalId === 'modal_duel_channel') {
    await handleDuelChannelModal(interaction);
    return;
  }

  if (modalId === 'modal_import_channels') {
    await handleImportChannelsModal(interaction);
    return;
  }

  if (modalId === 'modal_elo_threshold') {
    await handleEloThresholdModal(interaction);
    return;
  }

  if (modalId === 'modal_season_reset') {
    await handleSeasonResetModal(interaction);
    return;
  }

  if (modalId === 'modal_add_caption') {
    await handleAddCaptionModal(interaction);
    return;
  }

  if (modalId === 'modal_system_reset') {
    await handleSystemResetModal(interaction);
    return;
  }

  // NEW: Image management modals
  if (modalId === 'modal_filter_images') {
    const filters = {
      eloMin: interaction.fields.getTextInputValue('elo_min'),
      eloMax: interaction.fields.getTextInputValue('elo_max'),
      uploaderId: interaction.fields.getTextInputValue('uploader_id')
    };
    await imageManagement.handleFilterResults(interaction, filters);
    return;
  }

  if (modalId === 'modal_bulk_retire') {
    await handleBulkRetireModal(interaction);
    return;
  }

  // NEW: Log channel modal
  if (modalId === 'modal_log_channel') {
    await handleLogChannelModal(interaction);
    return;
  }

  // NEW: View image modal
  if (modalId === 'modal_view_image') {
    await handleViewImageModal(interaction);
    return;
  }

  // NEW: Retire image modal
  if (modalId === 'modal_retire_image') {
    await handleRetireImageModal(interaction);
    return;
  }

  // NEW: Unretire image modal
  if (modalId === 'modal_unretire_image') {
    await handleUnretireImageModal(interaction);
    return;
  }

  // NEW: Delete image modal
  if (modalId === 'modal_delete_image') {
    await handleDeleteImageModal(interaction);
    return;
  }

  // NEW: Bulk unretire modal
  if (modalId === 'modal_bulk_unretire') {
    await handleBulkUnretireModal(interaction);
    return;
  }

  // NEW: Jump to image modal
  if (modalId === 'modal_jump_to_image') {
    await handleJumpToImageModal(interaction);
    return;
  }

  // NEW: Gallery jump modal
  if (modalId === 'modal_gallery_jump') {
    await handleGalleryJump(interaction);
    return;
  }

  // NEW: Bulk retire custom modal
  if (modalId === 'modal_bulk_retire_custom') {
    await handleBulkRetireCustom(interaction);
    return;
  }

  // NEW: Bulk unretire custom modal
  if (modalId === 'modal_bulk_unretire_custom') {
    await handleBulkUnretireCustom(interaction);
    return;
  }
}

async function handleKFactorModal(interaction) {
  await interaction.deferUpdate();

  try {
    const value = parseInt(interaction.fields.getTextInputValue('k_factor_input'));
    
    if (isNaN(value) || value < 1 || value > 100) {
      throw new Error('Invalid K-factor value');
    }

    await database.query(
      'UPDATE guild_config SET k_factor = $1 WHERE guild_id = $2',
      [value, interaction.guild.id]
    );

    const successEmbed = embedUtils.createSuccessEmbed(`K-factor updated to ${value}!`);
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

    // Refresh settings page
    const config = await adminConfig.getOrCreateConfig(interaction.guild.id);
    await adminConfig.handleEloSettings(interaction, config);
  } catch (error) {
    console.error('Error updating K-factor:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Invalid K-factor value. Please enter a number between 1 and 100.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

async function handleStartingEloModal(interaction) {
  await interaction.deferUpdate();

  try {
    const value = parseInt(interaction.fields.getTextInputValue('starting_elo_input'));
    
    if (isNaN(value) || value < 100 || value > 5000) {
      throw new Error('Invalid starting ELO');
    }

    await database.query(
      'UPDATE guild_config SET starting_elo = $1 WHERE guild_id = $2',
      [value, interaction.guild.id]
    );

    const successEmbed = embedUtils.createSuccessEmbed(`Starting ELO updated to ${value}!`);
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

    const config = await adminConfig.getOrCreateConfig(interaction.guild.id);
    await adminConfig.handleEloSettings(interaction, config);
  } catch (error) {
    console.error('Error updating starting ELO:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Invalid starting ELO. Please enter a number between 100 and 5000.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

async function handleDuelDurationModal(interaction) {
  await interaction.deferUpdate();

  try {
    const minutes = parseInt(interaction.fields.getTextInputValue('duel_duration_input'));
    
    if (isNaN(minutes) || minutes < 1 || minutes > 1440) {
      throw new Error('Invalid duration');
    }

    const seconds = minutes * 60;

    await database.query(
      'UPDATE guild_config SET duel_duration = $1 WHERE guild_id = $2',
      [seconds, interaction.guild.id]
    );

    const successEmbed = embedUtils.createSuccessEmbed(`Duel duration updated to ${minutes} minutes!`);
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

    const config = await adminConfig.getOrCreateConfig(interaction.guild.id);
    await adminConfig.handleBasicSettings(interaction, config);
  } catch (error) {
    console.error('Error updating duel duration:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Invalid duration. Please enter minutes between 1 and 1440.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

async function handleDuelIntervalModal(interaction) {
  await interaction.deferUpdate();

  try {
    const minutes = parseInt(interaction.fields.getTextInputValue('duel_interval_input'));
    
    if (isNaN(minutes) || minutes < 1 || minutes > 1440) {
      throw new Error('Invalid interval');
    }

    const seconds = minutes * 60;

    await database.query(
      'UPDATE guild_config SET duel_interval = $1 WHERE guild_id = $2',
      [seconds, interaction.guild.id]
    );

    const successEmbed = embedUtils.createSuccessEmbed(`Duel interval updated to ${minutes} minutes!`);
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

    const config = await adminConfig.getOrCreateConfig(interaction.guild.id);
    await adminConfig.handleBasicSettings(interaction, config);
  } catch (error) {
    console.error('Error updating duel interval:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Invalid interval. Please enter minutes between 1 and 1440.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

async function handleMinVotesModal(interaction) {
  await interaction.deferUpdate();

  try {
    const value = parseInt(interaction.fields.getTextInputValue('min_votes_input'));
    
    if (isNaN(value) || value < 0 || value > 50) {
      throw new Error('Invalid min votes');
    }

    await database.query(
      'UPDATE guild_config SET min_votes = $1 WHERE guild_id = $2',
      [value, interaction.guild.id]
    );

    const successEmbed = embedUtils.createSuccessEmbed(`Minimum votes updated to ${value}!`);
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

    const config = await adminConfig.getOrCreateConfig(interaction.guild.id);
    await adminConfig.handleEloSettings(interaction, config);
  } catch (error) {
    console.error('Error updating min votes:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Invalid value. Please enter a number between 0 and 50.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

async function handleLossesRetirementModal(interaction) {
  await interaction.deferUpdate();

  try {
    const value = parseInt(interaction.fields.getTextInputValue('losses_retirement_input'));
    
    if (isNaN(value) || value < 1 || value > 20) {
      throw new Error('Invalid losses value');
    }

    await database.query(
      'UPDATE guild_config SET losses_before_retirement = $1 WHERE guild_id = $2',
      [value, interaction.guild.id]
    );

    const successEmbed = embedUtils.createSuccessEmbed(`Losses before retirement updated to ${value}!`);
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

    const config = await adminConfig.getOrCreateConfig(interaction.guild.id);
    await adminConfig.handleEloSettings(interaction, config);
  } catch (error) {
    console.error('Error updating losses:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Invalid value. Please enter a number between 1 and 20.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

async function handleWildcardChanceModal(interaction) {
  await interaction.deferUpdate();

  try {
    const value = parseInt(interaction.fields.getTextInputValue('wildcard_chance_input'));
    
    if (isNaN(value) || value < 0 || value > 100) {
      throw new Error('Invalid percentage');
    }

    const decimal = value / 100;

    await database.query(
      'UPDATE guild_config SET wildcard_chance = $1 WHERE guild_id = $2',
      [decimal, interaction.guild.id]
    );

    const successEmbed = embedUtils.createSuccessEmbed(`Wildcard chance updated to ${value}%!`);
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

    const config = await adminConfig.getOrCreateConfig(interaction.guild.id);
    await adminConfig.handleEloSettings(interaction, config);
  } catch (error) {
    console.error('Error updating wildcard chance:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Invalid percentage. Please enter a number between 0 and 100.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

async function handleDuelChannelModal(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const channelId = interaction.fields.getTextInputValue('duel_channel_input').trim();
    
    // Verify channel exists
    const channel = await interaction.guild.channels.fetch(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    await database.query(
      'UPDATE guild_config SET duel_channel_id = $1 WHERE guild_id = $2',
      [channelId, interaction.guild.id]
    );

    const successEmbed = embedUtils.createSuccessEmbed(`Duel channel set to <#${channelId}>!`);
    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    console.error('Error setting duel channel:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Invalid channel ID. Please make sure the channel exists.');
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleImportChannelsModal(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const channelIds = interaction.fields.getTextInputValue('import_channels_input')
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0);

    if (channelIds.length === 0) {
      throw new Error('No channel IDs provided');
    }

    const successEmbed = embedUtils.createSuccessEmbed(
      `Starting import from ${channelIds.length} channel(s)...\nThis may take a while. Check back soon! ♡`
    );
    await interaction.editReply({ embeds: [successEmbed] });

    // Import images in background
    importImagesFromChannels(interaction.client, interaction.guild.id, channelIds);
  } catch (error) {
    console.error('Error importing images:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to start import. Check channel IDs.');
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function importImagesFromChannels(client, guildId, channelIds) {
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const channelId of channelIds) {
    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        errors++;
        continue;
      }

      let lastMessageId = null;
      let hasMore = true;
      let messageCount = 0;

      while (hasMore && messageCount < 100) {
        const options = { limit: 100 };
        if (lastMessageId) {
          options.before = lastMessageId;
        }

        const messages = await channel.messages.fetch(options);
        
        if (messages.size === 0) {
          hasMore = false;
          break;
        }

        for (const [_, message] of messages) {
          messageCount++;
          
          for (const attachment of message.attachments.values()) {
            if (!storage.isSupportedFormat(attachment.name)) continue;

            try {
              const { s3Key, hash } = await storage.downloadAndUpload(attachment.url, guildId);

              const existing = await database.query(
                'SELECT id FROM images WHERE guild_id = $1 AND image_hash = $2',
                [guildId, hash]
              );

              if (existing.rows.length > 0) {
                skipped++;
                continue;
              }

              const config = await database.query(
                'SELECT starting_elo FROM guild_config WHERE guild_id = $1',
                [guildId]
              );
              const startingElo = config.rows[0]?.starting_elo || 1000;

              await database.query(
                `INSERT INTO images (guild_id, image_hash, s3_key, discord_message_id, discord_channel_id, uploader_id, elo)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [guildId, hash, s3Key, message.id, channelId, message.author.id, startingElo]
              );

              imported++;
            } catch (err) {
              console.error('Error importing image:', err);
              errors++;
            }
          }
        }

        lastMessageId = messages.last()?.id;
        
        if (messages.size < 100) {
          hasMore = false;
        }
      }
    } catch (err) {
      console.error(`Error processing channel ${channelId}:`, err);
      errors++;
    }
  }

  console.log(`Import complete: ${imported} imported, ${skipped} skipped, ${errors} errors`);
  
  // Log import event
  await database.query(
    `INSERT INTO logs (guild_id, action_type, details)
     VALUES ($1, 'images_imported', $2)`,
    [guildId, JSON.stringify({ imported, skipped, errors, channelIds })]
  );
}

async function handleEloThresholdModal(interaction) {
  await interaction.deferUpdate();

  try {
    const threshold = parseInt(interaction.fields.getTextInputValue('elo_threshold'));
    
    if (isNaN(threshold)) {
      throw new Error('Invalid ELO threshold');
    }

    const imagesToRetire = await database.query(
      `SELECT id FROM images WHERE guild_id = $1 AND elo < $2 AND retired = false`,
      [interaction.guild.id, threshold]
    );

    if (imagesToRetire.rows.length === 0) {
      const infoEmbed = embedUtils.createSuccessEmbed(`No images found with ELO below ${threshold}.`);
      await interaction.followUp({ embeds: [infoEmbed], flags: MessageFlags.Ephemeral });
      
      const config = await adminConfig.getOrCreateConfig(interaction.guild.id);
      await imageManagement.showImageManagement(interaction, config);
      return;
    }

    const imageIds = imagesToRetire.rows.map(row => row.id);

    await database.query(
      `UPDATE images SET retired = true, retired_at = NOW() 
       WHERE guild_id = $1 AND elo < $2 AND retired = false`,
      [interaction.guild.id, threshold]
    );

    const count = imagesToRetire.rows.length;

    const successEmbed = embedUtils.createSuccessEmbed(
      `Retired ${count} image(s) with ELO below ${threshold}!\n\n` +
      `Note: Images are retired (not deleted) to preserve duel history. ♡`
    );
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

    const config = await adminConfig.getOrCreateConfig(interaction.guild.id);
    await imageManagement.showImageManagement(interaction, config);
  } catch (error) {
    console.error('Error clearing images:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to retire images. Error: ' + error.message);
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

async function handleSeasonResetModal(interaction) {
  await interaction.deferUpdate();

  try {
    const password = interaction.fields.getTextInputValue('season_reset_password');
    
    if (password !== process.env.SEASON_RESET_PASSWORD) {
      throw new Error('Incorrect password');
    }

    const guildId = interaction.guild.id;
    const config = await adminConfig.getOrCreateConfig(guildId);

    await database.query(
      `UPDATE users 
       SET elo = (elo + $1) / 2, current_streak = 0
       WHERE guild_id = $2`,
      [config.starting_elo, guildId]
    );

    await database.query(
      `UPDATE images 
       SET elo = (elo + $1) / 2, current_streak = 0
       WHERE guild_id = $2`,
      [config.starting_elo, guildId]
    );

    await database.query(
      'UPDATE guild_config SET season_number = season_number + 1 WHERE guild_id = $1',
      [guildId]
    );

    await database.query(
      `INSERT INTO logs (guild_id, action_type, admin_id, details)
       VALUES ($1, 'season_reset', $2, $3)`,
      [guildId, interaction.user.id, JSON.stringify({ season: config.season_number + 1 })]
    );

    const successEmbed = embedUtils.createSuccessEmbed(
      `Season reset complete! Now in Season ${config.season_number + 1}!\nAll ELOs have been soft reset. ♡`
    );
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

    const updatedConfig = await adminConfig.getOrCreateConfig(guildId);
    await adminConfig.handleSeasonManagement(interaction, updatedConfig);
  } catch (error) {
    console.error('Error resetting season:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Incorrect password or failed to reset season.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

async function handleAddCaptionModal(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const imageChoice = interaction.fields.getTextInputValue('image_select').toUpperCase();
    const caption = interaction.fields.getTextInputValue('caption_input');

    if (!['A', 'B'].includes(imageChoice)) {
      throw new Error('Invalid image choice');
    }

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    const activeDuel = await duelManager.getActiveDuel(guildId);
    if (!activeDuel) {
      throw new Error('No active duel');
    }

    const imageId = imageChoice === 'A' ? activeDuel.image1.id : activeDuel.image2.id;

    const existing = await database.query(
      `SELECT c.id FROM captions c
       WHERE c.image_id = $1 AND c.user_id = $2 
       AND c.created_at >= (SELECT started_at FROM duels WHERE id = $3)`,
      [imageId, userId, activeDuel.duelId]
    );

    if (existing.rows.length > 0) {
      throw new Error('Already added caption');
    }

    const captionCount = await database.query(
      `SELECT COUNT(*) FROM captions c
       WHERE c.image_id = $1
       AND c.created_at >= (SELECT started_at FROM duels WHERE id = $2)`,
      [imageId, activeDuel.duelId]
    );

    if (parseInt(captionCount.rows[0].count) >= 3) {
      throw new Error('Max captions reached');
    }

    await database.query(
      'INSERT INTO captions (image_id, user_id, caption) VALUES ($1, $2, $3)',
      [imageId, userId, caption]
    );

    const successEmbed = embedUtils.createSuccessEmbed('Caption added!');
    await interaction.editReply({ embeds: [successEmbed] });

    if (interaction.client.duelScheduler) {
      await interaction.client.duelScheduler.updateDuelMessage(guildId);
    }

  } catch (error) {
    console.error('Error adding caption:', error);
    let message = 'Failed to add caption.';
    if (error.message === 'Invalid image choice') message = 'Please choose A or B!';
    if (error.message === 'No active duel') message = 'There is no active duel right now!';
    if (error.message === 'Already added caption') message = 'You already added a caption to this image in this duel!';
    if (error.message === 'Max captions reached') message = 'This image already has 3 captions in this duel!';
    
    const errorEmbed = embedUtils.createErrorEmbed(message);
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleSystemResetModal(interaction) {
  await interaction.deferUpdate();

  try {
    const password = interaction.fields.getTextInputValue('reset_password');
    const confirmation = interaction.fields.getTextInputValue('reset_confirmation');

    const systemReset = await import('../commands/admin/systemReset.js');
    await systemReset.default.executeReset(interaction, password, confirmation);
  } catch (error) {
    console.error('Error in system reset:', error);
    const errorEmbed = embedUtils.createErrorEmbed('System reset failed: ' + error.message);
    await interaction.editReply({ embeds: [errorEmbed], components: [] });
  }
}

// NEW: Handle bulk retire modal
async function handleBulkRetireModal(interaction) {
  await interaction.deferUpdate();

  try {
    const threshold = parseInt(interaction.fields.getTextInputValue('elo_threshold'));
    const confirmText = interaction.fields.getTextInputValue('confirm_text');
    
    if (confirmText !== 'CONFIRM') {
      const errorEmbed = embedUtils.createErrorEmbed('You must type CONFIRM to proceed.');
      await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      return;
    }
    
    if (isNaN(threshold)) {
      const errorEmbed = embedUtils.createErrorEmbed('Invalid ELO threshold.');
      await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      return;
    }

    const guildId = interaction.guild.id;
    
    // Get count first
    const countResult = await database.query(
      'SELECT COUNT(*) as total FROM images WHERE guild_id = $1 AND elo < $2 AND retired = false',
      [guildId, threshold]
    );
    
    const count = parseInt(countResult.rows[0].total);
    
    if (count === 0) {
      const infoEmbed = embedUtils.createSuccessEmbed(`No images found with ELO below ${threshold}.`);
      await interaction.followUp({ embeds: [infoEmbed], flags: MessageFlags.Ephemeral });
      
      const config = await adminConfig.getOrCreateConfig(guildId);
      await imageManagement.showImageManagement(interaction, config);
      return;
    }
    
    // Retire them
    await database.query(
      'UPDATE images SET retired = true, retired_at = NOW() WHERE guild_id = $1 AND elo < $2 AND retired = false',
      [guildId, threshold]
    );
    
    // Log the action
    await database.query(
      `INSERT INTO logs (guild_id, action_type, admin_id, details)
       VALUES ($1, 'bulk_retire', $2, $3)`,
      [guildId, interaction.user.id, JSON.stringify({ threshold, count })]
    );
    
    const successEmbed = embedUtils.createSuccessEmbed(
      `Retired ${count} image(s) with ELO below ${threshold}!`
    );
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
    
    const config = await adminConfig.getOrCreateConfig(guildId);
    await imageManagement.showImageManagement(interaction, config);
  } catch (error) {
    console.error('Error in bulk retire:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to retire images.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

// NEW HELPER FUNCTIONS FOR PART 2 FEATURES

async function handleLogChannelModal(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    let channelId = interaction.fields.getTextInputValue('log_channel_input').trim();
    
    // Extract channel ID from URL if user pasted full URL
    // Format: https://discord.com/channels/GUILD_ID/CHANNEL_ID
    if (channelId.includes('discord.com/channels/')) {
      const parts = channelId.split('/');
      channelId = parts[parts.length - 1];
    }
    
    // Verify channel exists
    const channel = await interaction.guild.channels.fetch(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    // Update config
    await database.query(
      'UPDATE guild_config SET log_channel_id = $1 WHERE guild_id = $2',
      [channelId, interaction.guild.id]
    );

    const successEmbed = embedUtils.createSuccessEmbed(
      `Log channel set to <#${channelId}>!\n\n` +
      `The bot will now send notifications about:\n` +
      `• Duel starts and ends\n` +
      `• Image retirements\n` +
      `• System errors\n` +
      `• Admin actions`
    );
    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    console.error('Error setting log channel:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Invalid channel ID or URL. Please use a channel ID or right-click the channel and select "Copy Link".');
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleViewImageModal(interaction) {
  await interaction.deferUpdate();

  try {
    const imageId = parseInt(interaction.fields.getTextInputValue('image_id'));
    
    if (isNaN(imageId)) {
      throw new Error('Invalid image ID');
    }

    await imageManagement.viewImage(interaction, imageId);
  } catch (error) {
    console.error('Error viewing image:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Invalid image ID. Please enter a valid number.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

async function handleRetireImageModal(interaction) {
  await interaction.deferUpdate();

  try {
    const imageId = parseInt(interaction.fields.getTextInputValue('image_id'));
    
    if (isNaN(imageId)) {
      throw new Error('Invalid image ID');
    }

    const guildId = interaction.guild.id;

    // Check if image exists and is not retired
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

    // Retire the image
    await database.query(
      'UPDATE images SET retired = true, retired_at = NOW() WHERE guild_id = $1 AND id = $2',
      [guildId, imageId]
    );

    // Log the action
    await database.query(
      `INSERT INTO logs (guild_id, action_type, admin_id, details)
       VALUES ($1, 'image_retired', $2, $3)`,
      [guildId, interaction.user.id, JSON.stringify({ imageId, method: 'manual' })]
    );

    const successEmbed = embedUtils.createSuccessEmbed(`Image #${imageId} has been retired.`);
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

    // Refresh browser
    await imageManagement.browseImages(interaction);
  } catch (error) {
    console.error('Error retiring image:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to retire image: ' + error.message);
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

async function handleUnretireImageModal(interaction) {
  await interaction.deferUpdate();

  try {
    const imageId = parseInt(interaction.fields.getTextInputValue('image_id'));
    
    if (isNaN(imageId)) {
      throw new Error('Invalid image ID');
    }

    const guildId = interaction.guild.id;

    // Check if image exists and is retired
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

    // Unretire the image
    await database.query(
      'UPDATE images SET retired = false, retired_at = NULL WHERE guild_id = $1 AND id = $2',
      [guildId, imageId]
    );

    // Log the action
    await database.query(
      `INSERT INTO logs (guild_id, action_type, admin_id, details)
       VALUES ($1, 'image_unretired', $2, $3)`,
      [guildId, interaction.user.id, JSON.stringify({ imageId })]
    );

    const successEmbed = embedUtils.createSuccessEmbed(`Image #${imageId} has been unretired and is now active again.`);
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

    // Refresh browser
    await imageManagement.browseImages(interaction);
  } catch (error) {
    console.error('Error unretiring image:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to unretire image: ' + error.message);
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

async function handleDeleteImageModal(interaction) {
  await interaction.deferUpdate();

  try {
    const imageId = parseInt(interaction.fields.getTextInputValue('image_id'));
    const confirmText = interaction.fields.getTextInputValue('confirm_delete');
    
    if (isNaN(imageId)) {
      throw new Error('Invalid image ID');
    }

    if (confirmText !== 'DELETE') {
      const errorEmbed = embedUtils.createErrorEmbed('You must type DELETE to confirm permanent deletion.');
      await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      return;
    }

    const guildId = interaction.guild.id;

    // Get image info for S3 deletion
    const imageResult = await database.query(
      'SELECT s3_key FROM images WHERE guild_id = $1 AND id = $2',
      [guildId, imageId]
    );

    if (imageResult.rows.length === 0) {
      const errorEmbed = embedUtils.createErrorEmbed('Image not found.');
      await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      return;
    }

    const s3Key = imageResult.rows[0].s3_key;

    // Delete from S3
    await storage.deleteImage(s3Key);

    // Delete from database (cascades will handle votes and captions)
    await database.query(
      'DELETE FROM images WHERE guild_id = $1 AND id = $2',
      [guildId, imageId]
    );

    // Log the action
    await database.query(
      `INSERT INTO logs (guild_id, action_type, admin_id, details)
       VALUES ($1, 'image_deleted', $2, $3)`,
      [guildId, interaction.user.id, JSON.stringify({ imageId, s3Key })]
    );

    const successEmbed = embedUtils.createSuccessEmbed(
      `Image #${imageId} has been permanently deleted.\n\n` +
      `The image has been removed from S3 storage and all database records have been deleted.`
    );

    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

    // Refresh browser
    await imageManagement.browseImages(interaction);
  } catch (error) {
    console.error('Error deleting image:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to delete image: ' + error.message);
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

async function handleBulkUnretireModal(interaction) {
  await interaction.deferUpdate();

  try {
    const threshold = parseInt(interaction.fields.getTextInputValue('elo_threshold'));
    const confirmText = interaction.fields.getTextInputValue('confirm_text');
    
    if (confirmText !== 'CONFIRM') {
      const errorEmbed = embedUtils.createErrorEmbed('You must type CONFIRM to proceed.');
      await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      return;
    }
    
    if (isNaN(threshold)) {
      const errorEmbed = embedUtils.createErrorEmbed('Invalid ELO threshold.');
      await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      return;
    }

    const guildId = interaction.guild.id;
    
    // Get count first
    const countResult = await database.query(
      'SELECT COUNT(*) as total FROM images WHERE guild_id = $1 AND elo >= $2 AND retired = true',
      [guildId, threshold]
    );
    
    const count = parseInt(countResult.rows[0].total);
    
    if (count === 0) {
      const infoEmbed = embedUtils.createSuccessEmbed(`No retired images found with ELO above ${threshold}.`);
      await interaction.followUp({ embeds: [infoEmbed], flags: MessageFlags.Ephemeral });
      
      const config = await adminConfig.getOrCreateConfig(guildId);
      await imageManagement.showImageManagement(interaction, config);
      return;
    }
    
    // Unretire them
    await database.query(
      'UPDATE images SET retired = false, retired_at = NULL WHERE guild_id = $1 AND elo >= $2 AND retired = true',
      [guildId, threshold]
    );
    
    // Log the action
    await database.query(
      `INSERT INTO logs (guild_id, action_type, admin_id, details)
       VALUES ($1, 'bulk_unretire', $2, $3)`,
      [guildId, interaction.user.id, JSON.stringify({ threshold, count })]
    );
    
    const successEmbed = embedUtils.createSuccessEmbed(
      `Unretired ${count} image(s) with ELO above ${threshold}!\n\n` +
      `These images are now active again and can participate in duels.`
    );
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
    
    const config = await adminConfig.getOrCreateConfig(guildId);
    await imageManagement.showImageManagement(interaction, config);
  } catch (error) {
    console.error('Error in bulk unretire:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to unretire images.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

async function handleJumpToImageModal(interaction) {
  await interaction.deferUpdate();

  try {
    const imageNumber = parseInt(interaction.fields.getTextInputValue('image_index'));
    
    if (isNaN(imageNumber) || imageNumber < 1) {
      throw new Error('Invalid image number');
    }

    // Get state from message
    const content = interaction.message.content;
    const match = content.match(/__GALLERY_STATE:(.+?)__/);
    
    if (!match) {
      throw new Error('Gallery state not found');
    }
    
    const state = JSON.parse(match[1]);
    const { sortBy, filterActive, totalImages } = state;
    
    if (imageNumber > totalImages) {
      const errorEmbed = embedUtils.createErrorEmbed(`Image number must be between 1 and ${totalImages}.`);
      await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      return;
    }
    
    // Convert to 0-indexed
    const index = imageNumber - 1;
    
    // Jump to that image
    await imageManagement.showGalleryView(interaction, index, sortBy, filterActive);
  } catch (error) {
    console.error('Error jumping to image:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Invalid image number. Please enter a valid number.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

// NEW: Handle gallery jump (redesigned gallery)
async function handleGalleryJump(interaction) {
  await interaction.deferUpdate();
  
  try {
    const jumpTo = parseInt(interaction.fields.getTextInputValue('jump_index'));
    
    if (isNaN(jumpTo) || jumpTo < 1) {
      throw new Error('Invalid number');
    }
    
    const content = interaction.message.content;
    const match = content.match(/__GALLERY:(.+?)__/);
    const state = match ? JSON.parse(match[1]) : { sortBy: 'elo', filterActive: 'all' };
    
    const index = jumpTo - 1;
    
    await imageManagement.showGallery(interaction, index, state.sortBy, state.filterActive);
  } catch (error) {
    console.error('Error jumping to image:', error);
    const embed = embedUtils.createErrorEmbed('Invalid image number.');
    await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

// NEW: Handle bulk retire custom threshold
async function handleBulkRetireCustom(interaction) {
  const threshold = parseInt(interaction.fields.getTextInputValue('threshold'));
  
  if (isNaN(threshold)) {
    await interaction.reply({ 
      content: 'Invalid ELO threshold.', 
      flags: MessageFlags.Ephemeral 
    });
    return;
  }
  
  await imageManagement.executeBulkRetire(interaction, threshold);
}

// NEW: Handle bulk unretire custom threshold
async function handleBulkUnretireCustom(interaction) {
  const threshold = parseInt(interaction.fields.getTextInputValue('threshold'));
  
  if (isNaN(threshold)) {
    await interaction.reply({ 
      content: 'Invalid ELO threshold.', 
      flags: MessageFlags.Ephemeral 
    });
    return;
  }
  
  await imageManagement.executeBulkUnretire(interaction, threshold);
}

export default { handleModalSubmit };
