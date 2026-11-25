import type { SVGProps } from 'react';

export function CitadelCrestSvg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 120 120" fill="none" aria-hidden="true" {...props}>
      {/* Heraldic Shield Frame */}
      <path
        d="M60 8L104 22V56C104 84 85 103 60 112C35 103 16 84 16 56V22L60 8Z"
        fill="#162133"
        stroke="#d6b472"
        strokeWidth="3"
      />
      <path
        d="M60 15L97 27V55C97 79 81 96 60 104C39 96 23 79 23 55V27L60 15Z"
        fill="#1b283d"
        stroke="#d6b472"
        strokeOpacity="0.45"
        strokeWidth="1.5"
      />
      {/* Crossed Banners Accent */}
      <path d="M35 84L85 34" stroke="#dc2626" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M85 84L35 34" stroke="#dc2626" strokeWidth="3.5" strokeLinecap="round" />
      {/* Detailed Fortress Silhouette */}
      <path
        d="M36 78V52H42V57H48V52H54V42H50V36H56V39H64V36H70V42H66V52H72V57H78V52H84V78H36Z"
        fill="#ede7d9"
        stroke="#0f172a"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Central Crimson Roof & Pennant */}
      <path
        d="M52 36L60 24L68 36H52Z"
        fill="#dc2626"
        stroke="#0f172a"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M60 24V16" stroke="#d6b472" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M60 16L71 19.5L60 23V16Z" fill="#dc2626" />
      {/* Gate Arch */}
      <path d="M53 78V66C53 62.2 56.1 59 60 59C63.9 59 67 62.2 67 66V78H53Z" fill="#101827" />
    </svg>
  );
}

export function BarracksIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 3L4 12L3 20H21L20 12L12 3Z"
        fill="#334155"
        stroke="#0f172a"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M12 3L16 12H8L12 3Z" fill="#ef4444" />
      <path d="M9.5 20V14.5L12 12.5L14.5 14.5V20H9.5Z" fill="#0f172a" />
      <path d="M12 3V1.5" stroke="#e2d9c8" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function GuardTowerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M6 4H9V6.5H11V4H13V6.5H15V4H18V9L16.5 10.5V20H7.5V10.5L6 9V4Z"
        fill="#94a3b8"
        stroke="#0f172a"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M12 11.5L15 13V15.5C15 17.2 13.7 18.4 12 19C10.3 18.4 9 17.2 9 15.5V13L12 11.5Z" fill="#38bdf8" stroke="#0f172a" strokeWidth="1.2" />
    </svg>
  );
}

export function GoldMineIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M3 19L7 9L12 5L17 9L21 19H3Z"
        fill="#475569"
        stroke="#0f172a"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 19V13C8.5 11.1 10.1 9.5 12 9.5C13.9 9.5 15.5 11.1 15.5 13V19H8.5Z"
        fill="#0f172a"
      />
      <path d="M10 17.5L12 14.5L14 17.5H10Z" fill="#fbbf24" />
      <circle cx="12" cy="7.5" r="1.4" fill="#fde047" />
    </svg>
  );
}

export function SwordIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M19 4L10.5 12.5M19 4L18 9L11.5 15.5L8.5 12.5L15 6L19 4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 11.5L12.5 17.5M8.5 15.5L5 19"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ManpowerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="9.5" cy="7.5" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4 19C4 15.9 6.4 13.5 9.5 13.5C12.6 13.5 15 15.9 15 19"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="16.5" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M15.5 13.8C17.8 14.1 19.8 16 20 19"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SoundIcon({ muted, ...props }: SVGProps<SVGSVGElement> & { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M5 9.5H9L14 5V19L9 14.5H5V9.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {muted ? (
        <path d="M17.5 9.5L21 13M21 9.5L17.5 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      ) : (
        <path d="M17 8.5C18.4 9.9 18.4 14.1 17 15.5M19.5 6.5C22 9 22 15 19.5 17.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      )}
    </svg>
  );
}

export function PauseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
    </svg>
  );
}

export function MapDiceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="8" y="8" width="2.4" height="2.4" fill="currentColor" />
      <rect x="13.6" y="8" width="2.4" height="2.4" fill="currentColor" />
      <rect x="10.8" y="10.8" width="2.4" height="2.4" fill="currentColor" />
      <rect x="8" y="13.6" width="2.4" height="2.4" fill="currentColor" />
      <rect x="13.6" y="13.6" width="2.4" height="2.4" fill="currentColor" />
    </svg>
  );
}

export function WarForgeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" shapeRendering="crispEdges" aria-hidden="true" {...props}>
      <rect x="14" y="3" width="4" height="9" fill="#64748b" />
      <rect x="15" y="2" width="2" height="2" fill="#94a3b8" />
      <rect x="4" y="9" width="16" height="11" fill="#334155" />
      <rect x="3" y="8" width="12" height="3" fill="#b45309" />
      <rect x="7" y="13" width="6" height="6" fill="#0f172a" />
      <rect x="8" y="15" width="4" height="4" fill="#f97316" />
      <rect x="9" y="16" width="2" height="2" fill="#fde047" />
    </svg>
  );
}

export function MobilizeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" shapeRendering="crispEdges" aria-hidden="true" {...props}>
      <rect x="10" y="3" width="4" height="4" fill="#fbbf24" />
      <rect x="8" y="8" width="8" height="7" fill="#ef4444" />
      <rect x="5" y="10" width="3" height="5" fill="#cbd5e1" />
      <rect x="16" y="10" width="3" height="5" fill="#cbd5e1" />
      <rect x="9" y="15" width="2.5" height="5" fill="#94a3b8" />
      <rect x="12.5" y="15" width="2.5" height="5" fill="#94a3b8" />
    </svg>
  );
}

