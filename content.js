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
    const titleNode = document.querySelector('ytd-watch-metadata h1 yt-formatted-string')
      || document.querySelector('h1.ytd-watch-metadata yt-formatted-string')
      || document.querySelector('h1.title yt-formatted-string');

    const artistNode = document.querySelector('ytd-watch-metadata ytd-channel-name a')
      || document.querySelector('#channel-name a');

    if (!titleNode) return null;

    const parsed = globalThis.GIBParse.parseYouTube(text(titleNode), text(artistNode));
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

    const artistNodes = [...document.querySelectorAll('ytmusic-player-bar .byline a')];

    if (!titleNode) return null;

    return {
      titleNode,
      title: cleanupTitle(text(titleNode)),
      artists: unique(artistNodes.map(text)),
      compact: true
    };
  }

  function getSpotifyContext() {
    const candidates = [
      document.querySelector('[data-testid="context-item-link"]'),
      document.querySelector('[data-testid="now-playing-widget"] a[href*="/track/"]'),
      document.querySelector('.now-playing-widget a[href*="/track/"]')
    ].filter(Boolean);

    const titleNode = candidates[0] || null;

    const artistNodes = [
      ...document.querySelectorAll('[data-testid="context-item-info-artist"] a'),
      ...document.querySelectorAll('[data-testid="now-playing-widget"] a[href*="/artist/"]'),
      ...document.querySelectorAll('.now-playing-widget a[href*="/artist/"]')
    ];

    if (!titleNode) return null;

    return {
      titleNode,
      title: cleanupTitle(text(titleNode)),
      artists: unique(artistNodes.map(text)),
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

  function inject() {
    const ctx = getContext();
    if (!ctx?.titleNode || !ctx.title) return;

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
