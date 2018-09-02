/* eslint-disable no-await-in-loop,no-param-reassign,no-restricted-syntax */
const fetch = require('fetch-retry');

const apiKey = 'd78cb29fa3ab4ff8bacc5be25a96be9f';
const groupId = '2475694'; // this could change, if so use 'getClanInfo' and dump the new id
const fetchHeaders = { 'X-API-Key': 'd78cb29fa3ab4ff8bacc5be25a96be9f' };
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

let month = new Date().getMonth();
if (process.argv.length > 2) {
  month = Number(process.argv[2]);
}

let csvPath = './activity_scores.csv';
if (process.argv.length > 3) {
  csvPath = process.argv[3];
}


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
    startDate.setDate(1);
  }

  const activities = [];
  let page = 0;
  const fetchCount = 100;
  let returnCount = fetchCount;

  let keepGoing = true;
  while (keepGoing) {
    // console.log(activityDate);
    // console.log(startDate);

    let gotActivityJson;
    let activityList;
    while (!gotActivityJson) {
      const gameResponse = await fetch(`https://www.bungie.net/Platform/Destiny2/4/Account/${memberId}/Character/${characterId}/Stats/Activities/?count=100&page=${page}&modes='5,7'`, { headers: fetchHeaders });
      const contentType = gameResponse.headers.get('content-type');
      if (contentType && contentType.indexOf('application/json') !== -1) {
        const json = await gameResponse.json();
        activityList = json.Response.activities;
        gotActivityJson = true;
      } else {
        console.log('thanks alot bungo');
      }
    }
    
    for (const activity of activityList) {
      const activityDate = new Date(activity.period);
      if (activityDate >= startDate && activityDate <= endDate) {
        const activityId = activity.activityDetails.instanceId;
        let gotJson;
        while (!gotJson) {
          const gameResponse = await fetch(`https://www.bungie.net/Platform//Destiny2/Stats/PostGameCarnageReport/${activityId}/`, { headers: fetchHeaders });
          const contentType = gameResponse.headers.get('content-type');
          if (contentType && contentType.indexOf('application/json') !== -1) {
            const gameJson = await gameResponse.json();
            activities.push(gameJson.Response);
            gotJson = true;
          } else {
            console.log('thanks alot bungo');
          }
        }
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
  };

  try {
    const characters = await getCharacters(member.id);
    for (const characterId of characters) {
      // console.log(characterId);
      const activities = await getActivities(member.id, characterId, startDate, endDate);
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

  //const subArray = clanMembers.slice(1, 10);
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
