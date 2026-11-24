import { soundEngine } from './sound';

export type PortalPlatform = 'poki' | 'crazygames' | 'standalone';

export type RewardPlacement = 'second_chance' | 'double_coins' | 'bonus_coins';

export interface AdBreakPreviewState {
  active: boolean;
  kind: 'rewarded' | 'interstitial';
  placementLabel: string;
  secondsLeft: number;
}

interface PokiSDKGlobal {
  init: () => Promise<void>;
  gameLoadingFinished: () => void;
  gameplayStart: () => void;
  gameplayStop: () => void;
  happytime: (intensity?: number) => void;
  commercialBreak: (cb?: () => void) => Promise<void>;
  rewardedBreak: (cb?: () => void) => Promise<boolean>;
}

interface CrazyGamesSDKGlobal {
  SDK: {
    init: () => Promise<void>;
    game: {
      sdkGameLoadingStart: () => void;
      sdkGameLoadingStop: () => void;
      gameplayStart: () => void;
      gameplayStop: () => void;
      happytime: () => void;
    };
    ad: {
      requestAd: (
        type: 'midgame' | 'rewarded',
        callbacks: {
          adStarted?: () => void;
          adFinished?: () => void;
          adError?: (error: unknown) => void;
        }
      ) => void;
    };
  };
}

declare global {
  interface Window {
    PokiSDK?: PokiSDKGlobal;
    CrazyGames?: CrazyGamesSDKGlobal;
  }
}

export type PreviewListener = (state: AdBreakPreviewState) => void;

class PortalAdService {
  private platform: PortalPlatform = 'standalone';
  private initialized = false;
  private isPlayingSignalActive = false;
  private previewListener: PreviewListener | null = null;
  private adInFlight = false;

  public detectPortal(): PortalPlatform {
    if (typeof window === 'undefined') return 'standalone';
    if (window.PokiSDK) return 'poki';
    if (window.CrazyGames?.SDK) return 'crazygames';
    return 'standalone';
  }

  public getPlatform(): PortalPlatform {
    return this.platform;
  }

  public setPreviewListener(listener: PreviewListener | null) {
    this.previewListener = listener;
  }

  public async init(): Promise<PortalPlatform> {
    if (this.initialized) return this.platform;
    this.platform = this.detectPortal();

    try {
      if (this.platform === 'poki' && window.PokiSDK) {
        await window.PokiSDK.init();
        window.PokiSDK.gameLoadingFinished();
      } else if (this.platform === 'crazygames' && window.CrazyGames?.SDK) {
        await window.CrazyGames.SDK.init();
        window.CrazyGames.SDK.game.sdkGameLoadingStop();
      }
    } catch {
      // Never block game launch if an ad-blocker or portal script rejects init
    }

    this.initialized = true;
    return this.platform;
  }

  public gameplayStart() {
    if (this.isPlayingSignalActive) return;
    this.isPlayingSignalActive = true;
    try {
      if (this.platform === 'poki') {
        window.PokiSDK?.gameplayStart();
      } else if (this.platform === 'crazygames') {
        window.CrazyGames?.SDK.game.gameplayStart();
      }
    } catch {
      // Ignore portal hook errors
    }
  }

  public gameplayStop() {
    if (!this.isPlayingSignalActive) return;
    this.isPlayingSignalActive = false;
    try {
      if (this.platform === 'poki') {
        window.PokiSDK?.gameplayStop();
      } else if (this.platform === 'crazygames') {
        window.CrazyGames?.SDK.game.gameplayStop();
      }
    } catch {
      // Ignore portal hook errors
    }
  }

  public happyTime() {
    try {
      if (this.platform === 'poki') {
        window.PokiSDK?.happytime(1);
      } else if (this.platform === 'crazygames') {
        window.CrazyGames?.SDK.game.happytime();
      }
    } catch {
      // Ignore portal hook errors
    }
  }

  private runStandalonePreview(
    kind: 'rewarded' | 'interstitial',
    placementLabel: string,
    durationSec: number
  ): Promise<boolean> {
    return new Promise((resolve) => {
      let remaining = durationSec;
      this.previewListener?.({
        active: true,
        kind,
        placementLabel,
        secondsLeft: remaining,
      });

      const interval = window.setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          window.clearInterval(interval);
          this.previewListener?.({
            active: false,
            kind,
            placementLabel,
            secondsLeft: 0,
          });
          resolve(true);
        } else {
          this.previewListener?.({
            active: true,
            kind,
            placementLabel,
            secondsLeft: remaining,
          });
        }
      }, 1000);
    });
  }

  public async showRewardedAd(placement: RewardPlacement): Promise<boolean> {
    if (this.adInFlight) return false;
    this.adInFlight = true;

    const wasPlaying = this.isPlayingSignalActive;
    if (wasPlaying) this.gameplayStop();
    soundEngine.setAdMuted(true);

    const labels: Record<RewardPlacement, string> = {
      second_chance: 'Second Chance — Clear Top Row',
      double_coins: 'Double Coins Bonus',
      bonus_coins: '+50 Blossom Coins',
    };

    let rewarded = false;

    try {
      if (this.platform === 'poki' && window.PokiSDK) {
        rewarded = await window.PokiSDK.rewardedBreak(() => {
          soundEngine.setAdMuted(true);
        });
      } else if (this.platform === 'crazygames' && window.CrazyGames?.SDK) {
        rewarded = await new Promise<boolean>((resolve) => {
          window.CrazyGames!.SDK.ad.requestAd('rewarded', {
            adStarted: () => soundEngine.setAdMuted(true),
            adFinished: () => resolve(true),
            adError: () => resolve(false),
          });
        });
      } else {
        rewarded = await this.runStandalonePreview('rewarded', labels[placement], 3);
      }
    } catch {
      rewarded = false;
    } finally {
      soundEngine.setAdMuted(false);
      this.adInFlight = false;
    }

    return rewarded;
  }

  public async showInterstitialAd(): Promise<void> {
    if (this.adInFlight) return;
    this.adInFlight = true;

    const wasPlaying = this.isPlayingSignalActive;
    if (wasPlaying) this.gameplayStop();
    soundEngine.setAdMuted(true);

    try {
      if (this.platform === 'poki' && window.PokiSDK) {
        await window.PokiSDK.commercialBreak(() => {
          soundEngine.setAdMuted(true);
        });
      } else if (this.platform === 'crazygames' && window.CrazyGames?.SDK) {
        await new Promise<void>((resolve) => {
          window.CrazyGames!.SDK.ad.requestAd('midgame', {
            adStarted: () => soundEngine.setAdMuted(true),
            adFinished: () => resolve(),
            adError: () => resolve(),
          });
        });
      } else {
        await this.runStandalonePreview('interstitial', 'Between-Round Garden Break', 2);
      }
    } catch {
      // Never block restart if an ad fails to fill
    } finally {
      soundEngine.setAdMuted(false);
      this.adInFlight = false;
    }
  }
}

export const portalAds = new PortalAdService();
