import {
  BIOMES,
  BUILDINGS,
  COMMANDER_POWERS,
  FACTIONS,
  NEUTRAL_STYLE,
} from '../game/constants';
import { isBuildingBuilt } from '../game/simulation';
import type { BuildingType, HudSnapshot, PowerType } from '../game/types';
import { BuildingIcon, PowerIcon, RallyIcon } from './GameIcons';

interface MobileCommandBarProps {
  hud: HudSnapshot;
  onCycleSendRatio: () => void;
  onBuild: (type: BuildingType) => void;
  onTriggerPower: (power: PowerType) => void;
  onRally: () => void;
}

const BUILDING_ITEMS: Array<{ type: BuildingType; shortLabel: string }> = [
  { type: 'barracks', shortLabel: 'سربازخانه' },
  { type: 'tower', shortLabel: 'برج' },
  { type: 'mine', shortLabel: 'معدن' },
  { type: 'forge', shortLabel: 'آهنگری' },
];

const POWER_ITEMS: Array<{ type: PowerType; shortLabel: string }> = [
  { type: 'mobilize', shortLabel: 'بسیج' },
  { type: 'blitz', shortLabel: 'یورش' },
  { type: 'shield', shortLabel: 'سپر' },
];

export function MobileCommandBar({
  hud,
  onCycleSendRatio,
  onBuild,
  onTriggerPower,
  onRally,
}: MobileCommandBarProps) {
  const sel = hud.selectedTerritory;
  const isPlayerOwned = sel !== null && sel.owner === 0;
  const ownerColor =
    sel === null
      ? '#64748b'
      : sel.owner === -1
        ? NEUTRAL_STYLE.color
        : FACTIONS[sel.owner].color;
  const ratioPct = Math.round(hud.sendRatio * 100);

  return (
    <nav
      aria-label="نوار فرماندهی سریع موبایل"
      className="shrink-0 bg-[#101827] border-t-2 border-[#263650] px-2 pt-1.5"
      style={{
        paddingBottom: 'max(6px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(8px, env(safe-area-inset-left))',
        paddingRight: 'max(8px, env(safe-area-inset-right))',
      }}
    >
      <div className="overflow-x-auto no-scrollbar">
        <div className="mx-auto w-max flex items-center gap-1.5">
        {/* 1. Compact Selected Castle Readout */}
        <div className="min-w-[96px] max-w-[120px] shrink-0 bg-[#142033] border-2 border-[#25354f] px-2 py-1 flex flex-col justify-center min-h-[46px]">
          <div className="flex items-center gap-1 min-w-0">
            <span
              className="w-2 h-2 shrink-0"
              style={{ backgroundColor: ownerColor }}
              aria-hidden="true"
            />
            <span className="text-[11px] font-extrabold text-[#f2e8d5] truncate">
              {sel ? sel.name : 'قلعه‌ای انتخاب کنید'}
            </span>
          </div>
          {sel ? (
            <div className="mt-0.5 flex items-center justify-between gap-1.5 text-[10px] text-[#9fb0c6]">
              <span className="font-num font-bold text-white">{Math.floor(sel.military)}</span>
              <span className="text-[#475569]">/</span>
              <span className="font-num text-[#d6b472]">{Math.floor(sel.manpower)}</span>
              <span className="truncate text-[9px] text-[#94a3b8]">{BIOMES[sel.biome].name}</span>
            </div>
          ) : (
            <span className="text-[9px] text-[#64748b] truncate">بکشید یا لمس کنید</span>
          )}
        </div>

        {/* 2. Cycling Troop Send Ratio Button */}
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onCycleSendRatio();
          }}
          aria-label={`تغییر نسبت اعزام نیرو، فعلی ${ratioPct} درصد`}
          className="min-w-[52px] min-h-[46px] shrink-0 px-2 py-1 bg-[#c99846] active:bg-[#b58636] border-2 border-[#fde68a]/50 text-[#0b1320] flex flex-col items-center justify-center cursor-pointer"
        >
          <span className="font-num text-sm font-black leading-none">{ratioPct}%</span>
          <span className="text-[9px] font-bold leading-tight mt-0.5">اعزام</span>
        </button>

        {/* 3. Quick Rally Reinforcements Button */}
        <button
          type="button"
          tabIndex={-1}
          disabled={!isPlayerOwned}
          onClick={(e) => {
            e.currentTarget.blur();
            onRally();
          }}
          aria-label="فراخوانی نیروهای کمکی از قلعه‌های هم‌مرز"
          title="فراخوانی کمکی از همسایگان خودی"
          className={`min-w-[52px] min-h-[46px] shrink-0 px-2 py-1 border-2 flex flex-col items-center justify-center transition-colors ${
            isPlayerOwned
              ? 'bg-[#162822] active:bg-[#1e3a30] border-[#2f6f55] text-[#86efac] cursor-pointer'
              : 'bg-[#101827] border-[#1f2c40] text-[#475569] cursor-not-allowed'
          }`}
        >
          <RallyIcon className="w-4 h-4 shrink-0" />
          <span className="text-[9px] font-extrabold leading-tight mt-0.5 whitespace-nowrap">
            کمکی
          </span>
        </button>

        <span className="h-8 w-px bg-[#25354f] shrink-0" aria-hidden="true" />

        {/* 4. All 4 Buildings — 1-Tap Access without Drawer */}
        <div className="flex items-center gap-1 shrink-0">
          {BUILDING_ITEMS.map(({ type, shortLabel }) => {
            const cfg = BUILDINGS[type];
            const alreadyBuilt = sel !== null && isBuildingBuilt(sel, type);
            const canAfford = isPlayerOwned && sel !== null && sel.military >= cfg.cost;
            const disabled = !isPlayerOwned || alreadyBuilt || !canAfford;

            return (
              <button
                key={type}
                type="button"
                tabIndex={-1}
                disabled={disabled}
                aria-label={`${cfg.name}، هزینه ${cfg.cost} نظامی`}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onBuild(type);
                }}
                className={`min-w-[56px] min-h-[46px] px-1.5 py-1 border-2 flex flex-col items-center justify-center transition-colors ${
                  alreadyBuilt
                    ? 'bg-[#152823] border-[#28634d] text-[#86efac]'
                    : !disabled
                      ? 'bg-[#162236] active:bg-[#223452] border-[#385073] text-[#f6efe0] cursor-pointer'
                      : 'bg-[#111929] border-[#1e2a3d] text-[#64748b] cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-1">
                  <BuildingIcon type={type} className="w-4 h-4 shrink-0" />
                  <span className="font-num text-[10px] font-bold">
                    {alreadyBuilt ? '✓' : cfg.cost}
                  </span>
                </div>
                <span className="text-[9px] font-bold leading-tight mt-0.5 whitespace-nowrap">
                  {shortLabel}
                </span>
              </button>
            );
          })}
        </div>

        <span className="h-8 w-px bg-[#25354f] shrink-0" aria-hidden="true" />

        {/* 5. All 3 Commander Special Powers — 1-Tap Access without Drawer */}
        <div className="flex items-center gap-1 shrink-0">
          {POWER_ITEMS.map(({ type, shortLabel }) => {
            const cfg = COMMANDER_POWERS[type];
            const cd = hud.powers.cooldowns[type];
            const isActive =
              (type === 'blitz' && hud.powers.blitzTimer > 0) ||
              (type === 'shield' && (sel?.shieldTimer ?? 0) > 0);
            const needsOwn = cfg.requiresSelectedOwnCastle && !isPlayerOwned;
            const lowManpower = type === 'mobilize' && (sel?.manpower ?? 0) < 6;
            const disabled = cd > 0 || needsOwn || lowManpower;

            return (
              <button
                key={type}
                type="button"
                tabIndex={-1}
                disabled={disabled}
                aria-label={`${cfg.name} — ${cfg.shortEffect}`}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onTriggerPower(type);
                }}
                className={`min-w-[50px] min-h-[46px] px-1.5 py-1 border-2 flex flex-col items-center justify-center transition-colors ${
                  isActive
                    ? 'bg-[#173352] border-[#38bdf8] text-[#e0f2fe]'
                    : !disabled
                      ? 'bg-[#162236] active:bg-[#233554] border-[#395275] text-[#f6efe0] cursor-pointer'
                      : 'bg-[#111929] border-[#1e2a3d] text-[#64748b] cursor-not-allowed'
                }`}
              >
                <PowerIcon type={type} className="w-4 h-4 shrink-0" />
                <span className="text-[9px] font-bold leading-tight mt-0.5 whitespace-nowrap">
                  {cd > 0 ? <span className="font-num">{Math.ceil(cd)}s</span> : shortLabel}
                </span>
              </button>
            );
          })}
        </div>
        </div>
      </div>
    </nav>
  );
}
