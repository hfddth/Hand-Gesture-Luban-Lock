(() => {
  'use strict';
  const WIDTH = 1672, HEIGHT = 941;
  const rootURL = new URL('./', location.href);
  const pages = new Set(['index.html', 'tutorial.html', 'modes.html', 'levels.html', 'burr-level.html',
    'repair-campaign.html', 'repair-demo.html', 'shadow-level.html', 'collection.html', 'cover-obj-preview.html']);
  const plane = document.getElementById('landscape-plane');
  const frame = document.getElementById('game-frame');
  const button = document.getElementById('fullscreenButton');
  const notice = document.getElementById('mobile-notice');
  let automaticAttempted = false, entering = false, noticeTimer, controlsTimer, resizeFrame;
  let geometry = { scale: 1, rotated: false };

  function gameURL(value) {
    try {
      const url = new URL(value || 'index.html', rootURL);
      if (url.pathname === rootURL.pathname) url.pathname += 'index.html';
      const name = url.pathname.slice(rootURL.pathname.length);
      if (url.origin === rootURL.origin && url.pathname.startsWith(rootURL.pathname) && pages.has(name)) return url;
    } catch {}
    return new URL('index.html', rootURL);
  }
  function say(text) {
    clearTimeout(noticeTimer);
    notice.textContent = text;
    noticeTimer = setTimeout(() => { notice.textContent = ''; }, 4500);
  }
  function showControls() {
    clearTimeout(controlsTimer);
    button.hidden = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    // Prefer the unused border. On a matching 16:9 screen hide the floating
    // control after a few seconds so it never permanently covers game controls.
    if (button.dataset.floating === 'true') controlsTimer = setTimeout(() => { if (document.activeElement !== button) button.hidden = true; }, 6500);
  }
  function fit() {
    const view = window.visualViewport;
    const safe = getComputedStyle(document.getElementById('safe-area'));
    const left = parseFloat(safe.paddingLeft) || 0, right = parseFloat(safe.paddingRight) || 0;
    const top = parseFloat(safe.paddingTop) || 0, bottom = parseFloat(safe.paddingBottom) || 0;
    const w = Math.max(1, (view?.width || innerWidth) - left - right);
    const h = Math.max(1, (view?.height || innerHeight) - top - bottom);
    const rotated = w < h;
    const width = rotated ? h : w, height = rotated ? w : h;
    const scale = Math.min(width / WIDTH, height / HEIGHT);
    const changed = geometry.scale !== scale || geometry.rotated !== rotated;
    geometry = { width, height, scale, rotated };
    plane.style.cssText = `left:${left + (view?.offsetLeft || 0) + w / 2}px;top:${top + (view?.offsetTop || 0) + h / 2}px;width:${width}px;height:${height}px;transform:translate(-50%,-50%) rotate(${rotated ? 90 : 0}deg)`;
    frame.style.transform = `translate(-50%,-50%) scale(${scale})`;
    document.documentElement.dataset.orientation = rotated ? 'rotated' : 'landscape';
    const gapX = (width - WIDTH * scale) / 2, gapY = (height - HEIGHT * scale) / 2;
    if (gapX >= 52) {
      button.style.left = `${(gapX - 44) / 2}px`; button.style.top = `${(height - 48) / 2}px`;
    } else if (gapY >= 56) {
      button.style.left = `${(width - 44) / 2}px`; button.style.top = `${(gapY - 48) / 2}px`;
    } else {
      button.style.left = `${width - 50}px`; button.style.top = '5px';
    }
    button.dataset.floating = String(gapX < 52 && gapY < 56);
    showControls();
    // Cancel an in-progress drag when the physical device changes direction.
    // The child's viewport itself stays fixed, keeping pointer/canvas math native.
    if (changed) {
      try {
        frame.contentWindow.dispatchEvent(new Event('mobileviewportchange'));
        frame.contentWindow.dispatchEvent(new Event('resize'));
      } catch {}
    }
  }
  function scheduleFit() { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(fit); }

  async function lockOrientation() {
    try {
      if (typeof screen.orientation?.lock === 'function') {
        await screen.orientation.lock('landscape');
        return true;
      }
    } catch { /* iOS and embedded browsers use the rotated canvas fallback. */ }
    return false;
  }
  async function enterLandscape(manual = true) {
    if (entering || (!manual && automaticAttempted)) return;
    automaticAttempted = true;
    entering = true;
    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const request = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
        if (request) {
          try { await request.call(document.documentElement); } catch {}
        }
      }
      const locked = await lockOrientation();
      if (manual && !locked && !document.fullscreenElement && !document.webkitFullscreenElement) {
        say('已使用横屏画面，横持手机即可操作');
      }
    } finally { entering = false; scheduleFit(); }
  }
  window.sunjuMobile = { enterLandscape, get geometry() { return { ...geometry }; } };
  button.addEventListener('click', () => enterLandscape(true));
  plane.addEventListener('pointerup', event => { if (event.target === plane) showControls(); });
  addEventListener('resize', scheduleFit, { passive: true });
  addEventListener('orientationchange', scheduleFit, { passive: true });
  window.visualViewport?.addEventListener('resize', scheduleFit, { passive: true });
  window.visualViewport?.addEventListener('scroll', scheduleFit, { passive: true });
  document.addEventListener('fullscreenchange', () => { if (document.fullscreenElement) lockOrientation(); scheduleFit(); });
  document.addEventListener('webkitfullscreenchange', scheduleFit);
  addEventListener('pageshow', scheduleFit);
  frame.addEventListener('load', () => {
    try {
      const current = gameURL(frame.contentWindow.location.href);
      // Keep a reloadable/shareable deep link, including mode, chapter and level.
      const shellURL = new URL('mobile.html', rootURL);
      shellURL.searchParams.set('game', current.pathname.slice(rootURL.pathname.length) + current.search + current.hash);
      history.replaceState(null, '', shellURL);
      document.title = frame.contentDocument.title || '掌中榫局 · 横屏体验';
      document.body.dataset.ready = 'true';
    } catch {}
    scheduleFit();
  });
  fit();
  frame.src = gameURL(new URLSearchParams(location.search).get('game')).href;
  // Installed browsers can accept this immediately; normal tabs may require a tap.
  lockOrientation();
})();
