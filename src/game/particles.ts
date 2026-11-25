import { FACTIONS } from './constants';
import type { GameSimulation, SimEvent } from './types';

export type PixelParticleKind = 'spark' | 'dust' | 'debris' | 'ember' | 'glint';

export interface PixelParticle {
  active: boolean;
  kind: PixelParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  secondaryColor: string;
  gravity: number;
  drag: number;
  groundY: number;
  bounces: number;
  wobblePhase: number;
}

export type PixelRingKind = 'dispatch' | 'impact' | 'capture' | 'block';

export interface PixelRing {
  active: boolean;
  kind: PixelRingKind;
  x: number;
  y: number;
  dx: number;
  dy: number;
  startRadius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
  lineWidth: number;
}

const MAX_PARTICLES = 420;
const MAX_RINGS = 36;

/**
 * Pooled, zero-DOM 16-bit pixel-art particle & impact shockwave system.
 * Handles directional troop dispatch plumes, heavy castle clash sparks/debris/smoke,
 * siege capture breaches, tower shield deflections, and subtle ambient map life.
 */
export class ParticleSystem {
  public readonly particles: PixelParticle[];
  public readonly rings: PixelRing[];
  private particleCursor = 0;
  private ringCursor = 0;
  private ambientAccum = 0;
  private rngState = 0x5f3759df;

  constructor() {
    this.particles = Array.from({ length: MAX_PARTICLES }, () => ({
      active: false,
      kind: 'spark',
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 0.5,
      size: 3,
      color: '#ffffff',
      secondaryColor: '#fde047',
      gravity: 0,
      drag: 0.96,
      groundY: 0,
      bounces: 0,
      wobblePhase: 0,
    }));

    this.rings = Array.from({ length: MAX_RINGS }, () => ({
      active: false,
      kind: 'impact',
      x: 0,
      y: 0,
      dx: 1,
      dy: 0,
      startRadius: 8,
      maxRadius: 34,
      life: 0,
      maxLife: 0.35,
      color: '#fde047',
      lineWidth: 2,
    }));
  }

  /** Fast deterministic PRNG (xorshift32) so particle physics remain reproducible & GC-free */
  private rand(): number {
    let x = this.rngState;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.rngState = x >>> 0;
    return this.rngState / 0xffffffff;
  }

  public clear() {
    for (const p of this.particles) p.active = false;
    for (const r of this.rings) r.active = false;
    this.ambientAccum = 0;
  }

  public getActiveParticleCount(): number {
    let n = 0;
    for (const p of this.particles) if (p.active) n++;
    return n;
  }

  public getActiveRingCount(): number {
    let n = 0;
    for (const r of this.rings) if (r.active) n++;
    return n;
  }

  private allocParticle(): PixelParticle {
    const p = this.particles[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % this.particles.length;
    p.active = true;
    p.life = 0;
    p.bounces = 0;
    p.wobblePhase = this.rand() * Math.PI * 2;
    return p;
  }

  private allocRing(): PixelRing {
    const r = this.rings[this.ringCursor];
    this.ringCursor = (this.ringCursor + 1) % this.rings.length;
    r.active = true;
    r.life = 0;
    return r;
  }

  public spawnRing(
    kind: PixelRingKind,
    x: number,
    y: number,
    color: string,
    startRadius: number,
    maxRadius: number,
    maxLife: number,
    lineWidth = 2,
    dx = 1,
    dy = 0
  ) {
    const len = Math.hypot(dx, dy) || 1;
    const r = this.allocRing();
    r.kind = kind;
    r.x = x;
    r.y = y;
    r.dx = dx / len;
    r.dy = dy / len;
    r.startRadius = startRadius;
    r.maxRadius = maxRadius;
    r.maxLife = maxLife;
    r.color = color;
    r.lineWidth = lineWidth;
  }

  public spawnRadialBurst(
    x: number,
    y: number,
    color: string,
    count: number,
    speed: number,
    kind: PixelParticleKind = 'spark',
    secondaryColor = '#ffffff'
  ) {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      const angle = (Math.PI * 2 * i) / Math.max(1, count) + (this.rand() - 0.5) * 0.45;
      const mag = speed * (0.45 + this.rand() * 0.75);
      p.kind = kind;
      p.x = x + (this.rand() - 0.5) * 6;
      p.y = y + (this.rand() - 0.5) * 6;
      p.vx = Math.cos(angle) * mag;
      p.vy = Math.sin(angle) * mag - (kind === 'debris' ? 35 : 8);
      p.maxLife =
        kind === 'dust'
          ? 0.48 + this.rand() * 0.34
          : kind === 'debris'
            ? 0.55 + this.rand() * 0.35
            : 0.28 + this.rand() * 0.28;
      p.size = kind === 'dust' ? 4 : kind === 'debris' ? (this.rand() > 0.5 ? 4 : 3) : 3;
      p.color = color;
      p.secondaryColor = secondaryColor;
      p.gravity = kind === 'debris' ? 230 : kind === 'dust' ? -18 : 48;
      p.drag = kind === 'dust' ? 0.92 : kind === 'debris' ? 0.985 : 0.94;
      p.groundY = y + 10 + this.rand() * 8;
    }
  }

