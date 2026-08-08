#!/usr/bin/env node
// Scores a BFI-2 (Big Five Inventory-2) response — see assets/bfi2-form.pdf
// for the source questionnaire and scoring key this transcribes.
//
// Usage:
//   node scripts/score-bfi2.js path/to/answers.json
//   cat answers.json | node scripts/score-bfi2.js
//
// Input: a JSON object with keys bfi1..bfi60, each set to one of the five
// BFI_SCALE labels below (as produced by booking_eeg.html's questionnaire).
// Extra keys (d_sex, c_read, etc.) are ignored.

'use strict';

const BFI_SCALE = ['Disagree strongly', 'Disagree a little', 'Neutral',
                   'Agree a little', 'Agree strongly'];

// booking.html/booking_eeg.html used this longer label for the neutral point
// before 2026-08-08 — kept so responses collected under the old copy still score.
const LEGACY_NEUTRAL_LABEL = 'Neutral; no opinion';

// Parses spec strings straight from the PDF's scoring key, e.g.
// "1, 6, 11R, 16R, 21, 26R, 31R, 36R, 41, 46, 51R, 56" -> [{item:1,reverse:false}, ...]
function parseSpec(spec) {
  return spec.split(',').map(function (s) {
    s = s.trim();
    const reverse = s.endsWith('R');
    const item = parseInt(reverse ? s.slice(0, -1) : s, 10);
    return { item: item, reverse: reverse };
  });
}

const DOMAINS = {
  'Extraversion':          parseSpec('1, 6, 11R, 16R, 21, 26R, 31R, 36R, 41, 46, 51R, 56'),
  'Agreeableness':         parseSpec('2, 7, 12R, 17R, 22R, 27, 32, 37R, 42R, 47R, 52, 57'),
  'Conscientiousness':     parseSpec('3R, 8R, 13, 18, 23R, 28R, 33, 38, 43, 48R, 53, 58R'),
  'Negative Emotionality': parseSpec('4R, 9R, 14, 19, 24R, 29R, 34, 39, 44R, 49R, 54, 59'),
  'Open-Mindedness':       parseSpec('5R, 10, 15, 20, 25R, 30R, 35, 40, 45R, 50R, 55R, 60')
};

const FACETS = {
  'Sociability':            parseSpec('1, 16R, 31R, 46'),
  'Assertiveness':          parseSpec('6, 21, 36R, 51R'),
  'Energy Level':           parseSpec('11R, 26R, 41, 56'),
  'Compassion':             parseSpec('2, 17R, 32, 47R'),
  'Respectfulness':         parseSpec('7, 22R, 37R, 52'),
  'Trust':                  parseSpec('12R, 27, 42R, 57'),
  'Organization':           parseSpec('3R, 18, 33, 48R'),
  'Productiveness':         parseSpec('8R, 23R, 38, 53'),
  'Responsibility':         parseSpec('13, 28R, 43, 58R'),
  'Anxiety':                parseSpec('4R, 19, 34, 49R'),
  'Depression':             parseSpec('9R, 24R, 39, 54'),
  'Emotional Volatility':   parseSpec('14, 29R, 44R, 59'),
  'Intellectual Curiosity': parseSpec('10, 25R, 40, 55R'),
  'Aesthetic Sensitivity':  parseSpec('5R, 20, 35, 50R'),
  'Creative Imagination':   parseSpec('15, 30R, 45R, 60')
};

// Each domain's three facets, in the order the PDF lists them.
const DOMAIN_FACETS = {
  'Extraversion':          ['Sociability', 'Assertiveness', 'Energy Level'],
  'Agreeableness':         ['Compassion', 'Respectfulness', 'Trust'],
  'Conscientiousness':     ['Organization', 'Productiveness', 'Responsibility'],
  'Negative Emotionality': ['Anxiety', 'Depression', 'Emotional Volatility'],
  'Open-Mindedness':       ['Intellectual Curiosity', 'Aesthetic Sensitivity', 'Creative Imagination']
};

// Converts { bfi1: 'Agree strongly', ... } to { 1: 5, ... }.
function toItemValues(answers) {
  const values = {};
  for (let i = 1; i <= 60; i++) {
    const raw = answers['bfi' + i];
    const label = raw === LEGACY_NEUTRAL_LABEL ? 'Neutral' : raw;
    const index = BFI_SCALE.indexOf(label);
    if (index === -1) {
      throw new Error('bfi' + i + ' is missing or not a recognised BFI_SCALE label: ' + JSON.stringify(label));
    }
    values[i] = index + 1; // 1..5
  }
  return values;
}

function scaleScore(values, spec) {
  const sum = spec.reduce(function (total, ref) {
    const raw = values[ref.item];
    return total + (ref.reverse ? 6 - raw : raw);
  }, 0);
  return sum / spec.length;
}

function scoreBfi2(answers) {
  const values = toItemValues(answers);
  const domains = {};
  Object.keys(DOMAINS).forEach(function (name) { domains[name] = scaleScore(values, DOMAINS[name]); });
  const facets = {};
  Object.keys(FACETS).forEach(function (name) { facets[name] = scaleScore(values, FACETS[name]); });
  return { domains: domains, facets: facets };
}

function main() {
  const path = process.argv[2];
  const chunks = [];
  const stream = path ? require('fs').createReadStream(path) : process.stdin;

  stream.on('data', function (chunk) { chunks.push(chunk); });
  stream.on('end', function () {
    const answers = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const result = scoreBfi2(answers);

    console.log('Domain scores (1-5 mean, higher = more of the trait):');
    Object.keys(result.domains).forEach(function (name) {
      console.log('  ' + name.padEnd(22) + result.domains[name].toFixed(2));
    });

    console.log('\nFacet scores:');
    Object.keys(result.facets).forEach(function (name) {
      console.log('  ' + name.padEnd(22) + result.facets[name].toFixed(2));
    });
  });
  stream.on('error', function (err) { console.error(err.message); process.exitCode = 1; });
}

if (require.main === module) main();

module.exports = {
  scoreBfi2: scoreBfi2, DOMAINS: DOMAINS, FACETS: FACETS, DOMAIN_FACETS: DOMAIN_FACETS, BFI_SCALE: BFI_SCALE
};
