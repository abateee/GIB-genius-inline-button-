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
