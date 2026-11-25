import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { soundEngine } from '../game/audio';
import { appendBattleLog, buildBattleLogEntries } from '../game/battleLog';
import { BUILDINGS, COMMANDER_POWERS, MAX_BUILDING_LEVEL, SEND_RATIOS } from '../game/constants';
import { GameRenderer } from '../game/renderer';
import {
  buildHudSnapshot,
  buildStructure,
  canDispatchTo,
  clearSupplyRoute,
  computeBattleIntensity,
  createInitialMatch,
  cycleOwnedTerritory,
  dispatchTroops,
  getBuildingLevel,
  getNextBuildingCost,
  getTerritoryAtPoint,
  getWeakestEnemyNeighbor,
  rallyReinforcements,
  setSupplyRoute,
  stepSimulation,
  triggerCommanderPower,
} from '../game/simulation';
import type {
  BattleLogEntry,
  BuildingType,
  Difficulty,
  DragAimState,
  GamePhase,
  GameSimulation,
  HudSnapshot,
  MapGridData,
  MapPreset,
  PowerType,
  SimEvent,
  Territory,
  TimelapseSnapshot,
} from '../game/types';

export const SPEED_STEPS = [1, 1.5, 2] as const;
export type GameSpeed = (typeof SPEED_STEPS)[number];

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

interface LastTapInfo {
  id: number;
  time: number;
  dispatchedFromId?: number;
}

function makeRandomSeed(): number {
  return Math.floor(10000 + Math.random() * 900000);
}

function getInitialAutoStart(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('autostart') === '1';
}

function getInitialSeed(): number {
  if (typeof window === 'undefined') return 24681;
  const s = Number(new URLSearchParams(window.location.search).get('seed'));
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
    isNavalTarget: false,
  };
}

export interface TimelapseData {
  map: MapGridData;
  territories: Territory[];
  snapshots: TimelapseSnapshot[];
}

