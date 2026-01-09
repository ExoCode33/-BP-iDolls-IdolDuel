import { SlashCommandBuilder } from 'discord.js';
import database from '../../database/database.js';
import storage from '../../services/image/storage.js';
import embedUtils from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your profile and stats'),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const userId = interaction.user.id;
      const guildId = interaction.guild.id;

      // Get user's top image
      const topImageResult = await database.query(
        `SELECT * FROM images 
         WHERE guild_id = $1 AND uploader_id = $2 AND retired = false
         ORDER BY elo DESC
         LIMIT 1`,
        [guildId, userId]
      );

      let topImage = null;
      let topImageUrl = null;

      if (topImageResult.rows.length > 0) {
        topImage = topImageResult.rows[0];
        topImageUrl = await storage.getImageUrl(topImage.s3_key);
      }

      const embed = embedUtils.createProfileEmbed(null, topImage, topImageUrl);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in profile command:', error);
      const errorEmbed = embedUtils.createErrorEmbed('Failed to load your profile. Please try again!');
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};
