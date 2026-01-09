/**
 * Embed Utilities - 2 EMBED VERSION (GUARANTEED TO WORK)
 * Returns proper EmbedBuilder objects
 */

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import calculator from '../services/elo/calculator.js';

class EmbedUtils {
  createBaseEmbed() {
    return new EmbedBuilder()
      .setColor('#FF69B4')
      .setTimestamp();
  }

  createErrorEmbed(message) {
    return new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('❌ Error')
      .setDescription(message)
      .setTimestamp();
  }

  createSuccessEmbed(message) {
    return new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Success')
      .setDescription(message)
      .setTimestamp();
  }

  /**
   * Create duel embeds - Returns array of 2 EmbedBuilder objects
   */
  createDuelEmbed(image1, image2, url1, url2, endsAt) {
    // Validate
    if (!image1 || !image2 || !url1 || !url2 || !endsAt) {
      throw new Error('Invalid duel embed parameters');
    }

    // Build embed 1
    const embed1 = new EmbedBuilder();
    embed1.setColor(0x4A90E2); // Blue
    embed1.setTitle('⚔️ Image Duel - Vote for Your Favorite!');
    embed1.setDescription(
      `**👈 Image 1**\n` +
      `ELO: ${image1.elo || 1000} ${calculator.getRankEmoji(image1.elo || 1000)}\n` +
      `Record: ${image1.wins || 0}W - ${image1.losses || 0}L\n\n` +
      `Duel ends <t:${Math.floor(endsAt.getTime() / 1000)}:R>`
    );
    embed1.setImage(url1);

    // Build embed 2
    const embed2 = new EmbedBuilder();
    embed2.setColor(0xE24A90); // Pink
    embed2.setDescription(
      `**👉 Image 2**\n` +
      `ELO: ${image2.elo || 1000} ${calculator.getRankEmoji(image2.elo || 1000)}\n` +
      `Record: ${image2.wins || 0}W - ${image2.losses || 0}L`
    );
    embed2.setImage(url2);

    // Return array of EmbedBuilder objects
    return [embed1, embed2];
  }

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

  createDuelResultEmbed(winner, loser, winnerUrl, loserUrl, votes) {
    const totalVotes = votes.winner + votes.loser;
    const winPercentage = totalVotes > 0 ? Math.round((votes.winner / totalVotes) * 100) : 0;

    const embed = new EmbedBuilder();
    embed.setColor(0xFFD700); // Gold
    embed.setTitle('🏆 Duel Complete!');
    embed.setDescription(
      `**Winner** 🏆\n` +
      `ELO: ${winner.elo} ${calculator.getRankEmoji(winner.elo)} (${winner.eloChange > 0 ? '+' : ''}${winner.eloChange})\n` +
      `Record: ${winner.wins}W - ${winner.losses}L\n` +
      `Votes: ${votes.winner} (${winPercentage}%)\n\n` +
      `**Loser** 💀\n` +
      `ELO: ${loser.elo} ${calculator.getRankEmoji(loser.elo)} (${loser.eloChange > 0 ? '+' : ''}${loser.eloChange})\n` +
      `Record: ${loser.wins}W - ${loser.losses}L\n` +
      `Votes: ${votes.loser} (${100 - winPercentage}%)`
    );
    embed.setImage(winnerUrl);
    embed.setThumbnail(loserUrl);
    embed.setTimestamp();

    return embed;
  }

  createLeaderboardEmbed(images, page = 1) {
    const embed = new EmbedBuilder();
    embed.setColor(0xFFD700);
    embed.setTitle('🏆 Leaderboard - Top Images');
    embed.setTimestamp();

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

  createProfileEmbed(user, topImage, topImageUrl) {
    const embed = new EmbedBuilder();
    embed.setColor(0xFF69B4);
    embed.setTitle(`📊 Profile`);
    embed.setTimestamp();

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

  createTopImagesEmbed(images, imageUrl, currentIndex) {
    if (!images || images.length === 0) {
      return this.createErrorEmbed('No images found!');
    }

    const image = images[currentIndex];
    const winRate = image.wins + image.losses > 0 
      ? Math.round((image.wins / (image.wins + image.losses)) * 100) 
      : 0;

    const embed = new EmbedBuilder();
    embed.setColor(0xFFD700);
    embed.setTitle(`🏆 Top Image #${currentIndex + 1}`);
    embed.setDescription(
      `**Rank:** ${currentIndex + 1} of ${images.length}\n` +
      `**ELO:** ${image.elo} ${calculator.getRankEmoji(image.elo)}\n` +
      `**Record:** ${image.wins}W - ${image.losses}L\n` +
      `**Win Rate:** ${winRate}%\n` +
      `**Status:** ${image.retired ? '🔴 Retired' : '🟢 Active'}`
    );
    embed.setImage(imageUrl);
    embed.setTimestamp();

    return embed;
  }
}

export default new EmbedUtils();
