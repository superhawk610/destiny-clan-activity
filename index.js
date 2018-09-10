/* eslint-disable no-await-in-loop,no-param-reassign,no-restricted-syntax */
const fetchJson = require('node-fetch-json');
const promiseRetry = require('promise-retry');
const Bottleneck = require('bottleneck');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const program = require('commander');
const traveler = require('the-traveler');
const manifest = require('the-traveler/build/Manifest'); 


program
  .option('-k, --api-key [apiKey]', 'X-API-Key')
  .option('-g, --group-id [groupId]', 'Group ID')
  .option('-o, --output [output]', 'Output CSV path', './activity-scores.csv')
  .option('-s, --start [start]', 'Start date - form of \'2018-9-4\'')
  .option('-e, --end [end]', 'End date - form of \'2018-9-6\'')
  .option('-m, --month [month]', 'Activity month (0-11)', new Date().getMonth())
  .option('-d, --displayName [displayName]', 'Member display name - ex \'ferenz#11349\'')
  .option('-s, --slice [slice]', 'Members slice (testing)')
  .option('-r, --rate [rate]', 'Request rate limit(ms)', 40)
  .parse(process.argv);

const { apiKey, groupId, output } = program;
const name = program.displayName;
const month = Number(program.month);
const slice = Number(program.slice);
const rate = Number(program.rate);
let startDate;
let endDate;
if (program.start && program.end) {
  startDate = new Date(program.start);
  endDate = new Date(program.end);
} else {
  startDate = new Date(2018, month, 1);
  endDate = new Date(2018, month + 1, 0);
}
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

  if (name) {
    const id = await getMembershipId(name);
    clanMembers = [];
    clanMembers.push({ name, membershipId: id });
  } else if (slice) {
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
      { id: 'activityScore', title: 'ACTIVITY_SCORE'},
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

async function calculateActivityScore(member) {
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

const gameModes = new Map();
gameModes.set(2, 'story');
gameModes.set(3, 'strike');
gameModes.set(4, 'raid');
gameModes.set(5, 'pvp');
gameModes.set(6, 'patrol');
