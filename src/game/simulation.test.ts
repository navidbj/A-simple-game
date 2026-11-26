import test from 'node:test';
import assert from 'node:assert/strict';
import { BIOMES, BUILDINGS, COMMANDER_POWERS, ECONOMY, FACTIONS, TERRITORY_COUNT } from './constants';
import { generateOrganicMap } from './mapGenerator';
import {
  buildStructure,
  checkGameOutcome,
  createInitialMatch,
  cycleOwnedTerritory,
  dispatchTroops,
  evaluateAI,
  getTerritoryAtPoint,
  getTerritoryRates,
  getWeakestEnemyNeighbor,
  previewAttackOutcome,
  rallyReinforcements,
  stepSimulation,
  triggerCommanderPower,
} from './simulation';
import type { SimEvent } from './types';

test('generateOrganicMap produces connected territories, valid biomes, props, and all 6 distinct factions', () => {
  const { map, territories } = generateOrganicMap(4242);
  assert.equal(territories.length, TERRITORY_COUNT);
  assert.ok(map.cells.length === map.cols * map.rows);
  assert.ok(map.props.length > 20, 'Map should scatter procedural biome props');

  for (const faction of FACTIONS) {
    const owned = territories.filter((t) => t.owner === faction.id);
    assert.equal(owned.length, 1, `Faction ${faction.id} should start with 1 capital`);
  }

  for (const t of territories) {
    assert.ok(BIOMES[t.biome], `Territory ${t.id} must have a valid biome`);
    assert.ok(t.neighbors.length >= 1, `Territory ${t.id} should have at least 1 neighbor`);
    for (const nId of t.neighbors) {
      assert.ok(territories[nId].neighbors.includes(t.id));
    }
  }

  const visited = new Set<number>([0]);
  const stack = [0];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    for (const n of territories[cur].neighbors) {
      if (!visited.has(n)) {
        visited.add(n);
        stack.push(n);
      }
    }
  }
  assert.equal(visited.size, territories.length, 'Entire territory graph must be connected');
});

test('Barracks boosts manpower-to-military conversion, Mine boosts cap, and Fertile biome boosts manpower rate', () => {
  const simA = createInitialMatch(101, 'normal');
  const simB = createInitialMatch(101, 'normal');

  const playerA = simA.territories.find((t) => t.owner === 0)!;
  const playerB = simB.territories.find((t) => t.owner === 0)!;

  playerA.biome = 'plain';
  playerB.biome = 'fertile';
  assert.ok(
    getTerritoryRates(playerB).manpowerRate > getTerritoryRates(playerA).manpowerRate,
    'Fertile biome should increase manpower growth rate'
  );

  playerB.biome = 'plain';
  playerA.manpower = 80;
  playerA.military = 40;
  playerB.manpower = 80;
  playerB.military = 40;

  assert.equal(buildStructure(simB, playerB.id, 'barracks', 0), true);
  assert.equal(playerB.military, 40 - BUILDINGS.barracks.cost);
  assert.equal(playerB.hasBarracks, true);

  const milBeforeA = playerA.military;
  const milBeforeB = playerB.military;

  for (let i = 0; i < 20; i++) {
    stepSimulation(simA, 0.05, false);
    stepSimulation(simB, 0.05, false);
  }

  const gainA = playerA.military - milBeforeA;
  const gainB = playerB.military - milBeforeB;
  assert.ok(gainB > gainA * 3.0);

  playerB.military = 50;
  assert.equal(buildStructure(simB, playerB.id, 'mine', 0), true);
  playerB.manpower = 150;
  stepSimulation(simB, 0.05, false);
  assert.ok(playerB.manpower > 150);
});

