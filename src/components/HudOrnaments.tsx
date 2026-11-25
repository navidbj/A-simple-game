import type { SVGProps } from 'react';
import type { BuildingLevel, BuildingType, PowerType } from '../game/types';

/** Lush 16-bit pixel moss & draping flowering ivy corner ornament for carved stone frames */
export function StoneCornerVine({
  flipX = false,
  flipY = false,
  className = '',
}: {
  flipX?: boolean;
  flipY?: boolean;
  className?: string;
}) {
  const sx = flipX ? -1 : 1;
  const sy = flipY ? -1 : 1;
  return (
    <svg
      viewBox="0 0 42 36"
      fill="none"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
      style={{ transform: `scale(${sx}, ${sy})` }}
    >
      {/* Sculpted dark iron corner rivet plate beneath moss */}
      <rect x="0" y="0" width="10" height="10" fill="#23262e" />
      <rect x="2" y="2" width="6" height="6" fill="#3a3f4a" />
      <rect x="4" y="4" width="2" height="2" fill="#d6b472" />
      {/* Lush layered pixel moss across top stone lip */}
      <rect x="0" y="0" width="26" height="4" fill="#264e1d" />
      <rect x="2" y="0" width="20" height="2" fill="#5da636" />
      <rect x="6" y="2" width="18" height="2" fill="#3f7c26" />
      <rect x="24" y="2" width="10" height="2" fill="#2f6122" />
      <rect x="20" y="0" width="6" height="2" fill="#7cd14a" />
      <rect x="30" y="0" width="4" height="2" fill="#5da636" />
      {/* Draped primary vertical vine */}
      <rect x="0" y="4" width="6" height="8" fill="#22451a" />
      <rect x="2" y="4" width="4" height="6" fill="#5aa134" />
      <rect x="0" y="12" width="4" height="10" fill="#29541f" />
      <rect x="2" y="12" width="2" height="8" fill="#73c243" />
      <rect x="2" y="22" width="4" height="6" fill="#22451a" />
      <rect x="4" y="22" width="2" height="4" fill="#5aa134" />
      <rect x="2" y="28" width="2" height="6" fill="#366b24" />
      {/* Secondary cascading leaf tendril */}
      <rect x="8" y="4" width="6" height="6" fill="#244b1b" />
      <rect x="10" y="4" width="4" height="4" fill="#7cd14a" />
      <rect x="10" y="10" width="4" height="6" fill="#356824" />
      <rect x="8" y="16" width="4" height="4" fill="#5aa134" />
      <rect x="16" y="4" width="4" height="4" fill="#2b5820" />
      <rect x="18" y="4" width="2" height="2" fill="#8ad856" />
      {/* Tiny pixel highlights & colorful fantasy blossom buds */}
      <rect x="4" y="8" width="2" height="2" fill="#9ae663" />
      <rect x="12" y="6" width="2" height="2" fill="#fde047" />
      <rect x="6" y="14" width="2" height="2" fill="#f472b6" />
      <rect x="26" y="2" width="2" height="2" fill="#fde047" />
    </svg>
  );
}

/** Chiselled forged-iron & brass corner stud for stone plaques */
export function StoneBrassStud({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 8 8"
      fill="none"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
    >
      <rect x="0" y="0" width="8" height="8" fill="#17191f" />
      <rect x="1" y="1" width="6" height="6" fill="#474d59" />
      <rect x="2" y="2" width="4" height="4" fill="#d99a2b" />
      <rect x="2" y="2" width="2" height="2" fill="#fef08a" />
    </svg>
  );
}

/** Ornate golden royal crown emblem perched above the "فتح قلمرو" title */
export function RoyalTitleCrown({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 14"
      fill="none"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
    >
      {/* Dark outline */}
      <path
        d="M4 13H32V5L26 8L18 1L10 8L4 5V13Z"
        fill="#2b1404"
      />
      {/* Golden crown body */}
      <rect x="6" y="7" width="24" height="5" fill="#d97706" />
      <rect x="6" y="6" width="4" height="5" fill="#f59e0b" />
      <rect x="26" y="6" width="4" height="5" fill="#f59e0b" />
      <rect x="15" y="3" width="6" height="8" fill="#fbbf24" />
      <rect x="17" y="2" width="2" height="3" fill="#fef08a" />
      {/* Crown specular rim & ruby/sapphire jewels */}
      <rect x="6" y="10" width="24" height="2" fill="#b45309" />
      <rect x="8" y="9" width="2" height="2" fill="#38bdf8" />
      <rect x="17" y="7" width="2" height="3" fill="#ef4444" />
      <rect x="26" y="9" width="2" height="2" fill="#38bdf8" />
      <rect x="17" y="7" width="1" height="1" fill="#fecaca" />
    </svg>
  );
}

