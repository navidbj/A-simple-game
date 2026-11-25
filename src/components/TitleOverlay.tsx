import { DIFFICULTIES, MAP_PRESETS } from '../game/constants';
import type { Difficulty, MapPreset } from '../game/types';
import { CitadelCrestSvg, MapDiceIcon } from './GameIcons';

interface TitleOverlayProps {
  difficulty: Difficulty;
  mapPreset: MapPreset;
  isShortLandscape?: boolean;
  onSelectDifficulty: (d: Difficulty) => void;
  onSelectMapPreset: (preset: MapPreset) => void;
  onStart: () => void;
  onPreviewNewMap: () => void;
}

const DIFF_LIST: Difficulty[] = ['normal', 'hard', 'master'];
const PRESET_LIST: MapPreset[] = ['continent', 'archipelago', 'strait', 'middle_east'];

export function TitleOverlay({
  difficulty,
  mapPreset,
  isShortLandscape = false,
  onSelectDifficulty,
  onSelectMapPreset,
  onStart,
  onPreviewNewMap,
}: TitleOverlayProps) {
  if (isShortLandscape) {
    return (
      <div
        className="fixed inset-0 z-30 flex items-center justify-center p-2.5"
        style={{
          background:
            'radial-gradient(ellipse at 50% 45%, rgba(12, 22, 38, 0.56) 0%, rgba(9, 15, 26, 0.9) 78%)',
          paddingLeft: 'max(14px, env(safe-area-inset-left))',
          paddingRight: 'max(14px, env(safe-area-inset-right))',
        }}
      >
        <main className="w-full max-w-2xl bg-[#101827]/95 border-2 border-[#d6b472]/35 px-4 py-3 shadow-[0_20px_56px_rgba(0,0,0,0.8)] grid grid-cols-12 gap-4 items-center">
          {/* Brand Column */}
          <div className="col-span-4 flex flex-col items-center text-center border-l border-[#24344d] pl-3">
            <CitadelCrestSvg className="w-14 h-14 mb-1.5 drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]" />
            <h1 className="text-2xl font-black tracking-tight text-[#f6efe0]">فتح قلمرو</h1>
            <p className="mt-1 text-[10px] text-[#b8c4d4] leading-relaxed">
              ۶ کشور · جنگ زمینی و یورش دریایی
            </p>
          </div>

          {/* Controls Column */}
          <div className="col-span-8 flex flex-col gap-2">
            {/* Map Preset Selector */}
            <div>
              <div className="flex items-center justify-between text-[10px] text-[#a3b1c6] mb-1">
                <span>نوع نقشه</span>
                <span className="text-[#7dd3fc] truncate max-w-[65%]">
                  {MAP_PRESETS[mapPreset].shortTag}
                </span>
              </div>
              <div
                role="group"
                aria-label="انتخاب نوع نقشه"
                className="grid grid-cols-4 gap-1 p-1 bg-[#0b1220] border-2 border-[#26344a]"
              >
                {PRESET_LIST.map((pKey) => {
                  const pCfg = MAP_PRESETS[pKey];
                  const active = mapPreset === pKey;
                  return (
                    <button
                      key={pKey}
                      type="button"
                      onClick={() => onSelectMapPreset(pKey)}
                      aria-pressed={active}
                      className={`py-1.5 px-1 text-[11px] font-bold transition-colors truncate cursor-pointer ${
                        active
                          ? 'bg-[#0284c7] text-white'
                          : 'text-[#cbd5e1] hover:text-white hover:bg-[#19253a]'
                      }`}
                    >
                      {pCfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Difficulty Selector */}
            <div
              role="group"
              aria-label="انتخاب سطح سختی"
              className="grid grid-cols-3 gap-1 p-1 bg-[#0b1220] border-2 border-[#26344a]"
            >
              {DIFF_LIST.map((key) => {
                const cfg = DIFFICULTIES[key];
                const active = difficulty === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onSelectDifficulty(key)}
                    aria-pressed={active}
                    className={`py-1.5 px-2 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-[#c99846] text-[#0c1320]'
                        : 'text-[#cbd5e1] hover:text-white hover:bg-[#19253a]'
                    }`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                data-start="true"
                onClick={onStart}
                className="flex-1 min-h-[40px] py-2 px-4 bg-[#dc2626] hover:bg-[#b91c1c] border-2 border-[#f87171]/60 active:scale-[0.99] text-white font-extrabold text-sm transition-all shadow-[0_6px_18px_rgba(220,38,38,0.35)] cursor-pointer whitespace-nowrap"
              >
                شروع نبرد
              </button>

              <button
                type="button"
                onClick={onPreviewNewMap}
                className="min-h-[40px] py-2 px-3 bg-[#1a263a] hover:bg-[#23324b] border-2 border-[#334663] text-[#e2e8f0] font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <MapDiceIcon className="w-4 h-4" />
                <span>بذر دیگر</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col items-center justify-between p-4 md:p-8"
      style={{
        background:
          'radial-gradient(ellipse at 50% 45%, rgba(12, 22, 38, 0.5) 0%, rgba(9, 15, 26, 0.88) 78%)',
      }}
    >
      <div className="h-2" aria-hidden="true" />

      {/* Center Monumental Lockup */}
      <main className="w-full max-w-xl max-h-[88dvh] overflow-y-auto no-scrollbar flex flex-col items-center text-center bg-[#101827]/95 border-2 border-[#d6b472]/35 px-6 py-6 shadow-[0_24px_70px_rgba(0,0,0,0.75)]">
        <CitadelCrestSvg className="w-16 h-16 md:w-20 md:h-20 mb-2.5 drop-shadow-[0_6px_16px_rgba(0,0,0,0.6)]" />

        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#f6efe0] text-balance">
          فتح قلمرو
        </h1>

        <p className="mt-2 text-xs md:text-sm text-[#b8c4d4] max-w-md leading-relaxed">
          ۶ کشور رقیب در نقشه‌های پیکسلی — دژ و بندرگاه بسازید، از پل‌ها و دریاها یورش ببرید و سراسر قاره را فتح کنید.
        </p>

        {/* Map Preset Selector (4 Distinct Cartographic Presets) */}
        <div className="w-full mt-5">
          <div className="flex items-center justify-between text-xs font-medium text-[#a3b1c6] mb-1.5">
            <span>انتخاب نقشه نبرد</span>
            <span className="text-[11px] text-[#7dd3fc] font-bold">
              {MAP_PRESETS[mapPreset].shortTag}
            </span>
          </div>
          <div
            role="group"
            aria-label="انتخاب نوع نقشه"
            data-testid="preset-selector"
            className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-[#0b1220] border-2 border-[#26344a]"
          >
            {PRESET_LIST.map((pKey) => {
              const pCfg = MAP_PRESETS[pKey];
              const active = mapPreset === pKey;
              return (
                <button
                  key={pKey}
                  type="button"
                  data-preset={pKey}
                  onClick={() => onSelectMapPreset(pKey)}
                  aria-pressed={active}
                  className={`py-2 px-2 text-xs font-bold transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-sky-400 cursor-pointer ${
                    active
                      ? 'bg-[#0284c7] text-white'
                      : 'text-[#cbd5e1] hover:text-white hover:bg-[#19253a]'
                  }`}
                >
                  {pCfg.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-[#94a3b8]">
            {MAP_PRESETS[mapPreset].description}
          </p>
        </div>

        {/* Difficulty Segmented Selector */}
        <div className="w-full mt-4">
          <div className="text-xs font-medium text-[#a3b1c6] mb-1.5 text-right">
            سطح هوش مصنوعی رقبا
          </div>
          <div
            role="group"
            aria-label="انتخاب سطح سختی"
            className="grid grid-cols-3 gap-2 p-1 bg-[#0b1220] border-2 border-[#26344a]"
          >
            {DIFF_LIST.map((key) => {
              const cfg = DIFFICULTIES[key];
              const active = difficulty === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelectDifficulty(key)}
                  aria-pressed={active}
                  className={`py-2 px-3 text-sm font-bold transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-amber-400 cursor-pointer ${
                    active
                      ? 'bg-[#c99846] text-[#0c1320]'
                      : 'text-[#cbd5e1] hover:text-white hover:bg-[#19253a]'
                  }`}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-[#94a3b8]">
            {DIFFICULTIES[difficulty].description}
          </p>
        </div>

        {/* Primary & Secondary Actions */}
        <div className="w-full mt-5 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            data-start="true"
            onClick={onStart}
            className="flex-1 min-h-[44px] py-2.5 px-6 bg-[#dc2626] hover:bg-[#b91c1c] border-2 border-[#f87171]/60 active:scale-[0.99] text-white font-extrabold text-base transition-all shadow-[0_6px_22px_rgba(220,38,38,0.35)] focus-visible:outline-2 focus-visible:outline-amber-300 cursor-pointer whitespace-nowrap"
          >
            شروع نبرد
          </button>

          <button
            type="button"
            onClick={onPreviewNewMap}
            className="min-h-[44px] py-2.5 px-4 bg-[#1a263a] hover:bg-[#23324b] border-2 border-[#334663] text-[#e2e8f0] font-bold text-sm transition-colors flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-amber-300 cursor-pointer whitespace-nowrap"
          >
            <MapDiceIcon className="w-4 h-4" />
            <span>نقشه تصادفی دیگر</span>
          </button>
        </div>
      </main>

      {/* Flat Borderless Single-Line Control Hint */}
      <div className="text-xs text-[#9eb0c7] tracking-normal text-center">
        ساخت بندرگاه (T) برای یورش دریایی به سواحل · Shift+کلیک خط تأمین · کلیک راست ۱۰۰٪ · راهنما (H)
      </div>
    </div>
  );
}
