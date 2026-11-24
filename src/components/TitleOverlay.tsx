import { DIFFICULTIES } from '../game/constants';
import type { Difficulty } from '../game/types';
import { CitadelCrestSvg, MapDiceIcon } from './GameIcons';

interface TitleOverlayProps {
  difficulty: Difficulty;
  isShortLandscape?: boolean;
  onSelectDifficulty: (d: Difficulty) => void;
  onStart: () => void;
  onPreviewNewMap: () => void;
}

const DIFF_LIST: Difficulty[] = ['normal', 'hard', 'master'];

export function TitleOverlay({
  difficulty,
  isShortLandscape = false,
  onSelectDifficulty,
  onStart,
  onPreviewNewMap,
}: TitleOverlayProps) {
  if (isShortLandscape) {
    return (
      <div
        className="fixed inset-0 z-30 flex items-center justify-center p-3"
        style={{
          background:
            'radial-gradient(ellipse at 50% 45%, rgba(12, 22, 38, 0.62) 0%, rgba(9, 15, 26, 0.92) 78%)',
          paddingLeft: 'max(14px, env(safe-area-inset-left))',
          paddingRight: 'max(14px, env(safe-area-inset-right))',
        }}
      >
        <main className="w-full max-w-2xl bg-[#101827]/95 border-2 border-[#d6b472]/35 px-5 py-4 shadow-[0_20px_56px_rgba(0,0,0,0.8)] grid grid-cols-12 gap-5 items-center">
          {/* Brand Column */}
          <div className="col-span-5 flex flex-col items-center text-center border-l border-[#24344d] pl-4">
            <CitadelCrestSvg className="w-16 h-16 mb-2 drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]" />
            <h1 className="text-3xl font-black tracking-tight text-[#f6efe0]">فتح قلمرو</h1>
            <p className="mt-1.5 text-[11px] text-[#b8c4d4] leading-relaxed">
              قاره پیکسلی ۶ کشور — بکشید یا لمس کنید تا لشکر اعزام شود.
            </p>
          </div>

          {/* Controls Column */}
          <div className="col-span-7 flex flex-col gap-3">
            <div>
              <div className="flex items-center justify-between text-[11px] text-[#a3b1c6] mb-1.5">
                <span>سطح هوش مصنوعی</span>
                <span className="text-[#94a3b8] truncate max-w-[60%]">
                  {DIFFICULTIES[difficulty].description}
                </span>
              </div>
              <div
                role="group"
                aria-label="انتخاب سطح سختی"
                className="grid grid-cols-3 gap-1.5 p-1 bg-[#0b1220] border-2 border-[#26344a]"
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
                      className={`py-2 px-2 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
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

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                data-start="true"
                onClick={onStart}
                className="flex-1 min-h-[44px] py-2.5 px-5 bg-[#dc2626] hover:bg-[#b91c1c] border-2 border-[#f87171]/60 active:scale-[0.99] text-white font-extrabold text-sm transition-all shadow-[0_6px_18px_rgba(220,38,38,0.35)] cursor-pointer whitespace-nowrap"
              >
                شروع نبرد
              </button>

              <button
                type="button"
                onClick={onPreviewNewMap}
                className="min-h-[44px] py-2.5 px-3.5 bg-[#1a263a] hover:bg-[#23324b] border-2 border-[#334663] text-[#e2e8f0] font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
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
      className="fixed inset-0 z-30 flex flex-col items-center justify-between p-5 md:p-10"
      style={{
        background:
          'radial-gradient(ellipse at 50% 45%, rgba(12, 22, 38, 0.58) 0%, rgba(9, 15, 26, 0.9) 78%)',
      }}
    >
      <div className="h-3" aria-hidden="true" />

      {/* Center Monumental Lockup */}
      <main className="w-full max-w-lg flex flex-col items-center text-center bg-[#101827]/95 border border-[#d6b472]/30 rounded-xl px-6 py-7 md:px-7 md:py-8 shadow-[0_24px_70px_rgba(0,0,0,0.75)]">
        <CitadelCrestSvg className="w-20 h-20 md:w-24 md:h-24 mb-3 md:mb-4 drop-shadow-[0_6px_16px_rgba(0,0,0,0.6)]" />

        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-[#f6efe0] text-balance">
          فتح قلمرو
        </h1>

        <p className="mt-2.5 text-sm md:text-base text-[#b8c4d4] max-w-md leading-relaxed">
          ۶ کشور رقیب در قاره‌ای پیکسلی با اقلیم‌های جنگلی، کوهستانی و حاصلخیز — دژ بسازید، قدرت‌های فرمانده را فعال کنید و لشکریان خود را از مرزها بگذرانید.
        </p>

        {/* Difficulty Segmented Selector */}
        <div className="w-full mt-6">
          <div className="text-xs font-medium text-[#a3b1c6] mb-2">
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
          <p className="mt-2 text-xs text-[#94a3b8]">
            {DIFFICULTIES[difficulty].description}
          </p>
        </div>

        {/* Primary & Secondary Actions */}
        <div className="w-full mt-6 flex flex-col sm:flex-row gap-3">
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
      <div className="text-xs text-[#9eb0c7] tracking-normal text-center">
        کلیک یا کشیدن برای حمله هم‌مرز · دابل‌کلیک فراخوانی کمکی · کلیک راست اعزام ۱۰۰٪ · اسکرول تغییر درصد · کلید H راهنمای میانبرها
      </div>
    </div>
  );
}
