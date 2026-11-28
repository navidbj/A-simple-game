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

function bakeFlippedSprite(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

// 1. Detailed 24x22 16-bit Pixel-Art High Fantasy Castle Fortress Sprite
const CASTLE_GRID = [
  '...........K............',
  '..........KRR...........',
  '..........KRRR..........',
  '..........KRR...........',
  '..........K.............',
  '.........KAK............',
  '........KMRMK...........',
  '.......KMRRRMK..........',
  '..K...KMMMMMMMK...K.....',
  '.KAK..KLLLLLLLK..KAK....',
  'KMRMK.KLSSKSSLK.KMRMK...',
  'KSSSKKKSSSSSSSKKKSSSK...',
  'KSDSKSKSDSSSDSKSKSDSK...',
  'KSSSKLKKKKKKKKKLKSSSK...',
  'KSSSKSSKSSSKSSKSKSSSK...',
  'KSDSKSSKAAAKSSKSKSDSK...',
  'KSSSKSSKAGAKSSKSKSSSK...',
  'KSSSKSSKGBGKSSKSKSSSK...',
  'KSSSKSSKGBGKSSKSKSSSK...',
  'KDDDKDDKGGGKDDKDKDDDK...',
  'KKKKKKKKKKKKKKKKKKKKK...',
  '........................',
];

const CASTLE_GRID_FLASH = CASTLE_GRID.map((r) =>
  r.replace(/[SLDMGAB]/g, 'W')
);

// 1b. Compact 18x18 Timber & Stone Outpost Keep (for small/neutral garrisons)
const CASTLE_SMALL_GRID = [
  '........K.........',
  '.......KRR........',
  '.......KRRR.......',
  '.......K..........',
  '......KMK.........',
  '.....KMRMK........',
  '....KMMMMMK.......',
  '...KBBBBBBBK......',
  '...KBSSKSSBK......',
  '..KKSSSSSSSKK.....',
  '..KSDSSSDSKSK.....',
  '..KSSKBBBKSSK.....',
  '..KSSKBDGKSSK.....',
  '..KSSKBDGKSSK.....',
  '..KDDKGGGKDDK.....',
  '..KKKKKKKKKKK.....',
  '..................',
  '..................',
];

const CASTLE_SMALL_FLASH = CASTLE_SMALL_GRID.map((r) =>
  r.replace(/[SLDMGB]/g, 'W')
);

// 1c. Majestic 26x25 Grand Imperial Marble & Gold Citadel (for powerful fortified strongholds)
const CASTLE_GRAND_GRID = [
  '............K.............',
  '...........KRR............',
  '...........KRRR...........',
  '...........KRR............',
  '...........K..............',
  '..........KAK.............',
  '....K....KAYAK....K.......',
  '...KRR..KAMRMAK..KRR......',
  '...K...KAMRRRMAK...K......',
  '..KAK.KAAAAAAAAAK.KAK.....',
  '.KMRMK.KIIIIIIIK.KMRMK....',
  'KMRRRMKKILLKLLIKKMRRRMK...',
  'KIIIIIKKAALLLAAKKIIIIIK...',
  'KILIKAKILLSASLLIKAKILIK...',
  'KSSSKKLKKKKKKKKKLKKSSSK...',
  'KSSSKSSKIIIAIIIKSSKSSSK...',
  'KSDSKSSKIAAAAAIKSSKSDSK...',
  'KSSSKSSKGGDDGGGKSSKSSSK...',
  'KSSSKSSKGGAYGGGKSSKSSSK...',
  'KSSSKSSKGGDDGGGKSSKSSSK...',
  'KSSSKSSKGGDDGGGKSSKSSSK...',
  'KDDDKDDKGGGGGGGKDDKDDDK...',
  'KKKKKKKKKKKKKKKKKKKKKKK...',
  '..........................',
  '..........................',
];

const CASTLE_GRAND_FLASH = CASTLE_GRAND_GRID.map((r) =>
  r.replace(/[SLDMGAYI]/g, 'W')
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

// 4. Pixel-Art Constructed Building Annex Sprites — High Fantasy Medieval Theme (Lv.1 Timber & Stone -> Lv.2 Dressed Stone & Faction Slate -> Lv.3 Ivory Marble & Gold)

// 4a. BARRACKS: Lv.1 Timber & Stone Camp (14x10) -> Lv.2 Dressed-Stone Garrison (16x13) -> Lv.3 Gilded Marble Knight Academy (18x16)
const BARRACKS_LV1_GRID = [
  '......K.......',
  '.....KRR......',
  '.....K........',
  '....KMMK......',
  '...KMRRMK.....',
  '..KBBBBBBK....',
  '.KBBKRRKBBK...',
  '.KBSKDDKSBK...',
  '.KSSKDDKSSK...',
  '.KKKKKKKKKK...',
];

const BARRACKS_LV2_GRID = [
  '.......K........',
  '......KRRK......',
  '......KRR.......',
  '......K.........',
  '..K..KMK..K.....',
  '.KMKMRRRMKMK....',
  '.KLLRRRRRLLK....',
  '.KLSKMMMKSLK....',
  '.KSSKBBBKSSK....',
  '.KSSKBDKSSSK....',
  '.KDSKBDDKSDK....',
  '.KDDKDDDKDDK....',
  '.KKKKKKKKKKK....',
];

const BARRACKS_LV3_GRID = [
  '........K.........',
  '.......KRRK.......',
  '.......KRR........',
  '..K....K....K.....',
  '.KGY..KGY..KGY....',
  '.KAK.KGGGK.KAK....',
  'KGRGKGMRMGKGRGK...',
  'KWWGGRRRRRGGWWK...',
  'KWLKGGMMMGKKLWK...',
  'KWWKGRGYGRKKWWK...',
  'KSSKGDDDDGKKSSK...',
  'KLSKGDDYDGKKSLK...',
  'KSSKGDDDDGKKSSK...',
  'KDDKGGGGGGKKDDK...',
  'KKKKKKKKKKKKKKK...',
  '..................',
];

// 4b. DEFENSE TOWER: Lv.1 Timber & Stone Watchtower (10x12) -> Lv.2 Iron-Bound Stone Bastion (12x16) -> Lv.3 Gilded Marble Arcane Spire (14x19)
const TOWER_LV1_GRID = [
  '.K.K.K.K..',
  '.KBBBBBK..',
  '.KBbYbBK..',
  '..KBBBK...',
  '..KSSSK...',
  '..KSDSK...',
  '..KSSSK...',
  '..KSDDK...',
  '..KSSSK...',
  '.KKSSSKK..',
  '.KDDDDDK..',
  '.KKKKKKK..',
];

const TOWER_LV2_GRID = [
  '.....KK.....',
  '....KCCK....',
  '....KBCK....',
  '.K.KKKKKK.K.',
  '.KKIIIIIIKK.',
  '.KLLLLLLLLK.',
  '..KISBBISK..',
  '..KISCCISK..',
  '..KISBBISK..',
  '..KIDSSDIK..',
  '..KISSSSIK..',
  '..KIDDDDIK..',
  '.KKISSSSIKK.',
  '.KIIIDDDIIK.',
  '.KDDDDDDDDK.',
  '.KKKKKKKKKK.',
];

const TOWER_LV3_GRID = [
  '......KK......',
  '.....KYYK.....',
  '....KYCCYK....',
  '....KCCBCK....',
  '.....KBBK.....',
  '.K..KKGGKK..K.',
  'KGGKGWWWWGKGGK',
  '.KKGWLLCCLLGKK',
  '..KGWLCBBLWGK.',
  '..KGWLLCCLLGK.',
  '..KGLWDBBDWGK.',
  '..KGGWWWWWGGK.',
  '..KGWLCBBLWGK.',
  '..KGWWLDDWWGK.',
  '.KKGGWWLLWGGKK',
  '.KGWLLGGGGLLWK',
  '.KLDDDGGGGDDDK',
  '.KGGGGGGGGGGGK',
  '.KKKKKKKKKKKKK',
];

// 4c. MINE & MARKET: Lv.1 Timber-Braced Mine (12x8) -> Lv.2 Stone Quarry & Guild Market (15x11) -> Lv.3 Gilded Marble Royal Treasury (16x13)
const MINE_LV1_GRID = [
  '....KKKK....',
  '..KKBBBBKK..',
  '.KBBSSSSbbK.',
  '.KBDKKKKDBK.',
  '.KBDKGGKDBK.',
  '.KBDKGYKDBK.',
  '.KBBKKKKBBK.',
  '.KKKKKKKKKK.',
];

const MINE_LV2_GRID = [
  '.....KKKKK.....',
  '...KKLLLLLKK...',
  '..KLLSSSSSLLK..',
  '.KLSSBBBBSSSLK.',
  '.KLSKKKKKKKKSLK',
  '.KLSKDDGGDDKSLK',
  '.KDSKDGGYGDKSDK',
  '.KDDKDDGGDDKDDK',
  'KBBKKKKKKKKKKBK',
  'KGGYDDDDDDYGGGK',
  'KKKKKKKKKKKKKKK',
];

const MINE_LV3_GRID = [
  '......KKKK......',
  '....KKYYYYKK....',
  '...KYYGGGGYYK...',
  '..KYGGYYYYGGYK..',
  '.KKGGGGGGGGGGKK.',
  '.KWWGGRRRRGGWWK.',
  '.KWLKGGGGGGKLWK.',
  '.KWSKGYYYYGKSWK.',
  '.KWLKGYGGYGKLWK.',
  '.KDSKGYYYYGKSDK.',
  'KKGGKGGGGGGKGGKK',
  'KYYYYGGGGGGYYYYK',
  'KKKKKKKKKKKKKKKK',
];

// 4d. WAR FORGE: Lv.1 Timber & Stone Smithy (12x9) -> Lv.2 Twin-Chimney Steel Foundry (15x12) -> Lv.3 Gilded Marble Dragon-Forge (16x15)
const FORGE_LV1_GRID = [
  '........KK..',
  '.......KCCK.',
  '..KKKK.KSSK.',
  '.KBBBBKKSSK.',
  '.KDDDDKKSSK.',
  '.KDOODKSSSK.',
  '.KDOYDKSSSK.',
  '.KDDDDKDDDK.',
  '.KKKKKKKKKK.',
];

const FORGE_LV2_GRID = [
  '..KK.......KK..',
  '.KCCK.....KCCK.',
  '.KSSK.KKK.KSSK.',
  '.KSSKKIIIKKSSK.',
  '.KSSKIIIIKKSSK.',
  'KIIIIMMMMMIIIIK',
  'KIDDDKKKKKDDDIK',
  'KIDDKOOOOOKDDIK',
  'KIDDKOYYOOKDDIK',
  'KIDDKOYYOOKSIIK',
  'KDDDDKKKKKDDDDK',
  'KKKKKKKKKKKKKKK',
];

const FORGE_LV3_GRID = [
  '.KK....KK....KK.',
  'KGGK..KOOY..KGGK',
  '.KWK.KOOOOYK.KWK',
  '.KWK.KGGGGGKKWK.',
  '.KWGKIIOOIIKGWK.',
  'KGGWWWIIGGWWIGGK',
  'KWWGGMMMMMMGGWWK',
  'KWGGKKKKKKKKGGWK',
  'KWDKOOYYYYOOKDWK',
  'KWDKOYYWWYYOKDWK',
  'KWDKOYYYYYYOKDWK',
  'KWGKOOOOOOOOOKGK',
  'KGGKKKKKKKKKKGGK',
  'KDDGGGGGGGGGGDDK',
  'KKKKKKKKKKKKKKKK',
];

// 4e. PORT: Lv.1 Timber Pier (14x11) -> Lv.2 Stone Harbor & Crane (16x13) -> Lv.3 Grand Gilded Marble Harbor (18x15)
const PORT_LV1_GRID = [
  '..KK..........',
  '.KYYK.........',
  '.KBBK....K....',
  '.KRRK...KPK...',
  '.KBBK...KPPK..',
  '.KRRK...KPK...',
  'KBBBBKKKKKKK..',
  'KBBBBBBBBBBBK.',
  'KDBDBDBDBDBDK.',
  '.K.K..K..K.K..',
  '.K.K..K..K.K..',
];

const PORT_LV2_GRID = [
  '..KK............',
  '.KYYK......KK...',
  '.KWWK.....KBBK..',
  '.KRRK....KB..K..',
  '.KWWK...KB..KPK.',
  '.KRRK...KB..KPPK',
  '.KWWK...KB..KPK.',
  'KLLLLKKKBBKKKKK.',
  'KSSSSSSSSSSSSSSK',
  'KSDSSSDSSSDSSSDK',
  'KDDDDDDDDDDDDDDK',
  '.KK..KK..KK..KK.',
  '.KK..KK..KK..KK.',
];

const PORT_LV3_GRID = [
  '...KK.............',
  '..KGYK.......K....',
  '.KGYYGK.....KRR...',
  '..KWWK..K...K.....',
  '..KRRK.KRR..KGGK..',
  '..KWWK.K...KGRRGK.',
  '..KRRK.K...KGGGGK.',
  '.KGWWGKKGGKKWWWWK.',
  'KGGGGGGGGGGGGGGGGK',
  'KWWLLGWWLLGWWLLWWK',
  'KLLSSGLLSSGLLSSLLK',
  'KDDDDGDDDDGDDDDDDK',
  'KKKKKKKKKKKKKKKKKK',
  '.KG..KG..KG..KG...',
  '.KK..KK..KK..KK...',
];

// 4b. Animated 16x14 16-Bit Pixel-Art Medieval Warship (2 Wave / Sail Frames)
const SHIP_FRAME_A = [
  '.......KK.......',
  '......KRRK......',
  '......K.K.......',
  '....KKKKKKK.....',
  '...KWWWRWWWK....',
  '...KWWWRWWWK....',
  '...KWWPRRWWK....',
  '...KLLPRRLLK....',
  '....KKKKKKK.....',
  '.KKKKKKBKKKKKK..',
  '..KBBBBBBBBBK...',
  '...KDDGDDGDK....',
  '..CCKKKKKKKCC...',
  '....CC...CC.....',
];

const SHIP_FRAME_B = [
  '................',
  '.......KK.......',
  '......KRRRK.....',
  '......K.K.......',
  '....KKKKKKK.....',
  '...KWWWRWWWK....',
  '...KWWPRRWWK....',
  '...KLLPRRLLK....',
  '....KKKKKKK.....',
  '.KKKKKKBKKKKKK..',
  '..KBBBBBBBBBK...',
  '...KDDGDDGDK....',
  '.CC.KKKKKKK.CC..',
  '..CC.......CC...',
];

const ELITE_SHIP_FRAME_A = [
  '.......KGGK.....',
  '......KRRRK.....',
  '......K.K.......',
  '...KKKKKKKKK....',
  '..KGGWWRWWGGK...',
  '..KGGWPRRWGGK...',
  '..KGGWPRRWGGK...',
  '..KGGLLRRLLGK...',
  '...KKKKKKKKK....',
  '.KKKKKKGKKKKKK..',
  '..KBBGGBBGGBK...',
  '...KDDDDDDDK....',
  '..CCKKKKKKKCC...',
  '....CC...CC.....',
];

const ELITE_SHIP_FRAME_B = [
  '................',
  '.......KGGK.....',
  '......KRRRK.....',
  '......K.K.......',
  '...KKKKKKKKK....',
  '..KGGWWRWWGGK...',
  '..KGGWPRRWGGK...',
  '..KGGLLRRLLGK...',
  '...KKKKKKKKK....',
  '.KKKKKKGKKKKKK..',
  '..KBBGGBBGGBK...',
  '...KDDDDDDDK....',
  '.CC.KKKKKKK.CC..',
  '..CC.......CC...',
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

// 5b. Tall Stately Persian Cypress Tree (سرو)
const CYPRESS_GRID = [
  '...K...',
  '..KLK..',
  '..KGLK.',
  '.KLLGK.',
  '.KLGGK.',
  '.KLGGDK',
  '.KGGDDK',
  '.KGGDDK',
  '..KGDDK',
  '..KDDK.',
  '...KBK.',
  '...KBK.',
  '..KKKK.',
  '.......',
];

// 5c. Graceful Date Palm Tree (for Middle East & tropical shores)
const PALM_GRID = [
  '...KK..KK...',
  '.KKLLKKLLKK.',
  'KLLGGKKGGLLK',
  '.KK.KYYK.KK.',
  '...KKBBKK...',
  '..K..KBK..K.',
  '.....KDK....',
  '....KBK.....',
  '....KDK.....',
  '...KBK......',
  '...KDK......',
  '..KKKKK.....',
  '............',
];

// 5d. Spinning Fertile Plain Windmill (Static Tower + 2-Frame Sails)
const WINDMILL_BASE_GRID = [
  '...KKKK...',
  '..KRRRRK..',
  '.KRRRRRRK.',
  '..KLLLLK..',
  '..KLSSLK..',
  '..KSSSSK..',
  '..KSDDSK..',
  '.KKSSSSKK.',
  '.KSSGGSSK.',
  '.KDDGGDDK.',
  '.KKKKKKKK.',
  '..........',
];

const WINDMILL_SAIL_A = [
  '....KKK....',
  '....KWK....',
  '....KWK....',
  '....KBK....',
  'KKKKKBKKKKK',
  'KWWBBYBBWWK',
  'KKKKKBKKKKK',
  '....KBK....',
  '....KWK....',
  '....KWK....',
  '....KKK....',
];

const WINDMILL_SAIL_B = [
  '.KK.....KK.',
  'KWWK...KWWK',
  '.KWBK.KBWK.',
  '..KBBKBBK..',
  '...KKBKK...',
  '....KBYK...',
  '...KKBKK...',
  '..KBBKBBK..',
  '.KWBK.KBWK.',
  'KWWK...KWWK',
  '.KK.....KK.',
];

// 5e. Ancient Persian Stone Arch Ruins with Ivy
const RUIN_GRID = [
  '..KKKKKKKK...',
  '.KLLLSSLLGK..',
  '.KLSKKKSSGGK.',
  '.KLSK.KSSK...',
  '.KDSK.KDSK.KK',
  '.KDSK.KDSKKLK',
  '.KDDK.KDDKSDK',
  'KKDDKKKDDKDDK',
  'KKKKKKKKKKKKK',
  '.............',
];

// 5f. Cozy Twin Village Hamlet with Glowing Warm Windows
const VILLAGE_GRID = [
  '..KKK....KKK..',
  '.KRRRK..KOOOK.',
  'KRRRRRKKOOOOOK',
  '.KWWWK..KWWWK.',
  '.KWYWK..KWWYK.',
  '.KWWDK..KWDWK.',
  '.KDDDK..KDDDK.',
  'KKKKKKKKKKKKKK',
  '..............',
];

// 5g. Desert Turquoise Oasis Pool
const OASIS_GRID = [
  '...KKKKKKKK...',
  '.KKSSSSSSSSKK.',
  'KSSTCCCCCCCSTK',
  'KSTCCLLLLCCSTK',
  'KSSTCCCCCCSTSK',
  '.KKSSSTTTSSKK.',
  '...KKKKKKKK...',
  '..............',
];

// 5h. Craggy Ocean Sea Stack / Rocky Islet
const SEA_ROCK_GRID = [
  '.....KK.....',
  '....KLLK....',
  '...KLSSK.KK.',
  '..KLSSDDKSLK',
  '.KLSSDDDDDDK',
  '.KSSDDDDDDDK',
  'CCKKKKKKKKCC',
  '.CCC....CCC.',
  '............',
];

// 5i. Tiny Ambient Lateen-Sail Merchant Dhow
const MERCHANT_DHOW_GRID = [
  '.....K.....',
  '....KWK....',
  '...KWWK....',
  '..KWWWK....',
  '..KWWLK....',
  '...KKK.....',
  '.KKKBKKKK..',
  '..KBBBBK...',
  '.CCKKKKCC..',
  '...........',
];

export interface FactionSprites {
  castleSmall: HTMLCanvasElement;
  castleSmallFlash: HTMLCanvasElement;
  castle: HTMLCanvasElement;
  castleFlash: HTMLCanvasElement;
  castleGrand: HTMLCanvasElement;
  castleGrandFlash: HTMLCanvasElement;
  barracks: HTMLCanvasElement;
  barracksLevels: readonly [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement];
  port: HTMLCanvasElement;
  portLevels: readonly [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement];
  soldierA: HTMLCanvasElement;
  soldierB: HTMLCanvasElement;
  soldierALeft: HTMLCanvasElement;
  soldierBLeft: HTMLCanvasElement;
  eliteA: HTMLCanvasElement;
  eliteB: HTMLCanvasElement;
  eliteALeft: HTMLCanvasElement;
  eliteBLeft: HTMLCanvasElement;
  shipA: HTMLCanvasElement;
  shipB: HTMLCanvasElement;
  shipALeft: HTMLCanvasElement;
  shipBLeft: HTMLCanvasElement;
  eliteShipA: HTMLCanvasElement;
  eliteShipB: HTMLCanvasElement;
  eliteShipALeft: HTMLCanvasElement;
  eliteShipBLeft: HTMLCanvasElement;
}

export class PixelSpriteAtlas {
  private factions = new Map<FactionId, FactionSprites>();
  public tower: HTMLCanvasElement;
  public towerLevels: readonly [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement];
  public mine: HTMLCanvasElement;
  public mineLevels: readonly [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement];
  public forge: HTMLCanvasElement;
  public forgeLevels: readonly [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement];
  public pine: HTMLCanvasElement;
  public oak: HTMLCanvasElement;
  public cypress: HTMLCanvasElement;
  public palm: HTMLCanvasElement;
  public mountain: HTMLCanvasElement;
  public wheat: HTMLCanvasElement;
  public windmillBase: HTMLCanvasElement;
  public windmillSailA: HTMLCanvasElement;
  public windmillSailB: HTMLCanvasElement;
  public ruin: HTMLCanvasElement;
  public village: HTMLCanvasElement;
  public oasis: HTMLCanvasElement;
  public seaRock: HTMLCanvasElement;
  public merchantDhow: HTMLCanvasElement;
  public merchantDhowLeft: HTMLCanvasElement;

  constructor() {
    const towerPalette: PaletteMap = {
      K: '#0b101a',
      W: '#f5efe0',
      L: '#cbd5e1',
      S: '#8a99ad',
      I: '#475569',
      D: '#2a3444',
      B: '#855228',
      b: '#5c3618',
      C: '#7dd3fc',
      G: '#f5b83d',
      Y: '#fef08a',
    };
    this.towerLevels = [
      bakeSprite(TOWER_LV1_GRID, towerPalette),
      bakeSprite(TOWER_LV2_GRID, towerPalette),
      bakeSprite(TOWER_LV3_GRID, towerPalette),
    ];
    this.tower = this.towerLevels[0];

    const minePalette: PaletteMap = {
      K: '#0b101a',
      W: '#f5efe0',
      B: '#7c4d25',
      b: '#5c3618',
      L: '#cbd5e1',
      S: '#8a99ad',
      D: '#3b2412',
      G: '#f59e0b',
      Y: '#fef08a',
      R: '#e11d48',
    };
    this.mineLevels = [
      bakeSprite(MINE_LV1_GRID, minePalette),
      bakeSprite(MINE_LV2_GRID, minePalette),
      bakeSprite(MINE_LV3_GRID, minePalette),
    ];
    this.mine = this.mineLevels[0];

    const forgePalette: PaletteMap = {
      K: '#0b101a',
      C: '#94a3b8',
      S: '#64748b',
      I: '#3f4b5e',
      B: '#7c4d25',
      M: '#b45309',
      D: '#1e293b',
      O: '#f97316',
      Y: '#fde047',
      W: '#f5efe0',
      G: '#f5b83d',
    };
    this.forgeLevels = [
      bakeSprite(FORGE_LV1_GRID, forgePalette),
      bakeSprite(FORGE_LV2_GRID, forgePalette),
      bakeSprite(FORGE_LV3_GRID, forgePalette),
    ];
    this.forge = this.forgeLevels[0];

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

    this.cypress = bakeSprite(CYPRESS_GRID, {
      K: '#0b1913',
      L: '#4eb86c',
      G: '#267846',
      D: '#164c2d',
      B: '#5c3b20',
    });

    this.palm = bakeSprite(PALM_GRID, {
      K: '#0e1b14',
      L: '#65c458',
      G: '#2d8a43',
      Y: '#d97706',
      B: '#9a683a',
      D: '#6b4423',
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

    this.windmillBase = bakeSprite(WINDMILL_BASE_GRID, {
      K: '#111722',
      R: '#b45309',
      L: '#f5efe2',
      S: '#d6ccb8',
      D: '#8c806c',
      G: '#3b2818',
    });

    this.windmillSailA = bakeSprite(WINDMILL_SAIL_A, {
      K: '#111722',
      W: '#f8f2e4',
      B: '#a16207',
      Y: '#fde047',
    });

    this.windmillSailB = bakeSprite(WINDMILL_SAIL_B, {
      K: '#111722',
      W: '#f8f2e4',
      B: '#a16207',
      Y: '#fde047',
    });

    this.ruin = bakeSprite(RUIN_GRID, {
      K: '#151b26',
      L: '#e5dcc8',
      S: '#b8ae99',
      D: '#756e5f',
      G: '#3f9952',
    });

    this.village = bakeSprite(VILLAGE_GRID, {
      K: '#0f1622',
      R: '#b84735',
      O: '#c27a34',
      W: '#e8dec8',
      D: '#7a6c58',
      Y: '#fde047',
    });

    this.oasis = bakeSprite(OASIS_GRID, {
      K: '#242b23',
      S: '#dfc389',
      T: '#2bb3a8',
      C: '#38bdf8',
      L: '#bae6fd',
    });

    this.seaRock = bakeSprite(SEA_ROCK_GRID, {
      K: '#0a1424',
      L: '#7d8fa6',
      S: '#4e5d73',
      D: '#2a364a',
      C: '#9ad8e8',
    });

    this.merchantDhow = bakeSprite(MERCHANT_DHOW_GRID, {
      K: '#0b1424',
      W: '#f8f5eb',
      L: '#d6cbb8',
      B: '#8c5327',
      C: '#9ad8e8',
    });
    this.merchantDhowLeft = bakeFlippedSprite(this.merchantDhow);

    // Bake faction-colored castles (3 tiers), barracks, ports, soldiers & warships
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
      W: '#ffffff',
      I: '#f5efe0',
      L: '#cbd5e1',
      S: '#8896a8',
      D: '#4c596b',
      G: '#1e293b',
      B: '#7c4d25',
      M: highlight,
      R: primary,
      A: '#f5b83d',
      Y: '#fef08a',
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
      W: '#f5efe0',
      L: '#cbd5e1',
      S: '#8e99a8',
      D: '#2a221c',
      B: '#7c4d25',
      R: primary,
      M: highlight,
      A: '#d97706',
      G: '#f5b83d',
      Y: '#fef08a',
    };

    const portPalette: PaletteMap = {
      K: '#0b101a',
      Y: '#fef08a',
      W: '#e2e8f0',
      L: '#cbd5e1',
      S: '#7e8ea3',
      R: primary,
      P: light,
      B: '#9a683a',
      D: '#4c3a2a',
      G: '#f5b83d',
    };

    const shipPalette: PaletteMap = {
      K: '#0b101a',
      W: '#f8fafc',
      L: '#cbd5e1',
      R: primary,
      P: highlight,
      B: '#854d27',
      D: '#4a2912',
      G: '#fbbf24',
      C: '#bae6fd',
    };

    const barracksLevels: readonly [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement] = [
      bakeSprite(BARRACKS_LV1_GRID, barracksPalette),
      bakeSprite(BARRACKS_LV2_GRID, barracksPalette),
      bakeSprite(BARRACKS_LV3_GRID, barracksPalette),
    ];

    const portLevels: readonly [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement] = [
      bakeSprite(PORT_LV1_GRID, portPalette),
      bakeSprite(PORT_LV2_GRID, portPalette),
      bakeSprite(PORT_LV3_GRID, portPalette),
    ];

    const soldierA = bakeSprite(SOLDIER_FRAME_A, soldierPalette);
    const soldierB = bakeSprite(SOLDIER_FRAME_B, soldierPalette);
    const eliteA = bakeSprite(ELITE_FRAME_A, soldierPalette);
    const eliteB = bakeSprite(ELITE_FRAME_B, soldierPalette);
    const shipA = bakeSprite(SHIP_FRAME_A, shipPalette);
    const shipB = bakeSprite(SHIP_FRAME_B, shipPalette);
    const eliteShipA = bakeSprite(ELITE_SHIP_FRAME_A, shipPalette);
    const eliteShipB = bakeSprite(ELITE_SHIP_FRAME_B, shipPalette);

    this.factions.set(id, {
      castleSmall: bakeSprite(CASTLE_SMALL_GRID, castlePalette),
      castleSmallFlash: bakeSprite(CASTLE_SMALL_FLASH, castlePalette),
      castle: bakeSprite(CASTLE_GRID, castlePalette),
      castleFlash: bakeSprite(CASTLE_GRID_FLASH, castlePalette),
      castleGrand: bakeSprite(CASTLE_GRAND_GRID, castlePalette),
      castleGrandFlash: bakeSprite(CASTLE_GRAND_FLASH, castlePalette),
      barracks: barracksLevels[0],
      barracksLevels,
      port: portLevels[0],
      portLevels,
      soldierA,
      soldierB,
      soldierALeft: bakeFlippedSprite(soldierA),
      soldierBLeft: bakeFlippedSprite(soldierB),
      eliteA,
      eliteB,
      eliteALeft: bakeFlippedSprite(eliteA),
      eliteBLeft: bakeFlippedSprite(eliteB),
      shipA,
      shipB,
      shipALeft: bakeFlippedSprite(shipA),
      shipBLeft: bakeFlippedSprite(shipB),
      eliteShipA,
      eliteShipB,
      eliteShipALeft: bakeFlippedSprite(eliteShipA),
      eliteShipBLeft: bakeFlippedSprite(eliteShipB),
    });
  }

  public getFaction(id: FactionId): FactionSprites {
    return this.factions.get(id) ?? this.factions.get(-1)!;
  }
}
