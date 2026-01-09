import adminConfig from '../commands/admin/config.js';
import imageManagement from '../commands/admin/imageManagement.js';
import adminLogs from '../commands/admin/adminLogs.js';

export async function handleSelectMenu(interaction) {
  const customId = interaction.customId;

  // Main admin menu
  if (customId === 'admin_menu') {
    const value = interaction.values[0];
    const config = await adminConfig.getOrCreateConfig(interaction.guild.id);

    switch (value) {
      case 'basic_settings':
        await adminConfig.handleBasicSettings(interaction, config);
        break;
      case 'elo_settings':
        await adminConfig.handleEloSettings(interaction, config);
        break;
      case 'duel_controls':
        await adminConfig.handleDuelControls(interaction, config);
        break;
      case 'image_management':
        await imageManagement.showImageManagement(interaction, config);
        break;
      case 'season_management':
        await adminConfig.handleSeasonManagement(interaction, config);
        break;
      case 'system_reset':
        await adminConfig.handleSystemReset(interaction, config);
        break;
      case 'admin_logs':
        await adminLogs.showAdminLogs(interaction);
        break;
      default:
        await interaction.reply({ content: 'Unknown option', ephemeral: true });
    }
    return;
  }

  // Image browser sort menu (NEW)
  if (customId === 'browse_images_sort') {
    const content = interaction.message.content;
    const match = content.match(/__BROWSE_STATE:(.+?)__/);
    const state = match ? JSON.parse(match[1]) : { page: 1, filterActive: 'all' };
    const sortBy = interaction.values[0];
    await imageManagement.browseImages(interaction, state.page, sortBy, state.filterActive);
    return;
  }

  // Image browser filter menu (NEW)
  if (customId === 'browse_images_filter') {
    const content = interaction.message.content;
    const match = content.match(/__BROWSE_STATE:(.+?)__/);
    const state = match ? JSON.parse(match[1]) : { page: 1, sortBy: 'elo' };
    const filterActive = interaction.values[0];
    await imageManagement.browseImages(interaction, 1, state.sortBy, filterActive);
    return;
  }

  // Admin logs filter menu (NEW)
  if (customId === 'logs_filter') {
    const filterType = interaction.values[0];
    await adminLogs.showAdminLogs(interaction, 1, filterType);
    return;
  }
}

export default { handleSelectMenu };
