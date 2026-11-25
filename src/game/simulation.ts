import {
  BIOMES,
  BUILDINGS,
  COMMANDER_POWERS,
  DIFFICULTIES,
  ECONOMY,
  FACTIONS,
  TERRITORY_COUNT,
} from './constants';
import { createRng, generateOrganicMap } from './mapGenerator';
import type {
  BuildingType,
  Difficulty,
  FactionId,
  FactionPowerEntry,
  GameOutcome,
  GameSimulation,
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

/** Records a lightweight territory-ownership snapshot for the Endgame Map Timelapse */
export function recordTimelapseSnapshot(sim: GameSimulation, force = false) {
  const owners = sim.territories.map((t) => t.owner);
  const last = sim.timelapse[sim.timelapse.length - 1];
  if (!force && last) {
    const unchanged = last.owners.every((o, i) => o === owners[i]);
    if (unchanged && sim.stats.elapsedSeconds - last.elapsed < 6) {
      return;
    }
  }
  // Keep timelapse crisp and memory-bounded (~120 frames max)
  if (sim.timelapse.length >= 120) {
    // Preserve frame 0 and thin out older intermediate frames
    const compacted = [sim.timelapse[0]];
    for (let i = 2; i < sim.timelapse.length; i += 2) {
      compacted.push(sim.timelapse[i]);
    }
    sim.timelapse = compacted;
  }
  sim.timelapse.push({
    elapsed: sim.stats.elapsedSeconds,
    owners,
  });
}

/** Computes live battle intensity tier (0 = calm, 1 = active skirmish, 2 = high-tension siege/endgame) */
export function computeBattleIntensity(sim: GameSimulation): 0 | 1 | 2 {
  let playerCount = 0;
  for (const t of sim.territories) {
    if (t.owner === 0) playerCount++;
  }
  const playerShare = playerCount / Math.max(1, sim.territories.length);

  let enemyAttackingPlayer = false;
  for (const tr of sim.troops) {
    if (tr.owner !== 0 && sim.territories[tr.toId]?.owner === 0) {
      enemyAttackingPlayer = true;
      break;
    }
  }

  if (
    enemyAttackingPlayer ||
    sim.powers.blitzTimer > 0 ||
    playerShare >= 0.65 ||
    sim.troops.length >= 5
  ) {
    return 2;
  }
  if (sim.troops.length >= 2 || sim.shakeTrauma > 0.15) {
    return 1;
  }
  return 0;
}

export interface SupplyRouteResult {
  ok: boolean;
  action?: 'set' | 'cleared';
  reason?: 'invalid' | 'not_owner' | 'not_neighbor' | 'target_not_friendly';
}

/** Sets or toggles an automatic rear-to-frontline reinforcement supply line between two adjacent friendly castles */
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

  // Toggling an existing identical supply line cancels it cleanly
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

  // Prevent infinite 2-way ping-pong loop between two adjacent friendly castles
  if (to.supplyTargetId === fromId) {
    to.supplyTargetId = null;
    to.supplyTimer = 0;
  }

  from.supplyTargetId = toId;
  // Trigger first caravan quickly (~0.7s) for instant visual feedback
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

/** Cancels an active Auto-Supply route on a castle */
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

export function canBuildStructure(t: Territory, building: BuildingType): boolean {
  if (t.owner === -1) return false;
  if (building === 'barracks' && t.hasBarracks) return false;
  if (building === 'tower' && t.hasTower) return false;
  if (building === 'mine' && t.hasMine) return false;
  if (building === 'forge' && t.hasForge) return false;
  if (building === 'port' && (t.hasPort || !t.isCoastal)) return false;
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
  if (building === 'port') t.hasPort = true;

  if (requester === 0) {
    sim.stats.buildingsConstructed += 1;
  }

  events?.push({
    type: 'build',
    x: building === 'port' && t.coastPoint ? t.coastPoint.x : t.x,
    y: building === 'port' && t.coastPoint ? t.coastPoint.y : t.y,
    owner: requester,
    territoryId: t.id,
    territoryName: t.name,
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
      territoryId: t.id,
      territoryName: t.name,
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
      territoryId: anchor.id,
      territoryName: anchor.name,
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
      territoryId: t.id,
      territoryName: t.name,
    });
    return true;
  }

  return false;
}

