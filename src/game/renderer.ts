import { BIOMES, ECONOMY, FACTIONS, NEUTRAL_STYLE, WORLD_HEIGHT, WORLD_WIDTH } from './constants';
import { ParticleSystem } from './particles';
import { PixelSpriteAtlas } from './pixelSprites';
import { previewAttackOutcome } from './simulation';
import type {
  DragAimState,
  FloatingText,
  GameSimulation,
  SimEvent,
  Territory,
} from './types';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

const FACTION_LAND_RGB = FACTIONS.map((f) => hexToRgb(f.landFill));
const NEUTRAL_LAND_RGB = hexToRgb(NEUTRAL_STYLE.landFill);

// Classic 2x2 Bayer matrix for crisp 16-bit ordered pixel dithering
const BAYER_2X2 = [
  [0, 2],
  [3, 1],
];

export interface ViewportTransform {
  width: number;
  height: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  dpr: number;
}

export class GameRenderer {
  private bgCanvas: HTMLCanvasElement;
  private bgCtx: CanvasRenderingContext2D;
  private atlas: PixelSpriteAtlas;
  private vfx: ParticleSystem;
  private texts: FloatingText[];
  private textCursor = 0;
  private oceanSparkles: Array<{ x: number; y: number; phase: number }> = [];

  public viewport: ViewportTransform = {
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    dpr: 1,
  };

  constructor() {
    this.bgCanvas = document.createElement('canvas');
    this.bgCanvas.width = WORLD_WIDTH;
    this.bgCanvas.height = WORLD_HEIGHT;
    this.bgCtx = this.bgCanvas.getContext('2d')!;
    this.bgCtx.imageSmoothingEnabled = false;
    this.atlas = new PixelSpriteAtlas();
    this.vfx = new ParticleSystem();

    this.texts = Array.from({ length: 44 }, () => ({
      active: false,
      x: 0,
      y: 0,
      vy: -24,
      life: 0,
      maxLife: 1,
      text: '',
      color: '#ffffff',
    }));
  }

  public clearEffects() {
    this.vfx.clear();
    for (const t of this.texts) t.active = false;
  }

  public spawnBurst(x: number, y: number, color: string, count: number, speed = 90) {
    this.vfx.spawnRadialBurst(x, y, color, count, speed, 'spark');
  }

  public spawnFloatingText(x: number, y: number, text: string, color: string) {
    const f = this.texts[this.textCursor];
    this.textCursor = (this.textCursor + 1) % this.texts.length;
    f.active = true;
    f.x = x + (Math.random() - 0.5) * 14;
    f.y = y - 18;
    f.vy = -30;
    f.life = 0;
    f.maxLife = 1.1;
    f.text = text;
    f.color = color;
  }

  public consumeEvents(events: SimEvent[]) {
    this.vfx.consumeEvents(events);

    for (const ev of events) {
      if (ev.type === 'build') {
        const label =
          ev.building === 'barracks'
            ? 'سربازخانه آماده شد'
            : ev.building === 'tower'
              ? 'برج دفاعی ساخته شد'
              : ev.building === 'forge'
                ? 'آهنگری نبرد فعال شد'
                : 'معدن طلا فعال شد';
        this.spawnFloatingText(ev.x, ev.y - 12, label, '#fde68a');
      } else if (ev.type === 'power') {
        if (ev.power === 'mobilize') {
          this.spawnFloatingText(ev.x, ev.y - 14, `بسیج +${ev.amount ?? 0}`, '#fde047');
        } else if (ev.power === 'blitz') {
          this.spawnFloatingText(ev.x, ev.y - 16, 'یورش برق‌آسا ۲×', '#7dd3fc');
        } else if (ev.power === 'shield') {
          this.spawnFloatingText(ev.x, ev.y - 16, 'سپر سلطنتی فعال شد', '#93c5fd');
        }
      } else if (ev.type === 'clash') {
        if (ev.amount) {
          this.spawnFloatingText(ev.x, ev.y, `-${ev.amount}`, '#fca5a5');
        }
      } else if (ev.type === 'tower_block') {
        if (ev.amount && ev.amount > 0) {
          this.spawnFloatingText(ev.x, ev.y - 24, `دفاع -${ev.amount}`, '#7dd3fc');
        }
      } else if (ev.type === 'capture') {
        this.spawnFloatingText(
          ev.x,
          ev.y - 12,
          ev.capturedByPlayer ? 'قلعه فتح شد!' : 'سقوط قلعه',
          ev.capturedByPlayer ? '#fde047' : '#fda4af'
        );
      } else if (ev.type === 'reinforce' && ev.owner === 0 && ev.amount) {
        this.spawnFloatingText(ev.x, ev.y, `+${Math.round(ev.amount)}`, '#86efac');
      } else if (ev.type === 'supply_set' && ev.owner === 0) {
        this.vfx.spawnRing(
          'dispatch',
          ev.x,
          ev.y - 2,
          '#34d399',
          10,
          34,
          0.35,
          2,
          (ev.toX ?? ev.x + 10) - ev.x,
          (ev.toY ?? ev.y) - ev.y
        );
        this.spawnFloatingText(ev.x, ev.y - 16, 'خط تأمین فعال شد', '#6ee7b7');
      }
    }
  }

  public updateEffects(dt: number, sim?: GameSimulation, isTitleBackdrop = false) {
    if (sim) {
      this.vfx.emitAmbient(sim, dt, isTitleBackdrop);
    }
    this.vfx.update(dt);

    for (const f of this.texts) {
      if (!f.active) continue;
      f.life += dt;
      if (f.life >= f.maxLife) {
        f.active = false;
        continue;
      }
      f.y += f.vy * dt;
      f.vy *= 0.97;
    }
  }

