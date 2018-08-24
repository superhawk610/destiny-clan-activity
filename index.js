const fetch = require('fetch-retry');

const apiKey = 'd78cb29fa3ab4ff8bacc5be25a96be9f';
const groupId = '2475694'; // this could change, if so use 'getClanInfo' and dump the new id
const fetchHeaders = { 'X-API-Key': 'd78cb29fa3ab4ff8bacc5be25a96be9f' };

async function getClanInfo() {
  const response = await fetch('https://www.bungie.net/Platform/GroupV2/Name/Charlie Company 337/1', { headers: fetchHeaders });
  const json = await response.json();
  return json.Response.detail;
}

// returns an array of { displayName, membershipId } for all clan members
async function getClanMembers() {
  const response = await fetch('https://www.bungie.net/Platform/GroupV2/' + groupId + '/Members/', { headers: fetchHeaders });
  const json = await response.json()
  const list = json.Response.results;
  const members = [];
  list.forEach((member) => {
    members.push({
      name: member.destinyUserInfo.displayName,
      id: member.destinyUserInfo.membershipId
    })
  });
  return members;
}

// returns array of characterId for account of memberId
async function getCharacters(memberId) {
  const response = await fetch('https://www.bungie.net/Platform/Destiny2/4/Profile/' + memberId + '/?components=100', { headers: fetchHeaders });
  const json = await response.json()
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

  try {
    while (activityDate > startDate) {
      const response = await fetch(`https://www.bungie.net/Platform/Destiny2/4/Account/${memberId}/Character/${characterId}/Stats/Activities/?count=100&page=${page}&modes='5,7'`, { headers: fetchHeaders })
      const json = await response.json()
      const activityList = json.Response.activities;
      for (let activity of activityList) {
        activityDate = new Date(activity.period)
        if (activityDate < startDate) { break };
        const activityId = activity.activityDetails.instanceId;
        const response = await fetch(`https://www.bungie.net/Platform//Destiny2/Stats/PostGameCarnageReport/${activityId}/`, { headers: fetchHeaders })
        const json = await response.json()
        activities.push(json.Response);
      }
      page = page + 1;
    }
    return activities;
  } catch (error) {
    console.log(error);
  }
}

async function getActivityScore(memberId, clanMemberIds, startDate, endDate) {
  let activityScore = {
    totalClanGames: 0,
    clanMembers: new Set(),
  }

  const characters = await getCharacters(memberId);
  for (let characterId of characters) {
    // console.log(characterId);
    const activities = await getActivities(memberId, characterId, startDate, endDate);
    for (let activity of activities) {
      for (let entry of activity.entries) {
        const entryMemberId = entry.player.destinyUserInfo.membershipId;
        if (entryMemberId !== memberId && clanMemberIds.includes(entryMemberId)) {
          activityScore.totalClanGames++;
          activityScore.clanMembers.add(entry.player.destinyUserInfo.displayName);
        }
      }
    }
  }

  return activityScore;
}

(async () => {
  const activityScores = [];
  const clanMembers = await getClanMembers();

  // generate an array of ids for faster lookup later
  const clanMemberIds = [];
  clanMembers.forEach((member) => {
    clanMemberIds.push(member.id);
  })

  const test = await getActivityScore('4611686018467464907', clanMemberIds);

  for (let member of clanMembers) {
    const activityScore = await getActivityScore(member.id, clanMemberIds);
    console.log(`${member.name} - total clan games: ${activityScore.totalClanGames} - clan members in games: ${[...activityScore.clanMembers]}`);
  }
})()