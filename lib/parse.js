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
  const FEAT_BRACKET_RE = new RegExp('^\\s*(?:' + FEAT_WORD + '|with)\\s+(.+)$', 'i');
  const FEAT_INLINE_RE = new RegExp('\\s+' + FEAT_WORD + '\\s+(.+)$', 'i');
  const PROD_BRACKET_RE = /^\s*prod\.?(?:\s*by)?\s+/i;
  const PROD_INLINE_RE = /\s+prod\.?\s*(?:by\s+)?\S.*$/i;

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
        featured.push(...splitNames(feat[1]));
        return ' ';
      }
      if (PROD_BRACKET_RE.test(inner)) return ' ';
      if (!inner || JUNK_RE.test(inner)) return ' ';
      return match;
    });

    const inlineFeat = value.match(FEAT_INLINE_RE);
    if (inlineFeat) {
      featured.push(...splitNames(inlineFeat[1].replace(PROD_INLINE_RE, '')));
      value = value.slice(0, inlineFeat.index);
    }
    value = value.replace(PROD_INLINE_RE, '');

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

  function buildQuery(ctx) {
    const parts = [];
    if (ctx && ctx.title) parts.push(ctx.title);
    if (ctx && ctx.artists && ctx.artists.length) parts.push(ctx.artists.join(' '));
    return parts.join(' ').trim();
  }

  return { collapse, trimEdges, splitNames, cleanTitle, cleanupTitle, unique, buildQuery };
});
