import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import database from '../../database/database.js';
import storage from '../../services/image/storage.js';
import embedUtils from '../../utils/embeds.js';

export default {
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const guildId = interaction.guild.id;

      // Get top 15 images by ELO
      const imagesResult = await database.query(
        `SELECT * FROM images 
         WHERE guild_id = $1 AND retired = false
         ORDER BY elo DESC
         LIMIT 15`,
        [guildId]
      );

      if (imagesResult.rows.length === 0) {
        const errorEmbed = embedUtils.createErrorEmbed('No images found in the leaderboard yet!');
        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      const embed = embedUtils.createLeaderboardEmbed(imagesResult.rows, 1);

      // Add button to view top images
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('leaderboard_top_images')
            .setLabel('🏆 View Top 3 Images')
            .setStyle(ButtonStyle.Primary)
        );

      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
      console.error('Error in leaderboard command:', error);
      const errorEmbed = embedUtils.createErrorEmbed('Failed to load the leaderboard. Please try again!');
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },

  async handleTopImages(interaction) {
    await interaction.deferUpdate();

    try {
      const guildId = interaction.guild.id;

      // Get top 3 images
      const imagesResult = await database.query(
        `SELECT * FROM images 
         WHERE guild_id = $1 AND retired = false
         ORDER BY elo DESC
         LIMIT 3`,
        [guildId]
      );

      if (imagesResult.rows.length === 0) {
        const errorEmbed = embedUtils.createErrorEmbed('No images found in the leaderboard yet!');
        await interaction.editReply({ embeds: [errorEmbed], components: [] });
        return;
      }

      // Show first image
      const images = imagesResult.rows;
      const imageUrl = await storage.getImageUrl(images[0].s3_key);
      const embed = embedUtils.createTopImagesEmbed(images, imageUrl, 0);

      // Create navigation buttons
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('top_image_prev')
            .setLabel('◀ Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('top_image_next')
            .setLabel('Next ▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(images.length === 1),
          new ButtonBuilder()
            .setCustomId('leaderboard_back')
            .setLabel('Back to Leaderboard')
            .setStyle(ButtonStyle.Primary)
        );

      // Store images data in message for navigation
      await interaction.editReply({ 
        embeds: [embed], 
        components: [row],
        content: `__TOP_IMAGES_DATA:${JSON.stringify(images.map(i => i.id))}:0__` // Hidden data
      });
    } catch (error) {
      console.error('Error showing top images:', error);
      const errorEmbed = embedUtils.createErrorEmbed('Failed to load top images. Please try again!');
      await interaction.editReply({ embeds: [errorEmbed], components: [] });
    }
  },

  async handleImageNavigation(interaction, direction) {
    await interaction.deferUpdate();

    try {
      // Extract data from message content
      const content = interaction.message.content;
      const match = content.match(/__TOP_IMAGES_DATA:(.+?):(\d+)__/);
      
      if (!match) {
        throw new Error('Navigation data not found');
      }

      const imageIds = JSON.parse(match[1]);
      let currentIndex = parseInt(match[2]);

      // Update index
      if (direction === 'next') currentIndex++;
      if (direction === 'prev') currentIndex--;

      // Get images
      const imagesResult = await database.query(
        `SELECT * FROM images WHERE id = ANY($1) ORDER BY elo DESC`,
        [imageIds]
      );

      const images = imagesResult.rows;
      const imageUrl = await storage.getImageUrl(images[currentIndex].s3_key);
      const embed = embedUtils.createTopImagesEmbed(images, imageUrl, currentIndex);

      // Update navigation buttons
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('top_image_prev')
            .setLabel('◀ Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentIndex === 0),
          new ButtonBuilder()
            .setCustomId('top_image_next')
            .setLabel('Next ▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentIndex === images.length - 1),
          new ButtonBuilder()
            .setCustomId('leaderboard_back')
            .setLabel('Back to Leaderboard')
            .setStyle(ButtonStyle.Primary)
        );

      await interaction.editReply({ 
        embeds: [embed], 
        components: [row],
        content: `__TOP_IMAGES_DATA:${JSON.stringify(imageIds)}:${currentIndex}__`
      });
    } catch (error) {
      console.error('Error navigating images:', error);
    }
  },

  async handleBackToLeaderboard(interaction) {
    await interaction.deferUpdate();

    try {
      const guildId = interaction.guild.id;

      // Get top 15 images again
      const imagesResult = await database.query(
        `SELECT * FROM images 
         WHERE guild_id = $1 AND retired = false
         ORDER BY elo DESC
         LIMIT 15`,
        [guildId]
      );

      const embed = embedUtils.createLeaderboardEmbed(imagesResult.rows, 1);

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('leaderboard_top_images')
            .setLabel('🏆 View Top 3 Images')
            .setStyle(ButtonStyle.Primary)
        );

      await interaction.editReply({ embeds: [embed], components: [row], content: '' });
    } catch (error) {
      console.error('Error returning to leaderboard:', error);
    }
  }
};
