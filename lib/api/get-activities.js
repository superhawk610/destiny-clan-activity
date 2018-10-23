const api = require('.');
const progress = require('../progress');
const { get, set } = require('../cache');
const { D2_PRIVATE_ACCOUNT, D2_NO_ACTIVITIES } = require('../errors');

const getCached = get('activities');
const setCached = set('activities');

// returns array of Destiny.HistoricalStats.DestinyActivityHistoryResults
// for memberId/CharacterId between startDate and endDate
async function getActivities(memberId, characterId, startDate, endDate) {
  const allActivities = [];
  const fetchCount = 100;

  progress.addMember();

  let page = 0;
  let keepGoing = true;
  while (keepGoing) {
    // eslint-disable-next-line no-await-in-loop
    const json = await api.get(
      `https://www.bungie.net/Platform/Destiny2/4/Account/${memberId}/Character/${characterId}/Stats/Activities/?count=${fetchCount}&page=${page}&modes='5,7'`,
    );

    if (json.privateAccount) {
      keepGoing = false;
      const err = new Error(`Account access denied for memberId ${memberId}`);
      err.code = D2_PRIVATE_ACCOUNT;
      throw err;
    }

    const { activities } = json.Response;
    if (activities === undefined) {
      keepGoing = false;
      const err = new Error(`Activity list broke for member ${memberId}`);
      err.code = D2_NO_ACTIVITIES;
      throw err;
    }

    progress.addRequest(activities.length);

    for (let i = 0; i < activities.length; i++) {
      const activity = activities[i];
      const activityDate = new Date(activity.period);

      // break loop and end fetching if activity is before specified range
      // (all subsequent activities will be even earlier)
      if (activityDate < startDate) {
        keepGoing = false;
        break;
      }

      // skip activity if it occurred after the end of the specified range
      if (activityDate > endDate) continue;

      const activityId = activity.activityDetails.instanceId;
      const activityMode = activity.activityDetails.mode;

      let activityDetails;
      const cachedActivity = getCached(activityId);
      if (cachedActivity) {
        activityDetails = cachedActivity;
      } else {
        // eslint-disable-next-line no-await-in-loop
        const activityJson = await api.get(
          `https://www.bungie.net/Platform/Destiny2/Stats/PostGameCarnageReport/${activityId}/`,
        );

        const activityPlayers = activityJson.Response.entries.map(entry => ({
          membershipId: entry.player.destinyUserInfo.membershipId,
          displayName: entry.player.destinyUserInfo.displayName,
        }));
        activityDetails = { players: activityPlayers, mode: activityMode };
        setCached(activityId, activityDetails);
      }

      progress.completeRequest();

      if (activityDetails.players.length > 1) {
        allActivities.push(activityDetails);
      }
    }

    keepGoing = keepGoing && activities.length === fetchCount;
    page++;
  }

  progress.completeMember();

  return allActivities;
}

module.exports = getActivities;
