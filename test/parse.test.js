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

test('buildQuery assemble le titre et l\'artiste principal', () => {
  assert.equal(buildQuery({ title: 'Song', artists: ['A & B', 'A', 'B'] }), 'Song A & B');
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

const { cleanChannelName, parseYouTube } = require('../lib/parse.js');

test('cleanTitle retire les mentions de clip sans parenthèses en fin de titre', () => {
  assert.equal(cleanTitle('Song Official Video').title, 'Song');
  assert.equal(cleanTitle('Song Clip Officiel').title, 'Song');
  assert.equal(cleanTitle('Song MV').title, 'Song');
});

test('cleanChannelName nettoie VEVO, Topic et Official', () => {
  assert.deepEqual(cleanChannelName('TaylorSwiftVEVO'), { name: 'Taylor Swift', isTopic: false, isVevo: true });
  assert.deepEqual(cleanChannelName('ACDCVEVO'), { name: 'ACDC', isTopic: false, isVevo: true });
  assert.deepEqual(cleanChannelName('Daft Punk - Topic'), { name: 'Daft Punk', isTopic: true, isVevo: false });
  assert.equal(cleanChannelName('Stromae Officiel').name, 'Stromae');
  assert.equal(cleanChannelName('Nirvana Official').name, 'Nirvana');
  assert.equal(cleanChannelName('Lyrical Lemonade').name, 'Lyrical Lemonade');
});

test('parseYouTube prend l\'artiste dans le titre "Artiste - Titre"', () => {
  const r = parseYouTube('The Weeknd - Blinding Lights (Official Video)', 'TheWeekndVEVO');
  assert.equal(r.title, 'Blinding Lights');
  assert.equal(r.artists[0], 'The Weeknd');
  assert.equal(r.swappable, true);
});

test('parseYouTube gère les tirets demi-cadratin et cadratin', () => {
  assert.equal(parseYouTube('Stromae – Papaoutai', 'x').title, 'Papaoutai');
  assert.equal(parseYouTube('Stromae — Papaoutai', 'x').artists[0], 'Stromae');
});

test('parseYouTube ne coupe pas les traits d\'union collés', () => {
  const r = parseYouTube('Jay-Z Song', 'JayZVEVO');
  assert.equal(r.title, 'Jay-Z Song');
  assert.equal(r.artists[0], 'Jay Z');
});

test('parseYouTube garde la chaîne comme artiste sur un label sans séparateur', () => {
  const r = parseYouTube('Blinding Lights (Official Video)', 'The Weeknd');
  assert.deepEqual(r, { title: 'Blinding Lights', artists: ['The Weeknd'], swappable: false });
});

test('parseYouTube utilise la chaîne Topic telle quelle', () => {
  const r = parseYouTube('Get Lucky - Radio Edit', 'Daft Punk - Topic');
  assert.equal(r.title, 'Get Lucky - Radio Edit');
  assert.equal(r.artists[0], 'Daft Punk');
});

test('parseYouTube récupère les featurings des deux côtés', () => {
  const r = parseYouTube('Drake ft. Rihanna - Take Care (Official Video)', 'DrakeVEVO');
  assert.equal(r.title, 'Take Care');
  assert.deepEqual(r.artists, ['Drake', 'Rihanna']);
  const r2 = parseYouTube('Daft Punk - Get Lucky (feat. Pharrell Williams)', 'Daft Punk');
  assert.deepEqual(r2.artists, ['Daft Punk', 'Pharrell Williams']);
});

test('parseYouTube sépare les collaborations', () => {
  const r = parseYouTube('Drake x Future - Jumpman', 'Drake');
  assert.deepEqual(r.artists, ['Drake x Future', 'Drake', 'Future']);
});

test('parseYouTube gère Artiste \'Titre\' et Artiste「Titre」', () => {
  const r = parseYouTube("BTS (방탄소년단) 'Dynamite' Official MV", 'HYBE LABELS');
  assert.equal(r.title, 'Dynamite');
  assert.equal(r.artists[0], 'BTS');
  const r2 = parseYouTube('YOASOBI「アイドル」 Official Music Video', 'Ayase / YOASOBI');
  assert.equal(r2.title, 'アイドル');
  assert.equal(r2.artists[0], 'YOASOBI');
  const r3 = parseYouTube('Nekfeu "On verra"', 'Nekfeu');
  assert.equal(r3.title, 'On verra');
});

test('parseYouTube ne prend pas une apostrophe pour une citation', () => {
  const r = parseYouTube("Don't Stop Me Now", 'Queen Official');
  assert.deepEqual(r, { title: "Don't Stop Me Now", artists: ['Queen'], swappable: false });
});

test('parseYouTube gère le format COLORS', () => {
  const r = parseYouTube('Arlo Parks - Black Dog | A COLORS SHOW', 'COLORS');
  assert.equal(r.title, 'Black Dog');
  assert.equal(r.artists[0], 'Arlo Parks');
});

const { parseYouTubeMusic } = require('../lib/parse.js');

test('parseYouTubeMusic garde les artistes passés et nettoie le titre', () => {
  const r = parseYouTubeMusic('Get Lucky (feat. Pharrell Williams)', ['Daft Punk'], 'Daft Punk • Random Access Memories • 2013');
  assert.deepEqual(r, { title: 'Get Lucky', artists: ['Daft Punk', 'Pharrell Williams'], swappable: false });
});

test('parseYouTubeMusic se rabat sur la ligne d\'artistes sans lien', () => {
  const r = parseYouTubeMusic('Song (Official Video)', [], 'A & B • 12 M de vues • 100 k J\'aime');
  assert.deepEqual(r.artists, ['A & B', 'A', 'B']);
  assert.equal(r.title, 'Song');
});

test('parseYouTubeMusic sans rien en lecture', () => {
  assert.deepEqual(parseYouTubeMusic('', [], ''), { title: '', artists: [], swappable: false });
});

const { parseSpotify } = require('../lib/parse.js');

test('parseSpotify retire les versions après le tiret', () => {
  const cases = {
    'Bohemian Rhapsody - Remastered 2011': 'Bohemian Rhapsody',
    'Wonderwall - 2014 Remaster': 'Wonderwall',
    'Hey Jude - Live': 'Hey Jude',
    'Let It Go - From "Frozen"': 'Let It Go',
    'Song - Radio Edit': 'Song',
    'Song - Mono Version': 'Song',
    'Song - 2009': 'Song'
  };
  for (const [raw, expected] of Object.entries(cases)) {
    assert.equal(parseSpotify(raw, ['A']).title, expected, raw);
  }
});

test('parseSpotify garde un tiret qui fait partie du titre', () => {
  assert.equal(parseSpotify('Sign - O - The Times', ['Prince']).title, 'Sign - O - The Times');
  assert.equal(parseSpotify('Song - X Remix', ['A']).title, 'Song - X Remix');
});

test('parseSpotify ajoute les featurings aux artistes', () => {
  assert.deepEqual(parseSpotify('Song (feat. B)', ['A']), { title: 'Song', artists: ['A', 'B'], swappable: false });
  assert.deepEqual(parseSpotify('Song (with B)', ['A', 'B']).artists, ['A', 'B']);
});

const { isLikelyMusicVideo } = require('../lib/parse.js');

test('isLikelyMusicVideo reconnaît les clips', () => {
  assert.ok(isLikelyMusicVideo('The Weeknd - Blinding Lights', 'The Weeknd'));
  assert.ok(isLikelyMusicVideo('Blinding Lights (Official Video)', 'The Weeknd'));
  assert.ok(isLikelyMusicVideo('Blinding Lights', 'TheWeekndVEVO'));
  assert.ok(isLikelyMusicVideo('Blinding Lights', 'The Weeknd - Topic'));
  assert.ok(isLikelyMusicVideo('Song', 'Universal Music'));
  assert.ok(isLikelyMusicVideo("BTS (방탄소년단) 'Dynamite'", 'HYBE LABELS'));
  assert.ok(isLikelyMusicVideo('YOASOBI「アイドル」', 'Ayase / YOASOBI'));
  assert.ok(isLikelyMusicVideo('Song [Clip Officiel]', 'Artiste'));
  assert.ok(isLikelyMusicVideo('Song ft. Someone', 'Artiste'));
});

test('isLikelyMusicVideo écarte les vidéos classiques', () => {
  assert.equal(isLikelyMusicVideo('Comment installer Docker sur Windows', 'Grafikart'), false);
  assert.equal(isLikelyMusicVideo("I Don't Know What To Do", 'Some Vlogger'), false);
  assert.equal(isLikelyMusicVideo('', 'TheWeekndVEVO'), false);
});

test('cleanTitle comprend les featurings traduits par YouTube Music', () => {
  assert.deepEqual(
    cleanTitle('Get Lucky (Official Audio) (avec Pharrell Williams et Nile Rodgers)'),
    { title: 'Get Lucky', featured: ['Pharrell Williams', 'Nile Rodgers'] }
  );
  assert.deepEqual(cleanTitle('Song (with A and B)').featured, ['A', 'B']);
  assert.deepEqual(cleanTitle('Canción (con A y B)').featured, ['A', 'B']);
  assert.deepEqual(cleanTitle('Lied (mit A und B)').featured, ['A', 'B']);
});

test('cleanTitle ne coupe pas un nom en dehors des featurings', () => {
  assert.equal(cleanTitle('Simon and Garfunkel - Song').title, 'Simon and Garfunkel - Song');
  assert.deepEqual(parseYouTube('Simon & Garfunkel - The Boxer', 'x').artists[0], 'Simon & Garfunkel');
});
