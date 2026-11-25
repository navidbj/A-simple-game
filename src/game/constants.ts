import type {
  BiomeConfig,
  BiomeType,
  BuildingConfig,
  BuildingType,
  Difficulty,
  FactionConfig,
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

export const BUILDINGS: Record<BuildingType, BuildingConfig> = {
  barracks: {
    type: 'barracks',
    name: 'سربازخانه',
    shortEffect: '۲.۵× تبدیل انسانی به نظامی',
    description: 'سرعت آموزش و تبدیل نیروی انسانی به سرباز نظامی را ۲.۵ برابر و بازدهی آن را بیشتر می‌کند.',
    cost: 25,
    hotkey: 'Q',
  },
  tower: {
    type: 'tower',
    name: 'برج دفاعی',
    shortEffect: '۴۰٪ کاهش خسارت مهاجمان',
    description: 'دژ را مستحکم کرده و قدرت تهاجمی نیروهای دشمن را هنگام حمله به این قلعه ۴۰٪ کاهش می‌دهد.',
    cost: 30,
    hotkey: 'W',
  },
  mine: {
    type: 'mine',
    name: 'معدن و بازار',
    shortEffect: '۲× رشد و سقف نیروی انسانی',
    description: 'سرعت رشد نیروی انسانی را ۲ برابر و ظرفیت نهایی آن را از ۱۰۰ به ۲۰۰ افزایش می‌دهد.',
    cost: 35,
    hotkey: 'E',
  },
  forge: {
    type: 'forge',
    name: 'آهنگری نبرد',
    shortEffect: '+۲۵٪ قدرت حمله سربازان',
    description: 'سربازان اعزامی از این قلعه با زره فولادی و ۲۵٪ قدرت تهاجمی بیشتر می‌جنگند.',
    cost: 32,
    hotkey: 'R',
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
  BASE_MANPOWER_GROWTH: 4.2,
  MINE_MANPOWER_GROWTH: 8.4,
  BASE_CONVERSION_RATE: 1.9,
  BARRACKS_CONVERSION_MULTIPLIER: 2.5,
  BASE_CONVERSION_YIELD: 0.85,
  BARRACKS_CONVERSION_YIELD: 1.25,
  MIN_MANPOWER_RESERVE: 5,
  TOWER_DAMAGE_MULTIPLIER: 0.6,
  SHIELD_DAMAGE_MULTIPLIER: 0.5,
  FORGE_ATTACK_MULTIPLIER: 1.25,
  BLITZ_SPEED_MULTIPLIER: 2.0,
  MOBILIZE_RATIO: 0.6,
  TROOP_SPEED: 132,
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
