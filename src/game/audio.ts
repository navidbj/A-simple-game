import type { MusicSyncState } from './types';

const MUTE_STORAGE_KEY = 'fath_ghalamro_muted';
const MUSIC_MUTE_STORAGE_KEY = 'fath_ghalamro_music_muted';
const VOLUME_STORAGE_KEY = 'fath_ghalamro_volume';

const MUSIC_TRACK_URL = '/assets/audio/arcade-escalation.mp3';
const TRACK_BPM = 144;
const BEAT_DURATION_SEC = 60 / TRACK_BPM;
const BEAT_OFFSET_SEC = 0.31;

// D natural minor scale (Hz) matching Arcade Escalation's harmonic center
const D_MINOR = {
  A2: 110.0,
  D3: 146.83,
  A3: 220.0,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  Bb4: 466.16,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  A5: 880.0,
} as const;

const RATIO_SCALE = [
  D_MINOR.D4,
  D_MINOR.F4,
  D_MINOR.G4,
  D_MINOR.A4,
  D_MINOR.C5,
  D_MINOR.D5,
] as const;

const NEUTRAL_SYNC: MusicSyncState = {
  active: false,
  energy: 0,
  bassEnergy: 0,
  beatPhase: 0,
  beatPulse: 0,
  tempoScale: 1.0,
  troopSpeedScale: 1.0,
};

interface IntensityProfile {
  gain: number;
  cutoffHz: number;
  playbackRate: number;
}

const INTENSITY_PROFILES: Record<0 | 1 | 2, IntensityProfile> = {
  0: { gain: 0.44, cutoffHz: 4800, playbackRate: 0.995 },
  1: { gain: 0.48, cutoffHz: 11500, playbackRate: 1.0 },
  2: { gain: 0.52, cutoffHz: 20000, playbackRate: 1.01 },
};

export interface SyncFilterState {
  smoothedEnergy: number;
  smoothedBass: number;
  prevBassRaw: number;
  bassFluxImpulse: number;
  macroRms: number;
  rmsFloor: number;
  rmsCeil: number;
  smoothedTempoScale: number;
  smoothedTroopScale: number;
}