test('War Forge grants +25% attack power and elite status to dispatched troops', () => {
  const sim = createInitialMatch(303, 'normal');
  const player = sim.territories.find((t) => t.owner === 0)!;
  const target = sim.territories[player.neighbors[0]];
  target.biome = 'plain';
  target.owner = -1;
  target.manpower = 0;
  target.military = 22;

  player.military = 72;
  assert.equal(buildStructure(sim, player.id, 'forge', 0), true);
  assert.equal(player.hasForge, true);

  // Remaining military is 40; sending 50% sends 20 elite troops with 1.25x = 25 effective attack (> 22 defender)
  const res = dispatchTroops(sim, player.id, target.id, 0.5, 0);
  assert.equal(res.ok, true);
  assert.equal(sim.troops[0].attackMultiplier, ECONOMY.FORGE_ATTACK_MULTIPLIER);
  assert.equal(sim.troops[0].isElite, true);

  for (let i = 0; i < 140 && sim.troops.some((tr) => tr.owner === 0); i++) {
    stepSimulation(sim, 0.05, false);
  }
  assert.equal(target.owner, 0, 'Forge +25% attack bonus should break through 22 defenders');
  // 20 Forge troops (25 effective attack) vs 22 defenders -> (25 - 22) / 1.25 = 2.4 survivors
  assert.ok(
    Math.abs(target.military - 2.4) < 0.2,
    `Forge attackers must suffer realistic casualties (expected ~2.4, got ${target.military})`
  );
});

test('Stacked Tower + Royal Shield + Mountain defense applies accurate conquest casualties', () => {
  const sim = createInitialMatch(404, 'normal');
  const player = sim.territories.find((t) => t.owner === 0)!;
  const target = sim.territories[player.neighbors[0]];
  target.biome = 'mountain'; // 0.75x
  target.owner = 1;
  target.manpower = 0;
  target.hasTower = true; // 0.6x
  target.shieldTimer = 10; // 0.5x => total defenseMult = 0.225
  target.military = 10;

  player.military = 101;
  const res = dispatchTroops(sim, player.id, target.id, 1.0, 0);
  assert.equal(res.sent, 100);

  for (let i = 0; i < 160 && sim.troops.length > 0; i++) {
    target.manpower = 0;
    stepSimulation(sim, 0.05, false);
  }
  assert.equal(target.owner, 0);
  // 100 * 0.225 = 22.5 effective attack vs 10 defenders => (22.5 - 10) / 0.225 = 55.56 survivors
  assert.ok(
    Math.abs(target.military - 55.555) < 0.2,
    `Stacked defense should not clamp survivor divisor at 0.4 (expected ~55.56, got ${target.military})`
  );
});

test('AI does not launch suicidal partial attacks or ping-pong rear troops between interior castles', () => {
  const sim = createInitialMatch(606, 'normal');
  // Put all territories under faction 1 except one distant enemy (0)
  for (const t of sim.territories) {
    t.owner = 1;
    t.military = 10;
  }
  const enemy = sim.territories[0];
  enemy.owner = 0;
  enemy.biome = 'plain';
  enemy.military = 20;

  // Give one frontline neighbor 25 troops: 52% wave = 13 < 20 defenders, so AI should hold rather than feed
  const frontline = sim.territories[enemy.neighbors[0]];
  frontline.military = 25;
  frontline.hasMine = true;
  frontline.hasBarracks = true;

  // Find two non-frontline rear castles at distance >= 2 from enemy (if map has depth >= 2)
  const rearCastles = sim.territories.filter(
    (t) =>
      t.owner === 1 &&
      t.id !== frontline.id &&
      !t.neighbors.includes(enemy.id)
  );
  for (const r of rearCastles) {
    r.military = 26;
    r.hasMine = true;
    r.hasBarracks = true;
    r.hasTower = true;
    r.hasForge = true;
  }

  const events: SimEvent[] = [];
  evaluateAI(sim, events, false);

  const suicidalAttack = events.find(
    (e) => e.type === 'dispatch' && e.x === frontline.x && e.y === frontline.y
  );
  assert.equal(suicidalAttack, undefined, 'AI should not send 13 troops into 20 defenders');

  // Verify any rear dispatch strictly moves closer to the frontline (no same-tier ping-pong)
  const dist = new Map<number, number>();
  const q: number[] = [];
  for (const t of sim.territories) {
    if (t.owner === 1 && t.neighbors.includes(enemy.id)) {
      dist.set(t.id, 0);
      q.push(t.id);
    }
  }
  for (let i = 0; i < q.length; i++) {
    const cur = q[i];
    for (const nId of sim.territories[cur].neighbors) {
      if (sim.territories[nId].owner === 1 && !dist.has(nId)) {
        dist.set(nId, dist.get(cur)! + 1);
        q.push(nId);
      }
    }
  }
  for (const tr of sim.troops) {
    if (tr.owner === 1 && tr.toId !== enemy.id) {
      assert.ok(
        (dist.get(tr.toId) ?? 99) < (dist.get(tr.fromId) ?? 0),
        'Rear supply troops must move strictly closer to the frontline'
      );
    }
  }
});

