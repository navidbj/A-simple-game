# Music Sync v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace volume ducking with D-minor harmonized SFX, drive a perceptible adaptive game speed (`0.88×`–`1.18×`) plus beat-locked troop march surge (`0.90×`–`1.36×`) from real linear RMS and 40–180 Hz bass flux, and reflect the groove visually in castle borders, marches, and water.

**Architecture:** `SoundEngine` in `src/game/audio.ts` samples time-domain linear RMS and low-frequency bass flux locked to `Arcade Escalation` (`144 BPM`, `0.31s` downbeat offset) to emit `MusicSyncState`. `stepSimulation` gains an optional `troopSpeedScale` argument for rhythmic troop/warship movement independent of economy/cooldowns, while `useGameController.ts` and `GameRenderer` wire both multipliers into simulation and pixel-art animations.

**Tech Stack:** TypeScript, React 19, HTML5 Canvas 2D, Web Audio API (`AnalyserNode`, `BiquadFilterNode`, `GainNode`), Node `node:test` + `tsx`, Vite 8.

**Spec:** [2026-11-26-music-sync-v2-design.md](../../specs/2026-11-26-music-sync-v2-design.md)

## Global Constraints
- `stepSimulation` keeps full backwards-compatibility with existing callers and tests (`troopSpeedScale` defaults to `1.0`).
- `tempoScale` stays bounded within `[0.88, 1.18]`; `troopSpeedScale` stays bounded within `[0.90, 1.36]`.
- Zero audio volume ducking (`duckMusic` removed); SFX frequencies align to D natural minor (`D, E, F, G, A, Bb, C`).
- Audio/DOM access must be guarded for headless Node (`typeof window === 'undefined'`).
- Visual beat accents remain subtle pixel-art pulses without full-screen flashing.

## Review Focus
- `sampleMusicSync(dt)` called in Node/SSR without DOM or when muted/paused -> must return neutral `tempoScale = 1.0`, `troopSpeedScale = 1.0` without throwing.
- `sampleMusicSync(dt)` given `dt <= 0` or `dt > 0.1` (tab-switch spike) -> must clamp `dt` and never emit `NaN` or out-of-range multipliers.
- `stepSimulation(..., speedMultiplier, troopSpeedScale)` with extreme `troopSpeedScale` (`0.1` or `5.0`) -> must clamp safely and never accelerate economy/cooldown timers.
- Rapid pause/unpause or mute/unmute transitions -> must keep `tempoScale` / `troopSpeedScale` smoothly relaxing toward `1.0` without stuck audio playback.
- Existing `GameRenderer.render(...)` calls omitting `musicSync` -> must continue working via `NEUTRAL_MUSIC_SYNC` default.

---

### Task 1: Simulation `troopSpeedScale` & `MusicSyncState` Contract

**Files:**
- Modify: `src/game/types.ts:285-296`
- Modify: `src/game/simulation.ts:1118-1215`
- Test: `src/game/simulation.test.ts`

**Interfaces:**
- Produces:
  - `MusicSyncState` in `src/game/types.ts` with `troopSpeedScale: number` alongside `active`, `energy`, `bassEnergy`, `beatPhase`, `beatPulse`, `tempoScale`.
  - `stepSimulation(sim: GameSimulation, rawDt: number, demoMode?: boolean, speedMultiplier?: number, troopSpeedScale?: number): SimEvent[]`.

- [ ] **Step 1: Write the failing test in `src/game/simulation.test.ts`**

