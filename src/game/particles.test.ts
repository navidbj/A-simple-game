import test from 'node:test';
import assert from 'node:assert/strict';
import { ParticleSystem } from './particles';
import { createInitialMatch, dispatchTroops, buildStructure } from './simulation';
import type { SimEvent } from './types';

test('ParticleSystem spawns directional dust, sparks, and ring on troop dispatch and decays cleanly', () => {
  const ps = new ParticleSystem();
  const events: SimEvent[] = [
    {
      type: 'dispatch',
      x: 200,
      y: 200,
      toX: 340,
      toY: 200,
      owner: 0,
      amount: 18,
      isElite: true,
    },
  ];

  ps.consumeEvents(events);

  assert.ok(ps.getActiveParticleCount() >= 12, 'Dispatch should emit dust and spark particles');
  assert.equal(ps.getActiveRingCount(), 1, 'Dispatch should emit a directional pulse ring');

  // Verify average horizontal velocity points toward the target (+X)
  const active = ps.particles.filter((p) => p.active);
  const avgVx = active.reduce((sum, p) => sum + p.vx, 0) / active.length;
  assert.ok(avgVx > 20, `Dispatch plume should spray toward target (+X), got avgVx=${avgVx}`);

  // Stepping forward past max lifetime cleans up all particles and rings
  for (let i = 0; i < 40; i++) {
    ps.update(0.05);
  }
  assert.equal(ps.getActiveParticleCount(), 0);
  assert.equal(ps.getActiveRingCount(), 0);
});

test('ParticleSystem spawns sparks, bouncing masonry debris, smoke, and shockwaves on castle clash & capture', () => {
  const ps = new ParticleSystem();
  ps.consumeEvents([
    {
      type: 'clash',
      x: 400,
      y: 300,
      fromX: 300,
      fromY: 300,
      owner: 0,
      amount: 24,
    },
  ]);

  const active = ps.particles.filter((p) => p.active);
  assert.ok(active.some((p) => p.kind === 'spark'), 'Clash must spawn steel sparks');
  assert.ok(active.some((p) => p.kind === 'debris'), 'Clash must spawn stone debris');
  assert.ok(active.some((p) => p.kind === 'dust'), 'Clash must spawn siege smoke');
  assert.equal(ps.getActiveRingCount(), 1, 'Clash must emit an impact shockwave ring');

  // Step physics and verify debris bounces at groundY
  let observedBounce = false;
  for (let i = 0; i < 20; i++) {
    ps.update(0.04);
    if (ps.particles.some((p) => p.active && p.kind === 'debris' && p.bounces > 0)) {
      observedBounce = true;
    }
  }
  assert.ok(observedBounce, 'Stone debris should bounce off castle ground plane');

  // Capture emits a double shockwave ring + heavy burst
  ps.clear();
  ps.consumeEvents([
    {
      type: 'capture',
      x: 400,
      y: 300,
      fromX: 300,
      fromY: 300,
      owner: 0,
      amount: 20,
      capturedByPlayer: true,
    },
  ]);
  assert.equal(ps.getActiveRingCount(), 2, 'Capture should emit double shockwave rings');
  assert.ok(ps.getActiveParticleCount() >= 30, 'Capture should emit heavy breach particle burst');
});

test('ParticleSystem emits ambient micro-particles for living buildings and marching troops without exceeding pool bounds', () => {
  const ps = new ParticleSystem();
  const sim = createInitialMatch(1234, 'normal');
  const cap = sim.territories.find((t) => t.owner === 0)!;
  cap.military = 200;
  buildStructure(sim, cap.id, 'mine', 0);
  buildStructure(sim, cap.id, 'forge', 0);
  buildStructure(sim, cap.id, 'barracks', 0);
  buildStructure(sim, cap.id, 'tower', 0);
  dispatchTroops(sim, cap.id, cap.neighbors[0], 0.5, 0);

  for (let i = 0; i < 20; i++) {
    ps.emitAmbient(sim, 0.1, false);
    ps.update(0.05);
  }

  assert.ok(ps.getActiveParticleCount() > 0, 'Ambient emitter should spawn building/marching particles');
  assert.ok(ps.getActiveParticleCount() <= ps.particles.length, 'Pool capacity must never be exceeded');
});
