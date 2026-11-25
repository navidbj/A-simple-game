import assert from 'node:assert/strict';
import test from 'node:test';
import { appendBattleLog, buildBattleLogEntries, formatBattleTime } from './battleLog';
import { ECONOMY } from './constants';
import {
  buildStructure,
  canBuildStructure,
  canDispatchTo,
  clearSupplyRoute,
  computeBattleIntensity,
  computeNavalRoute,
  createInitialMatch,
  dispatchTroops,
  recordTimelapseSnapshot,
  setSupplyRoute,
  stepSimulation,
} from './simulation';
import type { MapPreset, SimEvent } from './types';

test('Auto-Supply validates adjacency & ownership, prevents ping-pong loops, and toggles cleanly', () => {
  const sim = createInitialMatch(24681, 'normal');
  const home = sim.territories.find((t) => t.owner === 0)!;
  const neighborId = home.neighbors[0];
  const neighbor = sim.territories[neighborId];

  // Cannot link to enemy/neutral neighbor
  neighbor.owner = 1;
  const failRes = setSupplyRoute(sim, home.id, neighbor.id, 0);
  assert.equal(failRes.ok, false);
  assert.equal(failRes.reason, 'target_not_friendly');

  // Make neighbor friendly and establish supply line
  neighbor.owner = 0;
  const events: SimEvent[] = [];
  const okRes = setSupplyRoute(sim, home.id, neighbor.id, 0, events);
  assert.equal(okRes.ok, true);
  assert.equal(okRes.action, 'set');
  assert.equal(home.supplyTargetId, neighbor.id);
  assert.equal(events.some((e) => e.type === 'supply_set' && e.targetId === neighbor.id), true);

  // Reversing the link clears the opposite direction so troops never ping-pong forever
  const reverseRes = setSupplyRoute(sim, neighbor.id, home.id, 0);
  assert.equal(reverseRes.ok, true);
  assert.equal(neighbor.supplyTargetId, home.id);
  assert.equal(home.supplyTargetId, null);

  // Calling setSupplyRoute again on the same pair cancels it
  const toggleOff = setSupplyRoute(sim, neighbor.id, home.id, 0);
  assert.equal(toggleOff.ok, true);
  assert.equal(toggleOff.action, 'cleared');
  assert.equal(neighbor.supplyTargetId, null);

  // Explicit clearSupplyRoute works
  setSupplyRoute(sim, home.id, neighbor.id, 0);
  const clearEvents: SimEvent[] = [];
  assert.equal(clearSupplyRoute(sim, home.id, 0, clearEvents), true);
  assert.equal(home.supplyTargetId, null);
  assert.equal(clearEvents.some((e) => e.type === 'supply_clear'), true);
});

test('Auto-Supply periodically dispatches troops and auto-clears if target falls', () => {
  const sim = createInitialMatch(24681, 'normal');
  const home = sim.territories.find((t) => t.owner === 0)!;
  const target = sim.territories[home.neighbors[0]];
  target.owner = 0;
  home.military = 40;
  target.military = 10;

  setSupplyRoute(sim, home.id, target.id, 0);
  const initialTroops = sim.troops.length;

  // Advance simulation ~1.5s (first caravan fires quickly after ~0.7s)
  for (let i = 0; i < 30; i++) {
    stepSimulation(sim, 0.05, false, 1.0);
  }

  const supplyCaravanSent =
    sim.troops.length > initialTroops ||
    sim.territories[target.id].military > 12;
  assert.equal(supplyCaravanSent, true, 'Auto-supply should dispatch reinforcements automatically');

  // If destination falls to enemy, the supply route must automatically sever on next tick
  target.owner = 2;
  stepSimulation(sim, ECONOMY.AUTO_SUPPLY_INTERVAL, false, 1.0);
  assert.equal(home.supplyTargetId, null);
});

test('Timelapse records immutable initial and capture snapshots cleanly', () => {
  const sim = createInitialMatch(13579, 'normal');
  assert.equal(sim.timelapse.length, 1);
  assert.equal(sim.timelapse[0].owners.length, sim.territories.length);

  const firstOwnerCopy = [...sim.timelapse[0].owners];
  // Calling without ownership change does not duplicate frame
  recordTimelapseSnapshot(sim, false);
  assert.equal(sim.timelapse.length, 1);

  // Changing an owner appends a new immutable snapshot
  const victim = sim.territories.find((t) => t.owner !== 0)!;
  victim.owner = 0;
  sim.stats.elapsedSeconds = 12;
  recordTimelapseSnapshot(sim, false);

  assert.equal(sim.timelapse.length, 2);
  assert.deepEqual(sim.timelapse[0].owners, firstOwnerCopy, 'Previous snapshot must remain immutable');
  assert.equal(sim.timelapse[1].owners[victim.id], 0);
});

