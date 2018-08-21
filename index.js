var fetch = require("node-fetch");
var Traveler = require('the-traveler').default;
const Enums = require('the-traveler/build/enums')

const traveler = new Traveler({
    apikey: 'd78cb29fa3ab4ff8bacc5be25a96be9f',
    userAgent: 'chrome', //used to identify your request to the API
});

//Access the enums (example componentType profiles)
var profilesType = Enums.ComponentType.Profiles;

const apiKey = 'd78cb29fa3ab4ff8bacc5be25a96be9f';
const groupId = '2475694'; // this could change, if so use 'getClanInfo' and dump the new id
const fetchHeaders = {'X-API-Key': 'd78cb29fa3ab4ff8bacc5be25a96be9f'};

function getClanActivity(displayName, timeSpan) {

}

async function getMembershipId(displayName) {
    if (!displayName.includes('#') && !displayName.includes('%23')) {
        throw new Error('getMembershipId: displayName must contain \'#\' or \'%23\' eg \'ferenz#11349\'');
    }
    displayName = displayName.replace('#', '%23');

    // console.log(displayName);
    const player = await traveler.searchDestinyPlayer('4', displayName);
    const id = player.Response[0].membershipId;
    return id;
}

async function getClanInfo() {
    const response = await fetch('https://www.bungie.net/Platform/GroupV2/Name/Charlie Company 337/1', { headers: fetchHeaders });
    const json = await response.json();
    return json.Response.detail;
}

async function getClanMemberIds() {
    const response = await fetch('https://www.bungie.net/Platform/GroupV2/' + groupId + '/Members/', { headers: fetchHeaders });
    const json = await response.json()
    const list = json.Response.results;
    const memberIds = new Set();
    list.forEach((member) => {memberIds.add(member.destinyUserInfo.membershipId)});
    return memberIds;
}

async function getCharacters(memberId) {
    const response = await fetch('https://www.bungie.net/Platform/Destiny2/4/Profile/' + memberId + '/?components=100', { headers: fetchHeaders });
    const json = await response.json()
    const list = json.Response.profile.data.characterIds;
    return list;
}

async function getActivities(memberId, characterId, count) {
    if (!count) {count = 100};
    const response = await fetch(`https://www.bungie.net/Platform/Destiny2/4/Account/${memberId}/Character/${characterId}/Stats/Activities/?count=${count}`, { headers: fetchHeaders });
    const json = await response.json()
    const list = json.Response.activities;
    return list;
}

// dump clan list
(async () => {
    const clanList = await getClanMemberIds();

    for (let memberId of clanList) {
        console.log(memberId);

        // get chars
        const charList = await getCharacters(memberId);
        console.log(charList);

        for (let characterId of charList) {
            const activityList = await getActivities(memberId, characterId);
            console.log(activityList)
        }
    }

    // get clan member list for group id
    // for each clan member in list
        // get character list for clan member
        // for each character
            // get activity list for character
            // for each activity
                // if fireteam contains clan member add member name to map / increment
    // return map length (different members) + map sum (total member games)
})()