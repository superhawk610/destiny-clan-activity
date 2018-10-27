const api = require('./lib/api');
const config = require('./lib/config');
const progress = require('./lib/progress');
const { logHeader, logTime, logInfo, logFooter } = require('./lib/log');

async function getActivityReport() {
  logHeader('Generating clan activity report', 'this will take awhile :)');
  logTime('activity-report');

  const displayName = config.get('displayName');
  const only = config.get('only');

  let clanMembers;
  if (displayName) {
    const id = await api.getMembershipId(displayName);
    clanMembers = [
      {
        id,
        name: displayName,
      },
    ];
  } else {
    clanMembers = await api.getClanMemberArray();
    if (only) clanMembers = clanMembers.slice(0, only);
  }

  progress.init();

  const activityScores = await Promise.all(
    clanMembers.map(api.getActivityScore),
  );

  logHeader('Report successfully generated!');

  logInfo(`successful requests: ${api.getLimiterCounts().DONE}`);
  console.log();

  logTime('activity-report');

  logFooter(
    'no-activities',
    'The following accounts have characters with no recorded activities',
  );

  logFooter(
    'private-accounts',
    'The following accounts are private and could not be fetched',
    'These users will need to allow account access for continued clan membership',
  );

  return activityScores.sort((a, b) => b.totalClanGames - a.totalClanGames);
}

module.exports.getActivityReport = getActivityReport;
