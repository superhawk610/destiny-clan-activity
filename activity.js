/* eslint-disable no-await-in-loop,no-param-reassign,no-restricted-syntax */
const fetchJson = require('node-fetch-json');
const promiseRetry = require('promise-retry');
const Bottleneck = require('bottleneck');
// const traveler = require('the-traveler');
// const manifest = require('the-traveler/build/Manifest');

// script globals
let limiter;
let fetchJsonWrapped;
let fetchHeaders;

// report options
let apiKey;
let groupId;
let name;
let slice;
let rate;
let startDate;
let endDate;

// report results
const activityScores = [];
const activityCache = new Map();
const clanMemberIds = [];

async function getActivityReport(options) {
  console.log('generating clan activity report - this will take awhile :)');
  console.time('activity report');

  ({ apiKey, groupId, name, slice, rate, startDate, endDate } = options);
  limiter = new Bottleneck({ minTime: rate, trackDoneStatus: true });
  fetchJsonWrapped = limiter.wrap(fetchJsonRetry);
  fetchHeaders = { 'X-API-Key': apiKey };

  let clanMembers = await getClanMembers();
  // generate an array of ids for faster lookup later
  clanMembers.forEach((member) => {
    clanMemberIds.push(member.id);
  });

  if (name) {
    const id = await getMembershipId(name);
    clanMembers = [];
    clanMembers.push({ name, membershipId: id });
  } else if (slice) {
    clanMembers = clanMembers.slice(0, slice);
  }

  const promises = clanMembers.map(getActivityScore);
  await Promise.all(promises);
  activityScores.sort((a, b) => b.totalClanGames - a.totalClanGames);

  console.log('report successfully generated');
  console.log(limiter.counts());
  console.timeEnd('activity report');

  return activityScores;
}

async function getActivityScore(member) {
  console.log(`calculating activity score for clan member ${member.name} for ${startDate} - ${endDate}`);

  const activityEntry = {
    activityScore: 0,
    totalClanGames: 0,
    clanMembers: new Set(),
    modes: new Map(),
  };

  try {
    const characters = await getCharacters(member.id);
    for (const characterId of characters) {
      // console.log(characterId);
      const activities = await getActivities(member.id, characterId, startDate, endDate);
      for (const activity of activities) {
        // console.log(activity.activityDetails.instanceId);
        if (activity === undefined) {
          console.log('wtf');
        }
        let clanGame = false;
        for (const player of activity.players) {
          const entryMemberId = player.membershipId;
          if (entryMemberId !== member.id && clanMemberIds.includes(entryMemberId)) {
            activityEntry.activityScore += 1;
            if (!clanGame) {
              activityEntry.totalClanGames += 1;
              clanGame = true;
            }
            activityEntry.clanMembers.add(player.displayName);
            if (activityEntry.modes.has(activity.mode)) {
              activityEntry.modes.set(activity.mode, activityEntry.modes.get(activity.mode) + 1);
            } else {
              activityEntry.modes.set(activity.mode, 1);
            }
          }
        }
      }
    }
  } catch (error) {
    console.log(error);
  }


  activityScores.push({
    name: member.name,
    totalClanGames: activityEntry.totalClanGames,
    gameModes: JSON.stringify([...activityEntry.modes]),
    clanMemberList: [...activityEntry.clanMembers],
  });
}

// returns array of Destiny.HistoricalStats.DestinyActivityHistoryResults
// for memberId/CharacterId between startDate and endDate
async function getActivities(memberId, characterId) {
  // console.log(memberId);
  const activities = [];
  let page = 0;
  const fetchCount = 100;

  let keepGoing = true;
  while (keepGoing) {
    // console.log(activityDate);
    // console.log(startDate);

    const activityJson = await fetchJsonWrapped(`https://www.bungie.net/Platform/Destiny2/4/Account/${memberId}/Character/${characterId}/Stats/Activities/?count=100&page=${page}&modes='5,7'`, { headers: fetchHeaders });
    const activityList = activityJson.Response.activities;
    if (activityList === undefined) {
      console.log(`activity list broke for member ${memberId}`);
    }

    for (const activity of activityList) {
      const activityDate = new Date(activity.period);
      if (activityDate >= startDate && activityDate <= endDate) {
        const activityId = activity.activityDetails.instanceId;
        const activityMode = activity.activityDetails.mode;
        let activityDetails;
        if (activityCache.has(activityId)) {
          activityDetails = activityCache.get(activityId);
        } else {
          const json = await fetchJsonWrapped(`https://www.bungie.net/Platform//Destiny2/Stats/PostGameCarnageReport/${activityId}/`, { headers: fetchHeaders });
          if (json.Response === undefined) {
            console.log('also wtf');
          }
          const activityPlayers = [];
          json.Response.entries.map(entry => activityPlayers.push({ membershipId: entry.player.destinyUserInfo.membershipId, displayName: entry.player.destinyUserInfo.displayName }));
          activityDetails = { players: activityPlayers, mode: activityMode };
          activityCache.set(activityId, activityDetails);
        }

        if (activityDetails.players.length > 1) { activities.push(activityDetails); }
      } else if (activityDate < startDate) {
        keepGoing = false;
      }
    }
    keepGoing = keepGoing && activityList.length === fetchCount;
    page += 1;
  }
  return activities;
}

async function getMembershipId(displayName) {
  if (!displayName.includes('#') && !displayName.includes('%23')) {
    throw new Error('getMembershipId: displayName must contain \'#\' or \'%23\' eg \'ferenz#11349\'');
  }
  displayName = displayName.replace('#', '%23');
  // console.log(displayName);
  const json = await fetch(`https://www.bungie.net/Platform/Destiny2/SearchDestinyPlayer/4/${displayName}/`, { headers: fetchHeaders });
  const id = json.Response[0].membershipId;
  return id;
}

async function getClanInfo() {
  const response = await fetch('https://www.bungie.net/Platform/GroupV2/Name/Charlie Company 337/1', { headers: fetchHeaders });
  const json = await response.json();
  return json.Response.detail;
}

// returns an array of { displayName, membershipId } for all clan members
async function getClanMembers() {
  const json = await fetchJsonWrapped(`https://www.bungie.net/Platform/GroupV2/${groupId}/Members/`, { headers: fetchHeaders });
  const list = json.Response.results;
  const members = [];
  list.forEach((member) => {
    members.push({
      name: member.destinyUserInfo.displayName,
      id: member.destinyUserInfo.membershipId,
    });
  });
  return members;
}

// returns array of characterId for account of memberId
async function getCharacters(memberId) {
  const json = await fetchJsonWrapped(`https://www.bungie.net/Platform/Destiny2/4/Profile/${memberId}/?components=100`, { headers: fetchHeaders });
  const list = json.Response.profile.data.characterIds;
  return list;
}

async function fetchJsonRetry(url, options) {
  return promiseRetry(async (retry, number) => {
    try {
      const json = await fetchJson.get(url, {}, options);
      return json;
    } catch (error) {
      console.log(`retry # ${number} - ${error}`);
      retry(error);
    }
  });
}

module.exports = {
  getActivityReport,
};