  /**
   * Directional muster dust cone + faction banner sparks + marching pulse chevron
   * emitted from the origin castle gate when an army dispatches.
   */
  public spawnDispatchEffect(
    x: number,
    y: number,
    toX: number,
    toY: number,
    factionColor: string,
    glowColor: string,
    amount: number,
    isElite: boolean
  ) {
    const dx = toX - x;
    const dy = toY - y;
    const dist = Math.hypot(dx, dy) || 1;
    const dirX = dx / dist;
    const dirY = dy / dist;
    const baseAngle = Math.atan2(dirY, dirX);

    const intensity = Math.min(1.6, 0.7 + amount / 24);
    const dustCount = Math.round((isElite ? 9 : 6) * intensity);
    const sparkCount = Math.round((isElite ? 9 : 5) * intensity);

    // 1. Directional pixel dispatch pulse ring & leading chevron
    this.spawnRing(
      'dispatch',
      x + dirX * 8,
      y + dirY * 6,
      isElite ? '#fde047' : glowColor,
      10,
      isElite ? 34 : 26,
      0.32,
      isElite ? 3 : 2,
      dirX,
      dirY
    );

    // 2. Boot-kick marching dust cone spraying forward & slightly back-kicked from castle gate
    for (let i = 0; i < dustCount; i++) {
      const p = this.allocParticle();
      const spread = (this.rand() - 0.5) * 0.95;
      const speed = (28 + this.rand() * 52) * intensity;
      p.kind = 'dust';
      p.x = x + dirX * (6 + this.rand() * 8) + (this.rand() - 0.5) * 8;
      p.y = y + dirY * (4 + this.rand() * 6) + 4 + (this.rand() - 0.5) * 6;
      p.vx = Math.cos(baseAngle + spread) * speed;
      p.vy = Math.sin(baseAngle + spread) * speed - 10;
      p.maxLife = 0.38 + this.rand() * 0.28;
      p.size = this.rand() > 0.45 ? 4 : 3;
      p.color = this.rand() > 0.4 ? '#d9caa7' : '#a89b7e';
      p.secondaryColor = '#ede2c8';
      p.gravity = -14;
      p.drag = 0.9;
      p.groundY = y + 14;
    }

    // 3. Faction muster sparks / golden elite embers surging along march heading
    for (let i = 0; i < sparkCount; i++) {
      const p = this.allocParticle();
      const spread = (this.rand() - 0.5) * 0.65;
      const speed = (65 + this.rand() * 75) * intensity;
      p.kind = isElite && i % 2 === 0 ? 'ember' : 'spark';
      p.x = x + dirX * 10 + (this.rand() - 0.5) * 6;
      p.y = y + dirY * 8 - 2 + (this.rand() - 0.5) * 6;
      p.vx = Math.cos(baseAngle + spread) * speed;
      p.vy = Math.sin(baseAngle + spread) * speed - 14;
      p.maxLife = 0.24 + this.rand() * 0.22;
      p.size = isElite ? 3 : 2;
      p.color = isElite ? '#fef08a' : glowColor;
      p.secondaryColor = isElite ? '#f97316' : factionColor;
      p.gravity = 38;
      p.drag = 0.93;
      p.groundY = y + 14;
    }
  }