/** Mini 16-bit crimson heraldic citadel shield beside "قلمرو X/16" */
export function RoyalTerritoryCrest({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 22"
      fill="none"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
    >
      <path d="M2 2H18V12L10 20L2 12V2Z" fill="#180d07" />
      <path d="M3 3H17V11.5L10 18.5L3 11.5V3Z" fill="#d97706" />
      <path d="M5 5H15V11L10 16L5 11V5Z" fill="#dc2626" />
      {/* Tiny pixel tower emblem inside shield */}
      <rect x="7" y="7" width="6" height="6" fill="#fef3c7" />
      <rect x="7" y="6" width="2" height="2" fill="#fef3c7" />
      <rect x="11" y="6" width="2" height="2" fill="#fef3c7" />
      <rect x="9" y="10" width="2" height="3" fill="#7f1d1d" />
    </svg>
  );
}

/** Ornate stone, brass & flowering vine end-cap for the Territorial Power Balance Bar */
export function BalanceBarVineCap({
  side,
  className = '',
}: {
  side: 'left' | 'right';
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 26 28"
      fill="none"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
      style={{ transform: side === 'right' ? 'scaleX(-1)' : undefined }}
    >
      {/* Sculpted stone & brass clasp */}
      <rect x="4" y="3" width="10" height="22" fill="#16181f" />
      <rect x="6" y="5" width="6" height="18" fill="#525864" />
      <rect x="8" y="7" width="4" height="14" fill="#d99a2b" />
      <rect x="8" y="7" width="2" height="6" fill="#fde047" />
      {/* Lush wrapping pixel vines */}
      <rect x="2" y="1" width="14" height="4" fill="#28541e" />
      <rect x="4" y="1" width="10" height="2" fill="#6bc23d" />
      <rect x="14" y="3" width="8" height="2" fill="#46852a" />
      <rect x="0" y="5" width="4" height="16" fill="#244b1b" />
      <rect x="2" y="7" width="2" height="12" fill="#5aa833" />
      <rect x="2" y="23" width="14" height="4" fill="#28541e" />
      <rect x="4" y="23" width="10" height="2" fill="#6bc23d" />
      <rect x="14" y="21" width="8" height="2" fill="#46852a" />
      {/* Glowing blossom buds */}
      <rect x="4" y="3" width="2" height="2" fill="#fde047" />
      <rect x="2" y="21" width="2" height="2" fill="#c084fc" />
      <rect x="18" y="2" width="2" height="2" fill="#9ae663" />
    </svg>
  );
}

/** Tiny golden 4-point pixel sparkle beside the embossed "فتح قلمرو" title */
export function PixelSparkle({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 11 11"
      fill="none"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
    >
      <rect x="5" y="0" width="1" height="11" fill="#fde68a" />
      <rect x="0" y="5" width="11" height="1" fill="#fde68a" />
      <rect x="4" y="4" width="3" height="3" fill="#fffbeb" />
      <rect x="5" y="2" width="1" height="7" fill="#ffffff" />
      <rect x="2" y="5" width="7" height="1" fill="#ffffff" />
    </svg>
  );
}

