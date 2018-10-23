const api = require('.');

// TODO: this probably shouldn't be hard-coded
async function getClanInfo() {
  const json = await api.get(
    'https://www.bungie.net/Platform/GroupV2/Name/Charlie+Company+337/1',
  );
  return json.Response.detail;
}

module.exports = getClanInfo;
