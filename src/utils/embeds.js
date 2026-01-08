import { EmbedBuilder } from 'discord.js';
import eloService from '../services/elo.js';

const PINK_COLOR = 0xFF69B4;
const CYAN_COLOR = 0x00D4FF;
const BLURPLE_COLOR = 0x5865F2;

class EmbedUtils {
  /**
   * Create a base embed with pink color
   * @returns {EmbedBuilder}
   */
  createBaseEmbed() {
    return new EmbedBuilder()
      .setColor(PINK_COLOR)
      .setTimestamp();
  }

  /**
   * Create duel embeds - returns an array of 2 embeds (one per image)
   * @param {Object} duel - Duel data
   * @param {string} image1Url - Image 1 URL
   * @param {string} image2Url - Image 2 URL
   * @param {Date} endsAt - Duel end time
   * @param {Object} captions - Optional captions object {image1: [], image2: []}
   * @returns {EmbedBuilder[]} - Array of 2 embeds
   */
  createDuelEmbed(duel, image1Url, image2Url, endsAt, captions = { image1: [], image2: [] }) {
    const timestamp = Math.floor(endsAt.getTime() / 1000);
    
    // Wildcard text
    const wildcardText = duel.isWildcard 
      ? `\n🎲 **WILDCARD** ✧ *1.5x ELO stakes!*\n` 
      : '';

    // Format captions for Image A
    const captionsA = captions.image1.length > 0 
      ? captions.image1.slice(0, 3).map(c => `> *"${c}"*`).join('\n')
      : '> *No captions yet~ ♡*';

    // Format captions for Image B
    const captionsB = captions.image2.length > 0 
      ? captions.image2.slice(0, 3).map(c => `> *"${c}"*`).join('\n')
      : '> *No captions yet~ ♡*';

    // Image A embed - includes header info
    const imageAEmbed = new EmbedBuilder()
      .setColor(0x5865F2) // Discord Blurple
      .setAuthor({ name: '☆ IdolDuel — Vote Now! ☆' })
      .setTitle('📸 Image A')
      .setDescription(
        `⏰ Duel ends <t:${timestamp}:R> • 💬 Add captions below!${wildcardText}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${eloService.getRankEmoji(duel.image1.elo)} **ELO:** \`${duel.image1.elo}\` ┃ **Record:** ${duel.image1.wins}W - ${duel.image1.losses}L\n\n` +
        `💭 **Captions:**\n${captionsA}`
      )
      .setImage(image1Url);

    // Image B embed
    const imageBEmbed = new EmbedBuilder()
      .setColor(0xFF69B4) // Hot Pink
      .setTitle('📸 Image B')
      .setDescription(
        `${eloService.getRankEmoji(duel.image2.elo)} **ELO:** \`${duel.image2.elo}\` ┃ **Record:** ${duel.image2.wins}W - ${duel.image2.losses}L\n\n` +
        `💭 **Captions:**\n${captionsB}`
      )
      .setImage(image2Url)
      .setFooter({ text: '>^u^< Vote for your favorite! You can only vote once!' });

    return [imageAEmbed, imageBEmbed];
  }

