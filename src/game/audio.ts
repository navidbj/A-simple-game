/**
 * Procedural Web Audio API sound effects & dynamic 16-bit chiptune soundtrack.
 * Zero external audio files; tempo and harmonic density scale smoothly with live battle intensity.
 */

// 32-step D Dorian medieval strategy melody (Hz, 0 = rest)
const MELODY_CALM = [
  293.66, 0, 349.23, 0, 440.0, 0, 392.0, 349.23,
  329.63, 0, 293.66, 0, 261.63, 0, 293.66, 0,
  293.66, 0, 349.23, 440.0, 523.25, 0, 440.0, 392.0,
  349.23, 0, 329.63, 0, 293.66, 0, 0, 0,
];

const MELODY_INTENSE = [
  587.33, 0, 523.25, 587.33, 659.25, 0, 587.33, 523.25,
  440.0, 523.25, 587.33, 0, 523.25, 440.0, 392.0, 0,
  440.0, 0, 523.25, 587.33, 698.46, 0, 659.25, 587.33,
  523.25, 440.0, 493.88, 523.25, 587.33, 0, 440.0, 0,
];

// Warm triangle bassline (32 steps, D minor / Dorian cadence: Dm -> C -> Bb -> A)
const BASS_LINE = [
  146.83, 0, 146.83, 0, 220.0, 0, 146.83, 0,
  130.81, 0, 130.81, 0, 196.0, 0, 130.81, 0,
  116.54, 0, 116.54, 0, 174.61, 0, 116.54, 0,
  110.0, 0, 130.81, 0, 146.83, 0, 110.0, 0,
];

// Subtle 16-bit chord arpeggio notes for skirmish & climax tension
const ARP_CHORDS = [
  [293.66, 349.23, 440.0], // Dm
  [261.63, 329.63, 392.0], // C
  [233.08, 293.66, 349.23], // Bb
  [220.0, 277.18, 329.63], // A
];

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private musicMuted = false;
  private musicActive = false;
  private intensity: 0 | 1 | 2 = 0;
  private musicTimer: number | null = null;
  private nextStepTime = 0;
  private currentStep = 0;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  public isMusicMuted(): boolean {
    return this.musicMuted;
  }

  public toggleMusic(): boolean {
    this.musicMuted = !this.musicMuted;
    if (!this.musicMuted && this.musicActive) {
      this.ensureMusicLoop();
    }
    return this.musicMuted;
  }

  public setMusicState(active: boolean, intensity?: 0 | 1 | 2) {
    this.musicActive = active;
    if (intensity !== undefined) {
      this.intensity = intensity;
    }
    if (active && !this.musicMuted && !this.muted) {
      this.ensureMusicLoop();
    } else if (!active && this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  public setBattleIntensity(intensity: 0 | 1 | 2) {
    this.intensity = intensity;
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
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private ensureMusicLoop() {
    if (typeof window === 'undefined') return;
    if (this.musicTimer !== null) return;

    this.musicTimer = window.setInterval(() => {
      this.scheduleMusicSteps();
    }, 80);
  }

  private scheduleMusicSteps() {
    if (!this.musicActive || this.muted || this.musicMuted) return;
    if (!this.ctx || this.ctx.state !== 'running') return;

    const now = this.ctx.currentTime;
    if (this.nextStepTime < now) {
      this.nextStepTime = now + 0.04;
    }

    // Dynamic BPM: 102 (calm) -> 118 (skirmish) -> 134 (high-tension siege/endgame)
    const bpm = this.intensity === 2 ? 134 : this.intensity === 1 ? 118 : 102;
    const stepDur = 60 / bpm / 2; // 8th-note steps

    while (this.nextStepTime < now + 0.2) {
      const step = this.currentStep % 32;
      const bar = Math.floor(step / 8);
      const t = this.nextStepTime;

      // 1. Warm triangle bassline
      const bassHz = BASS_LINE[step];
      if (bassHz > 0) {
        this.scheduleNote(this.ctx, bassHz, t, stepDur * 0.85, 'triangle', 0.032);
      }

      // 2. Gentle 16-bit lead melody (switches to heroic higher motif at intensity 2)
      const leadArr = this.intensity === 2 ? MELODY_INTENSE : MELODY_CALM;
      const leadHz = leadArr[step];
      if (leadHz > 0) {
        this.scheduleNote(
          this.ctx,
          leadHz,
          t,
          stepDur * (this.intensity === 2 ? 0.72 : 0.82),
          'square',
          this.intensity === 2 ? 0.017 : 0.014
        );
      }

      // 3. Chiptune chord arpeggio pulse when skirmish/siege intensifies
      if (this.intensity >= 1) {
        const chord = ARP_CHORDS[bar % ARP_CHORDS.length];
        const arpHz = chord[step % chord.length];
        if (this.intensity === 2 || step % 2 === 1) {
          this.scheduleNote(this.ctx, arpHz, t, stepDur * 0.45, 'triangle', 0.015);
        }
      }

      // 4. Crisp subtle 16-bit snare/tick pulse on offbeats during high tension
      if (this.intensity === 2 && (step % 4 === 2 || step % 8 === 7)) {
        this.schedulePercTick(this.ctx, t, step % 4 === 2 ? 0.018 : 0.012);
      }

      this.nextStepTime += stepDur;
      this.currentStep = (this.currentStep + 1) % 32;
    }
  }

  private scheduleNote(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType,
    volume: number
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  private schedulePercTick(ctx: AudioContext, startTime: number, volume: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1100, startTime);
    osc.frequency.exponentialRampToValueAtTime(220, startTime + 0.035);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.038);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.045);
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
    if (!ctx) return;
    if (this.musicActive && !this.musicMuted) {
      this.ensureMusicLoop();
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
    gain.connect(ctx.destination);
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

  public playSupplyLink() {
    this.tone(392, 493.88, 0.07, 'triangle', 0.07, 0);
    this.tone(587.33, 659.25, 0.12, 'triangle', 0.08, 0.065);
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
      this.tone(220, 165, 0.16, 'sawtooth', 0.06);
    }
  }

  public playVictory() {
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25];
    notes.forEach((f, idx) => {
      this.tone(f, f, idx === notes.length - 1 ? 0.55 : 0.16, 'triangle', 0.11, idx * 0.11);
    });
  }

  public playDefeat() {
    const notes = [293.66, 261.63, 233.08, 174.61];
    notes.forEach((f, idx) => {
      this.tone(f, f * 0.96, idx === notes.length - 1 ? 0.5 : 0.18, 'sawtooth', 0.075, idx * 0.14);
    });
  }
}

export const soundEngine = new SoundEngine();
