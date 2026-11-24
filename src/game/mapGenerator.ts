import {
  ECONOMY,
  FACTIONS,
  GRID_STEP,
  PROVINCE_NAMES,
  TERRITORY_COUNT,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './constants';
import type { FactionId, MapGridData, Territory } from './types';

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
  a2: number;
}

/** Evaluates whether a world coordinate lies on the organic landmass continent */
function evaluateLandMask(
  x: number,
  y: number,
  w: number,
  h: number,
  waves: WaveParams
): number {
  const nx = (x - w * 0.5) / (w * 0.44);
  const ny = (y - h * 0.5) / (h * 0.43);
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
  count: number = TERRITORY_COUNT
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
    a2: rng() * Math.PI * 2,
  };

  // 1. Place well-spaced territory centers safely inside the organic continent
  const points: Array<{ x: number; y: number }> = [];
  const minSpacing = 132;
  const marginX = 115;
  const marginY = 92;

  for (let i = 0; i < count; i++) {
    let bestX = width * 0.5;
    let bestY = height * 0.5;
    let bestScore = -Infinity;

    // Best-candidate sampling (Mitchell's algorithm) for balanced, natural map spacing
    const candidates = 45;
    for (let c = 0; c < candidates; c++) {
      const cx = marginX + rng() * (width - marginX * 2);
      const cy = marginY + rng() * (height - marginY * 2);
      const landVal = evaluateLandMask(cx, cy, width, height, waves);
      if (landVal < 0.14) continue;

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
      if (points.length > 0 && minDist >= minSpacing && landVal > 0.2) {
        break;
      }
    }
    points.push({ x: bestX, y: bestY });
  }

  // 2. One pass of gentle Lloyd relaxation inside the continent for handsome polygon proportions
  const cells = new Int16Array(cols * rows);
  const elevation = new Uint8Array(cols * rows);

  const assignCells = () => {
    for (let gy = 0; gy < rows; gy++) {
      const py = gy * step + step * 0.5;
      for (let gx = 0; gx < cols; gx++) {
        const px = gx * step + step * 0.5;
        const idx = gy * cols + gx;
        const landVal = evaluateLandMask(px, py, width, height, waves);

        if (landVal <= 0) {
          cells[idx] = -1;
          // Store coastal depth for ocean bathymetry rings (0..120)
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

  // Compute centroids to keep castle icons centered nicely within their organic cell
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
      // Blend toward centroid while ensuring castle stays well inside land
      if (evaluateLandMask(cx, cy, width, height, waves) > 0.09) {
        points[i].x = points[i].x * 0.35 + cx * 0.65;
        points[i].y = points[i].y * 0.35 + cy * 0.65;
      }
    }
  }

  // Re-assign grid cleanly with relaxed points
  assignCells();

  // 3. Extract neighbor adjacency and shared border crossing midpoints
  const neighborSets: Array<Set<number>> = Array.from({ length: count }, () => new Set());
  const borderAccum = new Map<string, { sx: number; sy: number; n: number }>();

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

  for (let gy = 0; gy < rows - 1; gy++) {
    const py = gy * step + step * 0.5;
    for (let gx = 0; gx < cols - 1; gx++) {
      const px = gx * step + step * 0.5;
      const cur = cells[gy * cols + gx];
      if (cur < 0) continue;
      const right = cells[gy * cols + gx + 1];
      const down = cells[(gy + 1) * cols + gx];
      if (right >= 0 && right !== cur) {
        recordBorder(cur, right, px + step * 0.5, py);
      }
      if (down >= 0 && down !== cur) {
        recordBorder(cur, down, px, py + step * 0.5);
      }
    }
  }

  // Ensure full graph connectivity (no disconnected pockets)
  const visited = new Set<number>([0]);
  const queue = [0];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const n of neighborSets[cur]) {
      if (!visited.has(n)) {
        visited.add(n);
        queue.push(n);
      }
    }
  }
  if (visited.size < count) {
    for (let i = 0; i < count; i++) {
      if (visited.has(i)) continue;
      let nearest = 0;
      let minD = Infinity;
      for (const v of visited) {
        const d = Math.hypot(points[i].x - points[v].x, points[i].y - points[v].y);
        if (d < minD) {
          minD = d;
          nearest = v;
        }
      }
      neighborSets[i].add(nearest);
      neighborSets[nearest].add(i);
      visited.add(i);
    }
  }

  // 4. Select 6 well-separated starting capitals (farthest-point sampling) for the 6 factions
  const capitalIndices: number[] = [];
  // Start player (Faction 0) on a territory with >= 2 neighbors and moderate outer-ring position
  let playerStart = 0;
  let bestStartScore = -Infinity;
  for (let i = 0; i < count; i++) {
    const deg = neighborSets[i].size;
    const distFromCenter = Math.hypot(points[i].x - width * 0.5, points[i].y - height * 0.5);
    const score = deg * 25 + distFromCenter * 0.15 + rng() * 12;
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
      // Small preference to avoid placing AI immediately adjacent to player if possible
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
    const borderCrossings: Record<number, { x: number; y: number }> = {};

    for (const nId of neighbors) {
      const key = id < nId ? `${id}:${nId}` : `${nId}:${id}`;
      const acc = borderAccum.get(key);
      if (acc && acc.n > 0) {
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
      neighbors,
      borderCrossings,
      hitFlash: 0,
      capturePulse: 0,
      towerFireTimer: 0,
      shieldTimer: 0,
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

      // Must sit cleanly inside this territory (not right on a border or coastline)
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

      // Keep clear of any castle & plaque area
      if (territories.some((other) => Math.hypot(other.x - px, other.y - py) < 52)) {
        continue;
      }

      // Keep clear of already placed props
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

  // Sort props top-to-bottom for authentic 2.5D painter's depth order
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
    },
    territories,
  };
}