  /**
   * Create duel results embed
   * @param {Object} results - Duel results
   * @param {string} winnerUrl - Winner image URL
   * @param {string} loserUrl - Loser image URL (optional)
   * @returns {EmbedBuilder}
   */
  createDuelResultsEmbed(results, winnerUrl, loserUrl = null) {
    const embed = this.createBaseEmbed();

    if (results.skipped) {
      embed.setTitle('`☆ Duel Skipped ☆`');
      embed.setColor(0x808080);
      embed.setDescription(
        `\`\`\`ansi\n\u001b[0;33m[ No votes were cast... (>﹏<) ]\u001b[0m\n\`\`\`\n` +
        `The duel ended with no winner!\n` +
        `Better luck next time! ♡`
      );
      embed.setFooter({ text: 'Next duel coming soon! >^u^<' });
      return embed;
    }

    const totalVotes = results.winnerVotes + results.loserVotes;
    const winnerPercent = Math.round((results.winnerVotes / totalVotes) * 100);
    const loserPercent = 100 - winnerPercent;

    const eloChange = results.eloChanges
      ? ` *(+${results.eloChanges.winnerEloChange})*`
      : '';

    const eloLoss = results.eloChanges
      ? ` *(${results.eloChanges.loserEloChange})*`
      : '';

    // Create a visual vote bar
    const barLength = 20;
    const winnerBars = Math.round((winnerPercent / 100) * barLength);
    const loserBars = barLength - winnerBars;
    const voteBar = `\`${'█'.repeat(winnerBars)}${'░'.repeat(loserBars)}\``;

    embed.setTitle('`✨ Duel Results! ✨`');
    embed.setColor(0x00FF88);
    embed.setDescription(
      `\`\`\`ansi\n\u001b[0;32m🎉 We have a winner! 🎉\u001b[0m\n\`\`\`\n` +
      `**🏆 Winner** — ${winnerPercent}% (${results.winnerVotes} votes)\n` +
      `${eloService.getRankEmoji(results.eloChanges?.winnerNewElo || results.winner.elo)} **New ELO:** \`${results.eloChanges?.winnerNewElo || results.winner.elo}\`${eloChange}\n\n` +
      `${voteBar}\n\n` +
      `**Runner-up** — ${loserPercent}% (${results.loserVotes} votes)\n` +
      `${eloService.getRankEmoji(results.eloChanges?.loserNewElo || results.loser.elo)} **New ELO:** \`${results.eloChanges?.loserNewElo || results.loser.elo}\`${eloLoss}\n\n` +
      `*Thanks for voting! ♡ >^u^<*`
    );

    if (winnerUrl) {
      embed.setImage(winnerUrl);
    }
    if (loserUrl) {
      embed.setThumbnail(loserUrl);
    }

    embed.setFooter({ text: 'Next duel coming soon! ☆' });

    return embed;
  }

  /**
   * Create user profile embed
   * @param {Object} user - User data
   * @param {Object} topImage - User's top image (optional)
   * @param {string} topImageUrl - Top image URL (optional)
   * @returns {EmbedBuilder}
   */
  createProfileEmbed(user, topImage = null, topImageUrl = null) {
    const embed = this.createBaseEmbed();
    
    const winRate = eloService.calculateWinRate(topImage?.wins || 0, topImage?.losses || 0);
    const rankName = eloService.getRankName(user.elo);

    embed.setTitle(`\`☆ ${rankName} Profile ☆\``);
    embed.setDescription(
      `\`\`\`ansi\n\u001b[0;36m[ User Stats ]\u001b[0m\n\`\`\`\n` +
      `${eloService.getRankEmoji(user.elo)} **ELO:** \`${user.elo}\`\n` +
      `🔥 **Current Streak:** ${user.current_streak}\n` +
      `⭐ **Best Streak:** ${user.best_streak}\n` +
      `🗳️ **Total Votes Cast:** ${user.total_votes_cast}\n`
    );

    if (topImage) {
      embed.addFields({
        name: '🏆 Top Image Stats',
        value:
          `**ELO:** \`${topImage.elo}\` ${eloService.getRankEmoji(topImage.elo)}\n` +
          `**Record:** ${topImage.wins}W - ${topImage.losses}L\n` +
          `**Win Rate:** ${winRate}%\n` +
          `**Streak:** ${topImage.current_streak} 🔥`,
        inline: false
      });

      if (topImageUrl) {
        embed.setThumbnail(topImageUrl);
      }
    }

    embed.setFooter({ text: 'Keep dueling to improve! >^u^<' });

    return embed;
  }

  /**
   * Create leaderboard embed
   * @param {Array} users - Array of user objects
   * @param {number} page - Current page
   * @returns {EmbedBuilder}
   */
  createLeaderboardEmbed(users, page = 1) {
    const embed = this.createBaseEmbed();

    embed.setTitle('`🏆 IdolDuel Leaderboard 🏆`');
    embed.setDescription(
      `\`\`\`ansi\n\u001b[0;36m+ Top ${users.length} Users by ELO\u001b[0m\n\`\`\`\n`
    );

    const medals = ['🥇', '🥈', '🥉'];
    
    users.forEach((user, index) => {
      const position = (page - 1) * 15 + index + 1;
      const medal = index < 3 ? medals[index] + ' ' : `\`${position}.\` `;
      const rankEmoji = eloService.getRankEmoji(user.elo);
      
      embed.addFields({
        name: `${medal}<@${user.user_id}>`,
        value: `${rankEmoji} ELO: \`${user.elo}\` ┃ Streak: ${user.current_streak} 🔥`,
        inline: false
      });
    });

    embed.setFooter({ text: 'View top images with the button below! ☆' });

    return embed;
  }

