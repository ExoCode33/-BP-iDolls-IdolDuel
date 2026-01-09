/**
 * Embed Utilities - 2 EMBED VERSION
 * Embed 1: Title + Image 1
 * Embed 2: Image 2 (buttons below)
 */

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import calculator from '../services/elo/calculator.js';

class EmbedUtils {
  /**
   * Create base embed with default styling
   */
  createBaseEmbed() {
    return new EmbedBuilder()
      .setColor('#FF69B4')
      .setTimestamp();
  }

  /**
   * Create error embed
   */
  createErrorEmbed(message) {
    return new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('❌ Error')
      .setDescription(message)
      .setTimestamp();
  }

  /**
   * Create success embed
   */
  createSuccessEmbed(message) {
    return new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Success')
      .setDescription(message)
      .setTimestamp();
  }

  /**
   * Create duel embeds - Returns array of 2 embeds
   * Embed 1: Title + Image 1
   * Embed 2: Image 2
   */
  createDuelEmbed(image1, image2, url1, url2, endsAt) {
    // Validate inputs
    if (!image1 || !image2) {
      throw new Error('Invalid image data: image1 or image2 is undefined');
    }

    if (!url1 || !url2) {
      throw new Error('Invalid image URLs: url1 or url2 is undefined');
    }

    if (!endsAt) {
      throw new Error('Invalid endsAt: endsAt is undefined');
    }

    // Embed 1: Title + Image 1
    const embed1 = new EmbedBuilder()
      .setColor('#4A90E2')
      .setTitle('⚔️ Image Duel - Vote for Your Favorite!')
      .setDescription(
        `**👈 Image 1**\n` +
        `ELO: ${image1.elo || 1000} ${calculator.getRankEmoji(image1.elo || 1000)}\n` +
        `Record: ${image1.wins || 0}W - ${image1.losses || 0}L\n\n` +
        `Duel ends <t:${Math.floor(endsAt.getTime() / 1000)}:R>`
      )
      .setImage(url1);

    // Embed 2: Image 2 (buttons will be below this)
    const embed2 = new EmbedBuilder()
      .setColor('#E24A90')
      .setDescription(
        `**👉 Image 2**\n` +
        `ELO: ${image2.elo || 1000} ${calculator.getRankEmoji(image2.elo || 1000)}\n` +
        `Record: ${image2.wins || 0}W - ${image2.losses || 0}L`
      )
      .setImage(url2);

    return [embed1, embed2];
  }

  /**
   * Create vote buttons
   */
  createVoteButtons(image1Id, image2Id) {
    return new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`vote_${image1Id}`)
          .setLabel('Vote Image 1')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('👈'),
        new ButtonBuilder()
          .setCustomId(`vote_${image2Id}`)
          .setLabel('Vote Image 2')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('👉')
      );
  }

  /**
   * Create duel result embed
   */
  createDuelResultEmbed(winner, loser, winnerUrl, loserUrl, votes) {
    const totalVotes = votes.winner + votes.loser;
    const winPercentage = totalVotes > 0 ? Math.round((votes.winner / totalVotes) * 100) : 0;

    // Single result embed
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🏆 Duel Complete!')
      .setDescription(
        `**Winner** 🏆\n` +
        `ELO: ${winner.elo} ${calculator.getRankEmoji(winner.elo)} (${winner.eloChange > 0 ? '+' : ''}${winner.eloChange})\n` +
        `Record: ${winner.wins}W - ${winner.losses}L\n` +
        `Votes: ${votes.winner} (${winPercentage}%)\n\n` +
        `**Loser** 💀\n` +
        `ELO: ${loser.elo} ${calculator.getRankEmoji(loser.elo)} (${loser.eloChange > 0 ? '+' : ''}${loser.eloChange})\n` +
        `Record: ${loser.wins}W - ${loser.losses}L\n` +
        `Votes: ${votes.loser} (${100 - winPercentage}%)`
      )
      .setImage(winnerUrl)
      .setThumbnail(loserUrl)
      .setTimestamp();

    return embed;
  }

  /**
   * Create leaderboard embed
   */
  createLeaderboardEmbed(images, page = 1) {
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🏆 Leaderboard - Top Images')
      .setTimestamp();

    if (!images || images.length === 0) {
      embed.setDescription('No images found!');
      return embed;
    }

    let description = '';
    images.forEach((image, index) => {
      const rank = (page - 1) * 15 + index + 1;
      const emoji = calculator.getRankEmoji(image.elo);
      const winRate = image.wins + image.losses > 0 
        ? Math.round((image.wins / (image.wins + image.losses)) * 100) 
        : 0;

      description += `**${rank}.** ${emoji} **${image.elo}** ELO - ${image.wins}W/${image.losses}L (${winRate}%)\n`;
    });

    embed.setDescription(description);
    return embed;
  }

  /**
   * Create profile embed
   */
  createProfileEmbed(user, topImage, topImageUrl) {
    const embed = new EmbedBuilder()
      .setColor('#FF69B4')
      .setTitle(`📊 Profile`)
      .setTimestamp();

    if (!topImage) {
      embed.setDescription('You have no images in the system yet!');
      return embed;
    }

    const winRate = topImage.wins + topImage.losses > 0 
      ? Math.round((topImage.wins / (topImage.wins + topImage.losses)) * 100) 
      : 0;

    embed.setDescription(
      `**Your Best Image**\n` +
      `ELO: ${topImage.elo} ${calculator.getRankEmoji(topImage.elo)}\n` +
      `Record: ${topImage.wins}W - ${topImage.losses}L\n` +
      `Win Rate: ${winRate}%\n` +
      `Status: ${topImage.retired ? '🔴 Retired' : '🟢 Active'}`
    );

    if (topImageUrl) {
      embed.setImage(topImageUrl);
    }

    return embed;
  }

  /**
   * Create top images embed (for leaderboard browsing)
   */
  createTopImagesEmbed(images, imageUrl, currentIndex) {
    if (!images || images.length === 0) {
      return this.createErrorEmbed('No images found!');
    }

    const image = images[currentIndex];
    const winRate = image.wins + image.losses > 0 
      ? Math.round((image.wins / (image.wins + image.losses)) * 100) 
      : 0;

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle(`🏆 Top Image #${currentIndex + 1}`)
      .setDescription(
        `**Rank:** ${currentIndex + 1} of ${images.length}\n` +
        `**ELO:** ${image.elo} ${calculator.getRankEmoji(image.elo)}\n` +
        `**Record:** ${image.wins}W - ${image.losses}L\n` +
        `**Win Rate:** ${winRate}%\n` +
        `**Status:** ${image.retired ? '🔴 Retired' : '🟢 Active'}`
      )
      .setImage(imageUrl)
      .setTimestamp();

    return embed;
  }
}

export default new EmbedUtils();
