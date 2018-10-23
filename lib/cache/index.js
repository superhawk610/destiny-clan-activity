const fs = require('fs');
const path = require('path');

const { logErrorAndQuit } = require('../log');

const cacheFile = path.join(__dirname, 'cache.json');

let cache = {};
try {
  const json = fs.readFileSync(cacheFile, 'utf-8');
  cache = JSON.parse(json);
} catch (e) {
  if (e instanceof SyntaxError) {
    logErrorAndQuit(
      `cache file (${cacheFile}) contains invalid JSON - correct or delete it to proceed`,
    );
  }
  // if it's not a SyntaxError, it just means it couldn't find the cache
  // file, which is fine, we'll just create it on the first `set`
}

const persist = () => {
  fs.writeFileSync(cacheFile, JSON.stringify(cache));
};

const set = store => (key, value) => {
  if (!cache[store]) cache[store] = {};

  cache[store][key] = value;
  persist();
};

const get = store => key => {
  const cachedStore = cache[store] || {};

  return cachedStore[key];
};

module.exports.set = set;
module.exports.get = get;
