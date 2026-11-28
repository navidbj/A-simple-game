import assert from 'node:assert/strict';
import test from 'node:test';
import { appendBattleLog, buildBattleLogEntries, formatBattleTime } from './battleLog';
import { BUILDINGS, ECONOMY } from './constants';
import {
  buildStructure,
  canBuildStructure,
  canDispatchTo,
  clearSupplyRoute,
  computeBattleIntensity,
  createInitialMatch,
  dispatchTroops,
  getBuildingLevel,
  getNextBuildingCost,
  getTerritoryRates,
  previewAttackOutcome,
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

test('Port requires coastal castle, boosts manpower growth & capacity across Lv.1 -> Lv.3, and naval raids are disabled', () => {
  const sim = createInitialMatch(24681, 'normal', 'archipelago');
  const coastalOrigin = sim.territories.find((t) => t.isCoastal)!;
  coastalOrigin.owner = 0;
  coastalOrigin.military = 200;

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

  // Inland castle (simulate by setting isCoastal = false) cannot build Port
  const inlandTest = sim.territories.find((t) => t.id !== coastalOrigin.id && t.id !== navalTarget.id)!;
  inlandTest.owner = 0;
  inlandTest.military = 80;
  inlandTest.isCoastal = false;
  assert.equal(canBuildStructure(inlandTest, 'port'), false);

  // Coastal castle CAN build Port and upgrades boost manpower growth & max capacity monotonically
  const r0 = getTerritoryRates(coastalOrigin);
  assert.equal(canBuildStructure(coastalOrigin, 'port'), true);
  const buildEvents: SimEvent[] = [];
  assert.equal(buildStructure(sim, coastalOrigin.id, 'port', 0, buildEvents), true);
  assert.equal(coastalOrigin.hasPort, true);
  assert.equal(buildEvents.some((e) => e.type === 'build' && e.building === 'port'), true);
  const r1 = getTerritoryRates(coastalOrigin);
  assert.ok(r1.manpowerRate > r0.manpowerRate && r1.maxManpower > r0.maxManpower);

  assert.equal(buildStructure(sim, coastalOrigin.id, 'port', 0, buildEvents), true);
  const r2 = getTerritoryRates(coastalOrigin);
  assert.ok(r2.manpowerRate > r1.manpowerRate && r2.maxManpower > r1.maxManpower);

  assert.equal(buildStructure(sim, coastalOrigin.id, 'port', 0, buildEvents), true);
  const r3 = getTerritoryRates(coastalOrigin);
  assert.ok(r3.manpowerRate > r2.manpowerRate && r3.maxManpower > r2.maxManpower);

  // Cross-sea Naval Raids are disabled even with a Port
  const check = canDispatchTo(sim, coastalOrigin.id, navalTarget.id);
  assert.equal(check.allowed, false);
  assert.equal(check.reason, 'not_neighbor');
  const res = dispatchTroops(sim, coastalOrigin.id, navalTarget.id, 0.75, 0);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'not_neighbor');
});

test('Upgraded cartographic map generates rivers, surf, ocean life on water, and rich landmarks across all presets', () => {
  const presets: MapPreset[] = ['continent', 'archipelago', 'strait', 'middle_east'];

  for (const preset of presets) {
    const sim = createInitialMatch(55123, 'normal', preset);
    const { map } = sim;

    // Coastal surf anchors should outline the shoreline cleanly
    assert.ok(map.coastSurf.length >= 25, `${preset} should generate animated coastSurf points`);

    // Ocean features (reefs, sea stacks, dhows, sea life) must sit strictly on open water
    assert.ok(map.oceanFeatures.length >= 6, `${preset} should populate oceanFeatures`);
    for (const feat of map.oceanFeatures) {
      const gx = Math.floor(feat.x / map.step);
      const gy = Math.floor(feat.y / map.step);
      assert.equal(
        map.cells[gy * map.cols + gx],
        -1,
        `${preset} ocean feature ${feat.kind} must spawn strictly on open ocean`
      );
    }

    // Rivers on continent/strait/middle_east should carve valid land cells with sparkles
    let riverCells = 0;
    for (let i = 0; i < map.riverMask.length; i++) {
      if (map.riverMask[i] > 0) {
        assert.ok(map.cells[i] >= 0, `${preset} river cell must stay on land`);
        riverCells++;
      }
    }
    if (preset !== 'archipelago') {
      assert.ok(riverCells >= 20, `${preset} should carve procedural river channels`);
      assert.ok(map.riverSparkles.length >= 3, `${preset} should generate river sparkle points`);
    }

    // Rich landmarks (windmills, ruins, villages, cypress, palms, oases) should appear and stay off rivers
    const kinds = new Set(map.props.map((p) => p.kind));
    assert.ok(kinds.size >= 4, `${preset} should scatter diverse biome landmarks`);
    if (preset === 'middle_east') {
      assert.ok(kinds.has('palm'), 'middle_east preset should feature palm trees');
    } else {
      assert.ok(
        kinds.has('windmill') || kinds.has('ruin') || kinds.has('village'),
        `${preset} should include signature hero landmarks`
      );
    }
    for (const prop of map.props) {
      const gx = Math.floor(prop.x / map.step);
      const gy = Math.floor(prop.y / map.step);
      assert.equal(map.riverMask[gy * map.cols + gx], 0, 'Landmarks must not overlap river channels');
    }
  }
});

