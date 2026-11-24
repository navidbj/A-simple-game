import type { HudSnapshot } from '../game/types';
import {
  KeyboardIcon,
  MapDiceIcon,
  PauseIcon,
  SoundIcon,
  SpeedIcon,
  SwordIcon,
} from './GameIcons';

interface TopHudBarProps {
  hud: HudSnapshot;
  compact: boolean;
  muted: boolean;
  gameSpeed: number;
  onCycleSpeed: () => void;
  onOpenShortcuts: () => void;
  onNewMap: () => void;
  onToggleMute: () => void;
  onTogglePause: () => void;
}

function formatClock(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function TopHudBar({
  hud,
  compact,
  muted,
  gameSpeed,
  onCycleSpeed,
  onOpenShortcuts,
  onNewMap,
  onToggleMute,
  onTogglePause,
}: TopHudBarProps) {
  const totalTerr = Math.max(1, hud.totalTerritories);
  const speedLabel = gameSpeed === 1.5 ? '1.5×' : `${gameSpeed}×`;

  if (compact) {
    return (
      <header
        className="h-10 shrink-0 bg-[#101827] border-b-2 border-[#25334a] flex items-center justify-between gap-2"
        style={{
          paddingLeft: 'max(8px, env(safe-area-inset-left))',
          paddingRight: 'max(8px, env(safe-area-inset-right))',
        }}
      >
        {/* Compact Key Readouts */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] text-[#94a3b8]">قلمرو</span>
            <span className="font-num text-sm font-bold text-[#f6efe0]">
              {hud.playerTerritories}
              <span className="text-[10px] text-[#64748b] font-normal">/{hud.totalTerritories}</span>
            </span>
          </div>

          <span className="h-3.5 w-px bg-[#25334a]" aria-hidden="true" />

          <div className="flex items-center gap-1">
            <SwordIcon className="w-3.5 h-3.5 text-[#f87171]" />
            <span className="font-num text-sm font-bold text-white">{hud.playerMilitary}</span>
          </div>
        </div>

        {/* Slim Live Power Balance Strip */}
        <div
          className="flex-1 max-w-[180px] sm:max-w-xs h-2 bg-[#1e293b] border border-[#334155] flex overflow-hidden"
          aria-label="توازن قدرت کشورها"
        >
          {hud.factionPowers.map((fp) => {
            if (fp.territories === 0) return null;
            const pct = (fp.territories / totalTerr) * 100;
            return (
              <div
                key={fp.id}
                style={{ width: `${pct}%`, backgroundColor: fp.color }}
                className="h-full transition-[width] duration-300"
              />
            );
          })}
        </div>

        {/* Compact Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onCycleSpeed();
            }}
            aria-label={`سرعت بازی ${speedLabel}`}
            title="تغییر سرعت بازی (F)"
            className={`h-8 min-w-[38px] px-1.5 border text-[11px] font-num font-bold flex items-center justify-center transition-colors cursor-pointer ${
              gameSpeed > 1
                ? 'bg-[#2a2312] border-[#c99846] text-[#fde68a]'
                : 'bg-[#182336] border-[#2c3d59] text-[#cbd5e1]'
            }`}
          >
            <span dir="ltr">{speedLabel}</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onNewMap();
            }}
            aria-label="نقشه تصادفی جدید"
            title="نقشه تصادفی جدید"
            className="w-8 h-8 bg-[#182336] active:bg-[#23324b] border border-[#2c3d59] text-[#d6b472] flex items-center justify-center cursor-pointer"
          >
            <MapDiceIcon className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            aria-label={muted ? 'فعال کردن صدا' : 'قطع صدا'}
            className="w-8 h-8 bg-[#182336] active:bg-[#23324b] border border-[#2c3d59] text-[#cbd5e1] flex items-center justify-center cursor-pointer"
          >
            <SoundIcon muted={muted} className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onTogglePause();
            }}
            aria-label="توقف بازی"
            className="w-8 h-8 bg-[#182336] active:bg-[#23324b] border border-[#2c3d59] text-[#cbd5e1] flex items-center justify-center cursor-pointer"
          >
            <PauseIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="h-13 shrink-0 bg-[#101827] border-b border-[#25334a] px-4 flex items-center justify-between gap-4">
      {/* Start Group: Key Player Readouts */}
      <div className="flex items-center gap-5 shrink-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-[#94a3b8]">قلمروها</span>
          <span className="font-num text-lg font-bold text-[#f6efe0]">
            {hud.playerTerritories}
            <span className="text-xs text-[#64748b] font-normal">/{hud.totalTerritories}</span>
          </span>
        </div>

        <span className="h-4 w-px bg-[#25334a]" aria-hidden="true" />

        <div className="flex items-center gap-1.5">
          <SwordIcon className="w-4 h-4 text-[#f87171]" />
          <span className="text-xs text-[#94a3b8]">کل ارتش</span>
          <span className="font-num text-lg font-bold text-white">{hud.playerMilitary}</span>
        </div>

        <span className="hidden sm:inline-block h-4 w-px bg-[#25334a]" aria-hidden="true" />

        <div className="hidden sm:flex items-baseline gap-2">
          <span className="text-xs text-[#94a3b8]">زمان</span>
          <span className="font-num text-sm font-bold text-[#d6b472]">
            {formatClock(hud.elapsedSeconds)}
          </span>
        </div>
      </div>

      {/* Center: Live OpenFront-style Territorial Balance Strip */}
      <div
        className="hidden md:flex flex-1 max-w-md flex-col gap-1"
        aria-label="توازن قدرت کشورها"
      >
        <div className="h-2.5 w-full overflow-hidden bg-[#1e293b] flex border border-[#334155]">
          {hud.factionPowers.map((fp) => {
            if (fp.territories === 0) return null;
            const pct = (fp.territories / totalTerr) * 100;
            return (
              <div
                key={fp.id}
                style={{ width: `${pct}%`, backgroundColor: fp.color }}
                title={`${fp.name}: ${fp.territories} قلعه`}
                className="h-full transition-[width] duration-300"
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between text-[11px] text-[#94a3b8] px-0.5">
          {hud.factionPowers.map((fp) => (
            <span
              key={fp.id}
              className={`flex items-center gap-1 ${
                fp.territories === 0 ? 'opacity-35 line-through' : ''
              }`}
            >
              <span
                className="inline-block w-2 h-2 shrink-0"
                style={{ backgroundColor: fp.color }}
                aria-hidden="true"
              />
              <span>{fp.name}</span>
              <span className="font-num text-[#e2e8f0] font-bold">{fp.territories}</span>
            </span>
          ))}
        </div>
      </div>

      {/* End Group: Speed + Shortcuts + Utility Buttons */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onCycleSpeed();
          }}
          aria-label={`سرعت بازی ${speedLabel} (F)`}
          title="تغییر سرعت بازی: ۱× / ۱.۵× / ۲× (کلید F)"
          className={`h-9 px-2.5 border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
            gameSpeed > 1
              ? 'bg-[#2a2312] hover:bg-[#382e17] border-[#c99846] text-[#fde68a]'
              : 'bg-[#182336] hover:bg-[#23324b] border-[#2c3d59] text-[#cbd5e1] hover:text-white'
          }`}
        >
          <SpeedIcon className="w-3.5 h-3.5" />
          <span dir="ltr" className="font-num">{speedLabel}</span>
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onOpenShortcuts();
          }}
          aria-label="راهنمای کلیدهای میانبر (H)"
          title="راهنمای کلیدهای میانبر (H)"
          className="w-9 h-9 bg-[#182336] hover:bg-[#23324b] border border-[#2c3d59] text-[#cbd5e1] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <KeyboardIcon className="w-4 h-4" />
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          aria-label={muted ? 'فعال کردن صدا (M)' : 'قطع صدا (M)'}
          title={muted ? 'فعال کردن صدا (M)' : 'قطع صدا (M)'}
          className="w-9 h-9 bg-[#182336] hover:bg-[#23324b] border border-[#2c3d59] text-[#cbd5e1] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <SoundIcon muted={muted} className="w-4 h-4" />
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onTogglePause();
          }}
          aria-label="توقف بازی (P)"
          title="توقف بازی (P)"
          className="w-9 h-9 bg-[#182336] hover:bg-[#23324b] border border-[#2c3d59] text-[#cbd5e1] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <PauseIcon className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
