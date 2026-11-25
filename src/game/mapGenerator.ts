import {
  ECONOMY,
  FACTIONS,
  GRID_STEP,
  PROVINCE_NAMES,
  TERRITORY_COUNT,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './constants';
import type { FactionId, MapGridData, MapPreset, Territory } from './types';

/** Deterministic PRNG (Mulberry32) */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface WaveParams {
  p1: number;
  p2: number;
  p3: number;
  p4: number;
  a1: number;
}

/** Smooth 2D radial ellipse signed-height helper (> 0 inside island) */
function islandField(
  nx: number,
  ny: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rot = 0
): number {
  const dx = nx - cx;
  const dy = ny - cy;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const lx = (dx * cos - dy * sin) / rx;
  const ly = (dx * sin + dy * cos) / ry;
  return 1 - Math.hypot(lx, ly);
}

/** Evaluates whether a world coordinate lies on land (> 0) or ocean (<= 0) for the chosen MapPreset */
function evaluateLandMask(
  x: number,
  y: number,
  w: number,
  h: number,
  waves: WaveParams,
  preset: MapPreset
): number {
  const nx = (x - w * 0.5) / (w * 0.455);
  const ny = (y - h * 0.5) / (h * 0.44);

  // Smooth quadratic coastal safety margin so peninsulas stay organically rounded and never flatten at canvas edges
  const edgePadX = 72;
  const edgePadY = 38;
  const distToEdgeX = Math.min(x, w - x);
  const distToEdgeY = Math.min(y, h - y);
  const tx = Math.max(0, (edgePadX - distToEdgeX) / edgePadX);
  const ty = Math.max(0, (edgePadY - distToEdgeY) / edgePadY);
  const borderDrop = tx * tx * 1.9 + ty * ty * 1.9;

  const organicRipple =
    0.055 * Math.sin(nx * 4.2 + waves.p1) * Math.cos(ny * 3.8 + waves.p2) +
    0.035 * Math.cos((nx - ny) * 5.6 + waves.p3);

  let value: number;

  if (preset === 'archipelago') {
    // 5 distinctly separated lush islands (4 major quadrant islands + 1 strategic central jewel island)
    const jitterA = 0.03 * Math.sin(waves.p1);
    const jitterB = 0.03 * Math.cos(waves.p2);
    const nw = islandField(nx, ny, -0.62 + jitterA, -0.52 + jitterB, 0.36, 0.35, 0.2);
    const ne = islandField(nx, ny, 0.62 - jitterB, -0.5 + jitterA, 0.36, 0.35, -0.18);
    const sw = islandField(nx, ny, -0.6 - jitterA, 0.52 - jitterB, 0.36, 0.35, -0.16);
    const se = islandField(nx, ny, 0.6 + jitterB, 0.5 - jitterA, 0.36, 0.35, 0.18);
    const center = islandField(nx, ny, jitterA * 0.4, jitterB * 0.4, 0.22, 0.21, 0.1);
    const base = Math.max(nw, ne, sw, se, center);
    value = base + organicRipple * 0.68;
  } else if (preset === 'strait') {
    // Two large twin continents (West & East) joined by a bloody central land strait
    const west = islandField(nx, ny, -0.58, 0.02, 0.46, 0.86, 0.06);
    const east = islandField(nx, ny, 0.58, -0.02, 0.46, 0.86, -0.06);
    // Narrow central land bridge across the strait
    const isthmusShift = 0.08 * Math.sin(waves.p4);
    const isthmus = islandField(nx, ny, 0, isthmusShift, 0.34, 0.22, 0);
    // Slight north & south peninsulas flanking the sea channel for dramatic naval landings
    const northCut = Math.exp(-((nx * nx) / 0.035 + ((ny + 0.62) * (ny + 0.62)) / 0.14));
    const southCut = Math.exp(-((nx * nx) / 0.035 + ((ny - 0.62) * (ny - 0.62)) / 0.14));
    const base = Math.max(west, east, isthmus) - 0.42 * (northCut + southCut);
    value = base + organicRipple;
  } else if (preset === 'middle_east') {
    // Stylized pixel-art Middle East: Anatolia, Iranian Plateau, Levant, Arabian Peninsula,
    // Egypt/Nile west bank — with open Persian Gulf, open Red Sea, Mediterranean & Caspian Sea!
    const anatolia = islandField(nx, ny, -0.45, -0.58, 0.48, 0.31, -0.08);
    const iranPlateau = islandField(nx, ny, 0.5, -0.34, 0.54, 0.46, -0.14);
    const mesopotamia = islandField(nx, ny, -0.02, -0.22, 0.42, 0.38, 0.05);
    const arabia = islandField(nx, ny, 0.02, 0.42, 0.44, 0.48, -0.2);
    const egypt = islandField(nx, ny, -0.76, 0.28, 0.3, 0.54, 0.1);

    let land = Math.max(anatolia, iranPlateau, mesopotamia, arabia, egypt);

    // Carve Persian Gulf opening cleanly out to the southeastern Arabian Sea
    const persianGulf = islandField(nx, ny, 0.52, 0.28, 0.48, 0.17, 0.48);
    // Carve Red Sea opening cleanly southward between Egypt and Arabian Peninsula (keeping Sinai bridge)
    const redSea = islandField(nx, ny, -0.4, 0.58, 0.17, 0.56, -0.3);
    // Carve Mediterranean Sea bay in far west between Anatolia & Egypt
    const medSea = islandField(nx, ny, -0.86, -0.18, 0.4, 0.26, 0.08);
    // Carve Caspian Sea notch in the northern border
    const caspian = islandField(nx, ny, 0.34, -0.84, 0.2, 0.28, 0.04);

    if (persianGulf > 0) land -= persianGulf * 1.65;
    if (redSea > 0) land -= redSea * 1.75;
    if (medSea > 0) land -= medSea * 1.45;
    if (caspian > 0) land -= caspian * 1.4;

    value = land + organicRipple * 0.65;
  } else {
    // Default: 'continent' (Classic organic single landmass)
    const dist = Math.hypot(nx, ny);
    const angle = Math.atan2(ny, nx);
    const coastMod =
      0.13 * Math.sin(angle * 3 + waves.p1) +
      0.08 * Math.cos(angle * 5 + waves.p2) +
      0.05 * Math.sin(angle * 7 + waves.p3) +
      0.04 * Math.sin(nx * 3.8 + waves.p4) * Math.cos(ny * 3.4 + waves.a1);
    value = 0.96 + coastMod - dist;
  }

  return value - borderDrop;
}

/** Deterministic smooth domain warp for organic nation borders */
function warpPoint(x: number, y: number, waves: WaveParams): [number, number] {
  const wx =
    x +
    15 * Math.sin(y * 0.022 + waves.p1) +
    8 * Math.cos((x + y) * 0.036 + waves.p2);
  const wy =
    y +
    15 * Math.cos(x * 0.021 + waves.p3) +
    8 * Math.sin((x - y) * 0.034 + waves.p4);
  return [wx, wy];
}

export interface GeneratedMapResult {
  map: MapGridData;
  territories: Territory[];
}

export function generateOrganicMap(
  seed: number,
  count: number = TERRITORY_COUNT,
  preset: MapPreset = 'continent'
): GeneratedMapResult {
  const rng = createRng(seed);
  const width = WORLD_WIDTH;
  const height = WORLD_HEIGHT;
  const step = GRID_STEP;
  const cols = Math.ceil(width / step);
  const rows = Math.ceil(height / step);

  const waves: WaveParams = {
    p1: rng() * Math.PI * 2,
    p2: rng() * Math.PI * 2,
    p3: rng() * Math.PI * 2,
    p4: rng() * Math.PI * 2,
    a1: rng() * Math.PI * 2,
  };

  // 1. Place well-spaced territory centers safely inside land for the chosen preset
  const points: Array<{ x: number; y: number }> = [];
  const minSpacing = preset === 'archipelago' ? 98 : preset === 'middle_east' ? 118 : 130;
  const marginX = preset === 'archipelago' ? 68 : 95;
  const marginY = preset === 'archipelago' ? 58 : 82;

  // On archipelago, guarantee at least 1 anchor per major island + central island before best-candidate fill
  const seededAnchors: Array<{ x: number; y: number }> =
    preset === 'archipelago'
      ? [
          { x: width * 0.23, y: height * 0.28 },
          { x: width * 0.77, y: height * 0.28 },
          { x: width * 0.23, y: height * 0.72 },
          { x: width * 0.77, y: height * 0.72 },
          { x: width * 0.5, y: height * 0.5 },
        ]
      : preset === 'strait'
        ? [
            { x: width * 0.5, y: height * 0.5 }, // Central chokepoint fortress
            { x: width * 0.24, y: height * 0.5 },
            { x: width * 0.76, y: height * 0.5 },
          ]
        : [];

  for (const anchor of seededAnchors) {
    if (points.length >= count) break;
    // Nudge slightly to find solid land nearby
    let bx = anchor.x;
    let by = anchor.y;
    let bestV = evaluateLandMask(bx, by, width, height, waves, preset);
    for (let attempt = 0; attempt < 24 && bestV < 0.15; attempt++) {
      const cx = anchor.x + (rng() - 0.5) * 90;
      const cy = anchor.y + (rng() - 0.5) * 70;
      const v = evaluateLandMask(cx, cy, width, height, waves, preset);
      if (v > bestV) {
        bestV = v;
        bx = cx;
        by = cy;
      }
    }
    if (bestV > 0.04) {
      points.push({ x: bx, y: by });
    }
  }

  for (let i = points.length; i < count; i++) {
    let bestX = width * 0.5;
    let bestY = height * 0.5;
    let bestScore = -Infinity;

    const candidates = 68;
    for (let c = 0; c < candidates; c++) {
      const cx = marginX + rng() * (width - marginX * 2);
      const cy = marginY + rng() * (height - marginY * 2);
      const landVal = evaluateLandMask(cx, cy, width, height, waves, preset);
      if (landVal < 0.1) continue;

      let minDist = Infinity;
      for (const p of points) {
        const d = Math.hypot(p.x - cx, p.y - cy);
        if (d < minDist) minDist = d;
      }

      const score = points.length === 0 ? landVal * 100 : minDist;
      if (score > bestScore) {
        bestScore = score;
        bestX = cx;
        bestY = cy;
      }
      if (points.length > 0 && minDist >= minSpacing && landVal > 0.18) {
        break;
      }
    }
    points.push({ x: bestX, y: bestY });
  }

  // 2. Assign Voronoi land cells & compute coastal bathymetry
  const cells = new Int16Array(cols * rows);
  const elevation = new Uint8Array(cols * rows);

  const assignCells = () => {
    for (let gy = 0; gy < rows; gy++) {
      const py = gy * step + step * 0.5;
      for (let gx = 0; gx < cols; gx++) {
        const px = gx * step + step * 0.5;
        const idx = gy * cols + gx;
        const landVal = evaluateLandMask(px, py, width, height, waves, preset);

        if (landVal <= 0) {
          cells[idx] = -1;
          const depth = Math.max(0, Math.min(120, Math.round((1 + landVal * 2.2) * 120)));
          elevation[idx] = depth;
          continue;
        }

        const [wx, wy] = warpPoint(px, py, waves);
        let closestId = 0;
        let minDistSq = Infinity;
        for (let i = 0; i < points.length; i++) {
          const dx = wx - points[i].x;
          const dy = wy - points[i].y;
          const dSq = dx * dx + dy * dy;
          if (dSq < minDistSq) {
            minDistSq = dSq;
            closestId = i;
          }
        }
        cells[idx] = closestId;
        elevation[idx] = Math.min(255, Math.max(128, Math.round(128 + landVal * 127)));
      }
    }
  };

  assignCells();

  // Gentle Lloyd relaxation inside valid land cells
  const sumX = new Float64Array(count);
  const sumY = new Float64Array(count);
  const cellCounts = new Int32Array(count);

  for (let gy = 0; gy < rows; gy++) {
    const py = gy * step + step * 0.5;
    for (let gx = 0; gx < cols; gx++) {
      const id = cells[gy * cols + gx];
      if (id >= 0) {
        sumX[id] += gx * step + step * 0.5;
        sumY[id] += py;
        cellCounts[id]++;
      }
    }
  }

  for (let i = 0; i < count; i++) {
    if (cellCounts[i] > 10) {
      const cx = sumX[i] / cellCounts[i];
      const cy = sumY[i] / cellCounts[i];
      if (evaluateLandMask(cx, cy, width, height, waves, preset) > 0.08) {
        points[i].x = points[i].x * 0.35 + cx * 0.65;
        points[i].y = points[i].y * 0.35 + cy * 0.65;
      }
    }
  }

  assignCells();

  // 3. Extract neighbor adjacency, shared border midpoints, and exact coastal shoreline docks
  const neighborSets: Array<Set<number>> = Array.from({ length: count }, () => new Set());
  const bridgeSets: Array<Set<number>> = Array.from({ length: count }, () => new Set());
  const borderAccum = new Map<string, { sx: number; sy: number; n: number }>();

  const coastCellCounts = new Int32Array(count);
  const bestCoastDistSq = new Float64Array(count).fill(Infinity);
  const bestCoastPoint: Array<{ x: number; y: number } | null> = Array.from(
    { length: count },
    () => null
  );

  const recordBorder = (a: number, b: number, px: number, py: number) => {
    if (a < 0 || b < 0 || a === b) return;
    neighborSets[a].add(b);
    neighborSets[b].add(a);
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    const entry = borderAccum.get(key);
    if (entry) {
      entry.sx += px;
      entry.sy += py;
      entry.n += 1;
    } else {
      borderAccum.set(key, { sx: px, sy: py, n: 1 });
    }
  };

  for (let gy = 1; gy < rows - 1; gy++) {
    const py = gy * step + step * 0.5;
    for (let gx = 1; gx < cols - 1; gx++) {
      const px = gx * step + step * 0.5;
      const idx = gy * cols + gx;
      const cur = cells[idx];
      if (cur < 0) continue;

      const right = cells[idx + 1];
      const down = cells[idx + cols];
      const left = cells[idx - 1];
      const up = cells[idx - cols];

      if (right >= 0 && right !== cur) {
        recordBorder(cur, right, px + step * 0.5, py);
      }
      if (down >= 0 && down !== cur) {
        recordBorder(cur, down, px, py + step * 0.5);
      }

      // Detect shoreline cell bordering open water (-1)
      if (right === -1 || down === -1 || left === -1 || up === -1) {
        coastCellCounts[cur]++;
        const dx = px - points[cur].x;
        const dy = py - points[cur].y;
        const dSq = dx * dx + dy * dy;
        // Prefer shoreline spots reasonably clear of castle badge directly underneath
        const penalty = Math.abs(dx) < 28 && dy > 0 && dy < 44 ? 900 : 0;
        if (dSq + penalty < bestCoastDistSq[cur]) {
          bestCoastDistSq[cur] = dSq + penalty;
          // Nudge 2px toward water so Port pier visibly meets sea foam
          const wx = right === -1 ? 3 : left === -1 ? -3 : 0;
          const wy = down === -1 ? 3 : up === -1 ? -3 : 0;
          bestCoastPoint[cur] = { x: Math.round(px + wx), y: Math.round(py + wy) };
        }
      }
    }
  }

  // Helper to connect disconnected islands with authentic strategic wooden bridges
  const addBridgeEdge = (a: number, b: number) => {
    if (a === b) return;
    neighborSets[a].add(b);
    neighborSets[b].add(a);
    bridgeSets[a].add(b);
    bridgeSets[b].add(a);
  };

  // Ensure full graph connectivity across islands via strategic sea bridges!
  const getComponents = (): number[][] => {
    const seen = new Set<number>();
    const comps: number[][] = [];
    for (let i = 0; i < count; i++) {
      if (seen.has(i)) continue;
      const comp: number[] = [];
      const q = [i];
      seen.add(i);
      while (q.length > 0) {
        const cur = q.shift()!;
        comp.push(cur);
        for (const n of neighborSets[cur]) {
          if (!seen.has(n)) {
            seen.add(n);
            q.push(n);
          }
        }
      }
      comps.push(comp);
    }
    return comps;
  };

  let comps = getComponents();
  // Record each territory's original physical island ID before adding bridges
  const islandId = new Int16Array(count).fill(-1);
  comps.forEach((comp, idx) => {
    for (const tid of comp) islandId[tid] = idx;
  });
  const bridgedIslandPairs = new Set<string>();
  const islandPairKey = (a: number, b: number) => {
    const ia = islandId[a];
    const ib = islandId[b];
    return ia < ib ? `${ia}:${ib}` : `${ib}:${ia}`;
  };

  while (comps.length > 1) {
    // Connect closest pair between component 0 and any other component
    let bestA = comps[0][0];
    let bestB = comps[1][0];
    let bestDist = Infinity;

    for (const a of comps[0]) {
      for (let cIdx = 1; cIdx < comps.length; cIdx++) {
        for (const b of comps[cIdx]) {
          const d = Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y);
          if (d < bestDist) {
            bestDist = d;
            bestA = a;
            bestB = b;
          }
        }
      }
    }
    addBridgeEdge(bestA, bestB);
    bridgedIslandPairs.add(islandPairKey(bestA, bestB));
    comps = getComponents();
  }

  // On archipelago, add up to 2 extra flanking ring bridges between DISTINCT non-bridged islands
  // so there are exciting multi-front routes without ever placing duplicate parallel bridges!
  if (preset === 'archipelago') {
    let addedExtra = 0;
    const candidatePairs: Array<{ a: number; b: number; d: number }> = [];
    for (let a = 0; a < count; a++) {
      for (let b = a + 1; b < count; b++) {
        if (neighborSets[a].has(b)) continue;
        if (islandId[a] === islandId[b]) continue;
        if (bridgedIslandPairs.has(islandPairKey(a, b))) continue;
        // Check if midpoint crosses water (meaning they are across a sea channel)
        const mx = Math.floor(((points[a].x + points[b].x) * 0.5) / step);
        const my = Math.floor(((points[a].y + points[b].y) * 0.5) / step);
        if (mx < 0 || my < 0 || mx >= cols || my >= rows) continue;
        if (cells[my * cols + mx] !== -1) continue;
        const d = Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y);
        if (d < 360) {
          candidatePairs.push({ a, b, d });
        }
      }
    }
    candidatePairs.sort((p, q) => p.d - q.d);
    for (const pair of candidatePairs) {
      if (addedExtra >= 2) break;
      const pk = islandPairKey(pair.a, pair.b);
      if (bridgedIslandPairs.has(pk)) continue;
      if (bridgeSets[pair.a].size >= 2 || bridgeSets[pair.b].size >= 2) continue;
      addBridgeEdge(pair.a, pair.b);
      bridgedIslandPairs.add(pk);
      addedExtra++;
    }
  }

  // 4. Select 6 well-separated starting capitals (farthest-point sampling) for the 6 factions
  const capitalIndices: number[] = [];
  let playerStart = 0;
  let bestStartScore = -Infinity;
  for (let i = 0; i < count; i++) {
    const deg = neighborSets[i].size;
    const distFromCenter = Math.hypot(points[i].x - width * 0.5, points[i].y - height * 0.5);
    const coastalBonus = coastCellCounts[i] >= 6 ? 35 : 0;
    const score = deg * 24 + distFromCenter * 0.14 + coastalBonus + rng() * 12;
    if (score > bestStartScore) {
      bestStartScore = score;
      playerStart = i;
    }
  }
  capitalIndices.push(playerStart);

  while (capitalIndices.length < FACTIONS.length && capitalIndices.length < count) {
    let bestIdx = -1;
    let bestMinDist = -Infinity;
    for (let i = 0; i < count; i++) {
      if (capitalIndices.includes(i)) continue;
      let minDist = Infinity;
      for (const cap of capitalIndices) {
        const d = Math.hypot(points[i].x - points[cap].x, points[i].y - points[cap].y);
        if (d < minDist) minDist = d;
      }
      const adjacentPenalty = neighborSets[playerStart].has(i) ? 45 : 0;
      const score = minDist - adjacentPenalty;
      if (score > bestMinDist) {
        bestMinDist = score;
        bestIdx = i;
      }
    }
    if (bestIdx !== -1) capitalIndices.push(bestIdx);
  }

  // Shuffle province names deterministically
  const names = [...PROVINCE_NAMES];
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }

  // Assign varied balanced biomes across the 16 territories
  const biomePool: Array<'plain' | 'fertile' | 'forest' | 'mountain'> = [
    'fertile',
    'forest',
    'mountain',
    'plain',
    'fertile',
    'forest',
    'mountain',
    'plain',
    'fertile',
    'forest',
    'mountain',
    'plain',
    'fertile',
    'forest',
    'plain',
    'mountain',
  ];
  for (let i = biomePool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [biomePool[i], biomePool[j]] = [biomePool[j], biomePool[i]];
  }

  const territories: Territory[] = points.map((pt, id) => {
    const factionIndex = capitalIndices.indexOf(id);
    const owner: FactionId = factionIndex >= 0 ? (factionIndex as FactionId) : -1;
    const neighbors = Array.from(neighborSets[id]).sort((a, b) => a - b);
    const bridgeNeighbors = Array.from(bridgeSets[id]).sort((a, b) => a - b);
    const borderCrossings: Record<number, { x: number; y: number }> = {};

    for (const nId of neighbors) {
      const key = id < nId ? `${id}:${nId}` : `${nId}:${id}`;
      const acc = borderAccum.get(key);
      if (acc && acc.n > 0 && !bridgeSets[id].has(nId)) {
        borderCrossings[nId] = { x: acc.sx / acc.n, y: acc.sy / acc.n };
      } else {
        borderCrossings[nId] = {
          x: (pt.x + points[nId].x) * 0.5,
          y: (pt.y + points[nId].y) * 0.5,
        };
      }
    }

    const isPlayer = owner === 0;
    const isNeutral = owner === -1;
    const isCoastal = coastCellCounts[id] >= 6 && bestCoastPoint[id] !== null;

    return {
      id,
      name: names[id % names.length],
      biome: biomePool[id % biomePool.length],
      x: Math.round(pt.x),
      y: Math.round(pt.y),
      owner,
      manpower: isPlayer
        ? ECONOMY.START_PLAYER_MANPOWER
        : isNeutral
          ? ECONOMY.START_NEUTRAL_MANPOWER
          : ECONOMY.START_AI_MANPOWER,
      military: isPlayer
        ? ECONOMY.START_PLAYER_MILITARY
        : isNeutral
          ? ECONOMY.START_NEUTRAL_MILITARY
          : ECONOMY.START_AI_MILITARY,
      hasBarracks: false,
      hasTower: false,
      hasMine: false,
      hasForge: false,
      hasPort: false,
      buildingLevels: {
        barracks: 0,
        tower: 0,
        mine: 0,
        forge: 0,
        port: 0,
      },
      isCoastal,
      coastPoint: isCoastal ? bestCoastPoint[id] : null,
      neighbors,
      bridgeNeighbors,
      borderCrossings,
      hitFlash: 0,
      capturePulse: 0,
      towerFireTimer: 0,
      shieldTimer: 0,
      supplyTargetId: null,
      supplyTimer: 0,
    };
  });

  // Dedicated deterministic cartography sub-RNG so territory geometry/RNG stays 100% untouched
  const artRng = createRng((seed ^ 0x9e3779b9) >>> 0);

  // 5. Carve Natural Winding Rivers from High-Elevation Sources to the Sea
  const riverMask = new Uint8Array(cols * rows);
  const riverSparkles: Array<{ x: number; y: number; phase: number }> = [];

  const targetRiverCount = preset === 'archipelago' ? 2 : 3;
  const riverSources = [...territories]
    .filter((t) => {
      const gx = Math.floor(t.x / step);
      const gy = Math.floor(t.y / step);
      const elev = elevation[gy * cols + gx] ?? 128;
      return elev >= 145 || t.biome === 'mountain' || !t.isCoastal;
    })
    .sort((a, b) => {
      const ea = elevation[Math.floor(a.y / step) * cols + Math.floor(a.x / step)] ?? 0;
      const eb = elevation[Math.floor(b.y / step) * cols + Math.floor(b.x / step)] ?? 0;
      const scoreA = ea + (a.biome === 'mountain' ? 40 : 0) - (a.isCoastal ? 22 : 0);
      const scoreB = eb + (b.biome === 'mountain' ? 40 : 0) - (b.isCoastal ? 22 : 0);
      return scoreB - scoreA;
    });

  const usedRiverOrigins: Array<{ x: number; y: number }> = [];
  let riversCarved = 0;

  for (const src of riverSources) {
    if (riversCarved >= targetRiverCount) break;
    if (usedRiverOrigins.some((o) => Math.hypot(o.x - src.x, o.y - src.y) < 220)) continue;

    // Pick a spring offset cleanly outside the castle center (38-58px away)
    let startGx = -1;
    let startGy = -1;
    let bestStartElev = -1;
    for (let attempt = 0; attempt < 28; attempt++) {
      const ang = artRng() * Math.PI * 2;
      const dist = 38 + artRng() * 24;
      const sx = Math.floor((src.x + Math.cos(ang) * dist) / step);
      const sy = Math.floor((src.y + Math.sin(ang) * dist) / step);
      if (sx < 4 || sy < 4 || sx >= cols - 4 || sy >= rows - 4) continue;
      const idx = sy * cols + sx;
      if (cells[idx] < 0 || riverMask[idx] > 0) continue;
      const px = sx * step;
      const py = sy * step;
      if (territories.some((ot) => Math.hypot(ot.x - px, ot.y - py) < 34)) continue;
      if (elevation[idx] > bestStartElev) {
        bestStartElev = elevation[idx];
        startGx = sx;
        startGy = sy;
      }
    }
    if (startGx < 0) continue;

    // Trace downhill with natural S-curve perpendicular meander, confluence merging, and castle repulsion
    const path: Array<{ gx: number; gy: number }> = [{ gx: startGx, gy: startGy }];
    const visited = new Set<number>([startGy * cols + startGx]);
    let curGx = startGx;
    let curGy = startGy;
    let prevDx = 0;
    let prevDy = 0;
    let reachedWater = false;
    const meanderPhase = artRng() * Math.PI * 2;
    const meanderFreq = 0.2 + artRng() * 0.1;

    for (let stepIdx = 0; stepIdx < 170; stepIdx++) {
      let bestNx = -1;
      let bestNy = -1;
      let bestScore = Infinity;

      // Smooth oscillating lateral pull to create realistic winding river bends
      const bendBias = Math.sin(stepIdx * meanderFreq + meanderPhase) * 9.5;
      const perpX = prevDx === 0 && prevDy === 0 ? 0 : -prevDy;
      const perpY = prevDx === 0 && prevDy === 0 ? 0 : prevDx;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = curGx + dx;
          const ny = curGy + dy;
          if (nx < 1 || ny < 1 || nx >= cols - 1 || ny >= rows - 1) continue;
          const nIdx = ny * cols + nx;
          if (visited.has(nIdx)) continue;

          // If ocean cell or an existing river channel is reached, finish cleanly as mouth/confluence!
          if (cells[nIdx] === -1 || (stepIdx > 10 && riverMask[nIdx] > 0)) {
            bestNx = nx;
            bestNy = ny;
            bestScore = -9999;
            reachedWater = true;
            break;
          }

          const wx = nx * step;
          const wy = ny * step;
          // Gently push river around castle footprints so it frames fortresses cleanly
          let castlePenalty = 0;
          for (const ot of territories) {
            const cd = Math.hypot(ot.x - wx, ot.y - wy);
            if (cd < 36) castlePenalty += (36 - cd) * 20;
            if (Math.abs(wx - ot.x) < 44 && wy > ot.y + 8 && wy < ot.y + 42) {
              castlePenalty += 130;
            }
          }

          // Smooth directional momentum + organic perpendicular S-curve meander
          const norm = Math.hypot(dx, dy);
          const dot = (prevDx * dx + prevDy * dy) / norm;
          const turnPenalty = prevDx === 0 && prevDy === 0 ? 0 : (1 - dot) * 7.5;
          const lateralAlign = (dx * perpX + dy * perpY) / norm;
          const meander = -lateralAlign * bendBias;
          // Mildly prefer orthogonal/soft bends over rigid 45-degree diagonal laser lines
          const diagNudge = dx !== 0 && dy !== 0 ? 2.2 : 0;
          const elevScore = elevation[nIdx] + castlePenalty + turnPenalty + meander + diagNudge;

          if (elevScore < bestScore) {
            bestScore = elevScore;
            bestNx = nx;
            bestNy = ny;
          }
        }
        if (reachedWater) break;
      }

      if (bestNx < 0) break;
      prevDx = bestNx - curGx;
      prevDy = bestNy - curGy;
      curGx = bestNx;
      curGy = bestNy;
      visited.add(curGy * cols + curGx);

      if (reachedWater) break;
      path.push({ gx: curGx, gy: curGy });
    }

    const minLen = preset === 'archipelago' ? 9 : 16;
    if (reachedWater && path.length >= minLen) {
      usedRiverOrigins.push({ x: startGx * step, y: startGy * step });
      riversCarved++;
      for (let pIdx = 0; pIdx < path.length; pIdx++) {
        const pt = path[pIdx];
        const ratio = pIdx / Math.max(1, path.length - 1);
        const isWide = ratio > 0.62;
        const cIdx = pt.gy * cols + pt.gx;
        if (cells[cIdx] >= 0) {
          riverMask[cIdx] = isWide ? 2 : 1;
        }
        // Widen lower estuary slightly with 1 adjacent land cell
        if (isWide) {
          const rightIdx = pt.gy * cols + Math.min(cols - 1, pt.gx + 1);
          const downIdx = Math.min(rows - 1, pt.gy + 1) * cols + pt.gx;
          if (cells[rightIdx] >= 0) riverMask[rightIdx] = Math.max(riverMask[rightIdx], 1);
          if (ratio > 0.84 && cells[downIdx] >= 0) {
            riverMask[downIdx] = Math.max(riverMask[downIdx], 1);
          }
        }
        if (pIdx % 5 === 2) {
          riverSparkles.push({
            x: pt.gx * step + 1,
            y: pt.gy * step + 1,
            phase: (pIdx * 0.55 + riversCarved * 1.9) % (Math.PI * 2),
          });
        }
      }
    }
  }

  // 6. Extract Animated Shoreline Surf Crest Anchors
  const coastSurf: MapGridData['coastSurf'] = [];
  for (let gy = 2; gy < rows - 2; gy += 2) {
    for (let gx = 2; gx < cols - 2; gx += 2) {
      const idx = gy * cols + gx;
      if (cells[idx] !== -1) continue;
      const landRight = cells[idx + 1] >= 0 ? 1 : 0;
      const landLeft = cells[idx - 1] >= 0 ? 1 : 0;
      const landDown = cells[idx + cols] >= 0 ? 1 : 0;
      const landUp = cells[idx - cols] >= 0 ? 1 : 0;
      if (landRight + landLeft + landDown + landUp === 0) continue;

      const nx = landLeft - landRight;
      const ny = landUp - landDown;
      const px = gx * step;
      const py = gy * step;
      if (coastSurf.some((s) => Math.hypot(s.x - px, s.y - py) < 16)) continue;

      coastSurf.push({
        x: px,
        y: py,
        nx,
        ny,
        phase: (gx * 0.19 + gy * 0.13) % (Math.PI * 2),
      });
    }
  }

  // 7. Populate Living Ocean Features (Coral Reefs, Sea Stacks, Merchant Boats, Sea Life)
  const oceanFeatures: MapGridData['oceanFeatures'] = [];

  const isNearBridge = (px: number, py: number): boolean => {
    for (const t of territories) {
      for (const nId of t.bridgeNeighbors) {
        if (t.id >= nId) continue;
        const n = territories[nId];
        const mx = (t.x + n.x) * 0.5;
        const my = (t.y + n.y) * 0.5;
        if (Math.hypot(px - mx, py - my) < 55) return true;
        // Distance to segment
        const vx = n.x - t.x;
        const vy = n.y - t.y;
        const lenSq = vx * vx + vy * vy || 1;
        const proj = Math.max(0, Math.min(1, ((px - t.x) * vx + (py - t.y) * vy) / lenSq));
        const cx = t.x + vx * proj;
        const cy = t.y + vy * proj;
        if (Math.hypot(px - cx, py - cy) < 28) return true;
      }
    }
    return false;
  };

  // 7a. Turquoise Coral Reefs / Shoals
  const reefTarget = preset === 'archipelago' ? 10 : preset === 'middle_east' ? 7 : 5;
  for (let attempt = 0; attempt < 220 && oceanFeatures.length < reefTarget; attempt++) {
    const gx = 8 + Math.floor(artRng() * (cols - 16));
    const gy = 8 + Math.floor(artRng() * (rows - 16));
    const idx = gy * cols + gx;
    if (cells[idx] !== -1) continue;
    const elev = elevation[idx];
    if (elev < 64 || elev > 106) continue;
    const px = gx * step;
    const py = gy * step;
    if (px < 115 && py > height - 115) continue; // Keep compass corner clean
    if (isNearBridge(px, py)) continue;
    if (oceanFeatures.some((f) => Math.hypot(f.x - px, f.y - py) < 58)) continue;
    oceanFeatures.push({
      kind: 'reef',
      x: px,
      y: py,
      phase: artRng() * Math.PI * 2,
      scale: 0.85 + artRng() * 0.45,
      dir: artRng() > 0.5 ? 1 : -1,
    });
  }

  // 7b. Craggy Pixel Sea Stacks / Rocky Islets
  let rockCount = 0;
  const rockTarget = preset === 'archipelago' ? 7 : 5;
  for (let attempt = 0; attempt < 240 && rockCount < rockTarget; attempt++) {
    const gx = 10 + Math.floor(artRng() * (cols - 20));
    const gy = 10 + Math.floor(artRng() * (rows - 20));
    const idx = gy * cols + gx;
    if (cells[idx] !== -1) continue;
    const elev = elevation[idx];
    if (elev < 14 || elev > 76) continue;
    const px = gx * step;
    const py = gy * step;
    if (px < 125 && py > height - 125) continue;
    if (isNearBridge(px, py)) continue;
    if (oceanFeatures.some((f) => Math.hypot(f.x - px, f.y - py) < 64)) continue;
    oceanFeatures.push({
      kind: 'sea_rock',
      x: px,
      y: py,
      phase: artRng() * Math.PI * 2,
      scale: 0.9 + artRng() * 0.35,
      dir: artRng() > 0.5 ? 1 : -1,
    });
    rockCount++;
  }

  // 7c. Tiny Drifting Neutral Merchant Sailboats in Deep Ocean Lanes
  let shipCount = 0;
  for (let attempt = 0; attempt < 200 && shipCount < 3; attempt++) {
    const gx = 14 + Math.floor(artRng() * (cols - 28));
    const gy = 12 + Math.floor(artRng() * (rows - 24));
    const idx = gy * cols + gx;
    if (cells[idx] !== -1) continue;
    if (elevation[idx] > 50) continue;
    const px = gx * step;
    const py = gy * step;
    if (px < 140 && py > height - 135) continue;
    if (isNearBridge(px, py)) continue;
    if (oceanFeatures.some((f) => Math.hypot(f.x - px, f.y - py) < 95)) continue;
    oceanFeatures.push({
      kind: 'ship_ambient',
      x: px,
      y: py,
      phase: artRng() * Math.PI * 2,
      scale: 1.0,
      dir: artRng() > 0.5 ? 1 : -1,
    });
    shipCount++;
  }

  // 7d. Deep Ocean Sea Creature Ripple (Whale Tail / Sea Serpent Fin)
  let creatureCount = 0;
  for (let attempt = 0; attempt < 180 && creatureCount < 2; attempt++) {
    const gx = 14 + Math.floor(artRng() * (cols - 28));
    const gy = 14 + Math.floor(artRng() * (rows - 28));
    const idx = gy * cols + gx;
    if (cells[idx] !== -1) continue;
    if (elevation[idx] > 32) continue;
    const px = gx * step;
    const py = gy * step;
    if (px < 140 && py > height - 140) continue;
    if (isNearBridge(px, py)) continue;
    if (oceanFeatures.some((f) => Math.hypot(f.x - px, f.y - py) < 105)) continue;
    oceanFeatures.push({
      kind: 'sea_creature',
      x: px,
      y: py,
      phase: artRng() * Math.PI * 2,
      scale: 1.0,
      dir: artRng() > 0.5 ? 1 : -1,
    });
    creatureCount++;
  }

  // 8. Scatter Rich Pixel-Art Biome & Preset Landmarks Safely Away from Castles, Plaques & Rivers
  const props: MapGridData['props'] = [];

  const isPropSpotSafe = (t: Territory, px: number, py: number, minPropSpacing = 21): boolean => {
    const gx = Math.floor(px / step);
    const gy = Math.floor(py / step);
    if (gx < 3 || gy < 3 || gx >= cols - 3 || gy >= rows - 3) return false;

    const cCenter = cells[gy * cols + gx];
    if (
      cCenter !== t.id ||
      cells[gy * cols + (gx + 2)] !== t.id ||
      cells[gy * cols + (gx - 2)] !== t.id ||
      cells[(gy + 2) * cols + gx] !== t.id ||
      cells[(gy - 2) * cols + gx] !== t.id
    ) {
      return false;
    }

    // Keep landmarks out of river channels
    if (
      riverMask[gy * cols + gx] > 0 ||
      riverMask[gy * cols + (gx + 1)] > 0 ||
      riverMask[gy * cols + (gx - 1)] > 0 ||
      riverMask[(gy + 1) * cols + gx] > 0
    ) {
      return false;
    }

    // Clear of castle footprints & data plaques directly beneath castles
    if (
      territories.some(
        (other) =>
          Math.hypot(other.x - px, other.y - py) < 48 ||
          (Math.abs(other.x - px) < 46 && py > other.y + 6 && py < other.y + 44)
      )
    ) {
      return false;
    }

    if (props.some((pr) => Math.hypot(pr.x - px, pr.y - py) < minPropSpacing)) {
      return false;
    }

    return true;
  };

  for (const t of territories) {
    // 8a. Signature Hero Landmark per Territory (Windmill / Ruin / Village / Oasis)
    const heroKind: MapGridData['props'][number]['kind'] | null =
      preset === 'middle_east' && (t.biome === 'fertile' || t.biome === 'plain') && artRng() > 0.35
        ? artRng() > 0.45
          ? 'oasis'
          : 'ruin'
        : t.biome === 'fertile'
          ? 'windmill'
          : t.biome === 'plain'
            ? artRng() > 0.48
              ? 'ruin'
              : 'village'
            : t.biome === 'forest' && artRng() > 0.65
              ? 'village'
              : null;

    if (heroKind) {
      for (let attempt = 0; attempt < 45; attempt++) {
        const angle = artRng() * Math.PI * 2;
        const dist = 48 + artRng() * 44;
        const px = Math.round(t.x + Math.cos(angle) * dist);
        const py = Math.round(t.y + Math.sin(angle) * dist);
        if (!isPropSpotSafe(t, px, py, 26)) continue;
        props.push({
          kind: heroKind,
          x: px,
          y: py,
          variant: Math.floor(artRng() * 3),
          territoryId: t.id,
        });
        break;
      }
    }

    // 8b. Organic Biome Flora, Mountain Ridges & Fields
    const targetProps =
      t.biome === 'forest'
        ? 9
        : t.biome === 'mountain'
          ? 6
          : t.biome === 'fertile'
            ? 7
            : 4;

    let placed = 0;
    for (let attempt = 0; attempt < 110 && placed < targetProps; attempt++) {
      const angle = rng() * Math.PI * 2;
      const dist = 48 + rng() * 92;
      const px = Math.round(t.x + Math.cos(angle) * dist);
      const py = Math.round(t.y + Math.sin(angle) * dist);
      if (!isPropSpotSafe(t, px, py, 20)) continue;

      let kind: MapGridData['props'][number]['kind'];
      if (t.biome === 'mountain') {
        kind = 'mountain';
      } else if (preset === 'middle_east') {
        if (t.biome === 'fertile') {
          kind = artRng() > 0.55 ? 'palm' : 'wheat';
        } else if (t.biome === 'forest') {
          kind = artRng() > 0.45 ? 'cypress' : 'palm';
        } else {
          kind = artRng() > 0.45 ? 'palm' : 'cypress';
        }
      } else if (t.biome === 'forest') {
        const r = artRng();
        kind = r > 0.62 ? 'pine' : r > 0.25 ? 'tree' : 'cypress';
      } else if (t.biome === 'fertile') {
        kind = artRng() > 0.22 ? 'wheat' : 'cypress';
      } else {
        const r = artRng();
        kind =
          preset === 'archipelago' && t.isCoastal && r > 0.55
            ? 'palm'
            : r > 0.6
              ? 'tree'
              : r > 0.3
                ? 'cypress'
                : 'wheat';
      }

      props.push({
        kind,
        x: px,
        y: py,
        variant: Math.floor(rng() * 3),
        territoryId: t.id,
      });
      placed++;
    }
  }

  props.sort((a, b) => a.y - b.y);

  return {
    map: {
      width,
      height,
      step,
      cols,
      rows,
      cells,
      elevation,
      riverMask,
      riverSparkles,
      coastSurf,
      oceanFeatures,
      props,
      seed,
      preset,
    },
    territories,
  };
}
