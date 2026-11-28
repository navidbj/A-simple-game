import { memo, useEffect, useRef, useState } from 'react';
import type { FactionPowerEntry, HudSnapshot } from '../game/types';
import { KeyboardIcon, LogScrollIcon, MapDiceIcon, MusicNoteIcon } from './GameIcons';
import {
  BalanceBarVineCap,
  PixelSparkle,
  RedSwordPixelIcon,
  RoyalTerritoryCrest,
  RoyalTitleCrown,
  SilverSwordPixelIcon,
  StoneBrassStud,
  StoneCornerVine,
  WoodGearIcon,
  WoodMenuIcon,
  WoodPauseIcon,
  WoodSpeakerIcon,
} from './HudOrnaments';

interface TopHudBarProps {
  hud: HudSnapshot;
  compact: boolean;
  muted: boolean;
  musicMuted: boolean;
  masterVolume: number;
  zoomLevel: number;
  battleLogOpen: boolean;
  gameSpeed: number;
  onCycleSpeed: () => void;
  onOpenShortcuts: () => void;
  onNewMap: () => void;
  onToggleMusic: () => void;
  onToggleMute: () => void;
  onChangeVolume: (volume: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onTogglePause: () => void;
  onToggleBattleLog: () => void;
}

function formatClock(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const TopHudBar = memo(function TopHudBar({
  hud,
  compact,
  muted,
  musicMuted,
  masterVolume,
  zoomLevel,
  battleLogOpen,
  gameSpeed,
  onCycleSpeed,
  onOpenShortcuts,
  onNewMap,
  onToggleMusic,
  onToggleMute,
  onChangeVolume,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onTogglePause,
  onToggleBattleLog,
}: TopHudBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [soundMenuOpen, setSoundMenuOpen] = useState(false);
  const [hoveredFaction, setHoveredFaction] = useState<FactionPowerEntry | null>(null);
  const menuWrapRef = useRef<HTMLDivElement | null>(null);
  const totalTerr = Math.max(1, hud.totalTerritories);
  const speedLabel = gameSpeed === 1.5 ? '1.5×' : `${gameSpeed}×`;

  useEffect(() => {
    if (!menuOpen && !soundMenuOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setSoundMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        setMenuOpen(false);
        setSoundMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKey, true);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKey, true);
    };
  }, [menuOpen, soundMenuOpen]);

  const btnSize = compact ? 'w-9 h-9' : 'w-11 h-11';
  const iconSize = compact ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <header
      className={`relative z-30 shrink-0 pointer-events-none select-none ${
        compact ? 'pt-1 pb-0.5 px-2' : 'pt-1.5 pb-1 px-3 lg:px-5'
      }`}
      style={{
        paddingLeft: compact ? 'max(8px, env(safe-area-inset-left))' : undefined,
        paddingRight: compact ? 'max(8px, env(safe-area-inset-right))' : undefined,
      }}
    >
      <div className="w-full flex items-start justify-between gap-2 lg:gap-4">
        {/* RIGHT ZONE (first child in RTL): Royal Territory Crest + Carved Mossy Stone Sword Plaque */}
        <div className="pointer-events-auto flex flex-col items-start shrink-0">
          <div
            className={`hud-pixel-outline flex items-center gap-1.5 font-black text-[#f8f1df] leading-none ${
              compact ? 'text-sm mb-1' : 'text-xl lg:text-[23px] mb-1.5'
            }`}
          >
            <RoyalTerritoryCrest className={compact ? 'w-4 h-4 shrink-0' : 'w-5 h-6 shrink-0'} />
            <span>قلمرو</span>
            <span className="font-num tracking-tight">
              {hud.playerTerritories}
              <span className="text-[#cbd5e1]/80 font-bold">/{hud.totalTerritories}</span>
            </span>
          </div>

          {/* Sculpted Mossy Stone Dual-Sword Stat Plaque */}
          <div className="relative hud-stone-frame p-1">
            {!compact && (
              <>
                <StoneCornerVine
                  flipX
                  className="absolute -top-1 -right-1 w-7 h-6 opacity-95 z-10"
                />
                <StoneBrassStud className="absolute bottom-0.5 left-0.5 w-2 h-2 z-10" />
              </>
            )}
            <div
              dir="ltr"
              className={`hud-stone-inset flex items-center ${
                compact ? 'gap-2.5 px-2 py-0.5' : 'gap-4 px-3.5 py-1'
              }`}
            >
              <div
                className="flex items-center gap-1.5"
                title="کل نیروی نظامی امپراتوری شما"
                aria-label={`کل نیروی نظامی: ${hud.playerMilitary}`}
              >
                <div className="flex flex-col items-end leading-none">
                  <span
                    className={`font-num font-black text-[#fef3c7] ${
                      compact ? 'text-xs' : 'text-base lg:text-lg'
                    }`}
                  >
                    {hud.playerMilitary}
                  </span>
                  {!compact && (
                    <span className="text-[9px] text-[#fca5a5]/90 font-bold mt-0.5">نظامی</span>
                  )}
                </div>
                <RedSwordPixelIcon className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
              </div>

              <span className="w-px h-6 bg-[#181b22]" aria-hidden="true" />

              <div
                className="flex items-center gap-1.5"
                title="کل نیروی انسانی ذخیره در قلعه‌های شما"
                aria-label={`کل نیروی انسانی ذخیره: ${hud.playerManpower}`}
              >
                <div className="flex flex-col items-end leading-none">
                  <span
                    className={`font-num font-black text-[#e2e8f0] ${
                      compact ? 'text-xs' : 'text-base lg:text-lg'
                    }`}
                  >
                    {hud.playerManpower}
                  </span>
                  {!compact && (
                    <span className="text-[9px] text-[#93c5fd]/90 font-bold mt-0.5">انسانی</span>
                  )}
                </div>
                <SilverSwordPixelIcon className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
              </div>
            </div>
          </div>
        </div>

        {/* ZOOM & VOLUME TRAY */}
        <div className="pointer-events-auto shrink-0 self-center">
          <div className="relative hud-stone-frame p-1">
            {!compact && <StoneBrassStud className="absolute bottom-0.5 left-0.5 w-2 h-2 z-10" />}
            <div
              dir="ltr"
              className={`hud-wood-tray flex items-center ${
                compact ? 'gap-1 px-1.5 py-1' : 'gap-2 px-2.5 py-1.5'
              }`}
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onZoomOut();
                  }}
                  aria-label="کوچک‌نمایی"
                  title="کوچک‌نمایی"
                  className={`${
                    compact ? 'w-7 h-7 text-sm' : 'w-8 h-8 text-base'
                  } hud-wood-btn font-black text-[#f3bd59] flex items-center justify-center cursor-pointer`}
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onResetZoom();
                  }}
                  aria-label="بازنشانی زوم"
                  title="بازنشانی زوم به ۱×"
                  className={`${
                    compact ? 'h-7 px-1.5 text-[10px]' : 'h-8 px-2 text-xs'
                  } hud-wood-btn font-num font-black flex items-center justify-center cursor-pointer ${
                    zoomLevel > 1.05 ? '!border-[#facc15] text-[#fef08a]' : 'text-[#e2d4b7]'
                  }`}
                >
                  {zoomLevel.toFixed(1)}×
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onZoomIn();
                  }}
                  aria-label="بزرگ‌نمایی"
                  title="بزرگ‌نمایی"
                  className={`${
                    compact ? 'w-7 h-7 text-sm' : 'w-8 h-8 text-base'
                  } hud-wood-btn font-black text-[#f3bd59] flex items-center justify-center cursor-pointer`}
                >
                  +
                </button>
              </div>
              <span className="w-px h-5 bg-[#181b22]" aria-hidden="true" />
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onToggleMute();
                  }}
                  aria-label={muted ? 'وصل صدا' : 'قطع صدا'}
                  className={`${
                    compact ? 'w-7 h-7' : 'w-8 h-8'
                  } hud-wood-btn flex items-center justify-center cursor-pointer ${
                    muted ? '!border-[#f87171]/70' : ''
                  }`}
                >
                  <WoodSpeakerIcon muted={muted} className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={muted ? 0 : Math.round(masterVolume * 100)}
                  onChange={(e) => onChangeVolume(Number(e.target.value) / 100)}
                  aria-label="تنظیم میزان صدا"
                  className={`${compact ? 'w-12' : 'w-20'} h-1.5 accent-[#f3bd59] cursor-pointer`}
                />
                <span
                  className={`font-num font-bold text-[#fef3c7] ${
                    compact ? 'text-[10px] w-7' : 'text-xs w-8'
                  } text-right`}
                >
                  {muted ? '۰٪' : `${Math.round(masterVolume * 100)}%`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER ZONE: Royal Crown + Embossed Golden Title + Interactive Vine-Wrapped Balance Bar */}
        <div className="pointer-events-auto flex-1 min-w-0 flex flex-col items-center justify-start">
          {/* Royal Crown Crest + Embossed Golden Title */}
          <div className="relative flex flex-col items-center">
            {!compact && (
              <RoyalTitleCrown className="w-8 h-3 -mb-0.5 opacity-95 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
            )}
            <div className="relative flex items-center justify-center gap-2.5">
              {!compact && (
                <div className="flex flex-col items-end gap-1 -translate-y-0.5">
                  <PixelSparkle className="w-3 h-3 opacity-95" />
                  <PixelSparkle className="w-2 h-2 opacity-75 translate-x-1" />
                </div>
              )}
              <h1
                className={`hud-gold-wordmark font-black tracking-tight leading-none whitespace-nowrap ${
                  compact ? 'text-lg pt-0.5' : 'text-2xl sm:text-3xl lg:text-[34px]'
                }`}
              >
                فتح قلمرو
              </h1>
              {!compact && (
                <div className="flex flex-col items-start gap-1 translate-y-0.5">
                  <PixelSparkle className="w-2 h-2 opacity-75 -translate-x-1" />
                  <PixelSparkle className="w-3 h-3 opacity-95" />
                </div>
              )}
            </div>
          </div>

          {/* Interactive Vine-Wrapped Carved Wood & Stone Territorial Balance Bar */}
          <div
            className={`relative w-full ${
              compact ? 'max-w-[240px] mt-1' : 'max-w-[510px] lg:max-w-[550px] mt-1.5'
            }`}
            aria-label="توازن قدرت کشورها"
            onMouseLeave={() => setHoveredFaction(null)}
          >
            {!compact && (
              <>
                <BalanceBarVineCap
                  side="left"
                  className="absolute -left-3 -top-1.5 w-6 h-7 z-10"
                />
                <BalanceBarVineCap
                  side="right"
                  className="absolute -right-3 -top-1.5 w-6 h-7 z-10"
                />
              </>
            )}

            <div className="hud-wood-tray p-[3px] shadow-[0_5px_14px_rgba(0,0,0,0.7)]">
              <div
                className={`w-full overflow-hidden bg-[#182030] border border-[#120b06] flex ${
                  compact ? 'h-2.5' : 'h-4'
                }`}
              >
                {hud.factionPowers.map((fp) => {
                  if (fp.territories === 0) return null;
                  const pct = (fp.territories / totalTerr) * 100;
                  const isHovered = hoveredFaction?.id === fp.id;
                  return (
                    <div
                      key={fp.id}
                      onMouseEnter={() => setHoveredFaction(fp)}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: fp.color,
                        boxShadow: isHovered
                          ? 'inset 0 0 0 1px #fef08a, inset 0 2px 0 rgba(255,255,255,0.45)'
                          : 'inset 0 2px 0 rgba(255,255,255,0.3), inset 0 -2px 0 rgba(0,0,0,0.36)',
                      }}
                      title={`${fp.name}: ${fp.territories} قلعه · ${fp.totalMilitary} نظامی`}
                      className="h-full transition-[width] duration-300 cursor-help"
                    />
                  );
                })}
              </div>
            </div>

            {/* Clean Spyglass Readout on Hover OR Quiet Faction Tally + Battle Clock */}
            {!compact && (
              <div className="mt-1 h-4 flex items-center justify-center gap-3 text-[11px] hud-pixel-outline">
                {hoveredFaction ? (
                  <div className="flex items-center gap-2 text-[#fef3c7] font-bold">
                    <span
                      className="inline-block w-2.5 h-2.5 border border-black/80"
                      style={{ backgroundColor: hoveredFaction.color }}
                      aria-hidden="true"
                    />
                    <span>{hoveredFaction.name}</span>
                    <span className="text-[#94a3b8]">·</span>
                    <span className="font-num text-[#fde68a]">
                      {hoveredFaction.territories} قلعه
                    </span>
                    <span className="text-[#94a3b8]">·</span>
                    <span className="font-num text-[#fca5a5]">
                      {hoveredFaction.totalMilitary} نظامی
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="hidden md:flex items-center gap-2.5">
                      {hud.factionPowers.map((fp) => (
                        <span
                          key={fp.id}
                          onMouseEnter={() => setHoveredFaction(fp)}
                          className={`inline-flex items-center gap-1 cursor-help ${
                            fp.territories === 0 ? 'opacity-35 line-through' : ''
                          }`}
                        >
                          <span
                            className="inline-block w-2 h-2 border border-black/75 shrink-0"
                            style={{ backgroundColor: fp.color }}
                            aria-hidden="true"
                          />
                          <span className="font-num font-bold text-[#f5efe0]">{fp.territories}</span>
                        </span>
                      ))}
                    </div>
                    <span className="hidden md:inline text-[#64748b]" aria-hidden="true">
                      ·
                    </span>
                    <span className="font-num font-bold text-[#fde68a]" title="زمان سپری‌شده نبرد">
                      {formatClock(hud.elapsedSeconds)}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* LEFT ZONE (last child in RTL): Sculpted Mossy Stone Utility Tray with 5 Carved Oak Buttons */}
        <div ref={menuWrapRef} className="pointer-events-auto relative shrink-0">
          <div className="relative hud-stone-frame p-1">
            {/* Draped Lush Pixel Vines & Corner Brass Studs */}
            <StoneCornerVine
              className={`absolute -top-1 -left-1 z-10 ${compact ? 'w-6 h-5' : 'w-9 h-8'}`}
            />
            {!compact && (
              <>
                <StoneCornerVine
                  flipX
                  className="absolute -top-1 -right-1 z-10 w-6 h-5 opacity-90"
                />
                <StoneBrassStud className="absolute bottom-0.5 right-0.5 w-2 h-2 z-10" />
              </>
            )}

            {/* 5 Chunky Beveled Dark-Oak Buttons ordered visually L->R matching reference: [||] [🔊] [1×] [⚙] [☰] */}
            <div
              dir="ltr"
              className={`hud-wood-tray flex items-center ${compact ? 'gap-1 p-1' : 'gap-1.5 p-1.5'}`}
            >
              {/* 1. Pause [P] */}
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onTogglePause();
                }}
                aria-label="توقف بازی (P)"
                title="توقف بازی (کلید P)"
                className={`relative ${btnSize} hud-wood-btn flex items-center justify-center cursor-pointer`}
              >
                <WoodPauseIcon className={iconSize} />
                {!compact && (
                  <span className="hud-keycap absolute -bottom-1 -right-1 px-1 text-[8px] font-num font-bold leading-tight">
                    P
                  </span>
                )}
              </button>

              {/* 2. Sound Settings & Mute [M] */}
              <div className="relative">
                <button
                  type="button"
                  aria-pressed={soundMenuOpen || muted}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setMenuOpen(false);
                    setSoundMenuOpen((prev) => !prev);
                  }}
                  aria-label="تنظیمات صدا"
                  title="تنظیم میزان صدا و قطع/وصل"
                  className={`relative ${btnSize} hud-wood-btn flex items-center justify-center cursor-pointer ${
                    muted ? '!border-[#f87171]/70' : soundMenuOpen ? '!border-[#fde047]' : ''
                  }`}
                >
                  <WoodSpeakerIcon muted={muted} className={iconSize} />
                  {!compact && (
                    <span className="hud-keycap absolute -bottom-1 -right-1 px-1 text-[8px] font-num font-bold leading-tight">
                      M
                    </span>
                  )}
                </button>

                {soundMenuOpen && (
                  <div className="absolute left-0 top-full mt-2 w-56 hud-stone-frame p-1 z-50">
                    <div className="hud-wood-tray p-2.5 flex flex-col gap-2 text-xs font-bold">
                      <div className="flex items-center justify-between text-[11px] text-[#d6b472]">
                        <span>میزان صدا</span>
                        <span className="font-num text-[#fef3c7]">
                          {muted ? '۰٪ (قطع)' : `${Math.round(masterVolume * 100)}٪`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={muted ? 0 : Math.round(masterVolume * 100)}
                        onChange={(e) => onChangeVolume(Number(e.target.value) / 100)}
                        aria-label="تنظیم میزان صدا"
                        className="w-full accent-amber-400 cursor-pointer"
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={onToggleMute}
                          className="flex-1 min-h-[34px] hud-wood-btn px-2 py-1 text-[11px] text-[#f6efe0] cursor-pointer"
                        >
                          {muted ? 'وصل صدا' : 'قطع صدا'}
                        </button>
                        <button
                          type="button"
                          onClick={onToggleMusic}
                          className="flex-1 min-h-[34px] hud-wood-btn px-2 py-1 text-[11px] text-[#f6efe0] cursor-pointer"
                        >
                          موسیقی: {musicMuted || muted ? 'خاموش' : 'روشن'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Game Speed [F] */}
              <button
                type="button"
                aria-pressed={gameSpeed > 1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onCycleSpeed();
                }}
                aria-label={`سرعت بازی ${speedLabel} (F)`}
                title="تغییر سرعت بازی: ۱× / ۱.۵× / ۲× (کلید F)"
                className={`relative ${btnSize} hud-wood-btn flex items-center justify-center cursor-pointer ${
                  gameSpeed > 1 ? '!border-[#facc15] hud-wood-btn-ready' : ''
                }`}
              >
                <span
                  className={`font-num font-black leading-none ${
                    compact ? 'text-[11px]' : 'text-sm'
                  } ${gameSpeed > 1 ? 'text-[#fef08a]' : 'text-[#f3bd59]'}`}
                >
                  {speedLabel}
                </span>
                {!compact && (
                  <span className="hud-keycap absolute -bottom-1 -right-1 px-1 text-[8px] font-num font-bold leading-tight">
                    F
                  </span>
                )}
              </button>

              {/* 4. Shortcuts & Controls Guide [H] */}
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setMenuOpen(false);
                  onOpenShortcuts();
                }}
                aria-label="راهنمای کلیدهای میانبر و تنظیمات (H)"
                title="راهنمای کلیدهای میانبر (کلید H)"
                className={`relative ${btnSize} hud-wood-btn flex items-center justify-center cursor-pointer`}
              >
                <WoodGearIcon className={iconSize} />
                {!compact && (
                  <span className="hud-keycap absolute -bottom-1 -right-1 px-1 text-[8px] font-num font-bold leading-tight">
                    H
                  </span>
                )}
              </button>

              {/* 5. Quick Command Menu [☰] */}
              <button
                type="button"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setMenuOpen((prev) => !prev);
                }}
                aria-label="منوی سریع بازی"
                title="منوی سریع: موسیقی، نقشه جدید و گزارش نبرد"
                className={`relative ${btnSize} hud-wood-btn flex items-center justify-center cursor-pointer ${
                  menuOpen ? '!border-[#fde047]' : ''
                }`}
              >
                <WoodMenuIcon className={iconSize} />
              </button>
            </div>
          </div>

          {/* Sculpted Stone & Oak Quick Menu Popover */}
          {menuOpen && (
            <div
              role="menu"
              aria-label="منوی ابزارهای بازی"
              className="absolute left-0 top-full mt-2 w-60 hud-stone-frame p-1 z-50"
            >
              <div className="hud-wood-tray p-2 flex flex-col gap-1.5 text-xs font-bold">
                <div className="flex items-center justify-between px-1 pb-1 border-b border-[#573b27]/50 text-[11px] text-[#d6b472]">
                  <span>ابزارهای فرماندهی</span>
                  <span className="font-num text-[#fef3c7]">{formatClock(hud.elapsedSeconds)}</span>
                </div>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onToggleMusic();
                    setMenuOpen(false);
                  }}
                  className="w-full min-h-[42px] hud-wood-btn px-3 py-2 flex items-center justify-between gap-2 text-[#f6efe0] cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <MusicNoteIcon
                      muted={musicMuted || muted}
                      className={`w-4 h-4 ${
                        !musicMuted && !muted ? 'text-[#fde047]' : 'text-[#94a3b8]'
                      }`}
                    />
                    <span>موسیقی ۱۶ بیتی</span>
                  </span>
                  <span className="text-[10px] font-num text-[#fde68a]">
                    {musicMuted || muted ? 'خاموش' : 'روشن'} [B]
                  </span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onNewMap();
                    setMenuOpen(false);
                  }}
                  className="w-full min-h-[42px] hud-wood-btn px-3 py-2 flex items-center justify-between gap-2 text-[#f6efe0] cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <MapDiceIcon className="w-4 h-4 text-[#f3bd59]" />
                    <span>نقشه تصادفی جدید</span>
                  </span>
                  <span className="text-[10px] font-num text-[#d6b472]">[N]</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onToggleBattleLog();
                    setMenuOpen(false);
                  }}
                  className="w-full min-h-[42px] hud-wood-btn px-3 py-2 flex items-center justify-between gap-2 text-[#f6efe0] cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <LogScrollIcon className="w-4 h-4 text-[#f3bd59]" />
                    <span>{battleLogOpen ? 'بستن گزارش نبرد' : 'باز کردن گزارش نبرد'}</span>
                  </span>
                  <span className="text-[10px] font-num text-[#d6b472]">[L]</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onOpenShortcuts();
                    setMenuOpen(false);
                  }}
                  className="w-full min-h-[42px] hud-wood-btn px-3 py-2 flex items-center justify-between gap-2 text-[#f6efe0] cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <KeyboardIcon className="w-4 h-4 text-[#f3bd59]" />
                    <span>راهنمای کلیدها</span>
                  </span>
                  <span className="text-[10px] font-num text-[#d6b472]">[H]</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
});
