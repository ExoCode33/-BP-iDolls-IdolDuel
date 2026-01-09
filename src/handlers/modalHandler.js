// ADD THESE NEW MODAL HANDLERS TO YOUR modalHandler.js FILE
// Place them in the handleModalSubmit() function after the existing modal handlers

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

// ===== NEW HELPER FUNCTIONS =====
// Add these functions at the end of your modalHandler.js file, before the export

async function handleLogChannelModal(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const channelId = interaction.fields.getTextInputValue('log_channel_input').trim();
    
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
    const errorEmbed = embedUtils.createErrorEmbed('Invalid channel ID. Please make sure the channel exists.');
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