test('All 5 buildings upgrade cleanly across Lv.1 -> Lv.2 -> Lv.3 with scaling stats, Battle Log entries, and conquest reset', () => {
  const sim = createInitialMatch(24681, 'normal', 'archipelago');
  const home = sim.territories.find((t) => t.isCoastal)!;
  home.owner = 0;
  home.military = 1000;

  const neighbor = sim.territories[home.neighbors[0]];
  neighbor.owner = 1;
  neighbor.military = 100;
  neighbor.biome = 'plain';

  // 1. Mine Lv.0 -> Lv.1 -> Lv.2 -> Lv.3 increases maxManpower & manpowerRate monotonically
  const r0 = getTerritoryRates(home);
  assert.equal(getBuildingLevel(home, 'mine'), 0);
  assert.equal(getNextBuildingCost(home, 'mine'), BUILDINGS.mine.levelCosts[0]);

  const events: SimEvent[] = [];
  assert.equal(buildStructure(sim, home.id, 'mine', 0, events), true);
  const r1 = getTerritoryRates(home);
  assert.equal(getBuildingLevel(home, 'mine'), 1);
  assert.ok(r1.maxManpower > r0.maxManpower && r1.manpowerRate > r0.manpowerRate);

  assert.equal(buildStructure(sim, home.id, 'mine', 0, events), true);
  const r2 = getTerritoryRates(home);
  assert.equal(getBuildingLevel(home, 'mine'), 2);
  assert.ok(r2.maxManpower > r1.maxManpower && r2.manpowerRate > r1.manpowerRate);

  assert.equal(buildStructure(sim, home.id, 'mine', 0, events), true);
  const r3 = getTerritoryRates(home);
  assert.equal(getBuildingLevel(home, 'mine'), 3);
  assert.equal(r3.maxManpower, ECONOMY.MINE_MAX_MANPOWER_LEVELS[3]);
  assert.ok(r3.manpowerRate > r2.manpowerRate);

  // Max level cap prevents Lv.4
  assert.equal(getNextBuildingCost(home, 'mine'), null);
  assert.equal(canBuildStructure(home, 'mine'), false);
  assert.equal(buildStructure(sim, home.id, 'mine', 0, events), false);

  // Battle Log formats Lv.2 & Lv.3 tier names
  const log = buildBattleLogEntries(events, 45, { current: 1 });
  assert.equal(log.length, 3);
  assert.ok(log[1].text.includes('سطح ۲'));
  assert.ok(log[2].text.includes('حداکثر سطح ۳'));

  // 2. Barracks Lv.1 -> Lv.3 increases net military conversion rate monotonically
  const b0 = getTerritoryRates(home).netMilitaryPerSec;
  buildStructure(sim, home.id, 'barracks', 0);
  const b1 = getTerritoryRates(home).netMilitaryPerSec;
  buildStructure(sim, home.id, 'barracks', 0);
  const b2 = getTerritoryRates(home).netMilitaryPerSec;
  buildStructure(sim, home.id, 'barracks', 0);
  const b3 = getTerritoryRates(home).netMilitaryPerSec;
  assert.ok(b0 < b1 && b1 < b2 && b2 < b3);

  // 3. Forge Lv.1 -> Lv.3 increases attackMultiplier monotonically
  const p0 = previewAttackOutcome(sim, home.id, neighbor.id, 0.5)!;
  buildStructure(sim, home.id, 'forge', 0);
  const p1 = previewAttackOutcome(sim, home.id, neighbor.id, 0.5)!;
  buildStructure(sim, home.id, 'forge', 0);
  const p2 = previewAttackOutcome(sim, home.id, neighbor.id, 0.5)!;
  buildStructure(sim, home.id, 'forge', 0);
  const p3 = previewAttackOutcome(sim, home.id, neighbor.id, 0.5)!;
  assert.ok(
    p0.effectiveAttack / p0.sendAmount < p1.effectiveAttack / p1.sendAmount &&
      p1.effectiveAttack / p1.sendAmount < p2.effectiveAttack / p2.sendAmount &&
      p2.effectiveAttack / p2.sendAmount < p3.effectiveAttack / p3.sendAmount
  );

  // 4. Tower Lv.1 -> Lv.3 increases defense bonus percentage monotonically
  neighbor.military = 300;
  buildStructure(sim, neighbor.id, 'tower', 1);
  const d1 = previewAttackOutcome(sim, home.id, neighbor.id, 0.5)!.defenseBonusPct;
  buildStructure(sim, neighbor.id, 'tower', 1);
  const d2 = previewAttackOutcome(sim, home.id, neighbor.id, 0.5)!.defenseBonusPct;
  buildStructure(sim, neighbor.id, 'tower', 1);
  const d3 = previewAttackOutcome(sim, home.id, neighbor.id, 0.5)!.defenseBonusPct;
  assert.ok(d1 < d2 && d2 < d3 && d3 >= 60);

  // 5. Port Lv.1 -> Lv.3 boosts manpower growth rate and max capacity monotonically
  const mpRate0 = getTerritoryRates(home).manpowerRate;
  const mpMax0 = getTerritoryRates(home).maxManpower;
  buildStructure(sim, home.id, 'port', 0);
  const mpRate1 = getTerritoryRates(home).manpowerRate;
  const mpMax1 = getTerritoryRates(home).maxManpower;
  buildStructure(sim, home.id, 'port', 0);
  const mpRate2 = getTerritoryRates(home).manpowerRate;
  const mpMax2 = getTerritoryRates(home).maxManpower;
  buildStructure(sim, home.id, 'port', 0);
  const mpRate3 = getTerritoryRates(home).manpowerRate;
  const mpMax3 = getTerritoryRates(home).maxManpower;
  assert.ok(mpRate0 < mpRate1 && mpRate1 < mpRate2 && mpRate2 < mpRate3);
  assert.ok(mpMax0 < mpMax1 && mpMax1 < mpMax2 && mpMax2 < mpMax3);

  // 6. Enemy conquest resets ALL buildingLevels back to 0
  sim.troops = [];
  home.military = 1;
  neighbor.military = 400;
  dispatchTroops(sim, neighbor.id, home.id, 0.75, 1);
  for (let i = 0; i < 200; i++) {
    stepSimulation(sim, 0.05, false, 1.0);
    if (sim.territories[home.id].owner === 1) break;
  }
  assert.equal(sim.territories[home.id].owner, 1);
  assert.equal(getBuildingLevel(home, 'barracks'), 0);
  assert.equal(getBuildingLevel(home, 'mine'), 0);
  assert.equal(getBuildingLevel(home, 'forge'), 0);
  assert.equal(getBuildingLevel(home, 'port'), 0);
  assert.equal(home.hasBarracks, false);
  assert.equal(home.hasMine, false);
  assert.equal(home.hasForge, false);
  assert.equal(home.hasPort, false);
});

