import type {
  BiomeConfig,
  BiomeType,
  BuildingConfig,
  BuildingType,
  Difficulty,
  FactionConfig,
  MapPreset,
  PowerConfig,
  PowerType,
} from './types';

export const WORLD_WIDTH = 1080;
export const WORLD_HEIGHT = 720;
/** 3px crisp pixel-art texel grid for authentic retro 16-bit strategy world look */
export const GRID_STEP = 3;
export const TERRITORY_COUNT = 16;

export const SEND_RATIOS = [0.25, 0.5, 0.75, 1.0] as const;

export const NEUTRAL_STYLE = {
  name: 'سرزمین بی‌طرف',
  color: '#8896a8',
  landFill: '#56645a',
  landShade: '#3d4a41',
  borderGlow: '#a8b5c4',
};

export const FACTIONS: readonly FactionConfig[] = [
  {
    id: 0,
    name: 'امپراتوری سرخ (شما)',
    shortName: 'سرخ',
    color: '#e12d39',
    landFill: '#9e262d',
    landShade: '#761b21',
    borderGlow: '#ff7a82',
    bannerLight: '#ffc1c5',
    isPlayer: true,
  },
  {
    id: 1,
    name: 'پادشاهی آبی',
    shortName: 'آبی',
    color: '#2d72e8',
    landFill: '#2452a6',
    landShade: '#193b7a',
    borderGlow: '#73b0ff',
    bannerLight: '#b3d4ff',
    isPlayer: false,
    personality: 'expander',
  },
  {
    id: 2,
    name: 'سپاه سبز',
    shortName: 'سبز',
    color: '#18a363',
    landFill: '#1a7549',
    landShade: '#115232',
    borderGlow: '#52e09b',
    bannerLight: '#a0f5cb',
    isPlayer: false,
    personality: 'fortifier',
  },
  {
    id: 3,
    name: 'دژ طلایی',
    shortName: 'طلایی',
    color: '#eab308',
    landFill: '#a6831c',
    landShade: '#7a5e10',
    borderGlow: '#fde047',
    bannerLight: '#fef08a',
    isPlayer: false,
    personality: 'aggressor',
  },
  {
    id: 4,
    name: 'سرزمین بنفش',
    shortName: 'بنفش',
    color: '#8b46f0',
    landFill: '#6432b3',
    landShade: '#482285',
    borderGlow: '#c094ff',
    bannerLight: '#dec7ff',
    isPlayer: false,
    personality: 'opportunist',
  },
  {
    id: 5,
    name: 'قبیله نارنجی',
    shortName: 'نارنجی',
    color: '#f97316',
    landFill: '#bd4c16',
    landShade: '#8c350c',
    borderGlow: '#ffa563',
    bannerLight: '#ffd1ad',
    isPlayer: false,
    personality: 'balanced',
  },
] as const;

export const BIOMES: Record<BiomeType, BiomeConfig> = {
  plain: {
    type: 'plain',
    name: 'جلگه',
    shortBonus: 'زمین متعادل',
    manpowerGrowthMult: 1.0,
    defenseDamageMult: 1.0,
  },
  fertile: {
    type: 'fertile',
    name: 'دشت حاصلخیز',
    shortBonus: '+۲۵٪ رشد انسانی',
    manpowerGrowthMult: 1.25,
    defenseDamageMult: 1.0,
  },
  forest: {
    type: 'forest',
    name: 'جنگل انبوه',
    shortBonus: '+۱۵٪ دفاع طبیعی',
    manpowerGrowthMult: 1.0,
    defenseDamageMult: 0.85,
  },
  mountain: {
    type: 'mountain',
    name: 'کوهستان',
    shortBonus: '+۲۵٪ دفاع طبیعی',
    manpowerGrowthMult: 0.95,
    defenseDamageMult: 0.75,
  },
};

export const MAX_BUILDING_LEVEL = 3 as const;