test('computeBattleIntensity scales from calm (0) to skirmish (1) to intense (2)', () => {
  const sim = createInitialMatch(24681, 'normal');
  assert.equal(computeBattleIntensity(sim), 0);

  // Active Blitz immediately elevates music intensity to 2
  sim.powers.blitzTimer = 5;
  assert.equal(computeBattleIntensity(sim), 2);
  sim.powers.blitzTimer = 0;

  // Multiple active marching squads elevate intensity to 1
  const home = sim.territories.find((t) => t.owner === 0)!;
  const enemy = sim.territories[home.neighbors[0]];
  enemy.owner = 1;
  home.military = 60;
  enemy.military = 60;
  dispatchTroops(sim, home.id, enemy.id, 0.25, 0);
  dispatchTroops(sim, home.id, enemy.id, 0.25, 0);
  assert.equal(computeBattleIntensity(sim), 1);

  // Incoming enemy attack toward player castle escalates to 2
  dispatchTroops(sim, enemy.id, home.id, 0.5, 1);
  assert.equal(computeBattleIntensity(sim), 2);
});

test('Battle Log formats key Persian events and enforces newest-first cap', () => {
  assert.equal(formatBattleTime(0), '00:00');
  assert.equal(formatBattleTime(125), '02:05');

  const idRef = { current: 1 };
  const events: SimEvent[] = [
    {
      type: 'capture',
      x: 100,
      y: 100,
      owner: 0,
      previousOwner: 1,
      capturedByPlayer: true,
      territoryName: 'دژ عقاب',
    },
    {
      type: 'capture',
      x: 120,
      y: 120,
      owner: 2,
      previousOwner: 0,
      capturedByPlayer: false,
      territoryName: 'قلعه مرزی',
    },
    {
      type: 'build',
      x: 100,
      y: 100,
      owner: 0,
      building: 'mine',
      territoryName: 'دژ عقاب',
    },
    {
      type: 'supply_set',
      x: 100,
      y: 100,
      owner: 0,
      territoryName: 'دژ عقاب',
      targetName: 'قلعه مرزی',
    },
  ];

  const entries = buildBattleLogEntries(events, 65, idRef);
  assert.equal(entries.length, 4);
  assert.equal(entries[0].timeText, '01:05');
  assert.ok(entries[0].text.includes('دژ عقاب'));
  assert.equal(entries[0].tone, 'capture_player');
  assert.equal(entries[1].tone, 'alert');
  assert.ok(entries[1].text.includes('سقوط کرد'));
  assert.equal(entries[2].tone, 'build');
  assert.equal(entries[3].tone, 'supply');

  // appendBattleLog puts newest first and respects maxEntries
  const log = appendBattleLog([], entries, 3);
  assert.equal(log.length, 3);
  assert.equal(log[0].tone, 'supply');
});

test('All 4 Map Presets generate 16 connected territories, 6 capitals, coastal ports, and Archipelago bridges', () => {
  const presets: MapPreset[] = ['continent', 'archipelago', 'strait', 'middle_east'];

  for (const preset of presets) {
    const sim = createInitialMatch(24681, 'normal', preset);
    assert.equal(sim.preset, preset);
    assert.equal(sim.territories.length, 16, `${preset} must generate 16 territories`);

    // Verify all 6 factions (0..5) start with a capital
    for (let f = 0; f < 6; f++) {
      const cap = sim.territories.find((t) => t.owner === f);
      assert.ok(cap, `${preset} missing capital for faction ${f}`);
    }

    // Verify graph connectivity across all 16 territories via BFS
    const visited = new Set<number>([0]);
    const queue = [0];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const n of sim.territories[curr].neighbors) {
        if (!visited.has(n)) {
          visited.add(n);
          queue.push(n);
        }
      }
    }
    assert.equal(visited.size, 16, `${preset} territory graph must be fully connected`);

    // Verify coastal territories exist with valid coastPoint coordinates
    const coastal = sim.territories.filter((t) => t.isCoastal);
    assert.ok(coastal.length >= 6, `${preset} should have at least 6 coastal territories`);
    for (const c of coastal) {
      assert.ok(c.coastPoint !== null, `${preset} coastal territory ${c.id} missing coastPoint`);
    }

    // Archipelago must have strategic wooden sea bridges connecting separate islands
    if (preset === 'archipelago') {
      const totalBridgeLinks = sim.territories.reduce(
        (acc, t) => acc + t.bridgeNeighbors.length,
        0
      );
      assert.ok(totalBridgeLinks >= 6, 'Archipelago must connect islands with wooden bridges');
    }
  }
});

