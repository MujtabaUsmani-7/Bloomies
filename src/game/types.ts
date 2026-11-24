export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type GameMode = 'classic' | 'daily';

export type PowerUpType = 'rain' | 'bee' | 'sunshine';

export type PotSkinId = 'terracotta' | 'glass' | 'golden' | 'rooftop';

export interface FlowerStageDef {
  stage: number;
  id: string;
  name: string;
  subtitle: string;
  radius: number;
  points: number;
  primaryColor: string;
  secondaryColor: string;
  centerColor: string;
  cheekColor: string;
  funFact: string;
  originNote: string;
}

export interface PotSkinDef {
  id: PotSkinId;
  name: string;
  description: string;
  cost: number;
  potColor: string;
  potRimColor: string;
  potShadowColor: string;
  interiorBg: string;
  backdropTop: string;
  backdropBottom: string;
  isGlass?: boolean;
}

export interface PowerUpCounts {
  rain: number;
  bee: number;
  sunshine: number;
}

export interface PlayerProgress {
  bestScore: number;
  bestCombo: number;
  highestStage: number;
  totalMerges: number;
  gamesPlayed: number;
  coins: number;
  powerUps: PowerUpCounts;
  unlockedStages: number[];
  stageMergeCounts: Record<number, number>;
  unlockedSkins: PotSkinId[];
  selectedSkin: PotSkinId;
  dailyBestByDate: Record<string, number>;
  dailyCompletedDates: string[];
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  adsRemoved: boolean;
  gameOversSinceAd: number;
}

export interface HudSnapshot {
  score: number;
  combo: number;
  maxCombo: number;
  highestStage: number;
  nextStage: number;
  queuedStage: number;
  dangerSeconds: number;
  isDanger: boolean;
  dropCount: number;
  mergesThisRun: number;
}
