import imageManagement from '../commands/admin/imageManagement.js';
import database from '../database/database.js';

export async function handleSelectMenu(interaction) {
  const customId = interaction.customId;

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
