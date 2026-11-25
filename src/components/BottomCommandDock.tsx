import {
  BIOMES,
  BUILDINGS,
  FACTIONS,
  MAX_BUILDING_LEVEL,
  NEUTRAL_STYLE,
  SEND_RATIOS,
} from '../game/constants';
import { getBuildingLevel, getNextBuildingCost } from '../game/simulation';
import type { BuildingType, HudSnapshot } from '../game/types';
import { RallyIcon, SupplyLineIcon } from './GameIcons';
import {
  RedSwordPixelIcon,
  StoneBrassStud,
  StoneCornerVine,
  TierBuildingIcon,
} from './HudOrnaments';

interface BottomCommandDockProps {
  hud: HudSnapshot;
  compact: boolean;
  supplyMode: boolean;
  onChangeSendRatio: (ratio: number) => void;
  onCycleSendRatio: () => void;
  onCycleCastle: (reverse: boolean) => void;
  onQuickAttack: () => void;
  onBuild: (type: BuildingType) => void;
  onRally: () => void;
  onToggleSupply: () => void;
}

const BUILDING_ITEMS: Array<{ type: BuildingType; shortLabel: string }> = [
  { type: 'barracks', shortLabel: 'سربازخانه' },
  { type: 'tower', shortLabel: 'برج' },
  { type: 'mine', shortLabel: 'معدن' },
  { type: 'forge', shortLabel: 'آهنگری' },
  { type: 'port', shortLabel: 'بندرگاه' },
];

