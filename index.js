const config = require('./lib/config');
const { writeToCsv, writeToJson } = require('./lib/write');
const { logErrorAndQuit } = require('./lib/log');

const activity = require('./activity');

// parse config from CLI / environment
config.init();

const toCsv = config.get('csv');
const toJson = config.get('json');

// run report
async function runReport() {
  try {
    const report = await activity.getActivityReport();
    if (toCsv) writeToCsv(report);
    if (toJson) writeToJson(report);
  } catch (e) {
    logErrorAndQuit(e);
  }
}

runReport();