/** Layered dark jungle canopy silhouette with glowing fireflies hugging the outer screen edges (desktop only) */
export function JungleEdgeSilhouette({
  side,
  className = '',
}: {
  side: 'left' | 'right';
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 56 420"
      fill="none"
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
      style={{ transform: side === 'right' ? 'scaleX(-1)' : undefined }}
    >
      {/* Deep midnight jungle shadow base */}
      <rect x="0" y="0" width="38" height="420" fill="#060f0c" />
      <rect x="38" y="0" width="8" height="420" fill="#081611" />
      {/* Stepped layered pixel foliage silhouettes */}
      <rect x="34" y="16" width="18" height="18" fill="#0c1f14" />
      <rect x="40" y="22" width="14" height="10" fill="#163820" />
      <rect x="30" y="58" width="22" height="22" fill="#0a1a12" />
      <rect x="38" y="64" width="16" height="10" fill="#1c4727" />
      <rect x="36" y="114" width="18" height="26" fill="#0c1f14" />
      <rect x="42" y="122" width="12" height="12" fill="#1e4d2a" />
      <rect x="28" y="172" width="24" height="20" fill="#0a1a12" />
      <rect x="38" y="178" width="16" height="8" fill="#173a21" />
      <rect x="34" y="232" width="20" height="24" fill="#0c1f14" />
      <rect x="42" y="240" width="12" height="10" fill="#1e4d2a" />
      <rect x="30" y="294" width="24" height="22" fill="#0a1a12" />
      <rect x="38" y="302" width="16" height="10" fill="#173a21" />
      <rect x="32" y="352" width="22" height="26" fill="#0c1f14" />
      <rect x="40" y="360" width="14" height="12" fill="#1e4d2a" />
      {/* Hanging forest vines & subtle warm firefly glints */}
      <rect x="12" y="34" width="6" height="44" fill="#0f2819" />
      <rect x="22" y="140" width="6" height="58" fill="#12301d" />
      <rect x="14" y="264" width="8" height="52" fill="#0f2819" />
      <rect x="28" y="88" width="2" height="2" fill="#fde047" opacity="0.7" />
      <rect x="18" y="210" width="2" height="2" fill="#86efac" opacity="0.55" />
      <rect x="32" y="328" width="2" height="2" fill="#fde047" opacity="0.65" />
    </svg>
  );
}

/** Crimson 16-bit Pixel Sword Icon for Total Military readout */
export function RedSwordPixelIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" shapeRendering="crispEdges" aria-hidden="true" {...props}>
      <path
        d="M14 2H18V6L11 13L13 15L11 17L9 15L6 18H2V14L5 11L3 9L5 7L7 9L14 2Z"
        fill="#190808"
      />
      <rect x="14" y="3" width="3" height="3" fill="#f87171" />
      <rect x="12" y="5" width="3" height="3" fill="#ef4444" />
      <rect x="10" y="7" width="3" height="3" fill="#dc2626" />
      <rect x="8" y="9" width="3" height="3" fill="#b91c1c" />
      <rect x="15" y="3" width="1" height="2" fill="#fecaca" />
      <rect x="13" y="5" width="1" height="2" fill="#fca5a5" />
      <rect x="5" y="9" width="2" height="2" fill="#fbbf24" />
      <rect x="9" y="13" width="2" height="2" fill="#fbbf24" />
      <rect x="6" y="11" width="3" height="3" fill="#d97706" />
      <rect x="3" y="14" width="3" height="3" fill="#92400e" />
      <rect x="3" y="15" width="2" height="2" fill="#fde047" />
    </svg>
  );
}

/** Steel-Blue 16-bit Pixel Sword Icon for Manpower/Reserve readout */
export function SilverSwordPixelIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" shapeRendering="crispEdges" aria-hidden="true" {...props}>
      <path
        d="M14 2H18V6L11 13L13 15L11 17L9 15L6 18H2V14L5 11L3 9L5 7L7 9L14 2Z"
        fill="#0b1322"
      />
      <rect x="14" y="3" width="3" height="3" fill="#e0f2fe" />
      <rect x="12" y="5" width="3" height="3" fill="#7dd3fc" />
      <rect x="10" y="7" width="3" height="3" fill="#38bdf8" />
      <rect x="8" y="9" width="3" height="3" fill="#0284c7" />
      <rect x="15" y="3" width="1" height="2" fill="#ffffff" />
      <rect x="13" y="5" width="1" height="2" fill="#f0f9ff" />
      <rect x="5" y="9" width="2" height="2" fill="#fbbf24" />
      <rect x="9" y="13" width="2" height="2" fill="#fbbf24" />
      <rect x="6" y="11" width="3" height="3" fill="#b45309" />
      <rect x="3" y="14" width="3" height="3" fill="#78350f" />
      <rect x="3" y="15" width="2" height="2" fill="#fde047" />
    </svg>
  );
}

/** Chunky golden-amber Pause icon for carved wood top button */
export function WoodPauseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" shapeRendering="crispEdges" aria-hidden="true" {...props}>
      <rect x="4" y="3" width="5" height="14" fill="#211208" />
      <rect x="11" y="3" width="5" height="14" fill="#211208" />
      <rect x="5" y="4" width="3" height="12" fill="#f3bd59" />
      <rect x="12" y="4" width="3" height="12" fill="#f3bd59" />
      <rect x="5" y="4" width="3" height="2" fill="#fef08a" />
      <rect x="12" y="4" width="3" height="2" fill="#fef08a" />
    </svg>
  );
}