export function BottomCommandDock({
  hud,
  compact,
  supplyMode,
  onChangeSendRatio,
  onCycleSendRatio,
  onCycleCastle,
  onQuickAttack,
  onBuild,
  onRally,
  onToggleSupply,
}: BottomCommandDockProps) {
  const sel = hud.selectedTerritory;
  const isPlayerOwned = sel !== null && sel.owner === 0;
  const canSwitchCastle = hud.playerTerritories >= 2;
  const ownerMeta =
    sel === null
      ? null
      : sel.owner === -1
        ? { name: NEUTRAL_STYLE.name, color: NEUTRAL_STYLE.color }
        : { name: FACTIONS[sel.owner].shortName, color: FACTIONS[sel.owner].color };
  const biomeMeta = sel ? BIOMES[sel.biome] : null;
  const ratioPct = Math.round(hud.sendRatio * 100);

  return (
    <nav
      aria-label="نوار فرماندهی و ساخت‌وساز"
      className="relative z-30 shrink-0 select-none"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Sculpted Mossy-Stone Outer Bezel with Corner Brass Rivets & Hanging Ivy */}
      <div className="relative hud-stone-frame border-x-0 border-b-0 pt-[7px] pb-[7px] px-1.5 sm:px-2.5">
        <StoneCornerVine
          className={`absolute -top-1.5 left-0 z-20 ${compact ? 'w-8 h-7' : 'w-12 h-11'}`}
        />
        <StoneCornerVine
          flipX
          className={`absolute -top-1.5 right-0 z-20 ${compact ? 'w-8 h-7' : 'w-12 h-11'}`}
        />
        {!compact && (
          <>
            <StoneBrassStud className="absolute bottom-1 left-2 w-2.5 h-2.5 z-20" />
            <StoneBrassStud className="absolute bottom-1 right-2 w-2.5 h-2.5 z-20" />
          </>
        )}

        {/* Aged Oak Grained Wooden Interior Command Tray */}
        <div className="hud-wood-tray px-2 py-1.5 sm:px-3 sm:py-2 overflow-x-auto lg:overflow-visible no-scrollbar">
          <div className="mx-auto w-max min-w-full lg:min-w-0 flex items-stretch justify-between lg:justify-center gap-2 sm:gap-2.5">
            {/* ===============================================================
                1. FAR-RIGHT (RTL Start): Selected Castle Plaque + Castle Cycle + Tactical Trio
                =============================================================== */}
            <div className="flex items-stretch gap-1.5 shrink-0">
              <div
                className={`hud-stone-inset flex flex-col justify-between ${
                  compact
                    ? 'min-w-[144px] max-w-[178px] px-2 py-1'
                    : 'min-w-[238px] max-w-[266px] px-3 py-1.5'
                }`}
              >
                {sel && ownerMeta && biomeMeta ? (
                  <>
                    {/* Header: Castle Switcher + Name + Biome */}
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 border border-black/85 shrink-0"
                          style={{ backgroundColor: ownerMeta.color }}
                          aria-hidden="true"
                        />
                        <span
                          className={`font-black text-[#f8f1df] truncate ${
                            compact ? 'text-[11px]' : 'text-sm'
                          }`}
                        >
                          {sel.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className={`font-bold text-[#d6b472] ${
                            compact ? 'text-[9px]' : 'text-[11px]'
                          }`}
                          title={biomeMeta.shortBonus}
                        >
                          {biomeMeta.name}
                        </span>
                        {canSwitchCastle && (
                          <div className="inline-flex items-center gap-0.5 mr-0.5" dir="ltr">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.currentTarget.blur();
                                onCycleCastle(true);
                              }}
                              aria-label="قلعه قبلی (Shift+Tab)"
                              title="قلعه قبلی (Shift+Tab)"
                              className="w-5 h-5 hud-wood-btn text-[10px] text-[#fde68a] font-bold flex items-center justify-center cursor-pointer"
                            >
                              ‹
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.currentTarget.blur();
                                onCycleCastle(false);
                              }}
                              aria-label="قلعه بعدی (Tab)"
                              title="قلعه بعدی (Tab)"
                              className="w-5 h-5 hud-wood-btn text-[10px] text-[#fde68a] font-bold flex items-center justify-center cursor-pointer"
                            >
                              ›
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Live Military + Manpower + Defense Readouts */}
                    <div
                      className={`mt-1 flex items-center justify-between gap-2 ${
                        compact ? 'text-[10px]' : 'text-xs'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1 text-[#fef3c7] font-num font-black">
                        <RedSwordPixelIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>{Math.floor(sel.military)}</span>
                        {!compact && sel.owner !== -1 && (
                          <span className="text-[10px] text-[#86efac] font-bold">
                            +{sel.conversionRate.toFixed(1)}/ث
                          </span>
                        )}
                      </span>

                      <span className="inline-flex items-center gap-1.5 font-num text-[#cbd5e1]">
                        {sel.shieldTimer > 0 && (
                          <span className="text-[10px] font-bold text-[#7dd3fc]">
                            سپر {Math.ceil(sel.shieldTimer)}ث
                          </span>
                        )}
                        <span>
                          <span className="text-[#fde68a] font-bold">
                            {Math.floor(sel.manpower)}
                          </span>
                          <span className="text-[10px] text-[#94a3b8]">/{sel.maxManpower}</span>
                        </span>
                      </span>
                    </div>

                    {/* Crisp Pixel Manpower Capacity Bar */}
                    <div className="mt-1 h-1.5 w-full bg-[#151820] border border-black/80 overflow-hidden">
                      <div
                        className="h-full transition-[width] duration-200"
                        style={{
                          width: `${Math.min(100, (sel.manpower / sel.maxManpower) * 100)}%`,
                          backgroundColor:
                            sel.shieldTimer > 0
                              ? '#38bdf8'
                              : sel.hasBarracks
                                ? '#facc15'
                                : '#d6b472',
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-center py-1">
                    <div
                      className={`font-black text-[#f5eedc] leading-tight ${
                        compact ? 'text-xs' : 'text-[15px]'
                      }`}
                    >
                      قلعه‌ای انتخاب کنید
                    </div>
                    <div
                      className={`mt-0.5 text-[#a7b0bd] leading-tight ${
                        compact ? 'text-[10px]' : 'text-xs'
                      }`}
                    >
                      بکشید یا لمس کنید
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Tactical Actions (Attack / Rally / Auto-Supply) when player castle selected */}
              {isPlayerOwned && (
                <div className="grid grid-cols-1 gap-1 shrink-0">
                  <div className="flex items-stretch gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onQuickAttack();
                      }}
                      disabled={sel.military < 2}
                      title="حمله سریع به ضعیف‌ترین همسایه دشمن (کلید Space)"
                      aria-label="حمله سریع به ضعیف‌ترین همسایه (Space)"
                      className={`hud-wood-btn ${
                        sel.military >= 2 ? 'hud-wood-crimson text-[#fef2f2]' : 'text-[#7c6a5c]'
                      } px-2 py-0.5 flex items-center justify-center gap-1 font-extrabold cursor-pointer disabled:cursor-not-allowed whitespace-nowrap ${
                        compact ? 'text-[10px]' : 'text-[11px]'
                      }`}
                    >
                      <RedSwordPixelIcon className="w-3.5 h-3.5 shrink-0" />
                      <span>حمله</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onRally();
                      }}
                      title="فراخوانی ۵۰٪ نیروی کمکی از قلعه‌های هم‌مرز خودی (کلید A)"
                      aria-label="فراخوانی کمکی هم‌مرز (A)"
                      className={`hud-wood-btn hud-wood-emerald px-2 py-0.5 flex items-center justify-center gap-1 text-[#d1fae5] font-extrabold cursor-pointer whitespace-nowrap ${
                        compact ? 'text-[10px]' : 'text-[11px]'
                      }`}
                    >
                      <RallyIcon className="w-3.5 h-3.5 shrink-0" />
                      <span>کمکی</span>
                      {!compact && <span className="font-num text-[9px] opacity-75">[A]</span>}
                    </button>
                  </div>

                  <button
                    type="button"
                    aria-pressed={sel.supplyTargetId !== null || supplyMode}
                    disabled={sel.friendlyNeighborCount === 0 && sel.supplyTargetId === null}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onToggleSupply();
                    }}
                    title={
                      sel.supplyTargetName
                        ? `لغو خط تأمین خودکار به ${sel.supplyTargetName} (کلید S)`
                        : 'ایجاد خط تأمین خودکار به قلعه هم‌مرز خودی (کلید S)'
                    }
                    aria-label="خط تأمین خودکار نیرو (S)"
                    className={`hud-wood-btn px-2 py-0.5 flex items-center justify-center gap-1.5 font-extrabold whitespace-nowrap ${
                      sel.supplyTargetId !== null || supplyMode
                        ? 'hud-wood-emerald text-[#6ee7b7] cursor-pointer'
                        : sel.friendlyNeighborCount > 0
                          ? 'text-[#ede3cf] cursor-pointer'
                          : 'text-[#6c6055] cursor-not-allowed'
                    } ${compact ? 'text-[10px]' : 'text-[11px]'}`}
                  >
                    <SupplyLineIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate max-w-[94px]">
                      {supplyMode
                        ? 'انتخاب مقصد...'
                        : sel.supplyTargetName
                          ? `تأمین: ${sel.supplyTargetName}`
                          : 'خط تأمین'}
                    </span>
                    {!compact && <span className="font-num text-[9px] opacity-75">[S]</span>}
                  </button>
                </div>
              )}
            </div>

            {/* ===============================================================
                2. GILDED GOLD SEND RATIO MEDALLION + DIRECT 4-STEP 1-CLICK BAR
                =============================================================== */}
            <div className="hud-gold-tile shrink-0 flex flex-col justify-between relative overflow-hidden">
              {/* Golden corner rivets */}
              <span className="absolute top-1 left-1 w-1 h-1 bg-[#fef9c3]" aria-hidden="true" />
              <span className="absolute top-1 right-1 w-1 h-1 bg-[#fef9c3]" aria-hidden="true" />

              {/* Main Click-to-Cycle Golden Face */}
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onCycleSendRatio();
                }}
                title="کلیک برای تغییر چرخشی نسبت اعزام (یا انتخاب مستقیم از ردیف پایین / کلید ۱ تا ۴)"
                aria-label={`نسبت اعزام سربازان ${ratioPct} درصد`}
                className={`hud-focus-ring flex-1 flex flex-col items-center justify-center cursor-pointer ${
                  compact ? 'px-2 pt-1 pb-0.5 min-w-[68px]' : 'px-3 pt-1.5 pb-0.5 min-w-[104px]'
                }`}
              >
                <span
                  className={`font-num font-black text-[#1d1206] leading-none ${
                    compact ? 'text-base' : 'text-[22px]'
                  }`}
                >
                  {ratioPct}%
                </span>
                <span
                  className={`font-black text-[#2a1908] leading-tight ${
                    compact ? 'text-[9px]' : 'text-[11px]'
                  }`}
                >
                  اعزام نیرو
                </span>
              </button>

              {/* Direct 1-Click Ratio Micro-Tabs (25 / 50 / 75 / 100) */}
              <div
                role="group"
                aria-label="انتخاب مستقیم درصد اعزام"
                dir="ltr"
                className="grid grid-cols-4 border-t border-[#78350f]/80 bg-[#78350f]/25"
              >
                {SEND_RATIOS.map((r) => {
                  const pct = Math.round(r * 100);
                  const active = Math.abs(hud.sendRatio - r) < 0.01;
                  return (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={active}
                      aria-label={`اعزام ${pct} درصد`}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onChangeSendRatio(r);
                      }}
                      className={`hud-focus-ring font-num font-black cursor-pointer transition-colors ${
                        compact ? 'text-[8px] py-0.5' : 'text-[9px] py-0.5 px-1'
                      } ${
                        active
                          ? 'bg-[#3b1c04] text-[#fef08a]'
                          : 'text-[#3b1c04]/85 hover:bg-[#3b1c04]/25'
                      }`}
                    >
                      {pct === 100 ? 'کل' : pct}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="hud-wood-divider self-stretch shrink-0" aria-hidden="true" />

            {/* ===============================================================
                3. FIVE TIER-EVOLVING CARVED-WOOD BUILDING TILES (Lv.1 -> Lv.3)
                =============================================================== */}
            <div className="flex items-stretch gap-1.5 shrink-0">
              {BUILDING_ITEMS.map(({ type, shortLabel }) => {
                const cfg = BUILDINGS[type];
                const level = sel !== null ? getBuildingLevel(sel, type) : 0;
                const isMaxed = level >= MAX_BUILDING_LEVEL;
                const nextCost = sel !== null ? getNextBuildingCost(sel, type) : cfg.levelCosts[0];
                const needsCoast = type === 'port' && sel !== null && !sel.isCoastal;
                const canAfford =
                  isPlayerOwned && sel !== null && nextCost !== null && sel.military >= nextCost;
                const disabled = !isPlayerOwned || isMaxed || needsCoast || !canAfford;

                // Live affordability progress meter when saving up for next tier
                const affordProgress =
                  isPlayerOwned && sel !== null && nextCost !== null && !isMaxed && !needsCoast
                    ? Math.min(100, Math.max(0, (sel.military / nextCost) * 100))
                    : 0;

                const currentTierName = level > 0 ? cfg.levelNames[level - 1] : cfg.name;
                const tooltipEffect =
                  level === 3
                    ? `حداکثر سطح ۳ ★ · ${cfg.levelEffects[2]}`
                    : level === 1 || level === 2
                      ? `ارتقا به ${cfg.levelNames[level]} (${nextCost} نظامی) · ${cfg.levelEffects[level]}`
                      : needsCoast
                        ? 'فقط در قلعه‌های ساحلی قابل ساخت است'
                        : `${cfg.levelEffects[0]} (${nextCost} نظامی)`;

                const stateClass = isMaxed
                  ? 'hud-wood-btn hud-wood-btn-maxed text-[#fef08a] cursor-default'
                  : !disabled && level > 0
                    ? 'hud-wood-btn hud-wood-btn-upgraded hud-wood-btn-ready text-[#fffbeb] cursor-pointer'
                    : !disabled
                      ? 'hud-wood-btn hud-wood-btn-ready text-[#fffbeb] cursor-pointer'
                      : level > 0
                        ? 'hud-wood-btn !border-[#6b5128] text-[#d6c298] cursor-not-allowed'
                        : 'hud-wood-btn text-[#9e8d7a] cursor-not-allowed';

                return (
                  <div key={type} className="relative group flex">
                    <button
                      type="button"
                      disabled={disabled}
                      data-building={type}
                      data-level={level}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onBuild(type);
                      }}
                      aria-label={`${currentTierName} سطح ${level} از ۳ [${cfg.hotkey}] — ${tooltipEffect}`}
                      className={`relative overflow-hidden ${stateClass} flex flex-col items-center justify-between ${
                        compact
                          ? 'min-w-[66px] px-1.5 py-1'
                          : 'min-w-[94px] lg:min-w-[102px] px-2.5 py-1.5'
                      }`}
                    >
                      {/* Engraved Brass Corner Keycap (Desktop) */}
                      {!compact && (
                        <span
                          aria-hidden="true"
                          className="hud-keycap absolute top-0.5 left-0.5 px-1 text-[8px] font-num font-bold leading-tight opacity-85"
                        >
                          {cfg.hotkey}
                        </span>
                      )}

                      {/* Ready-to-Build / Ready-to-Upgrade Golden Chevron */}
                      {!disabled && !isMaxed && (
                        <span
                          aria-hidden="true"
                          className="absolute top-0.5 right-1 text-[9px] font-black text-[#fde047] leading-none hud-pulse-soft"
                        >
                          ▲
                        </span>
                      )}

                      {/* Top Row: Evolving Tier Pixel Building Icon + Cost */}
                      <div className="flex items-center justify-center gap-1.5 pt-0.5">
                        <TierBuildingIcon
                          type={type}
                          level={level}
                          className={compact ? 'w-5 h-5 shrink-0' : 'w-6 h-6 shrink-0'}
                        />
                        <span
                          className={`font-num font-black leading-none ${
                            compact ? 'text-xs' : 'text-[15px]'
                          } ${
                            isMaxed
                              ? 'text-[#fde047]'
                              : needsCoast
                                ? 'text-[#8c7b6b] text-[10px]'
                                : !disabled
                                  ? 'text-[#fef08a]'
                                  : 'text-[#bfb09c]'
                          }`}
                        >
                          {isMaxed ? '★' : needsCoast ? 'ساحل' : nextCost}
                        </span>
                      </div>

                      {/* Middle Row: Building Name */}
                      <span
                        className={`font-extrabold leading-tight whitespace-nowrap mt-0.5 ${
                          compact ? 'text-[10px]' : 'text-xs'
                        }`}
                      >
                        {shortLabel}
                      </span>

                      {/* Bottom Row: 3 Chunky Gem-Like Square Pixel Level Pips */}
                      <span
                        className="mt-0.5 inline-flex items-center gap-1 z-10"
                        aria-hidden="true"
                      >
                        {[1, 2, 3].map((pip) => (
                          <span
                            key={pip}
                            className={`inline-block border ${
                              compact ? 'w-1.5 h-1.5' : 'w-2 h-2'
                            } ${
                              pip <= level
                                ? isMaxed
                                  ? 'bg-[#fde047] border-[#fffbeb] shadow-[0_0_4px_rgba(253,224,71,0.7)]'
                                  : 'bg-[#4ade80] border-[#dcfce7] shadow-[0_0_3px_rgba(74,222,128,0.5)]'
                                : 'bg-[#1a110b] border-[#594331]'
                            }`}
                          />
                        ))}
                      </span>

                      {/* Subtle Live Affordability Progress Fill along bottom edge when saving */}
                      {disabled && !isMaxed && !needsCoast && affordProgress > 0 && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute bottom-0 left-0 h-[3px] bg-[#eab308]/75 transition-[width] duration-200"
                          style={{ width: `${affordProgress}%` }}
                        />
                      )}
                    </button>

                    {/* Desktop Carved-Wood Tactical Hover & Focus Tooltip */}
                    {!compact && (
                      <div
                        role="tooltip"
                        className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-100 absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 w-60 hud-stone-frame p-1 z-50"
                      >
                        <div className="hud-wood-tray px-3 py-2 text-right">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-[#fde68a] truncate">
                              {currentTierName}
                            </span>
                            <span className="font-num text-[10px] text-[#cbd5e1] shrink-0">
                              سطح {level}/3 [{cfg.hotkey}]
                            </span>
                          </div>
                          {level > 0 && level < 3 && (
                            <p className="mt-1 text-[10px] text-[#86efac]">
                              فعلی: {cfg.levelEffects[level - 1]}
                            </p>
                          )}
                          <p className="mt-1 text-[11px] leading-snug text-[#f5eedc]">
                            {tooltipEffect}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
