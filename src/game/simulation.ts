import {
  BIOMES,
  BUILDINGS,
  COMMANDER_POWERS,
  DIFFICULTIES,
  ECONOMY,
  FACTIONS,
  MAX_BUILDING_LEVEL,
  TERRITORY_COUNT,
} from './constants';
import { createRng, generateOrganicMap } from './mapGenerator';
import type {
  BuildingLevel,
  BuildingType,
  Difficulty,
  FactionId,
  FactionPowerEntry,
  GameOutcome,
  GamePhase,
  GameSimulation,
  HudSnapshot,
  MapPreset,
  PowerType,
  SimEvent,
  Territory,
} from './types';

export function createInitialMatch(
  seed: number,
  difficulty: Difficulty,
  preset: MapPreset = 'continent'
): GameSimulation {
  const { map, territories } = generateOrganicMap(seed, TERRITORY_COUNT, preset);
  return {
    seed,
    preset,
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
    timelapse: [
      {
        elapsed: 0,
        owners: territories.map((t) => t.owner),
      },
    ],
    timelapseTimer: 0,
  };
}

/** Appends an immutable territory ownership snapshot for the endgame Timelapse player */
export function recordTimelapseSnapshot(sim: GameSimulation, force = false): void {
  const owners = sim.territories.map((t) => t.owner);
  const last = sim.timelapse[sim.timelapse.length - 1];
  if (!force && last) {
    let changed = last.owners.length !== owners.length;
    if (!changed) {
      for (let i = 0; i < owners.length; i++) {
        if (last.owners[i] !== owners[i]) {
          changed = true;
          break;
        }
      }
    }
    if (!changed) return;
  }

  sim.timelapse.push({
    elapsed: sim.stats.elapsedSeconds,
    owners,
  });

  // Cap stored snapshots while always preserving the opening and latest frames
  if (sim.timelapse.length > 96) {
    sim.timelapse.splice(1, 1);
  }
}

