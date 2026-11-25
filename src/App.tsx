import { CommandSidebar } from './components/CommandSidebar';
import { MobileCommandBar } from './components/MobileCommandBar';
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

  return (
    <div className="w-screen h-dvh overflow-hidden flex flex-col bg-[#0c1626] text-[#ede7d9] select-none">
      {/* Top Perimeter Bar (visible during active/paused/gameover play, hidden on Title) */}
      {game.hud.phase !== 'title' && (
        <TopHudBar
          hud={game.hud}
          compact={viewport.isCompact}
          muted={game.muted}
          gameSpeed={game.gameSpeed}
          onCycleSpeed={game.handleCycleSpeed}
          onOpenShortcuts={() => game.setShortcutsOpen(true)}
          onNewMap={game.handleNewMapInGame}
          onToggleMute={game.handleToggleMute}
          onTogglePause={game.handleTogglePause}
        />
      )}

      {/* Main Game Workspace: Desktop Sidebar OR Unobstructed Mobile Canvas + Bottom Quick Bar */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {game.hud.phase !== 'title' && !viewport.isCompact && (
          <CommandSidebar
            hud={game.hud}
            onChangeSendRatio={game.handleChangeSendRatio}
            onBuild={game.handleBuild}
            onTriggerPower={game.handleTriggerPower}
            onRally={game.handleRallySelected}
            onOpenShortcuts={() => game.setShortcutsOpen(true)}
            onNewMap={game.handleNewMapInGame}
          />
        )}

        {/* Map Canvas Container — 100% unobstructed by any floating panels */}
        <div
          className="relative flex-1 min-w-0 min-h-0 bg-[#0c1626]"
          data-testid="map-stage"
          data-seed={game.hud.mapSeed}
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

          {/* Non-intrusive tactical feedback toast */}
          {game.toast && game.hud.phase === 'playing' && (
            <div
              role="status"
              aria-live="polite"
              className={`pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 px-3.5 py-1.5 border text-xs font-bold shadow-[0_10px_28px_rgba(0,0,0,0.65)] whitespace-nowrap ${
                game.toast.tone === 'error'
                  ? 'bg-[#7f1d1d]/95 border-[#f87171]/60 text-[#fef2f2]'
                  : 'bg-[#15243b]/95 border-[#d6b472]/50 text-[#f6efe0]'
              }`}
            >
              {game.toast.text}
            </div>
          )}
        </div>
      </div>

      {/* Compact Mobile Bottom Quick-Action Bar (no drawer!) */}
      {game.hud.phase !== 'title' && viewport.isCompact && (
        <MobileCommandBar
          hud={game.hud}
          onCycleSendRatio={game.handleCycleSendRatio}
          onBuild={game.handleBuild}
          onTriggerPower={game.handleTriggerPower}
          onRally={game.handleRallySelected}
        />
      )}

      {/* Title Screen Overlay */}
      {game.hud.phase === 'title' && (
        <TitleOverlay
          difficulty={game.hud.difficulty}
          isShortLandscape={viewport.isShortLandscape}
          onSelectDifficulty={game.handleSelectDifficulty}
          onStart={game.handleStartFromTitle}
          onPreviewNewMap={game.handlePreviewNewMap}
        />
      )}

      {/* Portrait Mobile Orientation Prompt */}
      {showRotatePrompt && (
        <RotatePhoneOverlay onContinuePortrait={() => game.setPortraitDismissed(true)} />
      )}

      {/* Keyboard & Gesture Shortcuts Guide Modal */}
      <ShortcutsModal
        open={game.shortcutsOpen}
        onClose={() => game.setShortcutsOpen(false)}
      />

      {/* Pause / Victory / Defeat Modal */}
      <StatusModal
        phase={game.hud.phase}
        outcome={game.hud.outcome}
        stats={game.hud.stats}
        playerTerritories={game.hud.playerTerritories}
        totalTerritories={game.hud.totalTerritories}
        onResume={game.handleTogglePause}
        onRestartNewMap={game.handleNewMapInGame}
        onReturnTitle={game.handleReturnTitle}
      />
    </div>
  );
}
