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
  function collapse(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function cleanupTitle(raw = '') {
    return collapse(String(raw)
      .replace(/\s*[-–—|]\s*YouTube(?:\s*Music)?$/i, '')
      .replace(/\s*[|]\s*Spotify$/i, '')
      .replace(/\s*\((official|official video|official audio|lyrics?|audio|video|visualizer|mv|hd|4k)\)\s*/ig, ' ')
      .replace(/\s*\[(official|official video|official audio|lyrics?|audio|video|visualizer|mv|hd|4k)\]\s*/ig, ' '));
  }

  function unique(list) {
    return [...new Set((list || []).filter(Boolean).map(s => String(s).trim()).filter(Boolean))];
  }

  function buildQuery(ctx) {
    const parts = [];
    if (ctx && ctx.title) parts.push(ctx.title);
    if (ctx && ctx.artists && ctx.artists.length) parts.push(ctx.artists.join(' '));
    return parts.join(' ').trim();
  }

  return { collapse, cleanupTitle, unique, buildQuery };
});
