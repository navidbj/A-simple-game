import type { GameOutcome, GamePhase, MatchStats } from '../game/types';
import type { TimelapseData } from '../hooks/useGameController';
import { RoyalTitleCrown, StoneBrassStud, StoneCornerVine } from './HudOrnaments';
import { TimelapseCanvas } from './TimelapseCanvas';

interface StatusModalProps {
  phase: GamePhase;
  outcome: GameOutcome;
  stats: MatchStats;
  playerTerritories: number;
  totalTerritories: number;
  timelapse?: TimelapseData | null;
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
  timelapse,
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
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#060c18]/82"
    >
      <div className="relative w-full max-w-md max-h-[92dvh] hud-stone-frame p-1.5">
        <StoneCornerVine className="absolute -top-1.5 -left-1.5 w-10 h-9 z-20" />
        <StoneCornerVine flipX className="absolute -top-1.5 -right-1.5 w-10 h-9 z-20" />
        <StoneBrassStud className="absolute bottom-1 left-1 w-2.5 h-2.5 z-20" />
        <StoneBrassStud className="absolute bottom-1 right-1 w-2.5 h-2.5 z-20" />

        <div className="hud-wood-tray max-h-[calc(92dvh-16px)] overflow-y-auto p-5 sm:p-6 text-center">
          {isVictory && <RoyalTitleCrown className="w-10 h-4 mx-auto mb-1" />}

          <h2
            id="status-modal-title"
            className={`text-2xl font-black ${
              isVictory
                ? 'hud-gold-wordmark'
                : isDefeat
                  ? 'text-[#fca5a5] hud-pixel-outline'
                  : 'text-[#fef3c7] hud-pixel-outline'
            }`}
          >
            {heading}
          </h2>

          <p className="mt-2 text-sm text-[#e2d6c1] leading-relaxed">{subtitle}</p>

          {/* Tabular-nums Match Stats in Carved Stone Cavities */}
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <div className="hud-stone-inset py-2.5 px-2">
              <div className="text-[11px] text-[#b5a795]">مدت نبرد</div>
              <div className="mt-1 font-num text-lg font-black text-[#fef3c7]">
                {formatDuration(stats.elapsedSeconds)}
              </div>
            </div>

            <div className="hud-stone-inset py-2.5 px-2">
              <div className="text-[11px] text-[#b5a795]">قلعه‌های شما</div>
              <div className="mt-1 font-num text-lg font-black text-[#fef3c7]">
                {playerTerritories}/{totalTerritories}
              </div>
            </div>

            <div className="hud-stone-inset py-2.5 px-2">
              <div className="text-[11px] text-[#b5a795]">ساختمان‌ها</div>
              <div className="mt-1 font-num text-lg font-black text-[#fde047]">
                {stats.buildingsConstructed}
              </div>
            </div>
          </div>

          {/* Endgame Conquest Timelapse Player */}
          {phase === 'gameover' && timelapse && (
            <TimelapseCanvas
              map={timelapse.map}
              territories={timelapse.territories}
              snapshots={timelapse.snapshots}
            />
          )}

          {/* Actions */}
          <div className="mt-6 flex flex-col gap-2.5">
            {phase === 'paused' ? (
              <button
                type="button"
                onClick={onResume}
                className="w-full min-h-[46px] py-2.5 px-5 hud-gold-tile text-[#1d1206] font-black text-sm cursor-pointer"
              >
                ادامه نبرد
              </button>
            ) : (
              <button
                type="button"
                data-start="true"
                onClick={onRestartNewMap}
                className="w-full min-h-[46px] py-2.5 px-5 hud-gold-tile text-[#1d1206] font-black text-sm cursor-pointer"
              >
                شروع نبرد جدید
              </button>
            )}

            {phase === 'paused' && (
              <button
                type="button"
                onClick={onRestartNewMap}
                className="w-full min-h-[44px] py-2.5 px-5 hud-wood-btn text-[#f5eedc] font-bold text-sm cursor-pointer"
              >
                تولید نقشه تصادفی جدید
              </button>
            )}

            <button
              type="button"
              onClick={onReturnTitle}
              className="w-full min-h-[40px] py-2 px-5 hud-focus-ring text-[#d6c5ad] hover:text-[#fef08a] font-bold text-xs transition-colors cursor-pointer"
            >
              بازگشت به صفحه اصلی
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
