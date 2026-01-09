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
   * Get animated voting indicator based on time
   * @returns {string}
   */
  getVotingAnimation() {
    const animations = [
      '⚡ Voting in Progress',
      '💫 Voting in Progress',
      '✨ Voting in Progress',
      '⭐ Voting in Progress',
      '🌟 Voting in Progress',
      '💖 Voting in Progress'
    ];
    
    // Cycle through animations based on current second
    const index = Math.floor(Date.now() / 1000) % animations.length;
    return animations[index];
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
    const votingIndicator = this.getVotingAnimation();
    
    // Wildcard indicator
    const wildcardText = duel.isWildcard ? '  ⚡ **WILDCARD**' : '';

    // Format captions for Image A (max 3)
    const captionsA = captions.image1.length > 0 
      ? '\n\n**💬 Captions:**\n' + captions.image1.slice(0, 3).map(c => `*"${c}"*`).join('\n')
      : '';

    // Format captions for Image B (max 3)
    const captionsB = captions.image2.length > 0 
      ? '\n\n**💬 Captions:**\n' + captions.image2.slice(0, 3).map(c => `*"${c}"*`).join('\n')
      : '';

    // Image A embed - includes header
    const imageAEmbed = new EmbedBuilder()
      .setColor(PINK_COLOR)
      .setTitle(`${votingIndicator}`)
      .setDescription(
        `**━━━━━━━ Image A ━━━━━━━**${wildcardText}\n\n` +
        `${eloService.getRankEmoji(duel.image1.elo)}  **ELO:** \`${duel.image1.elo}\`` +
        captionsA
      )
      .setImage(image1Url)
      .setFooter({ text: `Vote using buttons below! ♡` });

    // Image B embed
    const imageBEmbed = new EmbedBuilder()
      .setColor(PINK_COLOR)
      .setDescription(
        `**━━━━━━━ Image B ━━━━━━━**\n\n` +
        `${eloService.getRankEmoji(duel.image2.elo)}  **ELO:** \`${duel.image2.elo}\`` +
        captionsB
      )
      .setImage(image2Url)
      .setFooter({ text: `⏱ Duel ends` })
      .setTimestamp(endsAt);

    return [imageAEmbed, imageBEmbed];
  }

  /**
   * Create duel results embed (shows percentages only, not vote counts)
   * @param {Object} results - Duel results
   * @param {string} winnerUrl - Winner image URL
   * @param {string} loserUrl - Loser image URL (optional)
   * @returns {EmbedBuilder}
   */
  createDuelResultsEmbed(results, winnerUrl, loserUrl = null) {
    const embed = this.createBaseEmbed();

    if (results.skipped) {
      embed.setTitle('━━━━━━ ☆ Duel Skipped ☆ ━━━━━━');
      embed.setColor(0x808080);
      embed.setDescription(
        `\`\`\`\n` +
        `  No votes were cast...\n` +
        `\`\`\`\n` +
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
      ? ` *+${results.eloChanges.winnerEloChange}*`
      : '';

    const eloLoss = results.eloChanges
      ? ` *${results.eloChanges.loserEloChange}*`
      : '';

    // Create visual percentage bars (20 chars wide)
    const barLength = 20;
    const winnerBars = Math.round((winnerPercent / 100) * barLength);
    const loserBars = barLength - winnerBars;
    
    // Use different characters for visual appeal
    const winnerBar = `\`${'█'.repeat(winnerBars)}${'░'.repeat(loserBars)}\``;
    const loserBar = `\`${'░'.repeat(winnerBars)}${'█'.repeat(loserBars)}\``;

    embed.setTitle('━━━━━ ✨ Duel Results! ✨ ━━━━━');
    embed.setColor(0x00FF88);
    embed.setDescription(
      `\`\`\`\n` +
      `     🎉 We have a winner! 🎉\n` +
      `\`\`\`\n\n` +
      `**🏆 Winner — ${winnerPercent}%**\n` +
      `${winnerBar}\n` +
      `${eloService.getRankEmoji(results.eloChanges?.winnerNewElo || results.winner.elo)} **ELO:** \`${results.eloChanges?.winnerNewElo || results.winner.elo}\`${eloChange}\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `**Runner-up — ${loserPercent}%**\n` +
      `${loserBar}\n` +
      `${eloService.getRankEmoji(results.eloChanges?.loserNewElo || results.loser.elo)} **ELO:** \`${results.eloChanges?.loserNewElo || results.loser.elo}\`${eloLoss}\n\n` +
      `*Thanks for voting! ♡*`
    );

    if (winnerUrl) {
      embed.setThumbnail(winnerUrl);
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

    embed.setTitle(`━━━━━ ${rankName} Profile ━━━━━`);
    embed.setDescription(
      `**User Stats**\n` +
      `${eloService.getRankEmoji(user.elo)} **ELO:** \`${user.elo}\`\n` +
      `🔥 **Current Streak:** ${user.current_streak}\n` +
      `⭐ **Best Streak:** ${user.best_streak}\n` +
      `🗳️ **Total Votes Cast:** ${user.total_votes_cast}\n`
    );

    if (topImage) {
      embed.addFields({
        name: '━━━━━━━━━━━━━━━━━━',
        value: '** **',
        inline: false
      });
      
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

    embed.setTitle('━━━━━ 🏆 Leaderboard 🏆 ━━━━━');
    embed.setDescription(
      `**Top ${users.length} Users by ELO**\n` +
      `━━━━━━━━━━━━━━━━━━━\n`
    );

    const medals = ['🥇', '🥈', '🥉'];
    
    users.forEach((user, index) => {
      const position = (page - 1) * 15 + index + 1;
      const medal = index < 3 ? medals[index] + ' ' : `\`${position}.\` `;
      const rankEmoji = eloService.getRankEmoji(user.elo);
      
      embed.addFields({
        name: `${medal}<@${user.user_id}>`,
        value: `${rankEmoji} \`${user.elo}\` ELO  •  ${user.current_streak} 🔥 streak`,
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

    embed.setTitle(`${medal} Top Image — Rank ${position}`);
    embed.setDescription(
      `**Image Statistics**\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `${eloService.getRankEmoji(image.elo)} **ELO:** \`${image.elo}\`\n` +
      `**Record:** ${image.wins}W - ${image.losses}L\n` +
      `**Win Rate:** ${winRate}%\n` +
      `**Current Streak:** ${image.current_streak} 🔥\n` +
      `**Best Streak:** ${image.best_streak} ⭐\n` +
      `**Total Votes:** ${image.total_votes_received}\n\n` +
      `**Uploader:** <@${image.uploader_id}>`
    );

    embed.setImage(imageUrl);
    embed.setFooter({ text: `Image ${position} of ${images.length} | Navigate with buttons ♡` });

    return embed;
  }

  /**
   * Create admin config embed (more concise)
   * @param {Object} config - Guild configuration
   * @returns {EmbedBuilder}
   */
  createAdminConfigEmbed(config) {
    const embed = this.createBaseEmbed();

    embed.setTitle('━━━━━ ⚙️ Admin Panel ⚙️ ━━━━━');
    embed.setDescription(
      `**Quick Settings Overview**\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `**Channel:** ${config.duel_channel_id ? `<#${config.duel_channel_id}>` : '❌ Not set'}\n` +
      `**Duration:** ${config.duel_duration / 60}min  •  **Interval:** ${config.duel_interval / 60}min\n` +
      `**Starting ELO:** ${config.starting_elo}  •  **K-Factor:** ${config.k_factor}\n` +
      `**Min Votes:** ${config.min_votes}  •  **Retirement:** ${config.losses_before_retirement} losses\n` +
      `**Status:** ${config.duel_active ? '✅ Active' : '❌ Inactive'}  •  **Season:** ${config.season_number}\n\n` +
      `*Use dropdown below to configure*`
    );

    embed.setFooter({ text: 'Select a section to manage ♡' });

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
    
    embed.setTitle('━━━━━ ❌ Error ━━━━━');
    embed.setDescription(
      `${message}\n\n` +
      `*Please try again or contact an admin if the issue persists.*`
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
    
    embed.setTitle('━━━━━ ✅ Success ━━━━━');
    embed.setDescription(`${message}\n\n*>^u^< ♡*`);

    return embed;
  }

  /**
   * Create admin log embed for system events
   * @param {Object} logEntry - Log entry data
   * @returns {EmbedBuilder}
   */
  createAdminLogEmbed(logEntry) {
    const embed = this.createBaseEmbed();
    
    const typeColors = {
      'duel_started': 0x00FF88,
      'duel_ended': 0x5865F2,
      'duel_skipped': 0xFFAA00,
      'duel_error': 0xFF6B6B,
      'image_retired': 0xFF69B4,
      'season_reset': 0xFF00FF,
      'system_reset': 0xFF0000
    };
    
    embed.setColor(typeColors[logEntry.action_type] || PINK_COLOR);
    embed.setTitle(`📋 ${logEntry.action_type.replace(/_/g, ' ').toUpperCase()}`);
    
    const details = typeof logEntry.details === 'string' 
      ? JSON.parse(logEntry.details) 
      : logEntry.details;
    
    embed.setDescription(
      `**Timestamp:** <t:${Math.floor(new Date(logEntry.created_at).getTime() / 1000)}:F>\n` +
      `**Details:**\n\`\`\`json\n${JSON.stringify(details, null, 2)}\`\`\``
    );
    
    return embed;
  }
}

export default new EmbedUtils();
