#!/usr/bin/env node
// Checks community case files and builds community/cases/index.json.
//
//   node scripts/validate-community.js          validate, then write the index
//   node scripts/validate-community.js --check  validate, and fail if the index is out of date
//
// Files whose names start with "_" (such as _template.json) are skipped.
// Needs only Node.js. No packages to install.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dir = path.join(root, 'community', 'cases');
const indexPath = path.join(dir, 'index.json');
const checkOnly = process.argv.includes('--check');

// Reuse the topic list from the game so community cases use the same categories.
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const puzzles = eval(html.match(/const PUZZLES = (\[[\s\S]*?\n\]);/)[1]);
const TOPICS = [...new Set(puzzles.map(c => c.topic))].sort();
const BUILT_IN_IDS = new Set(puzzles.map(c => String(c.id)));
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const KNOWN_FIELDS = ['id', 'title', 'topic', 'difficulty', 'severity', 'scenario', 'lines', 'answer',
  'explanation', 'hint', 'attack', 'attackName', 'walkthrough'];

function problems(c, file) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return ['must be a JSON object'];
  const errors = [];
  const need = (ok, message) => { if (!ok) errors.push(message); };
  const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max;

  need(typeof c.id === 'string' && /^c-[a-z0-9-]{3,40}$/.test(c.id),
    'id must look like c-my-case (lowercase letters, digits and hyphens)');
  need(typeof c.id === 'string' && path.basename(file, '.json') === c.id, 'the file name must match the id');
  need(!BUILT_IN_IDS.has(String(c.id)), 'the id clashes with a built-in case');
  need(text(c.title, 60), 'title must be 1 to 60 characters');
  need(TOPICS.includes(c.topic), `topic must be one of: ${TOPICS.join(', ')}`);
  need(DIFFICULTIES.includes(c.difficulty), 'difficulty must be Easy, Medium or Hard');
  need(SEVERITIES.includes(c.severity), 'severity must be Low, Medium, High or Critical');
  need(text(c.scenario, 400), 'scenario must be 1 to 400 characters');
  need(Array.isArray(c.lines) && c.lines.length >= 4 && c.lines.length <= 30, 'lines must be an array of 4 to 30 log lines');
  if (Array.isArray(c.lines)) {
    c.lines.forEach((line, i) => {
      need(typeof line === 'string' && line.length <= 300 && /^\d{2}:\d{2}:\d{2}\s/.test(line),
        `line ${i + 1} must start with a time such as 09:00:00 and be at most 300 characters`);
    });
  }
  need(Number.isInteger(c.answer) && Array.isArray(c.lines) && c.answer >= 0 && c.answer < c.lines.length,
    'answer must be the zero-based position of the turning-point line');
  need(text(c.explanation, 500), 'explanation must be 1 to 500 characters');
  need(text(c.hint, 200), 'hint must be 1 to 200 characters');
  need(typeof c.attack === 'string' && /^T\d{4}(\.\d{3})?$/.test(c.attack), 'attack must be a MITRE ATT&CK ID such as T1110.003');
  need(text(c.attackName, 80), 'attackName must be 1 to 80 characters');
  need(Array.isArray(c.walkthrough) && c.walkthrough.length >= 2 && c.walkthrough.length <= 5
    && c.walkthrough.every(step => text(step, 300)), 'walkthrough must be 2 to 5 steps of up to 300 characters');
  const unknown = Object.keys(c).filter(k => !KNOWN_FIELDS.includes(k));
  need(unknown.length === 0, `unknown fields: ${unknown.join(', ')}`);
  return errors;
}

const files = fs.readdirSync(dir)
  .filter(f => f.endsWith('.json') && f !== 'index.json' && !f.startsWith('_'))
  .sort();

let failed = false;
const cases = [];
const seen = new Set();
for (const file of files) {
  let c;
  try {
    c = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  } catch (err) {
    console.error(`${file}: not valid JSON (${err.message})`);
    failed = true;
    continue;
  }
  const errors = problems(c, file);
  if (c && c.id && seen.has(c.id)) errors.push('duplicate id');
  if (errors.length) {
    failed = true;
    errors.forEach(message => console.error(`${file}: ${message}`));
    continue;
  }
  seen.add(c.id);
  cases.push(c);
}

if (failed) {
  console.error('Validation failed. Fix the problems above and run this again.');
  process.exit(1);
}

const output = JSON.stringify(cases, null, 2) + '\n';
if (checkOnly) {
  const current = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
  if (current !== output) {
    console.error('community/cases/index.json is out of date. Run: node scripts/validate-community.js');
    process.exit(1);
  }
  console.log(`OK: ${cases.length} community case(s), index is up to date.`);
} else {
  fs.writeFileSync(indexPath, output);
  console.log(`Wrote ${cases.length} community case(s) to community/cases/index.json`);
}
