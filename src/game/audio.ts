const MUTE_STORAGE_KEY = 'fath_ghalamro_muted';
const MUSIC_MUTE_STORAGE_KEY = 'fath_ghalamro_music_muted';

// D-minor medieval 16-bit strategy theme (Hz)
const LEAD_NOTES = [
  293.66, 0, 349.23, 392.0, 440.0, 0, 392.0, 349.23,
  329.63, 0, 293.66, 261.63, 293.66, 0, 0, 0,
  440.0, 0, 523.25, 587.33, 523.25, 440.0, 392.0, 0,
  349.23, 392.0, 329.63, 293.66, 293.66, 0, 0, 0,
];

const BASS_NOTES = [
  146.83, 146.83, 0, 146.83, 174.61, 174.61, 0, 174.61,
  130.81, 130.81, 0, 130.81, 146.83, 146.83, 110.0, 130.81,
  174.61, 174.61, 0, 174.61, 196.0, 196.0, 0, 196.0,
  164.81, 164.81, 130.81, 110.0, 146.83, 0, 146.83, 0,
];

const ARP_NOTES = [
  587.33, 440.0, 523.25, 440.0, 698.46, 523.25, 587.33, 523.25,
  659.25, 523.25, 587.33, 440.0, 587.33, 440.0, 349.23, 440.0,
];

/** Procedural Web Audio API sound effects & 16-bit chiptune soundtrack — zero external files */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private muted = false;
  private musicMuted = false;
  private musicRunning = false;
  private musicIntensity: 0 | 1 | 2 = 0;
  private musicStep = 0;
  private musicTimer: number | null = null;

  constructor() {
    try {
      if (typeof window !== 'undefined') {
        this.muted = window.localStorage.getItem(MUTE_STORAGE_KEY) === '1';
        this.musicMuted = window.localStorage.getItem(MUSIC_MUTE_STORAGE_KEY) === '1';
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public isMusicMuted(): boolean {
    return this.musicMuted;
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

  public setMusicMuted(muted: boolean) {
    this.musicMuted = muted;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(muted ? 0 : 0.42, this.ctx.currentTime);
    }
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(MUSIC_MUTE_STORAGE_KEY, muted ? '1' : '0');
      }
    } catch {
      // Ignore storage errors
    }
    if (!muted && this.musicRunning) {
      this.ensureContext();
      this.scheduleMusicLoop();
    }
  }

  public toggleMusic(): boolean {
    this.setMusicMuted(!this.musicMuted);
    return this.musicMuted;
  }

  public setMusicIntensity(level: 0 | 1 | 2) {
    this.musicIntensity = level;
  }

  public startMusic() {
    this.musicRunning = true;
    this.scheduleMusicLoop();
  }

  public stopMusic() {
    this.musicRunning = false;
    if (this.musicTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private scheduleMusicLoop() {
    if (typeof window === 'undefined') return;
    if (this.musicTimer !== null) return;
    this.musicTimer = window.setInterval(() => {
      if (!this.musicRunning || this.muted || this.musicMuted) return;
      this.playMusicBeat();
    }, 215);
  }

  private playMusicBeat() {
    if (!this.ctx || !this.musicGain || this.ctx.state !== 'running') return;

    const step = this.musicStep % LEAD_NOTES.length;
    this.musicStep = (this.musicStep + 1) % LEAD_NOTES.length;

    const now = this.ctx.currentTime;
    const lead = LEAD_NOTES[step];
    const bass = BASS_NOTES[step];
    const arp = ARP_NOTES[step % ARP_NOTES.length];

    if (bass > 0) {
      this.musicTone(bass, 0.16, 'triangle', 0.11, now);
    }
    if (lead > 0 && (this.musicIntensity >= 1 || step % 2 === 0)) {
      this.musicTone(lead, 0.14, 'square', this.musicIntensity === 2 ? 0.055 : 0.04, now);
    }
    if (this.musicIntensity >= 2 && arp > 0) {
      this.musicTone(arp, 0.08, 'square', 0.025, now + 0.02);
    }
  }

  private musicTone(
    freq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    startTime: number
  ) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
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

        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = this.musicMuted ? 0 : 0.42;
        this.musicGain.connect(this.masterGain);
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

  public playNavalLaunch() {
    this.tone(196, 146, 0.18, 'triangle', 0.09, 0);
    this.tone(293, 392, 0.22, 'sine', 0.07, 0.08);
  }

  public playBuild(level = 1) {
    if (level >= 3) {
      this.tone(440, 440, 0.08, 'square', 0.06, 0);
      this.tone(554.37, 554.37, 0.09, 'square', 0.065, 0.065);
      this.tone(659.25, 659.25, 0.1, 'triangle', 0.08, 0.13);
      this.tone(880, 910, 0.26, 'triangle', 0.1, 0.2);
    } else if (level === 2) {
      this.tone(392, 392, 0.08, 'square', 0.06, 0);
      this.tone(493.88, 493.88, 0.09, 'square', 0.06, 0.07);
      this.tone(783.99, 783.99, 0.18, 'triangle', 0.085, 0.14);
    } else {
      this.tone(330, 330, 0.08, 'square', 0.06, 0);
      this.tone(440, 440, 0.09, 'square', 0.06, 0.07);
      this.tone(660, 660, 0.16, 'triangle', 0.08, 0.14);
    }
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
