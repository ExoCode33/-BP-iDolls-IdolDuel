/**
 * Image Importer
 * UPDATED: Aspect ratio filter (16:9 landscape only) + Silent import
 */

import axios from 'axios';
import sharp from 'sharp';
import database from '../../database/database.js';
import storage from './storage.js';

class ImageImporter {
  /**
   * Check if image has acceptable aspect ratio (16:9 landscape ±10%)
   */
  async checkAspectRatio(buffer) {
    try {
      const metadata = await sharp(buffer).metadata();
      const width = metadata.width;
      const height = metadata.height;
      
      // Calculate aspect ratio
      const aspectRatio = width / height;
      
      // Target: 16:9 = 1.778
      // Allow ±10% tolerance: 1.6 to 1.96
      const minRatio = 1.6;
      const maxRatio = 1.96;
      
      const isAcceptable = aspectRatio >= minRatio && aspectRatio <= maxRatio;
      
      console.log(`📐 Image ${width}x${height} = ${aspectRatio.toFixed(2)} ratio ${isAcceptable ? '✅' : '❌'}`);
      
      return isAcceptable;
    } catch (error) {
      console.error('Error checking aspect ratio:', error);
      return false;
    }
  }

  /**
   * Import a single image (NO REACTIONS)
   */
  async importSingle(guildId, uploaderId, attachment) {
    try {
      const guildIdStr = typeof guildId === 'bigint' ? guildId.toString() : String(guildId);
      const uploaderIdStr = typeof uploaderId === 'bigint' ? uploaderId.toString() : String(uploaderId);

      if (!attachment.contentType?.startsWith('image/')) {
        console.log(`Skipping non-image: ${attachment.name}`);
        return null;
      }

      // Download image
      const response = await axios.get(attachment.url, {
        responseType: 'arraybuffer',
        timeout: 10000
      });

      const buffer = Buffer.from(response.data);

      // ASPECT RATIO CHECK
      const hasCorrectRatio = await this.checkAspectRatio(buffer);
      if (!hasCorrectRatio) {
        console.log(`❌ Skipped ${attachment.name}: Wrong aspect ratio (need ~16:9 landscape)`);
        return null;
      }

      // Process image
      const processedBuffer = await sharp(buffer)
        .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();

      // Upload to S3
      const s3Key = await storage.uploadImage(guildIdStr, processedBuffer);

      // Get starting ELO
      const config = await database.query(
        'SELECT starting_elo FROM guild_config WHERE guild_id = $1',
        [guildIdStr]
      );

      const startingElo = config.rows[0]?.starting_elo || 1000;

      // Insert into database
      const result = await database.query(
        `INSERT INTO images (guild_id, uploader_id, s3_key, elo, imported_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id`,
        [guildIdStr, uploaderIdStr, s3Key, startingElo]
      );

      console.log(`✅ Imported image #${result.rows[0].id} for guild ${guildIdStr}`);
      return result.rows[0].id;

    } catch (error) {
      console.error(`Error importing image:`, error);
      return null;
    }
  }

  /**
   * Import multiple images (NO REACTIONS)
   */
  async importMultiple(guildId, uploaderId, attachments) {
    const results = [];

    for (const attachment of attachments) {
      const imageId = await this.importSingle(guildId, uploaderId, attachment);
      if (imageId) {
        results.push(imageId);
      }
    }

    return results;
  }
}

export default new ImageImporter();