/** Computes dynamic 16-bit soundtrack intensity: 0 (calm), 1 (skirmish), 2 (intense battle) */
export function computeBattleIntensity(sim: GameSimulation): 0 | 1 | 2 {
  if (sim.powers.blitzTimer > 0) return 2;

  let enemyAttackingPlayer = false;
  for (const tr of sim.troops) {
    if (tr.owner !== 0 && sim.territories[tr.toId]?.owner === 0) {
      enemyAttackingPlayer = true;
      break;
    }
  }
  if (enemyAttackingPlayer || sim.troops.length >= 6) return 2;
  if (sim.troops.length >= 2) return 1;
  return 0;
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

type BuildingStateLike = Pick<
  Territory,
  'hasBarracks' | 'hasTower' | 'hasMine' | 'hasForge' | 'hasPort'
> & {
  buildingLevels?: Record<BuildingType, BuildingLevel>;
};

export function getBuildingLevel(
  t: BuildingStateLike,
  building: BuildingType
): BuildingLevel {
  const raw = t.buildingLevels?.[building] ?? 0;
  const legacyBuilt =
    building === 'barracks'
      ? t.hasBarracks
      : building === 'tower'
        ? t.hasTower
        : building === 'mine'
          ? t.hasMine
          : building === 'port'
            ? t.hasPort
            : t.hasForge;
  const eff = Math.max(raw, legacyBuilt ? 1 : 0);
  return Math.min(MAX_BUILDING_LEVEL, Math.max(0, eff)) as BuildingLevel;
}

export function getNextBuildingCost(
  t: BuildingStateLike,
  building: BuildingType
): number | null {
  const lvl = getBuildingLevel(t, building);
  if (lvl === 3) return null;
  return BUILDINGS[building].levelCosts[lvl];
}

export function getTerritoryRates(t: Territory, growthBonus = 1.0) {
  const biome = BIOMES[t.biome];
  const mineLvl = getBuildingLevel(t, 'mine');
  const barracksLvl = getBuildingLevel(t, 'barracks');
  const portLvl = getBuildingLevel(t, 'port');
  const maxManpower =
    ECONOMY.MINE_MAX_MANPOWER_LEVELS[mineLvl] +
    ECONOMY.PORT_MAX_MANPOWER_BONUSES[portLvl];
  const manpowerRate =
    ECONOMY.MINE_MANPOWER_GROWTH_LEVELS[mineLvl] *
    ECONOMY.PORT_MANPOWER_GROWTH_BONUSES[portLvl] *
    biome.manpowerGrowthMult *
    growthBonus;
  const conversionSpeed =
    ECONOMY.BASE_CONVERSION_RATE * ECONOMY.BARRACKS_CONVERSION_MULTIPLIERS[barracksLvl];
  const conversionYield = ECONOMY.BARRACKS_CONVERSION_YIELDS[barracksLvl];

  return {
    maxManpower,
    manpowerRate,
    conversionSpeed,
    conversionYield,
    netMilitaryPerSec: conversionSpeed * conversionYield,
  };
}

export function isBuildingBuilt(
  t: BuildingStateLike,
  building: BuildingType
): boolean {
  return getBuildingLevel(t, building) >= 1;
}

export function canBuildStructure(t: Territory, building: BuildingType): boolean {
  if (t.owner === -1) return false;
  const nextCost = getNextBuildingCost(t, building);
  if (nextCost === null) return false;
  if (building === 'port' && !t.isCoastal) return false;
  return t.military >= nextCost;
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

  const currentLvl = getBuildingLevel(t, building);
  if (currentLvl === 3) return false;
  const nextCost = BUILDINGS[building].levelCosts[currentLvl];
  const newLevel = (currentLvl + 1) as BuildingLevel;

  t.military -= nextCost;
  t.buildingLevels[building] = newLevel;
  if (building === 'barracks') t.hasBarracks = true;
  if (building === 'tower') t.hasTower = true;
  if (building === 'mine') t.hasMine = true;
  if (building === 'forge') t.hasForge = true;
  if (building === 'port') t.hasPort = true;
  t.capturePulse = Math.max(t.capturePulse, newLevel === 3 ? 0.85 : newLevel === 2 ? 0.58 : 0.35);

  if (requester === 0) {
    sim.stats.buildingsConstructed += 1;
  }

  events?.push({
    type: 'build',
    x: t.x,
    y: t.y,
    owner: requester,
    territoryId: t.id,
    territoryName: t.name,
    building,
    buildingLevel: newLevel,
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

export interface DispatchCheck {
  allowed: boolean;
  isNaval: boolean;
  reason?: 'invalid' | 'not_neighbor';
}

export function canDispatchTo(
  sim: GameSimulation,
  fromId: number,
  toId: number
): DispatchCheck {
  if (fromId === toId) return { allowed: false, isNaval: false, reason: 'invalid' };
  const from = sim.territories[fromId];
  const to = sim.territories[toId];
  if (!from || !to) return { allowed: false, isNaval: false, reason: 'invalid' };
  if (from.neighbors.includes(toId)) {
    return { allowed: true, isNaval: false };
  }
  return { allowed: false, isNaval: false, reason: 'not_neighbor' };
}

/** Computes a curved over-water quadratic Bezier route between two coastal ports/shores */
export function computeNavalRoute(
  sim: GameSimulation,
  from: Territory,
  to: Territory
): {
  startX: number;
  startY: number;
  viaX: number;
  viaY: number;
  targetX: number;
  targetY: number;
} {
  const start = from.coastPoint ?? { x: from.x, y: from.y };
  const end = to.coastPoint ?? { x: to.x, y: to.y };
  const mx = (start.x + end.x) * 0.5;
  const my = (start.y + end.y) * 0.5;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = -dy / dist;
  const ny = dx / dist;

  const { map } = sim;
  const clampX = (v: number) => Math.max(18, Math.min(map.width - 18, v));
  const clampY = (v: number) => Math.max(18, Math.min(map.height - 18, v));

  const scoreWater = (cx: number, cy: number): number => {
    let waterSamples = 0;
    const samples = 9;
    for (let i = 1; i < samples; i++) {
      const t = i / samples;
      const mt = 1 - t;
      const px = mt * mt * start.x + 2 * mt * t * cx + t * t * end.x;
      const py = mt * mt * start.y + 2 * mt * t * cy + t * t * end.y;
      const gx = Math.floor(px / map.step);
      const gy = Math.floor(py / map.step);
      if (gx < 0 || gy < 0 || gx >= map.cols || gy >= map.rows) continue;
      if (map.cells[gy * map.cols + gx] === -1) waterSamples++;
    }
    return waterSamples;
  };

  let bestX = clampX(mx);
  let bestY = clampY(my);
  let bestScore = scoreWater(bestX, bestY);

  const offsets = [55, -55, 115, -115, 185, -185, 250, -250];
  for (const off of offsets) {
    const cx = clampX(mx + nx * off);
    const cy = clampY(my + ny * off);
    const s = scoreWater(cx, cy);
    if (s > bestScore) {
      bestScore = s;
      bestX = cx;
      bestY = cy;
    }
  }

  return {
    startX: start.x,
    startY: start.y,
    viaX: bestX,
    viaY: bestY,
    targetX: end.x,
    targetY: end.y,
  };
}

export interface SupplyRouteResult {
  ok: boolean;
  action?: 'set' | 'cleared';
  reason?: 'invalid' | 'not_owner' | 'not_neighbor' | 'target_not_friendly';
}

export function setSupplyRoute(
  sim: GameSimulation,
  fromId: number,
  toId: number,
  requester: Exclude<FactionId, -1>,
  events?: SimEvent[]
): SupplyRouteResult {
  if (fromId === toId) return { ok: false, reason: 'invalid' };
  const from = sim.territories[fromId];
  const to = sim.territories[toId];
  if (!from || !to) return { ok: false, reason: 'invalid' };
  if (from.owner !== requester) return { ok: false, reason: 'not_owner' };
  if (!from.neighbors.includes(toId)) return { ok: false, reason: 'not_neighbor' };
  if (to.owner !== requester) return { ok: false, reason: 'target_not_friendly' };

  if (from.supplyTargetId === toId) {
    from.supplyTargetId = null;
    from.supplyTimer = 0;
    events?.push({
      type: 'supply_clear',
      x: from.x,
      y: from.y,
      owner: requester,
      territoryId: from.id,
      territoryName: from.name,
    });
    return { ok: true, action: 'cleared' };
  }

  // Prevent infinite ping-pong loops between two friendly castles
  if (to.supplyTargetId === fromId) {
    to.supplyTargetId = null;
    to.supplyTimer = 0;
  }

  from.supplyTargetId = toId;
  // Trigger first caravan quickly (~0.7s) for crisp player feedback
  from.supplyTimer = Math.max(0, ECONOMY.AUTO_SUPPLY_INTERVAL - 0.7);
  events?.push({
    type: 'supply_set',
    x: from.x,
    y: from.y,
    toX: to.x,
    toY: to.y,
    owner: requester,
    territoryId: from.id,
    targetId: to.id,
    territoryName: from.name,
    targetName: to.name,
  });
  return { ok: true, action: 'set' };
}

export function clearSupplyRoute(
  sim: GameSimulation,
  fromId: number,
  requester: Exclude<FactionId, -1>,
  events?: SimEvent[]
): boolean {
  const from = sim.territories[fromId];
  if (!from || from.owner !== requester || from.supplyTargetId === null) return false;
  from.supplyTargetId = null;
  from.supplyTimer = 0;
  events?.push({
    type: 'supply_clear',
    x: from.x,
    y: from.y,
    owner: requester,
    territoryId: from.id,
    territoryName: from.name,
  });
  return true;
}

export interface DispatchResult {
  ok: boolean;
  reason?: 'invalid' | 'not_owner' | 'not_neighbor' | 'insufficient_troops';
  sent?: number;
  isNaval?: boolean;
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

  const routeCheck = canDispatchTo(sim, fromId, toId);
  if (!routeCheck.allowed) return { ok: false, reason: routeCheck.reason ?? 'not_neighbor' };

  const clampedRatio = Math.max(0.1, Math.min(1.0, ratio));
  const maxSendable = Math.floor(from.military - 1);
  if (maxSendable < 1) return { ok: false, reason: 'insufficient_troops' };

  const amount = Math.max(1, Math.min(maxSendable, Math.floor(from.military * clampedRatio)));
  from.military -= amount;

  const isNaval = routeCheck.isNaval;
  let startX = from.x;
  let startY = from.y;
  let viaX: number;
  let viaY: number;
  let targetX = to.x;
  let targetY = to.y;

  if (isNaval) {
    const naval = computeNavalRoute(sim, from, to);
    startX = naval.startX;
    startY = naval.startY;
    viaX = naval.viaX;
    viaY = naval.viaY;
    targetX = naval.targetX;
    targetY = naval.targetY;
  } else {
    const crossing = from.borderCrossings[toId] ?? {
      x: (from.x + to.x) * 0.5,
      y: (from.y + to.y) * 0.5,
    };
    viaX = crossing.x;
    viaY = crossing.y;
  }

  const forgeLvl = getBuildingLevel(from, 'forge');
  const portLvl = getBuildingLevel(from, 'port');
  const attackMultiplier =
    ECONOMY.FORGE_ATTACK_MULTIPLIERS[forgeLvl] *
    (isNaval ? ECONOMY.PORT_NAVAL_ATTACK_MULTIPLIERS[portLvl] : 1.0);
  const troopSpeed = isNaval
    ? ECONOMY.NAVAL_SPEED * ECONOMY.PORT_NAVAL_SPEED_MULTIPLIERS[portLvl]
    : ECONOMY.TROOP_SPEED;
  const isElite = forgeLvl >= 1 || (isNaval && portLvl >= 3) || amount >= 25;

  sim.troops.push({
    id: sim.nextTroopId++,
    fromId,
    toId,
    startX,
    startY,
    viaX,
    viaY,
    targetX,
    targetY,
    x: startX,
    y: startY,
    facingLeft: targetX < startX,
    progress: 0,
    speed: troopSpeed,
    count: amount,
    owner: requester,
    attackMultiplier,
    isElite,
    isNaval,
  });

  if (requester === 0) {
    sim.stats.troopsDispatched += amount;
  }

  events?.push({
    type: 'dispatch',
    x: startX,
    y: startY,
    toX: viaX,
    toY: viaY,
    owner: requester,
    previousOwner: to.owner,
    territoryId: from.id,
    targetId: to.id,
    territoryName: from.name,
    targetName: to.name,
    amount,
    isElite,
    isNaval,
  });

  return { ok: true, sent: amount, isNaval };
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
  const towerLvl = getBuildingLevel(target, 'tower');
  if (towerLvl > 0) mult *= ECONOMY.TOWER_DAMAGE_MULTIPLIERS[towerLvl];
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
  const previousOwner = target.owner;
  const damagePerSoldier = Math.max(0.05, defenseMult * troop.attackMultiplier);
  const remaining = Math.max(1, (effectiveAttack - target.military) / damagePerSoldier);
  target.owner = troop.owner;
  target.military = Math.min(troop.count, remaining);
  target.manpower = Math.max(8, target.manpower * 0.35);
  target.hasBarracks = false;
  target.hasTower = false;
  target.hasMine = false;
  target.hasForge = false;
  target.hasPort = false;
  target.buildingLevels.barracks = 0;
  target.buildingLevels.tower = 0;
  target.buildingLevels.mine = 0;
  target.buildingLevels.forge = 0;
  target.buildingLevels.port = 0;
  target.shieldTimer = 0;
  target.supplyTargetId = null;
  target.supplyTimer = 0;
  target.capturePulse = 1.0;
  sim.mapDirty = true;

  // Sever any auto-supply routes pointing into the fallen castle
  for (const other of sim.territories) {
    if (other.supplyTargetId === target.id && other.owner !== target.owner) {
      other.supplyTargetId = null;
      other.supplyTimer = 0;
    }
  }

  recordTimelapseSnapshot(sim, false);

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
    previousOwner,
    territoryId: target.id,
    territoryName: target.name,
    amount: Math.round(target.military),
    isElite: troop.isElite,
    isNaval: troop.isNaval,
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

    // 1. Strategic Building & Upgrade Decisions (Lv.1 -> Lv.2 -> Lv.3)
    if (safeMilitary >= 28) {
      const mineCost = getNextBuildingCost(t, 'mine');
      const mineLvl = getBuildingLevel(t, 'mine');
      if (
        mineCost !== null &&
        t.military >= mineCost + (isFrontline ? 14 : 6) + mineLvl * 6 &&
        (!isFrontline || t.biome === 'fertile' || personality === 'fortifier')
      ) {
        buildStructure(sim, t.id, 'mine', t.owner, events);
        continue;
      }

      const forgeCost = getNextBuildingCost(t, 'forge');
      const forgeLvl = getBuildingLevel(t, 'forge');
      if (
        forgeCost !== null &&
        isFrontline &&
        t.military >= forgeCost + 12 + forgeLvl * 6 &&
        (personality === 'aggressor' || personality === 'opportunist')
      ) {
        buildStructure(sim, t.id, 'forge', t.owner, events);
        continue;
      }

      const towerCost = getNextBuildingCost(t, 'tower');
      const towerLvl = getBuildingLevel(t, 'tower');
      if (
        towerCost !== null &&
        isFrontline &&
        enemyNeighbors.length >= 2 &&
        t.military >= towerCost + 10 + towerLvl * 6 &&
        (personality === 'fortifier' ||
          t.biome === 'mountain' ||
          enemyNeighbors.some((e) => e.owner === 0))
      ) {
        buildStructure(sim, t.id, 'tower', t.owner, events);
        continue;
      }

      const barCost = getNextBuildingCost(t, 'barracks');
      const barLvl = getBuildingLevel(t, 'barracks');
      if (barCost !== null && t.military >= barCost + 8 + barLvl * 8) {
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
      const myAttackMult = ECONOMY.FORGE_ATTACK_MULTIPLIERS[getBuildingLevel(t, 'forge')];

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
  isNaval: boolean;
  effectiveAttack: number;
  defenderMilitary: number;
  willConquer: boolean;
  advantageRatio: number;
  defenseBonusPct: number;
}

/** Computes an accurate live preview of dispatching troops from one territory to an adjacent or naval target */
export function previewAttackOutcome(
  sim: GameSimulation,
  fromId: number,
  toId: number,
  ratio: number
): AttackPreview | null {
  const from = sim.territories[fromId];
  const to = sim.territories[toId];
  if (!from || !to) return null;
  const check = canDispatchTo(sim, fromId, toId);
  if (!check.allowed) return null;

  const clampedRatio = Math.max(0.1, Math.min(1.0, ratio));
  const maxSendable = Math.max(0, Math.floor(from.military - 1));
  const sendAmount =
    maxSendable < 1 ? 0 : Math.max(1, Math.min(maxSendable, Math.floor(from.military * clampedRatio)));

  if (from.owner === to.owner) {
    return {
      sendAmount,
      isFriendly: true,
      isNaval: check.isNaval,
      effectiveAttack: sendAmount,
      defenderMilitary: Math.floor(to.military),
      willConquer: false,
      advantageRatio: 1,
      defenseBonusPct: 0,
    };
  }

  const attackMult =
    ECONOMY.FORGE_ATTACK_MULTIPLIERS[getBuildingLevel(from, 'forge')] *
    (check.isNaval ? ECONOMY.PORT_NAVAL_ATTACK_MULTIPLIERS[getBuildingLevel(from, 'port')] : 1.0);
  const defenseMult = getEffectiveDefenseMultiplier(to);
  const effectiveAttack = sendAmount * attackMult * defenseMult;
  const defenderMilitary = to.military;
  const defenseBonusPct = Math.round((1 - defenseMult) * 100);

  return {
    sendAmount,
    isFriendly: false,
    isNaval: check.isNaval,
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

    // 1b. Auto-Supply Line Reinforcement Caravans
    if (t.supplyTargetId !== null) {
      const dest = sim.territories[t.supplyTargetId];
      if (!dest || dest.owner !== t.owner || !t.neighbors.includes(t.supplyTargetId)) {
        t.supplyTargetId = null;
        t.supplyTimer = 0;
      } else {
        t.supplyTimer += dt;
        if (t.supplyTimer >= ECONOMY.AUTO_SUPPLY_INTERVAL) {
          t.supplyTimer -= ECONOMY.AUTO_SUPPLY_INTERVAL;
          if (t.military >= ECONOMY.AUTO_SUPPLY_MIN_MILITARY) {
            dispatchTroops(sim, t.id, dest.id, ECONOMY.AUTO_SUPPLY_RATIO, t.owner, events);
          }
        }
      }
    }
  }

  // 2. Advance Marching Troops & Naval Warships along Border Crossing / Sea Curves
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

  // 4. Periodic Timelapse Keyframe Capture
  if (!demoMode) {
    sim.timelapseTimer += dt;
    if (sim.timelapseTimer >= 4.0) {
      sim.timelapseTimer -= 4.0;
      recordTimelapseSnapshot(sim, false);
    }
  }

  // 5. Victory / Defeat Check (active gameplay only)
  if (!demoMode) {
    const outcome = checkGameOutcome(sim);
    if (outcome !== 'none' && sim.outcome === 'none') {
      sim.outcome = outcome;
      recordTimelapseSnapshot(sim, true);
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
    const friendlyNeighborCount = sel.neighbors.filter(
      (nId) => sim.territories[nId]?.owner === sel.owner
    ).length;
    const supplyTarget =
      sel.supplyTargetId !== null ? sim.territories[sel.supplyTargetId] ?? null : null;

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
      hasPort: sel.hasPort,
      buildingLevels: {
        barracks: getBuildingLevel(sel, 'barracks'),
        tower: getBuildingLevel(sel, 'tower'),
        mine: getBuildingLevel(sel, 'mine'),
        forge: getBuildingLevel(sel, 'forge'),
        port: getBuildingLevel(sel, 'port'),
      },
      isCoastal: sel.isCoastal,
      shieldTimer: sel.shieldTimer,
      neighborCount: sel.neighbors.length,
      friendlyNeighborCount,
      supplyTargetId: supplyTarget ? supplyTarget.id : null,
      supplyTargetName: supplyTarget ? supplyTarget.name : null,
    };
  }

  return {
    phase,
    outcome: sim.outcome,
    difficulty: sim.difficulty,
    mapPreset: sim.preset,
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
