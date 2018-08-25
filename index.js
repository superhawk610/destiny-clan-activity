const fetch = require('fetch-retry');

const apiKey = 'd78cb29fa3ab4ff8bacc5be25a96be9f';
const groupId = '2475694'; // this could change, if so use 'getClanInfo' and dump the new id
const fetchHeaders = { 'X-API-Key': 'd78cb29fa3ab4ff8bacc5be25a96be9f' };
const csvPath = './activity_scores.csv';
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const clanMemberIds = [];
const activityScores = [];

const csvWriter = createCsvWriter({
  path: csvPath,
  header: [
    { id: 'name', title: 'NAME' },
    { id: 'totalClanGames', title: 'CLAN_GAMES' },
    { id: 'clanMemberList', title: 'CLAN_MEMBERS' },
  ],
});

function chunkArray(myArray, chunkSize) {
  const results = [];
  while (myArray.length) {
    results.push(myArray.splice(0, chunkSize));
  }
  return results;
}

async function getClanInfo() {
  const response = await fetch('https://www.bungie.net/Platform/GroupV2/Name/Charlie Company 337/1', { headers: fetchHeaders });
  const json = await response.json();
  return json.Response.detail;
}

// returns an array of { displayName, membershipId } for all clan members
async function getClanMembers() {
  const response = await fetch(`https://www.bungie.net/Platform/GroupV2/${groupId}/Members/`, { headers: fetchHeaders });
  const json = await response.json();
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
  const response = await fetch(`https://www.bungie.net/Platform/Destiny2/4/Profile/${memberId}/?components=100`, { headers: fetchHeaders });
  const json = await response.json();
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
    startDate.setUTCDate(1);
  }

  const activities = [];
  let activityDate = new Date(endDate.toDateString());
  let page = 0;
  const fetchCount = 100;
  let returnCount = fetchCount;

  while (activityDate > startDate && returnCount === fetchCount) {
    const response = await fetch(`https://www.bungie.net/Platform/Destiny2/4/Account/${memberId}/Character/${characterId}/Stats/Activities/?count=100&page=${page}&modes='5,7'`, { headers: fetchHeaders });
    const json = await response.json();
    const activityList = json.Response.activities;
    for (const activity of activityList) {
      activityDate = new Date(activity.period);
      if (activityDate < startDate) { break; }
      const activityId = activity.activityDetails.instanceId;
      const gameResponse = await fetch(`https://www.bungie.net/Platform//Destiny2/Stats/PostGameCarnageReport/${activityId}/`, { headers: fetchHeaders });
      const gameJson = await gameResponse.json();
      activities.push(gameJson.Response);
    }
    returnCount = activityList.length;
    page += 1;
  }
  return activities;
}

async function calculateActivityScore(member) {
  console.log(`calculating activity score for clan member ${member.name}`);

  const activityScore = {
    totalClanGames: 0,
    clanMembers: new Set(),
  };

  try {
    const characters = await getCharacters(member.id);
    for (const characterId of characters) {
      // console.log(characterId);
      const activities = await getActivities(member.id, characterId);
      for (const activity of activities) {
        for (const entry of activity.entries) {
          const entryMemberId = entry.player.destinyUserInfo.membershipId;
          if (entryMemberId !== member.id && clanMemberIds.includes(entryMemberId)) {
            activityScore.totalClanGames += 1;
            activityScore.clanMembers.add(entry.player.destinyUserInfo.displayName);
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
    clanMemberList: [...activityScore.clanMembers],
  });
}

(async () => {
  console.log('generating clan activity report - this will take awhile :)');
  console.time('activity report');
  const clanMembers = await getClanMembers();

  // generate an array of ids for faster lookup later
  clanMembers.forEach((member) => {
    clanMemberIds.push(member.id);
  });

  // const clanMembers2 = clanMembers.slice(1, 30);
  const splitArray = chunkArray(clanMembers, 20);
  for (let subArray of splitArray) {
    const promises = subArray.map(calculateActivityScore);
    await Promise.all(promises);
  }

  console.log(`report generation complete - writing csv to ${csvPath}`);
  activityScores.sort((a, b) => b.totalClanGames - a.totalClanGames);
  await csvWriter.writeRecords(activityScores);
  console.log('report successfully written to file');
  console.timeEnd('activity report');
})();