export function createInitialSyncFilterState(): SyncFilterState {
  return {
    smoothedEnergy: 0,
    smoothedBass: 0,
    prevBassRaw: 0,
    bassFluxImpulse: 0,
    macroRms: 0.115,
    rmsFloor: 0.068,
    rmsCeil: 0.172,
    smoothedTempoScale: 1.0,
    smoothedTroopScale: 1.0,
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Pure hybrid music-sync solver: combines calibrated time-domain linear RMS
 * (for perceptible 0.88x–1.18x section tempo shifts) with 40–180 Hz bass flux
 * and a 144-BPM grid locked to the track's 0.31s downbeat offset (for 0.90x–1.36x
 * rhythmic troop march surges).
 */
export function computeSyncFromSamples(
  timeDomain: Float32Array,
  freqBins: Uint8Array,
  sampleRate: number,
  fftSize: number,
  trackTimeSec: number,
  dt: number,
  prev: SyncFilterState
): { state: SyncFilterState; sync: MusicSyncState } {
  const safeDt = clamp(Number.isFinite(dt) ? dt : 0.016, 0.001, 0.05);
  const safeRate = sampleRate > 0 ? sampleRate : 48000;
  const safeFft = fftSize > 0 ? fftSize : 256;

  // 1. Linear time-domain RMS (avoids dB compression flattening)
  let sumSq = 0;
  for (let i = 0; i < timeDomain.length; i++) {
    const s = timeDomain[i];
    sumSq += s * s;
  }
  const rms = timeDomain.length > 0 ? Math.sqrt(sumSq / timeDomain.length) : 0;

  // 2. Low-frequency bass energy & onset flux (40–180 Hz)
  const binHz = safeRate / safeFft;
  const minBassBin = safeFft >= 1024 ? 1 : 0;
  const startBin = Math.min(
    Math.max(0, freqBins.length - 1),
    Math.max(minBassBin, Math.floor(40 / binHz))
  );
  const endBin = Math.min(freqBins.length, Math.max(startBin + 1, Math.ceil(180 / binHz)));
  let bassSum = 0;
  for (let i = startBin; i < endBin; i++) {
    bassSum += freqBins[i];
  }
  const bassCount = Math.max(1, endBin - startBin);
  const bassRaw = clamp(bassSum / (bassCount * 255), 0, 1);
  const bassFlux = Math.max(0, bassRaw - prev.prevBassRaw);
  const bassDecay = Math.exp(-safeDt * 11);
  const bassFluxImpulse = Math.max(prev.bassFluxImpulse * bassDecay, clamp(bassFlux * 4.5, 0, 1));

  // 3. Calibrated RMS envelope with slow adaptive floor/ceiling
  const rmsFloor =
    rms > 0.015 && rms < prev.rmsFloor
      ? Math.max(0.035, prev.rmsFloor + (rms - prev.rmsFloor) * (1 - Math.exp(-safeDt * 0.6)))
      : Math.max(0.035, prev.rmsFloor + (0.068 - prev.rmsFloor) * (1 - Math.exp(-safeDt * 0.04)));
  const rmsCeil =
    rms > prev.rmsCeil
      ? Math.min(0.32, prev.rmsCeil + (rms - prev.rmsCeil) * (1 - Math.exp(-safeDt * 0.8)))
      : Math.max(rmsFloor + 0.05, prev.rmsCeil + (0.172 - prev.rmsCeil) * (1 - Math.exp(-safeDt * 0.04)));

  const span = Math.max(0.045, rmsCeil - rmsFloor);
  const macroRms = prev.macroRms + (rms - prev.macroRms) * (1 - Math.exp(-safeDt * 1.6));
  const normSection = clamp((macroRms - rmsFloor) / span, 0, 1);
  const rawEnergy = clamp((rms - rmsFloor) / span, 0, 1);

  const energyRate = rawEnergy > prev.smoothedEnergy ? 11 : 3.8;
  const bassRate = bassRaw > prev.smoothedBass ? 14 : 4.5;
  const smoothedEnergy =
    prev.smoothedEnergy + (rawEnergy - prev.smoothedEnergy) * (1 - Math.exp(-safeDt * energyRate));
  const smoothedBass =
    prev.smoothedBass + (bassRaw - prev.smoothedBass) * (1 - Math.exp(-safeDt * bassRate));

  // 4. Downbeat-locked 144 BPM phase (0.31s track downbeat alignment)
  const relTime = (Number.isFinite(trackTimeSec) ? trackTimeSec : 0) - BEAT_OFFSET_SEC;
  const wrappedBeat = ((relTime % BEAT_DURATION_SEC) + BEAT_DURATION_SEC) % BEAT_DURATION_SEC;
  const beatPhase = wrappedBeat / BEAT_DURATION_SEC;
  const beatPulse = Math.pow(clamp(1 - beatPhase * 2.1, 0, 1), 2);

  // 5. Perceptible adaptive simulation tempo (0.88x–1.18x)
  const sectionTempo = 0.88 + normSection * 0.28;
  const beatBreath = (beatPulse - 0.22) * (0.015 + smoothedBass * 0.025);
  const targetTempo = clamp(sectionTempo + beatBreath, 0.88, 1.18);
  const smoothedTempoScale =
    prev.smoothedTempoScale + (targetTempo - prev.smoothedTempoScale) * (1 - Math.exp(-safeDt * 4.2));

  // 6. Lively beat-synced troop & warship march surge (0.90x–1.36x)
  const grooveDrive = clamp(beatPulse * 0.65 + bassFluxImpulse * 0.6, 0, 1);
  const targetTroop = clamp(
    0.9 + normSection * 0.06 + grooveDrive * (0.24 + smoothedBass * 0.16),
    0.9,
    1.36
  );
  const troopRate = targetTroop > prev.smoothedTroopScale ? 18 : 6.5;
  const smoothedTroopScale =
    prev.smoothedTroopScale + (targetTroop - prev.smoothedTroopScale) * (1 - Math.exp(-safeDt * troopRate));

  const nextState: SyncFilterState = {
    smoothedEnergy,
    smoothedBass,
    prevBassRaw: bassRaw,
    bassFluxImpulse,
    macroRms,
    rmsFloor,
    rmsCeil,
    smoothedTempoScale,
    smoothedTroopScale,
  };

  return {
    state: nextState,
    sync: {
      active: true,
      energy: smoothedEnergy,
      bassEnergy: smoothedBass,
      beatPhase,
      beatPulse,
      tempoScale: smoothedTempoScale,
      troopSpeedScale: smoothedTroopScale,
    },
  };
}

/** Web Audio API D-minor harmonized SFX + reactive MP3 music engine (zero ducking) */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private musicAnalyser: AnalyserNode | null = null;
  private musicSource: MediaElementAudioSourceNode | null = null;
  private musicEl: HTMLAudioElement | null = null;
  private freqData: Uint8Array<ArrayBuffer> | null = null;
  private timeData: Float32Array<ArrayBuffer> | null = null;
  private unlockListenerAttached = false;

  private muted = false;
  private musicMuted = false;
  private masterVolume = 1;
  private lastNonZeroVolume = 1;
  private musicRunning = false;
  private musicPaused = false;
  private musicIntensity: 0 | 1 | 2 = 0;
  private musicGen = 0;
  private stopTimer: number | null = null;
  private syncState: SyncFilterState = createInitialSyncFilterState();
  private readonly syncOutput: MusicSyncState = {
    active: false,
    energy: 0,
    bassEnergy: 0,
    beatPhase: 0,
    beatPulse: 0,
    tempoScale: 1.0,
    troopSpeedScale: 1.0,
  };

  constructor() {
    try {
      if (typeof window !== 'undefined') {
        this.muted = window.localStorage.getItem(MUTE_STORAGE_KEY) === '1';
        this.musicMuted = window.localStorage.getItem(MUSIC_MUTE_STORAGE_KEY) === '1';
        const rawVol = window.localStorage.getItem(VOLUME_STORAGE_KEY);
        const parsedVol = Number(rawVol);
        if (rawVol !== null && !Number.isNaN(parsedVol)) {
          this.masterVolume = Math.max(0, Math.min(1, parsedVol));
          if (this.masterVolume > 0.001) {
            this.lastNonZeroVolume = this.masterVolume;
          }
        }
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

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  public setMasterVolume(volume: number) {
    const clamped = Math.max(0, Math.min(1, volume));
    this.masterVolume = clamped;
    if (clamped > 0.001) {
      this.lastNonZeroVolume = clamped;
    }
    this.muted = clamped <= 0.001;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.muted ? 0 : this.masterVolume,
        this.ctx.currentTime,
        0.03
      );
    }
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(VOLUME_STORAGE_KEY, String(clamped));
        window.localStorage.setItem(MUTE_STORAGE_KEY, this.muted ? '1' : '0');
      }
    } catch {
      // Ignore storage errors
    }
    if (this.muted) {
      this.setMuted(true);
    } else if (this.musicRunning && !this.musicMuted) {
      this.setMuted(false);
    }
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (!muted && this.masterVolume <= 0.001) {
      this.masterVolume = this.lastNonZeroVolume > 0.001 ? this.lastNonZeroVolume : 1;
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(VOLUME_STORAGE_KEY, String(this.masterVolume));
        }
      } catch {
        // Ignore storage errors
      }
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        muted ? 0 : this.masterVolume,
        this.ctx.currentTime,
        0.03
      );
    }
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
      }
    } catch {
      // Ignore storage errors
    }
    if (muted) {
      if (this.musicEl && !this.musicEl.paused) {
        this.musicEl.pause();
      }
    } else if (this.musicRunning && !this.musicMuted) {
      this.ensureMusicPipeline();
      this.applyMusicMix(0.25);
      this.tryPlayAudio();
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public setMusicMuted(muted: boolean) {
    this.musicMuted = muted;
    if (this.musicGain && this.ctx) {
      const target = muted || !this.musicRunning ? 0 : this.getTargetMusicGain();
      this.musicGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.06);
    }
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(MUSIC_MUTE_STORAGE_KEY, muted ? '1' : '0');
      }
    } catch {
      // Ignore storage errors
    }
    if (muted) {
      if (this.musicEl && !this.musicEl.paused) {
        this.musicEl.pause();
      }
    } else if (this.musicRunning && !this.muted) {
      this.ensureMusicPipeline();
      this.applyMusicMix(0.25);
      this.tryPlayAudio();
    }
  }

  public toggleMusic(): boolean {
    this.setMusicMuted(!this.musicMuted);
    return this.musicMuted;
  }

  public setMusicIntensity(level: 0 | 1 | 2) {
    if (this.musicIntensity === level) return;
    this.musicIntensity = level;
    this.applyMusicMix(0.28);
  }

  public setMusicPaused(paused: boolean) {
    if (this.musicPaused === paused) return;
    this.musicPaused = paused;
    this.applyMusicMix(0.18);
  }

  public startMusic() {
    this.musicGen += 1;
    if (this.stopTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }

    this.musicRunning = true;
    this.musicPaused = false;
    if (this.muted || this.musicMuted) return;

    this.ensureMusicPipeline();
    if (this.musicGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setValueAtTime(Math.max(0.001, this.musicGain.gain.value), now);
    }
    this.applyMusicMix(0.45);
    this.tryPlayAudio();
  }

  public stopMusic() {
    this.musicGen += 1;
    const gen = this.musicGen;
    this.musicRunning = false;
    this.musicPaused = false;

    if (this.stopTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }

    if (this.musicGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setTargetAtTime(0, now, 0.12);
    }

    if (typeof window !== 'undefined' && this.musicEl) {
      const el = this.musicEl;
      this.stopTimer = window.setTimeout(() => {
        this.stopTimer = null;
        if (this.musicGen !== gen || this.musicRunning) return;
        el.pause();
        try {
          el.currentTime = 0;
        } catch {
          // Ignore seek failures before metadata loads
        }
      }, 420);
    }
  }

  public sampleMusicSync(dt: number): MusicSyncState {
    const safeDt = clamp(Number.isFinite(dt) ? dt : 0.016, 0.001, 0.05);
    const active =
      this.musicRunning &&
      !this.musicPaused &&
      !this.muted &&
      !this.musicMuted &&
      this.musicEl !== null &&
      !this.musicEl.paused &&
      this.ctx !== null &&
      this.ctx.state === 'running';

    if (
      !active ||
      !this.musicAnalyser ||
      !this.freqData ||
      !this.timeData ||
      !this.musicEl ||
      !this.ctx
    ) {
      const relax = 1 - Math.exp(-safeDt * 4.5);
      const s = this.syncState;
      s.smoothedEnergy += (0 - s.smoothedEnergy) * relax;
      s.smoothedBass += (0 - s.smoothedBass) * relax;
      s.bassFluxImpulse *= Math.exp(-safeDt * 11);
      s.macroRms += (0.115 - s.macroRms) * relax;
      s.smoothedTempoScale += (1.0 - s.smoothedTempoScale) * relax;
      s.smoothedTroopScale += (1.0 - s.smoothedTroopScale) * relax;

      if (
        Math.abs(s.smoothedTempoScale - 1.0) < 0.001 &&
        Math.abs(s.smoothedTroopScale - 1.0) < 0.001 &&
        s.smoothedEnergy < 0.005
      ) {
        return NEUTRAL_SYNC;
      }
      this.syncOutput.active = false;
      this.syncOutput.energy = s.smoothedEnergy;
      this.syncOutput.bassEnergy = s.smoothedBass;
      this.syncOutput.beatPhase = 0;
      this.syncOutput.beatPulse = 0;
      this.syncOutput.tempoScale = s.smoothedTempoScale;
      this.syncOutput.troopSpeedScale = s.smoothedTroopScale;
      return this.syncOutput;
    }

    this.musicAnalyser.getFloatTimeDomainData(this.timeData);
    this.musicAnalyser.getByteFrequencyData(this.freqData);

    const { state, sync } = computeSyncFromSamples(
      this.timeData,
      this.freqData,
      this.ctx.sampleRate,
      this.musicAnalyser.fftSize,
      this.musicEl.currentTime || 0,
      safeDt,
      this.syncState
    );
    this.syncState = state;
    return sync;
  }

  private getTargetMusicGain(): number {
    if (this.muted || this.musicMuted || !this.musicRunning) return 0;
    if (this.musicPaused) return 0.16;
    return INTENSITY_PROFILES[this.musicIntensity].gain;
  }

  private applyMusicMix(timeConstant: number) {
    const profile = INTENSITY_PROFILES[this.musicIntensity];
    if (this.musicEl) {
      const targetRate = this.musicPaused ? 0.97 : profile.playbackRate;
      if (Math.abs(this.musicEl.playbackRate - targetRate) > 0.002) {
        this.musicEl.playbackRate = targetRate;
      }
    }
    if (!this.ctx || !this.musicGain || !this.musicFilter) return;
    const now = this.ctx.currentTime;
    const targetGain = this.getTargetMusicGain();
    const targetFreq = this.musicPaused ? 520 : profile.cutoffHz;
    this.musicGain.gain.setTargetAtTime(targetGain, now, timeConstant);
    this.musicFilter.frequency.setTargetAtTime(targetFreq, now, timeConstant);
  }

  private attachGestureUnlock() {
    if (this.unlockListenerAttached || typeof window === 'undefined') return;
    this.unlockListenerAttached = true;
    const unlock = () => {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      if (this.musicRunning && !this.muted && !this.musicMuted && this.musicEl?.paused) {
        this.musicEl.play().catch(() => {});
      }
      if (!this.musicEl?.paused || !this.musicRunning) {
        this.unlockListenerAttached = false;
        window.removeEventListener('pointerdown', unlock, true);
        window.removeEventListener('keydown', unlock, true);
      }
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
  }

  private tryPlayAudio() {
    if (!this.musicEl || this.muted || this.musicMuted || !this.musicRunning) return;
    if (this.ctx && this.ctx.state === 'suspended') {
      const canActivate =
        typeof navigator === 'undefined' ||
        !('userActivation' in navigator) ||
        navigator.userActivation.isActive;
      if (canActivate) {
        this.ctx.resume().catch(() => {});
      }
    }
    const playPromise = this.musicEl.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        this.attachGestureUnlock();
      });
    }
  }

  private ensureMusicPipeline() {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    if (!this.musicEl) {
      const el = new Audio(MUSIC_TRACK_URL);
      el.loop = true;
      el.preload = 'auto';
      el.crossOrigin = 'anonymous';
      this.musicEl = el;
    }

    if (!this.musicSource) {
      try {
        this.musicSource = ctx.createMediaElementSource(this.musicEl);
        this.musicFilter = ctx.createBiquadFilter();
        this.musicFilter.type = 'lowpass';
        this.musicFilter.frequency.value = INTENSITY_PROFILES[this.musicIntensity].cutoffHz;
        this.musicFilter.Q.value = 0.7;

        this.musicGain = ctx.createGain();
        this.musicGain.gain.value = 0;

        this.musicAnalyser = ctx.createAnalyser();
        this.musicAnalyser.fftSize = 1024;
        this.musicAnalyser.smoothingTimeConstant = 0.72;
        this.freqData = new Uint8Array(this.musicAnalyser.frequencyBinCount);
        this.timeData = new Float32Array(this.musicAnalyser.fftSize);

        // Tap source pre-filter/pre-gain so RMS calibration stays invariant across intensity & fades
        this.musicSource.connect(this.musicAnalyser);
        this.musicSource.connect(this.musicFilter);
        this.musicFilter.connect(this.musicGain);
        this.musicGain.connect(this.masterGain);
      } catch {
        // Fallback if MediaElementAudioSourceNode is unsupported
      }
    }
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
        this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
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
    if (this.musicRunning && !this.musicMuted && this.musicEl?.paused) {
      this.tryPlayAudio();
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
    gain.gain.linearRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playSelect() {
    this.tone(D_MINOR.D5, D_MINOR.F5, 0.06, 'triangle', 0.08);
  }

  public playRatioTick(stepIndex: number) {
    const freq = RATIO_SCALE[Math.max(0, Math.min(RATIO_SCALE.length - 1, stepIndex))];
    this.tone(freq, freq, 0.045, 'triangle', 0.055);
  }

  public playRally() {
    this.tone(D_MINOR.D4, D_MINOR.D4, 0.075, 'triangle', 0.09, 0);
    this.tone(D_MINOR.F4, D_MINOR.F4, 0.09, 'triangle', 0.09, 0.06);
    this.tone(D_MINOR.A4, D_MINOR.D5, 0.16, 'triangle', 0.095, 0.12);
  }

  public playError() {
    this.tone(D_MINOR.F4, D_MINOR.D4, 0.13, 'sawtooth', 0.055);
  }

  public playDispatch() {
    this.tone(D_MINOR.D3, D_MINOR.A2, 0.09, 'triangle', 0.11);
    this.tone(D_MINOR.D4, D_MINOR.F4, 0.065, 'triangle', 0.065, 0.03);
  }

  public playNavalLaunch() {
    this.tone(D_MINOR.A3, D_MINOR.D3, 0.16, 'triangle', 0.1, 0);
    this.tone(D_MINOR.D4, D_MINOR.A4, 0.2, 'sine', 0.08, 0.07);
  }

  public playBuild(level = 1) {
    if (level >= 3) {
      this.tone(D_MINOR.D4, D_MINOR.D4, 0.075, 'triangle', 0.08, 0);
      this.tone(D_MINOR.F4, D_MINOR.F4, 0.08, 'triangle', 0.085, 0.06);
      this.tone(D_MINOR.A4, D_MINOR.A4, 0.09, 'triangle', 0.09, 0.12);
      this.tone(D_MINOR.D5, D_MINOR.A5, 0.22, 'triangle', 0.1, 0.18);
    } else if (level === 2) {
      this.tone(D_MINOR.F4, D_MINOR.F4, 0.075, 'triangle', 0.075, 0);
      this.tone(D_MINOR.A4, D_MINOR.A4, 0.085, 'triangle', 0.08, 0.065);
      this.tone(D_MINOR.D5, D_MINOR.D5, 0.16, 'triangle', 0.09, 0.13);
    } else {
      this.tone(D_MINOR.D4, D_MINOR.D4, 0.075, 'triangle', 0.075, 0);
      this.tone(D_MINOR.F4, D_MINOR.F4, 0.085, 'triangle', 0.08, 0.065);
      this.tone(D_MINOR.A4, D_MINOR.A4, 0.15, 'triangle', 0.085, 0.13);
    }
  }

  public playPower() {
    this.tone(D_MINOR.A4, D_MINOR.A4, 0.08, 'triangle', 0.085, 0);
    this.tone(D_MINOR.C5, D_MINOR.C5, 0.08, 'triangle', 0.085, 0.065);
    this.tone(D_MINOR.D5, D_MINOR.F5, 0.2, 'triangle', 0.1, 0.13);
  }

  public playClash() {
    this.tone(D_MINOR.D3, D_MINOR.A2, 0.1, 'sawtooth', 0.07);
    this.tone(D_MINOR.A5, D_MINOR.D5, 0.065, 'triangle', 0.055, 0.01);
  }

  public playTowerBlock() {
    this.tone(D_MINOR.A4, D_MINOR.D5, 0.085, 'triangle', 0.075);
  }

  public playCapture(byPlayer: boolean) {
    if (byPlayer) {
      this.tone(D_MINOR.D4, D_MINOR.D4, 0.09, 'triangle', 0.1, 0);
      this.tone(D_MINOR.F4, D_MINOR.F4, 0.09, 'triangle', 0.1, 0.075);
      this.tone(D_MINOR.A4, D_MINOR.A4, 0.1, 'triangle', 0.105, 0.15);
      this.tone(D_MINOR.D5, D_MINOR.D5, 0.24, 'triangle', 0.115, 0.225);
    } else {
      this.tone(D_MINOR.F4, D_MINOR.D4, 0.2, 'sawtooth', 0.065);
    }
  }

  public playVictory() {
    const notes = [D_MINOR.D4, D_MINOR.F4, D_MINOR.A4, D_MINOR.D5, D_MINOR.F5];
    notes.forEach((n, idx) => {
      this.tone(n, n, idx === 4 ? 0.42 : 0.14, 'triangle', 0.105, idx * 0.11);
    });
  }

  public playDefeat() {
    const notes = [D_MINOR.F4, D_MINOR.E4, D_MINOR.D4, D_MINOR.A3];
    notes.forEach((n, idx) => {
      this.tone(n, n * 0.96, 0.24, 'sawtooth', 0.065, idx * 0.16);
    });
  }
}

export const soundEngine = new SoundEngine();
