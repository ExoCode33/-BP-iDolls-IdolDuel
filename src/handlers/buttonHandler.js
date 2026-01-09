// ADD THESE NEW HANDLERS TO YOUR buttonHandler.js FILE
// Place them after the existing admin button handlers, before the existing helper functions

// ===== NEW IMAGE MANAGEMENT BUTTONS =====

// Log channel configuration buttons
if (customId === 'admin_set_log_channel') {
  await interaction.showModal(adminConfig.createLogChannelModal());
  return;
}

if (customId === 'admin_clear_log_channel') {
  await handleClearLogChannel(interaction);
  return;
}

// Image browser action buttons
if (customId === 'browse_view_image') {
  await interaction.showModal(imageManagement.createViewImageModal());
  return;
}

if (customId === 'browse_retire_image') {
  await interaction.showModal(imageManagement.createRetireImageModal());
  return;
}

if (customId === 'browse_unretire_image') {
  await interaction.showModal(imageManagement.createUnretireImageModal());
  return;
}

if (customId === 'browse_delete_image') {
  await interaction.showModal(imageManagement.createDeleteImageModal());
  return;
}

// Bulk unretire button
if (customId === 'admin_bulk_unretire') {
  await imageManagement.showBulkUnretire(interaction);
  return;
}

// Individual image action buttons (from view screen)
if (customId.startsWith('image_action_retire_')) {
  const imageId = parseInt(customId.split('_')[3]);
  await handleRetireImageDirect(interaction, imageId);
  return;
}

if (customId.startsWith('image_action_unretire_')) {
  const imageId = parseInt(customId.split('_')[3]);
  await handleUnretireImageDirect(interaction, imageId);
  return;
}

if (customId.startsWith('image_action_delete_')) {
  const imageId = parseInt(customId.split('_')[3]);
  await handleDeleteImageDirect(interaction, imageId);
  return;
}

// ===== NEW HELPER FUNCTIONS =====
// Add these functions at the end of your buttonHandler.js file, before the export

async function handleClearLogChannel(interaction) {
  await interaction.deferUpdate();

  try {
    const guildId = interaction.guild.id;
    
    await database.query(
      'UPDATE guild_config SET log_channel_id = NULL WHERE guild_id = $1',
      [guildId]
    );

    const successEmbed = embedUtils.createSuccessEmbed('Log channel disabled. No more automatic log messages will be sent.');
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });

    // Refresh settings page
    const config = await adminConfig.getOrCreateConfig(guildId);
    await adminConfig.handleBasicSettings(interaction, config);
  } catch (error) {
    console.error('Error clearing log channel:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to clear log channel.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

async function handleRetireImageDirect(interaction, imageId) {
  await interaction.deferUpdate();

  try {
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

    // Refresh the view
    await imageManagement.viewImage(interaction, imageId);
  } catch (error) {
    console.error('Error retiring image:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to retire image.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

async function handleUnretireImageDirect(interaction, imageId) {
  await interaction.deferUpdate();

  try {
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

    // Refresh the view
    await imageManagement.viewImage(interaction, imageId);
  } catch (error) {
    console.error('Error unretiring image:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to unretire image.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

async function handleDeleteImageDirect(interaction, imageId) {
  await interaction.deferUpdate();

  try {
    const guildId = interaction.guild.id;

    // Get image info
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

    // Show confirmation
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
    
    const embed = embedUtils.createBaseEmbed();
    embed.setColor(0xFF0000);
    embed.setTitle('⚠️ Confirm Permanent Deletion');
    embed.setDescription(
      `**Are you absolutely sure you want to delete image #${imageId}?**\n\n` +
      `This action will:\n` +
      `• Permanently delete the image from S3 storage\n` +
      `• Remove all database records\n` +
      `• Delete all associated votes and captions\n` +
      `• Cannot be undone\n\n` +
      `**Think carefully before proceeding!**`
    );

    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`confirm_delete_${imageId}`)
          .setLabel('Yes, Delete Forever')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('cancel_delete')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.followUp({ 
      embeds: [embed], 
      components: [buttons],
      flags: MessageFlags.Ephemeral 
    });
  } catch (error) {
    console.error('Error in delete confirmation:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to show delete confirmation.');
    await interaction.followUp({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
  }
}

// Handle delete confirmation
if (customId.startsWith('confirm_delete_')) {
  const imageId = parseInt(customId.split('_')[2]);
  await handleConfirmDelete(interaction, imageId);
  return;
}

if (customId === 'cancel_delete') {
  await interaction.deferUpdate();
  const embed = embedUtils.createSuccessEmbed('Deletion cancelled.');
  await interaction.editReply({ embeds: [embed], components: [] });
  return;
}

async function handleConfirmDelete(interaction, imageId) {
  await interaction.deferUpdate();

  try {
    const guildId = interaction.guild.id;

    // Get image info for S3 deletion
    const imageResult = await database.query(
      'SELECT s3_key FROM images WHERE guild_id = $1 AND id = $2',
      [guildId, imageId]
    );

    if (imageResult.rows.length === 0) {
      const errorEmbed = embedUtils.createErrorEmbed('Image not found.');
      await interaction.editReply({ embeds: [errorEmbed], components: [] });
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

    await interaction.editReply({ embeds: [successEmbed], components: [] });
  } catch (error) {
    console.error('Error deleting image:', error);
    const errorEmbed = embedUtils.createErrorEmbed('Failed to delete image: ' + error.message);
    await interaction.editReply({ embeds: [errorEmbed], components: [] });
  }
}
