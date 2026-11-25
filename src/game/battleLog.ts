import { BUILDINGS, COMMANDER_POWERS, FACTIONS } from './constants';
import type { BattleLogEntry, SimEvent } from './types';

export function formatBattleTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Converts key simulation events into concise Persian Battle Log entries.
 * Pure, deterministic helper — easy to unit test and zero DOM dependency.
 */
export function buildBattleLogEntries(
  events: SimEvent[],
  elapsedSeconds: number,
  nextIdRef: { current: number }
): BattleLogEntry[] {
  const created: BattleLogEntry[] = [];
  const timeText = formatBattleTime(elapsedSeconds);

  for (const ev of events) {
    const faction = ev.owner >= 0 ? FACTIONS[ev.owner] : null;
    const factionColor = faction ? faction.color : '#94a3b8';
    const castleName = ev.territoryName ?? 'قلعه';

    if (ev.type === 'capture') {
      if (ev.capturedByPlayer) {
        created.push({
          id: nextIdRef.current++,
          timeText,
          text: `قلعه «${castleName}» به دست شما فتح شد!`,
          tone: 'capture_player',
          accentColor: '#fbbf24',
        });
      } else if (ev.previousOwner === 0) {
        created.push({
          id: nextIdRef.current++,
          timeText,
          text: `قلعه «${castleName}» سقوط کرد (${faction?.shortName ?? 'دشمن'})`,
          tone: 'alert',
          accentColor: '#f87171',
        });
      } else {
        created.push({
          id: nextIdRef.current++,
          timeText,
          text: `قلعه «${castleName}» به تصرف ${faction?.shortName ?? 'رقیب'} درآمد`,
          tone: 'capture_enemy',
          accentColor: factionColor,
        });
      }
    } else if (ev.type === 'build' && ev.building) {
      // Log player buildings and notable enemy mines/forges/towers without spamming
      if (ev.owner === 0 || ev.building === 'mine' || ev.building === 'forge') {
        const bName = BUILDINGS[ev.building].name;
        const suffix = ev.owner === 0 ? 'ساخته شد' : `توسط ${faction?.shortName ?? 'رقیب'} ساخته شد`;
        created.push({
          id: nextIdRef.current++,
          timeText,
          text: `${bName} در «${castleName}» ${suffix}`,
          tone: 'build',
          accentColor: ev.owner === 0 ? '#86efac' : factionColor,
        });
      }
    } else if (ev.type === 'power' && ev.power && ev.owner === 0) {
      const pName = COMMANDER_POWERS[ev.power].name;
      created.push({
        id: nextIdRef.current++,
        timeText,
        text: `قدرت «${pName}» در نبرد فعال شد`,
        tone: 'power',
        accentColor: '#38bdf8',
      });
    } else if (ev.type === 'supply_set' && ev.owner === 0) {
      const targetName = ev.targetName ?? 'قلعه مقصد';
      created.push({
        id: nextIdRef.current++,
        timeText,
        text: `خط تأمین خودکار: «${castleName}» به «${targetName}»`,
        tone: 'supply',
        accentColor: '#34d399',
      });
    } else if (ev.type === 'supply_clear' && ev.owner === 0) {
      created.push({
        id: nextIdRef.current++,
        timeText,
        text: `خط تأمین «${castleName}» لغو شد`,
        tone: 'supply',
        accentColor: '#94a3b8',
      });
    } else if (ev.type === 'victory') {
      created.push({
        id: nextIdRef.current++,
        timeText,
        text: 'پیروزی کامل! تمام قاره تحت فرمان شماست.',
        tone: 'capture_player',
        accentColor: '#fde047',
      });
    } else if (ev.type === 'defeat') {
      created.push({
        id: nextIdRef.current++,
        timeText,
        text: 'آخرین دژ امپراتوری سرخ سقوط کرد.',
        tone: 'alert',
        accentColor: '#ef4444',
      });
    }
  }

  return created;
}

export function appendBattleLog(
  existing: BattleLogEntry[],
  incoming: BattleLogEntry[],
  maxEntries = 36
): BattleLogEntry[] {
  if (incoming.length === 0) return existing;
  const combined = [...incoming.reverse(), ...existing];
  return combined.length > maxEntries ? combined.slice(0, maxEntries) : combined;
}
