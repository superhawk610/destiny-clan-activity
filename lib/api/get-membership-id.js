const api = require('.');
const { logErrorAndQuit } = require('../log');

async function getMembershipId(displayName) {
  if (!displayName.match(/#|%23/)) {
    logErrorAndQuit(
      "getMembershipId: displayName must contain '#' or '%23' eg 'ferenz#11349'",
    );
  }

  const json = await api.get(
    `https://www.bungie.net/Platform/Destiny2/SearchDestinyPlayer/4/${encodeURIComponent(
      displayName,
    )}/`,
  );
  return json.Response[0].membershipId;
}

module.exports = getMembershipId;
