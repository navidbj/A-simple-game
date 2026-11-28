import { memo } from 'react';
import type { BattleLogEntry } from '../game/types';
import { LogScrollIcon } from './GameIcons';

interface BattleLogPanelProps {
  entries: BattleLogEntry[];
  open: boolean;
  compact: boolean;
  onToggle: () => void;
}

export const BattleLogPanel = memo(function BattleLogPanel({ entries, open, compact, onToggle }: BattleLogPanelProps) {
  const posClass = compact ? 'bottom-2 left-2' : 'bottom-2.5 left-3 xl:left-16';

  if (!open) {
    return (
      <div className={`absolute ${posClass} z-20`}>
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggle();
          }}
          aria-label="باز کردن گزارش نبرد (L)"
          title="گزارش نبرد (کلید L)"
          className="hud-wood-btn h-8 px-2.5 text-[#f3bd59] text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer"
        >
          <LogScrollIcon className="w-3.5 h-3.5 shrink-0" />
          <span>گزارش نبرد</span>
          {entries.length > 0 && (
            <span className="font-num text-[10px] text-[#e2d8c5]">({entries.length})</span>
          )}
        </button>
      </div>
    );
  }

  return (
    <section
      aria-label="گزارش نبرد"
      data-testid="battle-log"
      className={`absolute ${posClass} z-20 hud-stone-frame p-1 flex flex-col ${
        compact ? 'w-[228px] max-w-[68vw]' : 'w-[264px]'
      }`}
    >
      <div className="hud-wood-tray flex flex-col">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#2a1a10] border-b border-[#180f09]">
          <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-[#fde68a]">
            <LogScrollIcon className="w-3.5 h-3.5 text-[#f3bd59] shrink-0" />
            <span>گزارش نبرد</span>
            {!compact && <span className="font-num text-[10px] text-[#b5a490]">[L]</span>}
          </div>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggle();
            }}
            aria-label="جمع کردن گزارش نبرد"
            className="px-1.5 py-0.5 text-[10px] font-bold text-[#cbb89d] hover:text-white hover:bg-[#493120] cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Log Entries */}
        <div className="max-h-[112px] overflow-y-auto px-2 py-1.5 space-y-1 no-scrollbar">
          {entries.length === 0 ? (
            <div className="py-2 text-[11px] text-[#b5a490] text-center">
              نبرد آغاز شد؛ رویدادهای مهم اینجا ثبت می‌شوند.
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-1.5 text-[11px] leading-snug bg-[#23160e]/90 border-r-2 px-2 py-1"
                style={{ borderRightColor: entry.accentColor }}
              >
                <span className="font-num text-[10px] text-[#a3907c] shrink-0 pt-px">
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
                            : 'text-[#ece2d0]'
                  }`}
                >
                  {entry.text}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
});
