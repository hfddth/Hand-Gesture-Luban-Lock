/* Keep the desktop game in one landscape viewport on phones and tablets. */
(() => {
  'use strict';
  const script = document.currentScript;
  const rootURL = new URL('../../', script.src);
  let inShell = false;
  try { inShell = window.parent !== window && window.frameElement?.id === 'game-frame'; } catch {}
  if (inShell) {
    document.documentElement.classList.add('mobile-game');
    // CSS custom-property URLs resolve at the consuming stylesheet; use a full
    // URL so the shared room also loads in shadow/collection subdirectories.
    document.documentElement.style.setProperty('--room-image', `url("${new URL('assets/landing/room-v96.jpg', rootURL).href}")`);
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = new URL('assets/mobile/game-v97.css', rootURL).href;
    document.head.append(style);
    // Each manipulation belongs to one finger. A second contact must not
    // replace the selected piece or terminate the first finger's drag.
    let activePointer;
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
      document.addEventListener(type, event => {
        if (event.pointerType !== 'touch') return;
        if (!event.isPrimary) { event.stopImmediatePropagation(); return; }
        if (type === 'pointerdown' && event.target.closest('canvas, .model-view, .puzzle-view, #levelWindow')) {
          activePointer = { target: event.target, id: event.pointerId };
        } else if (type === 'pointerup' || type === 'pointercancel') activePointer = null;
      }, true);
    }
    addEventListener('mobileviewportchange', () => {
      if (!activePointer) return;
      const { target, id } = activePointer;
      activePointer = null;
      target.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: id, pointerType: 'touch', isPrimary: true }));
      if (target.hasPointerCapture?.(id)) target.releasePointerCapture(id);
    });
    // Calling in the trusted event keeps the ancestor's fullscreen activation.
    document.addEventListener('pointerup', event => {
      if (!event.isTrusted || !event.target.closest?.('a,button')) return;
      if (event.target.closest('[id*="camera" i],[id*="video" i]')) return;
      window.parent.sunjuMobile?.enterLandscape(false);
    }, { capture: true, passive: true });
    return;
  }
  if (window.self !== window.top) return;
  const mobile = navigator.userAgentData?.mobile || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    || (navigator.maxTouchPoints > 0 && matchMedia('(pointer:coarse)').matches && Math.max(screen.width, screen.height) <= 1366);
  if (!mobile) return;
  const route = location.pathname.slice(rootURL.pathname.length) || 'index.html';
  const shell = new URL('mobile.html', rootURL);
  shell.searchParams.set('game', route + location.search + location.hash);
  // Hide the intermediate document so the portrait breakpoint never flashes.
  document.documentElement.style.visibility = 'hidden';
  location.replace(shell.href);
})();
