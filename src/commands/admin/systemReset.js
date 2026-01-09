import { 
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} from 'discord.js';
import database from '../../database/database.js';
import redis from '../../database/redis.js';
import storage from '../../services/image/storage.js';
import embedUtils from '../../utils/embeds.js';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

export default {
  name: 'system-reset',
  
  async showResetWarning(interaction) {
    const embed = embedUtils.createBaseEmbed();
    embed.setTitle('⚠️ System Reset Configuration');
    embed.setColor(0xFF6B6B); // Warning red
    embed.setDescription(
      `\`\`\`css\n` +
      `[ Complete System Reset ]\n` +
      `\`\`\`\n` +
      `**This operation will permanently remove:**\n\n` +
      `**PostgreSQL Database:**\n` +
      `• All image records and metadata\n` +
      `• All duel history and results\n` +
      `• All votes\n` +
      `• Guild configuration settings\n\n` +
      `**S3 Storage Bucket:**\n` +
      `• All uploaded image files\n` +
      `• Complete bucket contents\n\n` +
      `**Redis Cache:**\n` +
      `• All cached data\n` +
      `• Active session information\n\n` +
      `**System Status:**\n` +
      `• Bot will automatically restart after completion\n` +
      `• Fresh database tables will be recreated\n` +
      `• All settings will return to defaults\n\n` +
      `⚠️ **Warning:** This action is irreversible. All data will be permanently deleted.\n\n` +
      `Please confirm you understand the consequences before proceeding.`
    );

    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_system_reset')
          .setLabel('I Understand - Proceed with Reset')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('cancel_system_reset')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.reply({ 
      embeds: [embed], 
      components: [buttons],
      flags: MessageFlags.Ephemeral 
    });
  },

  async showPasswordModal(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('modal_system_reset')
      .setTitle('System Reset Authentication');

    const passwordInput = new TextInputBuilder()
      .setCustomId('reset_password')
      .setLabel('Enter system reset password')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Password required for system reset')
      .setRequired(true);

    const confirmInput = new TextInputBuilder()
      .setCustomId('reset_confirmation')
      .setLabel('Type "RESET ALL DATA" to confirm')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('RESET ALL DATA')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(passwordInput),
      new ActionRowBuilder().addComponents(confirmInput)
    );

    await interaction.showModal(modal);
  },

  async executeReset(interaction, password, confirmation) {
    // Verify password
    if (password !== process.env.SEASON_RESET_PASSWORD) {
      const errorEmbed = embedUtils.createErrorEmbed('Invalid password. System reset cancelled.');
      await interaction.editReply({ embeds: [errorEmbed], components: [] });
      return;
    }

    // Verify confirmation text
    if (confirmation !== 'RESET ALL DATA') {
      const errorEmbed = embedUtils.createErrorEmbed('Confirmation text incorrect. System reset cancelled.');
      await interaction.editReply({ embeds: [errorEmbed], components: [] });
      return;
    }

    // Start reset process
    const progressEmbed = embedUtils.createBaseEmbed();
    progressEmbed.setTitle('🔄 System Reset in Progress');
    progressEmbed.setDescription(
      `\`\`\`css\n` +
      `[ Processing System Reset ]\n` +
      `\`\`\`\n` +
      `⏳ Clearing database...\n` +
      `⏳ Clearing S3 storage...\n` +
      `⏳ Clearing Redis cache...\n` +
      `⏳ Preparing restart...\n\n` +
      `Please wait. This may take several minutes.`
    );

    await interaction.editReply({ embeds: [progressEmbed], components: [] });

    try {
      let status = {
        database: '⏳ In progress',
        s3: '⏳ In progress',
        redis: '⏳ In progress',
        restart: '⏳ Pending'
      };

      // 1. Clear PostgreSQL Database
      try {
        await this.clearDatabase();
        status.database = '✅ Complete';
      } catch (error) {
        status.database = `❌ Error: ${error.message}`;
        throw error;
      }

      await this.updateProgress(interaction, progressEmbed, status);

      // 2. Clear S3 Bucket
      try {
        const deletedCount = await this.clearS3Bucket();
        status.s3 = `✅ Complete (${deletedCount} files deleted)`;
      } catch (error) {
        status.s3 = `❌ Error: ${error.message}`;
        throw error;
      }

      await this.updateProgress(interaction, progressEmbed, status);

      // 3. Clear Redis
      try {
        await this.clearRedis();
        status.redis = '✅ Complete';
      } catch (error) {
        status.redis = `⚠️ Warning: ${error.message}`;
        // Redis error is not fatal, continue
      }

      await this.updateProgress(interaction, progressEmbed, status);

      // 4. Reinitialize database
      await database.initialize();
      status.restart = '✅ Database reinitialized';

      await this.updateProgress(interaction, progressEmbed, status);

      // Success message
      const successEmbed = embedUtils.createSuccessEmbed(
        'System reset completed successfully!\n\n' +
        '✅ Database cleared and reinitialized\n' +
        '✅ S3 storage cleared\n' +
        '✅ Redis cache cleared\n' +
        '🔄 Bot is ready for fresh setup\n\n' +
        'You can now import new images and configure settings.'
      );

      await interaction.editReply({ embeds: [successEmbed] });

      console.log(`🔄 System reset completed by ${interaction.user.tag}`);

    } catch (error) {
      console.error('❌ System reset error:', error);
      
      const errorEmbed = embedUtils.createErrorEmbed(
        `System reset failed: ${error.message}\n\n` +
        `Some data may have been deleted. Check logs for details.\n` +
        `Database may need manual recovery.`
      );

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },

  async updateProgress(interaction, progressEmbed, status) {
    progressEmbed.setDescription(
      `\`\`\`css\n` +
      `[ Processing System Reset ]\n` +
      `\`\`\`\n` +
      `**Database:** ${status.database}\n` +
      `**S3 Storage:** ${status.s3}\n` +
      `**Redis Cache:** ${status.redis}\n` +
      `**System Status:** ${status.restart}\n`
    );

    try {
      await interaction.editReply({ embeds: [progressEmbed] });
    } catch (error) {
      // Ignore edit errors during progress updates
    }
  },

  async clearDatabase() {
    console.log('🗑️  Clearing database...');
    
    // Drop all tables in correct order (respecting foreign keys)
    const tables = [
      'votes',
      'active_duels',
      'duels',
      'images',
      'guild_config'
    ];

    for (const table of tables) {
      await database.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }

    console.log('✅ Database cleared');
  },

  async clearS3Bucket() {
    console.log('🗑️  Clearing S3 bucket...');
    
    const s3Client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });

    const bucketName = process.env.S3_BUCKET_NAME;
    let totalDeleted = 0;
    let continuationToken = null;

    do {
      // List objects
      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
      });

      const listResult = await s3Client.send(listCommand);

      if (!listResult.Contents || listResult.Contents.length === 0) {
        break;
      }

      // Delete objects in batches of 1000 (S3 limit)
      const objects = listResult.Contents.map(obj => ({ Key: obj.Key }));
      
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: objects,
        },
      });

      await s3Client.send(deleteCommand);
      totalDeleted += objects.length;

      console.log(`   Deleted ${totalDeleted} files...`);

      continuationToken = listResult.NextContinuationToken;
    } while (continuationToken);

    console.log(`✅ S3 bucket cleared (${totalDeleted} files deleted)`);
    return totalDeleted;
  },

  async clearRedis() {
    console.log('🗑️  Clearing Redis cache...');
    
    if (!redis.isConnected) {
      console.log('⚠️  Redis not connected, skipping');
      return;
    }

    // Flush all Redis data
    await redis.client.flushAll();
    
    console.log('✅ Redis cache cleared');
  }
};
