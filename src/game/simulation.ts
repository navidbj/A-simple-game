import {
  BIOMES,
  BUILDINGS,
  COMMANDER_POWERS,
  DIFFICULTIES,
  ECONOMY,
  FACTIONS,
} from './constants';
import { createRng, generateOrganicMap } from './mapGenerator';
import type {
  BuildingType,
  Difficulty,
  FactionId,
  FactionPowerEntry,
  GameOutcome,
  GamePhase,
  GameSimulation,
  HudSnapshot,
  PowerType,
  SimEvent,
  Territory,
} from './types';

export function createInitialMatch(seed: number, difficulty: Difficulty): GameSimulation {
  const { map, territories } = generateOrganicMap(seed);
  return {
    seed,
    difficulty,
    map,
    territories,
    troops: [],
    nextTroopId: 1,
    aiTimer: 0,
    outcome: 'none',
    stats: {
      elapsedSeconds: 0,
      territoriesCaptured: 0,
      buildingsConstructed: 0,
      battlesWon: 0,
      troopsDispatched: 0,
    },
    powers: {
      cooldowns: {
        mobilize: 0,
        blitz: 0,
        shield: 0,
      },
      blitzTimer: 0,
    },
    mapDirty: true,
    hitstopTimer: 0,
    shakeTrauma: 0,
  };
}

/** Finds which territory contains a world point (direct castle radius + organic Voronoi lookup) */
export function getTerritoryAtPoint(
  sim: GameSimulation,
  worldX: number,
  worldY: number,
  hitRadius = 34
): Territory | null {
  let closest: Territory | null = null;
  let minD = hitRadius;
  for (const t of sim.territories) {
    const d = Math.hypot(t.x - worldX, t.y - worldY);
    if (d <= minD) {
      minD = d;
      closest = t;
    }
  }
  if (closest) return closest;

  const { map } = sim;
  const gx = Math.floor(worldX / map.step);
  const gy = Math.floor(worldY / map.step);
  if (gx < 0 || gy < 0 || gx >= map.cols || gy >= map.rows) return null;

  const cellId = map.cells[gy * map.cols + gx];
  if (cellId < 0 || cellId >= sim.territories.length) return null;
  return sim.territories[cellId];
}

export function getTerritoryRates(t: Territory, growthBonus = 1.0) {
  const biome = BIOMES[t.biome];
  const maxManpower = t.hasMine ? ECONOMY.MINE_MAX_MANPOWER : ECONOMY.BASE_MAX_MANPOWER;
  const manpowerRate =
    (t.hasMine ? ECONOMY.MINE_MANPOWER_GROWTH : ECONOMY.BASE_MANPOWER_GROWTH) *
    biome.manpowerGrowthMult *
    growthBonus;
  const conversionSpeed =
    ECONOMY.BASE_CONVERSION_RATE * (t.hasBarracks ? ECONOMY.BARRACKS_CONVERSION_MULTIPLIER : 1.0);
  const conversionYield = t.hasBarracks
    ? ECONOMY.BARRACKS_CONVERSION_YIELD
    : ECONOMY.BASE_CONVERSION_YIELD;

  return {
    maxManpower,
    manpowerRate,
    conversionSpeed,
    conversionYield,
    netMilitaryPerSec: conversionSpeed * conversionYield,
  };
}

export function isBuildingBuilt(
  t: Pick<Territory, 'hasBarracks' | 'hasTower' | 'hasMine' | 'hasForge'>,
  building: BuildingType
): boolean {
  if (building === 'barracks') return t.hasBarracks;
  if (building === 'tower') return t.hasTower;
  if (building === 'mine') return t.hasMine;
  return t.hasForge;
}

export function canBuildStructure(t: Territory, building: BuildingType): boolean {
  if (t.owner === -1) return false;
  if (isBuildingBuilt(t, building)) return false;
  return t.military >= BUILDINGS[building].cost;
}

