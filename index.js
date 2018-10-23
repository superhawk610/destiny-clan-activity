const config = require('./lib/config');
const write = require('./lib/write-to-csv');
const { logErrorAndQuit } = require('./lib/log');

const activity = require('./activity');

// parse config from CLI / environment
config.init();

// run report
async function runReport() {
  try {
    const report = await activity.getActivityReport();
    write(report);
  } catch (e) {
    logErrorAndQuit(e);
  }
}

runReport();
