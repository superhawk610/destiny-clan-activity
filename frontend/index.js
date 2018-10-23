const express = require('express');
const path = require('path');
const fs = require('fs');
const lodash = require('lodash');

const app = express();

app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

app.locals._ = lodash;

let roster;
try {
  const json = fs.readFileSync(
    path.join(__dirname, '..', 'activity-scores.json'),
  );
  roster = JSON.parse(json);
} catch (e) {
  console.log(
    'No JSON file found. Please run a clan report with the `--json` param before launching.',
  );
  process.exit(1);
}

app.get('/', (req, res) => {
  res.render('app', { roster });
});

app.get('/:user', (req, res) => {
  res.render('detail', {
    user: roster.find(user => user.name === req.params.user),
  });
});

app.listen(3000, () => console.log('listening on *:3000'));
