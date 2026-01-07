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
    this.endpoint = process.env.S3_ENDPOINT;
    
    // Log configuration on startup
    console.log('📦 S3 Storage Configuration:');
    console.log(`  Endpoint: ${this.endpoint}`);
    console.log(`  Bucket: ${this.bucketName}`);
    console.log(`  Region: ${process.env.S3_REGION || 'us-east-1'}`);
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
          ACL: 'public-read', // Make objects publicly readable
        },
      });

      await upload.done();
      
      const url = this.getImageUrl(s3Key);
      console.log(`✅ Image uploaded successfully`);
      console.log(`   S3 Key: ${s3Key}`);
      console.log(`   URL: ${url}`);
      
      return { s3Key, hash };
    } catch (error) {
      console.error('❌ S3 upload error:', error);
      throw new Error('Failed to upload image to storage');
    }
  }

  /**
   * Get image URL from S3 - with multiple format attempts
   * @param {string} s3Key - S3 object key
   * @returns {string} - Public URL to image
   */
  getImageUrl(s3Key) {
    try {
      if (!s3Key) {
        console.error('❌ No S3 key provided to getImageUrl');
        return null;
      }

      // Clean the endpoint
      const endpoint = this.endpoint.replace('https://', '').replace('http://', '');
      
      // Try different URL formats based on common S3 configurations
      let url;
      
      // Format 1: https://endpoint/bucket/key (most common for Railway)
      url = `https://${endpoint}/${this.bucketName}/${s3Key}`;
      
      // Format 2: If endpoint already contains bucket subdomain
      if (endpoint.includes(this.bucketName)) {
        url = `https://${endpoint}/${s3Key}`;
      }
      
      // Format 3: Virtual-hosted style (bucket.endpoint/key)
      // url = `https://${this.bucketName}.${endpoint}/${s3Key}`;
      
      console.log(`🔗 Generated URL: ${url}`);
      return url;
    } catch (error) {
      console.error('❌ Error generating image URL:', error);
      console.error('   S3 Key:', s3Key);
      console.error('   Endpoint:', this.endpoint);
      console.error('   Bucket:', this.bucketName);
      return null;
    }
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
        const testUrl = this.getImageUrl(firstObject.Key);
        console.log(`   Sample object: ${firstObject.Key}`);
        console.log(`   Sample URL: ${testUrl}`);
        console.log('');
        console.log('⚠️  TEST THIS URL IN YOUR BROWSER:');
        console.log(`   ${testUrl}`);
        console.log('   If it works, URLs are correct. If not, we need to adjust the format.');
      }
      
      return true;
    } catch (error) {
      console.error('❌ S3 connection test failed:', error.message);
      console.error('   Check your S3_ENDPOINT, S3_BUCKET_NAME, and credentials in .env');
      return false;
    }
  }

  /**
   * Debug method to test a specific image URL
   * @param {string} s3Key - S3 key to test
   */
  debugImageUrl(s3Key) {
    console.log('\n🔍 DEBUG: Testing URL formats for key:', s3Key);
    console.log('');
    
    const endpoint = this.endpoint.replace('https://', '').replace('http://', '');
    
    console.log('Format 1 (path-style):');
    console.log(`  https://${endpoint}/${this.bucketName}/${s3Key}`);
    console.log('');
    
    console.log('Format 2 (virtual-hosted):');
    console.log(`  https://${this.bucketName}.${endpoint}/${s3Key}`);
    console.log('');
    
    console.log('Format 3 (subdomain in endpoint):');
    console.log(`  https://${endpoint}/${s3Key}`);
    console.log('');
    
    console.log('Try each URL in your browser to see which one works!');
    console.log('');
  }
}

export default new S3Storage();
