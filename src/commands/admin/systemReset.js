/**
 * System Reset Command
 * Complete database wipe with password protection
 */

import database from '../../database/database.js';
import storage from '../../services/image/storage.js';
import embedUtils from '../../utils/embeds.js';
import { 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags
} from 'discord.js';

class SystemReset {
  /**
   * Show warning before reset
   */
  async showResetWarning(interaction) {
    const embed = embedUtils.createBaseEmbed();
    embed.setColor('#FF0000');
    embed.setTitle('⚠️ SYSTEM RESET WARNING');
    embed.setDescription(
      '**This will permanently delete:**\n' +
      '• All images from S3 storage\n' +
      '• All ELO ratings and records\n' +
      '• All duel history\n' +
      '• All votes\n\n' +
      '**This action CANNOT be undone!**\n\n' +
      'Are you absolutely sure you want to continue?'
    );

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_system_reset')
          .setLabel('Yes, Reset Everything')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('cancel_system_reset')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.reply({ 
      embeds: [embed], 
      components: [row], 
      flags: MessageFlags.Ephemeral 
    });
  }

  /**
   * Show password modal
   */
  async showPasswordModal(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('modal_system_reset')
      .setTitle('Confirm System Reset');

    const passwordInput = new TextInputBuilder()
      .setCustomId('reset_password')
      .setLabel('Enter Reset Password')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Password from environment variables')
      .setRequired(true);

    const confirmInput = new TextInputBuilder()
      .setCustomId('reset_confirmation')
      .setLabel('Type "DELETE EVERYTHING" to confirm')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('DELETE EVERYTHING')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(passwordInput),
      new ActionRowBuilder().addComponents(confirmInput)
    );

    await interaction.showModal(modal);
  }

  /**
   * Execute the reset
   */
  async executeReset(interaction, password, confirmation) {
    try {
      const correctPassword = process.env.SYSTEM_RESET_PASSWORD || 'admin123';

      // Validate password
      if (password !== correctPassword) {
        const embed = embedUtils.createErrorEmbed('❌ Incorrect password!');
        await interaction.editReply({ embeds: [embed], components: [] });
        return;
      }

      // Validate confirmation text
      if (confirmation !== 'DELETE EVERYTHING') {
        const embed = embedUtils.createErrorEmbed('❌ Confirmation text does not match!');
        await interaction.editReply({ embeds: [embed], components: [] });
        return;
      }

      const guildId = interaction.guild.id.toString();

      // Progress embed
      const progressEmbed = embedUtils.createBaseEmbed();
      progressEmbed.setTitle('🔄 System Reset in Progress...');
      progressEmbed.setDescription('Please wait, this may take a while...');
      await interaction.editReply({ embeds: [progressEmbed], components: [] });

      // Step 1: Get all images to delete from S3
      const imagesResult = await database.query(
        'SELECT s3_key FROM images WHERE guild_id = $1',
        [guildId]
      );

      let deletedImages = 0;
      for (const row of imagesResult.rows) {
        try {
          await storage.deleteImage(row.s3_key);
          deletedImages++;
        } catch (error) {
          console.error(`Failed to delete image ${row.s3_key}:`, error);
        }
      }

      // Step 2: Delete all database records for this guild
      await database.query('DELETE FROM votes WHERE duel_id IN (SELECT id FROM duels WHERE guild_id = $1)', [guildId]);
      await database.query('DELETE FROM active_duels WHERE guild_id = $1', [guildId]);
      await database.query('DELETE FROM duels WHERE guild_id = $1', [guildId]);
      await database.query('DELETE FROM images WHERE guild_id = $1', [guildId]);

      // Step 3: Reset guild config but keep settings
      await database.query(
        'UPDATE guild_config SET duel_active = false, duel_paused = false WHERE guild_id = $1',
        [guildId]
      );

      // Success
      const successEmbed = embedUtils.createSuccessEmbed(
        `✅ **System Reset Complete!**\n\n` +
        `Deleted ${deletedImages} images from S3\n` +
        `Cleared all duels, votes, and records\n\n` +
        `You can now run \`/setup\` to start fresh!`
      );

      await interaction.editReply({ embeds: [successEmbed], components: [] });

      console.log(`🔥 System reset completed for guild ${guildId} by ${interaction.user.tag}`);

    } catch (error) {
      console.error('Error during system reset:', error);
      const embed = embedUtils.createErrorEmbed('Failed to complete system reset!');
      await interaction.editReply({ embeds: [embed], components: [] });
    }
  }
}

export default new SystemReset();