  /** Re-renders the 16-bit pixel-art ocean, dithered continent, biome props, and cobbled roads */
  public rebuildTerrainBuffer(sim: GameSimulation) {
    const { map, territories } = sim;
    const { width, height, step, cols, rows, cells, elevation, props } = map;
    const imgData = this.bgCtx.createImageData(width, height);
    const data = imgData.data;

    this.oceanSparkles = [];

    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const idx = gy * cols + gx;
        const cellId = cells[idx];
        const elev = elevation[idx];
        const dither = BAYER_2X2[gy & 1][gx & 1];

        let r = 14;
        let g = 29;
        let b = 52;

        if (cellId === -1) {
          // 16-bit stepped turquoise/cobalt ocean with pixel surf & ordered dithering
          const val = elev + dither * 5;
          if (val > 112) {
            // Coastal white-cyan pixel surf foam
            r = 122;
            g = 196;
            b = 209;
          } else if (val > 95) {
            // Bright shallow turquoise bay
            r = 35;
            g = 96;
            b = 128;
          } else if (val > 72) {
            // Mid coastal shelf
            r = 22;
            g = 62;
            b = 94;
          } else if (val > 44) {
            // Deep tactical sea
            r = 16;
            g = 41;
            b = 70;
          } else {
            // Abyssal outer water
            r = 11;
            g = 27;
            b = 49;
          }

          // Record deterministic ocean sparkle spots
          if (
            elev < 90 &&
            elev > 18 &&
            ((gx * 73 + gy * 131 + map.seed) & 511) === 7
          ) {
            this.oceanSparkles.push({
              x: gx * step,
              y: gy * step,
              phase: ((gx + gy) * 0.45) % (Math.PI * 2),
            });
          }
        } else {
          const terr = territories[cellId];
          const owner = terr.owner;
          const base = owner === -1 ? NEUTRAL_LAND_RGB : FACTION_LAND_RGB[owner];

          // Subtle biome color tinting so fertile plains look warmer & forests richer
          let br = base[0];
          let bg = base[1];
          let bb = base[2];
          if (terr.biome === 'fertile') {
            br = Math.min(255, br + 14);
            bg = Math.min(255, bg + 14);
            bb = Math.max(0, bb - 8);
          } else if (terr.biome === 'forest') {
            br = Math.max(0, br - 8);
            bg = Math.min(255, bg + 10);
            bb = Math.max(0, bb - 4);
          } else if (terr.biome === 'mountain') {
            br = Math.min(255, br + 6);
            bg = Math.min(255, bg + 8);
            bb = Math.min(255, bb + 14);
          }

          // Detect coastal edge, rocky cliff drop (south coast), and national borders
          const right = gx + 1 < cols ? cells[idx + 1] : -1;
          const down = gy + 1 < rows ? cells[idx + cols] : -1;
          const left = gx > 0 ? cells[idx - 1] : -1;
          const up = gy > 0 ? cells[idx - cols] : -1;

          const isCoast = right === -1 || down === -1 || left === -1 || up === -1;
          const isSouthCliff = down === -1;
          const isBeach =
            !isCoast &&
            ((gx + 2 < cols && cells[idx + 2] === -1) ||
              (gx > 1 && cells[idx - 2] === -1) ||
              (gy + 2 < rows && cells[idx + cols * 2] === -1) ||
              (gy > 1 && cells[idx - cols * 2] === -1));

          const isEnemyBorder =
            (right >= 0 && right !== cellId && territories[right].owner !== owner) ||
            (down >= 0 && down !== cellId && territories[down].owner !== owner);
          const isInternalBorder =
            !isEnemyBorder &&
            ((right >= 0 && right !== cellId) || (down >= 0 && down !== cellId));

          if (isSouthCliff) {
            // 16-bit dark earthen cliff lip along southern shoreline for 2.5D island depth
            r = 86;
            g = 67;
            b = 48;
          } else if (isCoast) {
            // Crisp dark-sand pixel shoreline outline
            r = 217;
            g = 197;
            b = 148;
          } else if (isEnemyBorder) {
            // Crisp dark ink pixel border between rival nations
            r = 15;
            g = 20;
            b = 30;
          } else if (isInternalBorder) {
            // Subtle pixel dashed internal province border
            const dash = ((gx + gy) & 2) === 0;
            const factor = dash ? 0.62 : 0.85;
            r = br * factor;
            g = bg * factor;
            b = bb * factor;
          } else {
            // Quantized 3-step pixel elevation shading with Bayer 2x2 dither
            const eNorm = (elev - 128) / 127 + (dither - 1.5) * 0.07;
            const band = eNorm > 0.56 ? 1.12 : eNorm > 0.28 ? 1.0 : 0.88;
            // Subtle grass pixel tufts
            const speck = (((gx * 41 + gy * 29) ^ (gx * 7)) & 31) === 0 ? 14 : 0;
            if (isBeach) {
              // Warm sandy shoreline transition blended with faction hue
              r = Math.min(255, br * 0.62 + 86);
              g = Math.min(255, bg * 0.62 + 78);
              b = Math.min(255, bb * 0.62 + 54);
            } else {
              r = Math.min(255, Math.max(0, br * band + speck));
              g = Math.min(255, Math.max(0, bg * band + speck));
              b = Math.min(255, Math.max(0, bb * band + speck * 0.6));
            }
          }
        }

        const startX = gx * step;
        const startY = gy * step;
        for (let dy = 0; dy < step && startY + dy < height; dy++) {
          let rowOffset = ((startY + dy) * width + startX) * 4;
          for (let dx = 0; dx < step && startX + dx < width; dx++) {
            data[rowOffset] = r;
            data[rowOffset + 1] = g;
            data[rowOffset + 2] = b;
            data[rowOffset + 3] = 255;
            rowOffset += 4;
          }
        }
      }
    }

    this.bgCtx.putImageData(imgData, 0, 0);
    this.bgCtx.imageSmoothingEnabled = false;

    // Draw pixel cobbled stone roads connecting neighboring castles across shared borders
    this.bgCtx.save();
    for (const t of territories) {
      for (const nId of t.neighbors) {
        if (t.id >= nId) continue;
        const n = territories[nId];
        const via = t.borderCrossings[nId] ?? {
          x: (t.x + n.x) * 0.5,
          y: (t.y + n.y) * 0.5,
        };
        this.drawPixelRoad(this.bgCtx, t.x, t.y, via.x, via.y, n.x, n.y);
      }
    }
    this.bgCtx.restore();

    // Stamp crisp pixel-art biome props (pine groves, oak trees, mountains, wheat)
    for (const prop of props) {
      const sprite =
        prop.kind === 'mountain'
          ? this.atlas.mountain
          : prop.kind === 'pine'
            ? this.atlas.pine
            : prop.kind === 'wheat'
              ? this.atlas.wheat
              : this.atlas.oak;
      const scale = prop.kind === 'mountain' ? 2.4 : 2.0;
      const dw = Math.round(sprite.width * scale);
      const dh = Math.round(sprite.height * scale);
      // Tiny dark pixel drop shadow
      this.bgCtx.fillStyle = 'rgba(10, 15, 25, 0.34)';
      this.bgCtx.fillRect(
        Math.round(prop.x - dw * 0.35),
        Math.round(prop.y + dh * 0.25),
        Math.round(dw * 0.7),
        3
      );
      this.bgCtx.drawImage(
        sprite,
        Math.round(prop.x - dw * 0.5),
        Math.round(prop.y - dh * 0.65),
        dw,
        dh
      );
    }

    // Draw crisp pixel compass rose in bottom-left ocean corner
    this.drawPixelCompass(this.bgCtx, 68, height - 64);

    sim.mapDirty = false;
  }

  private drawPixelRoad(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    cx: number,
    cy: number,
    x1: number,
    y1: number
  ) {
    const steps = 26;
    for (let i = 2; i < steps - 1; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const px = Math.round((mt * mt * x0 + 2 * mt * t * cx + t * t * x1) / 3) * 3;
      const py = Math.round((mt * mt * y0 + 2 * mt * t * cy + t * t * y1) / 3) * 3;

      // Cobble stone pixel dot with dark outline
      ctx.fillStyle = 'rgba(15, 20, 30, 0.45)';
      ctx.fillRect(px - 2, py - 2, 5, 5);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(229, 214, 179, 0.62)' : 'rgba(196, 179, 143, 0.52)';
      ctx.fillRect(px - 1, py - 1, 3, 3);
    }
  }

  private drawPixelCompass(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    ctx.save();
    ctx.fillStyle = 'rgba(214, 199, 169, 0.28)';
    // Crisp stepped pixel cross + diamond
    ctx.fillRect(cx - 2, cy - 22, 4, 44);
    ctx.fillRect(cx - 22, cy - 2, 44, 4);
    ctx.fillStyle = 'rgba(234, 179, 8, 0.35)';
    ctx.fillRect(cx - 4, cy - 10, 8, 20);
    ctx.fillRect(cx - 10, cy - 4, 20, 8);
    ctx.fillStyle = '#0b1b31';
    ctx.fillRect(cx - 2, cy - 2, 4, 4);
    ctx.restore();
  }

  public updateViewportSize(
    canvas: HTMLCanvasElement,
    cssWidth: number,
    cssHeight: number
  ): ViewportTransform {
    const w = Math.max(1, cssWidth);
    const h = Math.max(1, cssHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.max(1, Math.round(w * dpr));
    const targetH = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const scale = Math.min(w / WORLD_WIDTH, h / WORLD_HEIGHT);
    const offsetX = (w - WORLD_WIDTH * scale) * 0.5;
    const offsetY = (h - WORLD_HEIGHT * scale) * 0.5;

    this.viewport = { width: w, height: h, scale, offsetX, offsetY, dpr };
    return this.viewport;
  }

  public syncViewportFromRect(canvas: HTMLCanvasElement): ViewportTransform {
    const rect = canvas.getBoundingClientRect();
    return this.updateViewportSize(canvas, rect.width, rect.height);
  }

  public screenToWorld(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect();
    const { scale, offsetX, offsetY } = this.viewport;
    return {
      x: (clientX - rect.left - offsetX) / scale,
      y: (clientY - rect.top - offsetY) / scale,
    };
  }

  public render(
    canvas: HTMLCanvasElement,
    sim: GameSimulation,
    selectedId: number | null,
    hoveredId: number | null,
    timeSec: number,
    isTitleBackdrop = false,
    dragAim: DragAimState | null = null,
    sendRatio = 0.5,
    supplyMode = false
  ) {
    if (sim.mapDirty) {
      this.rebuildTerrainBuffer(sim);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width: viewW, height: viewH, scale, offsetX, offsetY, dpr } = this.viewport;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;

    // Fill outer ocean frame cleanly
    ctx.fillStyle = '#0b1b31';
    ctx.fillRect(0, 0, viewW, viewH);

    let shakeX = 0;
    let shakeY = 0;
    if (sim.shakeTrauma > 0.01 && !isTitleBackdrop) {
      const mag = sim.shakeTrauma * sim.shakeTrauma * 7;
      shakeX = Math.round((Math.sin(timeSec * 67) * 0.7 + Math.cos(timeSec * 43) * 0.3) * mag);
      shakeY = Math.round((Math.cos(timeSec * 59) * 0.7 + Math.sin(timeSec * 51) * 0.3) * mag);
    }

    ctx.translate(offsetX + shakeX, offsetY + shakeY);
    ctx.scale(scale, scale);
    ctx.imageSmoothingEnabled = false;

    // 1. Cached 16-bit Pixel Continent + Biome Props + Cobble Roads
    ctx.drawImage(this.bgCanvas, 0, 0);

    // 2. Animated Pixel Ocean Wave Glints
    for (const sp of this.oceanSparkles) {
      const wave = Math.sin(timeSec * 2.4 + sp.phase);
      if (wave > 0.45) {
        ctx.fillStyle = 'rgba(130, 214, 232, 0.45)';
        ctx.fillRect(sp.x, sp.y, 6, 2);
        ctx.fillRect(sp.x + 2, sp.y - 2, 2, 2);
      }
    }

    // Determine active player origin (either currently dragging or selected)
    const activeOriginId = dragAim?.active ? dragAim.originId : selectedId;
    const activeOrigin = activeOriginId !== null ? sim.territories[activeOriginId] : null;
    const activeHoverId = dragAim?.active ? dragAim.hoverTargetId : hoveredId;

    // 2b. Active Auto-Supply Reinforcement Conveyor Lines (emerald pixel chevrons)
    if (!isTitleBackdrop) {
      this.drawSupplyLines(ctx, sim, timeSec);
    }

    // 3. Incoming Enemy Threat Sightlines toward Player Castles
    const threatenedPlayerIds = new Set<number>();
    if (!isTitleBackdrop) {
      this.drawIncomingThreats(ctx, sim, timeSec, threatenedPlayerIds);
    }

    // 4. Highlight Valid Border Attack / Reinforce Routes when a player castle is selected
    if (activeOrigin && activeOrigin.owner === 0 && !isTitleBackdrop) {
      this.drawSelectedRoutes(ctx, sim, activeOrigin, activeHoverId, timeSec, supplyMode);
    }

    // 5. Pixel Hover Target Corner Brackets
    if (activeHoverId !== null && activeHoverId !== activeOriginId && !isTitleBackdrop) {
      const hov = sim.territories[activeHoverId];
      if (hov) {
        const isLegalTarget =
          activeOrigin !== null &&
          activeOrigin.owner === 0 &&
          activeOrigin.neighbors.includes(hov.id);
        const col = supplyMode
          ? isLegalTarget && hov.owner === 0
            ? '#34d399'
            : '#f87171'
          : isLegalTarget
            ? hov.owner === 0
              ? '#4ade80'
              : '#fde047'
            : 'rgba(237, 231, 217, 0.6)';
        this.drawPixelBrackets(ctx, hov.x, hov.y - 4, 34, col);
      }
    }

    // 6. Render Pixel-Art Castles & Annex Buildings (sorted top-to-bottom for depth)
    const sortedTerritories = [...sim.territories].sort((a, b) => a.y - b.y);
    for (const t of sortedTerritories) {
      this.drawPixelCastle(
        ctx,
        t,
        !isTitleBackdrop && activeOriginId === t.id,
        !isTitleBackdrop &&
          activeOrigin !== null &&
          activeOrigin.owner === 0 &&
          activeOrigin.neighbors.includes(t.id),
        !isTitleBackdrop && threatenedPlayerIds.has(t.id),
        timeSec,
        isTitleBackdrop
      );
    }

    // 7. Render Animated Marching Pixel-Art Soldier Squads (sorted top-to-bottom)
    const sortedTroops = [...sim.troops].sort((a, b) => a.y - b.y);
    const blitzActive = sim.powers.blitzTimer > 0;
    for (const tr of sortedTroops) {
      this.drawPixelSoldierSquad(ctx, tr, timeSec, blitzActive && tr.owner === 0);
    }

    // 8. Live Drag-to-Attack Pixel Trajectory Arrow
    if (dragAim?.active && !isTitleBackdrop) {
      this.drawDragAimLine(ctx, sim, dragAim, timeSec);
    }

    // 9. Live Tactical Attack/Reinforce Preview Tooltip + Selected Castle Nameplate
    if (!isTitleBackdrop) {
      if (
        activeOrigin &&
        activeOrigin.owner === 0 &&
        activeHoverId !== null &&
        activeHoverId !== activeOrigin.id &&
        activeOrigin.neighbors.includes(activeHoverId)
      ) {
        this.drawTacticalPreview(ctx, sim, activeOrigin.id, activeHoverId, sendRatio);
      } else if (activeHoverId !== null) {
        const hov = sim.territories[activeHoverId];
        if (hov) this.drawCastleNameplate(ctx, hov);
      } else if (activeOrigin) {
        this.drawCastleNameplate(ctx, activeOrigin);
      }
    }

    // 10. Pixel Shockwave Rings, Directional Dispatch Plumes, Combat Particles & Floating Numbers
    this.drawPixelRings(ctx);
    this.drawParticles(ctx);
    if (!isTitleBackdrop) {
      this.drawFloatingTexts(ctx);
    }

    ctx.restore();
  }

  private drawIncomingThreats(
    ctx: CanvasRenderingContext2D,
    sim: GameSimulation,
    timeSec: number,
    threatenedIds: Set<number>
  ) {
    for (const tr of sim.troops) {
      if (tr.owner === 0) continue;
      const target = sim.territories[tr.toId];
      if (!target || target.owner !== 0) continue;
      threatenedIds.add(target.id);

      // Subtle flashing red danger dots from enemy army to player's threatened castle
      const steps = 6;
      const phase = (timeSec * 3.5) % 1;
      for (let i = 0; i < steps; i++) {
        const u = (i + phase) / steps;
        const px = Math.round(tr.x + (target.x - tr.x) * u);
        const py = Math.round(tr.y + (target.y - tr.y) * u);
        ctx.fillStyle = 'rgba(248, 113, 113, 0.72)';
        ctx.fillRect(px - 1, py - 1, 3, 3);
      }
    }
  }

  private drawDragAimLine(
    ctx: CanvasRenderingContext2D,
    sim: GameSimulation,
    dragAim: DragAimState,
    timeSec: number
  ) {
    const origin = sim.territories[dragAim.originId];
    if (!origin) return;

    const target =
      dragAim.hoverTargetId !== null ? sim.territories[dragAim.hoverTargetId] : null;
    const endX = target && dragAim.isValidTarget ? target.x : dragAim.currentX;
    const endY = target && dragAim.isValidTarget ? target.y : dragAim.currentY;

    const dx = endX - origin.x;
    const dy = endY - origin.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 14) return;

    const lineColor = dragAim.isValidTarget
      ? dragAim.isFriendlyTarget
        ? '#4ade80'
        : '#fde047'
      : dragAim.hoverTargetId !== null && dragAim.hoverTargetId !== dragAim.originId
        ? '#f87171'
        : '#cbd5e1';

    const steps = Math.max(6, Math.min(24, Math.floor(dist / 12)));
    const phase = (timeSec * 3.0) % 1;

    ctx.save();
    for (let i = 1; i < steps; i++) {
      const u = (i + phase * 0.65) / steps;
      if (u >= 0.96) continue;
      const px = Math.round(origin.x + dx * u);
      const py = Math.round(origin.y + dy * u);
      ctx.fillStyle = '#0b101a';
      ctx.fillRect(px - 3, py - 3, 7, 7);
      ctx.fillStyle = lineColor;
      ctx.fillRect(px - 2, py - 2, 5, 5);
    }

    // Crisp pixel target arrowhead at pointer/castle endpoint
    const angle = Math.atan2(dy, dx);
    const tipX = Math.round(endX - Math.cos(angle) * (dragAim.isValidTarget ? 18 : 2));
    const tipY = Math.round(endY - Math.sin(angle) * (dragAim.isValidTarget ? 18 : 2));

    ctx.translate(tipX, tipY);
    ctx.rotate(angle);
    ctx.fillStyle = '#0b101a';
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-7, -8);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = lineColor;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-5, -5.5);
    ctx.lineTo(-2.5, 0);
    ctx.lineTo(-5, 5.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawCastleNameplate(ctx: CanvasRenderingContext2D, t: Territory) {
    const biome = BIOMES[t.biome];
    const label = `${t.name} · ${biome.name}`;

    ctx.save();
    ctx.font = '700 11px "Vazirmatn", sans-serif';
    const textW = ctx.measureText(label).width;
    const boxW = Math.round(textW + 16);
    const boxH = 20;
    const bx = Math.max(8, Math.min(WORLD_WIDTH - boxW - 8, Math.round(t.x - boxW * 0.5)));
    const by = Math.max(8, Math.round(t.y - 54));

    ctx.fillStyle = '#090e18';
    ctx.fillRect(bx - 1, by - 1, boxW + 2, boxH + 2);
    ctx.fillStyle = 'rgba(16, 24, 39, 0.94)';
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.fillStyle = '#334866';
    ctx.fillRect(bx, by + boxH - 1, boxW, 1);

    ctx.fillStyle = '#f2e8d5';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + boxW * 0.5, by + boxH * 0.5 + 0.5);
    ctx.restore();
  }

  private drawTacticalPreview(
    ctx: CanvasRenderingContext2D,
    sim: GameSimulation,
    fromId: number,
    toId: number,
    sendRatio: number
  ) {
    const preview = previewAttackOutcome(sim, fromId, toId, sendRatio);
    const target = sim.territories[toId];
    if (!preview || !target) return;

    let label: string;
    let borderColor: string;
    let textColor: string;

    if (preview.sendAmount < 1) {
      label = 'نیرو کافی نیست';
      borderColor = '#64748b';
      textColor = '#cbd5e1';
    } else if (preview.isFriendly) {
      label = `پشتیبانی +${preview.sendAmount}`;
      borderColor = '#4ade80';
      textColor = '#bbf7d0';
    } else if (preview.willConquer) {
      label = `حمله ${preview.sendAmount} · پیروزی محتمل`;
      borderColor = '#fde047';
      textColor = '#fef08a';
    } else if (preview.advantageRatio >= 0.65) {
      label = `حمله ${preview.sendAmount} · نبرد نزدیک`;
      borderColor = '#fb923c';
      textColor = '#fed7aa';
    } else {
      label =
        preview.defenseBonusPct > 0
          ? `حمله ${preview.sendAmount} · دفاع -${preview.defenseBonusPct}%`
          : `حمله ${preview.sendAmount} · دفاع سنگین`;
      borderColor = '#f87171';
      textColor = '#fecaca';
    }

    ctx.save();
    ctx.font = '700 11px "Vazirmatn", sans-serif';
    const textW = ctx.measureText(label).width;
    const boxW = Math.round(textW + 18);
    const boxH = 22;
    const bx = Math.max(8, Math.min(WORLD_WIDTH - boxW - 8, Math.round(target.x - boxW * 0.5)));
    const by = Math.max(8, Math.round(target.y - 56));

    ctx.fillStyle = '#090e18';
    ctx.fillRect(bx - 2, by - 2, boxW + 4, boxH + 4);
    ctx.fillStyle = borderColor;
    ctx.fillRect(bx - 1, by - 1, boxW + 2, boxH + 2);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(bx, by, boxW, boxH);

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + boxW * 0.5, by + boxH * 0.5 + 0.5);
    ctx.restore();
  }

  private drawPixelBrackets(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    color: string
  ) {
    const x0 = Math.round(cx - r);
    const y0 = Math.round(cy - r + 4);
    const x1 = Math.round(cx + r);
    const y1 = Math.round(cy + r - 6);
    const len = 9;
    const th = 3;

    ctx.fillStyle = '#0b101a';
    ctx.fillRect(x0 - 1, y0 - 1, len + 2, th + 2);
    ctx.fillRect(x0 - 1, y0 - 1, th + 2, len + 2);
    ctx.fillRect(x1 - len - 1, y0 - 1, len + 2, th + 2);
    ctx.fillRect(x1 - th - 1, y0 - 1, th + 2, len + 2);
    ctx.fillRect(x0 - 1, y1 - th - 1, len + 2, th + 2);
    ctx.fillRect(x0 - 1, y1 - len - 1, th + 2, len + 2);
    ctx.fillRect(x1 - len - 1, y1 - th - 1, len + 2, th + 2);
    ctx.fillRect(x1 - th - 1, y1 - len - 1, th + 2, len + 2);

    ctx.fillStyle = color;
    ctx.fillRect(x0, y0, len, th);
    ctx.fillRect(x0, y0, th, len);
    ctx.fillRect(x1 - len, y0, len, th);
    ctx.fillRect(x1 - th, y0, th, len);
    ctx.fillRect(x0, y1 - th, len, th);
    ctx.fillRect(x0, y1 - len, th, len);
    ctx.fillRect(x1 - len, y1 - th, len, th);
    ctx.fillRect(x1 - th, y1 - len, th, len);
  }

  /** Draws persistent animated emerald pixel conveyor chevrons for active Auto-Supply lines */
  private drawSupplyLines(ctx: CanvasRenderingContext2D, sim: GameSimulation, timeSec: number) {
    ctx.save();
    for (const from of sim.territories) {
      if (from.owner !== 0 || from.supplyTargetId === null) continue;
      const to = sim.territories[from.supplyTargetId];
      if (!to || to.owner !== 0) continue;

      const via = from.borderCrossings[to.id] ?? {
        x: (from.x + to.x) * 0.5,
        y: (from.y + to.y) * 0.5,
      };

      // Soft emerald supply rail under chevrons
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.quadraticCurveTo(via.x, via.y, to.x, to.y);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.36)';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Animated pixel supply chevrons flowing from rear -> frontline
      const chevronCount = 6;
      const phase = (timeSec * 0.85) % 1;
      for (let i = 0; i < chevronCount; i++) {
        const u = (i + phase) / chevronCount;
        if (u < 0.14 || u > 0.88) continue;
        const mt = 1 - u;
        const px = mt * mt * from.x + 2 * mt * u * via.x + u * u * to.x;
        const py = mt * mt * from.y + 2 * mt * u * via.y + u * u * to.y;

        // Tangent along Quadratic Bezier for arrow direction
        const tx = 2 * mt * (via.x - from.x) + 2 * u * (to.x - via.x);
        const ty = 2 * mt * (via.y - from.y) + 2 * u * (to.y - via.y);
        const tLen = Math.hypot(tx, ty) || 1;
        const dx = tx / tLen;
        const dy = ty / tLen;
        const nx = -dy;
        const ny = dx;

        const rx = Math.round(px);
        const ry = Math.round(py);
        ctx.fillStyle = '#090e18';
        ctx.fillRect(rx - 3, ry - 3, 6, 6);
        ctx.fillStyle = '#6ee7b7';
        ctx.fillRect(rx - 2, ry - 2, 4, 4);

        // Two trailing chevron wings
        for (const side of [-1, 1]) {
          const wx = Math.round(px - dx * 4 + nx * side * 4);
          const wy = Math.round(py - dy * 4 + ny * side * 4);
          ctx.fillStyle = '#090e18';
          ctx.fillRect(wx - 2, wy - 2, 4, 4);
          ctx.fillStyle = '#10b981';
          ctx.fillRect(wx - 1, wy - 1, 2, 2);
        }
      }
    }
    ctx.restore();
  }

  private drawSelectedRoutes(
    ctx: CanvasRenderingContext2D,
    sim: GameSimulation,
    selected: Territory,
    hoveredId: number | null,
    timeSec: number,
    supplyMode = false
  ) {
    ctx.save();
    for (const nId of selected.neighbors) {
      const target = sim.territories[nId];
      const isFriendly = target.owner === selected.owner;
      // In Supply Mode, highlight only adjacent friendly castles cleanly
      if (supplyMode && !isFriendly) continue;

      const via = selected.borderCrossings[nId] ?? {
        x: (selected.x + target.x) * 0.5,
        y: (selected.y + target.y) * 0.5,
      };
      const isHovered = hoveredId === nId;

      const dotCount = 14;
      const phase = (timeSec * (supplyMode ? 2.1 : 1.4)) % 1;
      for (let i = 0; i < dotCount; i++) {
        const u = (i + phase) / dotCount;
        if (u < 0.08 || u > 0.92) continue;
        const mt = 1 - u;
        const px = Math.round(mt * mt * selected.x + 2 * mt * u * via.x + u * u * target.x);
        const py = Math.round(mt * mt * selected.y + 2 * mt * u * via.y + u * u * target.y);

        const sz = isHovered || supplyMode ? 5 : 4;
        ctx.fillStyle = '#0b101a';
        ctx.fillRect(px - 1, py - 1, sz + 2, sz + 2);
        ctx.fillStyle = supplyMode
          ? '#34d399'
          : isFriendly
            ? isHovered
              ? '#86efac'
              : '#4ade80'
            : isHovered
              ? '#fef08a'
              : '#fbbf24';
        ctx.fillRect(px, py, sz, sz);
      }

      const bx = Math.round(via.x);
      const by = Math.round(via.y);
      ctx.fillStyle = '#0b101a';
      ctx.fillRect(bx - 5, by - 5, 10, 10);
      ctx.fillStyle = supplyMode ? '#6ee7b7' : isFriendly ? '#4ade80' : '#fbbf24';
      ctx.fillRect(bx - 3, by - 3, 6, 6);
    }
    ctx.restore();
  }

  private drawPixelCastle(
    ctx: CanvasRenderingContext2D,
    t: Territory,
    isSelected: boolean,
    isValidTarget: boolean,
    isThreatened: boolean,
    timeSec: number,
    isTitleBackdrop: boolean
  ) {
    const faction = t.owner === -1 ? null : FACTIONS[t.owner];
    const glowColor = faction ? faction.borderGlow : NEUTRAL_STYLE.borderGlow;
    const sprites = this.atlas.getFaction(t.owner);

    const cx = Math.round(t.x);
    const cy = Math.round(t.y);

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // 1. Capture expanding pixel shockwave ring
    if (t.capturePulse > 0.01) {
      const prog = 1 - t.capturePulse;
      const rad = Math.round(24 + prog * 44);
      ctx.strokeStyle = glowColor;
      ctx.globalAlpha = t.capturePulse * 0.9;
      ctx.lineWidth = 3;
      ctx.strokeRect(cx - rad, cy - Math.round(rad * 0.78), rad * 2, Math.round(rad * 1.56));
      ctx.globalAlpha = 1;
    }

    // 2. Selection / Target / Threat pixel brackets
    if (isSelected) {
      const stepOffset = Math.sin(timeSec * 6) > 0 ? 1 : 0;
      this.drawPixelBrackets(ctx, cx, cy - 4, 34 + stepOffset, '#fde047');
    } else if (isThreatened) {
      const blink = Math.floor(timeSec * 6) % 2 === 0;
      this.drawPixelBrackets(ctx, cx, cy - 4, 34, blink ? '#ef4444' : '#fca5a5');
    } else if (isValidTarget) {
      this.drawPixelBrackets(
        ctx,
        cx,
        cy - 4,
        30,
        t.owner === 0 ? 'rgba(74, 222, 128, 0.75)' : 'rgba(251, 191, 36, 0.75)'
      );
    }

    // 3. Royal Shield Commander Power Glowing Pixel Barrier
    if (t.shieldTimer > 0) {
      const pulse = Math.sin(timeSec * 10) > 0 ? '#93c5fd' : '#38bdf8';
      ctx.strokeStyle = pulse;
      ctx.lineWidth = 3;
      ctx.strokeRect(cx - 32, cy - 30, 64, 48);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.fillRect(cx - 30, cy - 28, 60, 44);
    }

    // 4. Pixel Ground Shadow under Castle
    ctx.fillStyle = 'rgba(8, 12, 22, 0.55)';
    ctx.fillRect(cx - 24, cy + 7, 48, 7);
    ctx.fillRect(cx - 20, cy + 12, 40, 3);

    // 5. Constructed Pixel-Art Buildings with Subtle 16-Bit Pulsing Animations
    if (t.hasMine) {
      const mw = this.atlas.mine.width * 2;
      const mh = this.atlas.mine.height * 2;
      const mx = cx - 36;
      const my = cy - 5;
      // Subtle stepped golden breathing aura beneath the mine entrance
      const minePulse = 0.5 + 0.5 * Math.sin(timeSec * 3.4 + t.id * 1.15);
      const mineStep = Math.floor(minePulse * 4);
      if (mineStep >= 1) {
        ctx.fillStyle = `rgba(250, 204, 21, ${(0.08 + mineStep * 0.055).toFixed(3)})`;
        ctx.fillRect(mx + 2, my + mh - 5, mw - 4, 5);
      }
      ctx.drawImage(this.atlas.mine, mx, my, mw, mh);
      // Pulsing golden tunnel lantern & ore gleam pixels inside mine arch
      const lanternColors = ['#92400e', '#d97706', '#fbbf24', '#fef08a'];
      ctx.fillStyle = lanternColors[Math.min(3, mineStep)];
      ctx.fillRect(mx + 9, my + 11, 4, 4);
      if (mineStep >= 2) {
        ctx.fillStyle = '#fef9c3';
        ctx.fillRect(mx + 10, my + 12, 2, 2);
      }
      // Subtle alternating ore vein sparkle on rock mound
      if (mineStep === 3) {
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(mx + 5, my + 7, 2, 2);
        ctx.fillRect(mx + 15, my + 8, 2, 2);
      }
    }

    if (t.hasBarracks) {
      const bw = sprites.barracks.width * 2;
      const bh = sprites.barracks.height * 2;
      const bx = cx + 16;
      const by = cy - 8;
      const barPulse = 0.5 + 0.5 * Math.sin(timeSec * 4.8 + t.id * 1.4);
      const barStep = Math.floor(barPulse * 3);
      ctx.drawImage(sprites.barracks, bx, by, bw, bh);
      // Subtle pulsing warm torch brazier at barracks gate
      ctx.fillStyle = barStep === 2 ? '#fef08a' : barStep === 1 ? '#fb923c' : '#ea580c';
      ctx.fillRect(bx + 9, by + 11, 3, 3);
      if (barStep === 2) {
        ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
        ctx.fillRect(bx + 8, by + 10, 5, 5);
      }
      // Subtle pennant tip flutter
      const flagOffset = Math.floor(timeSec * 4 + t.id) % 2;
      ctx.fillStyle = faction ? faction.borderGlow : '#f87171';
      ctx.fillRect(bx + 11 + flagOffset, by + 1, 3, 2);
    }

    if (t.hasTower) {
      const tw = this.atlas.tower.width * 2;
      const th = this.atlas.tower.height * 2;
      const tx = cx - 33;
      const ty = cy - 28;
      const towerPulse = 0.5 + 0.5 * Math.sin(timeSec * 2.9 + t.id * 0.9);
      const towerStep = Math.floor(towerPulse * 4);
      ctx.drawImage(this.atlas.tower, tx, ty, tw, th);
      // Subtle pulsing arcane cyan sentinel beacon at tower crown
      const beaconColors = ['#0369a1', '#0284c7', '#38bdf8', '#bae6fd'];
      ctx.fillStyle = beaconColors[Math.min(3, towerStep)];
      ctx.fillRect(tx + 9, ty + 3, 4, 3);
      if (towerStep >= 2) {
        ctx.fillStyle = `rgba(125, 211, 252, ${towerStep === 3 ? 0.42 : 0.22})`;
        ctx.fillRect(tx + 7, ty + 1, 8, 7);
      }
      if (t.towerFireTimer > 0) {
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(cx - 25, cy - 33, 7, 3);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(cx - 18, cy - 36, 5, 3);
      }
    }

    if (t.hasForge) {
      const fw = this.atlas.forge.width * 2;
      const fh = this.atlas.forge.height * 2;
      const fx = cx + 14;
      const fy = cy - 25;
      // Rhythmic molten furnace pit pulse (warm volcanic crimson -> bright molten gold)
      const forgePulse = 0.5 + 0.5 * Math.sin(timeSec * 4.3 + t.id * 1.7);
      const forgeStep = Math.floor(forgePulse * 4);
      // Subtle breathing molten heat halo at furnace mouth base
      ctx.fillStyle = `rgba(249, 115, 22, ${(0.1 + forgeStep * 0.065).toFixed(3)})`;
      ctx.fillRect(fx + 3, fy + fh - 6, fw - 6, 6);
      ctx.drawImage(this.atlas.forge, fx, fy, fw, fh);
      // Dark furnace mouth breathing molten core
      const hearthColors = ['#9a3412', '#ea580c', '#f59e0b', '#fde047'];
      ctx.fillStyle = hearthColors[Math.min(3, forgeStep)];
      ctx.fillRect(fx + 6, fy + 12, 6, 5);
      if (forgeStep >= 2) {
        ctx.fillStyle = forgeStep === 3 ? '#fef9c3' : '#fde047';
        ctx.fillRect(fx + 8, fy + 13, 2, 3);
      }
      // Subtle heated anvil spark pulse
      if (forgeStep === 3) {
        ctx.fillStyle = '#fb923c';
        ctx.fillRect(fx + 14, fy + 14, 2, 2);
      }
    }

    // 6. Main 16-Bit Pixel-Art Fortress Sprite (2x crisp integer pixel scale)
    const castleSprite = t.hitFlash > 0 ? sprites.castleFlash : sprites.castle;
    const cw = castleSprite.width * 2;
    const ch = castleSprite.height * 2;
    ctx.drawImage(castleSprite, cx - Math.round(cw * 0.5), cy - Math.round(ch * 0.72), cw, ch);

    // Subtle warm gate hearth pulse on active faction castles (living fortress feel)
    if (t.owner >= 0 && t.hitFlash <= 0) {
      const gateStep = Math.floor((0.5 + 0.5 * Math.sin(timeSec * 3.1 + t.id * 2.1)) * 3);
      if (gateStep >= 1) {
        ctx.fillStyle = gateStep === 2 ? 'rgba(253, 224, 71, 0.5)' : 'rgba(249, 115, 22, 0.32)';
        ctx.fillRect(cx - 2, cy - 1, 4, 4);
      }
    }

    // Subtle animated pixel banner wave pixel overlay
    const bannerFrame = Math.floor(timeSec * 5 + t.id) % 3;
    if (bannerFrame !== 0 && t.hitFlash <= 0) {
      ctx.fillStyle = faction ? faction.color : NEUTRAL_STYLE.color;
      ctx.fillRect(cx + 2, cy - Math.round(ch * 0.72) + (bannerFrame === 1 ? 4 : 6), 4, 2);
    }

    // Pulsing Pixel Threat Exclamation Badge on Player Castle under Attack
    if (isThreatened && !isTitleBackdrop) {
      const bob = Math.floor(timeSec * 8) % 2 === 0 ? -1 : 1;
      const ax = cx + 22;
      const ay = cy - 38 + bob;
      ctx.fillStyle = '#090e18';
      ctx.fillRect(ax - 7, ay - 7, 14, 14);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(ax - 6, ay - 6, 12, 12);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(ax - 1, ay - 4, 2, 5);
      ctx.fillRect(ax - 1, ay + 2, 2, 2);
    }

    // 7. Crisp Pixel-Beveled Tactical Data Plaque below Castle
    if (!isTitleBackdrop) {
      const plateW = 86;
      const plateH = 23;
      const px = cx - Math.round(plateW / 2);
      const py = cy + 14;

      ctx.fillStyle = '#090e18';
      ctx.fillRect(px - 2, py - 2, plateW + 4, plateH + 4);
      ctx.fillStyle = isSelected ? '#fbbf24' : isThreatened ? '#f87171' : glowColor;
      ctx.fillRect(px - 1, py - 1, plateW + 2, plateH + 2);
      ctx.fillStyle = '#101827';
      ctx.fillRect(px, py, plateW, plateH);

      // Tiny pixel sword icon next to Military
      ctx.fillStyle = '#f87171';
      ctx.fillRect(px + 6, py + 11, 2, 2);
      ctx.fillRect(px + 8, py + 9, 2, 2);
      ctx.fillRect(px + 10, py + 7, 2, 2);
      ctx.fillRect(px + 12, py + 5, 2, 2);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(px + 7, py + 12, 2, 2);

      // Military Count (bold bright white)
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${Math.floor(t.military)}`, cx - 13, py + 10);

      // Pixel divider
      ctx.fillStyle = '#293852';
      ctx.fillRect(cx + 2, py + 3, 2, 13);

      // Tiny pixel helmet/person icon next to Manpower
      ctx.fillStyle = '#d6b472';
      ctx.fillRect(cx + 9, py + 6, 4, 4);
      ctx.fillRect(cx + 7, py + 11, 8, 4);

      // Manpower Count
      ctx.font = '500 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`${Math.floor(t.manpower)}`, cx + 28, py + 10);

      // Crisp Pixel Manpower Progress Strip along bottom of plaque
      const maxMp = t.hasMine ? ECONOMY.MINE_MAX_MANPOWER : ECONOMY.BASE_MAX_MANPOWER;
      const ratio = Math.min(1, t.manpower / maxMp);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(px + 2, py + plateH - 4, plateW - 4, 3);
      ctx.fillStyle = t.hasBarracks ? '#fbbf24' : glowColor;
      ctx.fillRect(px + 2, py + plateH - 4, Math.round((plateW - 4) * ratio), 3);
    }

    ctx.restore();
  }

  /** Renders an animated 16-bit pixel-art marching soldier squad (2–4 animated warriors + marching dust + count badge) */
  private drawPixelSoldierSquad(
    ctx: CanvasRenderingContext2D,
    tr: GameSimulation['troops'][number],
    timeSec: number,
    blitzBoost: boolean
  ) {
    const faction = FACTIONS[tr.owner];
    const sprites = this.atlas.getFaction(tr.owner);

    const cx = Math.round(tr.x);
    const cy = Math.round(tr.y);
    const animSpeed = blitzBoost ? 16 : 9;
    const frameIdx = Math.floor(timeSec * animSpeed + tr.id * 1.7) % 2;

    const offsets: Array<{ ox: number; oy: number; elite: boolean; phase: number }> =
      tr.count >= 28 || tr.isElite
        ? [
            { ox: -10, oy: -5, elite: false, phase: 1 },
            { ox: 10, oy: -4, elite: false, phase: 0 },
            { ox: -7, oy: 7, elite: false, phase: 0 },
            { ox: 3, oy: 2, elite: true, phase: 1 },
          ]
        : tr.count >= 14
          ? [
              { ox: -9, oy: -4, elite: false, phase: 1 },
              { ox: 9, oy: -2, elite: false, phase: 0 },
              { ox: 0, oy: 5, elite: false, phase: 1 },
            ]
          : [
              { ox: -7, oy: -2, elite: false, phase: 0 },
              { ox: 7, oy: 3, elite: false, phase: 1 },
            ];

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    const trailDir = tr.facingLeft ? 1 : -1;

    // Subtle marching dust pixel specks behind army boots
    const dustPhase = Math.floor(timeSec * 10 + tr.id) % 3;
    ctx.fillStyle = 'rgba(229, 214, 179, 0.38)';
    ctx.fillRect(cx + trailDir * (12 + dustPhase * 3), cy + 8, 3, 3);
    ctx.fillRect(cx + trailDir * (16 + ((dustPhase + 1) % 3) * 3), cy + 5, 2, 2);

    // Speed-line pixel trail during Blitz Commander Power
    if (blitzBoost) {
      ctx.fillStyle = 'rgba(125, 211, 252, 0.78)';
      ctx.fillRect(cx + trailDir * 16, cy - 6, 10, 2);
      ctx.fillRect(cx + trailDir * 19, cy + 2, 12, 2);
      ctx.fillRect(cx + trailDir * 14, cy + 8, 8, 2);
    }

    // Draw each animated pixel warrior in formation
    for (const unit of offsets) {
      const useA = (frameIdx + unit.phase) % 2 === 0;
      const spr = unit.elite
        ? useA
          ? sprites.eliteA
          : sprites.eliteB
        : useA
          ? sprites.soldierA
          : sprites.soldierB;

      const scale = 1.65;
      const dw = Math.round(spr.width * scale);
      const dh = Math.round(spr.height * scale);
      const ux = Math.round(cx + unit.ox);
      const uy = Math.round(cy + unit.oy);

      ctx.fillStyle = 'rgba(9, 13, 22, 0.52)';
      ctx.fillRect(ux - 6, uy + Math.round(dh * 0.34), 12, 3);

      ctx.save();
      ctx.translate(ux, uy);
      if (tr.facingLeft) {
        ctx.scale(-1, 1);
      }
      ctx.drawImage(spr, -Math.round(dw * 0.5), -Math.round(dh * 0.55), dw, dh);
      ctx.restore();
    }

    // Crisp Pixel Troop Count Plate floating directly above the squad
    const countText = `${Math.floor(tr.count)}`;
    const badgeW = Math.max(24, countText.length * 8 + 10);
    const badgeH = 15;
    const bx = cx - Math.round(badgeW / 2);
    const by = cy - 26;

    ctx.fillStyle = '#090e18';
    ctx.fillRect(bx - 2, by - 2, badgeW + 4, badgeH + 4);
    ctx.fillStyle = tr.isElite ? '#fde047' : faction.borderGlow;
    ctx.fillRect(bx - 1, by - 1, badgeW + 2, badgeH + 2);
    ctx.fillStyle = faction.color;
    ctx.fillRect(bx, by, badgeW, badgeH);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(countText, cx, by + 8);

    ctx.restore();
  }

  private drawPixelRings(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const r of this.vfx.rings) {
      if (!r.active) continue;
      const t = Math.min(1, r.life / r.maxLife);
      const easeOut = 1 - (1 - t) * (1 - t);
      const rad = Math.round(r.startRadius + (r.maxRadius - r.startRadius) * easeOut);
      const alpha = Math.max(0, 1 - t * t);
      const rx = Math.round(r.x);
      const ry = Math.round(r.y);

      if (r.kind === 'dispatch') {
        // Directional pixel wave & marching chevron surging along dispatch vector
        const tipX = Math.round(rx + r.dx * rad);
        const tipY = Math.round(ry + r.dy * rad);
        const perpX = -r.dy;
        const perpY = r.dx;

        ctx.globalAlpha = alpha * 0.85;
        ctx.fillStyle = '#090e18';
        ctx.fillRect(tipX - 3, tipY - 3, 6, 6);
        ctx.fillStyle = r.color;
        ctx.fillRect(tipX - 2, tipY - 2, 4, 4);

        // Two chevron wings trailing behind the leading tip
        for (const side of [-1, 1]) {
          const wx = Math.round(tipX - r.dx * 5 + perpX * side * 5);
          const wy = Math.round(tipY - r.dy * 5 + perpY * side * 5);
          ctx.fillStyle = '#090e18';
          ctx.fillRect(wx - 2, wy - 2, 5, 5);
          ctx.fillStyle = r.color;
          ctx.fillRect(wx - 1, wy - 1, 3, 3);
        }

        // Subtle gate muster square ripple
        ctx.globalAlpha = alpha * 0.45;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = r.lineWidth;
        const gateR = Math.round(rad * 0.65);
        ctx.strokeRect(rx - gateR, ry - Math.round(gateR * 0.75), gateR * 2, Math.round(gateR * 1.5));
      } else {
        // Stepped 16-bit impact / shield-block / capture shockwave ring
        const halfW = rad;
        const halfH = Math.round(rad * 0.78);

        ctx.globalAlpha = alpha * 0.55;
        ctx.strokeStyle = '#090e18';
        ctx.lineWidth = r.lineWidth + 2;
        ctx.strokeRect(rx - halfW, ry - halfH, halfW * 2, halfH * 2);

        ctx.globalAlpha = alpha * 0.92;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = r.lineWidth;
        ctx.strokeRect(rx - halfW, ry - halfH, halfW * 2, halfH * 2);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const p of this.vfx.particles) {
      if (!p.active) continue;
      const progress = Math.min(1, p.life / p.maxLife);
      const alpha = Math.max(0, 1 - progress * progress);
      const px = Math.round(p.x);
      const py = Math.round(p.y);
      const s = Math.round(p.size);

      if (p.kind === 'spark') {
        // High-speed directional sword/muster spark with bright head & hot tail
        ctx.globalAlpha = alpha;
        const speed = Math.hypot(p.vx, p.vy) || 1;
        const tx = Math.round(px - (p.vx / speed) * (s + 2));
        const ty = Math.round(py - (p.vy / speed) * (s + 2));
        ctx.fillStyle = p.secondaryColor;
        ctx.fillRect(tx, ty, Math.max(2, s - 1), Math.max(2, s - 1));
        ctx.fillStyle = '#090e18';
        ctx.fillRect(px - 1, py - 1, s + 2, s + 2);
        ctx.fillStyle = progress < 0.45 ? p.color : p.secondaryColor;
        ctx.fillRect(px, py, s, s);
      } else if (p.kind === 'dust') {
        // Expanding pixel boot-dust / siege smoke cloud
        const puffSize = s + (progress > 0.45 ? 2 : progress > 0.2 ? 1 : 0);
        const half = Math.floor(puffSize * 0.5);
        ctx.globalAlpha = alpha * 0.72;
        ctx.fillStyle = progress > 0.55 ? p.secondaryColor : p.color;
        ctx.fillRect(px - half, py - half, puffSize, puffSize);
        if (puffSize >= 4) {
          ctx.globalAlpha = alpha * 0.42;
          ctx.fillRect(px - half - 1, py - half + 1, puffSize + 2, puffSize - 2);
        }
      } else if (p.kind === 'debris') {
        // Outlined tumbling castle masonry stone chunk
        ctx.globalAlpha = Math.min(1, alpha * 1.25);
        ctx.fillStyle = '#090e18';
        ctx.fillRect(px - 1, py - 1, s + 2, s + 2);
        ctx.fillStyle = p.color;
        ctx.fillRect(px, py, s, s);
        if (s >= 3) {
          ctx.fillStyle = p.secondaryColor;
          ctx.fillRect(px + s - 1, py + s - 1, 1, 1);
        }
      } else if (p.kind === 'ember') {
        // Glowing drifting ember pixel
        ctx.globalAlpha = alpha * 0.95;
        ctx.fillStyle = progress < 0.5 ? p.color : p.secondaryColor;
        ctx.fillRect(px, py, s, s);
      } else {
        // Crisp 16-bit '+' diamond glint sparkle
        ctx.globalAlpha = alpha;
        const arm = Math.max(2, s);
        ctx.fillStyle = p.secondaryColor;
        ctx.fillRect(px - arm, py, arm * 2 + 1, 1);
        ctx.fillRect(px, py - arm, 1, arm * 2 + 1);
        ctx.fillStyle = p.color;
        ctx.fillRect(px - 1, py - 1, 3, 3);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawFloatingTexts(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 12px "Vazirmatn", sans-serif';
    for (const f of this.texts) {
      if (!f.active) continue;
      const alpha = Math.max(0, 1 - Math.pow(f.life / f.maxLife, 1.8));
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(9, 14, 24, 0.95)';
      ctx.strokeText(f.text, Math.round(f.x), Math.round(f.y));
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, Math.round(f.x), Math.round(f.y));
    }
    ctx.restore();
  }
}
