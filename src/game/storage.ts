import { PlayerProgress } from './types';

const STORAGE_KEY = 'bloomies_garden_progress_v1';

export const DEFAULT_PROGRESS: PlayerProgress = {
  bestScore: 0,
  bestCombo: 1,
  highestStage: 0,
  totalMerges: 0,
  gamesPlayed: 0,
  coins: 100,
  powerUps: {
    rain: 2,
    bee: 2,
    sunshine: 2,
  },
  unlockedStages: [0, 1, 2],
  stageMergeCounts: {},
  unlockedSkins: ['terracotta'],
  selectedSkin: 'terracotta',
  dailyBestByDate: {},
  dailyCompletedDates: [],
  soundEnabled: true,
  hapticsEnabled: true,
  adsRemoved: false,
  gameOversSinceAd: 0,
};

export function loadProgress(): PlayerProgress {
  if (typeof window === 'undefined') return DEFAULT_PROGRESS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<PlayerProgress>;
    return {
      ...DEFAULT_PROGRESS,
      ...parsed,
      powerUps: {
        ...DEFAULT_PROGRESS.powerUps,
        ...(parsed.powerUps || {}),
      },
      unlockedStages: Array.isArray(parsed.unlockedStages)
        ? Array.from(new Set([...DEFAULT_PROGRESS.unlockedStages, ...parsed.unlockedStages]))
        : DEFAULT_PROGRESS.unlockedStages,
      unlockedSkins: Array.isArray(parsed.unlockedSkins) && parsed.unlockedSkins.length > 0
        ? parsed.unlockedSkins
        : DEFAULT_PROGRESS.unlockedSkins,
      stageMergeCounts: parsed.stageMergeCounts || {},
      dailyBestByDate: parsed.dailyBestByDate || {},
      dailyCompletedDates: parsed.dailyCompletedDates || [],
    };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

export function saveProgress(progress: PlayerProgress): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage quota errors cleanly
  }
}
