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
  const nx = (x - w * 0.5) / (w * 0.44);
  const ny = (y - h * 0.5) / (h * 0.43);

  const organicRipple =
    0.055 * Math.sin(nx * 4.2 + waves.p1) * Math.cos(ny * 3.8 + waves.p2) +
    0.035 * Math.cos((nx - ny) * 5.6 + waves.p3);

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
    return base + organicRipple * 0.68;
  }

  if (preset === 'strait') {
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
    return base + organicRipple;
  }

  if (preset === 'middle_east') {
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

    return land + organicRipple * 0.65;
  }

  // Default: 'continent' (Classic organic single landmass)
  const dist = Math.hypot(nx, ny);
  const angle = Math.atan2(ny, nx);
  const coastMod =
    0.13 * Math.sin(angle * 3 + waves.p1) +
    0.08 * Math.cos(angle * 5 + waves.p2) +
    0.05 * Math.sin(angle * 7 + waves.p3) +
    0.04 * Math.sin(nx * 3.8 + waves.p4) * Math.cos(ny * 3.4 + waves.a1);
  return 0.98 + coastMod - dist;
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

  // Scatter pixel-art biome props (trees, mountains, wheat) safely away from castles & borders
  const props: MapGridData['props'] = [];
  for (const t of territories) {
    const targetProps =
      t.biome === 'forest'
        ? 8
        : t.biome === 'mountain'
          ? 5
          : t.biome === 'fertile'
            ? 6
            : 3;

    let placed = 0;
    for (let attempt = 0; attempt < 90 && placed < targetProps; attempt++) {
      const angle = rng() * Math.PI * 2;
      const dist = 48 + rng() * 88;
      const px = Math.round(t.x + Math.cos(angle) * dist);
      const py = Math.round(t.y + Math.sin(angle) * dist);

      const gx = Math.floor(px / step);
      const gy = Math.floor(py / step);
      if (gx < 3 || gy < 3 || gx >= cols - 3 || gy >= rows - 3) continue;

      const cCenter = cells[gy * cols + gx];
      if (
        cCenter !== t.id ||
        cells[gy * cols + (gx + 2)] !== t.id ||
        cells[gy * cols + (gx - 2)] !== t.id ||
        cells[(gy + 2) * cols + gx] !== t.id ||
        cells[(gy - 2) * cols + gx] !== t.id
      ) {
        continue;
      }

      if (territories.some((other) => Math.hypot(other.x - px, other.y - py) < 52)) {
        continue;
      }

      if (props.some((pr) => Math.hypot(pr.x - px, pr.y - py) < 22)) {
        continue;
      }

      const kind =
        t.biome === 'mountain'
          ? 'mountain'
          : t.biome === 'forest'
            ? rng() > 0.45
              ? 'pine'
              : 'tree'
            : t.biome === 'fertile'
              ? 'wheat'
              : rng() > 0.5
                ? 'tree'
                : 'wheat';

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
      props,
      seed,
      preset,
    },
    territories,
  };
}
