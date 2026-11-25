const MUTE_STORAGE_KEY = 'fath_ghalamro_muted';

/** Procedural Web Audio API sound effects — zero external files */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;

  constructor() {
    try {
      if (typeof window !== 'undefined') {
        this.muted = window.localStorage.getItem(MUTE_STORAGE_KEY) === '1';
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 1, this.ctx.currentTime);
    }
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
      }
    } catch {
      // Ignore storage errors
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      try {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 1;
        this.masterGain.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      const canActivate =
        typeof navigator === 'undefined' ||
        !('userActivation' in navigator) ||
        navigator.userActivation.isActive;
      if (canActivate) {
        this.ctx.resume().catch(() => {});
      }
    }
    return this.ctx;
  }

  private tone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0
  ) {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    // Skip scheduling while suspended with no active gesture so ?autostart=1 doesn't burst later
    if (ctx.state === 'suspended') {
      const canActivate =
        typeof navigator !== 'undefined' &&
        'userActivation' in navigator &&
        navigator.userActivation.isActive;
      if (!canActivate) return;
    }

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playSelect() {
    const jitter = 0.96 + Math.random() * 0.08;
    this.tone(420 * jitter, 520 * jitter, 0.065, 'triangle', 0.07);
  }

  public playRatioTick(stepIndex: number) {
    const freq = 340 + stepIndex * 70;
    this.tone(freq, freq + 40, 0.045, 'square', 0.038);
  }

  public playRally() {
    this.tone(294, 294, 0.08, 'triangle', 0.08, 0);
    this.tone(392, 440, 0.14, 'triangle', 0.09, 0.07);
    this.tone(587, 587, 0.18, 'square', 0.05, 0.15);
  }

  public playError() {
    this.tone(210, 155, 0.14, 'sawtooth', 0.06);
  }

  public playDispatch() {
    const jitter = 0.94 + Math.random() * 0.12;
    this.tone(175 * jitter, 115 * jitter, 0.09, 'triangle', 0.1);
    this.tone(290 * jitter, 240 * jitter, 0.07, 'sine', 0.06, 0.045);
  }

  public playBuild() {
    this.tone(330, 330, 0.08, 'square', 0.06, 0);
    this.tone(440, 440, 0.09, 'square', 0.06, 0.07);
    this.tone(660, 660, 0.16, 'triangle', 0.08, 0.14);
  }

  public playPower() {
    this.tone(440, 554, 0.09, 'square', 0.06, 0);
    this.tone(554, 659, 0.09, 'square', 0.06, 0.07);
    this.tone(880, 920, 0.22, 'triangle', 0.09, 0.14);
  }

  public playClash() {
    const jitter = 0.9 + Math.random() * 0.2;
    this.tone(140 * jitter, 65, 0.11, 'sawtooth', 0.08);
    this.tone(680 * jitter, 240, 0.07, 'square', 0.035, 0.01);
  }

  public playTowerBlock() {
    this.tone(540, 760, 0.09, 'triangle', 0.065);
  }

  public playCapture(byPlayer: boolean) {
    if (byPlayer) {
      this.tone(262, 262, 0.11, 'triangle', 0.1, 0);
      this.tone(330, 330, 0.11, 'triangle', 0.1, 0.09);
      this.tone(523, 523, 0.24, 'triangle', 0.11, 0.18);
    } else {
      this.tone(220, 145, 0.22, 'sawtooth', 0.07);
    }
  }

  public playVictory() {
    const notes = [392, 494, 587, 784];
    notes.forEach((n, idx) => {
      this.tone(n, n, idx === 3 ? 0.45 : 0.16, 'triangle', 0.1, idx * 0.13);
    });
  }

  public playDefeat() {
    const notes = [294, 262, 220, 175];
    notes.forEach((n, idx) => {
      this.tone(n, n * 0.95, 0.26, 'sawtooth', 0.065, idx * 0.18);
    });
  }
}

export const soundEngine = new SoundEngine();
