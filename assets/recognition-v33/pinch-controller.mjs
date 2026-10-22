// Pinch-grab interaction prototype for 掌中榫局.
// Pure logic: no DOM, no MediaPipe. Feed it normalized hand frames and it
// returns a state, a frozen/anchored pointer and transition events.

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

class LowPass {
  constructor(alpha) {
    this.alpha = alpha;
    this.value = null;
  }

  filter(next) {
    if (this.value === null) this.value = next;
    else this.value += (next - this.value) * this.alpha;
    return this.value;
  }

  reset() {
    this.value = null;
  }
}

/**
 * One Euro filter: strong smoothing while slow, low lag while fast.
 * Time is in seconds.
 */
export class OneEuroFilter {
  constructor({ minCutoff = 1.15, beta = 0.018, dCutoff = 1.0 } = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.value = null;
    this.derivative = null;
    this.lastTime = null;
  }

  static alpha(cutoff, dt) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / Math.max(1e-4, dt));
  }

  filter(value, time) {
    if (this.value === null || this.lastTime === null) {
      this.value = value;
      this.derivative = 0;
      this.lastTime = time;
      return value;
    }
    const dt = Math.max(1e-3, time - this.lastTime);
    const rawDerivative = (value - this.value) / dt;
    this.derivative = this.derivative === null
      ? rawDerivative
      : this.derivative + OneEuroFilter.alpha(this.dCutoff, dt) * (rawDerivative - this.derivative);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.derivative);
    const alpha = OneEuroFilter.alpha(cutoff, dt);
    this.value += alpha * (value - this.value);
    this.lastTime = time;
    return this.value;
  }

  reset() {
    this.value = null;
    this.derivative = null;
    this.lastTime = null;
  }
}

function distance3D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
}

function distance2D(a, b, aspect) {
  return Math.hypot((a.x - b.x) * aspect, a.y - b.y);
}

/**
 * Normalize a MediaPipe hand into the values used by the interaction.
 * `landmarks` are image-normalized; `worldLandmarks` are metric if present.
 */
export function analyzeHand(landmarks, worldLandmarks = null, aspect = 16 / 9) {
  if (!landmarks || landmarks.length < 21) return null;
  const metric = worldLandmarks && worldLandmarks.length >= 21 ? worldLandmarks : null;
  const points = metric || landmarks;
  const d = metric
    ? (a, b) => distance3D(points[a], points[b])
    : (a, b) => distance2D(points[a], points[b], aspect);

  const palmWidth = d(5, 17);
  const palmLength = d(0, 9);
  const palmScale = Math.max(palmWidth, palmLength * 0.8, metric ? 0.015 : 0.02);
  const pinchRatio = d(4, 8) / palmScale;
  const indexReach = d(8, 0) / Math.max(palmLength, 1e-6);
  const thumbReach = d(4, 0) / Math.max(palmLength, 1e-6);

  const d2 = (a, b) => distance2D(landmarks[a], landmarks[b], aspect);
  const palmScale2D = Math.max(d2(5, 17), d2(0, 9) * 0.8, 0.02);
  const pinch2D = d2(4, 8) / palmScale2D;
  const pinch3D = metric ? pinchRatio : null;
  // Local thumb-base -> index-base span is much less affected by the palm
  // turning edge-on than the full palm width. Use it as a second scale so a
  // side-on pinch is not hidden by palm foreshortening.
  const localSpan = d(2, 5);
  const pinchLocal = d(4, 8) / Math.max(localSpan, 0.02);
  const fusedPinch = Math.min(pinchRatio, pinchLocal);

  const fingerPairs = [[8, 6], [12, 10], [16, 14], [20, 18]];
  let extended = 0;
  for (const [tipIndex, jointIndex] of fingerPairs) {
    const tip = distance2D(landmarks[tipIndex], landmarks[0], aspect);
    const joint = distance2D(landmarks[jointIndex], landmarks[0], aspect);
    if (tip > joint * 1.08) extended += 1;
  }

  const palmIds = [0, 5, 9, 13, 17];
  const palm = palmIds.reduce((sum, index) => {
    sum.x += 1 - landmarks[index].x;
    sum.y += landmarks[index].y;
    return sum;
  }, { x: 0, y: 0 });
  palm.x /= palmIds.length;
  palm.y /= palmIds.length;

  return {
    pinchRatio: fusedPinch,
    pinchGlobal: pinchRatio,
    pinchLocal,
    pinch2D,
    pinch3D,
    palm,
    pointer: {
      x: 1 - landmarks[8].x,
      y: landmarks[8].y,
    },
    indexReach,
    thumbReach,
    extended,
    palmWidth,
    palmLength,
  };
}

