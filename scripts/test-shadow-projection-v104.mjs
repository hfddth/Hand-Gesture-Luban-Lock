import assert from 'node:assert/strict';
import {createShadowProjection, shadowSourceToOutput, shadowOutputToSource} from '../assets/shadow-v86/projection-v104.mjs';

const near = (actual, expected, epsilon = 1e-8) => assert(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
const geometry = (span = 78, observedHands = 2, recoveredHands = 0, stamp = 0, cx = 320, cy = 240) =>
  ({span, cx, cy, observedHands, recoveredHands, stamp});
const check = [];

{
  // Uniform distance changes should leave hand size and shape unchanged.
  const projectA = createShadowProjection(), projectB = createShadowProjection();
  const a = projectA.update(geometry(78), {now: 0});
  const b = projectB.update(geometry(39), {now: 0});
  const points = [[-80, -60], [40, 80], [5, -120]];
  for (const [x, y] of points) {
    const p = shadowSourceToOutput(320 + x, 240 + y, a);
    const q = shadowSourceToOutput(320 + x / 2, 240 + y / 2, b);
    near(p.x, q.x); near(p.y, q.y);
  }
  check.push('Uniform near/far compensation preserves shape and output size');
}

{
  const projector = createShadowProjection();
  const first = projector.update(geometry(78, 2, 0, 0, 270, 210), {now: 0});
  // Detector reports one hand and a smaller palm/shifted centre. Neither size
  // nor offset may jump during a sustained pixel-recovered overlap.
  for (let now = 50; now <= 2500; now += 50) {
    const r = projector.update(geometry(35, 1, 1, now, 410, 260), {now});
    assert(r.frozen); near(r.zoom, first.zoom); near(r.offsetX, first.offsetX); near(r.offsetY, first.offsetY);
  }
  const again = projector.update(geometry(78, 2, 0, 2550, 270, 210), {now: 2550});
  assert(!again.frozen); near(again.zoom, first.zoom);
  check.push('Sustained overlapping second-hand recovery freezes scale and offset');
}

{
  const projector = createShadowProjection();
  const initial = projector.update(geometry(78), {now: 0});
  for (let now = 50; now < 750; now += 50) {
    const r = projector.update(geometry(45, 1, 0, now), {now});
    assert(r.frozen); near(r.zoom, initial.zoom);
  }
  const r = projector.update(geometry(45, 1, 0, 750), {now: 750});
  assert(!r.frozen && r.zoom > initial.zoom && r.zoom < 1.35 * 78 / 45);
  check.push('A genuine single remaining hand resumes gradual distance adaptation');
}

{
  const projector = createShadowProjection();
  projector.update(geometry(39), {now: 0});
  const lost = projector.update(geometry(39, 0, 2, 50), {now: 50});
  assert(!lost.valid); near(lost.zoom, 1.35); near(lost.offsetX, 0);
  const restored = projector.update(geometry(78, 2, 0, 100), {now: 100});
  near(restored.zoom, 1.35);
  const stale = projector.update(geometry(78, 2, 0, 100), {now: 800});
  assert(!stale.valid);
  assert(!projector.update({...geometry(), span: NaN}, {now: 0}).valid);
  check.push('Complete loss, stale detections and invalid input reset compensation');
}

{
  const projector = createShadowProjection();
  const t = projector.update(geometry(52, 2, 0, 0, 240, 180), {baseZoom: 1.35, now: 0});
  // Palm centre stays where the base camera magnification puts it, even when
  // the distance factor differs from one.
  const anchor = shadowSourceToOutput(240, 180, t);
  near(anchor.x, 64 + (240 - 320) / 5 * 1.35);
  near(anchor.y, 64 + (180 - 240) / 5 * 1.35);
  for (const p of [[0, 0], [240, 180], [639, 479]]) {
    const out = shadowSourceToOutput(...p, t), back = shadowOutputToSource(out.x, out.y, t);
    near(back.x, p[0]); near(back.y, p[1]);
  }
  projector.reset();
  near(projector.update(geometry(78), {now: 0, baseZoom: 1.6}).zoom, 1.6);
  check.push('Display and scoring transforms are invertible and anchor-consistent');
}

console.log(JSON.stringify({passed: check.length, checks: check}, null, 2));
