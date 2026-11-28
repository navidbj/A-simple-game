import { useCallback } from 'react';
import { BattleLogPanel } from './components/BattleLogPanel';
import { BottomCommandDock } from './components/BottomCommandDock';
import { CommanderPowersRail } from './components/CommanderPowersRail';
import { JungleEdgeSilhouette } from './components/HudOrnaments';
import { RotatePhoneOverlay } from './components/RotatePhoneOverlay';
import { ShortcutsModal } from './components/ShortcutsModal';
import { StatusModal } from './components/StatusModal';
import { TitleOverlay } from './components/TitleOverlay';
import { TopHudBar } from './components/TopHudBar';
import { useGameController } from './hooks/useGameController';
import { useViewportMode } from './hooks/useViewportMode';

export default function App() {
  const viewport = useViewportMode();
  const game = useGameController();
  const showRotatePrompt = viewport.isPortraitPhone && !game.portraitDismissed;
  const { setShortcutsOpen, setPortraitDismissed } = game;
  const handleOpenShortcuts = useCallback(() => setShortcutsOpen(true), [setShortcutsOpen]);
  const handleCloseShortcuts = useCallback(() => setShortcutsOpen(false), [setShortcutsOpen]);
  const handleDismissPortrait = useCallback(() => setPortraitDismissed(true), [setPortraitDismissed]);

  return (
    <div className="relative w-screen h-dvh overflow-hidden flex flex-col bg-[#0a1a30] text-[#ede7d9] select-none">
      {/* Subtle Desktop Jungle-Canopy & Wooden Table Edge Framing (pure visual perimeter, pointer-events-none) */}
      {game.hud.phase !== 'title' && !viewport.isCompact && (
        <>
          <div
            aria-hidden="true"
            className="hidden xl:flex pointer-events-none fixed inset-y-0 left-0 z-10 items-stretch"
          >
            <JungleEdgeSilhouette side="left" className="w-11 h-full opacity-95" />
            <div className="hud-side-rail w-2.5 h-full" />
          </div>
          <div
            aria-hidden="true"
            className="hidden xl:flex pointer-events-none fixed inset-y-0 right-0 z-10 items-stretch"
          >
            <div className="hud-side-rail w-2.5 h-full" />
            <JungleEdgeSilhouette side="right" className="w-11 h-full opacity-95" />
          </div>
        </>
      )}

      {/* Top Carved-Stone & Gold Perimeter HUD (hidden on Title) */}
      {game.hud.phase !== 'title' && (
        <TopHudBar
          hud={game.hud}
          compact={viewport.isCompact}
          muted={game.muted}
          musicMuted={game.musicMuted}
          masterVolume={game.masterVolume}
          zoomLevel={game.zoomLevel}
          battleLogOpen={game.battleLogOpen}
          gameSpeed={game.gameSpeed}
          onCycleSpeed={game.handleCycleSpeed}
          onOpenShortcuts={handleOpenShortcuts}
          onNewMap={game.handleNewMapInGame}
          onToggleMusic={game.handleToggleMusic}
          onToggleMute={game.handleToggleMute}
          onChangeVolume={game.handleChangeVolume}
          onZoomIn={game.handleZoomIn}
          onZoomOut={game.handleZoomOut}
          onResetZoom={game.handleResetZoom}
          onTogglePause={game.handleTogglePause}
          onToggleBattleLog={game.handleToggleBattleLog}
        />
      )}

      {/* Full-Width Unobstructed Ocean & Voronoi Continent Arena */}
      <div
        className={`relative flex-1 min-w-0 min-h-0 bg-[#0a1a30] ${
          game.hud.phase !== 'title' && !viewport.isCompact ? 'xl:px-[52px]' : ''
        }`}
        data-testid="map-stage"
        data-seed={game.hud.mapSeed}
        data-preset={game.hud.mapPreset}
        data-speed={game.gameSpeed}
        data-player-territories={game.hud.playerTerritories}
        data-selected-id={game.hud.selectedId ?? ''}
      >
        <canvas
          ref={game.canvasRef}
          data-testid="game-canvas"
          onPointerDown={game.handleCanvasPointerDown}
          onPointerMove={game.handleCanvasPointerMove}
          onPointerUp={game.handleCanvasPointerUp}
          onPointerCancel={game.handleCanvasPointerCancel}
          onPointerLeave={game.handleCanvasPointerLeave}
          onContextMenu={game.handleCanvasContextMenu}
          onWheel={game.handleCanvasWheel}
          className="w-full h-full block cursor-pointer touch-none"
        />

        {/* Slim Carved-Stone Vertical Commander Abilities Rail (left frame / open sea corner, zero map obstruction) */}
        {game.hud.phase !== 'title' && (
          <CommanderPowersRail
            hud={game.hud}
            compact={viewport.isCompact}
            onTriggerPower={game.handleTriggerPower}
          />
        )}

        {/* Collapsible Carved-Wood Battle Log Panel */}
        {game.hud.phase !== 'title' && (
          <BattleLogPanel
            entries={game.battleLog}
            open={game.battleLogOpen}
            compact={viewport.isCompact}
            onToggle={game.handleToggleBattleLog}
          />
        )}

        {/* Non-intrusive Tactical Feedback Toast in Carved Wood & Gold */}
        {game.toast && game.hud.phase === 'playing' && (
          <div
            role="status"
            aria-live="polite"
            className={`pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 border-2 text-xs font-extrabold shadow-[0_10px_24px_rgba(0,0,0,0.72)] whitespace-nowrap ${
              game.toast.tone === 'error'
                ? 'bg-[#6b1414] border-[#f87171] text-[#fef2f2]'
                : 'bg-[#3b2517] border-[#eab308] text-[#fef3c7]'
            }`}
          >
            {game.toast.text}
          </div>
        )}
      </div>

      {/* Unified Mossy-Stone & Aged-Oak Bottom Command Dock (Desktop + Mobile) */}
      {game.hud.phase !== 'title' && (
        <BottomCommandDock
          hud={game.hud}
          compact={viewport.isCompact}
          supplyMode={game.supplyMode}
          onChangeSendRatio={game.handleChangeSendRatio}
          onCycleSendRatio={game.handleCycleSendRatio}
          onCycleCastle={game.handleCycleCastle}
          onQuickAttack={game.handleQuickAttackSpace}
          onBuild={game.handleBuild}
          onRally={game.handleRallySelected}
          onToggleSupply={game.handleToggleSupplyMode}
        />
      )}

      {/* Title Screen Overlay */}
      {game.hud.phase === 'title' && (
        <TitleOverlay
          difficulty={game.hud.difficulty}
          mapPreset={game.hud.mapPreset}
          isShortLandscape={viewport.isShortLandscape}
          onSelectDifficulty={game.handleSelectDifficulty}
          onSelectMapPreset={game.handleSelectMapPreset}
          onStart={game.handleStartFromTitle}
          onPreviewNewMap={game.handlePreviewNewMap}
        />
      )}

      {/* Portrait Mobile Orientation Prompt */}
      {showRotatePrompt && (
        <RotatePhoneOverlay onContinuePortrait={handleDismissPortrait} />
      )}

      {/* Keyboard & Gesture Shortcuts Guide Modal */}
      <ShortcutsModal
        open={game.shortcutsOpen}
        onClose={handleCloseShortcuts}
      />

      {/* Pause / Victory / Defeat Modal */}
      <StatusModal
        phase={game.hud.phase}
        outcome={game.hud.outcome}
        stats={game.hud.stats}
        playerTerritories={game.hud.playerTerritories}
        totalTerritories={game.hud.totalTerritories}
        timelapse={game.timelapseData}
        onResume={game.handleTogglePause}
        onRestartNewMap={game.handleNewMapInGame}
        onReturnTitle={game.handleReturnTitle}
      />
    </div>
  );
}
