import { FACTIONS, NEUTRAL_STYLE } from './constants';
import type { FactionId } from './types';

/**
 * Procedural 16-bit Pixel-Art Sprite Atlas
 * Renders crisp multi-shaded pixel sprites onto tiny offscreen canvases and draws
 * them with imageSmoothingEnabled = false for authentic high-craft retro strategy visuals.
 */

type PaletteMap = Record<string, string>;

function bakeSprite(rows: string[], palette: PaletteMap): HTMLCanvasElement {
  const h = rows.length;
  const w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const color = palette[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

// 1. Detailed 24x22 16-bit Pixel-Art Castle Fortress Sprite
const CASTLE_GRID = [
  '...........K............',
  '..........KRR...........',
  '..........KRRR..........',
  '..........KRR...........',
  '..........K.............',
  '.........KMK............',
  '........KMRMK...........',
  '.......KMRRRMK..........',
  '..K...KMMMMMMMK...K.....',
  '.KMK..KLLLLLLLK..KMK....',
  'KMRMK.KLSSKSSLK.KMRMK...',
  'KSSSKKKSSSSSSSKKKSSSK...',
  'KSDSKSKSDSSSDSKSKSDSK...',
  'KSSSKLKKKKKKKKKLKSSSK...',
  'KSSSKSSKSSSKSSKSKSSSK...',
  'KSDSKSSKGGGKSSKSKSDSK...',
  'KSSSKSSKGDGKSSKSKSSSK...',
  'KSSSKSSKGDGKSSKSKSSSK...',
  'KSSSKSSKGDGKSSKSKSSSK...',
  'KDDDKDDKGGGKDDKDKDDDK...',
  'KKKKKKKKKKKKKKKKKKKKK...',
  '........................',
];

const CASTLE_GRID_FLASH = CASTLE_GRID.map((r) =>
  r.replace(/[SLDMG]/g, 'W')
);

// 2. Animated 12x14 Pixel-Art Soldier (Footman / Knight) — 2 Walk Frames
const SOLDIER_FRAME_A = [
  '....KKK.....',
  '...KHHHK..K.',
  '...KFFFKK.S.',
  '..KKRRKK..S.',
  '.KBPPRRK..S.',
  '.KBBPRRKKKS.',
  '.KBBPRRK..K.',
  '..KPRRRK....',
  '...KKKK.....',
  '...KDDK.....',
  '..KDK.KDK...',
  '..KK...KK...',
  '............',
  '............',
];

const SOLDIER_FRAME_B = [
  '............',
  '....KKK...K.',
  '...KHHHK..S.',
  '...KFFFKK.S.',
  '..KKRRKK..S.',
  '.KBPPRRK..S.',
  '.KBBPRRKKKS.',
  '.KBBPRRK..K.',
  '..KPRRRK....',
  '...KKKK.....',
  '...KDKDK....',
  '...KK.KK....',
  '............',
  '............',
];

// 3. Elite Armored Captain / Banner Knight (14x16) — For Forge / Large Squads
const ELITE_FRAME_A = [
  '.....KGGK.....',
  '....KRRRRK..K.',
  '....KHHHHK..S.',
  '...KHKKKKHK.S.',
  '..KKRRRRKK..S.',
  '.KGPRRRRGK..S.',
  '.KGGPRRRGKKKS.',
  '.KGGPRRRGK..K.',
  '..KGRRRRGK....',
  '...KGGGGK.....',
  '...KDDKDK.....',
  '..KDK..KDK....',
  '..KK....KK....',
  '..............',
];

const ELITE_FRAME_B = [
  '..............',
  '.....KGGK...K.',
  '....KRRRRK..S.',
  '....KHHHHK..S.',
  '...KHKKKKHK.S.',
  '..KKRRRRKK..S.',
  '.KGPRRRRGK..S.',
  '.KGGPRRRGKKKS.',
  '.KGGPRRRGK..K.',
  '..KGRRRRGK....',
  '...KGGGGK.....',
  '...KDKDDK.....',
  '...KK..KK.....',
  '..............',
];

// 4. Pixel-Art Constructed Building Annex Sprites
const BARRACKS_GRID = [
  '......K.......',
  '.....KRR......',
  '.....K........',
  '....KWWK......',
  '...KWRRWK.....',
  '..KWWWRWWK....',
  '.KWWKRRKWWK...',
  '.KWWKDDKWWK...',
  '.KSSKDDKSSK...',
  '.KKKKKKKKKK...',
];

const TOWER_GRID = [
  '.K.K.K.K..',
  '.KKKKKKK..',
  '.KLLLLLK..',
  '..KSSSK...',
  '..KSBSK...',
  '..KSBSK...',
  '..KSSSK...',
  '..KSDDK...',
  '..KSSSK...',
  '.KKSSSKK..',
  '.KDDDDDK..',
  '.KKKKKKK..',
];

const MINE_GRID = [
  '....KKKK....',
  '..KKBBBBKK..',
  '.KBBGGGGbbK.',
  '.KBDKKKKDBK.',
  '.KBDKGGKDBK.',
  '.KBDKGYKDBK.',
  '.KBBKKKKBBK.',
  '.KKKKKKKKKK.',
];

const FORGE_GRID = [
  '........KK..',
  '.......KCCK.',
  '..KKKK.KSSK.',
  '.KMMMMKKSSK.',
  '.KDDDDKKSSK.',
  '.KDOODKSSSK.',
  '.KDOYDKSSSK.',
  '.KDDDDKDDDK.',
  '.KKKKKKKKKK.',
];

// 5. Pixel-Art Terrain Props (Trees, Pines, Mountains, Wheat)
const PINE_GRID = [
  '....K....',
  '...KLK...',
  '..KLLGK..',
  '.KLLGGGK.',
  '..KGGDK..',
  '.KLLGGGK.',
  'KLLGGGGDK',
  '.KKGDDKK.',
  '...KBK...',
  '...KBK...',
  '..KKKKK..',
];

const OAK_GRID = [
  '...KKKK...',
  '.KKLLGGKK.',
  'KLLLGGGGGK',
  'KLLGGGGGDK',
  'KLGGGGDDDK',
  '.KKGDDDKK.',
  '...KBBK...',
  '...KBBK...',
  '..KKKKKK..',
];

const MOUNTAIN_GRID = [
  '......KK......',
  '.....KWWK.....',
  '....KWWLLK....',
  '...KWWLLSSK...',
  '..KLLSSSDDDK..',
  '.KLSSSSDDDDDK.',
  'KSSSDDDDDDDDDK',
  'KKKKKKKKKKKKKK',
];

const WHEAT_GRID = [
  '.Y..Y..Y.',
  '.G.YG.YG.',
  'YG.YG.YGY',
  '.D.DD.DD.',
];

export interface FactionSprites {
  castle: HTMLCanvasElement;
  castleFlash: HTMLCanvasElement;
  barracks: HTMLCanvasElement;
  soldierA: HTMLCanvasElement;
  soldierB: HTMLCanvasElement;
  eliteA: HTMLCanvasElement;
  eliteB: HTMLCanvasElement;
}

export class PixelSpriteAtlas {
  private factions = new Map<FactionId, FactionSprites>();
  public tower: HTMLCanvasElement;
  public mine: HTMLCanvasElement;
  public forge: HTMLCanvasElement;
  public pine: HTMLCanvasElement;
  public oak: HTMLCanvasElement;
  public mountain: HTMLCanvasElement;
  public wheat: HTMLCanvasElement;

  constructor() {
    this.tower = bakeSprite(TOWER_GRID, {
      K: '#0b101a',
      L: '#cbd5e1',
      S: '#8a99ad',
      D: '#4b586e',
      B: '#38bdf8',
    });

    this.mine = bakeSprite(MINE_GRID, {
      K: '#0b101a',
      B: '#7c4d25',
      b: '#5c3618',
      D: '#3b2412',
      G: '#f59e0b',
      Y: '#fef08a',
    });

    this.forge = bakeSprite(FORGE_GRID, {
      K: '#0b101a',
      C: '#94a3b8',
      S: '#64748b',
      M: '#b45309',
      D: '#334155',
      O: '#f97316',
      Y: '#fde047',
    });

    this.pine = bakeSprite(PINE_GRID, {
      K: '#0d1a14',
      L: '#47a35a',
      G: '#25703e',
      D: '#17472a',
      B: '#5c3b20',
    });

    this.oak = bakeSprite(OAK_GRID, {
      K: '#111d13',
      L: '#63b856',
      G: '#35853b',
      D: '#1f5427',
      B: '#6b4423',
    });

    this.mountain = bakeSprite(MOUNTAIN_GRID, {
      K: '#141923',
      W: '#edf2f7',
      L: '#9aa8ba',
      S: '#677487',
      D: '#3e4756',
    });

    this.wheat = bakeSprite(WHEAT_GRID, {
      Y: '#facc15',
      G: '#ca8a04',
      D: '#854d0e',
    });

    // Bake faction-colored castles, barracks, and animated soldier squads
    this.bakeFaction(-1, NEUTRAL_STYLE.color, NEUTRAL_STYLE.borderGlow, '#cbd5e1');
    for (const f of FACTIONS) {
      this.bakeFaction(f.id, f.color, f.borderGlow, f.bannerLight);
    }
  }

  private bakeFaction(
    id: FactionId,
    primary: string,
    highlight: string,
    light: string
  ) {
    const castlePalette: PaletteMap = {
      K: '#0b101a',
      L: '#cbd5e1',
      S: '#8896a8',
      D: '#4c596b',
      G: '#1e293b',
      M: highlight,
      R: primary,
      W: '#ffffff',
    };

    const soldierPalette: PaletteMap = {
      K: '#0b101a',
      H: '#cbd5e1',
      F: '#f5cfa0',
      R: primary,
      P: highlight,
      B: light,
      S: '#e2e8f0',
      D: '#334155',
      G: '#fbbf24',
    };

    const barracksPalette: PaletteMap = {
      K: '#0b101a',
      W: '#ece4d3',
      S: '#bfb49f',
      D: '#2a221c',
      R: primary,
    };

    this.factions.set(id, {
      castle: bakeSprite(CASTLE_GRID, castlePalette),
      castleFlash: bakeSprite(CASTLE_GRID_FLASH, castlePalette),
      barracks: bakeSprite(BARRACKS_GRID, barracksPalette),
      soldierA: bakeSprite(SOLDIER_FRAME_A, soldierPalette),
      soldierB: bakeSprite(SOLDIER_FRAME_B, soldierPalette),
      eliteA: bakeSprite(ELITE_FRAME_A, soldierPalette),
      eliteB: bakeSprite(ELITE_FRAME_B, soldierPalette),
    });
  }

  public getFaction(id: FactionId): FactionSprites {
    return this.factions.get(id) ?? this.factions.get(-1)!;
  }
}