export const BUILDINGS: Record<BuildingType, BuildingConfig> = {
  barracks: {
    type: 'barracks',
    name: 'سربازخانه',
    shortEffect: '۲.۵× تبدیل انسانی به نظامی',
    description: 'سرعت آموزش و تبدیل نیروی انسانی به سرباز نظامی را افزایش می‌دهد و با ارتقا به پادگان سنگی و آکادمی سلطنتی تبدیل می‌شود.',
    cost: 25,
    levelCosts: [25, 32, 42],
    levelNames: ['سربازخانه چادری', 'پادگان سنگی', 'آکادمی سلطنتی'],
    levelEffects: [
      '۲.۵× آموزش · بازده ۱.۲۵×',
      '۳.۴× آموزش · بازده ۱.۴×',
      '۴.۵× آموزش · بازده ۱.۶×',
    ],
    hotkey: 'Q',
  },
  tower: {
    type: 'tower',
    name: 'برج دفاعی',
    shortEffect: '۴۰٪ کاهش خسارت مهاجمان',
    description: 'دژ را مستحکم کرده و با ارتقا به دژکوب آهنی و برج جادویی سلطنتی، دفاع قلعه را به‌شدت افزایش می‌دهد.',
    cost: 30,
    levelCosts: [30, 38, 48],
    levelNames: ['برج دیده‌بانی', 'دژکوب آهنی', 'برج جادویی سلطنتی'],
    levelEffects: [
      '۴۰٪ کاهش خسارت مهاجمان',
      '۵۲٪ کاهش خسارت مهاجمان',
      '۶۲٪ کاهش خسارت مهاجمان',
    ],
    hotkey: 'W',
  },
  mine: {
    type: 'mine',
    name: 'معدن و بازار',
    shortEffect: '۲× رشد و سقف نیروی انسانی',
    description: 'سرعت رشد نیروی انسانی و ظرفیت قلعه را بالا می‌برد و با ارتقا به معدن سنگی طلا و خزانه زرین سلطنتی تبدیل می‌شود.',
    cost: 35,
    levelCosts: [35, 42, 52],
    levelNames: ['معدن چوبی', 'معدن سنگی طلا', 'خزانه زرین سلطنتی'],
    levelEffects: [
      '۲× رشد انسانی · سقف ۲۰۰',
      '۲.۶× رشد انسانی · سقف ۲۶۰',
      '۳.۲× رشد انسانی · سقف ۳۳۰',
    ],
    hotkey: 'E',
  },
  forge: {
    type: 'forge',
    name: 'آهنگری نبرد',
    shortEffect: '+۲۵٪ قدرت حمله سربازان',
    description: 'سربازان اعزامی را به سلاح و زره ارتقایافته مجهز می‌کند و با ارتقا به کارگاه فولادسازی و کوره آتشفشانی سلطنتی تبدیل می‌شود.',
    cost: 32,
    levelCosts: [32, 40, 50],
    levelNames: ['کوره آهنگری', 'کارگاه فولادسازی', 'کوره آتشفشانی سلطنتی'],
    levelEffects: [
      '+۲۵٪ قدرت حمله سربازان',
      '+۴۰٪ قدرت حمله سربازان',
      '+۵۵٪ قدرت حمله سربازان',
    ],
    hotkey: 'R',
  },
  port: {
    type: 'port',
    name: 'بندرگاه',
    shortEffect: 'حمله دریایی به تمام سواحل',
    description: 'فقط در قلعه‌های ساحلی ساخته می‌شود؛ با ارتقا به بندر سنگی و بندرگاه سلطنتی، سرعت و قدرت ناوگان جنگی را بالا می‌برد.',
    cost: 28,
    levelCosts: [28, 36, 46],
    levelNames: ['اسکله چوبی', 'بندر سنگی', 'بندرگاه سلطنتی'],
    levelEffects: [
      'حمله دریایی به تمام سواحل',
      '+۲۵٪ سرعت ناوگان دریایی',
      '+۵۰٪ سرعت و +۱۵٪ حمله دریایی',
    ],
    hotkey: 'T',
  },
};

export interface MapPresetConfig {
  id: MapPreset;
  label: string;
  shortTag: string;
  description: string;
}

export const MAP_PRESETS: Record<MapPreset, MapPresetConfig> = {
  continent: {
    id: 'continent',
    label: 'قاره کلاسیک',
    shortTag: 'متعادل',
    description: 'یک قاره پیوسته با نبردهای مرزی تمام‌عیار و سواحل پیرامونی.',
  },
  archipelago: {
    id: 'archipelago',
    label: 'مجمع‌الجزایر',
    shortTag: 'جزیره‌ای + پل',
    description: 'جزیره‌های جدا با پل‌های چوبی استراتژیک — بندرگاه و یورش دریایی سرنوشت‌ساز است.',
  },
  strait: {
    id: 'strait',
    label: 'تنگه مرکزی',
    shortTag: 'گذرگاه خونین',
    description: 'دو قاره شرقی و غربی متصل با یک تنگه باریک و آبراهه‌های مناسب دور زدن دشمن.',
  },
  middle_east: {
    id: 'middle_east',
    label: 'خاورمیانه پیکسلی',
    shortTag: 'خلیج و شبه‌جزیره',
    description: 'چیدمان استراتژیک الهام‌گرفته از خلیج فارس، دریای سرخ و سواحل مدیترانه.',
  },
};

