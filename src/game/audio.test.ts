import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeSyncFromSamples,
  createInitialSyncFilterState,
  soundEngine,
} from './audio';

function makeSineRmsBuffer(rmsAmplitude: number, length = 256): Float32Array {
  const buf = new Float32Array(length);
  const peak = rmsAmplitude * Math.SQRT2;
  for (let i = 0; i < length; i++) {
    buf[i] = peak * Math.sin((i / length) * Math.PI * 8);
  }
  return buf;
}

function makeFreqBins(bassByte: number, midByte: number, length = 128): Uint8Array {
  const bins = new Uint8Array(length);
  for (let i = 0; i < 4; i++) bins[i] = bassByte;
  for (let i = 4; i < 32; i++) bins[i] = midByte;
  return bins;
}

test('soundEngine.sampleMusicSync is safe in headless Node and clamps extreme dt', () => {
  const s1 = soundEngine.sampleMusicSync(0.016);
  const s2 = soundEngine.sampleMusicSync(10.0);
  const s3 = soundEngine.sampleMusicSync(-2.0);
  for (const s of [s1, s2, s3]) {
    assert.equal(s.active, false);
    assert.equal(s.tempoScale, 1.0);
    assert.equal(s.troopSpeedScale, 1.0);
    assert.equal(Number.isFinite(s.energy), true);
  }
});

test('computeSyncFromSamples aligns 144 BPM beatPulse peak to 0.31s downbeat offset', () => {
  const quietTime = makeSineRmsBuffer(0.12);
  const bins = makeFreqBins(140, 120);
  const state = createInitialSyncFilterState();

  const atZero = computeSyncFromSamples(quietTime, bins, 48000, 256, 0.0, 0.016, state).sync;
  const atDownbeat = computeSyncFromSamples(quietTime, bins, 48000, 256, 0.31, 0.016, state).sync;
  const atOffbeat = computeSyncFromSamples(quietTime, bins, 48000, 256, 0.52, 0.016, state).sync;

  assert.ok(atDownbeat.beatPulse > 0.95, `Expected downbeat pulse near 1.0 at 0.31s, got ${atDownbeat.beatPulse}`);
  assert.ok(atDownbeat.beatPulse > atZero.beatPulse, 'Downbeat at 0.31s must exceed 0.0s');
  assert.equal(atOffbeat.beatPulse, 0);
});

test('computeSyncFromSamples drives perceptible tempoScale (0.88-1.18) and kick troopSpeedScale (0.90-1.36)', () => {
  // 1. Quiet intro frames settle tempoScale into 0.88..0.94
  let state = createInitialSyncFilterState();
  const quietTime = makeSineRmsBuffer(0.068);
  const quietBins = makeFreqBins(60, 70);
  let lastSync = computeSyncFromSamples(quietTime, quietBins, 48000, 256, 0.52, 0.016, state).sync;
  for (let i = 0; i < 120; i++) {
    const res = computeSyncFromSamples(quietTime, quietBins, 48000, 256, 0.52, 0.03, state);
    state = res.state;
    lastSync = res.sync;
  }
  assert.ok(
    lastSync.tempoScale >= 0.88 && lastSync.tempoScale <= 0.94,
    `Expected quiet tempoScale in [0.88, 0.94], got ${lastSync.tempoScale}`
  );
  assert.ok(
    lastSync.troopSpeedScale >= 0.9 && lastSync.troopSpeedScale <= 1.0,
    `Expected quiet off-beat troopSpeedScale in [0.90, 1.0], got ${lastSync.troopSpeedScale}`
  );

  // 2. Drop RMS + bass kick jump on 0.31s downbeat drives tempoScale up to ~1.10-1.18 and troopSpeedScale > 1.20
  const dropTime = makeSineRmsBuffer(0.175);
  const preDropBins = makeFreqBins(100, 150);
  const kickBins = makeFreqBins(230, 175);
  for (let i = 0; i < 90; i++) {
    const res = computeSyncFromSamples(dropTime, preDropBins, 48000, 256, 0.31, 0.03, state);
    state = res.state;
  }
  for (let i = 0; i < 8; i++) {
    const res = computeSyncFromSamples(dropTime, kickBins, 48000, 256, 0.31, 0.02, state);
    state = res.state;
    lastSync = res.sync;
  }
  assert.ok(
    lastSync.tempoScale >= 1.1 && lastSync.tempoScale <= 1.18,
    `Expected drop tempoScale in [1.10, 1.18], got ${lastSync.tempoScale}`
  );
  assert.ok(
    lastSync.troopSpeedScale >= 1.2 && lastSync.troopSpeedScale <= 1.36,
    `Expected kick troopSpeedScale in [1.20, 1.36], got ${lastSync.troopSpeedScale}`
  );
});

test('computeSyncFromSamples resolves 40-180 Hz bass flux at 48 kHz / fftSize=1024 even when DC bin 0 is 0', () => {
  let state = createInitialSyncFilterState();
  const dropTime = makeSineRmsBuffer(0.16);
  const baseBins = new Uint8Array(512);
  const kickBins = new Uint8Array(512);
  // 48000 / 1024 = 46.875 Hz/bin -> bins 1..3 cover ~47..187 Hz; DC bin 0 stays 0
  baseBins[1] = 60;
  baseBins[2] = 60;
  baseBins[3] = 60;
  kickBins[1] = 240;
  kickBins[2] = 240;
  kickBins[3] = 240;

  for (let i = 0; i < 60; i++) {
    state = computeSyncFromSamples(dropTime, baseBins, 48000, 1024, 0.31, 0.03, state).state;
  }
  const res = computeSyncFromSamples(dropTime, kickBins, 48000, 1024, 0.31, 0.02, state);
  assert.ok(
    res.sync.bassEnergy > 0.25,
    `Expected non-zero bassEnergy from bins 1..3 with DC bin 0 empty, got ${res.sync.bassEnergy}`
  );
  assert.ok(
    res.sync.troopSpeedScale > 1.15,
    `Expected bass kick impulse from bins 1..3 to boost troopSpeedScale > 1.15, got ${res.sync.troopSpeedScale}`
  );
});