  /**
   * Heavy kinetic clash at castle walls: steel-clash sparks, bouncing masonry stone chunks,
   * dark siege smoke puffs, and an expanding pixel impact ring scaled by clash magnitude.
   */
  public spawnClashEffect(
    x: number,
    y: number,
    fromX: number | undefined,
    fromY: number | undefined,
    attackerColor: string,
    amount: number,
    isHeavyCapture = false
  ) {
    // Recoil direction away from incoming army vector
    let recoilAngle = -Math.PI * 0.5;
    if (fromX !== undefined && fromY !== undefined) {
      recoilAngle = Math.atan2(y - fromY, x - fromX);
    }

    const scale = Math.min(1.85, (isHeavyCapture ? 1.35 : 0.75) + amount / 22);
    const sparkCount = Math.round(11 * scale);
    const debrisCount = Math.round((isHeavyCapture ? 11 : 5) * scale);
    const smokeCount = Math.round((isHeavyCapture ? 8 : 4) * scale);

    // 1. Expanding pixel impact shockwave ring(s)
    this.spawnRing(
      isHeavyCapture ? 'capture' : 'impact',
      x,
      y - 2,
      isHeavyCapture ? attackerColor : '#fef08a',
      10,
      Math.round((isHeavyCapture ? 50 : 32) * Math.min(1.3, scale)),
      isHeavyCapture ? 0.48 : 0.28,
      isHeavyCapture ? 3 : 2
    );

    if (isHeavyCapture) {
      this.spawnRing('impact', x, y - 2, '#fef08a', 6, 36, 0.3, 2);
    }

    // 2. High-velocity steel-clash sparks spraying outward from impact point
    for (let i = 0; i < sparkCount; i++) {
      const p = this.allocParticle();
      const angle =
        i % 3 === 0
          ? recoilAngle + (this.rand() - 0.5) * 1.35
          : this.rand() * Math.PI * 2;
      const speed = (85 + this.rand() * 115) * Math.min(1.4, scale);
      p.kind = 'spark';
      p.x = x + (this.rand() - 0.5) * 10;
      p.y = y - 4 + (this.rand() - 0.5) * 8;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 24;
      p.maxLife = 0.22 + this.rand() * 0.24;
      p.size = this.rand() > 0.4 ? 3 : 2;
      p.color = this.rand() > 0.35 ? '#fffbeb' : '#fde047';
      p.secondaryColor = this.rand() > 0.5 ? '#f97316' : attackerColor;
      p.gravity = 120;
      p.drag = 0.92;
      p.groundY = y + 12;
    }

    // 3. Tumbling castle masonry stone debris with gravity + ground bounce
    for (let i = 0; i < debrisCount; i++) {
      const p = this.allocParticle();
      const angle = recoilAngle + (this.rand() - 0.5) * 2.2;
      const speed = (48 + this.rand() * 78) * Math.min(1.35, scale);
      p.kind = 'debris';
      p.x = x + (this.rand() - 0.5) * 14;
      p.y = y - 6 + (this.rand() - 0.5) * 8;
      p.vx = Math.cos(angle) * speed;
      p.vy = -55 - this.rand() * 75;
      p.maxLife = 0.58 + this.rand() * 0.35;
      p.size = this.rand() > 0.45 ? 4 : 3;
      p.color = isHeavyCapture && i % 3 === 0 ? attackerColor : this.rand() > 0.5 ? '#cbd5e1' : '#64748b';
      p.secondaryColor = '#334155';
      p.gravity = 260;
      p.drag = 0.985;
      p.groundY = y + 10 + this.rand() * 8;
    }

    // 4. Rising heavy siege smoke clouds
    for (let i = 0; i < smokeCount; i++) {
      const p = this.allocParticle();
      const angle = this.rand() * Math.PI * 2;
      const speed = 16 + this.rand() * 34;
      p.kind = 'dust';
      p.x = x + (this.rand() - 0.5) * 14;
      p.y = y - 2 + (this.rand() - 0.5) * 10;
      p.vx = Math.cos(angle) * speed;
      p.vy = -18 - this.rand() * 26;
      p.maxLife = 0.46 + this.rand() * 0.36;
      p.size = isHeavyCapture ? 5 : 4;
      p.color = this.rand() > 0.4 ? '#475569' : '#94a3b8';
      p.secondaryColor = '#1e293b';
      p.gravity = -22;
      p.drag = 0.91;
      p.groundY = y + 12;
    }
  }

