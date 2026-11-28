import { memo } from 'react';
import { COMMANDER_POWERS } from '../game/constants';
import type { HudSnapshot, PowerType } from '../game/types';
import { RichPowerIcon, StoneBrassStud } from './HudOrnaments';

interface CommanderPowersRailProps {
  hud: HudSnapshot;
  compact: boolean;
  onTriggerPower: (power: PowerType) => void;
}

const POWER_ITEMS: Array<{ type: PowerType; shortLabel: string }> = [
  { type: 'mobilize', shortLabel: 'بسیج' },
  { type: 'blitz', shortLabel: 'یورش' },
  { type: 'shield', shortLabel: 'سپر' },
];

export const CommanderPowersRail = memo(function CommanderPowersRail({
  hud,
  compact,
  onTriggerPower,
}: CommanderPowersRailProps) {
  const sel = hud.selectedTerritory;
  const isPlayerOwned = sel !== null && sel.owner === 0;

  return (
    <aside
      aria-label="مهارت‌های فرماندهی"
      className={`absolute z-25 select-none ${
        compact
          ? 'left-1.5 top-2'
          : 'left-1.5 top-2.5 xl:left-[2px] xl:top-1/2 xl:-translate-y-1/2'
      }`}
    >
      {/* Sculpted Stone & Grained Oak Vertical Ability Dock */}
      <div className="relative hud-stone-frame p-[3px]">
        {!compact && (
          <>
            <StoneBrassStud className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 z-20" />
            <StoneBrassStud className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 z-20" />
          </>
        )}

        <div className="hud-wood-tray p-1 flex flex-col items-center gap-1">
          {POWER_ITEMS.map(({ type, shortLabel }) => {
            const cfg = COMMANDER_POWERS[type];
            const cd = hud.powers.cooldowns[type];
            const activeRemaining =
              type === 'blitz'
                ? hud.powers.blitzTimer
                : type === 'shield'
                  ? (sel?.shieldTimer ?? 0)
                  : 0;
            const isActive = activeRemaining > 0;
            const needsOwn = cfg.requiresSelectedOwnCastle && !isPlayerOwned;
            const lowManpower = type === 'mobilize' && (sel?.manpower ?? 0) < 6;
            const disabled = cd > 0 || needsOwn || lowManpower;

            const cooldownPct =
              cd > 0 && cfg.cooldown > 0 ? Math.min(100, (cd / cfg.cooldown) * 100) : 0;
            const activePct =
              isActive && cfg.duration > 0
                ? Math.min(100, (activeRemaining / cfg.duration) * 100)
                : 0;

            const showRadiantFrame = isActive || (type === 'blitz' && !disabled);

            return (
              <div key={type} className="relative group flex">
                <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={isActive}
                  data-power={type}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onTriggerPower(type);
                  }}
                  aria-label={`${cfg.name} [${cfg.hotkey}] — ${cfg.shortEffect}${cd > 0 ? ` (آماده‌سازی ${Math.ceil(cd)} ثانیه)` : ''}`}
                  className={`relative overflow-hidden ${
                    showRadiantFrame
                      ? 'hud-wood-btn hud-power-radiant text-[#f0f9ff] cursor-pointer'
                      : !disabled
                        ? 'hud-wood-btn text-[#f5eedc] cursor-pointer'
                        : 'hud-wood-btn text-[#8a7a69] cursor-not-allowed'
                  } flex flex-col items-center justify-center gap-0.5 ${
                    compact
                      ? 'w-[42px] h-[44px] px-0.5 py-0.5'
                      : 'w-[46px] h-[54px] xl:w-[42px] xl:h-[56px] px-0.5 py-1'
                  }`}
                >
                  {/* Engraved Brass Corner Keycap (Desktop) */}
                  {!compact && (
                    <span
                      aria-hidden="true"
                      className="hud-keycap absolute top-0.5 left-0.5 px-0.5 text-[7px] font-num font-bold leading-tight z-20"
                    >
                      {cfg.hotkey}
                    </span>
                  )}

                  {/* Cooldown Vertical Curtain Overlay */}
                  {cooldownPct > 0 && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 bottom-0 bg-[#0c0806]/68 border-t border-[#fde68a]/40 z-10 transition-[height] duration-150"
                      style={{ height: `${cooldownPct}%` }}
                    />
                  )}

                  <RichPowerIcon
                    type={type}
                    className={`relative z-20 shrink-0 ${
                      compact ? 'w-5 h-5' : 'w-6 h-6'
                    }`}
                  />
                  <span
                    className={`relative z-20 font-extrabold leading-none whitespace-nowrap ${
                      compact ? 'text-[9px]' : 'text-[10px]'
                    }`}
                  >
                    {cd > 0 ? (
                      <span className="font-num text-[#fde68a]">{Math.ceil(cd)}s</span>
                    ) : isActive ? (
                      <span className="font-num text-[#7dd3fc]">
                        {Math.ceil(activeRemaining)}s
                      </span>
                    ) : (
                      shortLabel
                    )}
                  </span>

                  {/* Active Duration Bar along bottom edge */}
                  {activePct > 0 && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute bottom-0 left-0 h-[3px] bg-[#38bdf8] shadow-[0_0_6px_#38bdf8] z-20 transition-[width] duration-150"
                      style={{ width: `${activePct}%` }}
                    />
                  )}
                </button>

                {/* Desktop Carved-Wood Tactical Tooltip opening cleanly inward (to the right) */}
                {!compact && (
                  <div
                    role="tooltip"
                    className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-100 absolute left-full ml-2.5 top-1/2 -translate-y-1/2 w-52 hud-stone-frame p-1 z-50"
                  >
                    <div className="hud-wood-tray px-3 py-2 text-right">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-[#fde68a]">{cfg.name}</span>
                        <span className="font-num text-[10px] text-[#cbd5e1]">
                          [{cfg.hotkey}]
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-snug text-[#f5eedc]">
                        {cfg.shortEffect}
                      </p>
                      {cd > 0 && (
                        <p className="mt-1 text-[10px] font-num text-[#fca5a5]">
                          آماده‌سازی مجدد: {Math.ceil(cd)} ثانیه
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
});
