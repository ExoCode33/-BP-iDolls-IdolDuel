import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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
      forcePathStyle: true,
    });
    
    this.bucketName = process.env.S3_BUCKET_NAME;
    this.endpoint = process.env.S3_ENDPOINT;
    
    // URL cache: Map<s3Key, {url: string, expiresAt: number}>
    this.urlCache = new Map();
    
    // Cache cleanup interval (every 30 minutes)
    setInterval(() => this.cleanExpiredUrls(), 1800000);
    
    // Log configuration on startup
    console.log('📦 S3 Storage Configuration:');
    console.log(`  Endpoint: ${this.endpoint}`);
    console.log(`  Bucket: ${this.bucketName}`);
    console.log(`  Region: ${process.env.S3_REGION || 'us-east-1'}`);
    console.log(`  Using: Signed URLs with caching (Railway S3)`);
  }

  /**
   * Clean expired URLs from cache
   */
  cleanExpiredUrls() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of this.urlCache.entries()) {
      if (value.expiresAt <= now) {
        this.urlCache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired URLs from cache`);
    }
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

      console.log(`📤 Uploading image: ${s3Key}`);

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
      
      console.log(`✅ Image uploaded successfully`);
      console.log(`   S3 Key: ${s3Key}`);
      
      return { s3Key, hash };
    } catch (error) {
      console.error('❌ S3 upload error:', error);
      throw new Error('Failed to upload image to storage');
    }
  }

  /**
   * Get signed URL for an image with caching (required for Railway S3)
   * @param {string} s3Key - S3 object key
   * @returns {Promise<string>} - Signed URL
   */
  async getImageUrl(s3Key) {
    try {
      if (!s3Key) {
        console.error('❌ No S3 key provided to getImageUrl');
        return null;
      }

      // Check cache first
      const cached = this.urlCache.get(s3Key);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.url;
      }

      // Generate new signed URL (expires in 23 hours, cache expires 1 hour before that)
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const signedUrl = await getSignedUrl(this.client, command, { 
        expiresIn: 82800 // 23 hours
      });
      
      // Cache the URL (expires 22 hours from now to be safe)
      this.urlCache.set(s3Key, {
        url: signedUrl,
        expiresAt: Date.now() + 79200000 // 22 hours in milliseconds
      });
      
      return signedUrl;
    } catch (error) {
      console.error('❌ Error generating signed URL:', error);
      console.error('   S3 Key:', s3Key);
      return null;
    }
  }

  /**
   * Batch get URLs for multiple images (more efficient)
   * @param {Array<string>} s3Keys - Array of S3 keys
   * @returns {Promise<Map<string, string>>} - Map of s3Key to URL
   */
  async getBatchImageUrls(s3Keys) {
    const urlMap = new Map();
    const keysToFetch = [];
    
    // Check cache first
    for (const key of s3Keys) {
      const cached = this.urlCache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        urlMap.set(key, cached.url);
      } else {
        keysToFetch.push(key);
      }
    }
    
    // Fetch remaining URLs in parallel
    if (keysToFetch.length > 0) {
      const promises = keysToFetch.map(async (key) => {
        const url = await this.getImageUrl(key);
        if (url) {
          urlMap.set(key, url);
        }
      });
      
      await Promise.all(promises);
    }
    
    return urlMap;
  }

  /**
   * Invalidate cache for a specific key
   * @param {string} s3Key - S3 object key
   */
  invalidateCache(s3Key) {
    this.urlCache.delete(s3Key);
  }

  /**
   * Clear entire URL cache
   */
  clearCache() {
    const size = this.urlCache.size;
    this.urlCache.clear();
    console.log(`🧹 Cleared ${size} URLs from cache`);
  }

  /**
   * Get cache statistics
   * @returns {Object}
   */
  getCacheStats() {
    const now = Date.now();
    let validCount = 0;
    let expiredCount = 0;
    
    for (const [_, value] of this.urlCache.entries()) {
      if (value.expiresAt > now) {
        validCount++;
      } else {
        expiredCount++;
      }
    }
    
    return {
      total: this.urlCache.size,
      valid: validCount,
      expired: expiredCount
    };
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
      
      // Invalidate cache
      this.invalidateCache(s3Key);
      
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
      console.log(`⬇️ Downloading from Discord: ${discordUrl}`);
      
      const response = await fetch(discordUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      console.log(`   Downloaded ${buffer.length} bytes`);
      
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

  /**
   * Test S3 connection and configuration
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      console.log('🔍 Testing S3 connection...');
      console.log(`   Endpoint: ${this.endpoint}`);
      console.log(`   Bucket: ${this.bucketName}`);
      console.log(`   Region: ${process.env.S3_REGION || 'us-east-1'}`);
      
      // Try to list objects (this will fail if credentials are wrong)
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        MaxKeys: 1,
      });
      
      const result = await this.client.send(command);
      console.log('✅ S3 connection successful');
      
      if (result.Contents && result.Contents.length > 0) {
        const firstObject = result.Contents[0];
        const testUrl = await this.getImageUrl(firstObject.Key);
        console.log(`   Sample object: ${firstObject.Key}`);
        console.log(`   Sample signed URL generated and cached`);
        console.log('   ✅ URL caching enabled for faster loading');
      }
      
      return true;
    } catch (error) {
      console.error('❌ S3 connection test failed:', error.message);
      console.error('   Check your S3_ENDPOINT, S3_BUCKET_NAME, and credentials in .env');
      return false;
    }
  }
}

export default new S3Storage();
