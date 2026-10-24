/*
 * Pure helpers that turn the raw text shown by a site into a clean
 * { title, artists } pair. No DOM access here so it can be unit tested
 * with Node and shared between the content script and the background.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GIBParse = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // Words that, when found inside (...) or [...], mean the bracket is noise
  // about the upload (video type, quality, version) and not part of the song name.
  const JUNK_WORDS = [
    'official', 'officiel', 'officielle', 'oficial',
    'video', 'vidéo', 'clip', 'audio', 'lyrics?', 'paroles', 'letra',
    'visuali[sz]er', 'visualiseur', 'mv', 'm/v', 'music video',
    'hd', 'hq', '4k', '1080p', '720p', 'explicit', 'clean', 'uncensored',
    'remaster(?:ed)?', 'live', 'en direct', 'performance', 'session',
    'slowed', 'sped up', 'reverb', 'nightcore', '8d',
    'radio edit', 'extended', 'acoustic', 'version', 'color coded', 'teaser'
  ];
  const JUNK_RE = new RegExp('(?:^|[^\\p{L}\\p{N}])(?:' + JUNK_WORDS.join('|') + ')(?:$|[^\\p{L}\\p{N}])', 'iu');
  const BRACKETS_RE = /\s*(?:\(([^()]*)\)|\[([^\[\]]*)\]|【([^【】]*)】)\s*/g;
  const FEAT_WORD = '(?:feat\\.?|ft\\.?|featuring)';
  // In brackets YouTube Music also localizes "with": "(avec X et Y)", "(con X y Y)", "(mit X und Y)".
  const FEAT_BRACKET_RE = new RegExp('^\\s*(?:' + FEAT_WORD + '|with|avec|con|mit|com|met)\\s+(.+)$', 'i');
  // Inline featuring runs until the next "Artist - Song" separator or the end.
  const FEAT_INLINE_RE = new RegExp('\\s+' + FEAT_WORD + '\\s+(.+?)(?=\\s+[-–—]\\s+|$)', 'i');
  const PROD_BRACKET_RE = /^\s*prod\.?(?:\s*by)?\s+/i;
  const PROD_INLINE_RE = /\s+prod\.?\s*(?:by\s+)?\S.*$/i;
  // Same noise without brackets, only at the very end: "Song Official Video".
  const TRAILING_JUNK_RE = /\s+(?:official\s+(?:music\s+)?(?:video|audio|mv|lyric video)|clip\s+officiel|audio\s+officiel|official\s+mv|lyric\s+video|m\/?v)\s*$/i;
  // "Artist - Song": spaced hyphen, en dash or em dash. "Jay-Z" is not split.
  const SEPARATOR_RE = /\s+[-–—]\s+/;

  function collapse(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function trimEdges(value) {
    return collapse(value).replace(/^[\s\-–—|:,~]+|[\s\-–—|:,~]+$/g, '');
  }

  function splitNames(value) {
    return collapse(value)
      .split(/\s*(?:,|&|\s[x×]\s|\svs\.?\s|\s(?:feat\.?|ft\.?|featuring)\s)\s*/i)
      .map(trimEdges)
      .filter(Boolean);
  }

  /**
   * Removes upload noise from a title and pulls out featured artists.
   * Keeps brackets that are really part of the song name
   * ("(I Can't Get No) Satisfaction").
   */
  function cleanTitle(raw = '') {
    const featured = [];
    let value = String(raw)
      .replace(/\s*[-–—|]\s*YouTube(?:\s*Music)?$/i, '')
      .replace(/\s*[|]\s*Spotify$/i, '')
      .replace(/\p{Extended_Pictographic}|️/gu, ' ')
      .replace(/(^|\s)#[\p{L}\p{N}_]+/gu, ' ');

    // "Artist - Song | A COLORS SHOW", "Song // Lyrics": the tail is noise.
    value = value.split(/\s+(?:\||｜|\/\/)\s+/)[0];

    value = value.replace(BRACKETS_RE, (match, a, b, c) => {
      const inner = collapse(a ?? b ?? c ?? '');
      const feat = inner.match(FEAT_BRACKET_RE);
      if (feat) {
        featured.push(...splitNames(feat[1]).flatMap(name => name.split(/\s+(?:and|et|y|und|e|en)\s+/i)));
        return ' ';
      }
      if (PROD_BRACKET_RE.test(inner)) return ' ';
      if (!inner || JUNK_RE.test(inner)) return ' ';
      return match;
    });

    const inlineFeat = value.match(FEAT_INLINE_RE);
    if (inlineFeat) {
      featured.push(...splitNames(inlineFeat[1].replace(PROD_INLINE_RE, '')));
      value = value.slice(0, inlineFeat.index) + value.slice(inlineFeat.index + inlineFeat[0].length);
    }
    value = value.replace(PROD_INLINE_RE, '').replace(TRAILING_JUNK_RE, '');

    return { title: trimEdges(value), featured: unique(featured) };
  }

  function cleanupTitle(raw = '') {
    return cleanTitle(raw).title;
  }

  function unique(list) {
    const seen = new Set();
    const out = [];
    for (const item of list || []) {
      const value = collapse(item);
      const key = value.toLowerCase();
      if (!value || seen.has(key)) continue;
      seen.add(key);
      out.push(value);
    }
    return out;
  }

  /**
   * "TaylorSwiftVEVO" -> Taylor Swift, "Daft Punk - Topic" -> Daft Punk,
   * "Stromae Officiel" -> Stromae.
   */
  function cleanChannelName(raw = '') {
    let name = collapse(raw);
    const isTopic = /\s+-\s+Topic$/i.test(name);
    const isVevo = /VEVO$/i.test(name);
    name = name.replace(/\s+-\s+Topic$/i, '');
    if (isVevo) {
      name = name.replace(/\s*VEVO$/i, '');
      if (!/\s/.test(name)) name = name.replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2');
    }
    name = name.replace(/\s*[-|]?\s*(?:official(?:\s+(?:artist\s+)?channel)?|officiel(?:le)?|oficial)$/i, '');
    return { name: trimEdges(name), isTopic, isVevo };
  }

  function stripArtistNoise(value) {
    // "BTS (방탄소년단)" or "Artist [Official]": brackets on the artist side are never useful.
    return trimEdges(collapse(value).replace(/\s*(?:\([^()]*\)|\[[^\[\]]*\]|【[^【】]*】)\s*/g, ' '));
  }

  function artistsFrom(artistSide, ...featuredLists) {
    const cleaned = cleanTitle(artistSide);
    const full = stripArtistNoise(cleaned.title);
    return unique([full, ...splitNames(full), ...cleaned.featured, ...featuredLists.flat()]);
  }

  /**
   * YouTube puts the real artist in the video title most of the time
   * ("Artist - Song"), the channel can be a label, a VEVO or a Topic channel.
   * `swappable` tells the matcher that artist and title may be inverted.
   */
  function parseYouTube(rawTitle = '', rawChannel = '') {
    const channel = cleanChannelName(rawChannel);
    const { title: cleaned, featured } = cleanTitle(rawTitle);

    if (channel.isTopic) {
      return { title: cleaned, artists: artistsFrom(channel.name, featured), swappable: false };
    }

    const cjk = cleaned.match(/^(.+?)\s*[「『](.+?)[」』]/);
    if (cjk) {
      const song = cleanTitle(cjk[2]);
      return { title: song.title, artists: artistsFrom(cjk[1], featured, song.featured), swappable: false };
    }

    const sep = cleaned.match(SEPARATOR_RE);
    if (sep) {
      const left = cleaned.slice(0, sep.index);
      const right = cleanTitle(cleaned.slice(sep.index + sep[0].length));
      if (left && right.title) {
        return { title: right.title, artists: artistsFrom(left, featured, right.featured), swappable: true };
      }
    }

    const quoted = cleaned.match(/^(.+?)\s['"“‘«]\s*(\S.*?)\s*['"”’»](?:\s|$)/);
    if (quoted) {
      const song = cleanTitle(quoted[2]);
      return { title: song.title, artists: artistsFrom(quoted[1], featured, song.featured), swappable: false };
    }

    return { title: cleaned, artists: artistsFrom(channel.name, featured), swappable: false };
  }

  /**
   * YouTube Music shows a clean title and a byline like
   * "Artist, Other • Album • 2013" (or "Artist • 12M views" for videos).
   * Only artist links should be used, the album and the year are noise.
   */
  function parseYouTubeMusic(rawTitle = '', artistNames = [], bylineText = '') {
    const { title, featured } = cleanTitle(rawTitle);
    let names = unique(artistNames);
    if (!names.length) {
      const first = trimEdges(String(bylineText).split('•')[0]);
      names = first ? unique([first, ...splitNames(first)]) : [];
    }
    return { title, artists: unique([...names, ...featured]), swappable: false };
  }

  // Spotify appends versions after a dash: "Song - Remastered 2011", "Song - Live",
  // "Song - From \"Movie\"". The dash is never an artist separator there.
  const SPOTIFY_VERSION_RE = /\s+-\s+(?:.*\b(?:remaster(?:ed)?|live|edit|version|mix|mono|stereo|acoustic|demo|bonus|instrumental|sped up|slowed|re-?recorded|deluxe|single|radio|extended|original|from|bande originale|soundtrack)\b.*|\d{4})$/i;

  function parseSpotify(rawTitle = '', artistNames = []) {
    const { title, featured } = cleanTitle(String(rawTitle).replace(SPOTIFY_VERSION_RE, ''));
    return { title, artists: unique([...artistNames, ...featured]), swappable: false };
  }

  const MUSIC_TITLE_RE = /(?:^|[^\p{L}])(?:official|officiel(?:le)?|oficial|clip|lyrics?|paroles|letra|audio|visuali[sz]er|visualiseur|m\/?v|feat\.?|ft\.|prod\.|remix|cover|freestyle|music video|acoustic|unplugged)(?:$|[^\p{L}])/iu;
  const MUSIC_CHANNEL_RE = /(?:records|recordings|music|musique|lyrics|vevo|entertainment|labels?)$|\s+-\s+Topic$/i;

  /**
   * Heuristic used on YouTube, where most videos are not songs. It errs on the
   * side of showing the button: a wrong button is cheaper than a missing one.
   */
  function isLikelyMusicVideo(rawTitle = '', rawChannel = '') {
    const title = collapse(rawTitle);
    const channel = collapse(rawChannel);
    if (!title) return false;
    if (MUSIC_CHANNEL_RE.test(channel)) return true;
    if (MUSIC_TITLE_RE.test(title)) return true;
    if (SEPARATOR_RE.test(title)) return true;
    if (/[「『].+[」』]/.test(title)) return true;
    if (/\s['"“‘«]\s*\S.*?['"”’»](?:\s|$)/.test(title)) return true;
    return false;
  }

  /** Genius search works best with the song title plus the main artist only. */
  function buildQuery(ctx) {
    const parts = [];
    if (ctx && ctx.title) parts.push(ctx.title);
    if (ctx && ctx.artists && ctx.artists.length) parts.push(ctx.artists[0]);
    return collapse(parts.join(' '));
  }

  return {
    collapse, trimEdges, splitNames, cleanTitle, cleanupTitle, unique,
    cleanChannelName, parseYouTube, parseYouTubeMusic, parseSpotify, isLikelyMusicVideo, buildQuery
  };
});
