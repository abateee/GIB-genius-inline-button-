/*
 * Resolves the Genius page in the background and opens it in a new tab.
 * Doing it here avoids two problems of the content script:
 *  - a page cannot call genius.com/api (CORS), the extension can (host permission);
 *  - a window.open() after an async request gets caught by the popup blocker,
 *    tabs.create() does not.
 *
 * Chrome runs this file as a service worker (importScripts below), Firefox as a
 * background script with lib/*.js listed before it in the manifest.
 */
if (typeof importScripts === 'function' && typeof GIBMatch === 'undefined') {
  importScripts('lib/parse.js', 'lib/match.js');
}

const ext = globalThis.browser ?? globalThis.chrome;
// Total budget for all queries: the page gives up after 4.5 s (popup window).
const SEARCH_BUDGET_MS = 3500;
const CACHE_MAX = 200;
const cache = new Map();

function sanitizeContext(raw) {
  const str = (value, max) => (typeof value === 'string' ? value.slice(0, max).trim() : '');
  const ctx = raw && typeof raw === 'object' ? raw : {};
  return {
    title: str(ctx.title, 300),
    artists: (Array.isArray(ctx.artists) ? ctx.artists : []).slice(0, 10).map(a => str(a, 200)).filter(Boolean),
    swappable: ctx.swappable === true
  };
}

function remember(key, url) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, url);
}

async function searchGenius(query, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(GIBMatch.searchApiUrl(query), {
      signal: controller.signal,
      credentials: 'omit',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`Genius search HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Always resolves to a genius.com URL: the song page, or the search page as a fallback. */
async function resolveUrl(ctx) {
  const query = GIBParse.buildQuery(ctx);
  const fallback = GIBMatch.searchUrl(query);
  if (!query) return { url: fallback, matched: false };

  const key = JSON.stringify([ctx.title, ctx.artists, ctx.swappable]).toLowerCase();
  if (cache.has(key)) return { url: cache.get(key), matched: true };

  const deadline = Date.now() + SEARCH_BUDGET_MS;
  for (const candidate of GIBMatch.searchQueries(ctx)) {
    const remaining = deadline - Date.now();
    if (remaining < 300) break;
    try {
      const json = await searchGenius(candidate, remaining);
      const best = GIBMatch.pickBestSong(GIBMatch.extractSongHits(json), ctx);
      if (best && GIBMatch.isGeniusUrl(best.url)) {
        remember(key, best.url);
        return { url: best.url, matched: true };
      }
    } catch (error) {
      // Network error, timeout, Cloudflare page, format change: retrying won't help,
      // the search page still works.
      console.warn('[GIB] Genius search failed, falling back to the search page.', error);
      break;
    }
  }
  return { url: fallback, matched: false };
}

async function openFor(message, sender) {
  const ctx = sanitizeContext(message.ctx);
  const { url, matched } = await resolveUrl(ctx);
  const tab = sender.tab;
  const props = { url, active: message.background !== true };
  if (tab) {
    props.index = tab.index + 1;
    props.windowId = tab.windowId;
    props.openerTabId = tab.id;
  }
  try {
    await ext.tabs.create(props);
    return { ok: true, url, matched };
  } catch (error) {
    // Some contexts (e.g. a private window not allowed for the extension)
    // refuse tabs.create: let the page open it itself.
    console.warn('[GIB] tabs.create failed, letting the page open the tab.', error);
    return { ok: false, url, matched };
  }
}

ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'gib:open' || sender.id !== ext.runtime.id) return false;
  openFor(message, sender)
    .then(sendResponse)
    .catch(() => sendResponse({ ok: false }));
  return true; // keep the channel open for the async answer
});
