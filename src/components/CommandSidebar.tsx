import {
  BIOMES,
  BUILDINGS,
  COMMANDER_POWERS,
  FACTIONS,
  NEUTRAL_STYLE,
  SEND_RATIOS,
} from '../game/constants';
import type { BuildingType, HudSnapshot, PowerType } from '../game/types';
import {
  BarracksIcon,
  BlitzIcon,
  GoldMineIcon,
  GuardTowerIcon,
  ManpowerIcon,
  MapDiceIcon,
  MobilizeIcon,
  RallyIcon,
  ShieldPowerIcon,
  SupplyRouteIcon,
  SwordIcon,
  WarForgeIcon,
} from './GameIcons';

interface CommandSidebarProps {
  hud: HudSnapshot;
  supplyMode: boolean;
  onChangeSendRatio: (ratio: number) => void;
  onBuild: (type: BuildingType) => void;
  onTriggerPower: (power: PowerType) => void;
  onRally: () => void;
  onToggleSupplyMode: () => void;
  onClearSupply: () => void;
  onOpenShortcuts: () => void;
  onNewMap: () => void;
}

const BUILDING_ORDER: BuildingType[] = ['barracks', 'tower', 'mine', 'forge'];
const POWER_ORDER: PowerType[] = ['mobilize', 'blitz', 'shield'];

function BuildingSvg({ type }: { type: BuildingType }) {
  if (type === 'barracks') return <BarracksIcon className="w-5 h-5 shrink-0" />;
  if (type === 'tower') return <GuardTowerIcon className="w-5 h-5 shrink-0" />;
  if (type === 'mine') return <GoldMineIcon className="w-5 h-5 shrink-0" />;
  return <WarForgeIcon className="w-5 h-5 shrink-0" />;
}

function PowerSvg({ type }: { type: PowerType }) {
  if (type === 'mobilize') return <MobilizeIcon className="w-5 h-5 shrink-0" />;
  if (type === 'blitz') return <BlitzIcon className="w-5 h-5 shrink-0" />;
  return <ShieldPowerIcon className="w-5 h-5 shrink-0" />;
}

export function CommandSidebar({
  hud,
  supplyMode,
  onChangeSendRatio,
  onBuild,
  onTriggerPower,
  onRally,
  onToggleSupplyMode,
  onClearSupply,
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
      className="w-full lg:w-[324px] shrink-0 bg-[#101827] border-t-2 lg:border-t-0 lg:border-l-2 border-[#25354f] flex flex-col justify-between overflow-y-auto"
    >
      <div className="p-3.5 flex flex-col gap-3.5">
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
                      'برج دفاعی فعال'
                    ) : (
                      'بدون حصار اضافه'
                    )}
                  </span>
                </div>
              </div>

              {/* Quick Tactical Logistics: Rally Reinforcements [A] + Auto-Supply Line [S] */}
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

                  {sel.supplyTargetName ? (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onClearSupply();
                      }}
                      title={`لغو خط تأمین خودکار به «${sel.supplyTargetName}» (کلید S)`}
                      className="py-1.5 px-2 bg-[#113128] hover:bg-[#1b4639] border-2 border-[#34d399] text-[#6ee7b7] text-[11px] font-bold transition-colors flex items-center justify-between gap-1 cursor-pointer"
                    >
                      <span className="flex items-center gap-1 truncate">
                        <SupplyRouteIcon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{sel.supplyTargetName}</span>
                      </span>
                      <span className="text-[10px] text-[#fca5a5] shrink-0">✕</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      tabIndex={-1}
                      disabled={sel.friendlyNeighborCount === 0}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onToggleSupplyMode();
                      }}
                      title="ایجاد خط تأمین خودکار به قلعه هم‌مرز خودی (کلید S یا Shift+کلیک)"
                      className={`py-1.5 px-2 border-2 text-[11px] font-bold transition-colors flex items-center justify-between gap-1 ${
                        supplyMode
                          ? 'bg-[#0f3529] border-[#34d399] text-[#a7f3d0] cursor-pointer'
                          : sel.friendlyNeighborCount > 0
                            ? 'bg-[#152433] hover:bg-[#1b3347] border-[#2e526b] hover:border-[#34d399] text-[#bae6fd] cursor-pointer'
                            : 'bg-[#101827] border-[#1f2c40] text-[#64748b] cursor-not-allowed'
                      }`}
                    >
                      <span className="flex items-center gap-1 truncate">
                        <SupplyRouteIcon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          {supplyMode ? 'مقصد را بزنید' : 'خط تأمین'}
                        </span>
                      </span>
                      <span className="font-num text-[10px] opacity-80 shrink-0">[S]</span>
                    </button>
                  )}
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
                  <PowerSvg type={pType} />
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

        {/* Section 4: 4 Strategic Pixel-Art Buildings */}
        <section>
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-xs font-bold text-[#cbd5e1]">
              ساختمان‌های قلعه
            </h3>
            <span className="text-[11px] text-[#64748b]">
              هزینه از نیروی نظامی
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            {BUILDING_ORDER.map((type) => {
              const cfg = BUILDINGS[type];
              const alreadyBuilt =
                sel !== null &&
                ((type === 'barracks' && sel.hasBarracks) ||
                  (type === 'tower' && sel.hasTower) ||
                  (type === 'mine' && sel.hasMine) ||
                  (type === 'forge' && sel.hasForge));
              const canAfford = isPlayerOwned && sel !== null && sel.military >= cfg.cost;
              const disabled = !isPlayerOwned || alreadyBuilt || !canAfford;

              return (
                <button
                  key={type}
                  type="button"
                  tabIndex={-1}
                  disabled={disabled}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onBuild(type);
                  }}
                  className={`w-full text-right px-2.5 py-2 border-2 transition-colors flex items-center gap-2.5 ${
                    alreadyBuilt
                      ? 'bg-[#152823] border-[#265c49] text-[#86efac] cursor-default'
                      : !disabled
                        ? 'bg-[#152033] hover:bg-[#1e2f4a] border-[#334866] hover:border-[#c99846] text-[#f6efe0] cursor-pointer'
                        : 'bg-[#111a2a] border-[#1f2c40] text-[#64748b] cursor-not-allowed'
                  }`}
                >
                  <BuildingSvg type={type} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold truncate">
                        {cfg.name}
                        <span className="mr-1.5 font-num text-[10px] opacity-65">
                          [{cfg.hotkey}]
                        </span>
                      </span>
                      <span className="text-xs font-bold shrink-0">
                        {alreadyBuilt ? (
                          'ساخته شد'
                        ) : (
                          <>
                            <span className="font-num">{cfg.cost}</span>
                            <span> نظامی</span>
                          </>
                        )}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] opacity-80 truncate">
                      {cfg.shortEffect}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Bottom Action Footer: Map Regenerator + Quick Shortcuts Guide */}
      <div className="p-3.5 pt-2.5 border-t-2 border-[#223047] bg-[#0d1421] flex flex-col gap-2">
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
