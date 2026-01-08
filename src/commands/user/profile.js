import database from '../../database/database.js';
import storage from '../../services/storage.js';
import embedUtils from '../../utils/embeds.js';

export default {
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const userId = interaction.user.id;
      const guildId = interaction.guild.id;

      // Get or create user record
      let userResult = await database.query(
        'SELECT * FROM users WHERE guild_id = $1 AND user_id = $2',
        [guildId, userId]
      );

      if (userResult.rows.length === 0) {
        // Create new user record
        const configResult = await database.query(
          'SELECT starting_elo FROM guild_config WHERE guild_id = $1',
          [guildId]
        );
        
        const startingElo = configResult.rows[0]?.starting_elo || 1000;

        await database.query(
          `INSERT INTO users (guild_id, user_id, elo) VALUES ($1, $2, $3)`,
          [guildId, userId, startingElo]
        );

        userResult = await database.query(
          'SELECT * FROM users WHERE guild_id = $1 AND user_id = $2',
          [guildId, userId]
        );
      }

      const user = userResult.rows[0];

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
        topImageUrl = await storage.getImageUrl(topImage.s3_key); // AWAIT added for signed URLs
      }

      const embed = embedUtils.createProfileEmbed(user, topImage, topImageUrl);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in profile command:', error);
      const errorEmbed = embedUtils.createErrorEmbed('Failed to load your profile. Please try again!');
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};
