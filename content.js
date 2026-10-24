(() => {
  const { buildQuery } = globalThis.GIBParse;
  const SLOT_ATTR = 'data-genius-inline-slot';
  const RENDER_DELAY_MS = 120;
  const SVG_LOGO = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="genius-inline-btn__logo">
      <path fill="currentColor" d="M4 4h16v3H7v3h10v3H7v4h13v3H4z"></path>
    </svg>`;

  let slot = null;
  let renderTimer = 0;

  function site() {
    const host = location.hostname;
    if (host === 'www.youtube.com') return 'youtube';
    if (host === 'music.youtube.com') return 'ytmusic';
    if (host === 'open.spotify.com') return 'spotify';
    return 'other';
  }

  function text(el) {
    return globalThis.GIBParse.collapse(el?.textContent);
  }

  function getYouTubeContext() {
    // YouTube keeps the last watch page hidden in the DOM when you go back to
    // the home page or open a Short: only real watch pages get a button.
    if (location.pathname !== '/watch') return null;

    const titleNode = document.querySelector('ytd-watch-metadata h1 yt-formatted-string')
      || document.querySelector('h1.ytd-watch-metadata yt-formatted-string')
      || document.querySelector('h1.title yt-formatted-string');

    // "#channel-name" alone also matches every recommended video in the sidebar.
    const artistNode = document.querySelector('ytd-watch-metadata ytd-channel-name a')
      || document.querySelector('#owner #channel-name a');

    if (!titleNode) return null;

    const rawTitle = text(titleNode);
    const rawChannel = text(artistNode);
    if (!globalThis.GIBParse.isLikelyMusicVideo(rawTitle, rawChannel)) return null;

    const parsed = globalThis.GIBParse.parseYouTube(rawTitle, rawChannel);
    return {
      titleNode,
      title: parsed.title,
      artists: parsed.artists,
      swappable: parsed.swappable,
      compact: false
    };
  }

  function getYouTubeMusicContext() {
    const titleNode = document.querySelector('ytmusic-player-bar .title')
      || document.querySelector('ytmusic-player-bar .content-info-wrapper .title');

    const byline = document.querySelector('ytmusic-player-bar .byline');
    // The byline also links the album ("browse/MPRE...") : keep artist channels only.
    const artistNodes = [...(byline?.querySelectorAll('a') || [])]
      .filter(a => /(^|\/)channel\//.test(a.getAttribute('href') || ''));

    if (!titleNode) return null;

    const parsed = globalThis.GIBParse.parseYouTubeMusic(text(titleNode), artistNodes.map(text), text(byline));
    return {
      titleNode,
      title: parsed.title,
      artists: parsed.artists,
      compact: true
    };
  }

  function getSpotifyContext() {
    // Bottom "now playing" bar only: the right sidebar and the pages also list artists.
    const scope = document.querySelector('[data-testid="now-playing-widget"]')
      || document.querySelector('.now-playing-widget')
      || document.querySelector('[data-testid="now-playing-bar"]')
      || document;

    const titleNode = scope.querySelector('[data-testid="context-item-link"]')
      || scope.querySelector('a[href*="/track/"]');

    if (!titleNode) return null;

    // Podcasts, episodes and ads also show up here: only songs get a button.
    const href = titleNode.getAttribute('href') || '';
    if (!/\/(track|album)\//.test(href)) return null;

    // data-testid sits either on the link itself or on a wrapper, depending on the Spotify version.
    let artistNodes = [...scope.querySelectorAll(
      'a[data-testid="context-item-info-artist"], [data-testid="context-item-info-artist"] a'
    )];
    if (!artistNodes.length) artistNodes = [...scope.querySelectorAll('a[href*="/artist/"]')];

    const parsed = globalThis.GIBParse.parseSpotify(text(titleNode), artistNodes.map(text));
    return {
      titleNode,
      // The title row clips long titles (overflow: hidden): put the button
      // right after that row so it never gets cut off.
      anchorNode: titleNode.closest('[data-testid="context-item-info-title"]') || titleNode,
      title: parsed.title,
      artists: parsed.artists,
      compact: true,
      block: true
    };
  }

  function getContext() {
    switch (site()) {
      case 'youtube':
        return getYouTubeContext();
      case 'ytmusic':
        return getYouTubeMusicContext();
      case 'spotify':
        return getSpotifyContext();
      default:
        return null;
    }
  }

  const runtime = (globalThis.browser ?? globalThis.chrome)?.runtime;
  // Must stay under the ~5 s browsers give to open a popup after a click.
  const BACKGROUND_TIMEOUT_MS = 4500;

  function setBusy(button, busy) {
    if (!button) return;
    if (busy) button.setAttribute('aria-busy', 'true');
    else button.removeAttribute('aria-busy');
  }

  function openInPage(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /**
   * The background finds the song page and opens the tab. If it cannot (extension
   * reloaded without refreshing the page, no answer, tabs.create refused), the
   * page opens the Genius result or search page itself.
   */
  function openGenius(ctx, { button, background } = {}) {
    const query = buildQuery(ctx);
    if (!query) return;
    const fallback = globalThis.GIBMatch.searchUrl(query);

    // "Extension context invalidated": the old script is still running in this tab.
    if (!runtime || !runtime.id) {
      openInPage(fallback);
      return;
    }
    if (button && button.getAttribute('aria-busy') === 'true') return; // double click

    setBusy(button, true);
    let settled = false;
    const finish = (response) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      setBusy(button, false);
      if (!response || !response.ok) openInPage((response && response.url) || fallback);
    };
    const timer = setTimeout(() => finish(null), BACKGROUND_TIMEOUT_MS);

    try {
      // Promise form: works with chrome.* (Chrome MV3) and browser.* (Firefox),
      // which does not take a callback. No listener or a crash rejects.
      Promise.resolve(runtime.sendMessage({
        type: 'gib:open',
        ctx: { title: ctx.title, artists: ctx.artists, swappable: ctx.swappable === true },
        background: background === true
      })).then(finish, () => finish(null));
    } catch (error) {
      // Thrown synchronously when the extension context is gone.
      finish(null);
    }
  }

  function onActivate(event) {
    if (event.type === 'auxclick' && event.button !== 1) return;
    event.preventDefault();
    event.stopPropagation();
    // Read the page now: the song may have changed since the button was created.
    const ctx = getContext();
    if (!ctx || !ctx.title) return;
    openGenius(ctx, {
      button: event.currentTarget,
      background: event.button === 1 || event.ctrlKey || event.metaKey
    });
  }

  function createSlot(compact) {
    const wrapper = document.createElement('span');
    wrapper.setAttribute(SLOT_ATTR, '1');
    wrapper.className = 'genius-inline-slot';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'genius-inline-btn';
    if (compact) btn.classList.add('genius-inline-btn--small');
    btn.setAttribute('aria-label', 'Open Genius page');
    btn.title = 'Open on Genius';
    btn.innerHTML = `${SVG_LOGO}<span class="genius-inline-btn__text">Genius</span>`;

    btn.addEventListener('click', onActivate);
    btn.addEventListener('auxclick', onActivate);
    // Spotify and YouTube listen on parents (drag, play/pause, navigation).
    for (const type of ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'dblclick']) {
      btn.addEventListener(type, (event) => {
        event.stopPropagation();
        // Middle button: no autoscroll, the auxclick opens Genius in the background.
        if (type === 'mousedown' && event.button === 1) event.preventDefault();
      });
    }

    wrapper.appendChild(btn);
    return wrapper;
  }

  function removeSlots() {
    // Also catches buttons left by an older copy of the script (extension reloaded).
    document.querySelectorAll(`[${SLOT_ATTR}]`).forEach(el => el.remove());
    slot = null;
  }

  function render() {
    const ctx = getContext();
    const anchor = ctx && ctx.title ? (ctx.anchorNode || ctx.titleNode) : null;
    if (!anchor || !anchor.parentElement) {
      if (slot || document.querySelector(`[${SLOT_ATTR}]`)) removeSlots();
      return;
    }

    // Already in place: touch nothing, otherwise the observer would loop.
    if (slot && slot.isConnected && slot.previousElementSibling === anchor
      && document.querySelectorAll(`[${SLOT_ATTR}]`).length === 1) return;

    removeSlots();
    slot = createSlot(ctx.compact);
    if (ctx.block && anchor !== ctx.titleNode) slot.classList.add('genius-inline-slot--block');
    anchor.insertAdjacentElement('afterend', slot);
  }

  function scheduleRender() {
    if (renderTimer) return;
    renderTimer = setTimeout(() => {
      renderTimer = 0;
      render();
    }, RENDER_DELAY_MS);
  }

  const observer = new MutationObserver((mutations) => {
    // Our own button changing (loading state) is not a reason to re-render.
    if (slot && mutations.every(m => slot.contains(m.target))) return;
    scheduleRender();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    // Spotify sometimes only swaps the link target when the track changes.
    attributes: true,
    attributeFilter: ['href']
  });

  for (const type of ['yt-navigate-finish', 'yt-page-data-updated', 'popstate', 'load']) {
    window.addEventListener(type, scheduleRender, true);
  }

  scheduleRender();
})();
