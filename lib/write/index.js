const fs = require('fs');
const json2csv = require('json2csv').parse;

const config = require('../config');

const writeToCsv = report => {
  const csv = json2csv(report, {
    header: false,
    quote: "'",
    doubleQuote: '"',
    fields: [
      'name',
      'activityScore',
      'totalClanGames',
      'gameModes',
      'clanMemberList',
    ],
  });
  const headerString = 'NAME,ACTIVITY_SCORE,CLAN_GAMES,GAME_MODES,CLAN_MEMBERS';

  fs.writeFileSync(config.get('output'), `${headerString}\n${csv}`);
};

const writeToJson = report => {
  const outputFile = config.get('output').replace(/.csv$/, '.json');

  fs.writeFileSync(outputFile, JSON.stringify(report));
};

module.exports.writeToCsv = writeToCsv;
module.exports.writeToJson = writeToJson;
