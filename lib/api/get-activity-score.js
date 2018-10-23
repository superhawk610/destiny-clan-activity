const _ = require('lodash');

const config = require('../config');
const { formatDate } = require('../format');
const { logInfo, logErrorAndQuit, appendToFooter } = require('../log');
const { D2_PRIVATE_ACCOUNT, D2_NO_ACTIVITIES } = require('../errors');

const getCharacters = require('./get-characters');
const getActivities = require('./get-activities');
const { getClanMembers } = require('./get-clan-members');
const getNameForMode = require('./get-name-for-mode');

const logPrivate = appendToFooter('private-accounts');
const logNoActivities = appendToFooter('no-activities');

async function getActivityScore(member) {
  const startDate = config.get('startDate');
  const endDate = config.get('endDate');
  const clanMembers = await getClanMembers();

  logInfo(
    `calculating activity score for clan member ${member.name} for ${formatDate(
      startDate,
    )} - ${formatDate(endDate)}`,
  );

  const activityEntry = {
    activityScore: 0,
    totalClanGames: 0,
    clanMembers: [],
    modes: {},
  };

  const characters = await getCharacters(member.id);
  for (let i = 0; i < characters.length; i++) {
    const characterId = characters[i];

    let activities;
    try {
      // eslint-disable-next-line no-await-in-loop
      activities = await getActivities(
        member.id,
        characterId,
        startDate,
        endDate,
      );
    } catch (e) {
      let encounteredError;
      switch (e.code) {
        case D2_PRIVATE_ACCOUNT:
          logPrivate(
            `${member.name} (memberId: ${member.id}) has a private account.`,
          );
          encounteredError = true;
          break;
        case D2_NO_ACTIVITIES:
          logNoActivities(
            `${member.name} (memberId: ${
              member.id
            }) has no recorded activities for character ${characterId}.`,
          );
          encounteredError = true;
          break;
        default:
          logErrorAndQuit(e);
      }

      if (encounteredError) break;
    }

    // eslint-disable-next-line no-loop-func
    activities.forEach(activity => {
      let isClanGame = false;

      activity.players.forEach(player => {
        const id = player.membershipId;

        if (id !== member.id && clanMembers[id]) {
          activityEntry.activityScore += 1;

          if (!isClanGame) {
            activityEntry.totalClanGames += 1;
            isClanGame = true;
          }

          activityEntry.clanMembers.push(player.displayName);

          const mode = getNameForMode(activity.mode);
          if (activityEntry.modes[mode]) {
            activityEntry.modes[mode]++;
          } else {
            activityEntry.modes[mode] = 1;
          }
        }
      });
    });
  }

  return {
    name: member.name,
    activityScore: activityEntry.activityScore,
    totalClanGames: activityEntry.totalClanGames,
    gameModes: activityEntry.modes,
    clanMemberList: _.uniq(activityEntry.clanMembers).sort(),
  };
}

module.exports = getActivityScore;