export function buildStructure(
  sim: GameSimulation,
  territoryId: number,
  building: BuildingType,
  requester: Exclude<FactionId, -1>,
  events?: SimEvent[]
): boolean {
  const t = sim.territories[territoryId];
  if (!t || t.owner !== requester) return false;
  if (!canBuildStructure(t, building)) return false;

  t.military -= BUILDINGS[building].cost;
  if (building === 'barracks') t.hasBarracks = true;
  if (building === 'tower') t.hasTower = true;
  if (building === 'mine') t.hasMine = true;
  if (building === 'forge') t.hasForge = true;

  if (requester === 0) {
    sim.stats.buildingsConstructed += 1;
  }

  events?.push({
    type: 'build',
    x: t.x,
    y: t.y,
    owner: requester,
    building,
  });

  return true;
}

export function canTriggerCommanderPower(
  sim: GameSimulation,
  power: PowerType,
  selectedId: number | null
): boolean {
  if (sim.powers.cooldowns[power] > 0) return false;
  const cfg = COMMANDER_POWERS[power];
  if (cfg.requiresSelectedOwnCastle) {
    if (selectedId === null) return false;
    const t = sim.territories[selectedId];
    if (!t || t.owner !== 0) return false;
    if (power === 'mobilize' && t.manpower < 6) return false;
  }
  return true;
}

export function triggerCommanderPower(
  sim: GameSimulation,
  power: PowerType,
  selectedId: number | null,
  events?: SimEvent[]
): boolean {
  if (!canTriggerCommanderPower(sim, power, selectedId)) return false;
  const cfg = COMMANDER_POWERS[power];

  if (power === 'mobilize') {
    const t = sim.territories[selectedId!]!;
    const converted = Math.floor(t.manpower * ECONOMY.MOBILIZE_RATIO);
    if (converted < 1) return false;
    t.manpower -= converted;
    t.military += converted;
    t.capturePulse = 0.7;
    sim.powers.cooldowns.mobilize = cfg.cooldown;
    events?.push({
      type: 'power',
      power: 'mobilize',
      x: t.x,
      y: t.y,
      owner: 0,
      amount: converted,
    });
    return true;
  }

  if (power === 'blitz') {
    sim.powers.blitzTimer = cfg.duration;
    sim.powers.cooldowns.blitz = cfg.cooldown;
    const anchor =
      (selectedId !== null ? sim.territories[selectedId] : null) ??
      sim.territories.find((t) => t.owner === 0) ??
      sim.territories[0];
    events?.push({
      type: 'power',
      power: 'blitz',
      x: anchor.x,
      y: anchor.y,
      owner: 0,
    });
    return true;
  }

  if (power === 'shield') {
    const t = sim.territories[selectedId!]!;
    t.shieldTimer = cfg.duration;
    t.capturePulse = 0.65;
    sim.powers.cooldowns.shield = cfg.cooldown;
    events?.push({
      type: 'power',
      power: 'shield',
      x: t.x,
      y: t.y,
      owner: 0,
    });
    return true;
  }

  return false;
}

export interface DispatchResult {
  ok: boolean;
  reason?: 'invalid' | 'not_owner' | 'not_neighbor' | 'insufficient_troops';
  sent?: number;
}