/** Chunky golden-amber Speaker icon for carved wood top button */
export function WoodSpeakerIcon({
  muted,
  ...props
}: SVGProps<SVGSVGElement> & { muted: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" shapeRendering="crispEdges" aria-hidden="true" {...props}>
      <path d="M2 7H6L11 3V17L6 13H2V7Z" fill="#211208" />
      <rect x="3" y="8" width="3" height="4" fill="#f3bd59" />
      <path d="M6 8L10 4.5V15.5L6 12V8Z" fill="#f3bd59" />
      <rect x="3" y="8" width="3" height="1" fill="#fef08a" />
      {muted ? (
        <>
          <rect x="13" y="7" width="2" height="2" fill="#f87171" />
          <rect x="15" y="9" width="2" height="2" fill="#f87171" />
          <rect x="17" y="11" width="2" height="2" fill="#f87171" />
          <rect x="17" y="7" width="2" height="2" fill="#f87171" />
          <rect x="13" y="11" width="2" height="2" fill="#f87171" />
        </>
      ) : (
        <>
          <rect x="13" y="7" width="2" height="6" fill="#f3bd59" />
          <rect x="16" y="5" width="2" height="10" fill="#fde047" />
        </>
      )}
    </svg>
  );
}

/** Chunky golden-amber Gear icon for carved wood settings/shortcuts button */
export function WoodGearIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" shapeRendering="crispEdges" aria-hidden="true" {...props}>
      <rect x="8" y="2" width="4" height="16" fill="#f3bd59" />
      <rect x="2" y="8" width="16" height="4" fill="#f3bd59" />
      <rect x="4" y="4" width="12" height="12" fill="#f3bd59" />
      <rect x="5" y="5" width="10" height="10" fill="#eab308" />
      <rect x="8" y="2" width="4" height="2" fill="#fef08a" />
      <rect x="7" y="7" width="6" height="6" fill="#2c1a0e" />
      <rect x="8" y="8" width="4" height="4" fill="#3f2718" />
    </svg>
  );
}

/** Chunky golden-amber 3-bar Menu icon for carved wood menu button */
export function WoodMenuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" shapeRendering="crispEdges" aria-hidden="true" {...props}>
      <rect x="3" y="4" width="14" height="3" fill="#211208" />
      <rect x="3" y="9" width="14" height="3" fill="#211208" />
      <rect x="3" y="14" width="14" height="3" fill="#211208" />
      <rect x="4" y="4" width="12" height="2" fill="#f3bd59" />
      <rect x="4" y="9" width="12" height="2" fill="#f3bd59" />
      <rect x="4" y="14" width="12" height="2" fill="#f3bd59" />
      <rect x="4" y="4" width="12" height="1" fill="#fef08a" />
      <rect x="4" y="9" width="12" height="1" fill="#fef08a" />
      <rect x="4" y="14" width="12" height="1" fill="#fef08a" />
    </svg>
  );
}

/**
 * Rich 24x24 16-bit Pixel Building Icons that visually evolve across Lv.0/1 -> Lv.2 -> Lv.3
 * right inside the Bottom Command Dock!
 */
