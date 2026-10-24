const test = require('node:test');
const assert = require('node:assert/strict');
const {
  searchUrl, searchApiUrl, isGeniusUrl, normalize, similarity, extractSongHits, pickBestSong
} = require('../lib/match.js');

function song(id, title, artist, extra = {}) {
  return {
    id,
    title,
    url: `https://genius.com/${id}-lyrics`,
    primary_artist: { name: artist },
    artist_names: extra.artist_names || artist,
    ...extra
  };
}

function multi(...sections) {
  return { meta: { status: 200 }, response: { sections } };
}

test('les URLs pointent vers genius.com et encodent la requête', () => {
  assert.equal(searchUrl('Get Lucky Daft Punk'), 'https://genius.com/search?q=Get%20Lucky%20Daft%20Punk');
  assert.equal(searchApiUrl('A&B'), 'https://genius.com/api/search/multi?per_page=5&q=A%26B');
  assert.ok(isGeniusUrl('https://genius.com/Daft-punk-get-lucky-lyrics'));
  assert.equal(isGeniusUrl('https://evil.example/genius.com'), false);
  assert.equal(isGeniusUrl('javascript:alert(1)'), false);
});

test('normalize ignore accents, ponctuation, casse et "The"', () => {
  assert.equal(normalize('Beyoncé'), 'beyonce');
  assert.equal(normalize("Don't Stop"), 'dont stop');
  assert.equal(normalize('The Weeknd'), 'weeknd');
  assert.equal(normalize('Simon & Garfunkel'), 'simon and garfunkel');
});

test('similarity', () => {
  assert.equal(similarity('Get Lucky', 'get lucky'), 1);
  assert.equal(similarity('Jay Z', 'JAY-Z'), 1);
  assert.equal(similarity('Get Lucky Radio Edit', 'Get Lucky'), 0.85);
  assert.equal(similarity('', 'x'), 0);
  assert.ok(similarity('Blinding Lights', 'Save Your Tears') < 0.3);
});

test('extractSongHits garde les chansons, dédoublonnées, dans l\'ordre', () => {
  const a = song(1, 'Get Lucky', 'Daft Punk');
  const json = multi(
    { type: 'top_hit', hits: [{ type: 'song', result: a }] },
    { type: 'song', hits: [{ type: 'song', result: a }, { type: 'song', result: song(2, 'Lose Yourself to Dance', 'Daft Punk') }] },
    { type: 'artist', hits: [{ type: 'artist', result: { id: 9, name: 'Daft Punk', url: 'https://genius.com/artists/Daft-punk' } }] },
    { type: 'lyric', hits: [{ type: 'song', result: { id: 3, title: 'x', url: 'http://not-genius' } }] }
  );
  assert.deepEqual(extractSongHits(json).map(s => s.id), [1, 2]);
});

test('extractSongHits ne plante pas sur une réponse inattendue', () => {
  assert.deepEqual(extractSongHits(null), []);
  assert.deepEqual(extractSongHits({}), []);
  assert.deepEqual(extractSongHits({ response: { sections: 'nope' } }), []);
  assert.deepEqual(extractSongHits(multi({ hits: null }, null)), []);
});

test('pickBestSong choisit le bon artiste même si Genius le classe second', () => {
  const songs = [
    song(1, 'Hello', 'Lionel Richie'),
    song(2, 'Hello', 'Adele')
  ];
  assert.equal(pickBestSong(songs, { title: 'Hello', artists: ['Adele'] }).id, 2);
});

test('pickBestSong ignore les traductions Genius', () => {
  const songs = [
    song(1, 'Dynamite (Traduction française)', 'Genius Traductions françaises'),
    song(2, 'Dynamite (English Translation)', 'Genius English Translations'),
    song(3, 'Dynamite', 'BTS')
  ];
  assert.equal(pickBestSong(songs, { title: 'Dynamite', artists: ['BTS'] }).id, 3);
  assert.equal(pickBestSong(songs.slice(0, 2), { title: 'Dynamite', artists: ['BTS'] }), null);
});

test('pickBestSong refuse un résultat sans rapport', () => {
  const songs = [song(1, 'Save Your Tears', 'The Weeknd')];
  assert.equal(pickBestSong(songs, { title: 'Blinding Lights', artists: ['The Weeknd'] }), null);
});

test('pickBestSong reconnaît les featurings et les collaborations', () => {
  const songs = [song(1, 'Jumpman', 'Drake', { artist_names: 'Drake & Future' })];
  assert.equal(pickBestSong(songs, { title: 'Jumpman', artists: ['Future'] }).id, 1);
});

test('pickBestSong teste l\'ordre inversé quand le titre est "Titre - Artiste"', () => {
  const songs = [song(1, 'Papaoutai', 'Stromae')];
  assert.equal(pickBestSong(songs, { title: 'Stromae', artists: ['Papaoutai'], swappable: true }).id, 1);
  assert.equal(pickBestSong(songs, { title: 'Stromae', artists: ['Papaoutai'], swappable: false }), null);
});

test('pickBestSong marche sans artiste et garde l\'ordre de Genius en cas d\'égalité', () => {
  const songs = [song(1, 'Intro', 'A'), song(2, 'Intro', 'B')];
  assert.equal(pickBestSong(songs, { title: 'Intro', artists: [] }).id, 1);
});

test('pickBestSong compare aussi le titre Genius nettoyé', () => {
  const songs = [song(1, 'Hey Jude (Remastered 2015)', 'The Beatles')];
  assert.equal(pickBestSong(songs, { title: 'Hey Jude', artists: ['The Beatles'] }).id, 1);
});

test('pickBestSong sans résultat ni titre', () => {
  assert.equal(pickBestSong([], { title: 'x', artists: [] }), null);
  assert.equal(pickBestSong([song(1, 'x', 'y')], { title: '', artists: [] }), null);
});

test('pickBestSong fait confiance au premier résultat si le titre est exact', () => {
  // Chaîne de label prise pour l'artiste.
  const songs = [song(1, 'Blinding Lights', 'The Weeknd'), song(2, 'Blinding Lights', 'Cover Band')];
  assert.equal(pickBestSong(songs, { title: 'Blinding Lights', artists: ['Lyrical Lemonade'] }).id, 1);
});

test('pickBestSong ne prend pas un autre artiste avec un titre seulement proche', () => {
  const songs = [song(1, 'Hello World', 'Someone Else')];
  assert.equal(pickBestSong(songs, { title: 'Hello', artists: ['Adele'] }), null);
});

const { searchQueries } = require('../lib/match.js');

test('extractSongHits ignore la section "lyric" (mots trouvés dans les paroles)', () => {
  const json = multi({ type: 'lyric', hits: [{ type: 'song', result: song(7, 'Tracklist', 'X') }] });
  assert.deepEqual(extractSongHits(json), []);
});

test('searchQueries', () => {
  assert.deepEqual(searchQueries({ title: 'Song', artists: ['A'] }), ['Song A', 'Song']);
  assert.deepEqual(searchQueries({ title: 'Song', artists: ['A & B', 'A', 'B'] }), ['Song A & B', 'Song A', 'Song']);
  assert.deepEqual(searchQueries({ title: 'Song', artists: [] }), ['Song']);
  assert.deepEqual(searchQueries({ title: '', artists: ['A'] }), []);
});
