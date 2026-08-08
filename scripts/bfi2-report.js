#!/usr/bin/env node
// Builds a full BFI-2 report for one participant: the 5 domain scores, each
// with its 3 facet subscales nested underneath, per the hierarchy in
// assets/bfi2-form.pdf. Scoring itself lives in score-bfi2.js.
//
// Usage:
//   node scripts/bfi2-report.js path/to/answers.json [output.txt]
//   cat answers.json | node scripts/bfi2-report.js
//
// With no output path, the report prints to stdout only. With a path, it's
// also written to that file. Given only an input file and no output path,
// it's written alongside the input as <input>.report.txt.

'use strict';

const fs = require('fs');
const path = require('path');
const { scoreBfi2, DOMAIN_FACETS } = require('./score-bfi2');

// Known demographic/identity fields from booking_eeg.html's questionnaire —
// printed as a header if present, whichever of these happen to be in the input.
const HEADER_FIELDS = [
  ['firstName', 'First name'], ['lastName', 'Last name'], ['email', 'Email'],
  ['d_sex', 'Sex'], ['d_age', 'Age'], ['d_handedness', 'Handedness'],
  ['d_education', 'Education'], ['d_sector', 'Sector'], ['d_language', 'First language']
];

function buildReport(answers, format) {
  return format === 'md' ? buildMarkdownReport(answers) : buildTextReport(answers);
}

function buildTextReport(answers) {
  const result = scoreBfi2(answers);
  const lines = [];

  const header = HEADER_FIELDS.filter(function (f) { return answers[f[0]] !== undefined; });
  if (header.length) {
    lines.push('Participant');
    lines.push('-----------');
    header.forEach(function (f) { lines.push('  ' + f[1] + ': ' + answers[f[0]]); });
    lines.push('');
  }

  lines.push('BFI-2 Big Five report');
  lines.push('======================');
  lines.push('(1-5 scale, higher = more of the trait; domain score is the mean of its 3 facets)');
  lines.push('');

  Object.keys(DOMAIN_FACETS).forEach(function (domain) {
    lines.push(domain + ': ' + result.domains[domain].toFixed(2));
    DOMAIN_FACETS[domain].forEach(function (facet) {
      lines.push('  ' + facet.padEnd(24) + result.facets[facet].toFixed(2));
    });
    lines.push('');
  });

  return lines.join('\n');
}

function buildMarkdownReport(answers) {
  const result = scoreBfi2(answers);
  const lines = [];

  lines.push('# BFI-2 Big Five report');
  lines.push('');

  const header = HEADER_FIELDS.filter(function (f) { return answers[f[0]] !== undefined; });
  if (header.length) {
    lines.push('## Participant');
    lines.push('');
    header.forEach(function (f) { lines.push('- **' + f[1] + ':** ' + answers[f[0]]); });
    lines.push('');
  }

  lines.push('_1-5 scale, higher = more of the trait. Each domain score is the mean of its 3 facets below it._');
  lines.push('');

  Object.keys(DOMAIN_FACETS).forEach(function (domain) {
    lines.push('## ' + domain + ' — ' + result.domains[domain].toFixed(2));
    lines.push('');
    lines.push('| Facet | Score |');
    lines.push('| --- | --- |');
    DOMAIN_FACETS[domain].forEach(function (facet) {
      lines.push('| ' + facet + ' | ' + result.facets[facet].toFixed(2) + ' |');
    });
    lines.push('');
  });

  return lines.join('\n');
}

function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3] ||
    (inputPath ? inputPath.replace(/(\.json)?$/, '') + '.report.txt' : null);
  const format = outputPath && outputPath.endsWith('.md') ? 'md' : 'text';
  const chunks = [];
  const stream = inputPath ? fs.createReadStream(inputPath) : process.stdin;

  stream.on('data', function (chunk) { chunks.push(chunk); });
  stream.on('end', function () {
    const answers = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const report = buildReport(answers, format);

    console.log(report);
    if (outputPath) {
      fs.writeFileSync(outputPath, report + '\n', 'utf8');
      console.error('\nWritten to ' + path.resolve(outputPath));
    }
  });
  stream.on('error', function (err) { console.error(err.message); process.exitCode = 1; });
}

if (require.main === module) main();

module.exports = { buildReport: buildReport };