export function useGameController() {
  const autoStart = getInitialAutoStart();
  const initialDifficulty: Difficulty = 'normal';
  const initialPreset: MapPreset = 'continent';
  const initialSeed = getInitialSeed();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const simRef = useRef<GameSimulation>(
    createInitialMatch(initialSeed, initialDifficulty, initialPreset)
  );
  const phaseRef = useRef<GamePhase>(autoStart ? 'playing' : 'title');
  const difficultyRef = useRef<Difficulty>(initialDifficulty);
  const presetRef = useRef<MapPreset>(initialPreset);
  const sendRatioRef = useRef<number>(0.5);
  const speedRef = useRef<GameSpeed>(1);
  const selectedIdRef = useRef<number | null>(
    simRef.current.territories.find((t) => t.owner === 0)?.id ?? null
  );
  const hoveredIdRef = useRef<number | null>(null);
  const dragAimRef = useRef<DragAimState>(createIdleDragAim());
  const pointerSessionRef = useRef<PointerSession | null>(null);
  const lastTapRef = useRef<LastTapInfo | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const shortcutsOpenRef = useRef<boolean>(false);
  const supplyModeRef = useRef<boolean>(false);
  const battleLogIdRef = useRef<{ current: number }>({ current: 1 });

  const [muted, setMuted] = useState(() => soundEngine.isMuted());
  const [musicMuted, setMusicMuted] = useState(() => soundEngine.isMusicMuted());
  const [gameSpeed, setGameSpeed] = useState<GameSpeed>(1);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [battleLogOpen, setBattleLogOpen] = useState(false);
  const [battleLog, setBattleLog] = useState<BattleLogEntry[]>([]);
  const [supplyMode, setSupplyMode] = useState(false);
  const [portraitDismissed, setPortraitDismissed] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);
  const [timelapseData, setTimelapseData] = useState<TimelapseData | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(() =>
    buildHudSnapshot(
      simRef.current,
      phaseRef.current,
      sendRatioRef.current,
      selectedIdRef.current
    )
  );

  useEffect(() => {
    shortcutsOpenRef.current = shortcutsOpen;
  }, [shortcutsOpen]);

  useEffect(() => {
    supplyModeRef.current = supplyMode;
  }, [supplyMode]);

  const clearPointerInteraction = useCallback((clearHover = true) => {
    if (clearHover) hoveredIdRef.current = null;
    pointerSessionRef.current = null;
    dragAimRef.current = createIdleDragAim();
  }, []);

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

  const recordBattleEvents = useCallback((events: SimEvent[]) => {
    if (events.length === 0) return;
    const entries = buildBattleLogEntries(
      events,
      simRef.current.stats.elapsedSeconds,
      battleLogIdRef.current
    );
    if (entries.length > 0) {
      setBattleLog((prev) => appendBattleLog(prev, entries));
    }
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
        soundEngine.playBuild(ev.buildingLevel ?? 1);
      } else if (ev.type === 'power' && ev.owner === 0) {
        soundEngine.playPower();
      }
    }
  }, []);

  const startFreshMatch = useCallback(
    (seed?: number, nextPhase: GamePhase = 'playing', preset?: MapPreset) => {
      const nextSeed = seed ?? makeRandomSeed();
      const nextPreset = preset ?? presetRef.current;
      presetRef.current = nextPreset;
      simRef.current = createInitialMatch(nextSeed, difficultyRef.current, nextPreset);
      rendererRef.current?.clearEffects();
      selectedIdRef.current =
        simRef.current.territories.find((t) => t.owner === 0)?.id ?? null;
      clearPointerInteraction();
      lastTapRef.current = null;
      phaseRef.current = nextPhase;
      document.body.dataset.state = nextPhase;
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setShortcutsOpen(false);
      setSupplyMode(false);
      setBattleLog([]);
      setTimelapseData(null);
      setToast(null);
      if (nextPhase === 'playing') {
        soundEngine.setMusicIntensity(0);
        soundEngine.startMusic();
      } else {
        soundEngine.stopMusic();
      }
      syncHud();
    },
    [clearPointerInteraction, syncHud]
  );

  const handleStartFromTitle = useCallback(() => {
    soundEngine.playSelect();
    startFreshMatch(simRef.current.seed, 'playing', presetRef.current);
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

  const handleSelectMapPreset = useCallback(
    (preset: MapPreset) => {
      presetRef.current = preset;
      soundEngine.playSelect();
      startFreshMatch(makeRandomSeed(), phaseRef.current, preset);
    },
    [startFreshMatch]
  );

  const handlePreviewNewMap = useCallback(() => {
    soundEngine.playSelect();
    startFreshMatch(makeRandomSeed(), 'title', presetRef.current);
  }, [startFreshMatch]);

  const handleNewMapInGame = useCallback(() => {
    soundEngine.playSelect();
    startFreshMatch(makeRandomSeed(), 'playing', presetRef.current);
  }, [startFreshMatch]);

  const handleTogglePause = useCallback(() => {
    if (phaseRef.current === 'playing') {
      phaseRef.current = 'paused';
      document.body.dataset.state = 'paused';
      clearPointerInteraction();
      setSupplyMode(false);
      soundEngine.stopMusic();
      soundEngine.playSelect();
      syncHud();
    } else if (phaseRef.current === 'paused') {
      phaseRef.current = 'playing';
      document.body.dataset.state = 'playing';
      soundEngine.playSelect();
      soundEngine.startMusic();
      syncHud();
    }
  }, [clearPointerInteraction, syncHud]);

  const handleReturnTitle = useCallback(() => {
    soundEngine.playSelect();
    startFreshMatch(makeRandomSeed(), 'title', presetRef.current);
  }, [startFreshMatch]);

  const handleToggleMute = useCallback(() => {
    const next = soundEngine.toggleMute();
    setMuted(next);
  }, []);

  const handleToggleMusic = useCallback(() => {
    const next = soundEngine.toggleMusic();
    setMusicMuted(next);
  }, []);

  const handleToggleBattleLog = useCallback(() => {
    setBattleLogOpen((prev) => !prev);
    soundEngine.playSelect();
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
        if (res.isNaval) {
          soundEngine.playNavalLaunch();
        } else {
          soundEngine.playDispatch();
        }
        rendererRef.current?.consumeEvents(events);
        recordBattleEvents(events);
        syncHud();
        return true;
      }
      soundEngine.playError();
      const message =
        res.reason === 'not_owner'
          ? 'این قلعه دیگر در اختیار شما نیست.'
          : res.reason === 'not_neighbor'
            ? 'فقط به قلعه‌های همسایه و هم‌مرز می‌توانید نیرو اعزام کنید.'
            : 'نیروی نظامی کافی برای اعزام وجود ندارد.';
      showToast(message, 'error');
      return false;
    },
    [recordBattleEvents, showToast, syncHud]
  );

  const executeSetSupplyRoute = useCallback(
    (fromId: number, toId: number) => {
      const events: SimEvent[] = [];
      const res = setSupplyRoute(simRef.current, fromId, toId, 0, events);
      if (res.ok) {
        soundEngine.playSelect();
        recordBattleEvents(events);
        setSupplyMode(false);
        const toName = simRef.current.territories[toId]?.name ?? 'مقصد';
        showToast(
          res.action === 'set'
            ? `خط تأمین خودکار به سوی «${toName}» فعال شد.`
            : 'خط تأمین خودکار لغو شد.',
          'info'
        );
        syncHud();
        return true;
      }
      soundEngine.playError();
      const msg =
        res.reason === 'target_not_friendly'
          ? 'خط تأمین فقط به قلعه‌های هم‌مرز خودی متصل می‌شود.'
          : 'فقط بین دو قلعه هم‌مرز خودی می‌توانید خط تأمین بسازید.';
      showToast(msg, 'error');
      return false;
    },
    [recordBattleEvents, showToast, syncHud]
  );

  const handleToggleSupplyMode = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    const selId = selectedIdRef.current;
    const sel = selId !== null ? simRef.current.territories[selId] : null;
    if (!sel || sel.owner !== 0) {
      soundEngine.playError();
      showToast('ابتدا یکی از قلعه‌های خود را انتخاب کنید.', 'info');
      return;
    }
    if (sel.supplyTargetId !== null) {
      const events: SimEvent[] = [];
      clearSupplyRoute(simRef.current, sel.id, 0, events);
      recordBattleEvents(events);
      setSupplyMode(false);
      soundEngine.playSelect();
      showToast(`خط تأمین «${sel.name}» لغو شد.`, 'info');
      syncHud();
      return;
    }
    const friendlyNeighbors = sel.neighbors.filter(
      (nId) => simRef.current.territories[nId]?.owner === 0
    );
    if (friendlyNeighbors.length === 0) {
      soundEngine.playError();
      showToast('همسایه خودی برای ایجاد خط تأمین وجود ندارد.', 'info');
      return;
    }
    if (friendlyNeighbors.length === 1) {
      executeSetSupplyRoute(sel.id, friendlyNeighbors[0]);
      return;
    }
    setSupplyMode((prev) => {
      const next = !prev;
      if (next) {
        showToast('روی قلعه هم‌مرز خودی مقصد کلیک کنید تا خط تأمین برقرار شود.', 'info');
      }
      return next;
    });
    soundEngine.playSelect();
  }, [executeSetSupplyRoute, recordBattleEvents, showToast, syncHud]);

  const rallyForCastle = useCallback(
    (targetId: number | null, excludeFromId?: number) => {
      if (phaseRef.current !== 'playing' || targetId === null) return;
      const target = simRef.current.territories[targetId];
      if (!target || target.owner !== 0) {
        soundEngine.playError();
        showToast('برای فراخوانی کمکی، یکی از قلعه‌های خود را انتخاب کنید.', 'info');
        return;
      }
      const events: SimEvent[] = [];
      const res = rallyReinforcements(simRef.current, targetId, 0, 0.5, events, excludeFromId);
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
      } else if (excludeFromId === undefined) {
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
      const sel = selId !== null ? simRef.current.territories[selId] : null;
      if (!sel || sel.owner !== 0) {
        soundEngine.playError();
        showToast('ابتدا یکی از قلعه‌های خود را انتخاب کنید.', 'info');
        return;
      }
      const events: SimEvent[] = [];
      const built = buildStructure(simRef.current, sel.id, type, 0, events);
      if (built) {
        rendererRef.current?.consumeEvents(events);
        handleEventsAudio(events, true);
        recordBattleEvents(events);
        syncHud();
      } else {
        soundEngine.playError();
        const lvl = getBuildingLevel(sel, type);
        const nextCost = getNextBuildingCost(sel, type);
        if (lvl >= MAX_BUILDING_LEVEL || nextCost === null) {
          showToast(
            `${BUILDINGS[type].levelNames[MAX_BUILDING_LEVEL - 1]} به حداکثر سطح ۳ رسیده است.`,
            'info'
          );
        } else if (type === 'port' && !sel.isCoastal) {
          showToast('بندرگاه فقط در قلعه‌های ساحلی قابل ساخت است.', 'info');
        } else {
          const actionLabel = lvl === 0 ? 'ساخت' : `ارتقای سطح ${lvl + 1}`;
          showToast(
            `برای ${actionLabel} ${BUILDINGS[type].name} به ${nextCost} نیروی نظامی نیاز دارید.`,
            'error'
          );
        }
      }
    },
    [handleEventsAudio, recordBattleEvents, showToast, syncHud]
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
        recordBattleEvents(events);
        syncHud();
      } else {
        soundEngine.playError();
        const cfg = COMMANDER_POWERS[power];
        const cd = simRef.current.powers.cooldowns[power];
        const sel =
          selectedIdRef.current !== null ? simRef.current.territories[selectedIdRef.current] : null;
        if (cd > 0) {
          showToast(`${cfg.name} تا ${Math.ceil(cd)} ثانیه دیگر آماده می‌شود.`, 'info');
        } else if (cfg.requiresSelectedOwnCastle && (!sel || sel.owner !== 0)) {
          showToast('ابتدا یکی از قلعه‌های خود را انتخاب کنید.', 'info');
        } else if (power === 'mobilize') {
          showToast('برای بسیج عمومی حداقل ۶ نیروی انسانی نیاز است.', 'info');
        }
      }
    },
    [handleEventsAudio, recordBattleEvents, showToast, syncHud]
  );

  const handleQuickAttackSpace = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    const selId = selectedIdRef.current;
    if (selId === null) return;
    const sel = simRef.current.territories[selId];
    if (!sel || sel.owner !== 0) return;

    const hovId = hoveredIdRef.current;
    let targetId: number | null = null;
    if (
      hovId !== null &&
      hovId !== sel.id &&
      canDispatchTo(simRef.current, sel.id, hovId).allowed
    ) {
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
        setSupplyMode(false);
        soundEngine.playSelect();
        syncHud();
      }
    },
    [syncHud]
  );

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== 'playing') return;
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

  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
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
            const check =
              targetId !== null
                ? canDispatchTo(simRef.current, origin.id, targetId)
                : { allowed: false, isNaval: false };
            const isValidTarget = check.allowed;
            const isFriendlyTarget =
              isValidTarget &&
              targetId !== null &&
              simRef.current.territories[targetId]?.owner === 0;
            dragAimRef.current = {
              active: true,
              originId: origin.id,
              currentX: x,
              currentY: y,
              hoverTargetId: targetId,
              isValidTarget,
              isFriendlyTarget,
              isNavalTarget: check.allowed && check.isNaval,
            };
          }
        }
      }
    },
    [syncHud]
  );

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

      const hitRadius = session.isTouch ? 48 : 34;

      if (session.hasDragged && dragAimRef.current.active) {
        const drag = dragAimRef.current;
        dragAimRef.current = createIdleDragAim();
        const { x: dropX, y: dropY } = renderer.screenToWorld(canvas, e.clientX, e.clientY);
        const dropHit = getTerritoryAtPoint(simRef.current, dropX, dropY, hitRadius);
        const targetId =
          dropHit && dropHit.id !== drag.originId ? dropHit.id : drag.hoverTargetId;
        if (targetId !== null && targetId !== drag.originId) {
          const check = canDispatchTo(simRef.current, drag.originId, targetId);
          if (check.allowed) {
            executeDispatch(drag.originId, targetId, sendRatioRef.current);
          } else {
            soundEngine.playError();
            showToast('فقط به قلعه‌های همسایه و هم‌مرز می‌توانید نیرو اعزام کنید.', 'error');
          }
        }
        return;
      }

      dragAimRef.current = createIdleDragAim();

      const { x, y } = renderer.screenToWorld(canvas, e.clientX, e.clientY);
      const clicked = getTerritoryAtPoint(simRef.current, x, y, hitRadius);

      if (!clicked) {
        selectedIdRef.current = null;
        lastTapRef.current = null;
        setSupplyMode(false);
        syncHud();
        return;
      }

      const currentSelId = selectedIdRef.current;
      const currentSel =
        currentSelId !== null ? simRef.current.territories[currentSelId] : null;

      // Shift+Click OR active Supply Mode on a friendly neighbor establishes/clears Auto-Supply line
      if (
        currentSel &&
        currentSel.owner === 0 &&
        clicked.id !== currentSel.id &&
        (e.shiftKey || supplyModeRef.current)
      ) {
        executeSetSupplyRoute(currentSel.id, clicked.id);
        return;
      }

      const now = performance.now();
      if (
        clicked.owner === 0 &&
        lastTapRef.current &&
        lastTapRef.current.id === clicked.id &&
        now - lastTapRef.current.time <= DOUBLE_TAP_WINDOW_MS
      ) {
        const excludeFromId = lastTapRef.current.dispatchedFromId;
        lastTapRef.current = null;
        selectedIdRef.current = clicked.id;
        rallyForCastle(clicked.id, excludeFromId);
        return;
      }

      if (!currentSel || currentSel.owner !== 0) {
        lastTapRef.current = clicked.owner === 0 ? { id: clicked.id, time: now } : null;
        selectedIdRef.current = clicked.id;
        soundEngine.playSelect();
        syncHud();
        return;
      }

      if (currentSel.id === clicked.id) {
        lastTapRef.current = { id: clicked.id, time: now };
        selectedIdRef.current = null;
        setSupplyMode(false);
        soundEngine.playSelect();
        syncHud();
        return;
      }

      const routeCheck = canDispatchTo(simRef.current, currentSel.id, clicked.id);
      if (routeCheck.allowed) {
        const dispatched = executeDispatch(currentSel.id, clicked.id, sendRatioRef.current);
        lastTapRef.current =
          clicked.owner === 0 && !routeCheck.isNaval
            ? {
                id: clicked.id,
                time: now,
                dispatchedFromId: dispatched ? currentSel.id : undefined,
              }
            : null;
        return;
      }

      lastTapRef.current = clicked.owner === 0 ? { id: clicked.id, time: now } : null;

      if (clicked.owner === 0) {
        selectedIdRef.current = clicked.id;
        soundEngine.playSelect();
        syncHud();
        return;
      }

      soundEngine.playError();
      showToast('فقط به قلعه‌های همسایه و هم‌مرز می‌توانید نیرو اعزام کنید.', 'error');
    },
    [executeDispatch, executeSetSupplyRoute, rallyForCastle, showToast, syncHud]
  );

  const handleCanvasPointerCancel = useCallback(() => {
    clearPointerInteraction(false);
  }, [clearPointerInteraction]);

  const handleCanvasPointerLeave = useCallback(() => {
    hoveredIdRef.current = null;
  }, []);

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

      if (
        sel &&
        sel.owner === 0 &&
        clicked &&
        clicked.id !== sel.id &&
        canDispatchTo(simRef.current, sel.id, clicked.id).allowed
      ) {
        executeDispatch(sel.id, clicked.id, 1.0);
        return;
      }

      if (selectedIdRef.current !== null || supplyModeRef.current) {
        selectedIdRef.current = null;
        setSupplyMode(false);
        soundEngine.playSelect();
        syncHud();
      }
    },
    [executeDispatch, syncHud]
  );

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

  useEffect(() => {
    document.body.dataset.state = phaseRef.current;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const code = e.code;

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

      if (shortcutsOpenRef.current) return;

      if (code === 'KeyM') {
        handleToggleMute();
        return;
      }

      if (code === 'KeyB') {
        handleToggleMusic();
        return;
      }

      if (phaseRef.current === 'title') {
        if (code === 'Enter' || code === 'Space') {
          const active = document.activeElement;
          if (active instanceof HTMLButtonElement && active.dataset.start !== 'true') {
            return;
          }
          e.preventDefault();
          handleStartFromTitle();
        }
        return;
      }

      if (code === 'Escape' || code === 'KeyP') {
        if (supplyModeRef.current && code === 'Escape') {
          e.preventDefault();
          setSupplyMode(false);
          return;
        }
        if (phaseRef.current === 'playing' || phaseRef.current === 'paused') {
          e.preventDefault();
          handleTogglePause();
        }
        return;
      }

      if (phaseRef.current !== 'playing') return;

      if (code === 'Digit1' || code === 'Numpad1') handleChangeSendRatio(SEND_RATIOS[0]);
      else if (code === 'Digit2' || code === 'Numpad2') handleChangeSendRatio(SEND_RATIOS[1]);
      else if (code === 'Digit3' || code === 'Numpad3') handleChangeSendRatio(SEND_RATIOS[2]);
      else if (code === 'Digit4' || code === 'Numpad4') handleChangeSendRatio(SEND_RATIOS[3]);
      else if (code === 'KeyQ') handleBuild('barracks');
      else if (code === 'KeyW') handleBuild('tower');
      else if (code === 'KeyE') handleBuild('mine');
      else if (code === 'KeyR') handleBuild('forge');
      else if (code === 'KeyT') handleBuild('port');
      else if (code === 'KeyZ') handleTriggerPower('mobilize');
      else if (code === 'KeyX') handleTriggerPower('blitz');
      else if (code === 'KeyC') handleTriggerPower('shield');
      else if (code === 'KeyA') handleRallySelected();
      else if (code === 'KeyS') handleToggleSupplyMode();
      else if (code === 'KeyL') handleToggleBattleLog();
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
      clearPointerInteraction();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onBlur);
    };
  }, [
    clearPointerInteraction,
    handleBuild,
    handleChangeSendRatio,
    handleCycleCastle,
    handleCycleSpeed,
    handleNewMapInGame,
    handleQuickAttackSpace,
    handleRallySelected,
    handleStartFromTitle,
    handleToggleBattleLog,
    handleToggleMusic,
    handleToggleMute,
    handleTogglePause,
    handleToggleSupplyMode,
    handleTriggerPower,
  ]);

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
      let sim = simRef.current;

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
        recordBattleEvents(events);

        if (sim.outcome !== 'none') {
          phaseRef.current = 'gameover';
          document.body.dataset.state = 'gameover';
          clearPointerInteraction();
          setSupplyMode(false);
          soundEngine.stopMusic();
          setTimelapseData({
            map: sim.map,
            territories: sim.territories.map((t) => ({ ...t })),
            snapshots: [...sim.timelapse],
          });
          needsStaticRender = true;
          syncHud();
        } else {
          if (
            supplyModeRef.current &&
            (selectedIdRef.current === null ||
              sim.territories[selectedIdRef.current]?.owner !== 0)
          ) {
            setSupplyMode(false);
          }
          hudTimer += dt;
          if (hudTimer >= 0.16) {
            hudTimer = 0;
            soundEngine.setMusicIntensity(computeBattleIntensity(sim));
            syncHud();
          }
        }
      } else if (phase === 'title') {
        const events = stepSimulation(sim, dt * 0.65, true, 1.0);
        renderer.consumeEvents(events);
        renderer.updateEffects(dt, sim, true);

        // Keep title backdrop battle alive if one AI faction conquers the whole continent
        if (sim.troops.length === 0) {
          let firstOwner = -1;
          let multipleOwners = false;
          for (const t of sim.territories) {
            if (t.owner < 0) continue;
            if (firstOwner === -1) firstOwner = t.owner;
            else if (t.owner !== firstOwner) {
              multipleOwners = true;
              break;
            }
          }
          if (!multipleOwners) {
            sim = createInitialMatch(makeRandomSeed(), difficultyRef.current, presetRef.current);
            simRef.current = sim;
            renderer.clearEffects();
            needsStaticRender = true;
          }
        }
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

    if (phaseRef.current === 'playing') {
      soundEngine.startMusic();
    }

    rafId = window.requestAnimationFrame(loop);
    return () => {
      window.cancelAnimationFrame(rafId);
      soundEngine.stopMusic();
      ro?.disconnect();
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [clearPointerInteraction, handleEventsAudio, recordBattleEvents, syncHud]);

  return {
    canvasRef,
    hud,
    muted,
    musicMuted,
    gameSpeed,
    shortcutsOpen,
    setShortcutsOpen,
    battleLog,
    battleLogOpen,
    supplyMode,
    timelapseData,
    portraitDismissed,
    setPortraitDismissed,
    toast,
    handleStartFromTitle,
    handleSelectDifficulty,
    handleSelectMapPreset,
    handlePreviewNewMap,
    handleNewMapInGame,
    handleTogglePause,
    handleReturnTitle,
    handleToggleMute,
    handleToggleMusic,
    handleToggleBattleLog,
    handleToggleSupplyMode,
    handleCycleSpeed,
    handleChangeSendRatio,
    handleCycleSendRatio,
    handleCycleCastle,
    handleQuickAttackSpace,
    handleRallySelected,
    handleBuild,
    handleTriggerPower,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp,
    handleCanvasPointerCancel,
    handleCanvasPointerLeave,
    handleCanvasContextMenu,
    handleCanvasWheel,
  };
}
