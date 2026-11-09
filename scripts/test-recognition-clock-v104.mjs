import assert from 'node:assert/strict';
import {RecognitionEngine as Tutorial} from '../assets/recognition-v33/engine.mjs';
import {RecognitionEngine as Burr} from '../assets/recognition-v81/burr-grab-v85.mjs';
import {RecognitionEngine as Repair} from '../assets/recognition-v81/repair-grab-v88.mjs';
import {makeHand} from './recognition-synthetic-v33.mjs';

const result = gesture => ({multiHandLandmarks: gesture ? [makeHand(gesture, {aspect: 4/3, scale: .4})] : []});
const report = [];
for (const [name, Engine, thresholds] of [
  ['tutorial', Tutorial, {close: .42, arm: .55, release: .65}],
  ['burr', Burr, {close: .68, arm: .86, release: 1.08}],
  ['repair', Repair, {close: .68, arm: .82, release: 1.02}],
]) {
  const engine = new Engine({hitTest: () => 'piece'});
  engine.start(0);
  const opts = now => ({now, aspect: 4/3, mode: name === 'burr' ? 'interact' : 'grab'});
  for (const now of [0, 5000, 20000, 80000]) {
    const frame = engine.process(result(null), opts(now));
    assert.equal(frame.calibrated, false, `${name}: waiting/loading must not calibrate`);
    assert.equal(engine.startedAt, null);
  }
  engine.process(result('FIST'), opts(81000));
  assert.equal(engine.startedAt, 81000);
  assert.equal(engine.fallback, false);
  engine.process(result('FIST'), opts(85499));
  assert.equal(engine.fallback, false);
  engine.process(result(null), opts(90000));
  assert.equal(engine.fallback, false, 'an empty frame cannot calibrate');
  engine.process(result('FIST'), opts(90001));
  assert.equal(engine.fallback, true);
  assert.deepEqual(engine.controller.thresholds, thresholds, `${name}: preserve original fallback bands`);

  for (const fps of [8, 15, 30]) {
    engine.start();
    let now = 100000;
    for (let n = 0; n < 18; n++) {
      engine.process(result('OPEN_PALM'), opts(now)); now += 1000/fps;
    }
    assert(engine.baseline > .75, `${name}: automatic personal calibration at ${fps} fps`);
    assert.equal(engine.fallback, false);
    for (let n = 0; n < Math.ceil(fps*.7); n++) {
      engine.process(result('PINCH'), opts(now)); now += 1000/fps;
    }
    assert.equal(engine.controller.state, 'GRABBED', `${name}: grab at ${fps} fps`);
    engine.process(result(null), opts(now)); now += 1000/fps;
    assert.equal(engine.controller.state, 'HOLD');
    const held = {...engine.controller.pointer};
    const resume = engine.process(result('PINCH'), opts(now)); now += 1000/fps;
    assert.equal(engine.controller.state, 'GRABBED');
    assert.deepEqual(engine.controller.pointer, held, 'reappearance must not jump held piece');
    assert(resume.events.some(e => e.type === 'REANCHOR'));
    let released = false;
    for (let n = 0; n < Math.ceil(fps*.8); n++) {
      const frame = engine.process(result('OPEN_PALM'), opts(now)); now += 1000/fps;
      released ||= frame.events.some(e => e.type === 'RELEASE');
    }
    assert(released, `${name}: release at ${fps} fps`);
  }
  report.push({name, delayedFirstHand: true, originalFallbackThresholds: true, personalCalibrationGrabHoldReleaseAtFps: [8,15,30]});
}
console.log(JSON.stringify(report, null, 2));
