/**
 * S3 Storage Manager
 * Handles image upload/download/delete with URL caching
 * FIXED: Uses correct Railway environment variable names (S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

class StorageManager {
  constructor() {
    this.s3Client = null;
    this.bucketName = process.env.S3_BUCKET_NAME;
    this.urlCache = new Map();
    this.cacheExpiry = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
  }

  /**
   * Initialize S3 connection with credential validation
   * FIXED: Uses Railway's S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY
   */
  async initialize() {
    try {
      // FIXED: Use correct environment variable names from Railway
      const accessKey = process.env.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY;
      const secretKey = process.env.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY;

      // Validate credentials first
      if (!accessKey || !secretKey) {
        throw new Error('S3 credentials are missing! Check S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY in environment');
      }

      if (accessKey.length < 10) {
        throw new Error('S3_ACCESS_KEY_ID looks invalid (too short)');
      }

      if (secretKey.length < 10) {
        throw new Error('S3_SECRET_ACCESS_KEY looks invalid (too short)');
      }

      if (!process.env.S3_ENDPOINT) {
        throw new Error('S3_ENDPOINT is missing');
      }

      if (!process.env.S3_BUCKET_NAME) {
        throw new Error('S3_BUCKET_NAME is missing');
      }

      if (!process.env.S3_REGION) {
        throw new Error('S3_REGION is missing');
      }

      this.s3Client = new S3Client({
        region: process.env.S3_REGION,
        endpoint: process.env.S3_ENDPOINT,
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey
        },
        forcePathStyle: true // Required for Railway S3
      });

      // Test connection
      console.log('🔍 Testing S3 connection...');
      console.log('   Endpoint:', process.env.S3_ENDPOINT);
      console.log('   Bucket:', process.env.S3_BUCKET_NAME);
      console.log('   Region:', process.env.S3_REGION);
      console.log('   Access Key:', accessKey ? `${accessKey.substring(0, 4)}****` : 'MISSING');
      console.log('   Secret Key:', secretKey ? `${secretKey.substring(0, 4)}****` : 'MISSING');

      console.log('✅ S3 client initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize S3:', error.message);
      throw error;
    }
  }

  /**
   * Upload an image to S3
   */
  async uploadImage(guildId, imageBuffer) {
    try {
      const fileHash = crypto.createHash('md5').update(imageBuffer).digest('hex');
      const s3Key = `${guildId}/${fileHash}.jpg`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: imageBuffer,
        ContentType: 'image/jpeg'
      });

      await this.s3Client.send(command);

      return s3Key;
    } catch (error) {
      console.error('Error uploading to S3:', error);
      throw error;
    }
  }

  /**
   * Get a signed URL for an image (with caching)
   */
  async getImageUrl(s3Key) {
    try {
      // Check cache first
      const cached = this.urlCache.get(s3Key);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.url;
      }

      // Generate new signed URL (valid for 7 hours)
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn: 25200 });

      // Cache the URL
      this.urlCache.set(s3Key, {
        url: url,
        expiresAt: Date.now() + this.cacheExpiry
      });

      return url;
    } catch (error) {
      console.error('Error getting image URL:', error);
      throw error;
    }
  }

  /**
   * Delete an image from S3
   */
  async deleteImage(s3Key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key
      });

      await this.s3Client.send(command);

      // Remove from cache
      this.urlCache.delete(s3Key);

      console.log(`🗑️ Deleted image: ${s3Key}`);
    } catch (error) {
      console.error('Error deleting from S3:', error);
      throw error;
    }
  }

  /**
   * Clear expired URLs from cache (run periodically)
   */
  clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.urlCache.entries()) {
      if (now >= value.expiresAt) {
        this.urlCache.delete(key);
      }
    }
  }
}

export default new StorageManager();
