import { useCallback, useEffect, useRef, useState } from 'react';
import { CommandSidebar } from './components/CommandSidebar';
import { MobileCommandBar } from './components/MobileCommandBar';
import { RotatePhoneOverlay } from './components/RotatePhoneOverlay';
import { ShortcutsModal } from './components/ShortcutsModal';
import { StatusModal } from './components/StatusModal';
import { TitleOverlay } from './components/TitleOverlay';
import { TopHudBar } from './components/TopHudBar';
import { soundEngine } from './game/audio';
import { DIFFICULTIES, SEND_RATIOS } from './game/constants';
import { GameRenderer } from './game/renderer';
import {
  buildStructure,
  computeFactionPowers,
  createInitialMatch,
  cycleOwnedTerritory,
  dispatchTroops,
  getTerritoryAtPoint,
  getTerritoryRates,
  getWeakestEnemyNeighbor,
  rallyReinforcements,
  stepSimulation,
  triggerCommanderPower,
} from './game/simulation';
import type {
  BuildingType,
  Difficulty,
  DragAimState,
  GamePhase,
  GameSimulation,
  HudSnapshot,
  PowerType,
  SimEvent,
} from './game/types';
import { useViewportMode } from './hooks/useViewportMode';

const SPEED_STEPS = [1, 1.5, 2] as const;
type GameSpeed = (typeof SPEED_STEPS)[number];

const DRAG_THRESHOLD_PX = 12;
const DOUBLE_TAP_WINDOW_MS = 320;

interface PointerSession {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  originId: number | null;
  isTouch: boolean;
  hasDragged: boolean;
}

function makeRandomSeed(): number {
  return Math.floor(10000 + Math.random() * 900000);
}

function getInitialAutoStart(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('autostart') === '1';
}

function getInitialSeed(): number {
  if (typeof window === 'undefined') return 24681;
  const params = new URLSearchParams(window.location.search);
  const s = Number(params.get('seed'));
  return Number.isFinite(s) && s > 0 ? Math.floor(s) : makeRandomSeed();
}

function createIdleDragAim(): DragAimState {
  return {
    active: false,
    originId: -1,
    currentX: 0,
    currentY: 0,
    hoverTargetId: null,
    isValidTarget: false,
    isFriendlyTarget: false,
  };
}

function buildHudSnapshot(
  sim: GameSimulation,
  phase: GamePhase,
  sendRatio: number,
  selectedId: number | null
): HudSnapshot {
  const sel = selectedId !== null ? sim.territories[selectedId] ?? null : null;
  let playerTerritories = 0;
  let playerMilitary = 0;
  let playerManpower = 0;

  for (const t of sim.territories) {
    if (t.owner === 0) {
      playerTerritories += 1;
      playerMilitary += Math.floor(t.military);
      playerManpower += Math.floor(t.manpower);
    }
  }
  for (const tr of sim.troops) {
    if (tr.owner === 0) {
      playerMilitary += Math.floor(tr.count);
    }
  }

  let selectedTerritory: HudSnapshot['selectedTerritory'] = null;
  if (sel) {
    const bonus = sel.owner <= 0 ? 1.0 : DIFFICULTIES[sim.difficulty].aiGrowthBonus;
    const rates = getTerritoryRates(sel, bonus);
    selectedTerritory = {
      id: sel.id,
      name: sel.name,
      biome: sel.biome,
      owner: sel.owner,
      manpower: sel.manpower,
      maxManpower: rates.maxManpower,
      military: sel.military,
      manpowerRate: rates.manpowerRate,
      conversionRate: rates.netMilitaryPerSec,
      hasBarracks: sel.hasBarracks,
      hasTower: sel.hasTower,
      hasMine: sel.hasMine,
      hasForge: sel.hasForge,
      shieldTimer: sel.shieldTimer,
      neighborCount: sel.neighbors.length,
    };
  }

  return {
    phase,
    outcome: sim.outcome,
    difficulty: sim.difficulty,
    sendRatio,
    selectedId,
    selectedTerritory,
    powers: {
      cooldowns: { ...sim.powers.cooldowns },
      blitzTimer: sim.powers.blitzTimer,
    },
    playerTerritories,
    totalTerritories: sim.territories.length,
    playerMilitary,
    playerManpower,
    elapsedSeconds: sim.stats.elapsedSeconds,
    factionPowers: computeFactionPowers(sim),
    stats: { ...sim.stats },
    mapSeed: sim.seed,
  };
}