export class PinchGrabController {
  constructor(options = {}) {
    this.thresholds = {
      close: 0.72,
      arm: 0.94,
      release: 1.02,
      ...(options.thresholds || {}),
    };
    this.timings = {
      armMs: 50,
      closeMs: 40,
      releaseMs: 160,
      cancelMs: 80,
      resumeMs: 130,
      armedGraceMs: 320,
      grabGraceMs: 180,
      ...(options.timings || {}),
    };
    this.filterX = new OneEuroFilter();
    this.filterY = new OneEuroFilter();
    this.palmX = new LowPass(0.42);
    this.palmY = new LowPass(0.42);
    this.state = 'POINT';
    this.armedId = null;
    this.grabbedId = null;
    this.hoverId = null;
    this.ratio = null;
    this.pointer = null;
    this.rawPointer = null;
    this.palm = null;
    this.anchorPointer = null;
    this.anchorPalm = null;
    this.rawAtArm = null;
    this.rawAtGrab = null;
    this.armAt = 0;
    this.armSince = 0;
    this.closeSince = 0;
    this.releaseSince = 0;
    this.cancelSince = 0;
    this.armedLostAt = 0;
    this.grabbedAt = 0;
    this.lastReleaseAt = 0;
    this.resumeFrom = null;
    this.resumeAt = 0;
    this.events = [];
    this.metrics = {
      rawJump: 0,
      anchorJump: 0,
      armToGrabMs: 0,
    };
    this.lastNow = null;
  }

  setThresholds(partial) {
    Object.assign(this.thresholds, partial);
    this.thresholds.close = Math.min(this.thresholds.close, this.thresholds.arm - 0.02);
    this.thresholds.arm = Math.min(this.thresholds.arm, this.thresholds.release - 0.02);
  }

  /**
   * Derive thresholds from the user's own open-hand ratio.
   * Example: open 1.15 -> arm .87, close .58, release 1.06.
   */
  calibrate(baselineOpen) {
    if (!Number.isFinite(baselineOpen) || baselineOpen < 0.55) return false;
    const base = clamp(baselineOpen, 0.55, 2.4);
    // Keep the release band close to the arm band. The old release threshold
    // sat at 92% of the open-hand ratio, so some users had to open completely
    // before the grab would let go.
    // Cap the absolute band as well. A high open-hand baseline (for example
    // when the user is pointing with the index finger) must not push the
    // release threshold so high that a normal unpinch cannot reach it.
    const close = clamp(base * 0.48, 0.38, 0.62);
    this.setThresholds({
      close,
      arm: close + Math.max(0.10, base * 0.10),
      release: close + Math.max(0.18, base * 0.18),
    });
    return true;
  }

  emit(type, extra = {}) {
    this.events.push({
      type,
      at: this.lastNow,
      state: this.state,
      ratio: this.ratio,
      ...extra,
    });
    if (this.events.length > 120) this.events.shift();
  }

  drainEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }

  snapshot() {
    return {
      state: this.state,
      pointer: this.pointer ? { ...this.pointer } : null,
      rawPointer: this.rawPointer ? { ...this.rawPointer } : null,
      palm: this.palm ? { ...this.palm } : null,
      anchorPointer: this.anchorPointer ? { ...this.anchorPointer } : null,
      ratio: this.ratio,
      thresholds: { ...this.thresholds },
      armedId: this.armedId,
      grabbedId: this.grabbedId,
      hoverId: this.hoverId,
      metrics: { ...this.metrics },
    };
  }

  reset() {
    this.state = 'POINT';
    this.armedId = null;
    this.grabbedId = null;
    this.hoverId = null;
    this.ratio = null;
    this.pointer = null;
    this.rawPointer = null;
    this.palm = null;
    this.anchorPointer = null;
    this.anchorPalm = null;
    this.rawAtArm = null;
    this.rawAtGrab = null;
    this.armAt = 0;
    this.armSince = 0;
    this.closeSince = 0;
    this.releaseSince = 0;
    this.cancelSince = 0;
    this.armedLostAt = 0;
    this.grabbedAt = 0;
    this.lastReleaseAt = 0;
    this.resumeFrom = null;
    this.resumeAt = 0;
    this.metrics = { rawJump: 0, anchorJump: 0, armToGrabMs: 0 };
    this.filterX.reset();
    this.filterY.reset();
    this.palmX.reset();
    this.palmY.reset();
    this.lastNow = null;
  }

  /**
   * @param {object|null} hand result from analyzeHand
   * @param {{now:number, hoverId:string|null}} context
   */
  update(hand, { now = performance.now(), hoverId = null } = {}) {
    this.lastNow = now;
    this.hoverId = hoverId;
    this.lastHand = hand;
    const t = now / 1000;

    if (!hand) {
      this.rawPointer = null;
      this.palm = null;
      if (this.state === 'GRABBED') {
        this.state = 'HOLD';
        this.emit('HAND_LOST');
      } else if (this.state === 'ARMED') {
        // MediaPipe can drop one or two frames while the fingers close.
        // Keep the frozen anchor briefly instead of cancelling immediately.
        if (!this.armedLostAt) this.armedLostAt = now;
        if (now - this.armedLostAt > this.timings.armedGraceMs) {
          this.resetArm();
          this.state = 'POINT';
          this.emit('CANCEL', { reason: 'hand-lost' });
        }
      }
      return this.snapshot();
    }

    this.armedLostAt = 0;
    this.ratio = hand.pinchRatio;
    this.rawPointer = { ...hand.pointer };
    const filtered = {
      x: this.filterX.filter(hand.pointer.x, t),
      y: this.filterY.filter(hand.pointer.y, t),
    };
    this.palm = {
      x: this.palmX.filter(hand.palm.x),
      y: this.palmY.filter(hand.palm.y),
    };

    switch (this.state) {
      case 'POINT':
        this.updatePoint(filtered, now, hoverId);
        break;
      case 'ARMED':
        this.updateArmed(now);
        break;
      case 'GRABBED':
        this.updateGrabbed(now);
        break;
      case 'HOLD':
        this.updateHold(now);
        break;
      default:
        this.state = 'POINT';
        this.pointer = filtered;
    }

    return this.snapshot();
  }

  canArm() {
    return this.lastHand && this.lastHand.indexReach >= 0.98 && this.lastHand.thumbReach >= 0.35;
  }

  updatePoint(filtered, now, hoverId) {
    if (this.resumeFrom) {
      const progress = clamp((now - this.resumeAt) / this.timings.resumeMs, 0, 1);
      const blend = smoothstep(0, 1, progress);
      this.pointer = {
        x: this.resumeFrom.x + (filtered.x - this.resumeFrom.x) * blend,
        y: this.resumeFrom.y + (filtered.y - this.resumeFrom.y) * blend,
      };
      if (progress >= 1) this.resumeFrom = null;
    } else {
      this.pointer = filtered;
    }

    // A closed fist also brings the thumb close to the index tip. Requiring
    // the index to still be extended keeps a fist from becoming a "grab".
    const gesturing = this.canArm();
    const coolingDown = now - this.lastReleaseAt < 240;
    if (hoverId == null || !gesturing || coolingDown || this.ratio >= this.thresholds.arm) {
      this.armSince = 0;
      return;
    }
    if (!this.armSince) this.armSince = now;
    if (now - this.armSince < this.timings.armMs) return;

    this.state = 'ARMED';
    this.armedId = hoverId;
    this.anchorPointer = { ...this.pointer };
    this.anchorPalm = { ...this.palm };
    this.rawAtArm = { ...this.rawPointer };
    this.armAt = now;
    this.armSince = 0;
    this.closeSince = 0;
    this.cancelSince = 0;
    this.emit('ARM', { id: hoverId });

    // If the fingers were already clearly closed when the arm gate opened,
    // there is no reason to wait another 40ms; grabbing immediately avoids a
    // tracking dropout in that short but critical window.
    if (this.ratio <= this.thresholds.close) {
      this.confirmGrab(now);
    }
  }

  confirmGrab(now) {
    this.state = 'GRABBED';
    this.grabbedId = this.armedId;
    this.grabbedAt = now;
    this.rawAtGrab = { ...this.rawPointer };
    this.metrics.rawJump = Math.hypot(
      this.rawAtGrab.x - this.rawAtArm.x,
      this.rawAtGrab.y - this.rawAtArm.y,
    );
    this.metrics.anchorJump = Math.hypot(
      this.pointer.x - this.anchorPointer.x,
      this.pointer.y - this.anchorPointer.y,
    );
    this.metrics.armToGrabMs = now - this.armAt;
    this.closeSince = 0;
    this.releaseSince = 0;
    this.emit('GRAB', { id: this.grabbedId });
  }

  updateArmed(now) {
    // The whole point of ARMED: never move the selection cursor while the
    // fingers are closing. The screen anchor is frozen.
    this.pointer = { ...this.anchorPointer };

    if (this.ratio < this.thresholds.close) {
      this.cancelSince = 0;
      if (!this.closeSince) this.closeSince = now;
      if (now - this.closeSince >= this.timings.closeMs) {
        this.confirmGrab(now);
      }
      return;
    }

    this.closeSince = 0;
    if (this.ratio > this.thresholds.arm + 0.08) {
      if (!this.cancelSince) this.cancelSince = now;
      if (now - this.cancelSince >= this.timings.cancelMs) {
        this.resetArm();
        this.state = 'POINT';
        this.emit('CANCEL');
      }
      return;
    }
    this.cancelSince = 0;
  }

  updateGrabbed(now) {
    this.pointer = {
      x: this.anchorPointer.x + (this.palm.x - this.anchorPalm.x),
      y: this.anchorPointer.y + (this.palm.y - this.anchorPalm.y),
    };

    // A just-closed pinch can wobble back over the release line for one or
    // two frames. Do not drop the object in that initial window.
    if (now - this.grabbedAt < this.timings.grabGraceMs) return;

    // The global palm-width ratio can rise while the hand turns, even though
    // the fingertips are still closed. Release only when BOTH the global
    // opening signal and the local thumb/index-base signal agree that the
    // pinch is open. This stops the grab from dropping during hand movement.
    const localOpen = this.lastHand?.pinchLocal ?? 0;
    if (this.ratio > this.thresholds.release && localOpen > 0.8) {
      if (!this.releaseSince) this.releaseSince = now;
      if (now - this.releaseSince >= this.timings.releaseMs) {
        this.release(now);
      }
    } else {
      this.releaseSince = 0;
    }
  }

  updateHold(now) {
    // Keep the pointer exactly where it was. Wait for the hand to return,
    // then re-anchor palm movement without moving the held object.
    this.pointer = this.pointer ? { ...this.pointer } : null;
    if (!this.pointer) return;
    this.anchorPalm = { ...this.palm };
    this.anchorPointer = { ...this.pointer };
    this.filterX.reset();
    this.filterY.reset();
    this.state = 'GRABBED';
    this.releaseSince = 0;
    this.emit('REANCHOR', { id: this.grabbedId });
  }

  release(now) {
    this.pointer = this.pointer ? { ...this.pointer } : null;
    this.resumeFrom = this.pointer ? { ...this.pointer } : null;
    this.resumeAt = now;
    this.lastReleaseAt = now;
    this.state = 'POINT';
    this.emit('RELEASE', { id: this.grabbedId });
    this.armedId = null;
    this.grabbedId = null;
    this.armAt = 0;
    this.armSince = 0;
    this.closeSince = 0;
    this.releaseSince = 0;
    this.cancelSince = 0;
    this.grabbedAt = 0;
    this.anchorPointer = null;
    this.anchorPalm = null;
    this.rawAtArm = null;
  }

  resetArm() {
    this.armedId = null;
    this.anchorPointer = null;
    this.anchorPalm = null;
    this.rawAtArm = null;
    this.armAt = 0;
    this.armSince = 0;
    this.closeSince = 0;
    this.cancelSince = 0;
    this.armedLostAt = 0;
  }
}
