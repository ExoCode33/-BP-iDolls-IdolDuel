import imageManagement from '../commands/admin/imageManagement.js';
import adminConfig from '../commands/admin/config.js';
import adminLogs from '../commands/admin/adminLogs.js';
import database from '../database/database.js';
import embedUtils from '../utils/embeds.js';
import { MessageFlags } from 'discord.js';

export async function handleSelectMenu(interaction) {
  const customId = interaction.customId;

  // Admin menu navigation
  if (customId === 'admin_menu_select') {
    const value = interaction.values[0];
    const config = await database.query(
      'SELECT * FROM guild_config WHERE guild_id = $1',
      [interaction.guild.id]
    );
    
    const guildConfig = config.rows[0];
    
    await interaction.deferUpdate();
    
    if (value === 'quick_setup') {
      await adminConfig.showQuickSetup(interaction, guildConfig);
    } else if (value === 'approve_images') {
      // TODO: Show approval queue
      await interaction.followUp({
        content: 'Approval queue coming soon!',
        flags: MessageFlags.Ephemeral
      });
    } else if (value === 'schedule_settings') {
      await adminConfig.showSchedulePresets(interaction, guildConfig);
    } else if (value === 'import_settings') {
      await adminConfig.showImportSettings(interaction, guildConfig);
    } else if (value === 'retirement_settings') {
      await adminConfig.showRetirementSettings(interaction, guildConfig);
    } else if (value === 'advanced_settings') {
      await adminConfig.showAdvancedSettings(interaction, guildConfig);
    } else if (value === 'view_logs') {
      await adminLogs.showLogs(interaction);
    }
    
    return;
  }

  // Schedule presets
  if (customId === 'schedule_preset_select') {
    const value = interaction.values[0];
    await interaction.deferUpdate();
    
    let duration, interval;
    
    if (value === 'preset_6h') {
      duration = interval = 21600; // 6 hours
    } else if (value === 'preset_12h') {
      duration = interval = 43200; // 12 hours
    } else if (value === 'preset_24h') {
      duration = interval = 86400; // 24 hours
    } else if (value === 'preset_custom') {
      await interaction.showModal(adminConfig.createDuelDurationModal());
      return;
    }
    
    await database.query(
      'UPDATE guild_config SET duel_duration = $1, duel_interval = $2 WHERE guild_id = $3',
      [duration, interval, interaction.guild.id]
    );
    
    const successEmbed = embedUtils.createSuccessEmbed(
      `Schedule updated!\n\n` +
      `Duels will run every ${duration / 3600} hours for ${duration / 3600} hours.`
    );
    
    await interaction.followUp({ embeds: [successEmbed], flags: MessageFlags.Ephemeral });
    
    const config = await database.query(
      'SELECT * FROM guild_config WHERE guild_id = $1',
      [interaction.guild.id]
    );
    await adminConfig.showMainMenu(interaction, config.rows[0]);
    return;
  }

  // Browse images - sort menu
  if (customId === 'browse_images_sort') {
    const sortBy = interaction.values[0];
    const content = interaction.message.content;
    const match = content.match(/__BROWSE_STATE:(.+?)__/);
    const state = match ? JSON.parse(match[1]) : { page: 1, filterActive: 'all' };
    await imageManagement.browseImages(interaction, state.page, sortBy, state.filterActive);
    return;
  }

  // Browse images - filter menu
  if (customId === 'browse_images_filter') {
    const filterActive = interaction.values[0];
    const content = interaction.message.content;
    const match = content.match(/__BROWSE_STATE:(.+?)__/);
    const state = match ? JSON.parse(match[1]) : { page: 1, sortBy: 'elo' };
    await imageManagement.browseImages(interaction, 1, state.sortBy, filterActive);
    return;
  }

  // NEW: Gallery sort
  if (customId === 'gallery_sort') {
    const sortBy = interaction.values[0];
    const content = interaction.message.content;
    const match = content.match(/__GALLERY:(.+?)__/);
    const state = match ? JSON.parse(match[1]) : { index: 0, filterActive: 'all' };
    await imageManagement.showGallery(interaction, state.index, sortBy, state.filterActive);
    return;
  }

  // NEW: Gallery filter
  if (customId === 'gallery_filter') {
    const filterActive = interaction.values[0];
    const content = interaction.message.content;
    const match = content.match(/__GALLERY:(.+?)__/);
    const state = match ? JSON.parse(match[1]) : { index: 0, sortBy: 'elo' };
    await imageManagement.showGallery(interaction, 0, state.sortBy, filterActive);
    return;
  }
}

export default { handleSelectMenu };
