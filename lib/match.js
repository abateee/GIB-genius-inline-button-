/*
 * Picks the right Genius song among search results. Pure functions, shared by
 * the background (which calls the Genius search) and the content script
 * (which only needs the fallback search URL). Unit tested with Node.
 */
(function (root, factory) {
  const parse = typeof module === 'object' && module.exports ? require('./parse.js') : root.GIBParse;
  const api = factory(parse);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GIBMatch = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (parse) {
  const GENIUS_ORIGIN = 'https://genius.com';
  const MIN_TITLE_SCORE = 0.5;
  // A perfect title with an unknown artist scores 0.6: not enough on its own.
  const MIN_TOTAL_SCORE = 0.65;

  function searchApiUrl(query) {
    return `${GENIUS_ORIGIN}/api/search/multi?per_page=5&q=${encodeURIComponent(query)}`;
  }

  /** Genius' own search page: the safe fallback when nothing reliable is found. */
  function searchUrl(query) {
    return `${GENIUS_ORIGIN}/search?q=${encodeURIComponent(query || '')}`;
  }

  function isGeniusUrl(url) {
    return typeof url === 'string' && /^https:\/\/genius\.com\/[^\s]+$/.test(url);
  }

  function normalize(value) {
    return String(value || '')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[’'`´]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
      .replace(/^the\s+/, '');
  }

  function tokens(value) {
    return normalize(value).split(' ').filter(Boolean);
  }

  /** 1 = same, 0.85 = one contains the other, otherwise token overlap (Dice). */
  function similarity(a, b) {
    const na = normalize(a);
    const nb = normalize(b);
    if (!na || !nb) return 0;
    const ca = na.replace(/ /g, '');
    const cb = nb.replace(/ /g, '');
    if (na === nb || ca === cb) return 1;
    const shorter = ca.length < cb.length ? ca : cb;
    if (shorter.length >= 3 && (ca.includes(cb) || cb.includes(ca))) return 0.85;
    const ta = new Set(tokens(a));
    const tb = new Set(tokens(b));
    let common = 0;
    for (const t of ta) if (tb.has(t)) common += 1;
    return (2 * common) / (ta.size + tb.size);
  }

  /** Song results from /api/search/multi, best ranked first, without duplicates. */
  function extractSongHits(json) {
    const sections = json && json.response && Array.isArray(json.response.sections)
      ? json.response.sections
      : [];
    const seen = new Set();
    const songs = [];
    for (const section of sections) {
      for (const hit of (section && Array.isArray(section.hits) ? section.hits : [])) {
        const result = hit && hit.result;
        if (!hit || hit.type !== 'song' || !result || !isGeniusUrl(result.url)) continue;
        const key = result.id || result.url;
        if (seen.has(key)) continue;
        seen.add(key);
        songs.push(result);
      }
    }
    return songs;
  }

  // "Genius English Translations", "Genius Traductions françaises", "Genius Romanizations"...
  function isGeniusTranslation(song) {
    const name = song && song.primary_artist && song.primary_artist.name;
    return /^genius\b/i.test(String(name || ''));
  }

  function artistCandidates(song) {
    const names = [];
    if (song.primary_artist && song.primary_artist.name) names.push(song.primary_artist.name);
    if (song.artist_names) {
      names.push(song.artist_names);
      names.push(...parse.splitNames(String(song.artist_names).replace(/[()]/g, ' ')));
    }
    return names;
  }

  function scoreFor(song, title, artists) {
    const songTitle = String(song.title || '');
    const titleScore = Math.max(
      similarity(title, songTitle),
      similarity(title, parse.cleanTitle(songTitle).title)
    );
    if (!artists.length) return { total: titleScore, titleScore };

    const candidates = artistCandidates(song);
    let artistScore = 0;
    for (const artist of artists) {
      for (const candidate of candidates) {
        artistScore = Math.max(artistScore, similarity(artist, candidate));
      }
    }
    return { total: 0.6 * titleScore + 0.4 * artistScore, titleScore };
  }

  /**
   * Returns the best matching song or null when nothing is reliable enough.
   * ctx: { title, artists, swappable }. With swappable, "Song - Artist" uploads
   * are also tried the other way around.
   */
  function pickBestSong(songs, ctx) {
    const title = (ctx && ctx.title) || '';
    const artists = ((ctx && ctx.artists) || []).filter(Boolean);
    if (!title || !Array.isArray(songs) || !songs.length) return null;

    const readings = [{ title, artists }];
    if (ctx.swappable && artists.length) readings.push({ title: artists[0], artists: [title] });
    const wantsTranslation = artists.some(a => /^genius\b/i.test(a));

    let best = null;
    let bestScore = 0;
    for (const song of songs) {
      if (isGeniusTranslation(song) && !wantsTranslation) continue;
      for (const reading of readings) {
        const { total, titleScore } = scoreFor(song, reading.title, reading.artists);
        if (titleScore < MIN_TITLE_SCORE || total < MIN_TOTAL_SCORE) continue;
        // Strictly greater: on a tie, Genius' own ranking wins.
        if (total > bestScore) {
          best = song;
          bestScore = total;
        }
      }
    }
    if (best) return best;

    // The artist we guessed can be wrong (label channel, compilation...). Genius
    // already ranked the results with the full query, so its first song is
    // trusted when its title is an exact match.
    const first = songs.find(s => !isGeniusTranslation(s) || wantsTranslation);
    if (first && similarity(title, first.title) === 1) return first;
    return null;
  }

  return {
    GENIUS_ORIGIN, searchApiUrl, searchUrl, isGeniusUrl, normalize, similarity,
    extractSongHits, isGeniusTranslation, pickBestSong
  };
});
