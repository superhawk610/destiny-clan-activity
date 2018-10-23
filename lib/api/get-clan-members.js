const _ = require('lodash');

const api = require('.');
const config = require('../config');

// memoize clan members for each script run (no need to fetch
// it more than once per run)
let members;

async function fetchClanMembers() {
  const groupId = config.get('groupId');

  const json = await api.get(
    `https://www.bungie.net/Platform/GroupV2/${groupId}/Members/`,
  );
  members = _.keyBy(
    json.Response.results.map(member => ({
      id: member.destinyUserInfo.membershipId,
      name: member.destinyUserInfo.displayName,
    })),
    'id',
  );
}

// returns an array of { displayName, membershipId } for all clan members
// FIXME: this probably breaks if you call it multiple times before it's
// completed once
async function getClanMemberArray() {
  if (!members) await fetchClanMembers();

  return Object.values(members);
}

async function getClanMembers() {
  if (!members) await fetchClanMembers();

  return members;
}

module.exports.getClanMemberArray = getClanMemberArray;
module.exports.getClanMembers = getClanMembers;