  /** Crisp arcane cyan shield deflection burst when Guard Tower or Royal Shield blocks damage */
  public spawnTowerBlockEffect(x: number, y: number, amount: number) {
    this.spawnRing('block', x, y - 4, '#38bdf8', 12, 36, 0.3, 2);
    const count = Math.min(14, 6 + Math.floor(amount / 4));
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      const angle = (Math.PI * 2 * i) / count + (this.rand() - 0.5) * 0.35;
      const speed = 62 + this.rand() * 58;
      p.kind = i % 2 === 0 ? 'glint' : 'spark';
      p.x = x + (this.rand() - 0.5) * 10;
      p.y = y - 8 + (this.rand() - 0.5) * 8;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 18;
      p.maxLife = 0.28 + this.rand() * 0.22;
      p.size = 3;
      p.color = '#e0f2fe';
      p.secondaryColor = '#38bdf8';
      p.gravity = 45;
      p.drag = 0.93;
      p.groundY = y + 12;
    }
  }

  public consumeEvents(events: SimEvent[]) {
    for (const ev of events) {
      const faction = ev.owner >= 0 ? FACTIONS[ev.owner] : null;
      const factionColor = faction ? faction.color : '#94a3b8';
      const glowColor = faction ? faction.borderGlow : '#cbd5e1';

      if (ev.type === 'dispatch') {
        if (ev.isNaval) {
          this.spawnRing(
            'dispatch',
            ev.x,
            ev.y,
            '#38bdf8',
            10,
            34,
            0.38,
            2,
            (ev.toX ?? ev.x + 20) - ev.x,
            (ev.toY ?? ev.y) - ev.y
          );
          this.spawnRadialBurst(ev.x, ev.y, '#bae6fd', 10, 68, 'glint', '#0284c7');
        } else {
          this.spawnDispatchEffect(
            ev.x,
            ev.y,
            ev.toX ?? ev.x + 20,
            ev.toY ?? ev.y,
            factionColor,
            glowColor,
            ev.amount ?? 8,
            Boolean(ev.isElite)
          );
        }
      } else if (ev.type === 'clash') {
        this.spawnClashEffect(
          ev.x,
          ev.y,
          ev.fromX,
          ev.fromY,
          glowColor,
          ev.amount ?? 10,
          false
        );
      } else if (ev.type === 'capture') {
        this.spawnClashEffect(
          ev.x,
          ev.y,
          ev.fromX,
          ev.fromY,
          glowColor,
          (ev.amount ?? 15) + 12,
          true
        );
        // Extra celebratory golden sparks on player conquest
        if (ev.capturedByPlayer) {
          this.spawnRadialBurst(ev.x, ev.y - 6, '#fde047', 12, 118, 'glint', '#f97316');
        }
      } else if (ev.type === 'tower_block') {
        this.spawnTowerBlockEffect(ev.x, ev.y, ev.amount ?? 6);
      } else if (ev.type === 'build') {
        const lvl = ev.buildingLevel ?? 1;
        if (lvl >= 3) {
          this.spawnRing('capture', ev.x, ev.y - 4, '#fef08a', 10, 56, 0.5, 3);
          this.spawnRing('dispatch', ev.x, ev.y - 4, '#f59e0b', 6, 38, 0.36, 2);
          this.spawnRadialBurst(ev.x, ev.y - 6, '#fef08a', 26, 118, 'glint', '#f59e0b');
          this.spawnRadialBurst(ev.x, ev.y - 4, '#f97316', 12, 86, 'ember', '#fde047');
        } else if (lvl === 2) {
          this.spawnRing('capture', ev.x, ev.y - 2, '#e2e8f0', 10, 44, 0.42, 3);
          this.spawnRadialBurst(ev.x, ev.y - 4, '#fde047', 18, 95, 'glint', '#e2e8f0');
        } else {
          this.spawnRing('dispatch', ev.x, ev.y - 2, '#fde047', 10, 34, 0.36, 2);
          this.spawnRadialBurst(ev.x, ev.y - 4, '#fde047', 14, 78, 'glint', '#f59e0b');
        }
      } else if (ev.type === 'power') {
        const col =
          ev.power === 'mobilize' ? '#fbbf24' : ev.power === 'blitz' ? '#38bdf8' : '#60a5fa';
        this.spawnRing('capture', ev.x, ev.y - 4, col, 10, 48, 0.44, 3);
        this.spawnRadialBurst(ev.x, ev.y - 4, col, 18, 115, 'glint', '#ffffff');
      } else if (ev.type === 'reinforce' && ev.owner === 0) {
        this.spawnRing('dispatch', ev.x, ev.y - 2, '#86efac', 8, 26, 0.28, 2);
        this.spawnRadialBurst(ev.x, ev.y - 4, '#86efac', 8, 56, 'glint', '#4ade80');
      }
    }
  }

  /**
   * Emits subtle ambient micro-particles for moving squads (marching boot dust)
   * and living pixel buildings (Mine gold glints, Forge smoke & embers, Barracks sparks, Tower glints).
   */
  public emitAmbient(sim: GameSimulation, dt: number, isTitleBackdrop: boolean) {
    this.ambientAccum += dt;
    if (this.ambientAccum < 0.085) return;
    this.ambientAccum = 0;

    // 1. Real marching dust puffs (land) OR crisp cyan sea-foam wakes (naval warships)
    const blitzActive = sim.powers.blitzTimer > 0;
    for (const tr of sim.troops) {
      if (this.rand() < (tr.isNaval ? 0.65 : 0.48)) {
        const p = this.allocParticle();
        const trailDir = tr.facingLeft ? 1 : -1;
        if (tr.isNaval) {
          p.kind = this.rand() > 0.35 ? 'dust' : 'glint';
          p.x = tr.x + trailDir * (9 + this.rand() * 6) + (this.rand() - 0.5) * 5;
          p.y = tr.y + 6 + (this.rand() - 0.5) * 5;
          p.vx = trailDir * (8 + this.rand() * 12);
          p.vy = (this.rand() - 0.5) * 8;
          p.maxLife = 0.38 + this.rand() * 0.25;
          p.size = 3;
          p.color = '#e0f2fe';
          p.secondaryColor = '#38bdf8';
          p.gravity = 0;
          p.drag = 0.92;
          p.groundY = tr.y + 10;
        } else {
          p.kind = blitzActive && tr.owner === 0 && this.rand() > 0.5 ? 'spark' : 'dust';
          p.x = tr.x + trailDir * (7 + this.rand() * 5) + (this.rand() - 0.5) * 4;
          p.y = tr.y + 7 + (this.rand() - 0.5) * 4;
          p.vx = trailDir * (10 + this.rand() * 14);
          p.vy = -8 - this.rand() * 12;
          p.maxLife = 0.28 + this.rand() * 0.2;
          p.size = p.kind === 'spark' ? 2 : 3;
          p.color = p.kind === 'spark' ? '#7dd3fc' : '#d8cba8';
          p.secondaryColor = p.kind === 'spark' ? '#e0f2fe' : '#94a3b8';
          p.gravity = -10;
          p.drag = 0.9;
          p.groundY = tr.y + 12;
        }
      }
    }

    if (isTitleBackdrop) return;

    // 2. Subtle ambient life around constructed pixel buildings (intensifies on Lv.2 & Lv.3)
    for (const t of sim.territories) {
      const mineLvl = Math.max(t.buildingLevels?.mine ?? 0, t.hasMine ? 1 : 0);
      if (mineLvl > 0 && this.rand() < 0.12 + mineLvl * 0.08) {
        const p = this.allocParticle();
        p.kind = 'glint';
        p.x = t.x - 28 + (this.rand() - 0.5) * 12;
        p.y = t.y + 2 + (this.rand() - 0.5) * 8;
        p.vx = (this.rand() - 0.5) * 8;
        p.vy = -14 - this.rand() * (10 + mineLvl * 4);
        p.maxLife = 0.45 + this.rand() * 0.25;
        p.size = mineLvl === 3 ? 3 : 2;
        p.color = mineLvl === 3 ? '#fffbeb' : '#fef08a';
        p.secondaryColor = '#f59e0b';
        p.gravity = -4;
        p.drag = 0.95;
        p.groundY = t.y + 12;
      }

      const forgeLvl = Math.max(t.buildingLevels?.forge ?? 0, t.hasForge ? 1 : 0);
      if (forgeLvl > 0 && this.rand() < 0.24 + forgeLvl * 0.1) {
        const isEmber = this.rand() < 0.32 + forgeLvl * 0.12;
        const p = this.allocParticle();
        p.kind = isEmber ? 'ember' : 'dust';
        p.x = t.x + (isEmber ? 24 : 30) + (this.rand() - 0.5) * 6;
        p.y = t.y - (isEmber ? 14 + forgeLvl * 4 : 26 + forgeLvl * 3);
        p.vx = (this.rand() - 0.5) * 10;
        p.vy = isEmber ? -24 - this.rand() * (14 + forgeLvl * 5) : -16 - this.rand() * 10;
        p.maxLife = isEmber ? 0.45 + this.rand() * 0.25 : 0.62 + this.rand() * 0.3;
        p.size = isEmber ? (forgeLvl === 3 ? 3 : 2) : 4;
        p.color = isEmber ? (forgeLvl === 3 ? '#fef08a' : '#fbbf24') : '#94a3b8';
        p.secondaryColor = isEmber ? '#ef4444' : '#475569';
        p.gravity = -8;
        p.drag = 0.96;
        p.groundY = t.y + 10;
      }

      const towerLvl = Math.max(t.buildingLevels?.tower ?? 0, t.hasTower ? 1 : 0);
      if (towerLvl > 0 && this.rand() < 0.08 + towerLvl * 0.06) {
        const p = this.allocParticle();
        p.kind = 'glint';
        p.x = t.x - 27 + (this.rand() - 0.5) * 8;
        p.y = t.y - (26 + towerLvl * 6) + (this.rand() - 0.5) * 4;
        p.vx = (this.rand() - 0.5) * 7;
        p.vy = -10 - this.rand() * 10;
        p.maxLife = 0.4 + this.rand() * 0.22;
        p.size = towerLvl === 3 ? 3 : 2;
        p.color = towerLvl === 3 && this.rand() > 0.5 ? '#fef08a' : '#bae6fd';
        p.secondaryColor = '#38bdf8';
        p.gravity = -4;
        p.drag = 0.95;
        p.groundY = t.y;
      }

      const barracksLvl = Math.max(t.buildingLevels?.barracks ?? 0, t.hasBarracks ? 1 : 0);
      if (barracksLvl > 0 && this.rand() < 0.1 + barracksLvl * 0.05) {
        const p = this.allocParticle();
        p.kind = barracksLvl === 3 ? 'glint' : 'ember';
        p.x = t.x + 26 + (this.rand() - 0.5) * 8;
        p.y = t.y - barracksLvl * 3;
        p.vx = (this.rand() - 0.5) * 8;
        p.vy = -16 - this.rand() * 10;
        p.maxLife = 0.36 + this.rand() * 0.22;
        p.size = 2;
        p.color = '#fde047';
        p.secondaryColor = barracksLvl === 3 ? '#f59e0b' : '#ef4444';
        p.gravity = -6;
        p.drag = 0.95;
        p.groundY = t.y + 10;
      }
    }
  }

  public update(dt: number) {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;

      if (p.kind === 'ember') {
        p.x += Math.sin(p.life * 14 + p.wobblePhase) * 16 * dt;
      }

      const damping = Math.pow(p.drag, dt * 60);
      p.vx *= damping;
      if (p.kind === 'dust') {
        p.vy *= damping;
      }

      // Ground bounce for castle stone debris chunks
      if (p.kind === 'debris' && p.y >= p.groundY && p.vy > 0) {
        p.y = p.groundY;
        if (p.bounces < 2 && Math.abs(p.vy) > 25) {
          p.vy = -p.vy * 0.42;
          p.vx *= 0.65;
          p.bounces += 1;
        } else {
          p.vy = 0;
          p.vx *= 0.7;
        }
      }
    }

    for (const r of this.rings) {
      if (!r.active) continue;
      r.life += dt;
      if (r.life >= r.maxLife) {
        r.active = false;
      }
    }
  }
}
