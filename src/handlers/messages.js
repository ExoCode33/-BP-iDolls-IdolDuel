/**
 * Message Handler
 * Handles auto-import of images from designated channels
 */

import database from '../database/database.js';
import importer from '../services/image/importer.js';

export async function handleMessage(message) {
  // Ignore bots
  if (message.author.bot) return;

  // Ignore DMs
  if (!message.guild) return;

  // Check if message has attachments
  if (message.attachments.size === 0) return;

  try {
    const guildId = message.guild.id;

    // Get config
    const configResult = await database.query(
      'SELECT image_channel_id FROM guild_config WHERE guild_id = $1',
      [guildId]
    );

    if (configResult.rows.length === 0) return;

    const config = configResult.rows[0];

    // Check if this is the image channel
    if (!config.image_channel_id || config.image_channel_id !== message.channel.id) {
      return;
    }

    // Import images
    const attachments = Array.from(message.attachments.values());
    const imported = await importer.importMultiple(
      guildId,
      message.author.id,
      attachments
    );

    // React to message
    if (imported.length > 0) {
      await message.react('✅');
      console.log(`✅ Auto-imported ${imported.length} image(s) from ${message.author.tag}`);
    } else {
      await message.react('❌');
      console.log(`⚠️ Failed to import images from ${message.author.tag}`);
    }
  } catch (error) {
    console.error('Error handling message for import:', error);
  }
}

export default { handleMessage };