export function dispatchTroops(
  sim: GameSimulation,
  fromId: number,
  toId: number,
  ratio: number,
  requester: Exclude<FactionId, -1>,
  events?: SimEvent[]
): DispatchResult {
  if (fromId === toId) return { ok: false, reason: 'invalid' };
  const from = sim.territories[fromId];
  const to = sim.territories[toId];
  if (!from || !to) return { ok: false, reason: 'invalid' };
  if (from.owner !== requester) return { ok: false, reason: 'not_owner' };
  if (!from.neighbors.includes(toId)) return { ok: false, reason: 'not_neighbor' };

  const clampedRatio = Math.max(0.1, Math.min(1.0, ratio));
  const maxSendable = Math.floor(from.military - 1);
  if (maxSendable < 1) return { ok: false, reason: 'insufficient_troops' };

  const amount = Math.max(1, Math.min(maxSendable, Math.floor(from.military * clampedRatio)));
  from.military -= amount;

  const crossing = from.borderCrossings[toId] ?? {
    x: (from.x + to.x) * 0.5,
    y: (from.y + to.y) * 0.5,
  };

  const attackMultiplier = from.hasForge ? ECONOMY.FORGE_ATTACK_MULTIPLIER : 1.0;

  sim.troops.push({
    id: sim.nextTroopId++,
    fromId,
    toId,
    startX: from.x,
    startY: from.y,
    viaX: crossing.x,
    viaY: crossing.y,
    targetX: to.x,
    targetY: to.y,
    x: from.x,
    y: from.y,
    facingLeft: to.x < from.x,
    progress: 0,
    speed: ECONOMY.TROOP_SPEED,
    count: amount,
    owner: requester,
    attackMultiplier,
    isElite: from.hasForge || amount >= 25,
  });

  if (requester === 0) {
    sim.stats.troopsDispatched += amount;
  }

  events?.push({
    type: 'dispatch',
    x: from.x,
    y: from.y,
    toX: crossing.x,
    toY: crossing.y,
    owner: requester,
    amount,
    isElite: from.hasForge || amount >= 25,
  });

  return { ok: true, sent: amount };
}

/** Quadratic Bezier interpolation through shared border crossing */
function evalRoutePoint(
  t: number,
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number
): [number, number] {
  const mt = 1 - t;
  return [
    mt * mt * x0 + 2 * mt * t * cx + t * t * x1,
    mt * mt * y0 + 2 * mt * t * cy + t * t * y1,
  ];
}

function getEffectiveDefenseMultiplier(target: Territory): number {
  let mult = BIOMES[target.biome].defenseDamageMult;
  if (target.hasTower) mult *= ECONOMY.TOWER_DAMAGE_MULTIPLIER;
  if (target.shieldTimer > 0) mult *= ECONOMY.SHIELD_DAMAGE_MULTIPLIER;
  return mult;
}

function resolveTroopArrival(
  sim: GameSimulation,
  troop: GameSimulation['troops'][number],
  events: SimEvent[]
) {
  const target = sim.territories[troop.toId];
  if (!target) return;

  if (target.owner === troop.owner) {
    target.military += troop.count;
    events.push({
      type: 'reinforce',
      x: target.x,
      y: target.y,
      fromX: troop.viaX,
      fromY: troop.viaY,
      owner: troop.owner,
      amount: troop.count,
      isElite: troop.isElite,
    });
    return;
  }

  const rawAttack = troop.count * troop.attackMultiplier;
  const defenseMult = getEffectiveDefenseMultiplier(target);
  const effectiveAttack = rawAttack * defenseMult;

  target.hitFlash = 0.2;
  if (target.hasTower || target.shieldTimer > 0) {
    target.towerFireTimer = 0.45;
    const blocked = Math.round(rawAttack - effectiveAttack);
    if (blocked > 0) {
      events.push({
        type: 'tower_block',
        x: target.x,
        y: target.y,
        fromX: troop.viaX,
        fromY: troop.viaY,
        owner: target.owner,
        amount: blocked,
      });
    }
  }

  if (target.military >= effectiveAttack) {
    target.military -= effectiveAttack;
    if (troop.owner === 0 || target.owner === 0) {
      sim.shakeTrauma = Math.min(1, sim.shakeTrauma + Math.min(0.24, 0.08 + effectiveAttack / 140));
    }
    events.push({
      type: 'clash',
      x: target.x,
      y: target.y,
      fromX: troop.viaX,
      fromY: troop.viaY,
      owner: troop.owner,
      amount: Math.round(effectiveAttack),
      isElite: troop.isElite,
    });
    return;
  }

  // Conquest! Divide remaining effective damage by both defense and attack multipliers
  const damagePerSoldier = Math.max(0.05, defenseMult * troop.attackMultiplier);
  const remaining = Math.max(1, (effectiveAttack - target.military) / damagePerSoldier);
  target.owner = troop.owner;
  target.military = Math.min(troop.count, remaining);
  target.manpower = Math.max(8, target.manpower * 0.35);
  target.hasBarracks = false;
  target.hasTower = false;
  target.hasMine = false;
  target.hasForge = false;
  target.shieldTimer = 0;
  target.capturePulse = 1.0;
  sim.mapDirty = true;

  if (troop.owner === 0) {
    sim.stats.territoriesCaptured += 1;
    sim.stats.battlesWon += 1;
    sim.hitstopTimer = 0.045;
    sim.shakeTrauma = Math.min(1, sim.shakeTrauma + 0.45);
  } else {
    sim.shakeTrauma = Math.min(1, sim.shakeTrauma + 0.22);
  }

  events.push({
    type: 'capture',
    x: target.x,
    y: target.y,
    fromX: troop.viaX,
    fromY: troop.viaY,
    owner: troop.owner,
    amount: Math.round(target.military),
    isElite: troop.isElite,
    capturedByPlayer: troop.owner === 0,
  });
}

