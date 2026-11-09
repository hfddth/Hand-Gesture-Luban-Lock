// Uniform camera-distance compensation. Shape, rotation and the target outline
// never enter this calculation. All offsets use output-mask pixels.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * geometry: {span,cx,cy,observedHands,recoveredHands,stamp,clipped?}
 * span: median sqrt(palm-width * wrist-to-middle-MCP length), source pixels.
 * cx/cy: combined palm centre in source pixels (including recovered tracks).
 * stamp: most recent actual detector observation, in the supplied clock's ms.
 */
export function createShadowProjection({
  width = 640, height = 480, outputSize = 128, referenceSpan = 78,
  minZoom = .65, maxZoom = 3, smoothingMs = 180, freezeMs = 700,
  maxObservationAgeMs = 500,
} = {}) {
  let factor = null, anchor = null, lastAt = null, trustedHands = 0, missingSince = null;

  function reset() {
    factor = anchor = lastAt = missingSince = null;
    trustedHands = 0;
  }

  function empty(baseZoom) {
    return {zoom: clamp(baseZoom, minZoom, maxZoom), offsetX: 0, offsetY: 0,
      valid: false, frozen: false, distanceFactor: 1};
  }

  function update(geometry, {baseZoom = 1.35, now = performance.now()} = {}) {
    baseZoom = Number.isFinite(baseZoom) && baseZoom > 0 ? baseZoom : 1.35;
    const valid = geometry && [geometry.span, geometry.cx, geometry.cy, geometry.stamp, now].every(Number.isFinite)
      && geometry.span >= 12 && geometry.span <= Math.max(width, height)
      && geometry.observedHands >= 1 && geometry.observedHands <= 2
      && now >= geometry.stamp && now - geometry.stamp <= maxObservationAgeMs;
    if (!valid) { reset(); return empty(baseZoom); }

    const observed = geometry.observedHands;
    const dt = lastAt === null ? 0 : clamp(now - lastAt, 0, 250);
    if (lastAt !== null && now < lastAt) { reset(); return empty(baseZoom); }
    lastAt = now;

    if (observed < trustedHands) missingSince ??= now;
    else { missingSince = null; trustedHands = observed; }

    const recovering = Number.isFinite(geometry.recoveredHands) && geometry.recoveredHands > 0;
    const frozen = factor !== null && (Boolean(geometry.clipped)
      || (missingSince !== null && (recovering || now - missingSince < freezeMs)));
    if (!frozen) {
      // A single remaining real hand eventually becomes a new stable distance
      // reference. A recovered second hand keeps the previous reference frozen.
      trustedHands = observed;
      missingSince = null;
      const desired = clamp(referenceSpan / geometry.span, .55, 2.25);
      const alpha = factor === null ? 1 : 1 - Math.exp(-dt / Math.max(1, smoothingMs));
      factor = factor === null ? desired : factor + (desired - factor) * alpha;
      if (anchor === null) anchor = {x: geometry.cx, y: geometry.cy};
      else {
        const a = 1 - Math.exp(-dt / 100);
        anchor.x += (geometry.cx - anchor.x) * a;
        anchor.y += (geometry.cy - anchor.y) * a;
      }
    }

    const zoom = clamp(baseZoom * factor, minZoom, maxZoom);
    const units = outputSize / Math.max(width, height);
    // Scale about the palms while keeping intentional hand translation at the
    // user's base magnification; otherwise distance changes also cause drifting.
    const offsetX = (anchor.x - width / 2) * (baseZoom - zoom) * units;
    const offsetY = (anchor.y - height / 2) * (baseZoom - zoom) * units;
    return {zoom, offsetX, offsetY, valid: true, frozen, distanceFactor: factor};
  }

  return {update, reset};
}

/** Same affine transform for display and mask sampling. */
export function shadowSourceToOutput(x, y, transform, {width = 640, height = 480, size = 128} = {}) {
  const units = size / Math.max(width, height);
  return {
    x: size / 2 + (x - width / 2) * units * transform.zoom + (transform.offsetX || 0),
    y: size / 2 + (y - height / 2) * units * transform.zoom + (transform.offsetY || 0),
  };
}

export function shadowOutputToSource(x, y, transform, {width = 640, height = 480, size = 128} = {}) {
  const units = Math.max(width, height) / size;
  return {
    x: width / 2 + (x - size / 2 - (transform.offsetX || 0)) * units / transform.zoom,
    y: height / 2 + (y - size / 2 - (transform.offsetY || 0)) * units / transform.zoom,
  };
}
