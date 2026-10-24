const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanupTitle, unique, buildQuery } = require('../lib/parse.js');

test('cleanupTitle retire les suffixes de page', () => {
  assert.equal(cleanupTitle('Song - YouTube'), 'Song');
  assert.equal(cleanupTitle('Song - YouTube Music'), 'Song');
  assert.equal(cleanupTitle('Song | Spotify'), 'Song');
});

test('cleanupTitle retire les mentions simples entre parenthèses ou crochets', () => {
  assert.equal(cleanupTitle('Song (Official Video)'), 'Song');
  assert.equal(cleanupTitle('Song [Lyrics]'), 'Song');
});

test('unique dédoublonne et ignore les valeurs vides', () => {
  assert.deepEqual(unique([' A ', 'A', '', null, 'B']), ['A', 'B']);
});

test('buildQuery assemble titre et artistes', () => {
  assert.equal(buildQuery({ title: 'Song', artists: ['A', 'B'] }), 'Song A B');
  assert.equal(buildQuery({ title: 'Song', artists: [] }), 'Song');
});

const { cleanTitle, splitNames } = require('../lib/parse.js');

test('cleanTitle retire les mentions de clip, quelle que soit la formulation', () => {
  const cases = {
    'Song (Official Music Video)': 'Song',
    'Song [Clip Officiel]': 'Song',
    'Song (Lyric Video)': 'Song',
    'Song (Paroles / Lyrics)': 'Song',
    'Song (Audio Officiel)': 'Song',
    'Song (Visualizer)': 'Song',
    'Song (Remastered 2011)': 'Song',
    'Song (Live at Wembley 1986)': 'Song',
    'Song (Slowed + Reverb)': 'Song',
    'Song (Sped Up)': 'Song',
    'Song [4K]': 'Song',
    'Song【MV】': 'Song',
    'Song (Official Video) [HD]': 'Song'
  };
  for (const [raw, expected] of Object.entries(cases)) {
    assert.equal(cleanTitle(raw).title, expected, raw);
  }
});

test('cleanTitle garde les parenthèses qui font partie du titre', () => {
  assert.equal(cleanTitle("(I Can't Get No) Satisfaction").title, "(I Can't Get No) Satisfaction");
  assert.equal(cleanTitle("(Don't Fear) The Reaper (Official Audio)").title, "(Don't Fear) The Reaper");
  assert.equal(cleanTitle('Song (Remix)').title, 'Song (Remix)');
  assert.equal(cleanTitle('Video Games').title, 'Video Games');
});

test('cleanTitle extrait les featurings', () => {
  assert.deepEqual(cleanTitle('Song (feat. A & B)'), { title: 'Song', featured: ['A', 'B'] });
  assert.deepEqual(cleanTitle('Song [ft. A]'), { title: 'Song', featured: ['A'] });
  assert.deepEqual(cleanTitle('Song ft. A, B'), { title: 'Song', featured: ['A', 'B'] });
  assert.deepEqual(cleanTitle('Song featuring A (Official Video)'), { title: 'Song', featured: ['A'] });
  assert.deepEqual(cleanTitle('Song (with A)'), { title: 'Song', featured: ['A'] });
});

test('cleanTitle ne confond pas "ft" avec un mot', () => {
  assert.equal(cleanTitle('Left Behind').title, 'Left Behind');
  assert.equal(cleanTitle('Drift Away').title, 'Drift Away');
});

test('cleanTitle retire prod., hashtags, emojis et la fin après | ou //', () => {
  assert.equal(cleanTitle('Song (prod. by X)').title, 'Song');
  assert.equal(cleanTitle('Song prod. X').title, 'Song');
  assert.equal(cleanTitle('Song #shorts #music').title, 'Song');
  assert.equal(cleanTitle('🔥 Song 🔥').title, 'Song');
  assert.equal(cleanTitle('Artist - Song | A COLORS SHOW').title, 'Artist - Song');
  assert.equal(cleanTitle('Song // Lyrics').title, 'Song');
});

test('splitNames découpe les collaborations courantes', () => {
  assert.deepEqual(splitNames('A, B & C'), ['A', 'B', 'C']);
  assert.deepEqual(splitNames('A x B'), ['A', 'B']);
  assert.deepEqual(splitNames('A × B'), ['A', 'B']);
  assert.deepEqual(splitNames('Xzibit'), ['Xzibit']);
});

test('unique ignore la casse', () => {
  assert.deepEqual(unique(['Drake', 'drake', 'Future']), ['Drake', 'Future']);
});
