import {
  BIOMES,
  BUILDINGS,
  ECONOMY,
  FACTIONS,
  NEUTRAL_STYLE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './constants';
import { ParticleSystem } from './particles';
import { PixelSpriteAtlas } from './pixelSprites';
import { canDispatchTo, getBuildingLevel, previewAttackOutcome } from './simulation';
import type {
  DragAimState,
  FloatingText,
  GameSimulation,
  SimEvent,
  Territory,
} from './types';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

const FACTION_LAND_RGB = FACTIONS.map((f) => hexToRgb(f.landFill));
const FACTION_GLOW_RGB = FACTIONS.map((f) => hexToRgb(f.borderGlow));
const NEUTRAL_LAND_RGB = hexToRgb(NEUTRAL_STYLE.landFill);
const NEUTRAL_GLOW_RGB = hexToRgb(NEUTRAL_STYLE.borderGlow);

// Classic 2x2 Bayer matrix for crisp 16-bit ordered pixel dithering
const BAYER_2X2 = [
  [0, 2],
  [3, 1],
];

const MINE_AURA_COLORS = [
  'rgba(250, 204, 21, 0.080)',
  'rgba(250, 204, 21, 0.135)',
  'rgba(250, 204, 21, 0.190)',
  'rgba(250, 204, 21, 0.245)',
] as const;

const TOWER_HALO_COLORS = [
  'rgba(125, 211, 252, 0.22)',
  'rgba(125, 211, 252, 0.42)',
] as const;

const FORGE_AURA_COLORS = [
  'rgba(249, 115, 22, 0.100)',
  'rgba(249, 115, 22, 0.165)',
  'rgba(249, 115, 22, 0.230)',
  'rgba(249, 115, 22, 0.295)',
] as const;

export interface ViewportTransform {
  width: number;
  height: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  dpr: number;
}

export class GameRenderer {
  private bgCanvas: HTMLCanvasElement;
  private bgCtx: CanvasRenderingContext2D;
  private overlayCanvas: HTMLCanvasElement;
  private overlayCtx: CanvasRenderingContext2D;
  private bgImageData: ImageData;
  private cachedMapSeed: number | null = null;
  private cachedCellsRef: Int16Array | null = null;
  private cachedTerritoriesRef: Territory[] | null = null;
  private sortedTerritories: Territory[] = [];
  private atlas: PixelSpriteAtlas;
  private vfx: ParticleSystem;
  private texts: FloatingText[];
  private textCursor = 0;
  private oceanSparkles: Array<{ x: number; y: number; phase: number }> = [];
  private animatedWindmills: Array<{ x: number; y: number; phase: number }> = [];
  private animatedVillages: Array<{ x: number; y: number; phase: number }> = [];
  private birdFlocks: Array<{
    baseX: number;
    baseY: number;
    vx: number;
    vy: number;
    phase: number;
    count: number;
  }> = [];
  private clouds: Array<{
    baseX: number;
    baseY: number;
    speed: number;
    w: number;
    h: number;
  }> = [];

  public viewport: ViewportTransform = {
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    dpr: 1,
  };

  constructor() {
    this.bgCanvas = document.createElement('canvas');
    this.bgCanvas.width = WORLD_WIDTH;
    this.bgCanvas.height = WORLD_HEIGHT;
    this.bgCtx = this.bgCanvas.getContext('2d')!;
    this.bgCtx.imageSmoothingEnabled = false;
    this.bgImageData = this.bgCtx.createImageData(WORLD_WIDTH, WORLD_HEIGHT);

    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.width = WORLD_WIDTH;
    this.overlayCanvas.height = WORLD_HEIGHT;
    this.overlayCtx = this.overlayCanvas.getContext('2d')!;
    this.overlayCtx.imageSmoothingEnabled = false;

    this.atlas = new PixelSpriteAtlas();
    this.vfx = new ParticleSystem();

    this.texts = Array.from({ length: 44 }, () => ({
      active: false,
      x: 0,
      y: 0,
      vy: -24,
      life: 0,
      maxLife: 1,
      text: '',
      color: '#ffffff',
    }));
  }

  public clearEffects() {
    this.vfx.clear();
    for (const t of this.texts) t.active = false;
  }

  public spawnFloatingText(x: number, y: number, text: string, color: string) {
    const f = this.texts[this.textCursor];
    this.textCursor = (this.textCursor + 1) % this.texts.length;
    f.active = true;
    f.x = x + (Math.random() - 0.5) * 14;
    f.y = y - 18;
    f.vy = -30;
    f.life = 0;
    f.maxLife = 1.1;
    f.text = text;
    f.color = color;
  }

  public consumeEvents(events: SimEvent[]) {
    this.vfx.consumeEvents(events);

    for (const ev of events) {
      if (ev.type === 'build' && ev.building) {
        const lvl = ev.buildingLevel ?? 1;
        const tierName = BUILDINGS[ev.building].levelNames[Math.max(0, Math.min(2, lvl - 1))];
        const label =
          lvl >= 3
            ? `★ ${tierName} (حداکثر)`
            : lvl === 2
              ? `ارتقا به ${tierName} (سطح ۲)`
              : `${tierName} ساخته شد`;
        const color =
          lvl >= 3
            ? '#fef08a'
            : ev.building === 'port'
              ? '#7dd3fc'
              : '#fde68a';
        this.spawnFloatingText(ev.x, ev.y - 14, label, color);
      } else if (ev.type === 'power') {
        if (ev.power === 'mobilize') {
          this.spawnFloatingText(ev.x, ev.y - 14, `بسیج +${ev.amount ?? 0}`, '#fde047');
        } else if (ev.power === 'blitz') {
          this.spawnFloatingText(ev.x, ev.y - 16, 'یورش برق‌آسا ۲×', '#7dd3fc');
        } else if (ev.power === 'shield') {
          this.spawnFloatingText(ev.x, ev.y - 16, 'سپر سلطنتی فعال شد', '#93c5fd');
        }
      } else if (ev.type === 'clash') {
        if (ev.amount) {
          this.spawnFloatingText(ev.x, ev.y, `-${ev.amount}`, '#fca5a5');
        }
      } else if (ev.type === 'tower_block') {
        if (ev.amount && ev.amount > 0) {
          this.spawnFloatingText(ev.x, ev.y - 24, `دفاع -${ev.amount}`, '#7dd3fc');
        }
      } else if (ev.type === 'capture') {
        this.spawnFloatingText(
          ev.x,
          ev.y - 12,
          ev.capturedByPlayer ? 'قلعه فتح شد!' : 'سقوط قلعه',
          ev.capturedByPlayer ? '#fde047' : '#fda4af'
        );
      } else if (ev.type === 'reinforce' && ev.owner === 0 && ev.amount) {
        this.spawnFloatingText(ev.x, ev.y, `+${Math.round(ev.amount)}`, '#86efac');
      }
    }
  }

  public updateEffects(dt: number, sim?: GameSimulation, isTitleBackdrop = false) {
    if (sim) {
      this.vfx.emitAmbient(sim, dt, isTitleBackdrop);
    }
    this.vfx.update(dt);

    for (const f of this.texts) {
      if (!f.active) continue;
      f.life += dt;
      if (f.life >= f.maxLife) {
        f.active = false;
        continue;
      }
      f.y += f.vy * dt;
      f.vy *= 0.97;
    }
  }

  /** Re-renders the 16-bit pixel-art ocean, 2.5D hillshaded continent, rivers, biome props, sea chart, and roads */
  public rebuildTerrainBuffer(sim: GameSimulation) {
    const { map, territories } = sim;
    const { width, height, step, cols, rows, cells, elevation, riverMask, oceanFeatures, props, preset } = map;
    if (this.bgImageData.width !== width || this.bgImageData.height !== height) {
      this.bgImageData = this.bgCtx.createImageData(width, height);
    }
    const data = this.bgImageData.data;
    const isNewMap = this.cachedMapSeed !== map.seed || this.cachedCellsRef !== cells;

    if (isNewMap) {
      this.oceanSparkles = [];
      this.animatedWindmills = [];
      this.animatedVillages = [];
      this.cachedMapSeed = map.seed;
      this.cachedCellsRef = cells;

      // Deterministic atmospheric flocks & cloud shadows per seed
      const s = map.seed;
      this.birdFlocks = [
        { baseX: (s * 37) % width, baseY: 130 + ((s * 17) % 190), vx: 19, vy: 5.5, phase: 0.4, count: 3 },
        { baseX: (s * 71 + 420) % width, baseY: 320 + ((s * 29) % 220), vx: 15, vy: -4.2, phase: 2.1, count: 3 },
        { baseX: (s * 113 + 780) % width, baseY: 200 + ((s * 43) % 280), vx: -17, vy: 3.8, phase: 4.0, count: 2 },
      ];
      this.clouds = [
        { baseX: (s * 53) % (width + 260), baseY: 105, speed: 9.5, w: 156, h: 48 },
        { baseX: (s * 97 + 340) % (width + 260), baseY: 275, speed: 7.2, w: 192, h: 56 },
        { baseX: (s * 139 + 690) % (width + 260), baseY: 455, speed: 11.0, w: 168, h: 46 },
        { baseX: (s * 181 + 980) % (width + 260), baseY: 600, speed: 8.4, w: 144, h: 42 },
      ];

      // Bake static sea chart, ocean coral reefs/rocks, roads/bridges, biome props, and Persian compass once per map seed
      if (this.overlayCanvas.width !== width || this.overlayCanvas.height !== height) {
        this.overlayCanvas.width = width;
        this.overlayCanvas.height = height;
      }
      this.overlayCtx.clearRect(0, 0, width, height);
      this.overlayCtx.imageSmoothingEnabled = false;

      // 1. Subtle Cartographic Sea Chart Rhumb Lines & Astrolabe Grid (painted strictly on open water)
      this.drawSeaChartGrid(this.overlayCtx, map);

      // 2. Ocean Coral Reefs & Rocky Sea Stacks
      for (const feat of oceanFeatures) {
        if (feat.kind === 'reef') {
          this.drawCoralReef(this.overlayCtx, feat.x, feat.y, feat.scale, preset);
        } else if (feat.kind === 'sea_rock') {
          const spr = this.atlas.seaRock;
          const dw = Math.round(spr.width * 2 * feat.scale);
          const dh = Math.round(spr.height * 2 * feat.scale);
          this.overlayCtx.fillStyle = 'rgba(7, 14, 28, 0.45)';
          this.overlayCtx.fillRect(
            Math.round(feat.x - dw * 0.42),
            Math.round(feat.y + dh * 0.12),
            Math.round(dw * 0.84),
            5
          );
          this.overlayCtx.drawImage(
            spr,
            Math.round(feat.x - dw * 0.5),
            Math.round(feat.y - dh * 0.65),
            dw,
            dh
          );
        }
      }

      // 3. Cobbled Imperial Roads, Automatic Stone River Bridges & Wooden Sea Bridges
      this.overlayCtx.save();
      for (const t of territories) {
        for (const nId of t.neighbors) {
          if (t.id >= nId) continue;
          const n = territories[nId];
          const via = t.borderCrossings[nId] ?? {
            x: (t.x + n.x) * 0.5,
            y: (t.y + n.y) * 0.5,
          };
          if (t.bridgeNeighbors.includes(nId)) {
            this.drawPixelBridge(this.overlayCtx, t.x, t.y, via.x, via.y, n.x, n.y);
          } else {
            this.drawPixelRoad(this.overlayCtx, map, t.x, t.y, via.x, via.y, n.x, n.y);
          }
        }
      }
      this.overlayCtx.restore();

      // 4. Biome & Preset World Landmarks (Depth-Sorted)
      for (const prop of props) {
        if (prop.kind === 'windmill') {
          const spr = this.atlas.windmillBase;
          const dw = spr.width * 2;
          const dh = spr.height * 2;
          this.overlayCtx.fillStyle = 'rgba(10, 15, 25, 0.38)';
          this.overlayCtx.fillRect(Math.round(prop.x - dw * 0.4), Math.round(prop.y + dh * 0.16), Math.round(dw * 0.8), 4);
          this.overlayCtx.drawImage(spr, Math.round(prop.x - dw * 0.5), Math.round(prop.y - dh * 0.72), dw, dh);
          this.animatedWindmills.push({
            x: Math.round(prop.x),
            y: Math.round(prop.y - dh * 0.36),
            phase: (prop.x * 0.05 + prop.y * 0.03) % (Math.PI * 2),
          });
          continue;
        }

        if (prop.kind === 'village') {
          const spr = this.atlas.village;
          const dw = spr.width * 2;
          const dh = spr.height * 2;
          this.overlayCtx.fillStyle = 'rgba(10, 15, 25, 0.38)';
          this.overlayCtx.fillRect(Math.round(prop.x - dw * 0.45), Math.round(prop.y + dh * 0.18), Math.round(dw * 0.9), 4);
          this.overlayCtx.drawImage(spr, Math.round(prop.x - dw * 0.5), Math.round(prop.y - dh * 0.65), dw, dh);
          this.animatedVillages.push({
            x: prop.x,
            y: prop.y,
            phase: (prop.x * 0.09 + prop.y * 0.07) % (Math.PI * 2),
          });
          continue;
        }

        const sprite =
          prop.kind === 'mountain'
            ? this.atlas.mountain
            : prop.kind === 'pine'
              ? this.atlas.pine
              : prop.kind === 'cypress'
                ? this.atlas.cypress
                : prop.kind === 'palm'
                  ? this.atlas.palm
                  : prop.kind === 'ruin'
                    ? this.atlas.ruin
                    : prop.kind === 'oasis'
                      ? this.atlas.oasis
                      : prop.kind === 'wheat'
                        ? this.atlas.wheat
                        : this.atlas.oak;
        const scale =
          prop.kind === 'mountain'
            ? 2.4
            : prop.kind === 'ruin' || prop.kind === 'oasis'
              ? 2.0
              : prop.kind === 'cypress' || prop.kind === 'palm'
                ? 2.0
                : 2.0;
        const dw = Math.round(sprite.width * scale);
        const dh = Math.round(sprite.height * scale);
        if (prop.kind !== 'oasis') {
          this.overlayCtx.fillStyle = 'rgba(10, 15, 25, 0.34)';
          this.overlayCtx.fillRect(
            Math.round(prop.x - dw * 0.35),
            Math.round(prop.y + dh * 0.24),
            Math.round(dw * 0.7),
            3
          );
        }
        this.overlayCtx.drawImage(
          sprite,
          Math.round(prop.x - dw * 0.5),
          Math.round(prop.y - dh * 0.65),
          dw,
          dh
        );
      }

      // 5. Ornate 16-Bit Persian Cartographic Compass Rose, Brass Map Frame & Baked Warm NW Sunlight Wash
      this.drawPixelCompass(this.overlayCtx, 68, height - 66);
      this.drawCartographicFrame(this.overlayCtx, width, height);
      const sunGrad = this.overlayCtx.createRadialGradient(130, 90, 20, 180, 120, 560);
      sunGrad.addColorStop(0, 'rgba(255, 224, 150, 0.065)');
      sunGrad.addColorStop(1, 'rgba(255, 224, 150, 0)');
      this.overlayCtx.fillStyle = sunGrad;
      this.overlayCtx.fillRect(0, 0, width, height);
    }

    // Preset-specific ocean & terrain warmth tuning
    const isMiddleEast = preset === 'middle_east';
    const isArchipelago = preset === 'archipelago';
    const isStrait = preset === 'strait';

    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const idx = gy * cols + gx;
        const cellId = cells[idx];

        // Ocean pixels never change mid-match; skip on capture re-tints
        if (cellId === -1 && !isNewMap) continue;

        const elev = elevation[idx];
        const dither = BAYER_2X2[gy & 1][gx & 1];

        let r = 14;
        let g = 29;
        let b = 52;

        if (cellId === -1) {
          // Check if directly south of a landmass to cast a crisp 2.5D island drop shadow into the water
          const land1North = gy > 0 && cells[idx - cols] >= 0;
          const land2North = gy > 1 && cells[idx - cols * 2] >= 0;
          const land3North = gy > 2 && cells[idx - cols * 3] >= 0;

          // 16-bit stepped turquoise/cobalt ocean with ordered Bayer dithering
          const val = elev + dither * 5;
          if (val > 113) {
            r = isArchipelago ? 132 : isMiddleEast ? 130 : 124;
            g = isArchipelago ? 214 : isMiddleEast ? 204 : 198;
            b = isArchipelago ? 222 : isMiddleEast ? 210 : 212;
          } else if (val > 95) {
            r = isArchipelago ? 34 : isMiddleEast ? 38 : isStrait ? 30 : 35;
            g = isArchipelago ? 124 : isMiddleEast ? 114 : isStrait ? 88 : 98;
            b = isArchipelago ? 148 : isMiddleEast ? 138 : isStrait ? 124 : 132;
          } else if (val > 72) {
            r = isArchipelago ? 20 : isStrait ? 19 : 22;
            g = isArchipelago ? 78 : isStrait ? 56 : 64;
            b = isArchipelago ? 112 : isStrait ? 88 : 98;
          } else if (val > 44) {
            r = 15;
            g = isArchipelago ? 48 : 42;
            b = isArchipelago ? 80 : 72;
          } else {
            r = 10;
            g = 26;
            b = 48;
          }

          // Apply 2.5D coastal water drop shadow directly under southern cliffs
          if (land1North) {
            r = Math.round(r * 0.48);
            g = Math.round(g * 0.52);
            b = Math.round(b * 0.6);
          } else if (land2North) {
            r = Math.round(r * 0.68);
            g = Math.round(g * 0.72);
            b = Math.round(b * 0.78);
          } else if (land3North && (dither & 1) === 0) {
            r = Math.round(r * 0.85);
            g = Math.round(g * 0.87);
            b = Math.round(b * 0.9);
          }

          if (
            elev < 90 &&
            elev > 16 &&
            ((gx * 73 + gy * 131 + map.seed) & 511) === 7
          ) {
            this.oceanSparkles.push({
              x: gx * step,
              y: gy * step,
              phase: ((gx + gy) * 0.45) % (Math.PI * 2),
            });
          }
        } else {
          const terr = territories[cellId];
          const owner = terr.owner;
          const base = owner === -1 ? NEUTRAL_LAND_RGB : FACTION_LAND_RGB[owner];
          const glow = owner === -1 ? NEUTRAL_GLOW_RGB : FACTION_GLOW_RGB[owner];

          let br = base[0];
          let bg = base[1];
          let bb = base[2];

          // Subtle preset climate character (sun-baked warm plateau for Middle East, emerald archipelago, cool strait)
          if (isMiddleEast) {
            br = Math.min(255, br + 16);
            bg = Math.min(255, bg + 9);
            bb = Math.max(0, bb - 10);
          } else if (isArchipelago) {
            bg = Math.min(255, bg + 7);
          } else if (isStrait) {
            bb = Math.min(255, bb + 7);
          }

          if (terr.biome === 'fertile') {
            br = Math.min(255, br + 15);
            bg = Math.min(255, bg + 15);
            bb = Math.max(0, bb - 9);
          } else if (terr.biome === 'forest') {
            br = Math.max(0, br - 9);
            bg = Math.min(255, bg + 11);
            bb = Math.max(0, bb - 4);
          } else if (terr.biome === 'mountain') {
            br = Math.min(255, br + 7);
            bg = Math.min(255, bg + 9);
            bb = Math.min(255, bb + 15);
          }

          const right = gx + 1 < cols ? cells[idx + 1] : -1;
          const down = gy + 1 < rows ? cells[idx + cols] : -1;
          const left = gx > 0 ? cells[idx - 1] : -1;
          const up = gy > 0 ? cells[idx - cols] : -1;

          const isCoast = right === -1 || down === -1 || left === -1 || up === -1;
          const isSouthCliffBase = down === -1;
          const isSouthCliffUpper = !isSouthCliffBase && gy + 2 < rows && cells[idx + cols * 2] === -1;
          const isBeach =
            !isCoast &&
            !isSouthCliffUpper &&
            ((gx + 2 < cols && cells[idx + 2] === -1) ||
              (gx > 1 && cells[idx - 2] === -1) ||
              (gy + 2 < rows && cells[idx + cols * 2] === -1) ||
              (gy > 1 && cells[idx - cols * 2] === -1));

          const isEnemyBorder =
            (right >= 0 && right !== cellId && territories[right].owner !== owner) ||
            (down >= 0 && down !== cellId && territories[down].owner !== owner);
          const isEnemyInnerRim =
            !isEnemyBorder &&
            ((left >= 0 && left !== cellId && territories[left].owner !== owner) ||
              (up >= 0 && up !== cellId && territories[up].owner !== owner) ||
              (gx + 2 < cols && cells[idx + 2] >= 0 && cells[idx + 2] !== cellId && territories[cells[idx + 2]].owner !== owner) ||
              (gy + 2 < rows && cells[idx + cols * 2] >= 0 && cells[idx + cols * 2] !== cellId && territories[cells[idx + cols * 2]].owner !== owner));
          const isInternalBorder =
            !isEnemyBorder &&
            ((right >= 0 && right !== cellId) || (down >= 0 && down !== cellId));

          const riverVal = riverMask[idx];
          const isRiverBank =
            riverVal === 0 &&
            ((gx + 1 < cols && riverMask[idx + 1] > 0) ||
              (gx > 0 && riverMask[idx - 1] > 0) ||
              (gy + 1 < rows && riverMask[idx + cols] > 0) ||
              (gy > 0 && riverMask[idx - cols] > 0));

          if (isSouthCliffBase) {
            // Lower shadowed 2.5D sandstone/slate cliff face
            const strata = (gx & 2) === 0 ? 0.92 : 1.04;
            r = Math.round((isMiddleEast ? 104 : 84) * strata);
            g = Math.round((isMiddleEast ? 80 : 65) * strata);
            b = Math.round((isMiddleEast ? 54 : 49) * strata);
          } else if (isSouthCliffUpper) {
            // Sunlit upper cliff lip directly above southern cliff face
            r = isMiddleEast ? 168 : 138;
            g = isMiddleEast ? 136 : 112;
            b = isMiddleEast ? 92 : 80;
          } else if (riverVal > 0) {
            // Sparkling procedural pixel river channel
            const isCenter = riverVal >= 2 || ((gx + gy) & 1) === 0;
            if (isCenter) {
              r = 82;
              g = 186;
              b = 224;
            } else {
              r = 40;
              g = 132;
              b = 178;
            }
          } else if (isCoast) {
            // Warm sandy beach lip framing the shoreline
            r = isMiddleEast ? 232 : 219;
            g = isMiddleEast ? 208 : 199;
            b = isMiddleEast ? 152 : 150;
          } else if (isEnemyBorder) {
            // Crisp dark-ink cartographic frontier line
            r = 12;
            g = 17;
            b = 27;
          } else if (isInternalBorder) {
            const dash = ((gx + gy) & 2) === 0;
            const factor = dash ? 0.6 : 0.86;
            r = br * factor;
            g = bg * factor;
            b = bb * factor;
          } else {
            // NW Directional Sun Hillshade + Ordered Bayer Elevation Contouring
            const eRight = gx + 1 < cols ? elevation[idx + 1] : elev;
            const eLeft = gx > 0 ? elevation[idx - 1] : elev;
            const eDown = gy + 1 < rows ? elevation[idx + cols] : elev;
            const eUp = gy > 0 ? elevation[idx - cols] : elev;
            const slope = (eLeft - eRight) * 0.45 + (eUp - eDown) * 0.55;
            const hillShade = Math.max(-0.14, Math.min(0.16, slope * 0.012));

            const eNorm = (elev - 128) / 127 + (dither - 1.5) * 0.065;
            const band = (eNorm > 0.58 ? 1.13 : eNorm > 0.3 ? 1.0 : 0.89) + hillShade;

            // Dappled organic biome micro-texture
            const hash = (gx * 41 + gy * 29) ^ (gx * 7);
            const speck = (hash & 31) === 0 ? 15 : (hash & 63) === 19 ? -9 : 0;

            if (isBeach) {
              r = Math.min(255, br * 0.58 + 94);
              g = Math.min(255, bg * 0.58 + 84);
              b = Math.min(255, bb * 0.58 + 56);
            } else if (isRiverBank) {
              // Lush fertile green-tinted riverbank accent
              r = Math.min(255, Math.max(0, br * 0.82 + 12));
              g = Math.min(255, Math.max(0, bg * 0.86 + 24));
              b = Math.min(255, Math.max(0, bb * 0.84 + 14));
            } else {
              r = Math.min(255, Math.max(0, br * band + speck));
              g = Math.min(255, Math.max(0, bg * band + speck));
              b = Math.min(255, Math.max(0, bb * band + speck * 0.65));
            }

            // Luminous inner imperial border bevel next to hostile frontiers
            if (isEnemyInnerRim) {
              const blend = owner === -1 ? 0.16 : 0.34;
              r = Math.min(255, r * (1 - blend) + glow[0] * blend);
              g = Math.min(255, g * (1 - blend) + glow[1] * blend);
              b = Math.min(255, b * (1 - blend) + glow[2] * blend);
            }
          }
        }

        const startX = gx * step;
        const startY = gy * step;
        for (let dy = 0; dy < step && startY + dy < height; dy++) {
          let rowOffset = ((startY + dy) * width + startX) * 4;
          for (let dx = 0; dx < step && startX + dx < width; dx++) {
            data[rowOffset] = r;
            data[rowOffset + 1] = g;
            data[rowOffset + 2] = b;
            data[rowOffset + 3] = 255;
            rowOffset += 4;
          }
        }
      }
    }

    this.bgCtx.putImageData(this.bgImageData, 0, 0);
    this.bgCtx.imageSmoothingEnabled = false;
    this.bgCtx.drawImage(this.overlayCanvas, 0, 0);

    sim.mapDirty = false;
  }

  /** Subtle antique Persian nautical rhumb lines & astrolabe chart grid drawn strictly over open sea */
  private drawSeaChartGrid(ctx: CanvasRenderingContext2D, map: GameSimulation['map']) {
    const { width, height, step, cols, rows, cells } = map;
    ctx.save();
    ctx.fillStyle = 'rgba(214, 185, 130, 0.065)';

    // Faint dotted latitude/longitude chart grid on ocean cells only
    const spacing = 120;
    for (let x = spacing; x < width; x += spacing) {
      const gx = Math.floor(x / step);
      for (let y = 16; y < height - 16; y += 6) {
        const gy = Math.floor(y / step);
        if (gx >= 0 && gy >= 0 && gx < cols && gy < rows && cells[gy * cols + gx] === -1) {
          ctx.fillRect(x, y, 1, 2);
        }
      }
    }
    for (let y = spacing; y < height; y += spacing) {
      const gy = Math.floor(y / step);
      for (let x = 16; x < width - 16; x += 6) {
        const gx = Math.floor(x / step);
        if (gx >= 0 && gy >= 0 && gx < cols && gy < rows && cells[gy * cols + gx] === -1) {
          ctx.fillRect(x, y, 2, 1);
        }
      }
    }

    // Radiating nautical rhumb lines from the Compass Rose across open ocean
    const cx = 68;
    const cy = height - 66;
    const angles = [0, -Math.PI / 6, -Math.PI / 4, -Math.PI / 3, -Math.PI / 2];
    ctx.fillStyle = 'rgba(214, 185, 130, 0.08)';
    for (const ang of angles) {
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      for (let dist = 42; dist < 960; dist += 6) {
        const px = Math.round(cx + dx * dist);
        const py = Math.round(cy + dy * dist);
        if (px < 12 || py < 12 || px >= width - 12 || py >= height - 12) break;
        const gx = Math.floor(px / step);
        const gy = Math.floor(py / step);
        if (cells[gy * cols + gx] === -1) {
          ctx.fillRect(px, py, 2, 1);
        }
      }
    }
    ctx.restore();
  }

  /** Dappled shallow turquoise coral shoals in coastal lagoons */
  private drawCoralReef(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    scale: number,
    preset: GameSimulation['preset']
  ) {
    ctx.save();
    const r = Math.round(14 * scale);
    ctx.fillStyle =
      preset === 'archipelago'
        ? 'rgba(56, 206, 212, 0.24)'
        : preset === 'middle_east'
          ? 'rgba(72, 198, 204, 0.2)'
          : 'rgba(62, 178, 198, 0.17)';
    ctx.fillRect(cx - r, cy - Math.round(r * 0.45), r * 2, Math.round(r * 0.9));
    ctx.fillRect(cx - Math.round(r * 0.65), cy - Math.round(r * 0.7), Math.round(r * 1.3), Math.round(r * 1.4));

    ctx.fillStyle = 'rgba(130, 234, 238, 0.3)';
    ctx.fillRect(cx - Math.round(r * 0.45), cy - 3, Math.round(r * 0.9), 4);
    ctx.fillRect(cx + 2, cy - 6, 4, 3);
    ctx.fillRect(cx - 7, cy + 2, 5, 3);
    ctx.restore();
  }

  private drawPixelRoad(
    ctx: CanvasRenderingContext2D,
    map: GameSimulation['map'],
    x0: number,
    y0: number,
    cx: number,
    cy: number,
    x1: number,
    y1: number
  ) {
    const steps = 28;
    const { step, cols, rows, riverMask } = map;
    for (let i = 2; i < steps - 1; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const fx = mt * mt * x0 + 2 * mt * t * cx + t * t * x1;
      const fy = mt * mt * y0 + 2 * mt * t * cy + t * t * y1;
      const px = Math.round(fx / 3) * 3;
      const py = Math.round(fy / 3) * 3;

      const gx = Math.floor(px / step);
      const gy = Math.floor(py / step);
      const overRiver =
        gx >= 0 && gy >= 0 && gx < cols && gy < rows && riverMask[gy * cols + gx] > 0;

      if (overRiver) {
        // Miniature arched stone river bridge where imperial road crosses a river!
        ctx.fillStyle = '#0a0f1a';
        ctx.fillRect(px - 4, py - 4, 9, 9);
        ctx.fillStyle = '#d6ccb8';
        ctx.fillRect(px - 3, py - 3, 7, 7);
        ctx.fillStyle = '#9e927c';
        ctx.fillRect(px - 2, py - 1, 5, 3);
      } else {
        // Cobble stone pixel dot with dark outline
        ctx.fillStyle = 'rgba(15, 20, 30, 0.45)';
        ctx.fillRect(px - 2, py - 2, 5, 5);
        ctx.fillStyle = i % 2 === 0 ? 'rgba(232, 217, 182, 0.66)' : 'rgba(198, 181, 145, 0.54)';
        ctx.fillRect(px - 1, py - 1, 3, 3);
      }
    }
  }

  private drawPixelBridge(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    cx: number,
    cy: number,
    x1: number,
    y1: number
  ) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(14, Math.min(44, Math.round(dist / 7)));
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    // Pass 1: Soft dark shadow cast onto the ocean directly underneath the bridge + support pilings
    for (let i = 2; i < steps - 1; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const px = Math.round(mt * mt * x0 + 2 * mt * t * cx + t * t * x1);
      const py = Math.round(mt * mt * y0 + 2 * mt * t * cy + t * t * y1);

      ctx.fillStyle = 'rgba(6, 12, 24, 0.48)';
      ctx.fillRect(px - 4, py + 3, 9, 5);

      // Timber water pilings every 4 steps with tiny white water splash collar
      if (i % 4 === 0) {
        ctx.fillStyle = '#3b2412';
        ctx.fillRect(px - 2, py + 3, 4, 6);
        ctx.fillStyle = 'rgba(186, 230, 253, 0.55)';
        ctx.fillRect(px - 3, py + 8, 6, 2);
      }
    }

    // Pass 2: Timber planks & gilded side railings
    for (let i = 2; i < steps - 1; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const px = Math.round(mt * mt * x0 + 2 * mt * t * cx + t * t * x1);
      const py = Math.round(mt * mt * y0 + 2 * mt * t * cy + t * t * y1);

      ctx.fillStyle = '#090e18';
      ctx.fillRect(px - 4, py - 4, 8, 8);
      ctx.fillStyle = i % 2 === 0 ? '#a86919' : '#854d0e';
      ctx.fillRect(px - 3, py - 3, 6, 6);
      ctx.fillStyle = '#e2c27f';
      ctx.fillRect(Math.round(px + nx * 3) - 1, Math.round(py + ny * 3) - 1, 2, 2);
      ctx.fillRect(Math.round(px - nx * 3) - 1, Math.round(py - ny * 3) - 1, 2, 2);
    }
  }

  /** Ornate 16-bit Persian Astrolabe Compass Rose with North indicator */
  private drawPixelCompass(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    ctx.save();
    // Outer astrolabe brass ring (pixel-stepped circle)
    const r = 24;
    ctx.fillStyle = 'rgba(214, 185, 130, 0.22)';
    for (let a = 0; a < 32; a++) {
      const ang = (a / 32) * Math.PI * 2;
      const px = Math.round(cx + Math.cos(ang) * r);
      const py = Math.round(cy + Math.sin(ang) * r);
      ctx.fillRect(px, py, 2, 2);
    }

    // Diagonal secondary star points
    ctx.fillStyle = 'rgba(214, 185, 130, 0.26)';
    for (let d = -14; d <= 14; d += 2) {
      ctx.fillRect(cx + d - 1, cy + d - 1, 2, 2);
      ctx.fillRect(cx + d - 1, cy - d - 1, 2, 2);
    }

    // Cardinal arms
    ctx.fillStyle = 'rgba(226, 206, 165, 0.38)';
    ctx.fillRect(cx - 2, cy - 28, 4, 56);
    ctx.fillRect(cx - 28, cy - 2, 56, 4);

    // Gilded inner 8-point rosette
    ctx.fillStyle = 'rgba(234, 179, 8, 0.45)';
    ctx.fillRect(cx - 4, cy - 12, 8, 24);
    ctx.fillRect(cx - 12, cy - 4, 24, 8);
    ctx.fillRect(cx - 7, cy - 7, 14, 14);

    // Highlighted North arrow tip
    ctx.fillStyle = 'rgba(250, 204, 21, 0.72)';
    ctx.fillRect(cx - 2, cy - 28, 4, 10);
    ctx.fillRect(cx - 4, cy - 22, 8, 4);

    // Center jewel
    ctx.fillStyle = '#0b1b31';
    ctx.fillRect(cx - 3, cy - 3, 6, 6);
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(cx - 1, cy - 1, 2, 2);

    // Crisp Persian 'ش' (North / شمال) label above compass
    ctx.font = '700 10px "Vazirmatn", sans-serif';
    ctx.fillStyle = 'rgba(232, 210, 158, 0.65)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('ش', cx, cy - 31);
    ctx.restore();
  }

  /** Delicate antique brass cartographic perimeter border & corner brackets inside ocean margin */
  private drawCartographicFrame(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.save();
    const m = 8;
    ctx.strokeStyle = 'rgba(214, 185, 130, 0.16)';
    ctx.lineWidth = 1;
    ctx.strokeRect(m + 0.5, m + 0.5, w - m * 2 - 1, h - m * 2 - 1);

    // Subtle degree ticks along outer edges
    ctx.fillStyle = 'rgba(214, 185, 130, 0.22)';
    for (let x = 60; x < w - 50; x += 60) {
      ctx.fillRect(x, m, 1, 4);
      ctx.fillRect(x, h - m - 4, 1, 4);
    }
    for (let y = 60; y < h - 50; y += 60) {
      ctx.fillRect(m, y, 4, 1);
      ctx.fillRect(w - m - 4, y, 4, 1);
    }

    // Crisp brass corner L-ornaments
    ctx.fillStyle = 'rgba(226, 194, 127, 0.35)';
    const cLen = 14;
    ctx.fillRect(m, m, cLen, 2);
    ctx.fillRect(m, m, 2, cLen);
    ctx.fillRect(w - m - cLen, m, cLen, 2);
    ctx.fillRect(w - m - 2, m, 2, cLen);
    ctx.fillRect(m, h - m - 2, cLen, 2);
    ctx.fillRect(m, h - m - cLen, 2, cLen);
    ctx.fillRect(w - m - cLen, h - m - 2, cLen, 2);
    ctx.fillRect(w - m - 2, h - m - cLen, 2, cLen);
    ctx.restore();
  }

  public updateViewportSize(
    canvas: HTMLCanvasElement,
    cssWidth: number,
    cssHeight: number
  ): ViewportTransform {
    const w = Math.max(1, cssWidth);
    const h = Math.max(1, cssHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.max(1, Math.round(w * dpr));
    const targetH = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const scale = Math.min(w / WORLD_WIDTH, h / WORLD_HEIGHT);
    const offsetX = (w - WORLD_WIDTH * scale) * 0.5;
    const offsetY = (h - WORLD_HEIGHT * scale) * 0.5;

    this.viewport = { width: w, height: h, scale, offsetX, offsetY, dpr };
    return this.viewport;
  }

  public syncViewportFromRect(canvas: HTMLCanvasElement): ViewportTransform {
    const rect = canvas.getBoundingClientRect();
    return this.updateViewportSize(canvas, rect.width, rect.height);
  }

  public screenToWorld(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect();
    const { scale, offsetX, offsetY } = this.viewport;
    return {
      x: (clientX - rect.left - offsetX) / scale,
      y: (clientY - rect.top - offsetY) / scale,
    };
  }

  public render(
    canvas: HTMLCanvasElement,
    sim: GameSimulation,
    selectedId: number | null,
    hoveredId: number | null,
    timeSec: number,
    isTitleBackdrop = false,
    dragAim: DragAimState | null = null,
    sendRatio = 0.5
  ) {
    if (sim.mapDirty) {
      this.rebuildTerrainBuffer(sim);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width: viewW, height: viewH, scale, offsetX, offsetY, dpr } = this.viewport;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;

    // Fill outer ocean frame cleanly
    ctx.fillStyle = '#0b1b31';
    ctx.fillRect(0, 0, viewW, viewH);

    let shakeX = 0;
    let shakeY = 0;
    if (sim.shakeTrauma > 0.01 && !isTitleBackdrop) {
      const mag = sim.shakeTrauma * sim.shakeTrauma * 7;
      shakeX = Math.round((Math.sin(timeSec * 67) * 0.7 + Math.cos(timeSec * 43) * 0.3) * mag);
      shakeY = Math.round((Math.cos(timeSec * 59) * 0.7 + Math.sin(timeSec * 51) * 0.3) * mag);
    }

    ctx.translate(offsetX + shakeX, offsetY + shakeY);
    ctx.scale(scale, scale);
    ctx.imageSmoothingEnabled = false;

    // 1. Cached 16-bit Pixel Continent + 2.5D Cliffs + Rivers + Biome Landmarks + Sea Chart
    ctx.drawImage(this.bgCanvas, 0, 0);

    // 2. Animated Living Ocean (Wave Glints, Rolling Shoreline Surf, Ambient Boats & Sea Life) + River Shimmer
    this.drawLivingWorldDetails(ctx, sim, timeSec);

    // Determine active player origin (either currently dragging or selected)
    const activeOriginId = dragAim?.active ? dragAim.originId : selectedId;
    const activeOrigin = activeOriginId !== null ? sim.territories[activeOriginId] : null;
    const activeHoverId = dragAim?.active ? dragAim.hoverTargetId : hoveredId;

    // 3. Incoming Enemy Threat Sightlines toward Player Castles
    const threatenedPlayerIds = new Set<number>();
    if (!isTitleBackdrop) {
      this.drawIncomingThreats(ctx, sim, timeSec, threatenedPlayerIds);
    }

    // 3b. Active Player Auto-Supply Routes
    if (!isTitleBackdrop) {
      this.drawAutoSupplyRoutes(ctx, sim, timeSec);
    }

    // 4. Highlight Valid Border Attack / Reinforce / Naval Routes when a player castle is selected
    if (activeOrigin && activeOrigin.owner === 0 && !isTitleBackdrop) {
      this.drawSelectedRoutes(ctx, sim, activeOrigin, activeHoverId, timeSec);
    }

    // 5. Pixel Hover Target Corner Brackets
    if (activeHoverId !== null && activeHoverId !== activeOriginId && !isTitleBackdrop) {
      const hov = sim.territories[activeHoverId];
      if (hov) {
        const dispatchCheck =
          activeOrigin && activeOrigin.owner === 0
            ? canDispatchTo(sim, activeOrigin.id, hov.id)
            : { allowed: false, isNaval: false };
        const col = dispatchCheck.allowed
          ? dispatchCheck.isNaval
            ? '#38bdf8'
            : hov.owner === 0
              ? '#4ade80'
              : '#fde047'
          : 'rgba(237, 231, 217, 0.6)';
        this.drawPixelBrackets(ctx, hov.x, hov.y - 4, 34, col);
      }
    }

    // 6. Render Pixel-Art Castles, Coastal Ports & Annex Buildings (cached top-to-bottom depth order)
    if (this.cachedTerritoriesRef !== sim.territories) {
      this.cachedTerritoriesRef = sim.territories;
      this.sortedTerritories = [...sim.territories].sort((a, b) => a.y - b.y);
    }
    for (const t of this.sortedTerritories) {
      const targetCheck =
        !isTitleBackdrop && activeOrigin !== null && activeOrigin.owner === 0
          ? canDispatchTo(sim, activeOrigin.id, t.id)
          : { allowed: false, isNaval: false };
      this.drawPixelCastle(
        ctx,
        t,
        !isTitleBackdrop && activeOriginId === t.id,
        targetCheck.allowed,
        targetCheck.allowed && targetCheck.isNaval,
        !isTitleBackdrop && threatenedPlayerIds.has(t.id),
        timeSec,
        isTitleBackdrop
      );
    }

    // 7. Render Animated Marching Pixel-Art Soldier Squads & Naval Warships (sorted top-to-bottom)
    const sortedTroops = [...sim.troops].sort((a, b) => a.y - b.y);
    const blitzActive = sim.powers.blitzTimer > 0;
    for (const tr of sortedTroops) {
      if (tr.isNaval) {
        this.drawPixelWarship(ctx, tr, timeSec, blitzActive && tr.owner === 0);
      } else {
        this.drawPixelSoldierSquad(ctx, tr, timeSec, blitzActive && tr.owner === 0);
      }
    }

    // 8. Live Drag-to-Attack Pixel Trajectory Arrow
    if (dragAim?.active && !isTitleBackdrop) {
      this.drawDragAimLine(ctx, sim, dragAim, timeSec);
    }

    // 9. Live Tactical Attack/Reinforce Preview Tooltip + Selected Castle Nameplate
    if (!isTitleBackdrop) {
      const hoverDispatch =
        activeOrigin && activeOrigin.owner === 0 && activeHoverId !== null && activeHoverId !== activeOrigin.id
          ? canDispatchTo(sim, activeOrigin.id, activeHoverId)
          : { allowed: false, isNaval: false };
      if (activeOrigin && activeHoverId !== null && hoverDispatch.allowed) {
        this.drawTacticalPreview(ctx, sim, activeOrigin.id, activeHoverId, sendRatio);
      } else if (activeHoverId !== null) {
        const hov = sim.territories[activeHoverId];
        if (hov) this.drawCastleNameplate(ctx, hov);
      } else if (activeOrigin) {
        this.drawCastleNameplate(ctx, activeOrigin);
      }
    }

    // 10. Pixel Shockwave Rings, Directional Dispatch Plumes, Combat Particles & Floating Numbers
    this.drawPixelRings(ctx);
    this.drawParticles(ctx);

    // 11. High-Altitude Atmospheric Layer (Soaring Bird Flocks, Drifting Cloud Shadows & Subtle Sun Vignette)
    this.drawAtmosphericSky(ctx, timeSec);

    if (!isTitleBackdrop) {
      this.drawFloatingTexts(ctx);
    }

    ctx.restore();
  }

  /** Renders animated surf foam, river glints, spinning windmills, cozy village hearth lights, ambient dhows & sea life */
  private drawLivingWorldDetails(
    ctx: CanvasRenderingContext2D,
    sim: GameSimulation,
    timeSec: number
  ) {
    const { map } = sim;

    // 2a. Open-ocean wave glints
    for (const sp of this.oceanSparkles) {
      const wave = Math.sin(timeSec * 2.3 + sp.phase);
      if (wave > 0.42) {
        ctx.fillStyle = 'rgba(148, 224, 240, 0.46)';
        ctx.fillRect(sp.x, sp.y, 6, 2);
        ctx.fillRect(sp.x + 2, sp.y - 2, 2, 2);
      }
    }

    // 2b. Rolling animated pixel shoreline surf foam lapping around every island & coast
    for (const s of map.coastSurf) {
      const cycle = Math.sin(timeSec * 2.1 + s.phase);
      if (cycle < -0.15) continue;
      const shift = Math.round((1 - cycle) * 2.5);
      const sx = Math.round(s.x + s.nx * shift);
      const sy = Math.round(s.y + s.ny * shift);
      ctx.fillStyle = cycle > 0.55 ? 'rgba(224, 247, 252, 0.62)' : 'rgba(154, 226, 238, 0.36)';
      if (Math.abs(s.nx) >= Math.abs(s.ny)) {
        ctx.fillRect(sx, sy - 2, 2, 5);
      } else {
        ctx.fillRect(sx - 2, sy, 5, 2);
      }
    }

    // 2c. Sparkling animated river currents
    for (const rs of map.riverSparkles) {
      const shimmer = Math.sin(timeSec * 4.2 + rs.phase);
      if (shimmer > 0.3) {
        ctx.fillStyle = shimmer > 0.72 ? 'rgba(224, 249, 255, 0.85)' : 'rgba(147, 226, 248, 0.55)';
        ctx.fillRect(rs.x, rs.y, 3, 2);
      }
    }

    // 2d. Ambient ocean merchant dhows & surfacing deep-sea creature ripples
    for (const feat of map.oceanFeatures) {
      if (feat.kind === 'ship_ambient') {
        const drift = Math.sin(timeSec * 0.24 + feat.phase) * 24;
        const bob = Math.round(Math.sin(timeSec * 2.6 + feat.phase) * 1.4);
        const sx = Math.round(feat.x + drift * feat.dir);
        const sy = Math.round(feat.y + bob);
        const facingLeft = Math.cos(timeSec * 0.24 + feat.phase) * feat.dir < 0;
        const spr = this.atlas.merchantDhow;
        const dw = Math.round(spr.width * 1.6);
        const dh = Math.round(spr.height * 1.6);

        // Trailing sea wake foam
        const wakeDir = facingLeft ? 1 : -1;
        ctx.fillStyle = 'rgba(186, 230, 253, 0.42)';
        ctx.fillRect(sx + wakeDir * 9, sy + 5, 6, 2);
        ctx.fillRect(sx + wakeDir * 14, sy + 7, 4, 1);

        ctx.save();
        ctx.translate(sx, sy);
        if (facingLeft) ctx.scale(-1, 1);
        ctx.drawImage(spr, -Math.round(dw * 0.5), -Math.round(dh * 0.55), dw, dh);
        ctx.restore();
      } else if (feat.kind === 'sea_creature') {
        // Periodic deep-ocean whale breach / concentric ripple rings
        const period = (timeSec * 0.38 + feat.phase) % 4.5;
        if (period < 1.8) {
          const p = period / 1.8;
          const rad = Math.round(4 + p * 14);
          ctx.strokeStyle = `rgba(148, 224, 240, ${(1 - p) * 0.48})`;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(feat.x - rad, feat.y - Math.round(rad * 0.55), rad * 2, Math.round(rad * 1.1));
          if (p > 0.15 && p < 0.7) {
            // Subtle pixel whale fluke silhouette rising & dipping
            const rise = Math.round(Math.sin(((p - 0.15) / 0.55) * Math.PI) * 5);
            ctx.fillStyle = '#1b3a5c';
            ctx.fillRect(feat.x - 5, feat.y - rise - 2, 4, 3);
            ctx.fillRect(feat.x + 1, feat.y - rise - 2, 4, 3);
            ctx.fillRect(feat.x - 2, feat.y - rise, 4, 3);
            ctx.fillStyle = 'rgba(186, 230, 253, 0.7)';
            ctx.fillRect(feat.x - 4, feat.y - rise - 3, 2, 1);
            ctx.fillRect(feat.x + 2, feat.y - rise - 3, 2, 1);
          }
        }
      }
    }

    // 2e. Spinning Windmill Sails on Fertile Provinces
    for (const wm of this.animatedWindmills) {
      const frame = Math.floor(timeSec * 2.6 + wm.phase) % 2;
      const sail = frame === 0 ? this.atlas.windmillSailA : this.atlas.windmillSailB;
      const sw = sail.width * 2;
      const sh = sail.height * 2;
      ctx.drawImage(sail, Math.round(wm.x - sw * 0.5), Math.round(wm.y - sh * 0.5), sw, sh);
    }

    // 2f. Subtle Warm Hearth Window Twinkle in Villages
    for (const vil of this.animatedVillages) {
      const glow = Math.sin(timeSec * 3.4 + vil.phase);
      if (glow > 0.25) {
        ctx.fillStyle = glow > 0.7 ? 'rgba(254, 240, 138, 0.65)' : 'rgba(251, 191, 36, 0.42)';
        ctx.fillRect(vil.x - 8, vil.y - 3, 2, 2);
        ctx.fillRect(vil.x + 8, vil.y - 3, 2, 2);
      }
    }
  }

  /** Renders soaring tiny pixel bird flocks, drifting cloud shadows, and subtle golden sunlight vignette */
  private drawAtmosphericSky(ctx: CanvasRenderingContext2D, timeSec: number) {
    ctx.save();

    // 1. Slow Drifting Pixel-Stepped Cloud Shadows across Continent & Sea
    ctx.fillStyle = 'rgba(6, 12, 24, 0.13)';
    for (const cl of this.clouds) {
      const span = WORLD_WIDTH + cl.w * 2;
      const cx = Math.round(((cl.baseX + timeSec * cl.speed) % span) - cl.w);
      const cy = Math.round(cl.baseY + Math.sin(timeSec * 0.18 + cl.baseX * 0.01) * 14);
      const hw = Math.round(cl.w * 0.5);
      const hh = Math.round(cl.h * 0.5);

      ctx.fillRect(cx - hw, cy - Math.round(hh * 0.45), cl.w, Math.round(cl.h * 0.9));
      ctx.fillRect(cx - Math.round(hw * 0.7), cy - hh, Math.round(cl.w * 0.72), cl.h + 4);
      ctx.fillRect(cx - Math.round(hw * 0.35), cy - hh - 6, Math.round(cl.w * 0.45), cl.h + 10);
    }

    // 2. Soaring Pixel Bird Flocks with 2-Frame Flapping Wings & Faint Ground Shadows
    for (const fl of this.birdFlocks) {
      const fx = ((fl.baseX + timeSec * fl.vx) % (WORLD_WIDTH + 80) + (WORLD_WIDTH + 80)) % (WORLD_WIDTH + 80) - 40;
      const fy = ((fl.baseY + timeSec * fl.vy) % (WORLD_HEIGHT + 60) + (WORLD_HEIGHT + 60)) % (WORLD_HEIGHT + 60) - 30;
      const flap = Math.floor(timeSec * 6.5 + fl.phase) % 2 === 0;

      for (let b = 0; b < fl.count; b++) {
        const bx = Math.round(fx - b * (fl.vx >= 0 ? 8 : -8));
        const by = Math.round(fy + (b === 1 ? -5 : b === 2 ? 6 : 0));

        // Faint ground shadow offset below-right
        ctx.fillStyle = 'rgba(6, 12, 24, 0.22)';
        ctx.fillRect(bx + 6, by + 16, 4, 2);

        // Crisp 5px pixel bird silhouette
        ctx.fillStyle = '#f8f5eb';
        if (flap) {
          ctx.fillRect(bx - 2, by - 1, 2, 1);
          ctx.fillRect(bx, by, 2, 1);
          ctx.fillRect(bx + 2, by - 1, 2, 1);
        } else {
          ctx.fillRect(bx - 2, by + 1, 2, 1);
          ctx.fillRect(bx, by, 2, 1);
          ctx.fillRect(bx + 2, by + 1, 2, 1);
        }
      }
    }

    ctx.restore();
  }

  private drawIncomingThreats(
    ctx: CanvasRenderingContext2D,
    sim: GameSimulation,
    timeSec: number,
    threatenedIds: Set<number>
  ) {
    for (const tr of sim.troops) {
      if (tr.owner === 0) continue;
      const target = sim.territories[tr.toId];
      if (!target || target.owner !== 0) continue;
      threatenedIds.add(target.id);

      // Subtle flashing red danger dots from enemy army to player's threatened castle
      const steps = 6;
      const phase = (timeSec * 3.5) % 1;
      for (let i = 0; i < steps; i++) {
        const u = (i + phase) / steps;
        const px = Math.round(tr.x + (target.x - tr.x) * u);
        const py = Math.round(tr.y + (target.y - tr.y) * u);
        ctx.fillStyle = 'rgba(248, 113, 113, 0.72)';
        ctx.fillRect(px - 1, py - 1, 3, 3);
      }
    }
  }

  private drawDragAimLine(
    ctx: CanvasRenderingContext2D,
    sim: GameSimulation,
    dragAim: DragAimState,
    timeSec: number
  ) {
    const origin = sim.territories[dragAim.originId];
    if (!origin) return;

    const target =
      dragAim.hoverTargetId !== null ? sim.territories[dragAim.hoverTargetId] : null;
    const endX = target && dragAim.isValidTarget ? target.x : dragAim.currentX;
    const endY = target && dragAim.isValidTarget ? target.y : dragAim.currentY;

    const dx = endX - origin.x;
    const dy = endY - origin.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 14) return;

    const lineColor = dragAim.isValidTarget
      ? dragAim.isNavalTarget
        ? '#38bdf8'
        : dragAim.isFriendlyTarget
          ? '#4ade80'
          : '#fde047'
      : dragAim.hoverTargetId !== null && dragAim.hoverTargetId !== dragAim.originId
        ? '#f87171'
        : '#cbd5e1';

    const steps = Math.max(6, Math.min(24, Math.floor(dist / 12)));
    const phase = (timeSec * 3.0) % 1;

    ctx.save();
    for (let i = 1; i < steps; i++) {
      const u = (i + phase * 0.65) / steps;
      if (u >= 0.96) continue;
      const px = Math.round(origin.x + dx * u);
      const py = Math.round(origin.y + dy * u);
      ctx.fillStyle = '#0b101a';
      ctx.fillRect(px - 3, py - 3, 7, 7);
      ctx.fillStyle = lineColor;
      ctx.fillRect(px - 2, py - 2, 5, 5);
    }

    // Crisp pixel target arrowhead at pointer/castle endpoint
    const angle = Math.atan2(dy, dx);
    const tipX = Math.round(endX - Math.cos(angle) * (dragAim.isValidTarget ? 18 : 2));
    const tipY = Math.round(endY - Math.sin(angle) * (dragAim.isValidTarget ? 18 : 2));

    ctx.translate(tipX, tipY);
    ctx.rotate(angle);
    ctx.fillStyle = '#0b101a';
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-7, -8);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = lineColor;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-5, -5.5);
    ctx.lineTo(-2.5, 0);
    ctx.lineTo(-5, 5.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawCastleNameplate(ctx: CanvasRenderingContext2D, t: Territory) {
    const biome = BIOMES[t.biome];
    const label = `${t.name} · ${biome.name}`;

    ctx.save();
    ctx.direction = 'rtl';
    ctx.font = '700 11px "Vazirmatn", sans-serif';
    const textW = ctx.measureText(label).width;
    const boxW = Math.round(textW + 16);
    const boxH = 20;
    const bx = Math.max(8, Math.min(WORLD_WIDTH - boxW - 8, Math.round(t.x - boxW * 0.5)));
    const by = Math.max(8, Math.round(t.y - 54));

    ctx.fillStyle = '#090e18';
    ctx.fillRect(bx - 1, by - 1, boxW + 2, boxH + 2);
    ctx.fillStyle = 'rgba(16, 24, 39, 0.94)';
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.fillStyle = '#334866';
    ctx.fillRect(bx, by + boxH - 1, boxW, 1);

    ctx.fillStyle = '#f2e8d5';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + boxW * 0.5, by + boxH * 0.5 + 0.5);
    ctx.restore();
  }

  private drawTacticalPreview(
    ctx: CanvasRenderingContext2D,
    sim: GameSimulation,
    fromId: number,
    toId: number,
    sendRatio: number
  ) {
    const preview = previewAttackOutcome(sim, fromId, toId, sendRatio);
    const target = sim.territories[toId];
    if (!preview || !target) return;

    let label: string;
    let borderColor: string;
    let textColor: string;

    const modePrefix = preview.isNaval ? 'یورش دریایی' : 'حمله';
    if (preview.sendAmount < 1) {
      label = 'نیرو کافی نیست';
      borderColor = '#64748b';
      textColor = '#cbd5e1';
    } else if (preview.isFriendly) {
      label = preview.isNaval
        ? `ناوگان کمکی +${preview.sendAmount}`
        : `پشتیبانی +${preview.sendAmount}`;
      borderColor = preview.isNaval ? '#38bdf8' : '#4ade80';
      textColor = preview.isNaval ? '#bae6fd' : '#bbf7d0';
    } else if (preview.willConquer) {
      label = `${modePrefix} ${preview.sendAmount} · پیروزی محتمل`;
      borderColor = preview.isNaval ? '#38bdf8' : '#fde047';
      textColor = preview.isNaval ? '#e0f2fe' : '#fef08a';
    } else if (preview.advantageRatio >= 0.65) {
      label = `${modePrefix} ${preview.sendAmount} · نبرد نزدیک`;
      borderColor = '#fb923c';
      textColor = '#fed7aa';
    } else {
      label =
        preview.defenseBonusPct > 0
          ? `${modePrefix} ${preview.sendAmount} · دفاع -${preview.defenseBonusPct}%`
          : `${modePrefix} ${preview.sendAmount} · دفاع سنگین`;
      borderColor = '#f87171';
      textColor = '#fecaca';
    }

    ctx.save();
    ctx.direction = 'rtl';
    ctx.font = '700 11px "Vazirmatn", sans-serif';
    const textW = ctx.measureText(label).width;
    const boxW = Math.round(textW + 18);
    const boxH = 22;
    const bx = Math.max(8, Math.min(WORLD_WIDTH - boxW - 8, Math.round(target.x - boxW * 0.5)));
    const by = Math.max(8, Math.round(target.y - 56));

    ctx.fillStyle = '#090e18';
    ctx.fillRect(bx - 2, by - 2, boxW + 4, boxH + 4);
    ctx.fillStyle = borderColor;
    ctx.fillRect(bx - 1, by - 1, boxW + 2, boxH + 2);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(bx, by, boxW, boxH);

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + boxW * 0.5, by + boxH * 0.5 + 0.5);
    ctx.restore();
  }

  private drawPixelBrackets(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    color: string
  ) {
    const x0 = Math.round(cx - r);
    const y0 = Math.round(cy - r + 4);
    const x1 = Math.round(cx + r);
    const y1 = Math.round(cy + r - 6);
    const len = 9;
    const th = 3;

    ctx.fillStyle = '#0b101a';
    ctx.fillRect(x0 - 1, y0 - 1, len + 2, th + 2);
    ctx.fillRect(x0 - 1, y0 - 1, th + 2, len + 2);
    ctx.fillRect(x1 - len - 1, y0 - 1, len + 2, th + 2);
    ctx.fillRect(x1 - th - 1, y0 - 1, th + 2, len + 2);
    ctx.fillRect(x0 - 1, y1 - th - 1, len + 2, th + 2);
    ctx.fillRect(x0 - 1, y1 - len - 1, th + 2, len + 2);
    ctx.fillRect(x1 - len - 1, y1 - th - 1, len + 2, th + 2);
    ctx.fillRect(x1 - th - 1, y1 - len - 1, th + 2, len + 2);

    ctx.fillStyle = color;
    ctx.fillRect(x0, y0, len, th);
    ctx.fillRect(x0, y0, th, len);
    ctx.fillRect(x1 - len, y0, len, th);
    ctx.fillRect(x1 - th, y0, th, len);
    ctx.fillRect(x0, y1 - th, len, th);
    ctx.fillRect(x0, y1 - len, th, len);
    ctx.fillRect(x1 - len, y1 - th, len, th);
    ctx.fillRect(x1 - th, y1 - len, th, len);
  }

  private drawSelectedRoutes(
    ctx: CanvasRenderingContext2D,
    sim: GameSimulation,
    selected: Territory,
    hoveredId: number | null,
    timeSec: number
  ) {
    ctx.save();
    for (const nId of selected.neighbors) {
      const target = sim.territories[nId];
      const via = selected.borderCrossings[nId] ?? {
        x: (selected.x + target.x) * 0.5,
        y: (selected.y + target.y) * 0.5,
      };
      const isFriendly = target.owner === selected.owner;
      const isHovered = hoveredId === nId;

      const dotCount = 14;
      const phase = (timeSec * 1.4) % 1;
      for (let i = 0; i < dotCount; i++) {
        const u = (i + phase) / dotCount;
        if (u < 0.08 || u > 0.92) continue;
        const mt = 1 - u;
        const px = Math.round(mt * mt * selected.x + 2 * mt * u * via.x + u * u * target.x);
        const py = Math.round(mt * mt * selected.y + 2 * mt * u * via.y + u * u * target.y);

        const sz = isHovered ? 5 : 4;
        ctx.fillStyle = '#0b101a';
        ctx.fillRect(px - 1, py - 1, sz + 2, sz + 2);
        ctx.fillStyle = isFriendly
          ? isHovered
            ? '#86efac'
            : '#4ade80'
          : isHovered
            ? '#fef08a'
            : '#fbbf24';
        ctx.fillRect(px, py, sz, sz);
      }

      const bx = Math.round(via.x);
      const by = Math.round(via.y);
      ctx.fillStyle = '#0b101a';
      ctx.fillRect(bx - 5, by - 5, 10, 10);
      ctx.fillStyle = isFriendly ? '#4ade80' : '#fbbf24';
      ctx.fillRect(bx - 3, by - 3, 6, 6);
    }
    ctx.restore();
  }

  private drawAutoSupplyRoutes(
    ctx: CanvasRenderingContext2D,
    sim: GameSimulation,
    timeSec: number
  ) {
    ctx.save();
    for (const t of sim.territories) {
      if (t.owner !== 0 || t.supplyTargetId === null) continue;
      const dest = sim.territories[t.supplyTargetId];
      if (!dest || dest.owner !== 0) continue;
      const via = t.borderCrossings[dest.id] ?? {
        x: (t.x + dest.x) * 0.5,
        y: (t.y + dest.y) * 0.5,
      };
      const dotCount = 10;
      const phase = (timeSec * 1.1) % 1;
      for (let i = 0; i < dotCount; i++) {
        const u = (i + phase) / dotCount;
        if (u < 0.1 || u > 0.9) continue;
        const mt = 1 - u;
        const px = Math.round(mt * mt * t.x + 2 * mt * u * via.x + u * u * dest.x);
        const py = Math.round(mt * mt * t.y + 2 * mt * u * via.y + u * u * dest.y);
        ctx.fillStyle = '#07131a';
        ctx.fillRect(px - 2, py - 2, 5, 5);
        ctx.fillStyle = '#34d399';
        ctx.fillRect(px - 1, py - 1, 3, 3);
      }
    }
    ctx.restore();
  }

  private drawPixelCastle(
    ctx: CanvasRenderingContext2D,
    t: Territory,
    isSelected: boolean,
    isValidTarget: boolean,
    isNavalTarget: boolean,
    isThreatened: boolean,
    timeSec: number,
    isTitleBackdrop: boolean
  ) {
    const faction = t.owner === -1 ? null : FACTIONS[t.owner];
    const glowColor = faction ? faction.borderGlow : NEUTRAL_STYLE.borderGlow;
    const sprites = this.atlas.getFaction(t.owner);

    const cx = Math.round(t.x);
    const cy = Math.round(t.y);

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    const portLvl = getBuildingLevel(t, 'port');
    const mineLvl = getBuildingLevel(t, 'mine');
    const barracksLvl = getBuildingLevel(t, 'barracks');
    const towerLvl = getBuildingLevel(t, 'tower');
    const forgeLvl = getBuildingLevel(t, 'forge');

    // Helper: crisp square pixel level pips under upgraded Lv.2 / Lv.3 buildings
    const drawLevelPips = (centerX: number, bottomY: number, lvl: number) => {
      if (lvl < 2) return;
      const totalW = lvl * 4 + (lvl - 1) * 2;
      const startX = Math.round(centerX - totalW * 0.5);
      const y0 = Math.round(bottomY);
      ctx.fillStyle = '#090e18';
      ctx.fillRect(startX - 1, y0 - 1, totalW + 2, 6);
      const fill = lvl === 3 ? '#fde047' : '#cbd5e1';
      const inner = lvl === 3 ? '#fffbeb' : '#f8fafc';
      for (let i = 0; i < lvl; i++) {
        const px = startX + i * 6;
        ctx.fillStyle = fill;
        ctx.fillRect(px, y0, 4, 4);
        ctx.fillStyle = inner;
        ctx.fillRect(px, y0, 2, 2);
      }
    };

    // 0. Coastal Port Pier Sprite anchored directly at shoreline coastPoint (Lv.1 -> Lv.2 -> Lv.3)
    if (portLvl > 0 && t.coastPoint) {
      const portSpr = sprites.portLevels[portLvl - 1];
      const pw = portSpr.width * 2;
      const ph = portSpr.height * 2;
      const px = Math.round(t.coastPoint.x - pw * 0.5);
      const py = Math.round(t.coastPoint.y - ph * 0.65);

      if (portLvl === 3) {
        const gPulse = 0.5 + 0.5 * Math.sin(timeSec * 3.8 + t.id);
        ctx.fillStyle = `rgba(250, 204, 21, ${(0.14 + gPulse * 0.14).toFixed(3)})`;
        ctx.fillRect(px - 2, py + ph - 8, pw + 4, 8);
      }

      ctx.drawImage(portSpr, px, py, pw, ph);

      // Escalating lighthouse beacon on port tower
      const lampOn = Math.floor(timeSec * (portLvl === 3 ? 4.5 : 3) + t.id) % 2 === 0;
      if (lampOn || portLvl === 3) {
        const bx = portLvl === 3 ? px + 5 : px + 4;
        const by = portLvl === 3 ? py + 2 : py + 2;
        ctx.fillStyle = portLvl === 3 ? 'rgba(254, 240, 138, 0.72)' : 'rgba(254, 240, 138, 0.55)';
        ctx.fillRect(bx - 3, by - 2, portLvl === 3 ? 12 : 8, portLvl === 3 ? 8 : 6);
        ctx.fillStyle = '#fef9c3';
        ctx.fillRect(bx, by, portLvl === 3 ? 6 : 4, 4);
      }
      drawLevelPips(t.coastPoint.x, py + ph + 1, portLvl);
    }

    // 1. Capture / Upgrade expanding pixel shockwave ring
    if (t.capturePulse > 0.01) {
      const prog = 1 - t.capturePulse;
      const rad = Math.round(24 + prog * 44);
      ctx.strokeStyle = glowColor;
      ctx.globalAlpha = t.capturePulse * 0.9;
      ctx.lineWidth = 3;
      ctx.strokeRect(cx - rad, cy - Math.round(rad * 0.78), rad * 2, Math.round(rad * 1.56));
      ctx.globalAlpha = 1;
    }

    // 2. Selection / Target / Threat pixel brackets
    if (isSelected) {
      const stepOffset = Math.sin(timeSec * 6) > 0 ? 1 : 0;
      this.drawPixelBrackets(ctx, cx, cy - 4, 34 + stepOffset, '#fde047');
    } else if (isThreatened) {
      const blink = Math.floor(timeSec * 6) % 2 === 0;
      this.drawPixelBrackets(ctx, cx, cy - 4, 34, blink ? '#ef4444' : '#fca5a5');
    } else if (isValidTarget) {
      this.drawPixelBrackets(
        ctx,
        cx,
        cy - 4,
        30,
        isNavalTarget
          ? 'rgba(56, 189, 248, 0.85)'
          : t.owner === 0
            ? 'rgba(74, 222, 128, 0.75)'
            : 'rgba(251, 191, 36, 0.75)'
      );
    }

    // 3. Royal Shield Commander Power Glowing Pixel Barrier
    if (t.shieldTimer > 0) {
      const pulse = Math.sin(timeSec * 10) > 0 ? '#93c5fd' : '#38bdf8';
      ctx.strokeStyle = pulse;
      ctx.lineWidth = 3;
      ctx.strokeRect(cx - 32, cy - 30, 64, 48);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.fillRect(cx - 30, cy - 28, 60, 44);
    }

    // 4. Pixel Ground Shadow under Castle
    ctx.fillStyle = 'rgba(8, 12, 22, 0.55)';
    ctx.fillRect(cx - 24, cy + 7, 48, 7);
    ctx.fillRect(cx - 20, cy + 12, 40, 3);

    // 5a. Back-Row Constructed Buildings (Tower upper-left & Forge upper-right) — drawn behind Castle in 2.5D depth order
    if (towerLvl > 0) {
      const towerSpr = this.atlas.towerLevels[towerLvl - 1];
      const tw = towerSpr.width * 2;
      const th = towerSpr.height * 2;
      const tx = cx - 25 - Math.round(tw * 0.58);
      const ty = cy - 17 - th;
      const towerPulse = 0.5 + 0.5 * Math.sin(timeSec * (2.9 + towerLvl * 0.7) + t.id * 0.9);
      const towerStep = Math.floor(towerPulse * 4);

      if (towerLvl === 3) {
        // Floating Arcane Spire Crown Aura
        ctx.fillStyle =
          towerStep >= 2 ? 'rgba(56, 189, 248, 0.36)' : 'rgba(250, 204, 21, 0.24)';
        ctx.fillRect(tx + Math.round(tw * 0.5) - 7, ty - 2, 14, 12);
      }

      ctx.drawImage(towerSpr, tx, ty, tw, th);

      // Escalating Arcane Sentinel Crystal at tower crown
      const beaconColors = ['#0369a1', '#0284c7', '#38bdf8', '#bae6fd'];
      const crownX = tx + Math.round(tw * 0.5) - 2;
      const crownY = towerLvl === 1 ? ty + 3 : ty + 2;
      ctx.fillStyle =
        towerLvl === 3 && towerStep === 3 ? '#fef9c3' : beaconColors[Math.min(3, towerStep)];
      ctx.fillRect(crownX, crownY, 4, towerLvl === 3 ? 6 : 4);
      if (towerStep >= 2 || towerLvl >= 2) {
        ctx.fillStyle = TOWER_HALO_COLORS[towerStep === 3 || towerLvl === 3 ? 1 : 0];
        ctx.fillRect(crownX - 3, crownY - 2, 10, towerLvl === 3 ? 10 : 7);
      }
      if (t.towerFireTimer > 0) {
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(crownX + 4, crownY - 2, 8, 3);
        ctx.fillStyle = towerLvl === 3 ? '#fde047' : '#38bdf8';
        ctx.fillRect(crownX + 10, crownY - 5, 6, 3);
      }
      drawLevelPips(tx + tw * 0.5, ty + th - 2, towerLvl);
    }

    if (forgeLvl > 0) {
      const forgeSpr = this.atlas.forgeLevels[forgeLvl - 1];
      const fw = forgeSpr.width * 2;
      const fh = forgeSpr.height * 2;
      const fx = cx + 19;
      const fy = cy - 17 - fh;
      const forgePulse = 0.5 + 0.5 * Math.sin(timeSec * (4.3 + forgeLvl * 0.6) + t.id * 1.7);
      const forgeStep = Math.floor(forgePulse * 4);

      // Breathing molten heat halo at furnace base
      ctx.fillStyle =
        forgeLvl === 3
          ? 'rgba(249, 115, 22, 0.34)'
          : FORGE_AURA_COLORS[Math.min(3, forgeStep)];
      ctx.fillRect(fx + 2, fy + fh - 6, fw - 4, 6);
      ctx.drawImage(forgeSpr, fx, fy, fw, fh);

      // Blazing molten furnace core scaled by tier
      const hearthColors = ['#9a3412', '#ea580c', '#f59e0b', '#fde047'];
      ctx.fillStyle = hearthColors[Math.min(3, forgeStep)];
      const coreX = fx + Math.round(fw * 0.3);
      const coreY = fy + Math.round(fh * 0.6);
      ctx.fillRect(coreX, coreY, forgeLvl === 3 ? 10 : 6, 5);
      if (forgeStep >= 2 || forgeLvl === 3) {
        ctx.fillStyle = forgeStep === 3 ? '#fffbeb' : '#fde047';
        ctx.fillRect(coreX + 2, coreY + 1, forgeLvl === 3 ? 6 : 2, 3);
      }
      if (forgeLvl === 3) {
        // Pulsing molten volcanic cauldron top glow
        ctx.fillStyle = forgeStep >= 2 ? '#fef08a' : '#f97316';
        ctx.fillRect(fx + Math.round(fw * 0.42), fy + 2, 6, 3);
      }
      drawLevelPips(fx + fw * 0.5, fy + fh - 2, forgeLvl);
    }

    // 6. Tiered 16-Bit Pixel-Art Fortress Sprite (Outpost Keep -> Standard Fortress -> Grand Imperial Citadel!)
    const totalBuildingLevels = barracksLvl + towerLvl + mineLvl + forgeLvl + portLvl;
    const isGrand = t.owner >= 0 && (t.military >= 45 || totalBuildingLevels >= 3);
    const isSmall = !isGrand && t.military < 18 && totalBuildingLevels === 0;

    const castleSprite = isGrand
      ? t.hitFlash > 0
        ? sprites.castleGrandFlash
        : sprites.castleGrand
      : isSmall
        ? t.hitFlash > 0
          ? sprites.castleSmallFlash
          : sprites.castleSmall
        : t.hitFlash > 0
          ? sprites.castleFlash
          : sprites.castle;

    const cw = castleSprite.width * 2;
    const ch = castleSprite.height * 2;
    const castleTopY = cy - Math.round(ch * 0.72);

    // Subtle gilded radial aura under Grand Imperial Citadels
    if (isGrand && t.hitFlash <= 0) {
      const auraPulse = 0.14 + 0.07 * Math.sin(timeSec * 3.2 + t.id);
      ctx.fillStyle = `rgba(250, 204, 21, ${auraPulse.toFixed(3)})`;
      ctx.fillRect(cx - 26, cy + 5, 52, 8);
    }

    ctx.drawImage(castleSprite, cx - Math.round(cw * 0.5), castleTopY, cw, ch);

    // 5b. Front-Flanking Constructed Buildings (Mine lower-left & Barracks lower-right) — unobstructed & crystal clear
    if (mineLvl > 0) {
      const mineSpr = this.atlas.mineLevels[mineLvl - 1];
      const mw = mineSpr.width * 2;
      const mh = mineSpr.height * 2;
      const mx = cx - 28 - Math.round(mw * 0.62);
      const my = cy + 11 - mh;
      const minePulse = 0.5 + 0.5 * Math.sin(timeSec * (3.2 + mineLvl * 0.6) + t.id * 1.15);
      const mineStep = Math.floor(minePulse * 4);

      if (mineStep >= 1 || mineLvl === 3) {
        ctx.fillStyle =
          mineLvl === 3
            ? 'rgba(250, 204, 21, 0.28)'
            : MINE_AURA_COLORS[Math.min(3, mineStep)];
        ctx.fillRect(mx, my + mh - 5, mw, 6);
      }
      ctx.drawImage(mineSpr, mx, my, mw, mh);

      // Pulsing golden ore / vault gleam scaled by tier
      const lanternColors = ['#92400e', '#d97706', '#fbbf24', '#fef08a'];
      ctx.fillStyle = lanternColors[Math.min(3, mineStep)];
      ctx.fillRect(mx + Math.round(mw * 0.42), my + Math.round(mh * 0.58), 4, 4);
      if (mineStep >= 2 || mineLvl >= 2) {
        ctx.fillStyle = '#fef9c3';
        ctx.fillRect(mx + Math.round(mw * 0.46), my + Math.round(mh * 0.62), 2, 2);
      }
      if (mineLvl === 3 && mineStep >= 2) {
        ctx.fillStyle = '#fffbeb';
        ctx.fillRect(mx + Math.round(mw * 0.46), my + 3, 3, 3);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(mx + 3, my + mh - 5, 3, 2);
        ctx.fillRect(mx + mw - 6, my + mh - 5, 3, 2);
      } else if (mineStep === 3) {
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(mx + 5, my + 7, 2, 2);
        ctx.fillRect(mx + mw - 7, my + 8, 2, 2);
      }
      drawLevelPips(mx + mw * 0.5, my + mh + 1, mineLvl);
    }

    if (barracksLvl > 0) {
      const barSpr = sprites.barracksLevels[barracksLvl - 1];
      const bw = barSpr.width * 2;
      const bh = barSpr.height * 2;
      const bx = cx + 21;
      const by = cy + 12 - bh;
      const barPulse = 0.5 + 0.5 * Math.sin(timeSec * (4.4 + barracksLvl * 0.5) + t.id * 1.4);
      const barStep = Math.floor(barPulse * 3);

      if (barracksLvl === 3) {
        ctx.fillStyle = 'rgba(250, 204, 21, 0.22)';
        ctx.fillRect(bx - 1, by + bh - 5, bw + 2, 6);
      }
      ctx.drawImage(barSpr, bx, by, bw, bh);

      // Warm torch brazier(s) at gate — twin golden braziers on Lv.3 Royal War Academy!
      ctx.fillStyle = barStep === 2 ? '#fef08a' : barStep === 1 ? '#fb923c' : '#ea580c';
      if (barracksLvl === 3) {
        ctx.fillRect(bx + 3, by + 8, 3, 3);
        ctx.fillRect(bx + bw - 8, by + 8, 3, 3);
        if (barStep >= 1) {
          ctx.fillStyle = 'rgba(254, 240, 138, 0.45)';
          ctx.fillRect(bx + 2, by + 7, 5, 5);
          ctx.fillRect(bx + bw - 9, by + 7, 5, 5);
        }
      } else {
        ctx.fillRect(bx + Math.round(bw * 0.36), by + Math.round(bh * 0.56), 3, 3);
        if (barStep === 2) {
          ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
          ctx.fillRect(
            bx + Math.round(bw * 0.36) - 1,
            by + Math.round(bh * 0.56) - 1,
            5,
            5
          );
        }
      }
      // Fluttering pennant tip
      const flagOffset = Math.floor(timeSec * 4 + t.id) % 2;
      ctx.fillStyle = barracksLvl === 3 ? '#fde047' : faction ? faction.borderGlow : '#f87171';
      ctx.fillRect(bx + Math.round(bw * 0.45) + flagOffset, by + 1, 3, 2);
      drawLevelPips(bx + bw * 0.5, by + bh + 1, barracksLvl);
    }

    // Subtle warm gate hearth pulse on active faction castles (living fortress feel)
    if (t.owner >= 0 && t.hitFlash <= 0) {
      const gateStep = Math.floor((0.5 + 0.5 * Math.sin(timeSec * 3.1 + t.id * 2.1)) * 3);
      if (gateStep >= 1) {
        ctx.fillStyle = gateStep === 2 ? 'rgba(253, 224, 71, 0.55)' : 'rgba(249, 115, 22, 0.34)';
        ctx.fillRect(cx - 2, cy - 1, 4, 4);
      }
    }

    // Subtle animated pixel banner wave overlay (twin banners on Grand Citadel!)
    const bannerFrame = Math.floor(timeSec * 5 + t.id) % 3;
    if (bannerFrame !== 0 && t.hitFlash <= 0) {
      ctx.fillStyle = faction ? faction.color : NEUTRAL_STYLE.color;
      ctx.fillRect(cx + 2, castleTopY + (bannerFrame === 1 ? 4 : 6), 4, 2);
      if (isGrand) {
        ctx.fillRect(cx - 18, castleTopY + (bannerFrame === 1 ? 14 : 16), 4, 2);
        ctx.fillRect(cx + 14, castleTopY + (bannerFrame === 1 ? 14 : 16), 4, 2);
      }
    }

    // Pulsing Pixel Threat Exclamation Badge on Player Castle under Attack
    if (isThreatened && !isTitleBackdrop) {
      const bob = Math.floor(timeSec * 8) % 2 === 0 ? -1 : 1;
      const ax = cx + 22;
      const ay = cy - 38 + bob;
      ctx.fillStyle = '#090e18';
      ctx.fillRect(ax - 7, ay - 7, 14, 14);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(ax - 6, ay - 6, 12, 12);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(ax - 1, ay - 4, 2, 5);
      ctx.fillRect(ax - 1, ay + 2, 2, 2);
    }

    // 7. Crisp Pixel-Beveled Tactical Data Plaque below Castle
    if (!isTitleBackdrop) {
      const plateW = 86;
      const plateH = 23;
      const px = cx - Math.round(plateW / 2);
      const py = cy + 14;

      ctx.fillStyle = '#090e18';
      ctx.fillRect(px - 2, py - 2, plateW + 4, plateH + 4);
      ctx.fillStyle = isSelected ? '#fbbf24' : isThreatened ? '#f87171' : glowColor;
      ctx.fillRect(px - 1, py - 1, plateW + 2, plateH + 2);
      ctx.fillStyle = '#101827';
      ctx.fillRect(px, py, plateW, plateH);

      // Tiny pixel sword icon next to Military
      ctx.fillStyle = '#f87171';
      ctx.fillRect(px + 6, py + 11, 2, 2);
      ctx.fillRect(px + 8, py + 9, 2, 2);
      ctx.fillRect(px + 10, py + 7, 2, 2);
      ctx.fillRect(px + 12, py + 5, 2, 2);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(px + 7, py + 12, 2, 2);

      // Military Count (bold bright white)
      ctx.direction = 'ltr';
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${Math.floor(t.military)}`, cx - 13, py + 10);

      // Pixel divider
      ctx.fillStyle = '#293852';
      ctx.fillRect(cx + 2, py + 3, 2, 13);

      // Tiny pixel helmet/person icon next to Manpower
      ctx.fillStyle = '#d6b472';
      ctx.fillRect(cx + 9, py + 6, 4, 4);
      ctx.fillRect(cx + 7, py + 11, 8, 4);

      // Manpower Count
      ctx.font = '500 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`${Math.floor(t.manpower)}`, cx + 28, py + 10);

      // Crisp Pixel Manpower Progress Strip along bottom of plaque
      const maxMp = t.hasMine ? ECONOMY.MINE_MAX_MANPOWER : ECONOMY.BASE_MAX_MANPOWER;
      const ratio = Math.min(1, t.manpower / maxMp);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(px + 2, py + plateH - 4, plateW - 4, 3);
      ctx.fillStyle = t.hasBarracks ? '#fbbf24' : glowColor;
      ctx.fillRect(px + 2, py + plateH - 4, Math.round((plateW - 4) * ratio), 3);
    }

    ctx.restore();
  }

  /** Renders an animated 16-bit pixel-art marching soldier squad (2–4 animated warriors + marching dust + count badge) */
  private drawPixelSoldierSquad(
    ctx: CanvasRenderingContext2D,
    tr: GameSimulation['troops'][number],
    timeSec: number,
    blitzBoost: boolean
  ) {
    const faction = FACTIONS[tr.owner];
    const sprites = this.atlas.getFaction(tr.owner);

    const cx = Math.round(tr.x);
    const cy = Math.round(tr.y);
    const animSpeed = blitzBoost ? 16 : 9;
    const frameIdx = Math.floor(timeSec * animSpeed + tr.id * 1.7) % 2;

    const offsets: Array<{ ox: number; oy: number; elite: boolean; phase: number }> =
      tr.count >= 28 || tr.isElite
        ? [
            { ox: -10, oy: -5, elite: false, phase: 1 },
            { ox: 10, oy: -4, elite: false, phase: 0 },
            { ox: -7, oy: 7, elite: false, phase: 0 },
            { ox: 3, oy: 2, elite: true, phase: 1 },
          ]
        : tr.count >= 14
          ? [
              { ox: -9, oy: -4, elite: false, phase: 1 },
              { ox: 9, oy: -2, elite: false, phase: 0 },
              { ox: 0, oy: 5, elite: false, phase: 1 },
            ]
          : [
              { ox: -7, oy: -2, elite: false, phase: 0 },
              { ox: 7, oy: 3, elite: false, phase: 1 },
            ];

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    const trailDir = tr.facingLeft ? 1 : -1;

    // Subtle marching dust pixel specks behind army boots
    const dustPhase = Math.floor(timeSec * 10 + tr.id) % 3;
    ctx.fillStyle = 'rgba(229, 214, 179, 0.38)';
    ctx.fillRect(cx + trailDir * (12 + dustPhase * 3), cy + 8, 3, 3);
    ctx.fillRect(cx + trailDir * (16 + ((dustPhase + 1) % 3) * 3), cy + 5, 2, 2);

    // Speed-line pixel trail during Blitz Commander Power
    if (blitzBoost) {
      ctx.fillStyle = 'rgba(125, 211, 252, 0.78)';
      ctx.fillRect(cx + trailDir * 16, cy - 6, 10, 2);
      ctx.fillRect(cx + trailDir * 19, cy + 2, 12, 2);
      ctx.fillRect(cx + trailDir * 14, cy + 8, 8, 2);
    }

    // Draw each animated pixel warrior in formation
    for (const unit of offsets) {
      const useA = (frameIdx + unit.phase) % 2 === 0;
      const spr = unit.elite
        ? useA
          ? sprites.eliteA
          : sprites.eliteB
        : useA
          ? sprites.soldierA
          : sprites.soldierB;

      const scale = 1.65;
      const dw = Math.round(spr.width * scale);
      const dh = Math.round(spr.height * scale);
      const ux = Math.round(cx + unit.ox);
      const uy = Math.round(cy + unit.oy);

      ctx.fillStyle = 'rgba(9, 13, 22, 0.52)';
      ctx.fillRect(ux - 6, uy + Math.round(dh * 0.34), 12, 3);

      ctx.save();
      ctx.translate(ux, uy);
      if (tr.facingLeft) {
        ctx.scale(-1, 1);
      }
      ctx.drawImage(spr, -Math.round(dw * 0.5), -Math.round(dh * 0.55), dw, dh);
      ctx.restore();
    }

    // Crisp Pixel Troop Count Plate floating directly above the squad
    const countText = `${Math.floor(tr.count)}`;
    const badgeW = Math.max(24, countText.length * 8 + 10);
    const badgeH = 15;
    const bx = cx - Math.round(badgeW / 2);
    const by = cy - 26;

    ctx.fillStyle = '#090e18';
    ctx.fillRect(bx - 2, by - 2, badgeW + 4, badgeH + 4);
    ctx.fillStyle = tr.isElite ? '#fde047' : faction.borderGlow;
    ctx.fillRect(bx - 1, by - 1, badgeW + 2, badgeH + 2);
    ctx.fillStyle = faction.color;
    ctx.fillRect(bx, by, badgeW, badgeH);

    ctx.fillStyle = '#ffffff';
    ctx.direction = 'ltr';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(countText, cx, by + 8);

    ctx.restore();
  }

  /** Renders an animated 16-bit pixel-art medieval warship for Naval Raids */
  private drawPixelWarship(
    ctx: CanvasRenderingContext2D,
    tr: GameSimulation['troops'][number],
    timeSec: number,
    blitzBoost: boolean
  ) {
    const faction = FACTIONS[tr.owner];
    const sprites = this.atlas.getFaction(tr.owner);
    const cx = Math.round(tr.x);
    const cy = Math.round(tr.y);
    const animSpeed = blitzBoost ? 10 : 5;
    const useA = Math.floor(timeSec * animSpeed + tr.id * 1.3) % 2 === 0;
    const spr = tr.isElite
      ? useA
        ? sprites.eliteShipA
        : sprites.eliteShipB
      : useA
        ? sprites.shipA
        : sprites.shipB;

    const scale = 2.0;
    const dw = Math.round(spr.width * scale);
    const dh = Math.round(spr.height * scale);

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    const trailDir = tr.facingLeft ? 1 : -1;
    ctx.fillStyle = 'rgba(186, 230, 253, 0.65)';
    ctx.fillRect(cx + trailDir * 14, cy + 7, 8, 2);
    ctx.fillRect(cx + trailDir * 20, cy + 10, 6, 2);

    ctx.save();
    ctx.translate(cx, cy);
    if (tr.facingLeft) {
      ctx.scale(-1, 1);
    }
    ctx.drawImage(spr, -Math.round(dw * 0.5), -Math.round(dh * 0.6), dw, dh);
    ctx.restore();

    const countText = `${Math.floor(tr.count)}`;
    const badgeW = Math.max(24, countText.length * 8 + 10);
    const badgeH = 15;
    const bx = cx - Math.round(badgeW / 2);
    const by = cy - 28;

    ctx.fillStyle = '#090e18';
    ctx.fillRect(bx - 2, by - 2, badgeW + 4, badgeH + 4);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(bx - 1, by - 1, badgeW + 2, badgeH + 2);
    ctx.fillStyle = faction.color;
    ctx.fillRect(bx, by, badgeW, badgeH);

    ctx.fillStyle = '#ffffff';
    ctx.direction = 'ltr';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(countText, cx, by + 8);

    ctx.restore();
  }

  private drawPixelRings(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const r of this.vfx.rings) {
      if (!r.active) continue;
      const t = Math.min(1, r.life / r.maxLife);
      const easeOut = 1 - (1 - t) * (1 - t);
      const rad = Math.round(r.startRadius + (r.maxRadius - r.startRadius) * easeOut);
      const alpha = Math.max(0, 1 - t * t);
      const rx = Math.round(r.x);
      const ry = Math.round(r.y);

      if (r.kind === 'dispatch') {
        // Directional pixel wave & marching chevron surging along dispatch vector
        const tipX = Math.round(rx + r.dx * rad);
        const tipY = Math.round(ry + r.dy * rad);
        const perpX = -r.dy;
        const perpY = r.dx;

        ctx.globalAlpha = alpha * 0.85;
        ctx.fillStyle = '#090e18';
        ctx.fillRect(tipX - 3, tipY - 3, 6, 6);
        ctx.fillStyle = r.color;
        ctx.fillRect(tipX - 2, tipY - 2, 4, 4);

        // Two chevron wings trailing behind the leading tip
        for (const side of [-1, 1]) {
          const wx = Math.round(tipX - r.dx * 5 + perpX * side * 5);
          const wy = Math.round(tipY - r.dy * 5 + perpY * side * 5);
          ctx.fillStyle = '#090e18';
          ctx.fillRect(wx - 2, wy - 2, 5, 5);
          ctx.fillStyle = r.color;
          ctx.fillRect(wx - 1, wy - 1, 3, 3);
        }

        // Subtle gate muster square ripple
        ctx.globalAlpha = alpha * 0.45;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = r.lineWidth;
        const gateR = Math.round(rad * 0.65);
        ctx.strokeRect(rx - gateR, ry - Math.round(gateR * 0.75), gateR * 2, Math.round(gateR * 1.5));
      } else {
        // Stepped 16-bit impact / shield-block / capture shockwave ring
        const halfW = rad;
        const halfH = Math.round(rad * 0.78);

        ctx.globalAlpha = alpha * 0.55;
        ctx.strokeStyle = '#090e18';
        ctx.lineWidth = r.lineWidth + 2;
        ctx.strokeRect(rx - halfW, ry - halfH, halfW * 2, halfH * 2);

        ctx.globalAlpha = alpha * 0.92;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = r.lineWidth;
        ctx.strokeRect(rx - halfW, ry - halfH, halfW * 2, halfH * 2);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const p of this.vfx.particles) {
      if (!p.active) continue;
      const progress = Math.min(1, p.life / p.maxLife);
      const alpha = Math.max(0, 1 - progress * progress);
      const px = Math.round(p.x);
      const py = Math.round(p.y);
      const s = Math.round(p.size);

      if (p.kind === 'spark') {
        // High-speed directional sword/muster spark with bright head & hot tail
        ctx.globalAlpha = alpha;
        const speed = Math.hypot(p.vx, p.vy) || 1;
        const tx = Math.round(px - (p.vx / speed) * (s + 2));
        const ty = Math.round(py - (p.vy / speed) * (s + 2));
        ctx.fillStyle = p.secondaryColor;
        ctx.fillRect(tx, ty, Math.max(2, s - 1), Math.max(2, s - 1));
        ctx.fillStyle = '#090e18';
        ctx.fillRect(px - 1, py - 1, s + 2, s + 2);
        ctx.fillStyle = progress < 0.45 ? p.color : p.secondaryColor;
        ctx.fillRect(px, py, s, s);
      } else if (p.kind === 'dust') {
        // Expanding pixel boot-dust / siege smoke cloud
        const puffSize = s + (progress > 0.45 ? 2 : progress > 0.2 ? 1 : 0);
        const half = Math.floor(puffSize * 0.5);
        ctx.globalAlpha = alpha * 0.72;
        ctx.fillStyle = progress > 0.55 ? p.secondaryColor : p.color;
        ctx.fillRect(px - half, py - half, puffSize, puffSize);
        if (puffSize >= 4) {
          ctx.globalAlpha = alpha * 0.42;
          ctx.fillRect(px - half - 1, py - half + 1, puffSize + 2, puffSize - 2);
        }
      } else if (p.kind === 'debris') {
        // Outlined tumbling castle masonry stone chunk
        ctx.globalAlpha = Math.min(1, alpha * 1.25);
        ctx.fillStyle = '#090e18';
        ctx.fillRect(px - 1, py - 1, s + 2, s + 2);
        ctx.fillStyle = p.color;
        ctx.fillRect(px, py, s, s);
        if (s >= 3) {
          ctx.fillStyle = p.secondaryColor;
          ctx.fillRect(px + s - 1, py + s - 1, 1, 1);
        }
      } else if (p.kind === 'ember') {
        // Glowing drifting ember pixel
        ctx.globalAlpha = alpha * 0.95;
        ctx.fillStyle = progress < 0.5 ? p.color : p.secondaryColor;
        ctx.fillRect(px, py, s, s);
      } else {
        // Crisp 16-bit '+' diamond glint sparkle
        ctx.globalAlpha = alpha;
        const arm = Math.max(2, s);
        ctx.fillStyle = p.secondaryColor;
        ctx.fillRect(px - arm, py, arm * 2 + 1, 1);
        ctx.fillRect(px, py - arm, 1, arm * 2 + 1);
        ctx.fillStyle = p.color;
        ctx.fillRect(px - 1, py - 1, 3, 3);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawFloatingTexts(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 12px "Vazirmatn", sans-serif';
    for (const f of this.texts) {
      if (!f.active) continue;
      const alpha = Math.max(0, 1 - Math.pow(f.life / f.maxLife, 1.8));
      ctx.direction = /^[+-]\d/.test(f.text) ? 'ltr' : 'rtl';
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(9, 14, 24, 0.95)';
      ctx.strokeText(f.text, Math.round(f.x), Math.round(f.y));
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, Math.round(f.x), Math.round(f.y));
    }
    ctx.restore();
  }
}
