const chalk = require('chalk');

const { formatTime } = require('../format');

const isError = e => e && e.stack && e.message;

const logHeader = (header, subheader) => {
  console.log();
  console.log(chalk.bold.white(header));
  if (subheader) console.log(chalk.white(subheader));
  console.log(chalk.bold.white('-'.repeat(header.length)));
  console.log();
};

const logInfo = info => {
  console.log(chalk.blue(`  ${info}`));
};

const timeTags = {};
const logTime = tag => {
  if (timeTags[tag]) {
    const elapsedSeconds = (Date.now() - timeTags[tag]) / 1000;
    console.log(`  time elapsed: ${chalk.green(formatTime(elapsedSeconds))}`);
    delete logTime[tag];
  }

  timeTags[tag] = Date.now();
};

// log an existing Error
//
//   logError(new Error('foo'))
//
// or multiple lines of text
//
//   logError('message')
//   logError('line1', 'line2', 'line3')
//
const logError = (...error) => {
  const message = isError(error[0])
    ? [error[0].message, error[0].stack]
    : error;
  message.forEach(line => console.log(chalk.red(line)));
};

const logErrorAndQuit = (...error) => {
  console.log(chalk.bold.red('Oops! We encountered a fatal error.'));
  logError(...error);

  process.exit(1);
};

const footers = {};
const appendToFooter = key => line => {
  if (footers[key] === undefined) footers[key] = [];

  footers[key].push(line);
};

const logFooter = (key, header, subheader) => {
  const lines = footers[key];
  if (!lines) return;

  if (header) logHeader(header, subheader);
  lines.forEach(line => logInfo(line));
};

module.exports.logHeader = logHeader;
module.exports.logInfo = logInfo;
module.exports.logTime = logTime;
module.exports.logError = logError;
module.exports.logErrorAndQuit = logErrorAndQuit;
module.exports.appendToFooter = appendToFooter;
module.exports.logFooter = logFooter;
