import {
  BIOMES,
  BUILDINGS,
  COMMANDER_POWERS,
  FACTIONS,
  MAX_BUILDING_LEVEL,
  NEUTRAL_STYLE,
  SEND_RATIOS,
} from '../game/constants';
import { getBuildingLevel, getNextBuildingCost } from '../game/simulation';
import type { BuildingType, HudSnapshot, PowerType } from '../game/types';
import {
  BuildingIcon,
  ManpowerIcon,
  MapDiceIcon,
  PowerIcon,
  RallyIcon,
  SupplyLineIcon,
  SwordIcon,
} from './GameIcons';

interface CommandSidebarProps {
  hud: HudSnapshot;
  supplyMode: boolean;
  onChangeSendRatio: (ratio: number) => void;
  onBuild: (type: BuildingType) => void;
  onTriggerPower: (power: PowerType) => void;
  onRally: () => void;
  onToggleSupply: () => void;
  onOpenShortcuts: () => void;
  onNewMap: () => void;
}

const BUILDING_ORDER: BuildingType[] = ['barracks', 'tower', 'mine', 'forge', 'port'];
const POWER_ORDER: PowerType[] = ['mobilize', 'blitz', 'shield'];

export function CommandSidebar({
  hud,
  supplyMode,
  onChangeSendRatio,
  onBuild,
  onTriggerPower,
  onRally,
  onToggleSupply,
  onOpenShortcuts,
  onNewMap,
}: CommandSidebarProps) {
  const sel = hud.selectedTerritory;
  const isPlayerOwned = sel !== null && sel.owner === 0;
  const ownerMeta =
    sel === null
      ? null
      : sel.owner === -1
        ? { name: NEUTRAL_STYLE.name, color: NEUTRAL_STYLE.color }
        : { name: FACTIONS[sel.owner].name, color: FACTIONS[sel.owner].color };
  const biomeMeta = sel ? BIOMES[sel.biome] : null;

  return (
    <aside
      aria-label="پنل فرماندهی"
      className="w-full lg:w-[324px] shrink-0 bg-[#101827] border-t-2 lg:border-t-0 lg:border-l-2 border-[#25354f] flex flex-col overflow-hidden"
    >
      <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2.5">
        {/* Section 1: Selected Territory Tactical Inspector */}
        <section>
          <div className="flex items-center justify-between pb-2 border-b border-[#223047]">
            <h2 className="text-sm font-extrabold text-[#f2e8d5]">
              {sel ? sel.name : 'انتخاب قلعه'}
            </h2>
            {ownerMeta ? (
              <span
                className="text-xs font-bold flex items-center gap-1.5"
                style={{ color: ownerMeta.color }}
              >
                <span
                  className="inline-block w-2.5 h-2.5 shrink-0"
                  style={{ backgroundColor: ownerMeta.color }}
                  aria-hidden="true"
                />
                {ownerMeta.name}
              </span>
            ) : (
              <span className="text-xs text-[#64748b]">بدون انتخاب</span>
            )}
          </div>

          {sel && biomeMeta ? (
            <div className="mt-2.5 space-y-2.5">
              {/* Quiet Unboxed Biome Metadata */}
              <div className="flex items-center justify-between text-[11px] text-[#b4c2d4]">
                <span>
                  اقلیم: <strong className="text-[#e8dec9]">{biomeMeta.name}</strong>
                </span>
                <span className="text-[#d6b472]">{biomeMeta.shortBonus}</span>
              </div>

              {/* Primary Combat & Manpower Counters */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#152033] border-2 border-[#24344d] px-2.5 py-2">
                  <div className="flex items-center justify-between text-[11px] text-[#94a3b8]">
                    <span>نیروی نظامی</span>
                    <SwordIcon className="w-3.5 h-3.5 text-[#f87171]" />
                  </div>
                  <div className="mt-0.5 font-num text-xl font-bold text-white leading-none">
                    {Math.floor(sel.military)}
                  </div>
                  <div className="mt-1 text-[11px] text-[#94a3b8]">
                    {sel.owner === -1 ? (
                      'پادگان ثابت'
                    ) : (
                      <>
                        <span className="font-num">+{sel.conversionRate.toFixed(1)}</span>
                        <span> / ث</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-[#152033] border-2 border-[#24344d] px-2.5 py-2">
                  <div className="flex items-center justify-between text-[11px] text-[#94a3b8]">
                    <span>نیروی انسانی</span>
                    <ManpowerIcon className="w-3.5 h-3.5 text-[#d6b472]" />
                  </div>
                  <div className="mt-0.5 font-num text-xl font-bold text-[#f6efe0] leading-none">
                    {Math.floor(sel.manpower)}
                    <span className="text-xs text-[#64748b] font-normal">
                      /{sel.maxManpower}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-[#94a3b8]">
                    {sel.owner === -1 ? (
                      'بی‌طرف'
                    ) : (
                      <>
                        <span className="font-num">+{sel.manpowerRate.toFixed(1)}</span>
                        <span> / ث</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Manpower Capacity Meter */}
              <div>
                <div className="h-2 w-full bg-[#0b1220] border border-[#24344d] overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.min(100, (sel.manpower / sel.maxManpower) * 100)}%`,
                      backgroundColor: sel.hasBarracks ? '#eab308' : '#d6b472',
                    }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-[#94a3b8]">
                  <span>
                    مرزهای متصل: <span className="font-num text-[#e2e8f0]">{sel.neighborCount}</span>
                  </span>
                  <span className={sel.shieldTimer > 0 ? 'text-[#7dd3fc] font-bold' : ''}>
                    {sel.shieldTimer > 0 ? (
                      <>
                        <span>سپر سلطنتی (</span>
                        <span className="font-num">{Math.ceil(sel.shieldTimer)}</span>
                        <span> ث)</span>
                      </>
                    ) : sel.hasTower ? (
                      <>
                        <span>برج دفاعی سطح </span>
                        <span className="font-num text-[#7dd3fc] font-bold">
                          {getBuildingLevel(sel, 'tower')}
                        </span>
                      </>
                    ) : (
                      'بدون حصار اضافه'
                    )}
                  </span>
                </div>
              </div>

              {/* Quick Rally + Auto-Supply Controls */}
              {isPlayerOwned && (
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onRally();
                    }}
                    title="فراخوانی ۵۰٪ نیروی کمکی از تمام قلعه‌های هم‌مرز خودی (کلید A یا دابل‌کلیک)"
                    className="py-1.5 px-2 bg-[#152822] hover:bg-[#1c382f] border-2 border-[#2b634e] hover:border-[#4ade80] text-[#a7f3d0] text-[11px] font-bold transition-colors flex items-center justify-between gap-1 cursor-pointer"
                  >
                    <span className="flex items-center gap-1 truncate">
                      <RallyIcon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">کمکی هم‌مرز</span>
                    </span>
                    <span className="font-num text-[10px] opacity-80 shrink-0">[A]</span>
                  </button>

                  <button
                    type="button"
                    tabIndex={-1}
                    disabled={sel.friendlyNeighborCount === 0 && sel.supplyTargetId === null}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onToggleSupply();
                    }}
                    title={
                      sel.supplyTargetName
                        ? `لغو خط تأمین خودکار به ${sel.supplyTargetName} (کلید S)`
                        : 'ایجاد خط تأمین خودکار به قلعه هم‌مرز خودی (کلید S یا Shift+کلیک)'
                    }
                    className={`py-1.5 px-2 border-2 text-[11px] font-bold transition-colors flex items-center justify-between gap-1 ${
                      sel.supplyTargetId !== null || supplyMode
                        ? 'bg-[#12302a] hover:bg-[#19423a] border-[#34d399] text-[#6ee7b7] cursor-pointer'
                        : sel.friendlyNeighborCount > 0
                          ? 'bg-[#152033] hover:bg-[#1e2f4a] border-[#334968] text-[#cbd5e1] cursor-pointer'
                          : 'bg-[#101827] border-[#1f2c40] text-[#64748b] cursor-not-allowed'
                    }`}
                  >
                    <span className="flex items-center gap-1 truncate">
                      <SupplyLineIcon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {sel.supplyTargetName
                          ? `تأمین: ${sel.supplyTargetName}`
                          : supplyMode
                            ? 'انتخاب مقصد...'
                            : 'خط تأمین'}
                      </span>
                    </span>
                    <span className="font-num text-[10px] opacity-80 shrink-0">[S]</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-2.5 text-xs leading-relaxed text-[#94a3b8]">
              روی یکی از قلعه‌های سرخ خود کلیک کنید تا مسیرهای مرزی روشن شود و ساخت ساختمان یا قدرت فرمانده فعال گردد.
            </p>
          )}
        </section>

        {/* Section 2: Troop Send Ratio Selector */}
        <section>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-[#cbd5e1]">
              نسبت اعزام سربازان
            </span>
            <span className="text-[11px] text-[#64748b]">کلید ۱ تا ۴</span>
          </div>
          <div
            role="group"
            aria-label="نسبت اعزام نیروی نظامی"
            className="grid grid-cols-4 gap-1 p-1 bg-[#0b1220] border-2 border-[#223047]"
          >
            {SEND_RATIOS.map((r) => {
              const active = Math.abs(hud.sendRatio - r) < 0.01;
              const pct = Math.round(r * 100);
              return (
                <button
                  key={r}
                  type="button"
                  tabIndex={-1}
                  aria-pressed={active}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onChangeSendRatio(r);
                  }}
                  className={`py-1.5 font-num text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[#c99846] text-[#0c1320]'
                      : 'text-[#cbd5e1] hover:text-white hover:bg-[#19253a]'
                  }`}
                >
                  {pct}%
                </button>
              );
            })}
          </div>
        </section>

        {/* Section 3: Commander Special Powers (New!) */}
        <section>
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-xs font-bold text-[#cbd5e1]">
              قدرت‌های فرمانده
            </h3>
            {hud.powers.blitzTimer > 0 ? (
              <span className="text-[11px] font-bold text-[#7dd3fc]">
                یورش ۲× فعال (<span className="font-num">{Math.ceil(hud.powers.blitzTimer)}</span>ث)
              </span>
            ) : (
              <span className="text-[11px] text-[#64748b]">کلید Z · X · C</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {POWER_ORDER.map((pType) => {
              const cfg = COMMANDER_POWERS[pType];
              const cd = hud.powers.cooldowns[pType];
              const isActive =
                (pType === 'blitz' && hud.powers.blitzTimer > 0) ||
                (pType === 'shield' && (sel?.shieldTimer ?? 0) > 0);
              const needsOwn = cfg.requiresSelectedOwnCastle && !isPlayerOwned;
              const lowManpower = pType === 'mobilize' && (sel?.manpower ?? 0) < 6;
              const disabled = cd > 0 || needsOwn || lowManpower;

              return (
                <button
                  key={pType}
                  type="button"
                  tabIndex={-1}
                  disabled={disabled}
                  title={`${cfg.name} (${cfg.hotkey}) — ${cfg.shortEffect}`}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onTriggerPower(pType);
                  }}
                  className={`p-2 border-2 flex flex-col items-center text-center gap-1 transition-colors ${
                    isActive
                      ? 'bg-[#17304d] border-[#38bdf8] text-[#e0f2fe]'
                      : !disabled
                        ? 'bg-[#152033] hover:bg-[#1e2f4a] border-[#334968] hover:border-[#d6b472] text-[#f6efe0] cursor-pointer'
                        : 'bg-[#101827] border-[#1f2c40] text-[#64748b] cursor-not-allowed'
                  }`}
                >
                  <PowerIcon type={pType} />
                  <span className="text-[11px] font-extrabold leading-tight whitespace-nowrap">
                    {cfg.name}
                  </span>
                  <span className="text-[10px] leading-none opacity-80">
                    {cd > 0 ? (
                      <>
                        <span className="font-num">{Math.ceil(cd)}</span>
                        <span> ثانیه</span>
                      </>
                    ) : (
                      <span className="font-num">[{cfg.hotkey}]</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Section 4: 5 Upgradeable Pixel-Art Buildings (Lv.1 -> Lv.2 -> Lv.3) */}
        <section>
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-xs font-bold text-[#cbd5e1]">
              ساختمان‌ها و ارتقا (تا سطح ۳)
            </h3>
            <span className="text-[11px] text-[#64748b]">
              هزینه از نیروی نظامی
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            {BUILDING_ORDER.map((type) => {
              const cfg = BUILDINGS[type];
              const level = sel !== null ? getBuildingLevel(sel, type) : 0;
              const isMaxed = level >= MAX_BUILDING_LEVEL;
              const nextCost = sel !== null ? getNextBuildingCost(sel, type) : cfg.levelCosts[0];
              const needsCoast = type === 'port' && sel !== null && !sel.isCoastal;
              const canAfford =
                isPlayerOwned && sel !== null && nextCost !== null && sel.military >= nextCost;
              const disabled = !isPlayerOwned || isMaxed || needsCoast || !canAfford;

              const displayTitle = level > 0 ? cfg.levelNames[level - 1] : cfg.name;
              const effectLine =
                level === 3
                  ? cfg.levelEffects[2]
                  : level === 1 || level === 2
                    ? `ارتقا به ${cfg.levelNames[level]} · ${cfg.levelEffects[level]}`
                    : cfg.levelEffects[0];

              return (
                <button
                  key={type}
                  type="button"
                  tabIndex={-1}
                  disabled={disabled}
                  data-building={type}
                  data-level={level}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onBuild(type);
                  }}
                  className={`w-full text-right px-2.5 py-1.5 border-2 transition-colors flex items-center gap-2.5 ${
                    isMaxed
                      ? 'bg-[#261f11] border-[#ca8a04] text-[#fef08a] cursor-default'
                      : !disabled
                        ? level > 0
                          ? 'bg-[#152823] hover:bg-[#1d3830] border-[#2f7a5f] hover:border-[#fbbf24] text-[#f6efe0] cursor-pointer'
                          : 'bg-[#152033] hover:bg-[#1e2f4a] border-[#334866] hover:border-[#c99846] text-[#f6efe0] cursor-pointer'
                        : level > 0
                          ? 'bg-[#132220] border-[#21453a] text-[#86b8a2] cursor-not-allowed'
                          : 'bg-[#111a2a] border-[#1f2c40] text-[#64748b] cursor-not-allowed'
                  }`}
                >
                  <BuildingIcon type={type} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-xs font-extrabold truncate flex items-center gap-1.5 min-w-0">
                        <span className="truncate">{displayTitle}</span>
                        {/* 3 Crisp Square Pixel Level Pips */}
                        <span
                          className="inline-flex items-center gap-0.5 shrink-0"
                          aria-label={`سطح ${level} از ۳`}
                        >
                          {[1, 2, 3].map((pip) => (
                            <span
                              key={pip}
                              className={`inline-block w-1.5 h-1.5 border ${
                                pip <= level
                                  ? isMaxed
                                    ? 'bg-[#fde047] border-[#fffbeb]'
                                    : 'bg-[#4ade80] border-[#bbf7d0]'
                                  : 'bg-[#0b1220] border-[#334866]'
                              }`}
                            />
                          ))}
                        </span>
                        <span className="font-num text-[10px] opacity-60 shrink-0">
                          [{cfg.hotkey}]
                        </span>
                      </span>
                      <span className="text-[11px] font-bold shrink-0">
                        {isMaxed ? (
                          'حداکثر ★'
                        ) : needsCoast ? (
                          'نیاز به ساحل'
                        ) : level > 0 ? (
                          <span className="text-[#fde68a]">
                            <span>ارتقا </span>
                            <span className="font-num">{nextCost}</span>
                          </span>
                        ) : (
                          <>
                            <span className="font-num">{nextCost}</span>
                            <span> نظامی</span>
                          </>
                        )}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] opacity-80 truncate">
                      {effectLine}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Bottom Action Footer: Map Regenerator + Quick Shortcuts Guide */}
      <div className="shrink-0 p-3 pt-2 border-t-2 border-[#223047] bg-[#0d1421] flex flex-col gap-1.5">
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onNewMap();
          }}
          className="w-full py-2 px-4 bg-[#1c2a42] hover:bg-[#273a59] border-2 border-[#364d70] text-[#f6efe0] font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
        >
          <MapDiceIcon className="w-4 h-4 text-[#d6b472]" />
          <span>تولید نقشه تصادفی جدید</span>
          <span className="font-num text-[10px] text-[#94a3b8]">[N]</span>
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onOpenShortcuts();
          }}
          className="w-full py-1 text-[11px] text-[#94a3b8] hover:text-[#fde68a] transition-colors text-center cursor-pointer"
        >
          کشیدن برای حمله · کلیک راست ۱۰۰٪ · اسکرول درصد · راهنما (<span className="font-num">H</span>)
        </button>
      </div>
    </aside>
  );
}
