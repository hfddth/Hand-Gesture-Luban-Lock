// A tiny procedural hand rig.
//
// The same 21-point rig powers the onboarding demo, the gesture glyphs and the
// classifier tests. It is deliberately not a "real" hand model: it is a
// controllable approximation whose joint angles exercise the recognizer.

const TAU = Math.PI * 2;

const FINGERS = [
  { name: 'index', mcp: [-0.2, 0.42], splay: 0.1, lengths: [0.16, 0.1, 0.065], inward: 1 },
  { name: 'middle', mcp: [-0.03, 0.47], splay: 0.0, lengths: [0.17, 0.11, 0.07], inward: 0.2 },
  { name: 'ring', mcp: [0.12, 0.43], splay: -0.1, lengths: [0.16, 0.1, 0.065], inward: -1 },
  { name: 'pinky', mcp: [0.27, 0.35], splay: -0.22, lengths: [0.13, 0.08, 0.055], inward: -1 },
];

const THUMBS = {
  extended: [[-0.2, 0.06], [-0.35, 0.14], [-0.46, 0.25], [-0.52, 0.36]],
  across: [[-0.2, 0.06], [-0.29, 0.12], [-0.17, 0.22], [-0.03, 0.25]],
  up: [[-0.18, 0.08], [-0.18, 0.21], [-0.2, 0.33], [-0.21, 0.45]],
  down: [[-0.18, 0.08], [-0.19, -0.05], [-0.2, -0.17], [-0.2, -0.29]],
  gun: [[-0.18, 0.1], [-0.31, 0.16], [-0.42, 0.17], [-0.51, 0.18]],
  ok: [[-0.2, 0.08], [-0.29, 0.23], [-0.36, 0.4], [-0.27, 0.53]],
};