export function TierBuildingIcon({
  type,
  level,
  className = 'w-6 h-6 shrink-0',
}: {
  type: BuildingType;
  level: BuildingLevel;
  className?: string;
}) {
  const isLv2 = level === 2;
  const isLv3 = level >= 3;

  if (type === 'barracks') {
    const roof = isLv3 ? '#fbbf24' : isLv2 ? '#dc2626' : '#ef4444';
    const roofLight = isLv3 ? '#fef08a' : '#fca5a5';
    const wall = isLv3 ? '#e2e8f0' : isLv2 ? '#cbd5e1' : '#d6c6ad';
    return (
      <svg viewBox="0 0 24 24" fill="none" shapeRendering="crispEdges" aria-hidden="true" className={className}>
        {/* Dark silhouette */}
        <path d="M12 2L3 11V21H21V11L12 2Z" fill="#140c07" />
        {/* Roof */}
        <path d="M12 4L5 11H19L12 4Z" fill={roof} />
        <rect x="11" y="5" width="2" height="4" fill={roofLight} />
        {/* Pennant / Lv.3 Golden Crown */}
        {isLv3 ? (
          <>
            <rect x="9" y="1" width="6" height="3" fill="#fde047" />
            <rect x="11" y="0" width="2" height="2" fill="#ffffff" />
          </>
        ) : (
          <rect x="11" y="1" width="4" height="2" fill="#facc15" />
        )}
        {/* Masonry / Tent walls */}
        <rect x="5" y="11" width="14" height="9" fill={wall} />
        <rect x="5" y="11" width="14" height="2" fill={isLv3 ? '#d97706' : '#64748b'} />
        {/* Arch Gate */}
        <rect x="9" y="14" width="6" height="6" fill="#1e120a" />
        <rect x="10" y="15" width="4" height="5" fill="#3b2314" />
        {/* Side torches on Lv.2+ */}
        {(isLv2 || isLv3) && (
          <>
            <rect x="6" y="14" width="2" height="3" fill="#f97316" />
            <rect x="16" y="14" width="2" height="3" fill="#f97316" />
          </>
        )}
      </svg>
    );
  }

  if (type === 'tower') {
    const body = isLv3 ? '#312e4a' : isLv2 ? '#64748b' : '#94a3b8';
    const trim = isLv3 ? '#facc15' : isLv2 ? '#cbd5e1' : '#e2e8f0';
    const gem = isLv3 ? '#38bdf8' : isLv2 ? '#60a5fa' : '#93c5fd';
    return (
      <svg viewBox="0 0 24 24" fill="none" shapeRendering="crispEdges" aria-hidden="true" className={className}>
        <path d="M5 3H19V9L17 11V21H7V11L5 9V3Z" fill="#12141c" />
        {/* Crenellations */}
        <rect x="6" y="4" width="3" height="3" fill={trim} />
        <rect x="10" y="4" width="4" height="3" fill={trim} />
        <rect x="15" y="4" width="3" height="3" fill={trim} />
        {/* Tower body */}
        <rect x="6" y="7" width="12" height="3" fill={body} />
        <rect x="8" y="10" width="8" height="10" fill={body} />
        <rect x="8" y="10" width="2" height="10" fill={trim} opacity="0.45" />
        {/* Arcane crystal core / Shield emblem */}
        <rect x="10" y="12" width="4" height="5" fill={gem} />
        <rect x="11" y="13" width="2" height="2" fill="#ffffff" />
        {/* Lv.3 Floating Arcane Spire Crown */}
        {isLv3 && (
          <>
            <rect x="11" y="1" width="2" height="3" fill="#7dd3fc" />
            <rect x="7" y="10" width="10" height="1" fill="#fde047" />
          </>
        )}
      </svg>
    );
  }

  if (type === 'mine') {
    const rock = isLv3 ? '#d97706' : isLv2 ? '#475569' : '#64748b';
    const shine = isLv3 ? '#fef08a' : '#fbbf24';
    return (
      <svg viewBox="0 0 24 24" fill="none" shapeRendering="crispEdges" aria-hidden="true" className={className}>
        <path d="M2 20L6 8L12 4L18 8L22 20H2Z" fill="#14110e" />
        <path d="M4 19L7 9L12 6L17 9L20 19H4Z" fill={rock} />
        {/* Timber / Gold arch */}
        <rect x="8" y="11" width="8" height="8" fill="#180f09" />
        <rect x="7" y="10" width="10" height="2" fill={isLv3 ? '#fde047' : '#a16207'} />
        {/* Gold ore heap */}
        <rect x="9" y="15" width="6" height="4" fill="#f59e0b" />
        <rect x="10" y="14" width="4" height="3" fill={shine} />
        <rect x="11" y="14" width="2" height="1" fill="#ffffff" />
        {/* Top dome glint on Lv.2+ */}
        {(isLv2 || isLv3) && (
          <>
            <rect x="11" y="4" width="2" height="2" fill="#fde047" />
            <rect x="6" y="13" width="2" height="2" fill="#fbbf24" />
          </>
        )}
      </svg>
    );
  }

  if (type === 'forge') {
    const stone = isLv3 ? '#3b1d1a' : isLv2 ? '#334155' : '#475569';
    const roof = isLv3 ? '#eab308' : '#b45309';
    return (
      <svg viewBox="0 0 24 24" fill="none" shapeRendering="crispEdges" aria-hidden="true" className={className}>
        {/* Chimney + Sparks */}
        <rect x="14" y="2" width="5" height="9" fill="#161412" />
        <rect x="15" y="3" width="3" height="7" fill={isLv3 ? '#f59e0b' : '#64748b'} />
        <rect x="16" y="1" width="2" height="2" fill="#fde047" />
        {/* Smithy body */}
        <rect x="3" y="8" width="18" height="13" fill="#16100c" />
        <rect x="4" y="10" width="16" height="10" fill={stone} />
        <rect x="3" y="8" width="13" height="3" fill={roof} />
        {/* Glowing Molten Furnace Mouth */}
        <rect x="7" y="13" width="8" height="7" fill="#180a06" />
        <rect x="8" y="15" width="6" height="5" fill="#ea580c" />
        <rect x="9" y="16" width="4" height="4" fill="#facc15" />
        <rect x="10" y="17" width="2" height="2" fill="#fffbeb" />
      </svg>
    );
  }

  // Port (Lv.1 pier -> Lv.2 stone harbor -> Lv.3 gilded lighthouse harbor)
  const hull = isLv3 ? '#facc15' : '#9a683a';
  const sail = isLv3 ? '#fef08a' : '#38bdf8';
  return (
    <svg viewBox="0 0 24 24" fill="none" shapeRendering="crispEdges" aria-hidden="true" className={className}>
      {/* Lighthouse tower */}
      <rect x="3" y="3" width="6" height="14" fill="#101827" />
      <rect x="4" y="4" width="4" height="12" fill="#e2e8f0" />
      <rect x="4" y="4" width="4" height="3" fill="#fde047" />
      <rect x="4" y="9" width="4" height="3" fill="#ef4444" />
      {/* Ship sail */}
      <rect x="13" y="5" width="2" height="10" fill="#5c3a1e" />
      <path d="M15 6L21 10L15 13V6Z" fill={sail} />
      {/* Pier & Waves */}
      <rect x="2" y="15" width="20" height="4" fill="#160f08" />
      <rect x="3" y="16" width="18" height="2" fill={hull} />
      <rect x="3" y="19" width="18" height="2" fill="#0284c7" />
      <rect x="5" y="19" width="4" height="1" fill="#7dd3fc" />
      <rect x="14" y="19" width="5" height="1" fill="#7dd3fc" />
    </svg>
  );
}

