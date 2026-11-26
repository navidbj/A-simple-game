import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceMarchClock } from './renderer';

test('advanceMarchClock integrates troopSpeedScale monotonically without phase jumps on oscillation', () => {
  let marchTime = 0;
  const dt = 0.016;
  for (let i = 0; i < 200; i++) {
    const oscillatingScale = i % 2 === 0 ? 1.36 : 0.9;
    const next = advanceMarchClock(marchTime, dt, oscillatingScale);
    const delta = next - marchTime;
    assert.ok(delta > 0, `March clock must advance strictly monotonically, delta=${delta}`);
    assert.ok(
      delta <= dt * 1.6 + 1e-9,
      `March clock delta must stay bounded by dt * scale, got ${delta}`
    );
    marchTime = next;
  }
});