export function BlitzIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" shapeRendering="crispEdges" aria-hidden="true" {...props}>
      <path d="M13 3H7L5 12H11L9 21L19 10H13L15 3H13Z" fill="#38bdf8" />
      <path d="M12 5H8.5L7.5 10H12.5L11.5 16L16 11.5H11.5L12 5Z" fill="#e0f2fe" />
    </svg>
  );
}

export function ShieldPowerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" shapeRendering="crispEdges" aria-hidden="true" {...props}>
      <path d="M5 4H19V13L12 20L5 13V4Z" fill="#2563eb" />
      <path d="M7 6H17V12.2L12 17.2L7 12.2V6Z" fill="#60a5fa" />
      <rect x="11" y="7.5" width="2" height="7" fill="#fef08a" />
      <rect x="8.5" y="10" width="7" height="2" fill="#fef08a" />
    </svg>
  );
}

export function RallyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" shapeRendering="crispEdges" aria-hidden="true" {...props}>
      {/* Central castle target square */}
      <rect x="9" y="9" width="6" height="6" fill="currentColor" />
      {/* Four inward converging pixel arrows */}
      <path d="M12 2V7M10 5L12 7L14 5" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
      <path d="M12 22V17M10 19L12 17L14 19" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
      <path d="M2 12H7M5 10L7 12L5 14" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
      <path d="M22 12H17M19 10L17 12L19 14" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
    </svg>
  );
}

export function RotatePhoneSvg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" shapeRendering="crispEdges" aria-hidden="true" {...props}>
      {/* Pixel phone body */}
      <rect x="18" y="8" width="28" height="48" fill="#182438" stroke="currentColor" strokeWidth="3" />
      <rect x="22" y="14" width="20" height="32" fill="#0d1626" />
      {/* Mini pixel castle hint on phone screen */}
      <rect x="27" y="26" width="10" height="10" fill="#dc2626" />
      <rect x="29" y="22" width="6" height="4" fill="#f6efe0" />
      {/* Home bar */}
      <rect x="28" y="50" width="8" height="2" fill="currentColor" />
      {/* Curved rotation arrows */}
      <path
        d="M52 24C54 28 54 34 51 39M51 39L55 37M51 39L50 34"
        stroke="#fde047"
        strokeWidth="2.5"
        strokeLinecap="square"
      />
      <path
        d="M12 40C10 36 10 30 13 25M13 25L9 27M13 25L14 30"
        stroke="#fde047"
        strokeWidth="2.5"
        strokeLinecap="square"
      />
    </svg>
  );
}

export function SpeedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" shapeRendering="crispEdges" aria-hidden="true" {...props}>
      <path d="M4 6L12 12L4 18V6Z" fill="currentColor" />
      <path d="M12 6L20 12L12 18V6Z" fill="currentColor" />
    </svg>
  );
}

export function KeyboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" shapeRendering="crispEdges" aria-hidden="true" {...props}>
      <rect x="3" y="6" width="18" height="12" stroke="currentColor" strokeWidth="1.8" />
      <rect x="6" y="9" width="2" height="2" fill="currentColor" />
      <rect x="10" y="9" width="2" height="2" fill="currentColor" />
      <rect x="14" y="9" width="2" height="2" fill="currentColor" />
      <rect x="17" y="9" width="1.5" height="2" fill="currentColor" />
      <rect x="7" y="13" width="10" height="2" fill="currentColor" />
    </svg>
  );
}

export function SupplyRouteIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" shapeRendering="crispEdges" aria-hidden="true" {...props}>
      {/* Origin castle node -> animated conveyor chevrons -> frontline node */}
      <rect x="2" y="9" width="5" height="6" fill="currentColor" />
      <path d="M9 12H15M13 9L16 12L13 15" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
      <rect x="17" y="8" width="5" height="8" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function MusicNoteIcon({ muted, ...props }: SVGProps<SVGSVGElement> & { muted?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" shapeRendering="crispEdges" aria-hidden="true" {...props}>
      <path d="M9 17V6L19 4V15" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
      <rect x="5" y="15" width="4" height="4" fill="currentColor" />
      <rect x="15" y="13" width="4" height="4" fill="currentColor" />
      {muted && (
        <path d="M4 4L20 20" stroke="#f87171" strokeWidth="2.2" strokeLinecap="square" />
      )}
    </svg>
  );
}

export function LogScrollIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" shapeRendering="crispEdges" aria-hidden="true" {...props}>
      <rect x="4" y="4" width="16" height="16" stroke="currentColor" strokeWidth="1.8" />
      <rect x="7" y="8" width="10" height="2" fill="currentColor" />
      <rect x="7" y="12" width="8" height="2" fill="currentColor" />
      <rect x="7" y="16" width="6" height="2" fill="currentColor" />
    </svg>
  );
}

export function PortAnchorIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" shapeRendering="crispEdges" aria-hidden="true" {...props}>
      {/* Pixel Anchor + Sea Wave */}
      <rect x="10" y="3" width="4" height="4" stroke="#7dd3fc" strokeWidth="2" />
      <rect x="11" y="7" width="2" height="11" fill="#38bdf8" />
      <rect x="7" y="9" width="10" height="2" fill="#bae6fd" />
      <path d="M5 14V17H8V19H16V17H19V14" stroke="#38bdf8" strokeWidth="2" strokeLinecap="square" />
      <rect x="4" y="13" width="3" height="2" fill="#e0f2fe" />
      <rect x="17" y="13" width="3" height="2" fill="#e0f2fe" />
    </svg>
  );
}
