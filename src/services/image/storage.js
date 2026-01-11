/**
 * S3 Storage Manager
 * DIAGNOSTIC VERSION - Shows exactly what's wrong
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

class StorageManager {
  constructor() {
    this.s3Client = null;
    this.bucketName = process.env.S3_BUCKET_NAME;
    this.urlCache = new Map();
    this.cacheExpiry = 6 * 60 * 60 * 1000;
  }

  async initialize() {
    try {
      console.log('\n🔍 DIAGNOSING S3 CONFIGURATION:');
      console.log('================================');
      
      // Check all possible credential combinations
      const accessKey = process.env.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY;
      const secretKey = process.env.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY;
      
      console.log('S3_ACCESS_KEY_ID:', process.env.S3_ACCESS_KEY_ID ? 'SET ✅' : 'MISSING ❌');
      console.log('S3_SECRET_ACCESS_KEY:', process.env.S3_SECRET_ACCESS_KEY ? 'SET ✅' : 'MISSING ❌');
      console.log('S3_ACCESS_KEY:', process.env.S3_ACCESS_KEY ? 'SET ✅' : 'MISSING ❌');
      console.log('S3_SECRET_KEY:', process.env.S3_SECRET_KEY ? 'SET ✅' : 'MISSING ❌');
      console.log('S3_ENDPOINT:', process.env.S3_ENDPOINT || 'MISSING ❌');
      console.log('S3_BUCKET_NAME:', process.env.S3_BUCKET_NAME || 'MISSING ❌');
      console.log('S3_REGION:', process.env.S3_REGION || 'MISSING ❌');
      console.log('');
      console.log('Using Access Key:', accessKey ? `${accessKey.substring(0, 8)}****` : 'NONE ❌');
      console.log('Using Secret Key:', secretKey ? `${secretKey.substring(0, 8)}****` : 'NONE ❌');
      console.log('================================\n');

      if (!accessKey || !secretKey) {
        throw new Error('❌ S3 credentials missing! Set S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY');
      }

      if (!process.env.S3_ENDPOINT) {
        throw new Error('❌ S3_ENDPOINT missing');
      }

      if (!process.env.S3_BUCKET_NAME) {
        throw new Error('❌ S3_BUCKET_NAME missing');
      }

      this.s3Client = new S3Client({
        region: process.env.S3_REGION || 'us-east-1',
        endpoint: process.env.S3_ENDPOINT,
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey
        },
        forcePathStyle: true
      });

      console.log('✅ S3 Client Created Successfully\n');
      
    } catch (error) {
      console.error('❌ S3 INITIALIZATION FAILED:', error.message);
      throw error;
    }
  }

  async uploadImage(guildId, imageBuffer) {
    try {
      const fileHash = crypto.createHash('md5').update(imageBuffer).digest('hex');
      const s3Key = `${guildId}/${fileHash}.jpg`;

      console.log(`📤 Uploading: ${s3Key}`);

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: imageBuffer,
        ContentType: 'image/jpeg'
      });

      await this.s3Client.send(command);
      console.log(`✅ Upload successful: ${s3Key}`);

      return s3Key;
    } catch (error) {
      console.error('❌ Upload failed:', error.message);
      throw error;
    }
  }

  async getImageUrl(s3Key) {
    try {
      // Check cache first
      const cached = this.urlCache.get(s3Key);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.url;
      }

      console.log(`🔗 Generating signed URL for: ${s3Key}`);

      // Use GetObject instead of HeadObject for signed URLs
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn: 25200 });

      // Cache the URL
      this.urlCache.set(s3Key, {
        url: url,
        expiresAt: Date.now() + this.cacheExpiry
      });

      console.log(`✅ Signed URL generated`);
      return url;
    } catch (error) {
      console.error('❌ Failed to generate signed URL:', error.message);
      console.error('   Key:', s3Key);
      console.error('   Bucket:', this.bucketName);
      throw error;
    }
  }

  async deleteImage(s3Key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key
      });

      await this.s3Client.send(command);
      this.urlCache.delete(s3Key);

      console.log(`🗑️ Deleted: ${s3Key}`);
    } catch (error) {
      console.error('❌ Delete failed:', error.message);
      throw error;
    }
  }

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