export function evaluateAI(sim: GameSimulation, events: SimEvent[], demoMode = false) {
  const diff = DIFFICULTIES[sim.difficulty];
  const playerCount = sim.territories.filter((t) => t.owner === 0).length;
  const rng = createRng(
    (sim.seed ^ Math.floor(sim.stats.elapsedSeconds * 1000) ^ sim.nextTroopId) >>> 0
  );

  const counts = new Map<number, number>();
  for (const t of sim.territories) {
    if (t.owner >= 0) {
      counts.set(t.owner, (counts.get(t.owner) ?? 0) + 1);
    }
  }

  // Track incoming threats and already-dispatched friendly waves per territory
  const incomingThreat = new Float64Array(sim.territories.length);
  const enRouteAttack = new Map<string, number>();
  for (const tr of sim.troops) {
    const dest = sim.territories[tr.toId];
    if (!dest) continue;
    const raw = tr.count * tr.attackMultiplier;
    if (dest.owner !== tr.owner) {
      incomingThreat[tr.toId] += raw;
    }
    const key = `${tr.owner}:${tr.toId}`;
    enRouteAttack.set(key, (enRouteAttack.get(key) ?? 0) + raw);
  }

  // BFS distance from each faction's frontline so rear castles reinforce forward without ping-ponging
  const distToFront = new Int16Array(sim.territories.length).fill(-1);
  const bfsQueue: number[] = [];
  for (const t of sim.territories) {
    if (t.owner < 0) continue;
    if (t.neighbors.some((nId) => sim.territories[nId].owner !== t.owner)) {
      distToFront[t.id] = 0;
      bfsQueue.push(t.id);
    }
  }
  for (let head = 0; head < bfsQueue.length; head++) {
    const curId = bfsQueue[head];
    const curOwner = sim.territories[curId].owner;
    const nextDist = distToFront[curId] + 1;
    for (const nId of sim.territories[curId].neighbors) {
      if (sim.territories[nId].owner === curOwner && distToFront[nId] === -1) {
        distToFront[nId] = nextDist;
        bfsQueue.push(nId);
      }
    }
  }

  for (const t of sim.territories) {
    if (t.owner === -1) continue;
    if (!demoMode && t.owner === 0) continue;

    const faction = FACTIONS[t.owner];
    const personality = faction.personality ?? 'balanced';
    const neighbors = t.neighbors.map((id) => sim.territories[id]);
    const enemyNeighbors = neighbors.filter((n) => n.owner !== t.owner);
    const friendlyNeighbors = neighbors.filter((n) => n.owner === t.owner);
    const isFrontline = enemyNeighbors.length > 0;
    const safeMilitary = t.military - incomingThreat[t.id] * getEffectiveDefenseMultiplier(t);

    // 1. Strategic Building Decisions (including War Forge for aggressors!)
    if (safeMilitary >= 28) {
      if (
        !t.hasMine &&
        t.military >= BUILDINGS.mine.cost + (isFrontline ? 14 : 6) &&
        (!isFrontline || t.biome === 'fertile' || personality === 'fortifier')
      ) {
        buildStructure(sim, t.id, 'mine', t.owner, events);
        continue;
      }

      if (
        !t.hasForge &&
        isFrontline &&
        t.military >= BUILDINGS.forge.cost + 12 &&
        (personality === 'aggressor' || personality === 'opportunist')
      ) {
        buildStructure(sim, t.id, 'forge', t.owner, events);
        continue;
      }

      if (
        !t.hasTower &&
        isFrontline &&
        enemyNeighbors.length >= 2 &&
        t.military >= BUILDINGS.tower.cost + 10 &&
        (personality === 'fortifier' ||
          t.biome === 'mountain' ||
          enemyNeighbors.some((e) => e.owner === 0))
      ) {
        buildStructure(sim, t.id, 'tower', t.owner, events);
        continue;
      }

      if (!t.hasBarracks && t.military >= BUILDINGS.barracks.cost + 8) {
        buildStructure(sim, t.id, 'barracks', t.owner, events);
        continue;
      }
    }

    // 2. Interior Supply Lines: Route troops strictly closer to the frontline
    if (!isFrontline && friendlyNeighbors.length > 0 && t.military > 24) {
      const myDist = distToFront[t.id];
      const closerAllies = friendlyNeighbors.filter(
        (f) => distToFront[f.id] >= 0 && distToFront[f.id] < myDist
      );
      if (closerAllies.length > 0) {
        closerAllies.sort((a, b) => a.military - b.military);
        dispatchTroops(sim, t.id, closerAllies[0].id, 0.65, t.owner, events);
      }
      continue;
    }

    // 3. Tactical Offensive Evaluation based on actual dispatched wave strength
    if (isFrontline && safeMilitary > 16) {
      const sendCount = Math.min(
        Math.floor(t.military - 1),
        Math.floor(t.military * diff.aiAggressionRatio)
      );
      if (sendCount < 1 || sendCount > safeMilitary) continue;

      let bestTarget: Territory | null = null;
      let bestScore = -Infinity;
      const myAttackMult = t.hasForge ? ECONOMY.FORGE_ATTACK_MULTIPLIER : 1.0;

      for (const n of enemyNeighbors) {
        const defMult = getEffectiveDefenseMultiplier(n);
        const effectiveDefense = n.military / Math.max(0.25, defMult);
        const enRoute = enRouteAttack.get(`${t.owner}:${n.id}`) ?? 0;
        const advantage = (sendCount * myAttackMult + enRoute) / Math.max(4, effectiveDefense);

        let threshold = diff.aiAttackThreshold;
        if (personality === 'aggressor') threshold *= 0.9;
        if (personality === 'fortifier') threshold *= 1.12;
        if (n.owner === -1 && personality === 'expander') threshold *= 0.85;

        if (advantage < threshold) continue;

        let score = advantage * 40 - effectiveDefense * 0.6;
        if (n.owner === -1) score += personality === 'expander' ? 28 : 14;
        if (!demoMode && n.owner === 0 && playerCount >= diff.playerThreatThreshold) {
          score += 32;
        }
        if (personality === 'opportunist' && n.owner >= 0 && (counts.get(n.owner) ?? 0) <= 2) {
          score += 22;
        }
        score += rng() * 6;

        if (score > bestScore) {
          bestScore = score;
          bestTarget = n;
        }
      }

      if (bestTarget) {
        dispatchTroops(sim, t.id, bestTarget.id, diff.aiAggressionRatio, t.owner, events);
      }
    }
  }
}

