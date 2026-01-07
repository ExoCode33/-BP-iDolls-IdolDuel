import adminConfig from '../commands/admin/config.js';

export async function handleSelectMenu(interaction) {
  const customId = interaction.customId;

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
        await adminConfig.handleImageManagement(interaction, config);
        break;
      case 'season_management':
        await adminConfig.handleSeasonManagement(interaction, config);
        break;
      default:
        await interaction.reply({ content: 'Unknown option', ephemeral: true });
    }
  }
}

export default { handleSelectMenu };