test('Commander Powers (Mobilize, Blitz, Royal Shield) apply effects and enforce cooldowns', () => {
  const sim = createInitialMatch(505, 'normal');
  const player = sim.territories.find((t) => t.owner === 0)!;
  player.manpower = 60;
  player.military = 20;

  // 1. Mobilize converts 60% of manpower (36) into military immediately
  assert.equal(triggerCommanderPower(sim, 'mobilize', player.id), true);
  assert.equal(player.manpower, 24);
  assert.equal(player.military, 56);
  assert.equal(sim.powers.cooldowns.mobilize, COMMANDER_POWERS.mobilize.cooldown);
  assert.equal(triggerCommanderPower(sim, 'mobilize', player.id), false, 'Should reject during cooldown');

  // 2. Blitz activates 2x speed timer
  assert.equal(triggerCommanderPower(sim, 'blitz', player.id), true);
  assert.equal(sim.powers.blitzTimer, COMMANDER_POWERS.blitz.duration);

  // 3. Royal Shield activates castle barrier timer
  assert.equal(triggerCommanderPower(sim, 'shield', player.id), true);
  assert.equal(player.shieldTimer, COMMANDER_POWERS.shield.duration);
});

test('dispatchTroops enforces shared borders and Guard Tower reduces incoming enemy attack power', () => {
  const sim = createInitialMatch(777, 'normal');
  const player = sim.territories.find((t) => t.owner === 0)!;
  const target = sim.territories[player.neighbors[0]];
  const nonNeighbor = sim.territories.find(
    (t) => t.id !== player.id && !player.neighbors.includes(t.id)
  )!;

  player.military = 80;
  assert.equal(dispatchTroops(sim, player.id, nonNeighbor.id, 0.5, 0).reason, 'not_neighbor');

  target.biome = 'plain';
  target.owner = 1;
  target.military = 30;
  target.hasTower = true;

  const events: SimEvent[] = [];
  const res = dispatchTroops(sim, player.id, target.id, 0.5, 0, events);
  assert.equal(res.sent, 40);

  for (let i = 0; i < 120 && sim.troops.length > 0; i++) {
    stepSimulation(sim, 0.05, false);
  }
  assert.equal(target.owner, 1, 'Defender with Guard Tower should hold against 40 troops');
});

test('getTerritoryAtPoint, AI decisions, and victory/defeat outcomes work cleanly', () => {
  const sim = createInitialMatch(2026, 'hard');
  const player = sim.territories.find((t) => t.owner === 0)!;
  assert.equal(getTerritoryAtPoint(sim, player.x, player.y)?.id, player.id);

  const aiTerr = sim.territories.find((t) => t.owner === 1)!;
  aiTerr.military = 60;
  const events: SimEvent[] = [];
  evaluateAI(sim, events, false);
  assert.ok(events.some((e) => e.owner === 1 && (e.type === 'build' || e.type === 'dispatch')));

  assert.equal(checkGameOutcome(sim), 'none');
  for (const t of sim.territories) t.owner = 0;
  assert.equal(checkGameOutcome(sim), 'victory');
  for (const t of sim.territories) t.owner = 2;
  sim.troops = [];
  assert.equal(checkGameOutcome(sim), 'defeat');
});

