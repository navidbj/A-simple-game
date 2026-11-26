import { useEffect, useMemo, useRef, useState } from 'react';
import { formatBattleTime } from '../game/battleLog';
import { FACTIONS, NEUTRAL_STYLE } from '../game/constants';
import type { MapGridData, Territory, TimelapseSnapshot } from '../game/types';

interface TimelapseCanvasProps {
  map: MapGridData;
  territories: Territory[];
  snapshots: TimelapseSnapshot[];
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

const FACTION_RGB = FACTIONS.map((f) => hexToRgb(f.color));
const NEUTRAL_RGB = hexToRgb(NEUTRAL_STYLE.landFill);

/**
 * Pixel-art Endgame Map Timelapse player.
 * Replays territory color expansion across the actual generated Voronoi continent
 * from second 0 to victory/defeat over ~5 seconds with Play/Pause, Replay, and scrubber.
 */
export function TimelapseCanvas({ map, territories, snapshots }: TimelapseCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(true);

  const safeSnapshots = useMemo<TimelapseSnapshot[]>(() => {
    if (snapshots.length > 0) return snapshots;
    return [{ elapsed: 0, owners: territories.map((t) => t.owner) }];
  }, [snapshots, territories]);

  const totalFrames = safeSnapshots.length;
  const clampedIdx = Math.min(frameIdx, totalFrames - 1);
  const activeSnap = safeSnapshots[clampedIdx];

  // Auto-advance playback across ~5 seconds total
  useEffect(() => {
    if (!playing || totalFrames <= 1) return;
    const stepMs = Math.max(95, Math.min(480, Math.round(5200 / totalFrames)));
    const timer = window.setInterval(() => {
      setFrameIdx((prev) => {
        if (prev >= totalFrames - 1) {
          setPlaying(false);
          return totalFrames - 1;
        }
        return prev + 1;
      });
    }, stepMs);
    return () => window.clearInterval(timer);
  }, [playing, totalFrames]);

  // Paint the active timelapse snapshot cleanly onto the miniature pixel canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { cols, rows, cells, elevation } = map;
    if (canvas.width !== cols || canvas.height !== rows) {
      canvas.width = cols;
      canvas.height = rows;
    }

    const img = ctx.createImageData(cols, rows);
    const data = img.data;
    const owners = activeSnap.owners;

    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const idx = gy * cols + gx;
        const cellId = cells[idx];
        const elev = elevation[idx];

        let r = 13;
        let g = 28;
        let b = 50;

        if (cellId === -1) {
          if (elev > 110) {
            r = 104;
            g = 178;
            b = 194;
          } else if (elev > 88) {
            r = 28;
            g = 76;
            b = 108;
          } else if (elev > 56) {
            r = 18;
            g = 46;
            b = 76;
          }
        } else {
          const owner = owners[cellId] ?? -1;
          const isCoast =
            gx === 0 ||
            gy === 0 ||
            gx === cols - 1 ||
            gy === rows - 1 ||
            cells[idx - 1] === -1 ||
            cells[idx + 1] === -1 ||
            cells[idx - cols] === -1 ||
            cells[idx + cols] === -1;

          const isBorder =
            !isCoast &&
            (cells[idx - 1] !== cellId ||
              cells[idx + 1] !== cellId ||
              cells[idx - cols] !== cellId ||
              cells[idx + cols] !== cellId);

          if (isCoast) {
            r = 15;
            g = 23;
            b = 38;
          } else if (isBorder) {
            r = 20;
            g = 28;
            b = 44;
          } else {
            const base = owner >= 0 ? FACTION_RGB[owner] : NEUTRAL_RGB;
            const shade = ((gx + gy) & 1) === 0 ? 1.0 : 0.92;
            r = Math.round(base[0] * shade);
            g = Math.round(base[1] * shade);
            b = Math.round(base[2] * shade);
          }
        }

        const p = idx * 4;
        data[p] = r;
        data[p + 1] = g;
        data[p + 2] = b;
        data[p + 3] = 255;
      }
    }

    ctx.putImageData(img, 0, 0);

    // Draw crisp tiny castle squares on each territory center
    for (const t of territories) {
      const cx = Math.round(t.x / map.step);
      const cy = Math.round(t.y / map.step);
      ctx.fillStyle = '#090e18';
      ctx.fillRect(cx - 3, cy - 3, 6, 6);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(cx - 2, cy - 2, 4, 4);
    }
  }, [activeSnap, map, territories]);

  const handleReplay = () => {
    setFrameIdx(0);
    setPlaying(true);
  };

  return (
    <div
      data-testid="timelapse-player"
      className="mt-4 bg-[#0b1322] border-2 border-[#273854] p-2.5 text-right"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-extrabold text-[#d6b472]">
          بازپخش سریع فتح نقشه
        </span>
        <span className="font-num text-[11px] text-[#cbd5e1]">
          {formatBattleTime(activeSnap.elapsed)}
          <span className="text-[#64748b]">
            {' '}
            ({clampedIdx + 1}/{totalFrames})
          </span>
        </span>
      </div>

      {/* Crisp Nearest-Neighbor Pixel Timelapse Map */}
      <div className="w-full aspect-[1080/720] bg-[#0a1628] border border-[#1f2e47] overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      {/* Playback Controls & Scrubber */}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (!playing && clampedIdx >= totalFrames - 1) {
              handleReplay();
            } else {
              setPlaying((p) => !p);
            }
          }}
          className="px-2.5 py-1 bg-[#18253b] hover:bg-[#233554] border border-[#32496e] text-[#f2e8d5] text-[11px] font-bold cursor-pointer shrink-0"
        >
          {playing ? 'مکث' : clampedIdx >= totalFrames - 1 ? 'پخش مجدد' : 'ادامه'}
        </button>

        <input
          type="range"
          min={0}
          max={Math.max(0, totalFrames - 1)}
          value={clampedIdx}
          aria-label="خط زمان بازپخش نقشه"
          onChange={(e) => {
            setPlaying(false);
            setFrameIdx(Number(e.target.value));
          }}
          className="flex-1 accent-[#c99846] cursor-pointer"
        />
      </div>
    </div>
  );
}
