export type FactionId = -1 | 0 | 1 | 2 | 3 | 4 | 5;

export type BuildingType = 'barracks' | 'tower' | 'mine' | 'forge';

export type BiomeType = 'plain' | 'forest' | 'mountain' | 'fertile';

export type PowerType = 'mobilize' | 'blitz' | 'shield';

export type Difficulty = 'normal' | 'hard' | 'master';

export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type GameOutcome = 'none' | 'victory' | 'defeat';

export type AIPersonality = 'expander' | 'fortifier' | 'aggressor' | 'opportunist' | 'balanced';

export interface FactionConfig {
  id: Exclude<FactionId, -1>;
  name: string;
  shortName: string;
  color: string;
  landFill: string;
  landShade: string;
  borderGlow: string;
  bannerLight: string;
  isPlayer: boolean;
  personality?: AIPersonality;
}

export interface BuildingConfig {
  type: BuildingType;
  name: string;
  shortEffect: string;
  description: string;
  cost: number;
  hotkey: string;
}

export interface BiomeConfig {
  type: BiomeType;
  name: string;
  shortBonus: string;
  manpowerGrowthMult: number;
  defenseDamageMult: number;
}

export interface PowerConfig {
  type: PowerType;
  name: string;
  shortEffect: string;
  cooldown: number;
  duration: number;
  hotkey: string;
  requiresSelectedOwnCastle: boolean;
}

export interface MapProp {
  kind: 'tree' | 'pine' | 'mountain' | 'wheat' | 'flower';
  x: number;
  y: number;
  variant: number;
  territoryId: number;
}

export interface Territory {
  id: number;
  name: string;
  biome: BiomeType;
  x: number;
  y: number;
  owner: FactionId;
  manpower: number;
  military: number;
  hasBarracks: boolean;
  hasTower: boolean;
  hasMine: boolean;
  hasForge: boolean;
  neighbors: number[];
  borderCrossings: Record<number, { x: number; y: number }>;
  hitFlash: number;
  capturePulse: number;
  towerFireTimer: number;
  shieldTimer: number;
}

export interface TroopGroup {
  id: number;
  fromId: number;
  toId: number;
  startX: number;
  startY: number;
  viaX: number;
  viaY: number;
  targetX: number;
  targetY: number;
  x: number;
  y: number;
  facingLeft: boolean;
  progress: number;
  speed: number;
  count: number;
  owner: Exclude<FactionId, -1>;
  attackMultiplier: number;
  isElite: boolean;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
}

export interface FloatingText {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
}

export interface MapGridData {
  width: number;
  height: number;
  step: number;
  cols: number;
  rows: number;
  /** -1 = ocean water, 0..N-1 = territory id */
  cells: Int16Array;
  /** Elevation / coastal distance value 0..255 for pixel cartography */
  elevation: Uint8Array;
  /** Procedural pixel biome props (trees, peaks, wheat fields) */
  props: MapProp[];
  seed: number;
}

export interface SimEvent {
  type:
    | 'dispatch'
    | 'build'
    | 'power'
    | 'reinforce'
    | 'clash'
    | 'capture'
    | 'tower_block'
    | 'victory'
    | 'defeat';
  x: number;
  y: number;
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  owner: FactionId;
  amount?: number;
  isElite?: boolean;
  building?: BuildingType;
  power?: PowerType;
  capturedByPlayer?: boolean;
}

export interface MatchStats {
  elapsedSeconds: number;
  territoriesCaptured: number;
  buildingsConstructed: number;
  battlesWon: number;
  troopsDispatched: number;
}

export interface CommanderPowersState {
  cooldowns: Record<PowerType, number>;
  blitzTimer: number;
}

export interface DragAimState {
  active: boolean;
  originId: number;
  currentX: number;
  currentY: number;
  hoverTargetId: number | null;
  isValidTarget: boolean;
  isFriendlyTarget: boolean;
}

export interface GameSimulation {
  seed: number;
  difficulty: Difficulty;
  map: MapGridData;
  territories: Territory[];
  troops: TroopGroup[];
  nextTroopId: number;
  aiTimer: number;
  outcome: GameOutcome;
  stats: MatchStats;
  powers: CommanderPowersState;
  mapDirty: boolean;
  hitstopTimer: number;
  shakeTrauma: number;
}

export interface FactionPowerEntry {
  id: Exclude<FactionId, -1>;
  name: string;
  color: string;
  territories: number;
  totalMilitary: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  outcome: GameOutcome;
  difficulty: Difficulty;
  sendRatio: number;
  selectedId: number | null;
  selectedTerritory: {
    id: number;
    name: string;
    biome: BiomeType;
    owner: FactionId;
    manpower: number;
    maxManpower: number;
    military: number;
    manpowerRate: number;
    conversionRate: number;
    hasBarracks: boolean;
    hasTower: boolean;
    hasMine: boolean;
    hasForge: boolean;
    shieldTimer: number;
    neighborCount: number;
  } | null;
  powers: {
    cooldowns: Record<PowerType, number>;
    blitzTimer: number;
  };
  playerTerritories: number;
  totalTerritories: number;
  playerMilitary: number;
  playerManpower: number;
  elapsedSeconds: number;
  factionPowers: FactionPowerEntry[];
  stats: MatchStats;
  mapSeed: number;
}