export function checkGameOutcome(sim: GameSimulation): GameOutcome {
  let playerOwned = 0;
  const total = sim.territories.length;
  for (const t of sim.territories) {
    if (t.owner === 0) playerOwned++;
  }
  if (playerOwned === total) return 'victory';
  const playerTroopsInFlight = sim.troops.some((tr) => tr.owner === 0);
  if (playerOwned === 0 && !playerTroopsInFlight) return 'defeat';
  return 'none';
}

export function computeFactionPowers(sim: GameSimulation): FactionPowerEntry[] {
  const map = new Map<number, FactionPowerEntry>();
  for (const f of FACTIONS) {
    map.set(f.id, {
      id: f.id,
      name: f.shortName,
      color: f.color,
      territories: 0,
      totalMilitary: 0,
    });
  }
  for (const t of sim.territories) {
    if (t.owner >= 0) {
      const entry = map.get(t.owner)!;
      entry.territories += 1;
      entry.totalMilitary += Math.floor(t.military);
    }
  }
  for (const tr of sim.troops) {
    const entry = map.get(tr.owner);
    if (entry) entry.totalMilitary += Math.floor(tr.count);
  }
  return Array.from(map.values());
}

export interface AttackPreview {
  sendAmount: number;
  isFriendly: boolean;
  effectiveAttack: number;
  defenderMilitary: number;
  willConquer: boolean;
  advantageRatio: number;
  defenseBonusPct: number;
}

