/* eslint-disable no-await-in-loop,no-param-reassign,no-restricted-syntax */
const fetchJson = require('node-fetch-json');
const promiseRetry = require('promise-retry');
const Bottleneck = require('bottleneck');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const program = require('commander');

program
  .option('-k, --api-key [apiKey]', 'X-API-Key')
  .option('-g, --group-id [groupId]', 'Group ID')
  .option('-o, --output [output]', 'Output CSV path', './activity-scores.csv')
  .option('-m, --month [month]', 'Activity month (0-11)', new Date().getMonth())
  .option('-s, --slice [slice]', 'Members slice (testing)')
  .option('-r, --rate [rate]', 'Request rate limit(ms)', 40)
  .parse(process.argv);

const { apiKey, groupId, output } = program;
const month = Number(program.month);
const slice = Number(program.slice);
const rate = Number(program.rate);
const limiter = new Bottleneck({ minTime: rate, trackDoneStatus: true });
const fetchJsonWrapped = limiter.wrap(fetchJsonRetry);
const fetchHeaders = { 'X-API-Key': apiKey };
const activityScores = [];
const activityCache = new Map();
const clanMemberIds = [];

(async () => {
  console.log('generating clan activity report - this will take awhile :)');
  console.time('activity report');
  let clanMembers = await getClanMembers();

  // generate an array of ids for faster lookup later

  clanMembers.forEach((member) => {
    clanMemberIds.push(member.id);
  });

  if (slice) {
    clanMembers = clanMembers.slice(0, slice);
  }

  const promises = clanMembers.map(calculateActivityScore);
  await Promise.all(promises);

  console.log(`report generation complete - writing csv to ${output}`);
  activityScores.sort((a, b) => b.totalClanGames - a.totalClanGames);

  const csvWriter = createCsvWriter({
    path: output,
    header: [
      { id: 'name', title: 'NAME' },
      { id: 'totalClanGames', title: 'CLAN_GAMES' },
      { id: 'gameModes', title: 'GAME_MODES' },
      { id: 'clanMemberList', title: 'CLAN_MEMBERS' },
    ],
  });
  await csvWriter.writeRecords(activityScores);

  console.log('report successfully written to file');
  console.log(limiter.counts());
  console.timeEnd('activity report');
})();

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

// returns array of Destiny.HistoricalStats.DestinyActivityHistoryResults
// for memberId/CharacterId between startDate and endDate
async function getActivities(memberId, characterId, startDate, endDate) {
  // console.log(memberId);
  if (!startDate || !endDate) {
    // if no start or end date is provided then use current month to date
    endDate = new Date();
    startDate = new Date();
    startDate.setDate(1);
  }

  const activities = [];
  let page = 0;
  const fetchCount = 100;

  let keepGoing = true;
  while (keepGoing) {
    // console.log(activityDate);
    // console.log(startDate);

    const activityJson = await fetchJsonWrapped(`https://www.bungie.net/Platform/Destiny2/4/Account/${memberId}/Character/${characterId}/Stats/Activities/?count=100&page=${page}&modes='5,7'`, { headers: fetchHeaders });
    const activityList = activityJson.Response.activities;

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

async function calculateActivityScore(member) {
  const startDate = new Date(2018, month, 1);
  const endDate = new Date(2018, month + 1, 0);
  console.log(`calculating activity score for clan member ${member.name} for ${startDate} - ${endDate}`);

  const activityScore = {
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
        for (const player of activity.players) {
          const entryMemberId = player.membershipId;
          if (entryMemberId !== member.id && clanMemberIds.includes(entryMemberId)) {
            activityScore.totalClanGames += 1;
            activityScore.clanMembers.add(player.displayName);
            if (activityScore.modes.has(activity.mode)) {
              activityScore.modes.set(activity.mode, activityScore.modes.get(activity.mode) + 1);
            } else {
              activityScore.modes.set(activity.mode, 1);
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
    totalClanGames: activityScore.totalClanGames,
    gameModes: JSON.stringify([...activityScore.modes]),
    clanMemberList: [...activityScore.clanMembers],
  });
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
