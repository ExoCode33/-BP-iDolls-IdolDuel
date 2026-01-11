/**
 * Duel Resolver
 * FIXED: Shows results properly, counts votes correctly
 */

import database from '../../database/database.js';
import calculator from '../elo/calculator.js';
import embedUtils from '../../utils/embeds.js';
import storage from '../image/storage.js';

class DuelResolver {
  async resolveDuel(guildId, duelId, client) {
    try {
      console.log(`🏁 Resolving duel ${duelId}...`);

      // Get duel data
      const duelResult = await database.query(
        `SELECT d.*, 
          i1.s3_key as image1_s3_key, i1.elo as image1_elo, i1.wins as image1_wins, i1.losses as image1_losses,
          i2.s3_key as image2_s3_key, i2.elo as image2_elo, i2.wins as image2_wins, i2.losses as image2_losses
         FROM duels d
         JOIN images i1 ON d.image1_id = i1.id
         JOIN images i2 ON d.image2_id = i2.id
         WHERE d.id = $1`,
        [duelId]
      );

      if (duelResult.rows.length === 0) {
        console.log('Duel not found');
        return;
      }

      const duel = duelResult.rows[0];

      // Count votes
      const votesResult = await database.query(
        `SELECT image_id, COUNT(*) as votes
         FROM votes
         WHERE duel_id = $1
         GROUP BY image_id`,
        [duelId]
      );

      let image1Votes = 0;
      let image2Votes = 0;

      for (const row of votesResult.rows) {
        if (row.image_id === duel.image1_id) {
          image1Votes = parseInt(row.votes);
        } else if (row.image_id === duel.image2_id) {
          image2Votes = parseInt(row.votes);
        }
      }

      console.log(`📊 Votes: Image1=${image1Votes}, Image2=${image2Votes}`);

      // Determine winner
      let winnerId, loserId, winnerVotes, loserVotes;
      
      if (image1Votes > image2Votes) {
        winnerId = duel.image1_id;
        loserId = duel.image2_id;
        winnerVotes = image1Votes;
        loserVotes = image2Votes;
      } else if (image2Votes > image1Votes) {
        winnerId = duel.image2_id;
        loserId = duel.image1_id;
        winnerVotes = image2Votes;
        loserVotes = image1Votes;
      } else {
        // Tie - pick random winner
        const random = Math.random() < 0.5;
        winnerId = random ? duel.image1_id : duel.image2_id;
        loserId = random ? duel.image2_id : duel.image1_id;
        winnerVotes = image1Votes;
        loserVotes = image2Votes;
        console.log(`🎲 Tie! Random winner: Image ${winnerId}`);
      }

      // Calculate ELO changes
      const winnerElo = winnerId === duel.image1_id ? duel.image1_elo : duel.image2_elo;
      const loserElo = loserId === duel.image1_id ? duel.image1_elo : duel.image2_elo;

      const configResult = await database.query(
        'SELECT k_factor FROM guild_config WHERE guild_id = $1',
        [guildId]
      );
      const kFactor = configResult.rows[0].k_factor;

      const { winnerNewElo, loserNewElo } = calculator.calculateEloChange(
        winnerElo,
        loserElo,
        kFactor
      );

      const winnerEloChange = winnerNewElo - winnerElo;
      const loserEloChange = loserNewElo - loserElo;

      // Update winner
      await database.query(
        'UPDATE images SET elo = $1, wins = wins + 1 WHERE id = $2',
        [winnerNewElo, winnerId]
      );

      // Update loser
      await database.query(
        'UPDATE images SET elo = $1, losses = losses + 1 WHERE id = $2',
        [loserNewElo, loserId]
      );

      // Update duel record
      await database.query(
        'UPDATE duels SET winner_id = $1, image1_votes = $2, image2_votes = $3, ended_at = NOW() WHERE id = $4',
        [winnerId, image1Votes, image2Votes, duelId]
      );

      // Check auto-retirement
      await this.checkAutoRetirement(guildId, loserId);

      // Post results
      await this.postResults(guildId, duel, winnerId, loserId, winnerEloChange, loserEloChange, winnerVotes, loserVotes, client);

      if (image1Votes === 0 && image2Votes === 0) {
        console.log(`⏭️ Duel ${duelId} skipped (no votes)`);
      } else {
        console.log(`✅ Duel ${duelId} resolved: Winner=${winnerId}, Votes=${winnerVotes}-${loserVotes}`);
      }

    } catch (error) {
      console.error('Error resolving duel:', error);
      throw error;
    }
  }

  async postResults(guildId, duel, winnerId, loserId, winnerEloChange, loserEloChange, winnerVotes, loserVotes, client) {
    try {
      const configResult = await database.query(
        'SELECT duel_channel_id FROM guild_config WHERE guild_id = $1',
        [guildId]
      );

      const channelId = configResult.rows[0].duel_channel_id;
      const channel = await client.channels.fetch(channelId);

      if (!channel) return;

      // Get updated image data
      const winnerResult = await database.query(
        'SELECT * FROM images WHERE id = $1',
        [winnerId]
      );
      const loserResult = await database.query(
        'SELECT * FROM images WHERE id = $1',
        [loserId]
      );

      const winner = winnerResult.rows[0];
      const loser = loserResult.rows[0];

      const winnerUrl = await storage.getImageUrl(winner.s3_key);
      const loserUrl = await storage.getImageUrl(loser.s3_key);

      const embed = embedUtils.createDuelResultEmbed(
        {
          ...winner,
          eloChange: winnerEloChange
        },
        {
          ...loser,
          eloChange: loserEloChange
        },
        winnerUrl,
        loserUrl,
        {
          winner: winnerVotes,
          loser: loserVotes
        }
      );

      await channel.send({ embeds: [embed] });

    } catch (error) {
      console.error('Error posting results:', error);
    }
  }

  async checkAutoRetirement(guildId, imageId) {
    try {
      const configResult = await database.query(
        'SELECT retire_after_losses, retire_below_elo FROM guild_config WHERE guild_id = $1',
        [guildId]
      );

      const config = configResult.rows[0];
      const retireAfterLosses = config.retire_after_losses || 0;
      const retireBelowElo = config.retire_below_elo || 0;

      if (retireAfterLosses === 0 && retireBelowElo === 0) return;

      const imageResult = await database.query(
        'SELECT * FROM images WHERE id = $1',
        [imageId]
      );

      const image = imageResult.rows[0];

      let shouldRetire = false;

      if (retireAfterLosses > 0 && image.losses >= retireAfterLosses) {
        shouldRetire = true;
        console.log(`🗑️ Auto-retiring image ${imageId} (${image.losses} losses)`);
      }

      if (retireBelowElo > 0 && image.elo <= retireBelowElo) {
        shouldRetire = true;
        console.log(`🗑️ Auto-retiring image ${imageId} (ELO ${image.elo})`);
      }

      if (shouldRetire) {
        await database.query(
          'UPDATE images SET retired = true, retired_at = NOW() WHERE id = $1',
          [imageId]
        );
      }

    } catch (error) {
      console.error('Error checking auto-retirement:', error);
    }
  }
}

export default new DuelResolver();