test('Port requires coastal castle and unlocks cross-sea Naval Raids with over-water route and conquest', () => {
  const sim = createInitialMatch(24681, 'normal', 'archipelago');
  const coastalOrigin = sim.territories.find((t) => t.isCoastal)!;
  coastalOrigin.owner = 0;
  coastalOrigin.military = 95;

  // Find a non-adjacent coastal target across the sea
  const navalTarget = sim.territories.find(
    (t) =>
      t.id !== coastalOrigin.id &&
      t.isCoastal &&
      !coastalOrigin.neighbors.includes(t.id)
  )!;
  assert.ok(navalTarget, 'Expected a non-adjacent coastal target on archipelago map');
  navalTarget.owner = 2;
  navalTarget.military = 10;

  // Before building a Port, cannot dispatch to non-adjacent coastal castle
  assert.equal(canDispatchTo(sim, coastalOrigin.id, navalTarget.id).allowed, false);

  // Inland castle (simulate by setting isCoastal = false) cannot build Port
  const inlandTest = sim.territories.find((t) => t.id !== coastalOrigin.id && t.id !== navalTarget.id)!;
  inlandTest.owner = 0;
  inlandTest.military = 80;
  inlandTest.isCoastal = false;
  assert.equal(canBuildStructure(inlandTest, 'port'), false);

  // Coastal castle CAN build Port
  assert.equal(canBuildStructure(coastalOrigin, 'port'), true);
  const buildEvents: SimEvent[] = [];
  assert.equal(buildStructure(sim, coastalOrigin.id, 'port', 0, buildEvents), true);
  assert.equal(coastalOrigin.hasPort, true);
  assert.equal(buildEvents.some((e) => e.type === 'build' && e.building === 'port'), true);

  // Now cross-sea Naval Raid is allowed and flagged isNaval: true
  const check = canDispatchTo(sim, coastalOrigin.id, navalTarget.id);
  assert.equal(check.allowed, true);
  assert.equal(check.isNaval, true);

  // Naval route should produce valid start/via/target waypoints
  const route = computeNavalRoute(sim, coastalOrigin, navalTarget);
  assert.ok(Number.isFinite(route.viaX) && Number.isFinite(route.viaY));

  // Dispatch Naval Raid and verify warship troop + Battle Log dispatch event
  const launchEvents: SimEvent[] = [];
  const res = dispatchTroops(sim, coastalOrigin.id, navalTarget.id, 0.75, 0, launchEvents);
  assert.equal(res.ok, true);
  assert.equal(res.isNaval, true);
  assert.equal(sim.troops.some((tr) => tr.isNaval && tr.toId === navalTarget.id), true);
  assert.equal(launchEvents.some((e) => e.type === 'dispatch' && e.isNaval), true);

  const launchLog = buildBattleLogEntries(launchEvents, 30, { current: 1 });
  assert.ok(
    launchLog.some((entry) => entry.text.includes('ناوگان دریایی')),
    'Battle log should record player naval fleet launch'
  );

  // Step simulation until warship reaches target and conquers it
  navalTarget.hasPort = true;
  const arrivalEvents: SimEvent[] = [];
  for (let i = 0; i < 360; i++) {
    const stepEvs = stepSimulation(sim, 0.05, false, 1.0);
    arrivalEvents.push(...stepEvs);
    if (sim.territories[navalTarget.id].owner === 0) break;
  }

  assert.equal(sim.territories[navalTarget.id].owner, 0, 'Naval raid should capture coastal castle');
  assert.equal(sim.territories[navalTarget.id].hasPort, false, 'Captured castle resets Port');
  assert.equal(
    arrivalEvents.some((e) => e.type === 'capture' && e.isNaval && e.capturedByPlayer),
    true,
    'Capture event should carry isNaval flag'
  );
});

