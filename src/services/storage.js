import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import crypto from 'crypto';

class S3Storage {
  constructor() {
    this.client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true, // Required for Railway and some S3-compatible services
    });
    
    this.bucketName = process.env.S3_BUCKET_NAME;
  }

  /**
   * Upload an image buffer to S3
   * @param {Buffer} buffer - Image buffer
   * @param {string} filename - Original filename
   * @param {string} guildId - Guild ID for organization
   * @returns {Promise<{s3Key: string, hash: string}>}
   */
  async uploadImage(buffer, filename, guildId) {
    try {
      // Calculate hash for deduplication
      const hash = this.calculateHash(buffer);
      
      // Create unique S3 key
      const extension = filename.split('.').pop().toLowerCase();
      const s3Key = `${guildId}/${hash}.${extension}`;

      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucketName,
          Key: s3Key,
          Body: buffer,
          ContentType: this.getContentType(extension),
        },
      });

      await upload.done();
      
      console.log(`✅ Image uploaded to S3: ${s3Key}`);
      return { s3Key, hash };
    } catch (error) {
      console.error('❌ S3 upload error:', error);
      throw new Error('Failed to upload image to storage');
    }
  }

  /**
   * Get image URL from S3
   * @param {string} s3Key - S3 object key
   * @returns {string} - Public URL to image
   */
  getImageUrl(s3Key) {
    // For Railway bucket, construct the public URL
    const endpoint = process.env.S3_ENDPOINT.replace('https://', '').replace('http://', '');
    return `https://${this.bucketName}.${endpoint}/${s3Key}`;
  }

  /**
   * Delete an image from S3
   * @param {string} s3Key - S3 object key
   * @returns {Promise<boolean>}
   */
  async deleteImage(s3Key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      await this.client.send(command);
      console.log(`✅ Image deleted from S3: ${s3Key}`);
      return true;
    } catch (error) {
      console.error('❌ S3 delete error:', error);
      return false;
    }
  }

  /**
   * Download image from Discord and upload to S3
   * @param {string} discordUrl - Discord CDN URL
   * @param {string} guildId - Guild ID
   * @returns {Promise<{s3Key: string, hash: string}>}
   */
  async downloadAndUpload(discordUrl, guildId) {
    try {
      const response = await fetch(discordUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Extract filename from URL
      const filename = discordUrl.split('/').pop().split('?')[0];
      
      return await this.uploadImage(buffer, filename, guildId);
    } catch (error) {
      console.error('❌ Download and upload error:', error);
      throw error;
    }
  }

  /**
   * Calculate SHA-256 hash of buffer for deduplication
   * @param {Buffer} buffer - Image buffer
   * @returns {string} - Hex hash
   */
  calculateHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Get content type based on file extension
   * @param {string} extension - File extension
   * @returns {string} - MIME type
   */
  getContentType(extension) {
    const types = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
    };
    return types[extension] || 'application/octet-stream';
  }

  /**
   * Check if file extension is supported
   * @param {string} filename - Filename to check
   * @returns {boolean}
   */
  isSupportedFormat(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    return ['jpg', 'jpeg', 'png'].includes(extension);
  }
}

export default new S3Storage();
