import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Calendar,
  CloudRain,
  Coins,
  Flower2,
  Palette,
  Pause,
  Play,
  RotateCcw,
  Share2,
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AdBreakOverlay } from './components/AdBreakOverlay';
import { BloomiesCanvas, BloomiesCanvasHandle } from './components/BloomiesCanvas';
import { CollectionBookModal } from './components/CollectionBookModal';
import { EvolutionWheel } from './components/EvolutionWheel';
import { FlowerThumbnail } from './components/FlowerThumbnail';
import { PotSkinsModal } from './components/PotSkinsModal';
import { ShareCardModal } from './components/ShareCardModal';
import { AdBreakPreviewState, portalAds } from './game/ads';
import { getTodayDateKey } from './game/daily';
import { FLOWER_STAGES, POT_SKINS, POWER_UP_META } from './game/flowers';
import { soundEngine } from './game/sound';
import { loadProgress, saveProgress } from './game/storage';
import { GameMode, GameState, HudSnapshot, PlayerProgress, PotSkinId, PowerUpType } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  score: 0,
  combo: 1,
  maxCombo: 1,
  highestStage: 0,
  nextStage: 0,
  queuedStage: 1,
  dangerSeconds: 0,
  isDanger: false,
  dropCount: 0,
  mergesThisRun: 0,
};

