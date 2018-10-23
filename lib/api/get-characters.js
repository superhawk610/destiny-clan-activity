const api = require('.');

// returns array of characterId for account of memberId
async function getCharacters(memberId) {
  const json = await api.get(
    `https://www.bungie.net/Platform/Destiny2/4/Profile/${memberId}/?components=100`,
  );
  return json.Response.profile.data.characterIds;
}

module.exports = getCharacters;
