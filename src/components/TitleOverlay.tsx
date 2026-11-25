import { DIFFICULTIES, MAP_PRESETS } from '../game/constants';
import type { Difficulty, MapPreset } from '../game/types';
import { CitadelCrestSvg, MapDiceIcon } from './GameIcons';

interface TitleOverlayProps {
  difficulty: Difficulty;
  mapPreset: MapPreset;
  isShortLandscape?: boolean;
  onSelectDifficulty: (d: Difficulty) => void;
  onSelectMapPreset: (p: MapPreset) => void;
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
            'radial-gradient(ellipse at 50% 45%, rgba(12, 22, 38, 0.62) 0%, rgba(9, 15, 26, 0.92) 78%)',
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
              ۶ کشور رقیب · نبرد استراتژیک مرزی
            </p>
          </div>

          {/* Controls Column */}
          <div className="col-span-8 flex flex-col gap-2">
            {/* Map Preset Row */}
            <div>
              <div className="text-[10px] text-[#a3b1c6] mb-1">نقشه نبرد</div>
              <div
                role="group"
                aria-label="انتخاب نوع نقشه"
                className="grid grid-cols-4 gap-1 p-0.5 bg-[#0b1220] border-2 border-[#26344a]"
              >
                {PRESET_LIST.map((key) => {
                  const cfg = MAP_PRESETS[key];
                  const active = mapPreset === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onSelectMapPreset(key)}
                      aria-pressed={active}
                      className={`py-1.5 px-1 text-[10px] font-bold transition-colors truncate cursor-pointer ${
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
            </div>

            {/* Difficulty Row */}
            <div>
              <div className="flex items-center justify-between text-[10px] text-[#a3b1c6] mb-1">
                <span>سطح هوش مصنوعی</span>
                <span className="text-[#94a3b8] truncate max-w-[60%]">
                  {DIFFICULTIES[difficulty].description}
                </span>
              </div>
              <div
                role="group"
                aria-label="انتخاب سطح سختی"
                className="grid grid-cols-3 gap-1 p-0.5 bg-[#0b1220] border-2 border-[#26344a]"
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
                <span>نقشه دیگر</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col items-center justify-between p-4 md:p-8 overflow-y-auto"
      style={{
        background:
          'radial-gradient(ellipse at 50% 45%, rgba(10, 19, 34, 0.34) 0%, rgba(8, 14, 24, 0.78) 80%)',
      }}
    >
      <div className="h-2 shrink-0" aria-hidden="true" />

      {/* Center Monumental Lockup */}
      <main className="relative w-full max-w-lg flex flex-col items-center text-center bg-[#0f1726]/95 border-2 border-[#d6b472]/50 px-5 py-6 md:px-7 md:py-7 shadow-[0_24px_70px_rgba(0,0,0,0.82),inset_0_1px_0_rgba(246,239,224,0.14)]">
        {/* Matching Brass Cartographic Corner Ornaments */}
        <span aria-hidden="true" className="pointer-events-none absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2 border-[#e2c27f]/70" />
        <span aria-hidden="true" className="pointer-events-none absolute top-1.5 left-1.5 w-3 h-3 border-t-2 border-l-2 border-[#e2c27f]/70" />
        <span aria-hidden="true" className="pointer-events-none absolute bottom-1.5 right-1.5 w-3 h-3 border-b-2 border-r-2 border-[#e2c27f]/70" />
        <span aria-hidden="true" className="pointer-events-none absolute bottom-1.5 left-1.5 w-3 h-3 border-b-2 border-l-2 border-[#e2c27f]/70" />

        <CitadelCrestSvg className="w-16 h-16 md:w-20 md:h-20 mb-2.5 drop-shadow-[0_6px_16px_rgba(0,0,0,0.65)]" />

        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-[#f6efe0] text-balance drop-shadow-[0_2px_0_rgba(8,12,20,0.9)]">
          فتح قلمرو
        </h1>

        <p className="mt-2 text-xs md:text-sm text-[#b8c4d4] max-w-md leading-relaxed">
          ۶ کشور رقیب در نقشه پیکسلی — دژ و بندرگاه بسازید، خطوط تأمین برقرار کنید و لشکریان خود را از مرزها بگذرانید.
        </p>

        {/* Map Preset Selector */}
        <div className="w-full mt-4">
          <div className="text-xs font-medium text-[#a3b1c6] mb-1.5">
            انتخاب نقشه نبرد
          </div>
          <div
            role="group"
            aria-label="انتخاب نوع نقشه"
            className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-[#0b1220] border-2 border-[#26344a]"
          >
            {PRESET_LIST.map((key) => {
              const cfg = MAP_PRESETS[key];
              const active = mapPreset === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelectMapPreset(key)}
                  aria-pressed={active}
                  className={`py-2 px-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-amber-400 cursor-pointer flex flex-col items-center gap-0.5 ${
                    active
                      ? 'bg-[#c99846] text-[#0c1320]'
                      : 'text-[#cbd5e1] hover:text-white hover:bg-[#19253a]'
                  }`}
                >
                  <span className="truncate max-w-full">{cfg.label}</span>
                  <span className={`text-[10px] font-medium ${active ? 'text-[#0c1320]/80' : 'text-[#94a3b8]'}`}>
                    {cfg.shortTag}
                  </span>
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
          <div className="text-xs font-medium text-[#a3b1c6] mb-1.5">
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
            className="flex-1 min-h-[46px] py-3 px-6 bg-[#dc2626] hover:bg-[#b91c1c] border-2 border-[#f87171]/60 active:scale-[0.99] text-white font-extrabold text-base transition-all shadow-[0_6px_22px_rgba(220,38,38,0.35)] focus-visible:outline-2 focus-visible:outline-amber-300 cursor-pointer whitespace-nowrap"
          >
            شروع نبرد
          </button>

          <button
            type="button"
            onClick={onPreviewNewMap}
            className="min-h-[46px] py-3 px-4 bg-[#1a263a] hover:bg-[#23324b] border-2 border-[#334663] text-[#e2e8f0] font-bold text-sm transition-colors flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-amber-300 cursor-pointer whitespace-nowrap"
          >
            <MapDiceIcon className="w-4 h-4" />
            <span>نقشه تصادفی دیگر</span>
          </button>
        </div>
      </main>

      {/* Flat Borderless Single-Line Control Hint */}
      <div className="mt-3 text-xs text-[#9eb0c7] tracking-normal text-center shrink-0">
        کشیدن برای حمله · Shift+کلیک خط تأمین · دابل‌کلیک فراخوانی کمکی · کلید H راهنما
      </div>
    </div>
  );
}
