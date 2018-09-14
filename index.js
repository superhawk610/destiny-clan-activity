/* eslint-disable no-await-in-loop,no-param-reassign,no-restricted-syntax */
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const program = require('commander');
const activity = require('./activity.js');

const date = new Date();

program
  .option('-k, --api-key [apiKey]', 'X-API-Key')
  .option('-g, --group-id [groupId]', 'Group ID')
  .option('-o, --output [output]', 'Output CSV path', './activity-scores.csv')
  .option('-s, --start [start]', 'Start date - form of \'2018-9-4\'', new Date(date.getFullYear(), date.getMonth(), 1))
  .option('-e, --end [end]', 'End date - form of \'2018-9-6\'', date)
  .option('-d, --displayName [displayName]', 'Member display name - ex \'ferenz#11349\'')
  .option('-l, --slice [slice]', 'Members slice (testing)')
  .option('-r, --rate [rate]', 'Request rate limit(ms)', 40)
  .parse(process.argv);

// report options
const { apiKey, groupId, output } = program;
const name = program.displayName;
const slice = Number(program.slice);
const rate = Number(program.rate);
const startDate = program.start;
const endDate = program.end;

(async () => {
  const activityScores = await activity.getActivityReport({
    apiKey,
    groupId,
    name,
    slice,
    rate,
    startDate,
    endDate,
  });

  const csvWriter = createCsvWriter({
    path: output,
    header: [
      { id: 'name', title: 'NAME' },
      { id: 'activityScore', title: 'ACTIVITY_SCORE' },
      { id: 'totalClanGames', title: 'CLAN_GAMES' },
      { id: 'gameModes', title: 'GAME_MODES' },
      { id: 'clanMemberList', title: 'CLAN_MEMBERS' },
    ],
  });
  await csvWriter.writeRecords(activityScores);
})();
