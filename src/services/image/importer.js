/**
 * Image Importer Service
 * Handles automatic image importing from Discord messages
 */

import database from '../../database/database.js';
import storage from './storage.js';
import https from 'https';
import http from 'http';

class ImageImporter {
  /**
   * Import image from Discord message attachment
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID who posted
   * @param {string} attachmentUrl - Discord CDN URL
   * @returns {Promise<Object>} Image record or null
   */
  async importFromMessage(guildId, userId, attachmentUrl) {
    try {
      // Download image from Discord CDN
      const imageBuffer = await this.downloadImage(attachmentUrl);

      if (!imageBuffer) {
        console.log('⚠️ Failed to download image');
        return null;
      }

      // Validate image
      if (!storage.isValidImage(imageBuffer)) {
        console.log('⚠️ Invalid image format');
        return null;
      }

      // Check size (max 10MB)
      if (imageBuffer.length > 10 * 1024 * 1024) {
        console.log('⚠️ Image too large (>10MB)');
        return null;
      }

      // Generate S3 key
      const s3Key = storage.generateKey(guildId, imageBuffer);

      // Check if already exists (duplicate detection)
      const existingImage = await database.query(
        'SELECT id FROM images WHERE guild_id = $1 AND s3_key = $2',
        [guildId, s3Key]
      );

      if (existingImage.rows.length > 0) {
        console.log('⚠️ Duplicate image detected');
        return null;
      }

      // Upload to S3
      await storage.uploadImage(imageBuffer, s3Key);

      // Get starting ELO from config
      const configResult = await database.query(
        'SELECT starting_elo FROM guild_config WHERE guild_id = $1',
        [guildId]
      );

      const startingElo = configResult.rows[0]?.starting_elo || 1000;

      // Insert into database
      const result = await database.query(
        `INSERT INTO images (guild_id, s3_key, elo, uploader_id, imported_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING *`,
        [guildId, s3Key, startingElo, userId]
      );

      const image = result.rows[0];
      console.log(`✅ Image imported: ID ${image.id} (ELO: ${startingElo})`);

      return image;
    } catch (error) {
      console.error('Error importing image:', error);
      return null;
    }
  }

  /**
   * Download image from URL
   * @param {string} url - Image URL
   * @returns {Promise<Buffer>} Image buffer
   */
  async downloadImage(url) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      
      protocol.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      }).on('error', reject);
    });
  }

  /**
   * Validate Discord attachment
   * @param {Object} attachment - Discord attachment object
   * @returns {boolean} True if valid image attachment
   */
  isValidAttachment(attachment) {
    if (!attachment.contentType) return false;
    
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    return validTypes.includes(attachment.contentType.toLowerCase());
  }

  /**
   * Import multiple images from a message
   * @param {string} guildId - Guild ID
   * @param {string} userId - User ID
   * @param {Array} attachments - Array of Discord attachments
   * @returns {Promise<Array>} Array of imported image records
   */
  async importMultiple(guildId, userId, attachments) {
    const imported = [];

    for (const attachment of attachments) {
      if (!this.isValidAttachment(attachment)) {
        continue;
      }

      const image = await this.importFromMessage(guildId, userId, attachment.url);
      
      if (image) {
        imported.push(image);
      }
    }

    return imported;
  }
}

export default new ImageImporter();