export interface DispatchResult {
  ok: boolean;
  reason?: 'invalid' | 'not_owner' | 'not_neighbor' | 'insufficient_troops';
  sent?: number;
  isNaval?: boolean;
}

/** Returns whether a dispatch from `fromId` to `toId` is legal (land neighbor OR cross-sea Naval Raid via Port) */
export function canDispatchTo(
  sim: GameSimulation,
  fromId: number,
  toId: number
): { allowed: boolean; isNaval: boolean } {
  if (fromId === toId) return { allowed: false, isNaval: false };
  const from = sim.territories[fromId];
  const to = sim.territories[toId];
  if (!from || !to) return { allowed: false, isNaval: false };
  if (from.neighbors.includes(toId)) {
    return { allowed: true, isNaval: false };
  }
  if (from.hasPort && from.isCoastal && to.isCoastal) {
    return { allowed: true, isNaval: true };
  }
  return { allowed: false, isNaval: false };
}

/** Computes a curved sea-lane waypoint that stays over open ocean water as much as possible */
export function computeNavalRoute(
  sim: GameSimulation,
  from: Territory,
  to: Territory
): { startX: number; startY: number; viaX: number; viaY: number; targetX: number; targetY: number } {
  const sx = from.coastPoint?.x ?? from.x;
  const sy = from.coastPoint?.y ?? from.y;
  const ex = to.coastPoint?.x ?? to.x;
  const ey = to.coastPoint?.y ?? to.y;

  const mx = (sx + ex) * 0.5;
  const my = (sy + ey) * 0.5;
  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  const { cells, cols, rows, step, width, height } = sim.map;
  const offsets = [0, 75, -75, 155, -155, 240, -240];

  let bestViaX = mx;
  let bestViaY = my;
  let bestScore = -Infinity;

  for (const off of offsets) {
    const cx = Math.max(24, Math.min(width - 24, mx + nx * off));
    const cy = Math.max(24, Math.min(height - 24, my + ny * off));

    let waterHits = 0;
    const samples = 14;
    for (let i = 1; i < samples; i++) {
      const u = i / samples;
      const mu = 1 - u;
      const px = mu * mu * sx + 2 * mu * u * cx + u * u * ex;
      const py = mu * mu * sy + 2 * mu * u * cy + u * u * ey;
      const gx = Math.floor(px / step);
      const gy = Math.floor(py / step);
      if (gx < 0 || gy < 0 || gx >= cols || gy >= rows || cells[gy * cols + gx] === -1) {
        waterHits += 1;
      }
    }
    // Slight preference for shorter arc when water clearance ties
    const score = waterHits * 10 - Math.abs(off) * 0.02;
    if (score > bestScore) {
      bestScore = score;
      bestViaX = cx;
      bestViaY = cy;
    }
  }

  return {
    startX: sx,
    startY: sy,
    viaX: bestViaX,
    viaY: bestViaY,
    targetX: ex,
    targetY: ey,
  };
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
  if (!routeCheck.allowed) return { ok: false, reason: 'not_neighbor' };

  const clampedRatio = Math.max(0.1, Math.min(1.0, ratio));
  const maxSendable = Math.floor(from.military - 1);
  if (maxSendable < 1) return { ok: false, reason: 'insufficient_troops' };

  const amount = Math.max(1, Math.min(maxSendable, Math.floor(from.military * clampedRatio)));
  from.military -= amount;

  const isNaval = routeCheck.isNaval;
  const route = isNaval
    ? computeNavalRoute(sim, from, to)
    : (() => {
        const crossing = from.borderCrossings[toId] ?? {
          x: (from.x + to.x) * 0.5,
          y: (from.y + to.y) * 0.5,
        };
        return {
          startX: from.x,
          startY: from.y,
          viaX: crossing.x,
          viaY: crossing.y,
          targetX: to.x,
          targetY: to.y,
        };
      })();

  const attackMultiplier = from.hasForge ? ECONOMY.FORGE_ATTACK_MULTIPLIER : 1.0;

  sim.troops.push({
    id: sim.nextTroopId++,
    fromId,
    toId,
    startX: route.startX,
    startY: route.startY,
    viaX: route.viaX,
    viaY: route.viaY,
    targetX: route.targetX,
    targetY: route.targetY,
    x: route.startX,
    y: route.startY,
    facingLeft: route.targetX < route.startX,
    progress: 0,
    speed: isNaval ? ECONOMY.NAVAL_SPEED : ECONOMY.TROOP_SPEED,
    count: amount,
    owner: requester,
    attackMultiplier,
    isElite: from.hasForge || amount >= 25,
    isNaval,
  });

  if (requester === 0) {
    sim.stats.troopsDispatched += amount;
  }

  events?.push({
    type: 'dispatch',
    x: route.startX,
    y: route.startY,
    toX: route.viaX,
    toY: route.viaY,
    owner: requester,
    previousOwner: to.owner,
    territoryId: from.id,
    targetId: to.id,
    territoryName: from.name,
    targetName: to.name,
    amount,
    isElite: from.hasForge || amount >= 25,
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

  // Conquest!
  const previousOwner = target.owner;
  const remaining = Math.max(1, (effectiveAttack - target.military) / Math.max(0.4, defenseMult));
  target.owner = troop.owner;
  target.military = Math.min(troop.count, remaining);
  target.manpower = Math.max(8, target.manpower * 0.35);
  target.hasBarracks = false;
  target.hasTower = false;
  target.hasMine = false;
  target.hasForge = false;
  target.hasPort = false;
  target.shieldTimer = 0;
  target.supplyTargetId = null;
  target.supplyTimer = 0;
  target.capturePulse = 1.0;
  sim.mapDirty = true;

  // Cancel any Auto-Supply routes that were feeding into this newly lost castle
  for (const other of sim.territories) {
    if (other.supplyTargetId === target.id && other.owner !== target.owner) {
      other.supplyTargetId = null;
      other.supplyTimer = 0;
    }
  }

  if (troop.owner === 0) {
    sim.stats.territoriesCaptured += 1;
    sim.stats.battlesWon += 1;
    sim.hitstopTimer = 0.045;
    sim.shakeTrauma = Math.min(1, sim.shakeTrauma + 0.45);
  } else {
    sim.shakeTrauma = Math.min(1, sim.shakeTrauma + 0.22);
  }

  recordTimelapseSnapshot(sim, true);

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

  for (const t of sim.territories) {
    if (t.owner === -1) continue;
    if (!demoMode && t.owner === 0) continue;

    const faction = FACTIONS[t.owner];
    const personality = faction.personality ?? 'balanced';
    const neighbors = t.neighbors.map((id) => sim.territories[id]);
    const enemyNeighbors = neighbors.filter((n) => n.owner !== t.owner);
    const friendlyNeighbors = neighbors.filter((n) => n.owner === t.owner);
    const isFrontline = enemyNeighbors.length > 0;

    // 1. Strategic Building Decisions (including War Forge for aggressors!)
    if (t.military >= 28) {
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

      // Build coastal Port on sea-heavy maps or when coastal castles have surplus forces
      const navalMapBonus = sim.preset === 'archipelago' || sim.preset === 'strait' || sim.preset === 'middle_east';
      if (
        t.isCoastal &&
        !t.hasPort &&
        t.hasBarracks &&
        t.military >= BUILDINGS.port.cost + (navalMapBonus ? 8 : 16) &&
        rng() < (navalMapBonus ? 0.65 : 0.3)
      ) {
        buildStructure(sim, t.id, 'port', t.owner, events);
        continue;
      }
    }

    // 2. Naval Raid Opportunity from Coastal Port Castle (bypass blockades across water!)
    if (t.hasPort && t.isCoastal && t.military >= 26 && rng() < 0.32) {
      const coastalEnemies = sim.territories.filter(
        (other) =>
          other.id !== t.id &&
          other.isCoastal &&
          other.owner !== t.owner &&
          !t.neighbors.includes(other.id)
      );
      if (coastalEnemies.length > 0) {
        let bestSeaTarget: Territory | null = null;
        let bestSeaScore = -Infinity;
        const myAttackMult = t.hasForge ? ECONOMY.FORGE_ATTACK_MULTIPLIER : 1.0;

        for (const c of coastalEnemies) {
          const defMult = getEffectiveDefenseMultiplier(c);
          const effectiveDefense = c.military / Math.max(0.25, defMult);
          const advantage = (t.military * myAttackMult) / Math.max(4, effectiveDefense);
          if (advantage < diff.aiAttackThreshold * 1.05) continue;
          const dist = Math.hypot(c.x - t.x, c.y - t.y);
          let score = advantage * 34 - dist * 0.04;
          if (c.owner === -1) score += 16;
          if (!demoMode && c.owner === 0 && playerCount >= diff.playerThreatThreshold) score += 20;
          if (score > bestSeaScore) {
            bestSeaScore = score;
            bestSeaTarget = c;
          }
        }
        if (bestSeaTarget) {
          dispatchTroops(sim, t.id, bestSeaTarget.id, diff.aiAggressionRatio, t.owner, events);
          continue;
        }
      }
    }

    // 3. Interior Supply Lines: Safe rear castles reinforce threatened frontline castles
    if (!isFrontline && friendlyNeighbors.length > 0 && t.military > 24) {
      const frontlineAlly = friendlyNeighbors
        .filter((f) => f.neighbors.some((nId) => sim.territories[nId].owner !== t.owner))
        .sort((a, b) => a.military - b.military)[0];

      const dest = frontlineAlly ?? friendlyNeighbors.sort((a, b) => a.military - b.military)[0];
      if (dest) {
        dispatchTroops(sim, t.id, dest.id, 0.65, t.owner, events);
      }
      continue;
    }

    // 4. Tactical Offensive Evaluation
    if (isFrontline && t.military > 16) {
      let bestTarget: Territory | null = null;
      let bestScore = -Infinity;
      const myAttackMult = t.hasForge ? ECONOMY.FORGE_ATTACK_MULTIPLIER : 1.0;

      for (const n of enemyNeighbors) {
        const defMult = getEffectiveDefenseMultiplier(n);
        const effectiveDefense = n.military / Math.max(0.25, defMult);
        const advantage = (t.military * myAttackMult) / Math.max(4, effectiveDefense);

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

/** Computes an accurate live preview of dispatching troops (land or naval raid) */
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

  const attackMult = from.hasForge ? ECONOMY.FORGE_ATTACK_MULTIPLIER : 1.0;
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
  events?: SimEvent[]
): { squadsSent: number; totalSent: number } {
  const target = sim.territories[targetId];
  if (!target || target.owner !== requester) {
    return { squadsSent: 0, totalSent: 0 };
  }

  let squadsSent = 0;
  let totalSent = 0;

  for (const nId of target.neighbors) {
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

  // Decay visual timers even during brief hitstop
  sim.shakeTrauma = Math.max(0, sim.shakeTrauma - dt * 1.9);
  for (const t of sim.territories) {
    if (t.hitFlash > 0) t.hitFlash = Math.max(0, t.hitFlash - dt);
    if (t.capturePulse > 0) t.capturePulse = Math.max(0, t.capturePulse - dt * 1.4);
    if (t.towerFireTimer > 0) t.towerFireTimer = Math.max(0, t.towerFireTimer - dt);
  }

  if (sim.hitstopTimer > 0) {
    sim.hitstopTimer = Math.max(0, sim.hitstopTimer - dt);
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

  // 1b. Tick Auto-Supply Reinforcement Lines (rear -> frontline automation)
  if (!demoMode) {
    for (const t of sim.territories) {
      if (t.supplyTargetId === null) continue;
      const dest = sim.territories[t.supplyTargetId];
      if (t.owner === -1 || !dest || dest.owner !== t.owner || !t.neighbors.includes(dest.id)) {
        t.supplyTargetId = null;
        t.supplyTimer = 0;
        continue;
      }
      t.supplyTimer += dt;
      if (t.supplyTimer >= ECONOMY.AUTO_SUPPLY_INTERVAL) {
        t.supplyTimer = 0;
        if (t.military >= ECONOMY.AUTO_SUPPLY_MIN_MILITARY) {
          dispatchTroops(sim, t.id, dest.id, ECONOMY.AUTO_SUPPLY_RATIO, t.owner, events);
        }
      }
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

  // 3b. Periodic Timelapse Snapshot (every 4s during active play)
  if (!demoMode) {
    sim.timelapseTimer += dt;
    if (sim.timelapseTimer >= 4.0) {
      sim.timelapseTimer = 0;
      recordTimelapseSnapshot(sim, false);
    }
  }

  // 4. Victory / Defeat Check (active gameplay only)
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
