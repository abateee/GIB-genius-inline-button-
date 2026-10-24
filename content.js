(() => {
  const { cleanupTitle, unique, buildQuery } = globalThis.GIBParse;
  const BUTTON_ATTR = 'data-genius-inline-button';
  const BUTTON_SLOT_ATTR = 'data-genius-inline-slot';
  const SVG_LOGO = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="genius-inline-btn__logo">
      <path fill="currentColor" d="M4 4h16v3H7v3h10v3H7v4h13v3H4z"></path>
    </svg>`;

  let lastFingerprint = '';
  let scheduled = false;

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
      title: parsed.title,
      artists: parsed.artists,
      compact: true
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

  function buildLuckyUrl(query) {
    const q = `site:genius.com ${query}`;
    return `https://www.google.com/search?btnI=I&q=${encodeURIComponent(q)}`;
  }

  function createButton(ctx) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'genius-inline-btn';
    if (ctx.compact) btn.classList.add('genius-inline-btn--small');
    btn.setAttribute(BUTTON_ATTR, '1');
    btn.setAttribute('aria-label', 'Open Genius page');
    btn.title = 'Open on Genius';
    btn.innerHTML = `${SVG_LOGO}<span class="genius-inline-btn__text">Genius</span>`;

    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const query = buildQuery(ctx);
      if (!query) return;
      window.open(buildLuckyUrl(query), '_blank', 'noopener,noreferrer');
    });

    return btn;
  }

  function removeOldButtonNear(node) {
    const parent = node?.parentElement;
    if (!parent) return;
    const old = parent.querySelector(`[${BUTTON_SLOT_ATTR}="1"]`);
    if (old) old.remove();
  }

  function removeAllButtons() {
    document.querySelectorAll(`[${BUTTON_SLOT_ATTR}="1"]`).forEach(el => el.remove());
    lastFingerprint = '';
  }

  function inject() {
    const ctx = getContext();
    if (!ctx?.titleNode || !ctx.title) {
      removeAllButtons();
      return;
    }

    const fingerprint = JSON.stringify({
      s: site(),
      t: ctx.title,
      a: ctx.artists
    });

    const parent = ctx.titleNode.parentElement;
    if (!parent) return;

    const alreadyInsideParent = parent.querySelector(`[${BUTTON_ATTR}="1"]`);
    if (alreadyInsideParent && fingerprint === lastFingerprint) return;

    removeOldButtonNear(ctx.titleNode);

    const slot = document.createElement('span');
    slot.setAttribute(BUTTON_SLOT_ATTR, '1');
    slot.style.display = 'inline-flex';
    slot.style.alignItems = 'center';
    slot.appendChild(createButton(ctx));

    ctx.titleNode.insertAdjacentElement('afterend', slot);
    lastFingerprint = fingerprint;
  }

  function scheduleInject() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      inject();
    });
  }

  const observer = new MutationObserver(() => {
    scheduleInject();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  window.addEventListener('yt-navigate-finish', scheduleInject, true);
  window.addEventListener('popstate', scheduleInject, true);
  window.addEventListener('load', scheduleInject, true);

  scheduleInject();
})();