/** Rich 24x24 16-bit Pixel Commander Power Icons with dark silhouettes & vivid luminance */
export function RichPowerIcon({
  type,
  className = 'w-7 h-7 shrink-0',
}: {
  type: PowerType;
  className?: string;
}) {
  if (type === 'mobilize') {
    return (
      <svg viewBox="0 0 24 24" fill="none" shapeRendering="crispEdges" aria-hidden="true" className={className}>
        {/* Radiant rallying royal crest & heraldic soldier */}
        <path d="M9 2H15V7H19V15H16V21H8V15H5V7H9V2Z" fill="#1c0d07" />
        <rect x="10" y="3" width="4" height="4" fill="#fde047" />
        <rect x="11" y="4" width="2" height="2" fill="#fffbeb" />
        <rect x="8" y="8" width="8" height="7" fill="#ef4444" />
        <rect x="10" y="9" width="4" height="5" fill="#fb7185" />
        <rect x="6" y="9" width="2" height="5" fill="#e2e8f0" />
        <rect x="16" y="9" width="2" height="5" fill="#e2e8f0" />
        <rect x="9" y="15" width="2" height="5" fill="#cbd5e1" />
        <rect x="13" y="15" width="2" height="5" fill="#cbd5e1" />
      </svg>
    );
  }

  if (type === 'blitz') {
    return (
      <svg viewBox="0 0 24 24" fill="none" shapeRendering="crispEdges" aria-hidden="true" className={className}>
        {/* High-energy electric-blue & white lightning bolt */}
        <path d="M13 2H7L4 13H10L8 22L20 9H14L16 2H13Z" fill="#0b1a36" />
        <path d="M13 3H8L6 12H12L10 20L18 10H12.5L14 3H13Z" fill="#38bdf8" />
        <path d="M12 5H9L8 10.5H13L11.5 16L15.5 11H11.5L12 5Z" fill="#e0f2fe" />
        <rect x="11" y="7" width="2" height="4" fill="#ffffff" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" shapeRendering="crispEdges" aria-hidden="true" className={className}>
      {/* Jeweled Royal Sapphire & Gold Kite Shield */}
      <path d="M4 3H20V13L12 21L4 13V3Z" fill="#0d1729" />
      <path d="M5 4H19V12.5L12 19.5L5 12.5V4Z" fill="#eab308" />
      <path d="M7 6H17V12L12 17L7 12V6Z" fill="#2563eb" />
      <path d="M8 7H12V15.5L8 11.5V7Z" fill="#60a5fa" />
      <rect x="11" y="7.5" width="2" height="7" fill="#fef08a" />
      <rect x="8.5" y="10" width="7" height="2" fill="#fef08a" />
    </svg>
  );
}
