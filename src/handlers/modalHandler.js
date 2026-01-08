import database from '../database/database.js';
import storage from '../services/storage.js';
import embedUtils from '../utils/embeds.js';
import adminConfig from '../commands/admin/config.js';
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

      while (hasMore && messageCount < 100) { // Limit to 100 messages per channel
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
            // Check if supported format
            if (!storage.isSupportedFormat(attachment.name)) continue;

            try {
              // Download and upload to S3
              const { s3Key, hash } = await storage.downloadAndUpload(attachment.url, guildId);

              // Check if already exists
              const existing = await database.query(
                'SELECT id FROM images WHERE guild_id = $1 AND image_hash = $2',
                [guildId, hash]
              );

              if (existing.rows.length > 0) {
                skipped++;
                continue;
              }

              // Get config for starting ELO
              const config = await database.query(
                'SELECT starting_elo FROM guild_config WHERE guild_id = $1',
                [guildId]
              );
              const startingElo = config.rows[0]?.starting_elo || 1000;

              // Insert into database
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
}

async function handleEloThresholdModal(interaction) {
  await interaction.deferUpdate();

  try {
    const threshold = parseInt(interaction.fields.getTextInputValue('elo_threshold_input'));
    
    if (isNaN(threshold)) {
      throw new Error('Invalid ELO threshold');
    }

    // Instead of deleting, we'll retire images and optionally clean up old references
    // First, get IDs of images to retire
    const imagesToRetire = await database.query(
      `SELECT id FROM images WHERE guild_id = $1 AND elo < $2 AND retired = false`,
      [interaction.guild.id, threshold]
    );

    if (imagesToRetire.rows.length === 0) {
      const infoEmbed = embedUtils.createSuccessEmbed(`No images found with ELO below ${threshold}.`);
      await interaction.followUp({ embeds: [infoEmbed], flags: MessageFlags.Ephemeral });
      
      const config = await adminConfig.getOrCreateConfig(interaction.guild.id);
      await adminConfig.handleImageManagement(interaction, config);
      return;
    }

    const imageIds = imagesToRetire.rows.map(row => row.id);

    // Retire the images instead of deleting them
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
    await adminConfig.handleImageManagement(interaction, config);
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

    // Soft reset all user ELOs
    await database.query(
      `UPDATE users 
       SET elo = (elo + $1) / 2, current_streak = 0
       WHERE guild_id = $2`,
      [config.starting_elo, guildId]
    );

    // Soft reset all image ELOs
    await database.query(
      `UPDATE images 
       SET elo = (elo + $1) / 2, current_streak = 0
       WHERE guild_id = $2`,
      [config.starting_elo, guildId]
    );

    // Increment season number
    await database.query(
      'UPDATE guild_config SET season_number = season_number + 1 WHERE guild_id = $1',
      [guildId]
    );

    // Log the reset
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

    // Get active duel
    const activeDuel = await duelManager.getActiveDuel(guildId);
    if (!activeDuel) {
      throw new Error('No active duel');
    }

    const imageId = imageChoice === 'A' ? activeDuel.image1.id : activeDuel.image2.id;

    // Check if user already added caption to THIS image in THIS DUEL
    const existing = await database.query(
      `SELECT c.id FROM captions c
       WHERE c.image_id = $1 AND c.user_id = $2 
       AND c.created_at >= (SELECT started_at FROM duels WHERE id = $3)`,
      [imageId, userId, activeDuel.duelId]
    );

    if (existing.rows.length > 0) {
      throw new Error('Already added caption');
    }

    // Check caption count for image IN THIS DUEL (max 3)
    const captionCount = await database.query(
      `SELECT COUNT(*) FROM captions c
       WHERE c.image_id = $1
       AND c.created_at >= (SELECT started_at FROM duels WHERE id = $2)`,
      [imageId, activeDuel.duelId]
    );

    if (parseInt(captionCount.rows[0].count) >= 3) {
      throw new Error('Max captions reached');
    }

    // Add caption
    await database.query(
      'INSERT INTO captions (image_id, user_id, caption) VALUES ($1, $2, $3)',
      [imageId, userId, caption]
    );

    const successEmbed = embedUtils.createSuccessEmbed('Caption added!');
    await interaction.editReply({ embeds: [successEmbed] });

    // Update the duel message with new caption
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

export default { handleModalSubmit };