/** Computes an accurate live preview of dispatching troops from one territory to an adjacent neighbor */
export function previewAttackOutcome(
  sim: GameSimulation,
  fromId: number,
  toId: number,
  ratio: number
): AttackPreview | null {
  const from = sim.territories[fromId];
  const to = sim.territories[toId];
  if (!from || !to || !from.neighbors.includes(toId)) return null;

  const clampedRatio = Math.max(0.1, Math.min(1.0, ratio));
  const maxSendable = Math.max(0, Math.floor(from.military - 1));
  const sendAmount =
    maxSendable < 1 ? 0 : Math.max(1, Math.min(maxSendable, Math.floor(from.military * clampedRatio)));

  if (from.owner === to.owner) {
    return {
      sendAmount,
      isFriendly: true,
      effectiveAttack: sendAmount,
      defenderMilitary: Math.floor(to.military),
      willConquer: false,
      advantageRatio: 1,
      defenseBonusPct: 0,
    };
  }

  const attackMult = from.hasForge ? ECONOMY.FORGE_ATTACK_MULTIPLIER : 1.0;
  const defenseMult = getEffectiveDefenseMultiplier(to);
  const effectiveAttack = sendAmount * attackMult * defenseMult;
  const defenderMilitary = to.military;
  const defenseBonusPct = Math.round((1 - defenseMult) * 100);

  return {
    sendAmount,
    isFriendly: false,
    effectiveAttack,
    defenderMilitary,
    willConquer: effectiveAttack > defenderMilitary,
    advantageRatio: defenderMilitary <= 0 ? 2 : effectiveAttack / defenderMilitary,
    defenseBonusPct,
  };
}

/** Calls reinforcements from all adjacent friendly territories toward a chosen friendly castle */
export function rallyReinforcements(
  sim: GameSimulation,
  targetId: number,
  requester: Exclude<FactionId, -1>,
  ratio = 0.5,
  events?: SimEvent[],
  excludeFromId?: number
): { squadsSent: number; totalSent: number } {
  const target = sim.territories[targetId];
  if (!target || target.owner !== requester) {
    return { squadsSent: 0, totalSent: 0 };
  }

  let squadsSent = 0;
  let totalSent = 0;

  for (const nId of target.neighbors) {
    if (nId === excludeFromId) continue;
    const neighbor = sim.territories[nId];
    if (!neighbor || neighbor.owner !== requester) continue;
    if (neighbor.military < 4) continue;

    const res = dispatchTroops(sim, neighbor.id, targetId, ratio, requester, events);
    if (res.ok && res.sent) {
      squadsSent += 1;
      totalSent += res.sent;
    }
  }

  return { squadsSent, totalSent };
}

/** Cycles cleanly through player-owned territories (frontline territories prioritized first) */
export function cycleOwnedTerritory(
  sim: GameSimulation,
  currentId: number | null,
  owner: Exclude<FactionId, -1>,
  reverse = false
): number | null {
  const owned = sim.territories.filter((t) => t.owner === owner);
  if (owned.length === 0) return null;

  // Sort frontline castles first, then by military descending for intuitive cycling
  owned.sort((a, b) => {
    const aFront = a.neighbors.some((n) => sim.territories[n].owner !== owner) ? 1 : 0;
    const bFront = b.neighbors.some((n) => sim.territories[n].owner !== owner) ? 1 : 0;
    if (aFront !== bFront) return bFront - aFront;
    return a.id - b.id;
  });

  if (currentId === null) return owned[0].id;
  const idx = owned.findIndex((t) => t.id === currentId);
  if (idx === -1) return owned[0].id;
  const step = reverse ? -1 : 1;
  return owned[(idx + step + owned.length) % owned.length].id;
}

