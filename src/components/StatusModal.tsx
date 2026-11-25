import type { GameOutcome, GamePhase, MatchStats } from '../game/types';

interface StatusModalProps {
  phase: GamePhase;
  outcome: GameOutcome;
  stats: MatchStats;
  playerTerritories: number;
  totalTerritories: number;
  onResume: () => void;
  onRestartNewMap: () => void;
  onReturnTitle: () => void;
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export function StatusModal({
  phase,
  outcome,
  stats,
  playerTerritories,
  totalTerritories,
  onResume,
  onRestartNewMap,
  onReturnTitle,
}: StatusModalProps) {
  if (phase !== 'paused' && phase !== 'gameover') return null;

  const isVictory = phase === 'gameover' && outcome === 'victory';
  const isDefeat = phase === 'gameover' && outcome === 'defeat';

  const heading =
    phase === 'paused'
      ? 'نبرد متوقف شد'
      : isVictory
        ? 'پیروزی مطلق!'
        : 'سقوط امپراتوری';

  const subtitle =
    phase === 'paused'
      ? 'نقشه و نیروهای شما در حال انتظار هستند.'
      : isVictory
        ? 'تمامی قلعه‌های قاره زیر پرچم امپراتوری سرخ متحد شدند.'
        : 'آخرین دژ شما تسخیر شد. با استراتژی تازه دوباره حمله کنید.';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-modal-title"
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#070d17]/80"
    >
      <div className="w-full max-w-md bg-[#111a2b] border-2 border-[#d6b472]/40 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.8)] text-center">
        <h2
          id="status-modal-title"
          className={`text-2xl font-black ${
            isVictory
              ? 'text-[#fbbf24]'
              : isDefeat
                ? 'text-[#f87171]'
                : 'text-[#f6efe0]'
          }`}
        >
          {heading}
        </h2>

        <p className="mt-2 text-sm text-[#a3b1c6] leading-relaxed">{subtitle}</p>

        {/* Tabular-nums Match Stats */}
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <div className="bg-[#162236] border-2 border-[#25354f] py-3 px-2">
            <div className="text-[11px] text-[#94a3b8]">مدت نبرد</div>
            <div className="mt-1 font-num text-lg font-bold text-[#f6efe0]">
              {formatDuration(stats.elapsedSeconds)}
            </div>
          </div>

          <div className="bg-[#162236] border-2 border-[#25354f] py-3 px-2">
            <div className="text-[11px] text-[#94a3b8]">قلعه‌های شما</div>
            <div className="mt-1 font-num text-lg font-bold text-[#f6efe0]">
              {playerTerritories}/{totalTerritories}
            </div>
          </div>

          <div className="bg-[#162236] border-2 border-[#25354f] py-3 px-2">
            <div className="text-[11px] text-[#94a3b8]">ساختمان‌ها</div>
            <div className="mt-1 font-num text-lg font-bold text-[#d6b472]">
              {stats.buildingsConstructed}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-2.5">
          {phase === 'paused' ? (
            <button
              type="button"
              onClick={onResume}
              className="w-full py-3 px-5 border-2 border-[#fde68a]/40 bg-[#c99846] hover:bg-[#b58636] text-[#0c1320] font-extrabold text-sm transition-colors cursor-pointer"
            >
              ادامه نبرد
            </button>
          ) : (
            <button
              type="button"
              data-start="true"
              onClick={onRestartNewMap}
              className="w-full py-3 px-5 border-2 border-[#f87171]/60 bg-[#dc2626] hover:bg-[#b91c1c] text-white font-extrabold text-sm transition-colors cursor-pointer"
            >
              شروع نبرد جدید
            </button>
          )}

          {phase === 'paused' && (
            <button
              type="button"
              onClick={onRestartNewMap}
              className="w-full py-2.5 px-5 bg-[#1c2940] hover:bg-[#263755] border-2 border-[#314566] text-[#e2e8f0] font-bold text-sm transition-colors cursor-pointer"
            >
              تولید نقشه تصادفی جدید
            </button>
          )}

          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full py-2.5 px-5 border-2 border-transparent bg-transparent hover:bg-[#182336] hover:border-[#25354f] text-[#94a3b8] hover:text-white font-medium text-xs transition-colors cursor-pointer"
          >
            بازگشت به صفحه اصلی
          </button>
        </div>
      </div>
    </div>
  );
}