export const COMMANDER_POWERS: Record<PowerType, PowerConfig> = {
  mobilize: {
    type: 'mobilize',
    name: 'بسیج عمومی',
    shortEffect: 'تبدیل آنی ۶۰٪ انسانی به نظامی',
    cooldown: 22,
    duration: 0,
    hotkey: 'Z',
    requiresSelectedOwnCastle: true,
  },
  blitz: {
    type: 'blitz',
    name: 'یورش برق‌آسا',
    shortEffect: '۲× سرعت حرکت سربازان (۶ ثانیه)',
    cooldown: 28,
    duration: 6,
    hotkey: 'X',
    requiresSelectedOwnCastle: false,
  },
  shield: {
    type: 'shield',
    name: 'سپر سلطنتی',
    shortEffect: '۵۰٪ کاهش آسیب قلعه (۸ ثانیه)',
    cooldown: 30,
    duration: 8,
    hotkey: 'C',
    requiresSelectedOwnCastle: true,
  },
};

export interface DifficultyConfig {
  id: Difficulty;
  label: string;
  description: string;
  aiInterval: number;
  aiAttackThreshold: number;
  aiAggressionRatio: number;
  aiGrowthBonus: number;
  playerThreatThreshold: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  normal: {
    id: 'normal',
    label: 'معمولی',
    description: 'رقابت متعادل با هوش مصنوعی تاکتیکی',
    aiInterval: 2.0,
    aiAttackThreshold: 1.05,
    aiAggressionRatio: 0.52,
    aiGrowthBonus: 1.0,
    playerThreatThreshold: 5,
  },
  hard: {
    id: 'hard',
    label: 'سخت',
    description: 'هوش مصنوعی تهاجمی و هماهنگ علیه پیشتازان',
    aiInterval: 1.45,
    aiAttackThreshold: 0.9,
    aiAggressionRatio: 0.58,
    aiGrowthBonus: 1.12,
    playerThreatThreshold: 4,
  },
  master: {
    id: 'master',
    label: 'استاد نبرد',
    description: 'اتحاد بی‌رحم رقبا و سرعت تصمیم‌گیری بالا',
    aiInterval: 1.1,
    aiAttackThreshold: 0.82,
    aiAggressionRatio: 0.64,
    aiGrowthBonus: 1.24,
    playerThreatThreshold: 3,
  },
};

export const PROVINCE_NAMES: readonly string[] = [
  'دژ خورشید',
  'قلعه سنگ‌سیاه',
  'برج بادگیر',
  'دروازه شمال',
  'دشت ارغوان',
  'حصار سیمین',
  'تنگه عقاب',
  'کوهستان مه',
  'بندر زمرد',
  'دژ آهنی',
  'فلات طلایی',
  'قلعه خاکستر',
  'واحه شرقی',
  'سنگلاخ سرخ',
  'پناهگاه کهن',
  'میدان نبرد',
  'تپه دیده‌بان',
  'دژ مرزبان',
];

export const ECONOMY = {
  BASE_MAX_MANPOWER: 100,
  MINE_MAX_MANPOWER: 200,
  MINE_MAX_MANPOWER_LEVELS: [100, 200, 260, 330] as const,
  BASE_MANPOWER_GROWTH: 4.2,
  MINE_MANPOWER_GROWTH: 8.4,
  MINE_MANPOWER_GROWTH_LEVELS: [4.2, 8.4, 10.8, 13.6] as const,
  BASE_CONVERSION_RATE: 1.9,
  BARRACKS_CONVERSION_MULTIPLIER: 2.5,
  BARRACKS_CONVERSION_MULTIPLIERS: [1.0, 2.5, 3.4, 4.5] as const,
  BASE_CONVERSION_YIELD: 0.85,
  BARRACKS_CONVERSION_YIELD: 1.25,
  BARRACKS_CONVERSION_YIELDS: [0.85, 1.25, 1.4, 1.6] as const,
  MIN_MANPOWER_RESERVE: 5,
  TOWER_DAMAGE_MULTIPLIER: 0.6,
  TOWER_DAMAGE_MULTIPLIERS: [1.0, 0.6, 0.48, 0.38] as const,
  SHIELD_DAMAGE_MULTIPLIER: 0.5,
  FORGE_ATTACK_MULTIPLIER: 1.25,
  FORGE_ATTACK_MULTIPLIERS: [1.0, 1.25, 1.4, 1.55] as const,
  PORT_NAVAL_SPEED_MULTIPLIERS: [1.0, 1.0, 1.25, 1.5] as const,
  PORT_NAVAL_ATTACK_MULTIPLIERS: [1.0, 1.0, 1.0, 1.15] as const,
  BLITZ_SPEED_MULTIPLIER: 2.0,
  MOBILIZE_RATIO: 0.6,
  TROOP_SPEED: 132,
  NAVAL_SPEED: 108,
  START_PLAYER_MANPOWER: 32,
  START_PLAYER_MILITARY: 24,
  START_AI_MANPOWER: 28,
  START_AI_MILITARY: 20,
  START_NEUTRAL_MANPOWER: 18,
  START_NEUTRAL_MILITARY: 12,
  AUTO_SUPPLY_INTERVAL: 3.2,
  AUTO_SUPPLY_MIN_MILITARY: 10,
  AUTO_SUPPLY_RATIO: 0.5,
} as const;