function round(value, digits = 5) {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function extendFinger(base, splay, lengths, curlAngle = 0, inward = 0) {
  const points = [];
  let x = base[0];
  let y = base[1];
  let angle = Math.PI / 2 + splay + curlAngle;
  for (const length of lengths) {
    // A tiny natural bend keeps fully extended fingers from looking like sticks.
    angle += 0.025;
    x += Math.cos(angle) * length;
    y += Math.sin(angle) * length;
    points.push([x, y]);
  }
  if (inward) {
    points[1][0] += inward * 0.004;
  }
  return points;
}

function curlFinger(base, splay, lengths, inward) {
  const [l1, l2, l3] = lengths;
  const direction = Math.sign(base[0]) || 1;
  const curlIn = (-direction * 0.85) + inward * 0.15;
  const pip = [base[0] + Math.sin(splay) * l1 * 0.35, base[1] + l1 * 0.72];
  const dip = [pip[0] + curlIn * l2 * 0.8, pip[1] - l2 * 0.72];
  const tip = [dip[0] + curlIn * l3 * 0.9, dip[1] - l3 * 0.55];
  return [pip, dip, tip];
}

const RECIPES = {
  OPEN_PALM: { extended: ['index', 'middle', 'ring', 'pinky'], thumb: 'extended' },
  FIST: { extended: [], thumb: 'across' },
  VICTORY: { extended: ['index', 'middle'], thumb: 'across', spread: 0.24 },
  POINT: { extended: ['index'], thumb: 'across' },
  THUMBS_UP: { extended: [], thumb: 'up' },
  THUMBS_DOWN: { extended: [], thumb: 'down' },
  ROCK: { extended: ['index', 'pinky'], thumb: 'extended', spread: 0.18 },
  GUN: { extended: ['index'], thumb: 'gun' },
  THREE: { extended: ['index', 'middle', 'ring'], thumb: 'across' },
  FOUR: { extended: ['index', 'middle', 'ring', 'pinky'], thumb: 'across' },
  OK: { extended: ['middle', 'ring', 'pinky'], thumb: 'ok', customIndex: 'ok' },
  PINCH: { extended: [], thumb: 'ok', customIndex: 'pinch' },
  SWIPE_LEFT: { extended: ['index', 'middle', 'ring', 'pinky'], thumb: 'extended' },
  SWIPE_RIGHT: { extended: ['index', 'middle', 'ring', 'pinky'], thumb: 'extended' },
  SWIPE_UP: { extended: ['index', 'middle', 'ring', 'pinky'], thumb: 'extended' },
  SWIPE_DOWN: { extended: ['index', 'middle', 'ring', 'pinky'], thumb: 'extended' },
};

/**
 * Return a 21-point hand rig in local coordinates, y-axis pointing up,
 * wrist at (0, 0).
 */
export function localHand(gesture = 'OPEN_PALM') {
  const recipe = RECIPES[gesture] || RECIPES.OPEN_PALM;
  const points = new Array(21);

  points[0] = [0, 0];

  const thumb = (THUMBS[recipe.thumb] || THUMBS.extended).map((p) => [...p]);
  points[1] = thumb[0];
  points[2] = thumb[1];
  points[3] = thumb[2];
  points[4] = thumb[3];

  FINGERS.forEach((finger, index) => {
    const offset = 5 + index * 4;
    points[offset] = [...finger.mcp];
    let chain;
    if (finger.name === 'index' && recipe.customIndex) {
      // Curl the index finger in towards the thumb for OK / pinch.
      const tip = recipe.customIndex === 'ok' ? [-0.275, 0.535] : [-0.28, 0.5];
      chain = [
        [-0.245, 0.555],
        [-0.335, 0.6],
        [tip[0], tip[1]],
      ];
      if (recipe.customIndex === 'pinch') {
        chain = [
          [-0.235, 0.55],
          [-0.315, 0.575],
          [-0.285, 0.51],
        ];
      }
    } else if (recipe.extended.includes(finger.name)) {
      chain = extendFinger(finger.mcp, finger.splay + (recipe.spread || 0) * (finger.name === 'index' ? 1 : -1), finger.lengths, 0, finger.inward);
    } else {
      chain = curlFinger(finger.mcp, finger.splay, finger.lengths, finger.inward);
    }
    points[offset + 1] = [chain[0][0], chain[0][1]];
    points[offset + 2] = [chain[1][0], chain[1][1]];
    points[offset + 3] = [chain[2][0], chain[2][1]];
  });

  if (gesture === 'OK' || gesture === 'PINCH') {
    // Make the ring visually convincing: thumb and index tips touch.
    points[4] = [points[8][0] + 0.008, points[8][1] - 0.004];
  }

  return points;
}

/**
 * Project the local rig into normalized MediaPipe-style coordinates.
 * `x` / `y` is the wrist position on screen, `scale` is the hand size.
 */
export function makeHand(gesture = 'OPEN_PALM', options = {}) {
  const {
    x = 0.5,
    y = 0.8,
    scale = 0.5,
    rotate = 0,
    aspect = 16 / 9,
    noise = 0,
    seed = 1,
    z = 0,
  } = options;

  const local = localHand(gesture);
  const random = mulberry32(seed);
  const cos = Math.cos(rotate);
  const sin = Math.sin(rotate);

  return local.map(([lx, ly]) => {
    const rx = lx * cos - ly * sin;
    const ry = lx * sin + ly * cos;
    const nx = noise ? (random() - 0.5) * noise : 0;
    const ny = noise ? (random() - 0.5) * noise : 0;
    return {
      x: round(x + (rx * scale) / aspect + nx),
      y: round(y - ry * scale + ny),
      z: round(z + (random() - 0.5) * 0.02),
      visibility: 0.99,
    };
  });
}

/**
 * Normalized points suitable for drawing a glyph in a square viewBox.
 */
export function glyphPoints(gesture) {
  const local = localHand(gesture);
  const xs = local.map((p) => p[0]);
  const ys = local.map((p) => p[1]);
  const minX = Math.min(...xs, -0.6);
  const maxX = Math.max(...xs, 0.42);
  const minY = Math.min(...ys, -0.35);
  const maxY = Math.max(...ys, 0.55);
  const width = maxX - minX;
  const height = maxY - minY;
  const size = Math.max(width, height) * 1.08;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return local.map(([x, y]) => ({
    x: 0.5 + (x - cx) / size,
    y: 0.5 - (y - cy) / size,
  }));
}

export { TAU };