export default function App() {
  const autoStart = getInitialAutoStart();
  const initialDifficulty: Difficulty = 'normal';
  const initialSeed = getInitialSeed();
  const viewport = useViewportMode();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const simRef = useRef<GameSimulation>(createInitialMatch(initialSeed, initialDifficulty));
  const phaseRef = useRef<GamePhase>(autoStart ? 'playing' : 'title');
  const difficultyRef = useRef<Difficulty>(initialDifficulty);
  const sendRatioRef = useRef<number>(0.5);
  const speedRef = useRef<GameSpeed>(1);
  const selectedIdRef = useRef<number | null>(
    simRef.current.territories.find((t) => t.owner === 0)?.id ?? null
  );
  const hoveredIdRef = useRef<number | null>(null);
  const dragAimRef = useRef<DragAimState>(createIdleDragAim());
  const pointerSessionRef = useRef<PointerSession | null>(null);
  const lastTapRef = useRef<{ id: number; time: number } | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const shortcutsOpenRef = useRef<boolean>(false);

  const [muted, setMuted] = useState(false);
  const [gameSpeed, setGameSpeed] = useState<GameSpeed>(1);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [portraitDismissed, setPortraitDismissed] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(() =>
    buildHudSnapshot(
      simRef.current,
      phaseRef.current,
      sendRatioRef.current,
      selectedIdRef.current
    )
  );

  // Reset portrait dismiss if user rotates to landscape and back later? Keep dismissed once user explicitly chose portrait.
  useEffect(() => {
    shortcutsOpenRef.current = shortcutsOpen;
  }, [shortcutsOpen]);

  const syncHud = useCallback(() => {
    setHud(
      buildHudSnapshot(
        simRef.current,
        phaseRef.current,
        sendRatioRef.current,
        selectedIdRef.current
      )
    );
  }, []);

  const showToast = useCallback((text: string, tone: 'error' | 'info' = 'error') => {
    setToast({ text, tone });
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 2200);
  }, []);

  const handleEventsAudio = useCallback((events: SimEvent[], isPlaying: boolean) => {
    if (!isPlaying || events.length === 0) return;
    let playedClash = false;
    for (const ev of events) {
      if (ev.type === 'victory') {
        soundEngine.playVictory();
      } else if (ev.type === 'defeat') {
        soundEngine.playDefeat();
      } else if (ev.type === 'capture') {
        soundEngine.playCapture(Boolean(ev.capturedByPlayer));
      } else if (ev.type === 'tower_block') {
        soundEngine.playTowerBlock();
      } else if (ev.type === 'clash' && !playedClash) {
        soundEngine.playClash();
        playedClash = true;
      } else if (ev.type === 'build' && ev.owner === 0) {
        soundEngine.playBuild();
      } else if (ev.type === 'power' && ev.owner === 0) {
        soundEngine.playPower();
      }
    }
  }, []);

  const startFreshMatch = useCallback(
    (seed?: number, nextPhase: GamePhase = 'playing') => {
      const nextSeed = seed ?? makeRandomSeed();
      simRef.current = createInitialMatch(nextSeed, difficultyRef.current);
      rendererRef.current?.clearEffects();
      selectedIdRef.current =
        simRef.current.territories.find((t) => t.owner === 0)?.id ?? null;
      hoveredIdRef.current = null;
      dragAimRef.current = createIdleDragAim();
      pointerSessionRef.current = null;
      lastTapRef.current = null;
      phaseRef.current = nextPhase;
      document.body.dataset.state = nextPhase;
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setShortcutsOpen(false);
      setToast(null);
      syncHud();
    },
    [syncHud]
  );

  const handleStartFromTitle = useCallback(() => {
    soundEngine.playSelect();
    startFreshMatch(simRef.current.seed, 'playing');
  }, [startFreshMatch]);

  const handleSelectDifficulty = useCallback(
    (d: Difficulty) => {
      difficultyRef.current = d;
      simRef.current.difficulty = d;
      soundEngine.playSelect();
      syncHud();
    },
    [syncHud]
  );

  const handlePreviewNewMap = useCallback(() => {
    soundEngine.playSelect();
    startFreshMatch(makeRandomSeed(), 'title');
  }, [startFreshMatch]);

  const handleNewMapInGame = useCallback(() => {
    soundEngine.playSelect();
    startFreshMatch(makeRandomSeed(), 'playing');
  }, [startFreshMatch]);

  const handleTogglePause = useCallback(() => {
    if (phaseRef.current === 'playing') {
      phaseRef.current = 'paused';
      document.body.dataset.state = 'paused';
      soundEngine.playSelect();
      syncHud();
    } else if (phaseRef.current === 'paused') {
      phaseRef.current = 'playing';
      document.body.dataset.state = 'playing';
      soundEngine.playSelect();
      syncHud();
    }
  }, [syncHud]);

  const handleReturnTitle = useCallback(() => {
    soundEngine.playSelect();
    startFreshMatch(makeRandomSeed(), 'title');
  }, [startFreshMatch]);

  const handleToggleMute = useCallback(() => {
    const next = soundEngine.toggleMute();
    setMuted(next);
  }, []);

  const handleCycleSpeed = useCallback(() => {
    const idx = SPEED_STEPS.indexOf(speedRef.current);
    const nextIdx = (idx + 1) % SPEED_STEPS.length;
    const next = SPEED_STEPS[nextIdx];
    speedRef.current = next;
    setGameSpeed(next);
    soundEngine.playRatioTick(nextIdx);
  }, []);

  const handleChangeSendRatio = useCallback(
    (ratio: number) => {
      sendRatioRef.current = ratio;
      const stepIdx = Math.max(0, SEND_RATIOS.findIndex((r) => Math.abs(r - ratio) < 0.01));
      soundEngine.playRatioTick(stepIdx);
      syncHud();
    },
    [syncHud]
  );

  const handleCycleSendRatio = useCallback(() => {
    const curIdx = SEND_RATIOS.findIndex((r) => Math.abs(r - sendRatioRef.current) < 0.01);
    const nextIdx = (curIdx + 1) % SEND_RATIOS.length;
    sendRatioRef.current = SEND_RATIOS[nextIdx];
    soundEngine.playRatioTick(nextIdx);
    syncHud();
  }, [syncHud]);

  const executeDispatch = useCallback(
    (fromId: number, toId: number, ratio: number) => {
      const events: SimEvent[] = [];
      const res = dispatchTroops(simRef.current, fromId, toId, ratio, 0, events);
      if (res.ok) {
        soundEngine.playDispatch();
        rendererRef.current?.consumeEvents(events);
        syncHud();
        return true;
      }
      soundEngine.playError();
      showToast('نیروی نظامی کافی برای اعزام وجود ندارد.', 'error');
      return false;
    },
    [showToast, syncHud]
  );

  const rallyForCastle = useCallback(
    (targetId: number | null) => {
      if (phaseRef.current !== 'playing' || targetId === null) return;
      const target = simRef.current.territories[targetId];
      if (!target || target.owner !== 0) {
        soundEngine.playError();
        return;
      }
      const events: SimEvent[] = [];
      const res = rallyReinforcements(simRef.current, targetId, 0, 0.5, events);
      if (res.squadsSent > 0) {
        soundEngine.playRally();
        rendererRef.current?.consumeEvents(events);
        rendererRef.current?.spawnFloatingText(
          target.x,
          target.y - 26,
          `فراخوانی کمکی +${res.totalSent}`,
          '#86efac'
        );
        syncHud();
      } else {
        soundEngine.playError();
        showToast('قلعه هم‌مرز خودی با نیروی کافی برای ارسال کمکی یافت نشد.', 'info');
      }
    },
    [showToast, syncHud]
  );

  const handleRallySelected = useCallback(() => {
    rallyForCastle(selectedIdRef.current);
  }, [rallyForCastle]);

  const handleBuild = useCallback(
    (type: BuildingType) => {
      if (phaseRef.current !== 'playing') return;
      const selId = selectedIdRef.current;
      if (selId === null) return;
      const events: SimEvent[] = [];
      const built = buildStructure(simRef.current, selId, type, 0, events);
      if (built) {
        rendererRef.current?.consumeEvents(events);
        handleEventsAudio(events, true);
        syncHud();
      } else {
        soundEngine.playError();
      }
    },
    [handleEventsAudio, syncHud]
  );

  const handleTriggerPower = useCallback(
    (power: PowerType) => {
      if (phaseRef.current !== 'playing') return;
      const events: SimEvent[] = [];
      const fired = triggerCommanderPower(
        simRef.current,
        power,
        selectedIdRef.current,
        events
      );
      if (fired) {
        rendererRef.current?.consumeEvents(events);
        handleEventsAudio(events, true);
        syncHud();
      } else {
        soundEngine.playError();
      }
    },
    [handleEventsAudio, syncHud]
  );

  const handleQuickAttackSpace = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    const selId = selectedIdRef.current;
    if (selId === null) return;
    const sel = simRef.current.territories[selId];
    if (!sel || sel.owner !== 0) return;

    // Prefer currently hovered valid neighbor, else pick weakest adjacent enemy/neutral castle
    const hovId = hoveredIdRef.current;
    let targetId: number | null = null;
    if (hovId !== null && hovId !== sel.id && sel.neighbors.includes(hovId)) {
      targetId = hovId;
    } else {
      const weakest = getWeakestEnemyNeighbor(simRef.current, sel.id);
      if (weakest) targetId = weakest.id;
    }

    if (targetId === null) {
      soundEngine.playError();
      showToast('همسایه دشمنی در مرز این قلعه وجود ندارد.', 'info');
      return;
    }

    executeDispatch(sel.id, targetId, sendRatioRef.current);
  }, [executeDispatch, showToast]);

  const handleCycleCastle = useCallback(
    (reverse: boolean) => {
      if (phaseRef.current !== 'playing') return;
      const nextId = cycleOwnedTerritory(simRef.current, selectedIdRef.current, 0, reverse);
      if (nextId !== null) {
        selectedIdRef.current = nextId;
        soundEngine.playSelect();
        syncHud();
      }
    },
    [syncHud]
  );

  // Unified Mouse + Touch Pointer Handlers (Tap-to-Attack + Drag-to-Attack + Double-Tap Rally)
  const handleCanvasPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== 'playing') return;
    // Ignore right-click here; right-click is handled by onContextMenu for 100% quick send
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;

    const isTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
    const hitRadius = isTouch ? 48 : 34;
    const { x, y } = renderer.screenToWorld(canvas, e.clientX, e.clientY);
    const hit = getTerritoryAtPoint(simRef.current, x, y, hitRadius);

    pointerSessionRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originId: hit ? hit.id : null,
      isTouch,
      hasDragged: false,
    };

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic pointer capture failure in headless environments
    }
  }, []);

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== 'playing') {
      hoveredIdRef.current = null;
      return;
    }
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;

    const session = pointerSessionRef.current;
    const isTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
    const hitRadius = isTouch ? 48 : 34;
    const { x, y } = renderer.screenToWorld(canvas, e.clientX, e.clientY);
    const hit = getTerritoryAtPoint(simRef.current, x, y, hitRadius);

    if (!isTouch) {
      hoveredIdRef.current = hit ? hit.id : null;
    }

    if (session && session.pointerId === e.pointerId && session.originId !== null) {
      const origin = simRef.current.territories[session.originId];
      if (origin && origin.owner === 0) {
        const moveDist = Math.hypot(
          e.clientX - session.startClientX,
          e.clientY - session.startClientY
        );
        if (!session.hasDragged && moveDist >= DRAG_THRESHOLD_PX) {
          session.hasDragged = true;
          if (selectedIdRef.current !== origin.id) {
            selectedIdRef.current = origin.id;
            syncHud();
          }
        }
        if (session.hasDragged) {
          const targetId = hit && hit.id !== origin.id ? hit.id : null;
          const isValidTarget = targetId !== null && origin.neighbors.includes(targetId);
          const isFriendlyTarget =
            isValidTarget && targetId !== null && simRef.current.territories[targetId]?.owner === 0;
          dragAimRef.current = {
            active: true,
            originId: origin.id,
            currentX: x,
            currentY: y,
            hoverTargetId: targetId,
            isValidTarget,
            isFriendlyTarget,
          };
        }
      }
    }
  }, [syncHud]);

  const handleCanvasPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const session = pointerSessionRef.current;
      const canvas = canvasRef.current;
      const renderer = rendererRef.current;

      if (canvas && session && session.pointerId === e.pointerId) {
        try {
          if (canvas.hasPointerCapture(e.pointerId)) {
            canvas.releasePointerCapture(e.pointerId);
          }
        } catch {
          // Ignore
        }
      }

      if (!session || session.pointerId !== e.pointerId) return;
      pointerSessionRef.current = null;

      if (phaseRef.current !== 'playing' || !canvas || !renderer) {
        dragAimRef.current = createIdleDragAim();
        return;
      }

      // Case A: User completed a Drag-to-Attack / Drag-to-Reinforce gesture
      if (session.hasDragged && dragAimRef.current.active) {
        const drag = dragAimRef.current;
        dragAimRef.current = createIdleDragAim();
        if (drag.hoverTargetId !== null && drag.isValidTarget) {
          executeDispatch(drag.originId, drag.hoverTargetId, sendRatioRef.current);
        } else if (drag.hoverTargetId !== null && !drag.isValidTarget) {
          soundEngine.playError();
          showToast('فقط به سرزمین‌های هم‌مرز (متصل با خط‌چین) می‌توانید حمله کنید.', 'error');
        }
        return;
      }

      dragAimRef.current = createIdleDragAim();

      // Case B: Tap / Click interaction
      const hitRadius = session.isTouch ? 48 : 34;
      const { x, y } = renderer.screenToWorld(canvas, e.clientX, e.clientY);
      const clicked = getTerritoryAtPoint(simRef.current, x, y, hitRadius);

      if (!clicked) {
        selectedIdRef.current = null;
        lastTapRef.current = null;
        syncHud();
        return;
      }

      // Quick Double-Tap / Double-Click on a player castle -> Rally adjacent reinforcements!
      const now = performance.now();
      if (
        clicked.owner === 0 &&
        lastTapRef.current &&
        lastTapRef.current.id === clicked.id &&
        now - lastTapRef.current.time <= DOUBLE_TAP_WINDOW_MS
      ) {
        lastTapRef.current = null;
        selectedIdRef.current = clicked.id;
        rallyForCastle(clicked.id);
        return;
      }
      lastTapRef.current = clicked.owner === 0 ? { id: clicked.id, time: now } : null;

      const currentSelId = selectedIdRef.current;
      const currentSel =
        currentSelId !== null ? simRef.current.territories[currentSelId] : null;

      // 1. Nothing selected or selected castle is not player-owned -> select clicked
      if (!currentSel || currentSel.owner !== 0) {
        selectedIdRef.current = clicked.id;
        soundEngine.playSelect();
        syncHud();
        return;
      }

      // 2. Clicked same castle -> deselect
      if (currentSel.id === clicked.id) {
        selectedIdRef.current = null;
        soundEngine.playSelect();
        syncHud();
        return;
      }

      // 3. Clicked adjacent neighbor -> dispatch troops across shared border!
      if (currentSel.neighbors.includes(clicked.id)) {
        executeDispatch(currentSel.id, clicked.id, sendRatioRef.current);
        return;
      }

      // 4. Clicked another non-adjacent player castle -> smoothly switch selection
      if (clicked.owner === 0) {
        selectedIdRef.current = clicked.id;
        soundEngine.playSelect();
        syncHud();
        return;
      }

      // 5. Clicked non-adjacent enemy/neutral castle -> inform border rule
      soundEngine.playError();
      showToast('فقط به سرزمین‌های هم‌مرز (متصل با خط‌چین) می‌توانید حمله کنید.', 'error');
    },
    [executeDispatch, rallyForCastle, showToast, syncHud]
  );

  const handleCanvasPointerCancel = useCallback(() => {
    pointerSessionRef.current = null;
    dragAimRef.current = createIdleDragAim();
  }, []);

  const handleCanvasPointerLeave = useCallback(() => {
    hoveredIdRef.current = null;
  }, []);

  // Right-click on neighbor -> instant 100% All-In attack/reinforce; elsewhere -> deselect
  const handleCanvasContextMenu = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (phaseRef.current !== 'playing') return;
      const canvas = canvasRef.current;
      const renderer = rendererRef.current;
      if (!canvas || !renderer) return;

      const { x, y } = renderer.screenToWorld(canvas, e.clientX, e.clientY);
      const clicked = getTerritoryAtPoint(simRef.current, x, y, 34);
      const selId = selectedIdRef.current;
      const sel = selId !== null ? simRef.current.territories[selId] : null;

      if (sel && sel.owner === 0 && clicked && clicked.id !== sel.id && sel.neighbors.includes(clicked.id)) {
        executeDispatch(sel.id, clicked.id, 1.0);
        return;
      }

      if (selectedIdRef.current !== null) {
        selectedIdRef.current = null;
        soundEngine.playSelect();
        syncHud();
      }
    },
    [executeDispatch, syncHud]
  );

  // Mouse wheel over canvas -> fast send-ratio stepping
  const handleCanvasWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      if (phaseRef.current !== 'playing') return;
      const curIdx = SEND_RATIOS.findIndex((r) => Math.abs(r - sendRatioRef.current) < 0.01);
      const safeIdx = curIdx === -1 ? 1 : curIdx;
      const nextIdx =
        e.deltaY < 0
          ? Math.min(SEND_RATIOS.length - 1, safeIdx + 1)
          : Math.max(0, safeIdx - 1);
      if (nextIdx !== safeIdx) {
        handleChangeSendRatio(SEND_RATIOS[nextIdx]);
      }
    },
    [handleChangeSendRatio]
  );

  // Layout-independent keyboard shortcuts using physical e.code (works with Persian & English keyboards!)
  useEffect(() => {
    document.body.dataset.state = phaseRef.current;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const code = e.code;

      if (phaseRef.current === 'title') {
        if (code === 'Enter' || code === 'Space') {
          e.preventDefault();
          handleStartFromTitle();
        }
        return;
      }

      if (code === 'KeyH' || (e.shiftKey && code === 'Slash')) {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
        soundEngine.playSelect();
        return;
      }

      if (code === 'Escape' && shortcutsOpenRef.current) {
        e.preventDefault();
        setShortcutsOpen(false);
        return;
      }

      if (code === 'KeyM') {
        handleToggleMute();
        return;
      }

      if (code === 'Escape' || code === 'KeyP') {
        if (phaseRef.current === 'playing' || phaseRef.current === 'paused') {
          e.preventDefault();
          handleTogglePause();
        }
        return;
      }

      if (phaseRef.current !== 'playing' || shortcutsOpenRef.current) return;

      if (code === 'Digit1' || code === 'Numpad1') handleChangeSendRatio(SEND_RATIOS[0]);
      else if (code === 'Digit2' || code === 'Numpad2') handleChangeSendRatio(SEND_RATIOS[1]);
      else if (code === 'Digit3' || code === 'Numpad3') handleChangeSendRatio(SEND_RATIOS[2]);
      else if (code === 'Digit4' || code === 'Numpad4') handleChangeSendRatio(SEND_RATIOS[3]);
      else if (code === 'KeyQ') handleBuild('barracks');
      else if (code === 'KeyW') handleBuild('tower');
      else if (code === 'KeyE') handleBuild('mine');
      else if (code === 'KeyR') handleBuild('forge');
      else if (code === 'KeyZ') handleTriggerPower('mobilize');
      else if (code === 'KeyX') handleTriggerPower('blitz');
      else if (code === 'KeyC') handleTriggerPower('shield');
      else if (code === 'KeyA') handleRallySelected();
      else if (code === 'KeyF') handleCycleSpeed();
      else if (code === 'KeyN') handleNewMapInGame();
      else if (code === 'Tab') {
        e.preventDefault();
        handleCycleCastle(e.shiftKey);
      } else if (code === 'Space') {
        e.preventDefault();
        handleQuickAttackSpace();
      }
    };

    const onBlur = () => {
      hoveredIdRef.current = null;
      pointerSessionRef.current = null;
      dragAimRef.current = createIdleDragAim();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onBlur);
    };
  }, [
    handleBuild,
    handleChangeSendRatio,
    handleCycleCastle,
    handleCycleSpeed,
    handleNewMapInGame,
    handleQuickAttackSpace,
    handleRallySelected,
    handleStartFromTitle,
    handleToggleMute,
    handleTogglePause,
    handleTriggerPower,
  ]);

  // Mount Canvas2D renderer, ResizeObserver, & isolated 60fps simulation loop ONCE
  useEffect(() => {
    const renderer = new GameRenderer();
    rendererRef.current = renderer;

    const canvas = canvasRef.current;
    let needsStaticRender = true;
    let ro: ResizeObserver | null = null;

    if (canvas) {
      renderer.syncViewportFromRect(canvas);
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            renderer.updateViewportSize(canvas, width, height);
            needsStaticRender = true;
          }
        }
      });
      ro.observe(canvas);
    }

    let rafId = 0;
    let lastTime = performance.now();
    let hudTimer = 0;
    let prevPhase: GamePhase = phaseRef.current;

    const loop = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);
      const timeSec = now / 1000;

      const phase = phaseRef.current;
      const sim = simRef.current;

      if (phase !== prevPhase) {
        prevPhase = phase;
        needsStaticRender = true;
        if (canvasRef.current) {
          renderer.syncViewportFromRect(canvasRef.current);
        }
      }

      if (phase === 'playing') {
        const events = stepSimulation(sim, dt, false, speedRef.current);
        renderer.consumeEvents(events);
        renderer.updateEffects(dt, sim, false);
        handleEventsAudio(events, true);

        if (sim.outcome !== 'none') {
          phaseRef.current = 'gameover';
          document.body.dataset.state = 'gameover';
          needsStaticRender = true;
          syncHud();
        } else {
          hudTimer += dt;
          if (hudTimer >= 0.16) {
            hudTimer = 0;
            syncHud();
          }
        }
      } else if (phase === 'title') {
        const events = stepSimulation(sim, dt * 0.65, true, 1.0);
        renderer.consumeEvents(events);
        renderer.updateEffects(dt, sim, true);
      }

      const activeCanvas = canvasRef.current;
      const shouldRender =
        phase === 'playing' || phase === 'title' || needsStaticRender || sim.mapDirty;

      if (activeCanvas && shouldRender) {
        renderer.render(
          activeCanvas,
          sim,
          selectedIdRef.current,
          hoveredIdRef.current,
          timeSec,
          phase === 'title',
          dragAimRef.current,
          sendRatioRef.current
        );
        needsStaticRender = false;
      }

      rafId = window.requestAnimationFrame(loop);
    };

    rafId = window.requestAnimationFrame(loop);
    return () => {
      window.cancelAnimationFrame(rafId);
      ro?.disconnect();
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [handleEventsAudio, syncHud]);

  const showRotatePrompt = viewport.isPortraitPhone && !portraitDismissed;

  return (
    <div className="w-screen h-dvh overflow-hidden flex flex-col bg-[#0c1626] text-[#ede7d9] select-none">
      {/* Top Perimeter Bar (visible during active/paused/gameover play, hidden on Title) */}
      {hud.phase !== 'title' && (
        <TopHudBar
          hud={hud}
          compact={viewport.isCompact}
          muted={muted}
          gameSpeed={gameSpeed}
          onCycleSpeed={handleCycleSpeed}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          onNewMap={handleNewMapInGame}
          onToggleMute={handleToggleMute}
          onTogglePause={handleTogglePause}
        />
      )}

      {/* Main Game Workspace: Desktop Sidebar OR Unobstructed Mobile Canvas + Bottom Quick Bar */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {hud.phase !== 'title' && !viewport.isCompact && (
          <CommandSidebar
            hud={hud}
            onChangeSendRatio={handleChangeSendRatio}
            onBuild={handleBuild}
            onTriggerPower={handleTriggerPower}
            onRally={handleRallySelected}
            onOpenShortcuts={() => setShortcutsOpen(true)}
            onNewMap={handleNewMapInGame}
          />
        )}

        {/* Map Canvas Container — 100% unobstructed by any floating panels */}
        <div
          className="relative flex-1 min-w-0 min-h-0 bg-[#0c1626]"
          data-testid="map-stage"
          data-seed={hud.mapSeed}
          data-speed={gameSpeed}
          data-player-territories={hud.playerTerritories}
          data-selected-id={hud.selectedId ?? ''}
        >
          <canvas
            ref={canvasRef}
            data-testid="game-canvas"
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerCancel}
            onPointerLeave={handleCanvasPointerLeave}
            onContextMenu={handleCanvasContextMenu}
            onWheel={handleCanvasWheel}
            className="w-full h-full block cursor-pointer touch-none"
          />

          {/* Non-intrusive tactical feedback toast */}
          {toast && hud.phase === 'playing' && (
            <div
              role="status"
              aria-live="polite"
              className={`pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 px-3.5 py-1.5 border text-xs font-bold shadow-[0_10px_28px_rgba(0,0,0,0.65)] whitespace-nowrap ${
                toast.tone === 'error'
                  ? 'bg-[#7f1d1d]/95 border-[#f87171]/60 text-[#fef2f2]'
                  : 'bg-[#15243b]/95 border-[#d6b472]/50 text-[#f6efe0]'
              }`}
            >
              {toast.text}
            </div>
          )}
        </div>
      </div>

      {/* Compact Mobile Bottom Quick-Action Bar (no drawer!) */}
      {hud.phase !== 'title' && viewport.isCompact && (
        <MobileCommandBar
          hud={hud}
          onCycleSendRatio={handleCycleSendRatio}
          onBuild={handleBuild}
          onTriggerPower={handleTriggerPower}
          onRally={handleRallySelected}
        />
      )}

      {/* Title Screen Overlay */}
      {hud.phase === 'title' && (
        <TitleOverlay
          difficulty={hud.difficulty}
          isShortLandscape={viewport.isShortLandscape}
          onSelectDifficulty={handleSelectDifficulty}
          onStart={handleStartFromTitle}
          onPreviewNewMap={handlePreviewNewMap}
        />
      )}

      {/* Portrait Mobile Orientation Prompt */}
      {showRotatePrompt && (
        <RotatePhoneOverlay onContinuePortrait={() => setPortraitDismissed(true)} />
      )}

      {/* Keyboard & Gesture Shortcuts Guide Modal */}
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* Pause / Victory / Defeat Modal */}
      <StatusModal
        phase={hud.phase}
        outcome={hud.outcome}
        stats={hud.stats}
        playerTerritories={hud.playerTerritories}
        totalTerritories={hud.totalTerritories}
        onResume={handleTogglePause}
        onRestartNewMap={handleNewMapInGame}
        onReturnTitle={handleReturnTitle}
      />
    </div>
  );
}
