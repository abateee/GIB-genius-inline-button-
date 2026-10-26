// Matching against real Genius search answers (test/fixtures/genius-search.json).
const test = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('./fixtures/genius-search.json');
const { parseYouTube, parseYouTubeMusic, parseSpotify } = require('../lib/parse.js');
const { extractSongHits, pickBestSong, searchQueries } = require('../lib/match.js');

function pick(query, ctx) {
  return pickBestSong(extractSongHits(fixtures[query]), ctx);
}

test('vrai cas YouTube : Daft Punk - Get Lucky (Official Audio) ft. ...', () => {
  const ctx = parseYouTube('Daft Punk - Get Lucky (Official Audio) ft. Pharrell Williams, Nile Rodgers', 'Daft Punk');
  assert.equal(searchQueries(ctx)[0], 'Get Lucky Daft Punk');
  assert.equal(pick('Get Lucky Daft Punk', ctx).url, 'https://genius.com/Daft-punk-get-lucky-lyrics');
});

test('vrai cas YouTube Music : titre traduit "(avec X et Y)"', () => {
  const ctx = parseYouTubeMusic('Get Lucky (Official Audio) (avec Pharrell Williams et Nile Rodgers)', ['Daft Punk'], '');
  assert.equal(pick('Get Lucky Daft Punk', ctx).id, 139968);
});

test('la version originale passe avant remix et live', () => {
  const ctx = parseYouTube('The Weeknd - Blinding Lights (Official Video)', 'TheWeekndVEVO');
  assert.equal(pick('Blinding Lights The Weeknd', ctx).id, 5049949);
});

test('la traduction Genius anglaise est écartée', () => {
  assert.equal(pick('Papaoutai Stromae', { title: 'Papaoutai', artists: ['Stromae'] }).id, 150485);
});

test('le titre japonais avec "(Idol)" chez Genius, pas la reprise classée première', () => {
  const ctx = parseYouTube('YOASOBI「アイドル」 Official Music Video', 'Ayase / YOASOBI');
  assert.equal(pick('アイドル YOASOBI', ctx).id, 8842895);
});

test('Spotify "- Remastered 2011" retombe sur l\'original de Queen', () => {
  const ctx = parseSpotify('Bohemian Rhapsody - Remastered 2011', ['Queen']);
  assert.equal(pick('Bohemian Rhapsody Queen', ctx).id, 1063);
});

test('"Drake x Future" : rien de fiable, une recherche plus simple est prévue', () => {
  const ctx = parseYouTube('Drake x Future - Jumpman', 'Drake');
  assert.equal(pick('Jumpman Drake x Future', ctx), null);
  assert.deepEqual(searchQueries(ctx), ['Jumpman Drake x Future', 'Jumpman Drake', 'Jumpman']);
});

test('"Jumpman Drake" (2e recherche) trouve le morceau de Drake & Future', () => {
  const ctx = parseYouTube('Drake x Future - Jumpman', 'Drake');
  assert.equal(pick('Jumpman Drake', ctx).id, 2311373);
});

test('un résultat "index: lyric" dans top_hit est ignoré', () => {
  assert.deepEqual(extractSongHits(fixtures['Jumpman Drake']).map(s => s.id), [2311373]);
});

test('vrai cas YouTube : "Love Is A State" sur la chaîne auto-générée de Bladee', () => {
  const ctx = parseYouTube('Love Is A State', 'Bladee', {
    card: { title: 'Love Is A State', artist: 'Bladee' },
    description: 'Provided to YouTube by The Orchard Enterprises\n\nLove Is A State · Bladee · Benjamin Reichwald · Arthur Nyqvist · Axel Tufvesson'
  });
  assert.equal(searchQueries(ctx)[0], 'Love Is A State Bladee');
  assert.equal(pick('Love Is A State Bladee', ctx).url, 'https://genius.com/Bladee-love-is-a-state-lyrics');
});