Add a test verifying that passing `troopSpeedScale = 1.35` accelerates marching troops without changing `sim.stats.elapsedSeconds` or territory manpower/military growth compared to `troopSpeedScale = 1.0`, and clamps extreme inputs safely (`0.1` -> clamped `>= 0.7`, `5.0` -> clamped `<= 1.6`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd tsx --test src/game/simulation.test.ts`
Expected: FAIL because `stepSimulation` ignores the 5th argument (`troopSpeedScale`).

- [ ] **Step 3: Implement `troopSpeedScale` in `src/game/types.ts` and `src/game/simulation.ts`**

Add `troopSpeedScale: number` to `MusicSyncState` in `src/game/types.ts`, and update `stepSimulation` in `src/game/simulation.ts` to accept `troopSpeedScale = 1.0`, clamp it to `[0.7, 1.6]`, and multiply it into troop `stepProgress` only.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx.cmd tsx --test src/game/simulation.test.ts`
Expected: PASS (all simulation tests including the new `troopSpeedScale` test).

---

### Task 2: Hybrid RMS + Bass-Flux Engine & D-Minor SFX in `SoundEngine`

**Files:**
- Modify: `src/game/audio.ts`
- Test: `src/game/audio.test.ts` (Create)

**Interfaces:**
- Consumes: `MusicSyncState` from `src/game/types.ts`.
- Produces:
  - Pure helper `computeSyncFromSamples(timeDomain: Float32Array, freqBins: Uint8Array, sampleRate: number, fftSize: number, trackTimeSec: number, dt: number, state: SyncFilterState): { state: SyncFilterState; sync: MusicSyncState }` (testable in Node without Web Audio DOM!).
  - `soundEngine.sampleMusicSync(dt: number): MusicSyncState` returning `tempoScale` in `[0.88, 1.18]` and `troopSpeedScale` in `[0.90, 1.36]`.
  - D-minor tuned SFX methods with zero `duckMusic`.

- [ ] **Step 1: Write the failing test in `src/game/audio.test.ts`**

Test:
1. `soundEngine.sampleMusicSync(0.016)` and `soundEngine.sampleMusicSync(5.0)` in Node (no `window`) return `tempoScale === 1.0`, `troopSpeedScale === 1.0`, and finite numbers.
2. `computeSyncFromSamples` driven with quiet RMS (`0.068`) settles `tempoScale` near `0.88–0.94`; driven with drop RMS (`0.175`) + strong `40–180 Hz` bass jump settles `tempoScale` near `1.10–1.18` and spikes `troopSpeedScale` above `1.20` while clamping within `[0.90, 1.36]`.
3. `computeSyncFromSamples` aligns `beatPulse` peak to `trackTimeSec = 0.31` (`144 BPM` downbeat offset) rather than `0.0`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd tsx --test src/game/audio.test.ts`
Expected: FAIL (`computeSyncFromSamples` not exported / `troopSpeedScale` missing).

- [ ] **Step 3: Implement `computeSyncFromSamples`, hybrid RMS + bass-flux tracking, D-minor SFX tuning, and remove `duckMusic` in `src/game/audio.ts`**

Key constants from spec:
- `TRACK_BPM = 144`, `BEAT_OFFSET_SEC = 0.31`
- Calibrated RMS floor `0.068`, ceiling `0.172` with gentle sliding adaptation
- `tempoScale` clamped `[0.88, 1.18]`; `troopSpeedScale` clamped `[0.90, 1.36]`
- `playbackRate` kept subtle (`0.995`, `1.0`, `1.01`) while `BiquadFilterNode` opens `4800 Hz` -> `11500 Hz` -> `20000 Hz`
- SFX tuned to D natural minor (`D4=293.66, E4=329.63, F4=349.23, G4=392.00, A4=440.00, Bb4=466.16, C5=523.25, D5=587.33, F5=698.46, A5=880.00`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx.cmd tsx --test src/game/audio.test.ts`
Expected: PASS.

---

### Task 3: Wire Dual Speed & Subtle Groove Visuals in Controller & Renderer

**Files:**
- Modify: `src/hooks/useGameController.ts:1008-1090`
- Modify: `src/game/renderer.ts:13-30, 945-960, 1134-1155, 1605-1925, 2004-2135`

**Interfaces:**
- Consumes: `soundEngine.sampleMusicSync(dt)` (`MusicSyncState`), `stepSimulation(..., speedMultiplier, troopSpeedScale)`.
- Produces: Dual-speed game loop (`speedRef.current * musicSync.tempoScale` + `musicSync.troopSpeedScale`) and beat-synced castle border/aura + march stride/dust + warship wake/ocean glint accents.

- [ ] **Step 1: Update `useGameController.ts`**

Pass `speedRef.current * musicSync.tempoScale` and `musicSync.troopSpeedScale` to `stepSimulation` during `'playing'`, and `musicSync.tempoScale` + `musicSync.troopSpeedScale` in `'title'` when active.

- [ ] **Step 2: Enhance `GameRenderer` in `src/game/renderer.ts`**

Update `NEUTRAL_MUSIC_SYNC` with `troopSpeedScale: 1.0`. Add subtle beat-synced border/aura glow on player/threatened/selected castles, march stride & dust burst cadence scaled by `troopSpeedScale` and `beatPulse`, and gentle ocean glint lift on drops.

- [ ] **Step 3: Full verification (`lint`, all unit tests, `build`, and browser runtime check)**

Run:
`npm.cmd run lint; if ($LASTEXITCODE -eq 0) { npx.cmd tsx --test src/game/simulation.test.ts src/game/particles.test.ts src/game/features.test.ts src/game/audio.test.ts }; if ($LASTEXITCODE -eq 0) { npm.cmd run build }`
Expected: `0` TypeScript errors, all unit tests PASS, Vite `build` succeeds, and browser runtime verification on `http://localhost:3000` shows clean rendering and zero console/network errors.
