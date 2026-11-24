class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private adMuted = false;
  private hapticsEnabled = true;

  public setSettings(soundEnabled: boolean, hapticsEnabled: boolean) {
    this.enabled = soundEnabled;
    this.hapticsEnabled = hapticsEnabled;
  }

  public setAdMuted(muted: boolean) {
    this.adMuted = muted;
    if (this.ctx) {
      if (muted && this.ctx.state === 'running') {
        this.ctx.suspend().catch(() => {});
      } else if (!muted && this.enabled && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }
  }

  private ensureContext(): AudioContext | null {
    if (!this.enabled || this.adMuted) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public vibrate(ms: number | number[]) {
    if (!this.hapticsEnabled) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(ms);
      } catch {
        // Ignore unsupported vibration environments
      }
    }
  }

  public playDrop() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.09);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playMerge(stage: number, combo: number) {
    this.vibrate(combo >= 3 ? [14, 24, 18] : 12);
    const ctx = this.ensureContext();
    if (!ctx) return;

    // Warm pentatonic frequencies ascending with stage and combo
    const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const baseFreq = scale[Math.min(stage, scale.length - 1)] * (1 + Math.min(combo - 1, 5) * 0.045);

    const now = ctx.currentTime;

    // Soft squishy pop fundamental
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(baseFreq * 0.8, now);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.25, now + 0.07);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.18);

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.16, now + 0.015);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Harmonic sparkle overtone on combos or higher blooms
    if (combo >= 2 || stage >= 5) {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(baseFreq * 1.5, now + 0.03);
      gain2.gain.setValueAtTime(0.001, now + 0.03);
      gain2.gain.linearRampToValueAtTime(0.09, now + 0.05);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.03);
      osc2.stop(now + 0.32);
    }

    // Golden Lotus celebratory arpeggio
    if (stage === 10) {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        const t = now + idx * 0.075;
        o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.12, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(t);
        o.stop(t + 0.48);
      });
    }
  }

  public playPowerUp(kind: 'rain' | 'bee' | 'sunshine') {
    this.vibrate(15);
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const notes =
      kind === 'rain'
        ? [783.99, 659.25, 587.33, 523.25]
        : kind === 'bee'
          ? [440, 523.25, 440, 587.33]
          : [523.25, 659.25, 783.99];

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = kind === 'bee' ? 'triangle' : 'sine';
      const t = now + idx * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.1, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  }

  public playGameOver() {
    this.vibrate([30, 40, 30]);
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [392.0, 349.23, 329.63, 261.63].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.11;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.11, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  }
}

export const soundEngine = new SoundEngine();
