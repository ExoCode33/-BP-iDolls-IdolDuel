/**
 * S3 Storage Service
 * Handles all S3 operations for image storage
 * Uses Railway S3-compatible storage
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import redis from '../../database/redis.js';

class StorageService {
  constructor() {
    this.s3Client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });

    this.bucketName = process.env.S3_BUCKET_NAME;
    this.urlCacheDuration = 3600; // 1 hour cache for signed URLs
  }

  /**
   * Generate S3 key for an image
   * @param {string} guildId - Guild ID
   * @param {Buffer} imageBuffer - Image data
   * @returns {string} S3 key (path)
   */
  generateKey(guildId, imageBuffer) {
    const hash = crypto.createHash('sha256').update(imageBuffer).digest('hex');
    const extension = this.getImageExtension(imageBuffer);
    return `${guildId}/${hash}.${extension}`;
  }

  /**
   * Detect image extension from buffer
   * @param {Buffer} buffer - Image buffer
   * @returns {string} Extension (png or jpg)
   */
  getImageExtension(buffer) {
    // Check magic numbers
    if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'png';
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) return 'jpg';
    return 'png'; // Default to PNG
  }

  /**
   * Upload image to S3
   * @param {Buffer} imageBuffer - Image data
   * @param {string} s3Key - S3 key (path)
   * @returns {Promise<string>} S3 key
   */
  async uploadImage(imageBuffer, s3Key) {
    const contentType = s3Key.endsWith('.png') ? 'image/png' : 'image/jpeg';

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      Body: imageBuffer,
      ContentType: contentType,
    });

    await this.s3Client.send(command);
    console.log(`✅ Image uploaded to S3: ${s3Key}`);
    
    return s3Key;
  }

  /**
   * Delete image from S3
   * @param {string} s3Key - S3 key (path)
   */
  async deleteImage(s3Key) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    });

    await this.s3Client.send(command);
    
    // Invalidate cache
    await redis.del(`url:${s3Key}`);
    
    console.log(`✅ Image deleted from S3: ${s3Key}`);
  }

  /**
   * Get signed URL for an image (with caching)
   * @param {string} s3Key - S3 key (path)
   * @returns {Promise<string>} Signed URL
   */
  async getImageUrl(s3Key) {
    // Try cache first
    const cacheKey = `url:${s3Key}`;
    const cachedUrl = await redis.get(cacheKey);
    
    if (cachedUrl) {
      return cachedUrl;
    }

    // Generate new signed URL
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    });

    const url = await getSignedUrl(this.s3Client, command, {
      expiresIn: this.urlCacheDuration,
    });

    // Cache it (expires slightly before the URL expires)
    await redis.set(cacheKey, url, this.urlCacheDuration - 60);

    return url;
  }

  /**
   * Test S3 connection
   */
  async testConnection() {
    try {
      console.log('🔍 Testing S3 connection...');
      console.log('   Endpoint:', process.env.S3_ENDPOINT);
      console.log('   Bucket:', this.bucketName);
      console.log('   Region:', process.env.S3_REGION || 'us-east-1');

      // Try to generate a signed URL for a test object
      const testKey = 'test/connection.txt';
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: testKey,
      });

      await getSignedUrl(this.s3Client, command, { expiresIn: 60 });
      
      console.log('✅ S3 connection successful');
      console.log('   ✅ URL caching enabled for faster loading');
    } catch (error) {
      console.error('❌ S3 connection failed:', error.message);
      throw error;
    }
  }

  /**
   * Validate image buffer
   * @param {Buffer} buffer - Image buffer
   * @returns {boolean} True if valid
   */
  isValidImage(buffer) {
    if (!buffer || buffer.length === 0) return false;

    // Check for PNG or JPEG magic numbers
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
    const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8;

    return isPng || isJpeg;
  }
}

export default new StorageService();
