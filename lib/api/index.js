const rp = require('request-promise-native');
const promiseRetry = require('promise-retry');
const Bottleneck = require('bottleneck');

const config = require('../config');
const { logError } = require('../log');

let limiter;

const getLimiterCounts = () => limiter.counts();

const rpRetry = (...args) =>
  promiseRetry(async (retry, number) => {
    try {
      const json = await limiter.schedule(() => rp(...args));
      return json;
    } catch (error) {
      if (config.get('verbose')) {
        logError(`retry #${number} - ${error}`);
      }
      retry(error);
    }
  });

const get = (uri, opts = {}) => {
  const verbose = config.get('verbose');

  if (!limiter) {
    limiter = new Bottleneck({
      minTime: config.get('rate'),
      trackDoneStatus: true,
    });
  }

  const options = {
    uri,
    json: true,
    timeout: 5000,
    headers: {
      'X-API-Key': config.get('apiKey'),
    },
    ...opts,
  };

  if (verbose) console.log(options);

  return rpRetry(options).then(json => {
    // Bungie API returns ErrorCode=1 upon Success
    if (verbose && json.ErrorCode && json.ErrorCode !== 1) {
      logError('API returned Error');
      console.log(json);
      console.log();
    }

    if (json.ErrorCode === 1665) {
      return { privateAccount: true };
    }

    return json;
  });
};

const { getClanMemberArray, getClanMembers } = require('./get-clan-members');

module.exports.getClanMemberArray = getClanMemberArray;
module.exports.getClanMembers = getClanMembers;
module.exports.getLimiterCounts = getLimiterCounts;
module.exports.get = get;
module.exports.getActivities = require('./get-activities');
module.exports.getActivityScore = require('./get-activity-score');
module.exports.getCharacters = require('./get-characters');
module.exports.getClanInfo = require('./get-clan-info');
module.exports.getMembershipId = require('./get-membership-id');
module.exports.getNameForMode = require('./get-name-for-mode');