test('tactical preview, rallyReinforcements, castle cycling, weakest neighbor, and speedMultiplier work accurately', () => {
  const sim = createInitialMatch(9090, 'normal');
  const capital = sim.territories.find((t) => t.owner === 0)!;
  const allyNeighbor = sim.territories[capital.neighbors[0]];
  const enemyNeighbor =
    sim.territories[capital.neighbors.find((id) => id !== allyNeighbor.id) ?? capital.neighbors[0]];

  // Make allyNeighbor player-owned with troops ready to rally
  allyNeighbor.owner = 0;
  allyNeighbor.military = 30;
  capital.military = 40;
  enemyNeighbor.owner = 2;
  enemyNeighbor.biome = 'plain';
  enemyNeighbor.military = 12;

  // 1. previewAttackOutcome accurately predicts victory vs friendly reinforcement
  const atkPreview = previewAttackOutcome(sim, capital.id, enemyNeighbor.id, 0.5);
  assert.ok(atkPreview !== null);
  assert.equal(atkPreview.isFriendly, false);
  assert.equal(atkPreview.sendAmount, 20);
  assert.equal(atkPreview.willConquer, true);

  const allyPreview = previewAttackOutcome(sim, capital.id, allyNeighbor.id, 0.5);
  assert.ok(allyPreview !== null && allyPreview.isFriendly === true);

  // 2. rallyReinforcements sends troops from adjacent friendly castles
  const rallyEvents: SimEvent[] = [];
  const rallyRes = rallyReinforcements(sim, capital.id, 0, 0.5, rallyEvents);
  assert.equal(rallyRes.squadsSent, 1);
  assert.equal(rallyRes.totalSent, 15);
  assert.equal(sim.troops.length, 1);

  // 3. cycleOwnedTerritory cycles through player castles forward and reverse
  const cycled = cycleOwnedTerritory(sim, capital.id, 0, false);
  assert.equal(cycled, allyNeighbor.id);
  const cycledBack = cycleOwnedTerritory(sim, cycled, 0, true);
  assert.equal(cycledBack, capital.id);

  // 4. getWeakestEnemyNeighbor picks lowest effective defense neighbor
  const weakest = getWeakestEnemyNeighbor(sim, capital.id);
  assert.ok(weakest !== null && weakest.owner !== 0);

  // 5. speedMultiplier scales elapsed simulation time accurately
  const t0 = sim.stats.elapsedSeconds;
  stepSimulation(sim, 0.05, false, 2.0);
  assert.ok(Math.abs(sim.stats.elapsedSeconds - (t0 + 0.1)) < 1e-6);
});

test('troopSpeedScale accelerates marching troops independently of economy and clamps extreme values', () => {
  const simBase = createInitialMatch(5151, 'normal');
  const simBoost = createInitialMatch(5151, 'normal');
  const simExtremeLow = createInitialMatch(5151, 'normal');
  const simExtremeHigh = createInitialMatch(5151, 'normal');

  for (const s of [simBase, simBoost, simExtremeLow, simExtremeHigh]) {
    const cap = s.territories.find((t) => t.owner === 0)!;
    const target = s.territories[cap.neighbors[0]];
    cap.military = 40;
    dispatchTroops(s, cap.id, target.id, 0.5, 0);
  }

  const capBaseBefore = simBase.territories.find((t) => t.owner === 0)!.military;
  const capBoostBefore = simBoost.territories.find((t) => t.owner === 0)!.military;

  stepSimulation(simBase, 0.05, false, 1.0, 1.0);
  stepSimulation(simBoost, 0.05, false, 1.0, 1.35);
  stepSimulation(simExtremeLow, 0.05, false, 1.0, 0.1);
  stepSimulation(simExtremeHigh, 0.05, false, 1.0, 5.0);

  const pBase = simBase.troops[0].progress;
  const pBoost = simBoost.troops[0].progress;
  const pLow = simExtremeLow.troops[0].progress;
  const pHigh = simExtremeHigh.troops[0].progress;

  assert.ok(Math.abs(pBoost / pBase - 1.35) < 1e-6, '1.35 troopSpeedScale should scale troop march progress by 1.35x');
  assert.ok(Math.abs(pLow / pBase - 0.7) < 1e-6, 'Extreme low troopSpeedScale should clamp to 0.7x');
  assert.ok(Math.abs(pHigh / pBase - 1.6) < 1e-6, 'Extreme high troopSpeedScale should clamp to 1.6x');
  assert.equal(simBase.stats.elapsedSeconds, simBoost.stats.elapsedSeconds);
  assert.equal(
    simBase.territories.find((t) => t.owner === 0)!.military - capBaseBefore,
    simBoost.territories.find((t) => t.owner === 0)!.military - capBoostBefore
  );
});