export default function App() {
  const canvasRef = useRef<BloomiesCanvasHandle | null>(null);

  const [progress, setProgress] = useState<PlayerProgress>(() => loadProgress());
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [mode, setMode] = useState<GameMode>('classic');
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [activePowerUp, setActivePowerUp] = useState<PowerUpType | null>(null);
  const [usedSecondChance, setUsedSecondChance] = useState(false);
  const [usedDoubleCoins, setUsedDoubleCoins] = useState(false);

  const [showCollection, setShowCollection] = useState(false);
  const [showPots, setShowPots] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [discoveryBanner, setDiscoveryBanner] = useState<number | null>(null);
  const [runCoinsEarned, setRunCoinsEarned] = useState(0);
  const [adPreview, setAdPreview] = useState<AdBreakPreviewState>({
    active: false,
    kind: 'rewarded',
    placementLabel: '',
    secondsLeft: 0,
  });

  const todayKey = useMemo(() => getTodayDateKey(), []);
  const lastHappyComboRef = useRef(0);

  useEffect(() => {
    portalAds.setPreviewListener(setAdPreview);
    portalAds.init();
    return () => portalAds.setPreviewListener(null);
  }, []);

  useEffect(() => {
    soundEngine.setSettings(progress.soundEnabled, progress.hapticsEnabled);
    saveProgress(progress);
  }, [progress]);

  // Signal active gameplay state to Poki / CrazyGames SDKs
  useEffect(() => {
    const isActivelyPlaying =
      gameState === 'PLAYING' && !showCollection && !showPots && !showShare && !adPreview.active;
    if (isActivelyPlaying) {
      portalAds.gameplayStart();
    } else {
      portalAds.gameplayStop();
    }
  }, [gameState, showCollection, showPots, showShare, adPreview.active]);

  // Trigger portal happytime on big combos (x4+)
  useEffect(() => {
    if (hud.combo >= 4 && hud.combo > lastHappyComboRef.current) {
      lastHappyComboRef.current = hud.combo;
      portalAds.happyTime();
    } else if (hud.combo <= 1) {
      lastHappyComboRef.current = 0;
    }
  }, [hud.combo]);

  const activeSkin = useMemo(
    () => POT_SKINS.find((s) => s.id === progress.selectedSkin) || POT_SKINS[0],
    [progress.selectedSkin]
  );

  const startNewRun = useCallback(
    async (targetMode: GameMode, allowInterstitial = false) => {
      if (allowInterstitial && !progress.adsRemoved && progress.gameOversSinceAd >= 3) {
        await portalAds.showInterstitialAd();
        setProgress((prev) => ({ ...prev, gameOversSinceAd: 0 }));
      }
      setMode(targetMode);
      setActivePowerUp(null);
      setUsedSecondChance(false);
      setUsedDoubleCoins(false);
      setRunCoinsEarned(0);
      setDiscoveryBanner(null);
      canvasRef.current?.resetRun(targetMode);
      setGameState('PLAYING');
    },
    [progress.adsRemoved, progress.gameOversSinceAd]
  );

  const handleFlowerDiscovered = useCallback(
    (stage: number, isNewMerge: boolean, coinsEarned: number) => {
      if (coinsEarned > 0) {
        setRunCoinsEarned((prev) => prev + coinsEarned);
      }

      setProgress((prev) => {
        const alreadyUnlocked = prev.unlockedStages.includes(stage);
        const unlockedStages = alreadyUnlocked ? prev.unlockedStages : [...prev.unlockedStages, stage];
        const firstUnlockBonus = !alreadyUnlocked && isNewMerge ? 15 : 0;

        if (!alreadyUnlocked && isNewMerge) {
          setDiscoveryBanner(stage);
          if (stage >= 9) {
            portalAds.happyTime();
          }
          setTimeout(() => {
            setDiscoveryBanner((cur) => (cur === stage ? null : cur));
          }, 3200);
        }

        const nextMergeCounts = { ...prev.stageMergeCounts };
        if (isNewMerge) {
          nextMergeCounts[stage] = (nextMergeCounts[stage] || 0) + 1;
        }

        return {
          ...prev,
          unlockedStages,
          highestStage: Math.max(prev.highestStage, stage),
          totalMerges: prev.totalMerges + (isNewMerge ? 1 : 0),
          coins: prev.coins + coinsEarned + firstUnlockBonus,
          stageMergeCounts: nextMergeCounts,
        };
      });
    },
    []
  );

  const handleGameOver = useCallback(
    (finalHud: HudSnapshot) => {
      setActivePowerUp(null);
      setHud(finalHud);
      setGameState('GAME_OVER');

      const scoreCoins = Math.max(5, Math.floor(finalHud.score / 120));
      setRunCoinsEarned((prev) => prev + scoreCoins);

      setProgress((prev) => {
        const nextDailyBest = { ...prev.dailyBestByDate };
        const nextDailyCompleted = [...prev.dailyCompletedDates];

        if (mode === 'daily') {
          nextDailyBest[todayKey] = Math.max(nextDailyBest[todayKey] || 0, finalHud.score);
          if (!nextDailyCompleted.includes(todayKey)) {
            nextDailyCompleted.push(todayKey);
          }
        }

        return {
          ...prev,
          bestScore: Math.max(prev.bestScore, finalHud.score),
          bestCombo: Math.max(prev.bestCombo, finalHud.maxCombo),
          highestStage: Math.max(prev.highestStage, finalHud.highestStage),
          gamesPlayed: prev.gamesPlayed + 1,
          gameOversSinceAd: prev.gameOversSinceAd + 1,
          coins: prev.coins + scoreCoins,
          dailyBestByDate: nextDailyBest,
          dailyCompletedDates: nextDailyCompleted,
        };
      });
    },
    [mode, todayKey]
  );

  const handleTriggerPowerUp = (type: PowerUpType) => {
    if (gameState !== 'PLAYING') return;
    if (progress.powerUps[type] <= 0) {
      setShowPots(true);
      return;
    }

    if (type === 'rain') {
      const applied = canvasRef.current?.applyRain();
      if (applied) {
        setProgress((prev) => ({
          ...prev,
          powerUps: { ...prev.powerUps, rain: Math.max(0, prev.powerUps.rain - 1) },
        }));
      }
      return;
    }

    setActivePowerUp((cur) => (cur === type ? null : type));
  };

  const handleConsumePowerUp = useCallback((type: PowerUpType) => {
    setActivePowerUp(null);
    setProgress((prev) => ({
      ...prev,
      powerUps: { ...prev.powerUps, [type]: Math.max(0, prev.powerUps[type] - 1) },
    }));
  }, []);

  const handleSecondChance = async () => {
    if (usedSecondChance) return;
    const rewarded = await portalAds.showRewardedAd('second_chance');
    if (!rewarded) return;
    setUsedSecondChance(true);
    canvasRef.current?.grantSecondChance();
    setGameState('PLAYING');
  };

  const handleDoubleCoins = async () => {
    if (usedDoubleCoins || runCoinsEarned <= 0) return;
    const rewarded = await portalAds.showRewardedAd('double_coins');
    if (!rewarded) return;
    setUsedDoubleCoins(true);
    const bonus = runCoinsEarned;
    setProgress((prev) => ({ ...prev, coins: prev.coins + bonus }));
    setRunCoinsEarned((prev) => prev + bonus);
  };

  const handleBuySkin = (skinId: PotSkinId, cost: number) => {
    setProgress((prev) => {
      if (prev.coins < cost || prev.unlockedSkins.includes(skinId)) return prev;
      return {
        ...prev,
        coins: prev.coins - cost,
        unlockedSkins: [...prev.unlockedSkins, skinId],
        selectedSkin: skinId,
      };
    });
  };

  const handleBuyPowerUp = (type: PowerUpType, cost: number) => {
    setProgress((prev) => {
      if (prev.coins < cost) return prev;
      return {
        ...prev,
        coins: prev.coins - cost,
        powerUps: {
          ...prev.powerUps,
          [type]: prev.powerUps[type] + 1,
        },
      };
    });
  };

  const handleClaimGardenGift = async () => {
    const rewarded = await portalAds.showRewardedAd('bonus_coins');
    if (!rewarded) return;
    setProgress((prev) => ({ ...prev, coins: prev.coins + 50 }));
  };

  const dailyBest = progress.dailyBestByDate[todayKey] || 0;
  const currentBest = mode === 'daily' ? Math.max(dailyBest, hud.score) : Math.max(progress.bestScore, hud.score);
  const highestFlowerThisRun = FLOWER_STAGES[hud.highestStage] || FLOWER_STAGES[0];
  const nextFlowerDef = FLOWER_STAGES[hud.queuedStage] || FLOWER_STAGES[0];

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: `linear-gradient(180deg, ${activeSkin.backdropTop} 0%, ${activeSkin.backdropBottom} 100%)`,
      }}
    >
      {/* Top Navigation Bar — 3-Zone Contract */}
      <header className="border-b border-[#4A3550]/10 bg-white/55 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1160px] items-center justify-between gap-8 px-4 py-3 sm:px-6">
          {/* Zone 1: Single Brand Wordmark */}
          <button
            type="button"
            onClick={() => setGameState('TITLE_MENU')}
            className="font-display text-2xl font-extrabold tracking-tight text-[#4A3550] whitespace-nowrap shrink-0"
          >
            Bloomies
          </button>

          {/* Zone 2: Clean single-line navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-[#4A3550]/80">
            <button
              type="button"
              onClick={() => {
                if (gameState === 'TITLE_MENU') startNewRun('classic');
                else if (mode !== 'classic') startNewRun('classic');
              }}
              className={`transition-colors hover:text-[#4A3550] whitespace-nowrap shrink-0 ${
                mode === 'classic' && gameState === 'PLAYING' ? 'text-[#4A3550] underline decoration-[#FF7EB6] decoration-2 underline-offset-4' : ''
              }`}
            >
              Classic Garden
            </button>
            <button
              type="button"
              onClick={() => startNewRun('daily')}
              className={`transition-colors hover:text-[#4A3550] whitespace-nowrap shrink-0 ${
                mode === 'daily' && gameState === 'PLAYING' ? 'text-[#4A3550] underline decoration-[#FF7EB6] decoration-2 underline-offset-4' : ''
              }`}
            >
              Daily Challenge
            </button>
            <button
              type="button"
              onClick={() => setShowCollection(true)}
              className="transition-colors hover:text-[#4A3550] whitespace-nowrap shrink-0"
            >
              Collection Book
            </button>
            <button
              type="button"
              onClick={() => setShowPots(true)}
              className="transition-colors hover:text-[#4A3550] whitespace-nowrap shrink-0"
            >
              Pots & Shop
            </button>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => startNewRun(mode, gameState === 'GAME_OVER')}
              className="rounded-xl bg-[#FF7EB6] px-4 py-2 text-xs font-bold text-[#4A3550] shadow-xs transition-colors hover:bg-[#ff6aa9] whitespace-nowrap shrink-0"
            >
              {gameState === 'TITLE_MENU' ? 'Start Growing' : 'New Garden'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Game Workspace */}
      <main className="mx-auto flex w-full max-w-[1160px] flex-1 flex-col gap-6 px-4 py-4 sm:px-6 lg:flex-row lg:items-start lg:justify-center lg:py-6">
        {/* Left / Center Focal Anchor: Playfield Column */}
        <section className="mx-auto flex w-full max-w-[440px] flex-col items-center">
          {/* Compact Top Play HUD */}
          <div className="mb-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-[#4A3550]/10 bg-white/80 px-4 py-2.5 shadow-xs">
            <div>
              <div className="text-[11px] font-semibold text-[#4A3550]/60">
                {mode === 'daily' ? 'Daily Score' : 'Score'}
              </div>
              <div className="font-mono text-2xl font-bold leading-tight text-[#4A3550] tabular-nums">
                {hud.score.toLocaleString()}
              </div>
            </div>

            <div className="h-8 w-px bg-[#4A3550]/10" />

            <div>
              <div className="text-[11px] font-semibold text-[#4A3550]/60">
                {mode === 'daily' ? 'Daily Best' : 'Best'}
              </div>
              <div className="font-mono text-lg font-bold leading-tight text-[#4A3550]/85 tabular-nums">
                {currentBest.toLocaleString()}
              </div>
            </div>

            <div className="h-8 w-px bg-[#4A3550]/10" />

            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-[11px] font-semibold text-[#4A3550]/60">Next</div>
                <div className="text-xs font-bold text-[#4A3550] whitespace-nowrap">
                  {nextFlowerDef.name}
                </div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF1E6]">
                <FlowerThumbnail stage={hud.queuedStage} size={34} />
              </div>
            </div>
          </div>

          {/* Discovery Toast */}
          {discoveryBanner !== null && (
            <div className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFD93D] px-3 py-1.5 text-xs font-bold text-[#4A3550] shadow-xs">
              <Sparkles className="h-3.5 w-3.5" />
              <span>New Bloom Unlocked: {FLOWER_STAGES[discoveryBanner]?.name} (+15 Coins)</span>
            </div>
          )}

          {/* Physics Canvas + State Overlays */}
          <div className="relative w-full max-w-[420px]">
            <BloomiesCanvas
              ref={canvasRef}
              gameState={gameState}
              mode={mode}
              skin={activeSkin}
              activePowerUp={activePowerUp}
              onCancelPowerUp={() => setActivePowerUp(null)}
              onConsumePowerUp={handleConsumePowerUp}
              onHudUpdate={setHud}
              onFlowerDiscovered={handleFlowerDiscovered}
              onGameOver={handleGameOver}
            />

            {/* Title Menu Overlay */}
            {gameState === 'TITLE_MENU' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-[#FFF8F2]/92 p-6 text-center backdrop-blur-xs">
                <div className="animate-gentle-float mb-3">
                  <FlowerThumbnail stage={10} size={96} />
                </div>
                <h1 className="font-display text-3xl font-extrabold text-[#4A3550]">
                  Grow the Golden Lotus
                </h1>
                <p className="mt-2 max-w-[290px] text-sm leading-relaxed text-[#4A3550]/80">
                  Slide to aim, release to drop. Match twin flowers to evolve through 11 blooms without overflowing the pot for 3 seconds.
                </p>

                <div className="mt-6 flex w-full max-w-[260px] flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => startNewRun('classic')}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FF7EB6] px-5 py-3 text-base font-bold text-[#4A3550] shadow-sm transition-transform hover:scale-[1.01] active:scale-[0.99] whitespace-nowrap"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Play Classic Garden
                  </button>
                  <button
                    type="button"
                    onClick={() => startNewRun('daily')}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#8EC9FF]/45 px-5 py-3 text-sm font-bold text-[#4A3550] transition-colors hover:bg-[#8EC9FF]/65 whitespace-nowrap"
                  >
                    <Calendar className="h-4 w-4" />
                    Daily Garden ({todayKey.slice(5)})
                  </button>
                </div>

                <div className="mt-6 flex items-center gap-4 text-xs font-semibold text-[#4A3550]/70">
                  <button
                    type="button"
                    onClick={() => setShowCollection(true)}
                    className="underline decoration-[#4A3550]/30 underline-offset-4 hover:text-[#4A3550]"
                  >
                    Collection ({progress.unlockedStages.length}/11)
                  </button>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => setShowPots(true)}
                    className="underline decoration-[#4A3550]/30 underline-offset-4 hover:text-[#4A3550]"
                  >
                    Pot Skins
                  </button>
                </div>
              </div>
            )}

            {/* Pause Overlay */}
            {gameState === 'PAUSED' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-[#FFF8F2]/90 p-6 text-center backdrop-blur-xs">
                <h2 className="font-display text-3xl font-extrabold text-[#4A3550]">Garden Paused</h2>
                <p className="mt-1.5 text-sm text-[#4A3550]/75">
                  Take a breath. Your flowers are resting safely.
                </p>
                <div className="mt-6 flex w-full max-w-[230px] flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => setGameState('PLAYING')}
                    className="rounded-2xl bg-[#FF7EB6] px-5 py-3 text-sm font-bold text-[#4A3550] hover:bg-[#ff6aa9]"
                  >
                    Resume Growing
                  </button>
                  <button
                    type="button"
                    onClick={() => startNewRun(mode)}
                    className="rounded-2xl border border-[#4A3550]/15 bg-white px-5 py-2.5 text-sm font-bold text-[#4A3550] hover:bg-[#FFF1E6]"
                  >
                    Restart Garden
                  </button>
                </div>
              </div>
            )}

            {/* Game Over Modal Overlay */}
            {gameState === 'GAME_OVER' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-[#FFF8F2]/95 p-6 text-center backdrop-blur-xs">
                <FlowerThumbnail stage={hud.highestStage} size={82} />
                <h2 className="mt-2 font-display text-2xl font-extrabold text-[#4A3550]">
                  Pot Overflowed!
                </h2>
                <p className="mt-0.5 text-xs font-semibold text-[#4A3550]/70">
                  Highest Bloom: {highestFlowerThisRun.name} · Max Combo: x{hud.maxCombo}
                </p>

                <div className="mt-4 grid w-full max-w-[280px] grid-cols-2 gap-3 rounded-2xl border border-[#4A3550]/10 bg-white p-3.5">
                  <div>
                    <div className="text-[11px] font-semibold text-[#4A3550]/60">Final Score</div>
                    <div className="font-mono text-xl font-bold text-[#4A3550] tabular-nums">
                      {hud.score.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-[#4A3550]/60">Coins Earned</div>
                    <div className="font-mono text-xl font-bold text-[#B87400] tabular-nums">
                      +{runCoinsEarned}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex w-full max-w-[280px] flex-col gap-2">
                  {!usedSecondChance && (
                    <button
                      type="button"
                      onClick={handleSecondChance}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FFD93D] px-4 py-2.5 text-sm font-bold text-[#4A3550] transition-colors hover:bg-[#f5cb1d]"
                    >
                      <Sparkles className="h-4 w-4" />
                      Watch Ad · Second Chance
                    </button>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowShare(true)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#8EC9FF]/45 px-3 py-2.5 text-xs font-bold text-[#4A3550] hover:bg-[#8EC9FF]/65 whitespace-nowrap"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Share Bloom
                    </button>
                    <button
                      type="button"
                      disabled={usedDoubleCoins || runCoinsEarned <= 0}
                      onClick={handleDoubleCoins}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#4A3550]/15 bg-white px-3 py-2.5 text-xs font-bold text-[#4A3550] hover:bg-[#FFF1E6] disabled:opacity-50 whitespace-nowrap"
                    >
                      <Coins className="h-3.5 w-3.5 text-[#D99B00]" />
                      {usedDoubleCoins ? '2x Claimed' : 'Watch Ad · 2x Coins'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => startNewRun(mode, true)}
                    className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FF7EB6] px-5 py-3 text-sm font-bold text-[#4A3550] shadow-xs hover:bg-[#ff6aa9]"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Play Again
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Power-Up Dock & Quick Controls */}
          <div className="mt-3 grid w-full max-w-[420px] grid-cols-3 gap-2.5">
            {(['rain', 'bee', 'sunshine'] as PowerUpType[]).map((key) => {
              const count = progress.powerUps[key];
              const isActive = activePowerUp === key;
              const Icon = key === 'rain' ? CloudRain : key === 'bee' ? Flower2 : Sun;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleTriggerPowerUp(key)}
                  disabled={gameState !== 'PLAYING'}
                  className={`flex min-h-[54px] items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-left transition-all ${
                    isActive
                      ? 'border-[#FF7EB6] bg-[#FFF0F6] shadow-sm'
                      : 'border-[#4A3550]/10 bg-white/85 hover:bg-white'
                  } disabled:opacity-50`}
                  title={POWER_UP_META[key].instruction}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                        key === 'rain'
                          ? 'bg-[#8EC9FF]/35 text-[#256D9E]'
                          : key === 'bee'
                            ? 'bg-[#FFD93D]/45 text-[#8B6200]'
                            : 'bg-[#FF7EB6]/30 text-[#A8205A]'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-[#4A3550]">
                        {POWER_UP_META[key].name}
                      </div>
                      <div className="font-mono text-[11px] font-semibold text-[#4A3550]/65 tabular-nums">
                        {count > 0 ? `${count} left` : `${POWER_UP_META[key].cost}c`}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Mobile Action Bar (for smaller viewports where top nav links hide) */}
          <div className="mt-3 flex w-full max-w-[420px] items-center justify-between gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setShowCollection(true)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#4A3550]/10 bg-white/80 py-2.5 text-xs font-bold text-[#4A3550]"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Book
            </button>
            <button
              type="button"
              onClick={() => setShowPots(true)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#4A3550]/10 bg-white/80 py-2.5 text-xs font-bold text-[#4A3550]"
            >
              <Palette className="h-3.5 w-3.5" />
              Pots ({progress.coins}c)
            </button>
            <button
              type="button"
              onClick={() => startNewRun(mode === 'classic' ? 'daily' : 'classic')}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#4A3550]/10 bg-white/80 py-2.5 text-xs font-bold text-[#4A3550]"
            >
              <Calendar className="h-3.5 w-3.5" />
              {mode === 'daily' ? 'Classic' : 'Daily'}
            </button>
          </div>
        </section>

        {/* Right Column: Garden Studio Companion Panel */}
        <aside className="mx-auto flex w-full max-w-[440px] flex-col gap-4 lg:mx-0 lg:w-[360px]">
          {/* Mode, Coins & Audio Utility Card */}
          <div className="rounded-3xl border border-[#4A3550]/10 bg-white/75 p-5 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold text-[#4A3550]">
                  {mode === 'daily' ? 'Daily Garden' : 'Classic Garden'}
                </h2>
                <p className="text-xs text-[#4A3550]/70">
                  {mode === 'daily'
                    ? `Same seed sequence for everyone · ${todayKey}`
                    : `Active pot: ${activeSkin.name}`}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {gameState === 'PLAYING' && (
                  <button
                    type="button"
                    onClick={() => setGameState('PAUSED')}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#4A3550]/10 bg-white text-[#4A3550] hover:bg-[#FFF1E6]"
                    aria-label="Pause game"
                  >
                    <Pause className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setProgress((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }))
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#4A3550]/10 bg-white text-[#4A3550] hover:bg-[#FFF1E6]"
                  aria-label={progress.soundEnabled ? 'Mute sound' : 'Enable sound'}
                >
                  {progress.soundEnabled ? (
                    <Volume2 className="h-4 w-4" />
                  ) : (
                    <VolumeX className="h-4 w-4 text-[#4A3550]/45" />
                  )}
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#4A3550]/10 pt-4 text-center">
              <div>
                <div className="text-[11px] font-semibold text-[#4A3550]/60">Coins</div>
                <div className="font-mono text-base font-bold text-[#B87400] tabular-nums">
                  {progress.coins.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-[#4A3550]/60">Unlocked</div>
                <div className="font-mono text-base font-bold text-[#4A3550] tabular-nums">
                  {progress.unlockedStages.length}/11
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-[#4A3550]/60">Best Combo</div>
                <div className="font-mono text-base font-bold text-[#D6286B] tabular-nums">
                  x{Math.max(progress.bestCombo, hud.maxCombo)}
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowShare(true)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#8EC9FF]/35 px-3 py-2 text-xs font-bold text-[#4A3550] transition-colors hover:bg-[#8EC9FF]/55 whitespace-nowrap"
              >
                <Share2 className="h-3.5 w-3.5" />
                Share Best Bloom
              </button>
              <button
                type="button"
                onClick={() => setShowPots(true)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#4A3550]/12 bg-white px-3 py-2 text-xs font-bold text-[#4A3550] transition-colors hover:bg-[#FFF1E6] whitespace-nowrap"
              >
                <Palette className="h-3.5 w-3.5" />
                Change Pot
              </button>
            </div>
          </div>

          {/* 11-Stage Evolution Chain */}
          <EvolutionWheel
            unlockedStages={progress.unlockedStages}
            currentHighestStage={hud.highestStage}
          />
        </aside>
      </main>

      {/* Modals */}
      <CollectionBookModal
        open={showCollection}
        progress={progress}
        onClose={() => setShowCollection(false)}
      />

      <PotSkinsModal
        open={showPots}
        progress={progress}
        onSelectSkin={(skinId) => setProgress((prev) => ({ ...prev, selectedSkin: skinId }))}
        onBuySkin={handleBuySkin}
        onBuyPowerUp={handleBuyPowerUp}
        onClaimGardenGift={handleClaimGardenGift}
        onClose={() => setShowPots(false)}
      />

      <ShareCardModal
        open={showShare}
        score={hud.score > 0 ? hud.score : progress.bestScore}
        bestStage={hud.score > 0 ? hud.highestStage : progress.highestStage}
        maxCombo={hud.score > 0 ? hud.maxCombo : progress.bestCombo}
        mode={mode}
        onClose={() => setShowShare(false)}
      />

      <AdBreakOverlay preview={adPreview} />
    </div>
  );
}