test('Ambient ship sea lanes have explicit waypoints and stay strictly in deep dark-blue water', () => {
  const presets: MapPreset[] = ['continent', 'archipelago', 'strait', 'middle_east'];
  for (const preset of presets) {
    const sim = createInitialMatch(24681, 'normal', preset);
    const { map } = sim;
    const ships = map.oceanFeatures.filter((f) => f.kind === 'ship_ambient');
    assert.ok(ships.length >= 1, `${preset} must generate at least one ambient ship`);
    for (const ship of ships) {
      assert.ok(
        Array.isArray(ship.route) && ship.route.length >= 2,
        `${preset} ship must have an explicit multi-point shipping route`
      );
      const route = ship.route!;
      for (let i = 0; i < route.length - 1; i++) {
        const a = route[i];
        const b = route[i + 1];
        const samples = 12;
        for (let s = 0; s <= samples; s++) {
          const u = s / samples;
          const x = a.x + (b.x - a.x) * u;
          const y = a.y + (b.y - a.y) * u;
          const gx = Math.floor(x / map.step);
          const gy = Math.floor(y / map.step);
          assert.ok(gx >= 0 && gx < map.cols && gy >= 0 && gy < map.rows, 'Route sample inside map bounds');
          const idx = gy * map.cols + gx;
          assert.equal(map.cells[idx], -1, `${preset} ship route crossed land at (${x.toFixed(1)}, ${y.toFixed(1)})`);
          assert.ok(
            map.elevation[idx] <= 72,
            `${preset} ship route entered shallow coastal water (elev=${map.elevation[idx]})`
          );
        }
      }
    }
  }
});



