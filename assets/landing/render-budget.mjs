// Supersampling stays within a fixed pixel budget on large and retina screens.
export function renderPixelRatio(width, height, dpr = globalThis.devicePixelRatio || 1) {
  return Math.min(dpr, 1.5, Math.sqrt(2_000_000 / Math.max(1, width * height)));
}

// Decorative motion uses 30 fps; dragging and running mechanisms retain 60 fps.
// Call before advancing simulation time so skipped frames do not slow gameplay.
export function createFrameGate() {
  let previous = -Infinity;
  return (now, active = false) => {
    if (document.hidden) { previous = -Infinity; return false; }
    if (now - previous < 1000 / (active ? 60 : 30) - .5) return false;
    previous = now;
    return true;
  };
}