/** Picks the weakest adjacent enemy/neutral territory for quick-attack shortcut */
export function getWeakestEnemyNeighbor(
  sim: GameSimulation,
  fromId: number
): Territory | null {
  const from = sim.territories[fromId];
  if (!from) return null;
  const enemies = from.neighbors
    .map((id) => sim.territories[id])
    .filter((n) => n && n.owner !== from.owner);
  if (enemies.length === 0) return null;

  enemies.sort((a, b) => {
    const aDef = a.military / Math.max(0.25, getEffectiveDefenseMultiplier(a));
    const bDef = b.military / Math.max(0.25, getEffectiveDefenseMultiplier(b));
    return aDef - bDef;
  });
  return enemies[0];
}

/** Advances the pure game simulation by clamped dt (seconds) */
export function stepSimulation(
  sim: GameSimulation,
  rawDt: number,
  demoMode = false,
  speedMultiplier = 1.0
): SimEvent[] {
  const clamped = Math.min(Math.max(rawDt, 0), 0.05);
  const dt = clamped * Math.max(0.5, Math.min(2.5, speedMultiplier));
  const events: SimEvent[] = [];

  // Decay visual timers in real-time (independent of speedMultiplier)
  sim.shakeTrauma = Math.max(0, sim.shakeTrauma - clamped * 1.9);
  for (const t of sim.territories) {
    if (t.hitFlash > 0) t.hitFlash = Math.max(0, t.hitFlash - clamped);
    if (t.capturePulse > 0) t.capturePulse = Math.max(0, t.capturePulse - clamped * 1.4);
    if (t.towerFireTimer > 0) t.towerFireTimer = Math.max(0, t.towerFireTimer - clamped);
  }

  if (sim.hitstopTimer > 0) {
    sim.hitstopTimer = Math.max(0, sim.hitstopTimer - clamped);
    return events;
  }

  if (!demoMode && sim.outcome !== 'none') {
    return events;
  }

  sim.stats.elapsedSeconds += dt;
  const diff = DIFFICULTIES[sim.difficulty];

  // Update Commander Power Cooldowns & Active Timers
  sim.powers.cooldowns.mobilize = Math.max(0, sim.powers.cooldowns.mobilize - dt);
  sim.powers.cooldowns.blitz = Math.max(0, sim.powers.cooldowns.blitz - dt);
  sim.powers.cooldowns.shield = Math.max(0, sim.powers.cooldowns.shield - dt);
  sim.powers.blitzTimer = Math.max(0, sim.powers.blitzTimer - dt);

  for (const t of sim.territories) {
    if (t.shieldTimer > 0) {
      t.shieldTimer = Math.max(0, t.shieldTimer - dt);
    }
  }

  // 1. Update Territory Economy (Biome + Mine Manpower Growth & Barracks Conversion)
  for (const t of sim.territories) {
    if (t.owner === -1) continue;
    const growthBonus = t.owner === 0 ? 1.0 : diff.aiGrowthBonus;
    const rates = getTerritoryRates(t, growthBonus);

    if (t.manpower < rates.maxManpower) {
      t.manpower = Math.min(rates.maxManpower, t.manpower + dt * rates.manpowerRate);
    }

    if (t.manpower > ECONOMY.MIN_MANPOWER_RESERVE) {
      const convertible = Math.min(
        t.manpower - ECONOMY.MIN_MANPOWER_RESERVE,
        dt * rates.conversionSpeed
      );
      t.manpower -= convertible;
      t.military += convertible * rates.conversionYield;
    }
  }

  // 2. Advance Marching Troops along Border Crossing Curves
  for (let i = sim.troops.length - 1; i >= 0; i--) {
    const tr = sim.troops[i];
    const approxLen =
      Math.hypot(tr.viaX - tr.startX, tr.viaY - tr.startY) +
      Math.hypot(tr.targetX - tr.viaX, tr.targetY - tr.viaY);

    const speedMult =
      tr.owner === 0 && sim.powers.blitzTimer > 0 ? ECONOMY.BLITZ_SPEED_MULTIPLIER : 1.0;
    const stepProgress = (tr.speed * speedMult * dt) / Math.max(40, approxLen);
    tr.progress += stepProgress;

    if (tr.progress >= 1) {
      tr.x = tr.targetX;
      tr.y = tr.targetY;
      resolveTroopArrival(sim, tr, events);
      sim.troops.splice(i, 1);
    } else {
      const prevX = tr.x;
      const [nx, ny] = evalRoutePoint(
        tr.progress,
        tr.startX,
        tr.startY,
        tr.viaX,
        tr.viaY,
        tr.targetX,
        tr.targetY
      );
      tr.x = nx;
      tr.y = ny;
      if (Math.abs(nx - prevX) > 0.05) {
        tr.facingLeft = nx < prevX;
      }
    }
  }

  // 3. AI Decision Cadence
  sim.aiTimer += dt;
  const interval = demoMode ? 1.6 : diff.aiInterval;
  if (sim.aiTimer >= interval) {
    sim.aiTimer -= interval;
    evaluateAI(sim, events, demoMode);
  }

  // 4. Victory / Defeat Check (active gameplay only)
  if (!demoMode) {
    const outcome = checkGameOutcome(sim);
    if (outcome !== 'none' && sim.outcome === 'none') {
      sim.outcome = outcome;
      events.push({
        type: outcome,
        x: sim.map.width * 0.5,
        y: sim.map.height * 0.5,
        owner: 0,
      });
    }
  }

  return events;
}

