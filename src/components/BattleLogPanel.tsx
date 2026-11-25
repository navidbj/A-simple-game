import type { BattleLogEntry } from '../game/types';
import { LogScrollIcon } from './GameIcons';

interface BattleLogPanelProps {
  entries: BattleLogEntry[];
  open: boolean;
  compact: boolean;
  onToggle: () => void;
}

export function BattleLogPanel({ entries, open, compact, onToggle }: BattleLogPanelProps) {
  if (!open) {
    return (
      <div className="absolute bottom-2 left-2 z-20">
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggle();
          }}
          aria-label="باز کردن گزارش نبرد (L)"
          title="گزارش نبرد (کلید L)"
          className="h-8 px-2.5 bg-[#0e1726]/92 hover:bg-[#17253d] border-2 border-[#2b3e5c] text-[#d6b472] text-[11px] font-bold flex items-center gap-1.5 shadow-[0_6px_18px_rgba(0,0,0,0.55)] cursor-pointer"
        >
          <LogScrollIcon className="w-3.5 h-3.5 shrink-0" />
          <span>گزارش نبرد</span>
          {entries.length > 0 && (
            <span className="font-num text-[10px] text-[#94a3b8]">({entries.length})</span>
          )}
        </button>
      </div>
    );
  }

  return (
    <section
      aria-label="گزارش نبرد"
      data-testid="battle-log"
      className={`absolute bottom-2 left-2 z-20 bg-[#0d1523]/94 border-2 border-[#2a3c59] shadow-[0_12px_32px_rgba(0,0,0,0.7)] flex flex-col ${
        compact ? 'w-[228px] max-w-[68vw]' : 'w-[256px]'
      }`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-2.5 py-1 bg-[#131f33] border-b border-[#253652]">
        <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-[#f2e8d5]">
          <LogScrollIcon className="w-3.5 h-3.5 text-[#d6b472] shrink-0" />
          <span>گزارش نبرد</span>
          {!compact && <span className="font-num text-[10px] text-[#64748b]">[L]</span>}
        </div>
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggle();
          }}
          aria-label="جمع کردن گزارش نبرد"
          className="px-1.5 py-0.5 text-[10px] font-bold text-[#94a3b8] hover:text-white hover:bg-[#1e2f4a] cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* Scrollable Log Entries */}
      <div className="max-h-[108px] overflow-y-auto px-2 py-1.5 space-y-1 no-scrollbar">
        {entries.length === 0 ? (
          <div className="py-2 text-[11px] text-[#64748b] text-center">
            نبرد آغاز شد؛ رویدادهای مهم اینجا ثبت می‌شوند.
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-1.5 text-[11px] leading-snug bg-[#111c2e]/85 border-r-2 px-2 py-1"
              style={{ borderRightColor: entry.accentColor }}
            >
              <span className="font-num text-[10px] text-[#64748b] shrink-0 pt-px">
                {entry.timeText}
              </span>
              <span
                className={`flex-1 min-w-0 ${
                  entry.tone === 'capture_player'
                    ? 'text-[#fde68a] font-bold'
                    : entry.tone === 'alert'
                      ? 'text-[#fca5a5] font-bold'
                      : entry.tone === 'supply'
                        ? 'text-[#6ee7b7]'
                        : entry.tone === 'power'
                          ? 'text-[#7dd3fc]'
                          : 'text-[#cbd5e1]'
                }`}
              >
                {entry.text}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