  /**
   * Create top images embed
   * @param {Array} images - Array of image objects
   * @param {string} imageUrl - Current image URL
   * @param {number} currentIndex - Current image index
   * @returns {EmbedBuilder}
   */
  createTopImagesEmbed(images, imageUrl, currentIndex) {
    const embed = this.createBaseEmbed();
    const image = images[currentIndex];
    const position = currentIndex + 1;
    const medals = ['🥇', '🥈', '🥉'];
    const medal = position <= 3 ? medals[position - 1] : `#${position}`;

    const winRate = eloService.calculateWinRate(image.wins, image.losses);

    embed.setTitle(`\`${medal} Top Image — Rank ${position}\``);
    embed.setDescription(
      `\`\`\`ansi\n\u001b[0;36m[ Image Stats ]\u001b[0m\n\`\`\`\n` +
      `${eloService.getRankEmoji(image.elo)} **ELO:** \`${image.elo}\`\n` +
      `**Record:** ${image.wins}W - ${image.losses}L\n` +
      `**Win Rate:** ${winRate}%\n` +
      `**Current Streak:** ${image.current_streak} 🔥\n` +
      `**Best Streak:** ${image.best_streak} ⭐\n` +
      `**Total Votes:** ${image.total_votes_received}\n\n` +
      `Uploaded by: <@${image.uploader_id}>`
    );

    embed.setImage(imageUrl);
    embed.setFooter({ text: `Image ${position} of ${images.length} | Use buttons to navigate ♡` });

    return embed;
  }

  /**
   * Create admin config embed
   * @param {Object} config - Guild configuration
   * @returns {EmbedBuilder}
   */
  createAdminConfigEmbed(config) {
    const embed = this.createBaseEmbed();

    embed.setTitle('`⚙️ Admin Configuration Panel ⚙️`');
    embed.setDescription(
      `\`\`\`ansi\n\u001b[0;36m[ Current Settings ]\u001b[0m\n\`\`\`\n` +
      `**Duel Channel:** ${config.duel_channel_id ? `<#${config.duel_channel_id}>` : 'Not set'}\n` +
      `**Duel Duration:** ${config.duel_duration / 60} minutes\n` +
      `**Duel Interval:** ${config.duel_interval / 60} minutes\n` +
      `**Starting ELO:** ${config.starting_elo}\n` +
      `**K-Factor:** ${config.k_factor}\n` +
      `**Min Votes:** ${config.min_votes}\n` +
      `**Losses Before Retirement:** ${config.losses_before_retirement}\n` +
      `**Max Active Images:** ${config.max_active_images}\n` +
      `**Wildcard Chance:** ${(config.wildcard_chance * 100).toFixed(0)}%\n` +
      `**Upset Bonus:** ${(config.upset_bonus * 100).toFixed(0)}%\n\n` +
      `**Duel Status:** ${config.duel_active ? '✅ Active' : '❌ Inactive'}\n` +
      `**Season:** ${config.season_number}`
    );

    embed.setFooter({ text: 'Use the dropdown below to navigate ♡' });

    return embed;
  }

  /**
   * Create error embed
   * @param {string} message - Error message
   * @returns {EmbedBuilder}
   */
  createErrorEmbed(message) {
    const embed = this.createBaseEmbed();
    embed.setColor(0xFF6B6B);
    
    embed.setTitle('`❌ Oops! Something went wrong`');
    embed.setDescription(
      `\`\`\`ansi\n\u001b[0;31m- ${message}\u001b[0m\n\`\`\`\n` +
      `Please try again or contact an admin if the issue persists. (>﹏<)`
    );

    return embed;
  }

  /**
   * Create success embed
   * @param {string} message - Success message
   * @returns {EmbedBuilder}
   */
  createSuccessEmbed(message) {
    const embed = this.createBaseEmbed();
    embed.setColor(0x00FF88);
    
    embed.setTitle('`✅ Success!`');
    embed.setDescription(
      `\`\`\`ansi\n\u001b[0;32m+ ${message}\u001b[0m\n\`\`\`\n` +
      `>^u^< ♡`
    );

    return embed;
  }
}

export default new EmbedUtils();
