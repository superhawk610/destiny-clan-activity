const program = require('commander');
const path = require('path');
const _ = require('lodash');

const { logErrorAndQuit } = require('../log');

// env variables in `.env` will be appended
// to `process.env`
require('dotenv').config({
  path: path.join(__dirname, '.env'),
});

const outputFile = path.join(__dirname, '..', '..', 'activity-scores.csv');

const init = () =>
  program
    .option('-k, --apiKey [apiKey]', 'X-API-Key')
    .option('-g, --groupId [groupId]', 'Group ID')
    .option('-o, --output [output]', 'Output CSV path')
    .option('-s, --start [startDate]', "Start date - form of '2018-9-4'")
    .option('-e, --end [endDate]', "End date - form of '2018-9-6'")
    .option(
      '-d, --displayName [displayName]',
      "Member display name - ex 'ferenz#11349'",
    )
    .option('-l, --only [only]', 'Only run for [val] members')
    .option('-r, --rate [rate]', 'Request rate limit(ms)')
    .option('-v, --verbose', 'Log all outgoing requests')
    .parse(process.argv);

const get = key => {
  // try getting value from process args
  if (program[key] && typeof program[key] !== 'function') return program[key];

  // try getting value from environment
  // env variables should be set as such:
  //
  //   displayName -> D2_DISPLAY_NAME
  //   apiKey -> D2_API_KEY
  //   output -> D2_OUTPUT
  //   etc.
  //
  const envKey = `D2_${_.snakeCase(key).toUpperCase()}`;
  if (process.env[envKey]) return process.env[envKey];

  // env variables should take precedence over default parameters
  const now = new Date();

  // TODO: this could be done better - just need some way to determine
  // whether param was set to its default or not
  switch (key) {
    case 'output':
      return outputFile;
    case 'startDate':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'endDate':
      return now;
    case 'rate':
      return 40;
    case 'displayName':
    case 'only':
    case 'verbose':
      return null;
    default:
      logErrorAndQuit(
        `${key} must be set either`,
        `  - via env variable (${envKey})`,
        `  - or via cli param (--${key} [val])`,
      );
  }
};

module.exports.init = init;
module.exports.get = get;