export function buildHudSnapshot(
  sim: GameSimulation,
  phase: GamePhase,
  sendRatio: number,
  selectedId: number | null
): HudSnapshot {
  const sel = selectedId !== null ? sim.territories[selectedId] ?? null : null;
  let playerTerritories = 0;
  let playerMilitary = 0;
  let playerManpower = 0;

  for (const t of sim.territories) {
    if (t.owner === 0) {
      playerTerritories += 1;
      playerMilitary += Math.floor(t.military);
      playerManpower += Math.floor(t.manpower);
    }
  }
  for (const tr of sim.troops) {
    if (tr.owner === 0) {
      playerMilitary += Math.floor(tr.count);
    }
  }

  let selectedTerritory: HudSnapshot['selectedTerritory'] = null;
  if (sel) {
    const bonus = sel.owner <= 0 ? 1.0 : DIFFICULTIES[sim.difficulty].aiGrowthBonus;
    const rates = getTerritoryRates(sel, bonus);
    selectedTerritory = {
      id: sel.id,
      name: sel.name,
      biome: sel.biome,
      owner: sel.owner,
      manpower: sel.manpower,
      maxManpower: rates.maxManpower,
      military: sel.military,
      manpowerRate: rates.manpowerRate,
      conversionRate: rates.netMilitaryPerSec,
      hasBarracks: sel.hasBarracks,
      hasTower: sel.hasTower,
      hasMine: sel.hasMine,
      hasForge: sel.hasForge,
      shieldTimer: sel.shieldTimer,
      neighborCount: sel.neighbors.length,
    };
  }

  return {
    phase,
    outcome: sim.outcome,
    difficulty: sim.difficulty,
    sendRatio,
    selectedId,
    selectedTerritory,
    powers: {
      cooldowns: { ...sim.powers.cooldowns },
      blitzTimer: sim.powers.blitzTimer,
    },
    playerTerritories,
    totalTerritories: sim.territories.length,
    playerMilitary,
    playerManpower,
    elapsedSeconds: sim.stats.elapsedSeconds,
    factionPowers: computeFactionPowers(sim),
    stats: { ...sim.stats },
    mapSeed: sim.seed,
  };
}
