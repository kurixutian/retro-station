import React from 'react';
import {
  Home,
  Settings,
  Save,
  FolderOpen,
  Sliders,
  Download,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Rewind,
  FastForward,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Maximize,
  Minimize,
} from 'lucide-react';
import { Game, Theme, PadLayout, PadGroupId } from '../../types';
import { coreRatio, formatGameTitle, EJS_CORES } from '../../constants/cores';
import { DEFAULT_PAD_LAYOUT, PAD_LABELS } from '../../constants/controls';
import { buildPlayerHtml } from '../../services/emulator/playerBridge';
import { haptics } from '../../services/haptics';
import { PadGroup } from '../controls/PadGroup';

interface InGameViewProps {
  activeGame: Game;
  theme: Theme;
  shaders: Record<string, boolean>;
  romUrl: string | null;
  isPaused: boolean;
  setIsPaused: React.Dispatch<React.SetStateAction<boolean>>;
  isRewinding: boolean;
  setIsRewinding: (r: boolean) => void;
  /** 0 = off; 2 / 3 / 4 / 8 = fast-forward multiplier */
  isFastForward: boolean;
  ffSpeed: number;
  setFfSpeed: React.Dispatch<React.SetStateAction<number>>;
  isMuted: boolean;
  toggleAudio: () => void;
  inGameMenuOpen: boolean;
  setInGameMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  topBarVisible: boolean;
  revealTopBar: (duration?: number) => void;
  flushLiveProgress: () => void;
  setCurrentView: (v: string) => void;
  setInGameSaveModalMode: (mode: 'save' | 'load' | null) => void;
  setGlobalSettingsOpen: (o: boolean) => void;
  exportBatterySave: (game: any, format: 'sav' | 'srm') => void;
  showToast: (msg: string) => void;
  emuFrameRef: React.RefObject<HTMLIFrameElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  deckRef: React.RefObject<HTMLDivElement | null>;
  padLayout: PadLayout;
  setPadLayout: React.Dispatch<React.SetStateAction<PadLayout>>;
  customizing: boolean;
  setCustomizing: (c: boolean) => void;
  selectedPad: PadGroupId;
  setSelectedPad: (id: PadGroupId) => void;
  movePad: (id: PadGroupId, x: number, y: number) => void;
  scalePad: (id: PadGroupId, s: number) => void;
  hidePad: boolean;
  setHidePad: (h: boolean) => void;
  bindPadButton: (name: string) => Record<string, any>;
  setButtonDown?: (name: string) => void;
  setButtonUp?: (name: string) => void;
  topBarTimer: React.MutableRefObject<any>;
}

export const InGameView: React.FC<InGameViewProps> = ({
  activeGame,
  theme,
  shaders,
  romUrl,
  isPaused,
  setIsPaused,
  isRewinding,
  setIsRewinding,
  isFastForward,
  ffSpeed,
  setFfSpeed,
  isMuted,
  toggleAudio,
  inGameMenuOpen,
  setInGameMenuOpen,
  topBarVisible,
  revealTopBar,
  flushLiveProgress,
  setCurrentView,
  setInGameSaveModalMode,
  setGlobalSettingsOpen,
  exportBatterySave,
  showToast,
  emuFrameRef,
  canvasRef,
  deckRef,
  padLayout,
  setPadLayout,
  customizing,
  setCustomizing,
  selectedPad,
  setSelectedPad,
  movePad,
  scalePad,
  hidePad,
  setHidePad,
  bindPadButton,
  setButtonDown,
  setButtonUp,
  topBarTimer,
}) => {
  const dpadContainerRef = React.useRef<HTMLDivElement | null>(null);
  const activeDpadPointerId = React.useRef<number | null>(null);
  const activeDpadDirs = React.useRef<Record<string, boolean>>({
    up: false,
    down: false,
    left: false,
    right: false,
  });

  // ── Fullscreen / Landscape mode ──────────────────────────────────────────
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [isLandscape, setIsLandscape] = React.useState(
    () => typeof window !== 'undefined' && (window.innerWidth > window.innerHeight || window.matchMedia('(orientation: landscape)').matches)
  );

  React.useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)');
    const updateOrientation = () => {
      const isLand = (mq && mq.matches) || (window.innerWidth > window.innerHeight);
      setIsLandscape(isLand);
    };
    updateOrientation();
    mq.addEventListener('change', updateOrientation);
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);
    return () => {
      mq.removeEventListener('change', updateOrientation);
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
    };
  }, []);

  React.useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = React.useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        try {
          (screen.orientation as any)?.lock?.('landscape').catch(() => {});
        } catch (e) {}
      }).catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const updateDpadByCoords = React.useCallback((clientX: number, clientY: number) => {
    if (!dpadContainerRef.current || !setButtonDown || !setButtonUp) return;
    const rect = dpadContainerRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const deadzone = 12;
    const nextDirs = {
      up: dist > deadzone && dy < -8 && Math.abs(dy) > Math.abs(dx) * 0.45,
      down: dist > deadzone && dy > 8 && Math.abs(dy) > Math.abs(dx) * 0.45,
      left: dist > deadzone && dx < -8 && Math.abs(dx) > Math.abs(dy) * 0.45,
      right: dist > deadzone && dx > 8 && Math.abs(dx) > Math.abs(dy) * 0.45,
    };

    (['up', 'down', 'left', 'right'] as const).forEach((dir) => {
      if (nextDirs[dir] && !activeDpadDirs.current[dir]) {
        activeDpadDirs.current[dir] = true;
        setButtonDown(dir);
      } else if (!nextDirs[dir] && activeDpadDirs.current[dir]) {
        activeDpadDirs.current[dir] = false;
        setButtonUp(dir);
      }
    });
  }, [setButtonDown, setButtonUp]);

  const releaseDpadAll = React.useCallback(() => {
    activeDpadPointerId.current = null;
    if (!setButtonUp) return;
    (['up', 'down', 'left', 'right'] as const).forEach((dir) => {
      if (activeDpadDirs.current[dir]) {
        activeDpadDirs.current[dir] = false;
        setButtonUp(dir);
      }
    });
  }, [setButtonUp]);

  const renderDpad = () => (
    <div
      ref={dpadContainerRef}
      className="relative w-32 h-32 select-none touch-none"
      style={{ touchAction: 'none', WebkitTouchCallout: 'none' }}
      onPointerDown={(e) => {
        if (customizing) return;
        activeDpadPointerId.current = e.pointerId;
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch (err) {}
        updateDpadByCoords(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (customizing || activeDpadPointerId.current !== e.pointerId) return;
        updateDpadByCoords(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (customizing || activeDpadPointerId.current !== e.pointerId) return;
        try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch (err) {}
        releaseDpadAll();
      }}
      onPointerCancel={() => {
        if (customizing) return;
        releaseDpadAll();
      }}
    >
      {/* Up */}
      <button
        type="button"
        {...bindPadButton('up')}
        className={`absolute top-0 left-10 w-11 h-11 rounded-t-xl border flex items-center justify-center shadow-md touch-none select-none ${theme.dpadBg}`}
        aria-label="Up"
      >
        <ChevronUp className="w-6 h-6" />
      </button>
      {/* Down */}
      <button
        type="button"
        {...bindPadButton('down')}
        className={`absolute bottom-0 left-10 w-11 h-11 rounded-b-xl border flex items-center justify-center shadow-md touch-none select-none ${theme.dpadBg}`}
        aria-label="Down"
      >
        <ChevronDown className="w-6 h-6" />
      </button>
      {/* Left */}
      <button
        type="button"
        {...bindPadButton('left')}
        className={`absolute top-10 left-0 w-11 h-11 rounded-l-xl border flex items-center justify-center shadow-md touch-none select-none ${theme.dpadBg}`}
        aria-label="Left"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      {/* Right */}
      <button
        type="button"
        {...bindPadButton('right')}
        className={`absolute top-10 right-0 w-11 h-11 rounded-r-xl border flex items-center justify-center shadow-md touch-none select-none ${theme.dpadBg}`}
        aria-label="Right"
      >
        <ChevronRight className="w-6 h-6" />
      </button>
      {/* Center Pivot */}
      <div
        className={`absolute top-10 left-10 w-11 h-11 ${
          shaders.amoled ? 'bg-black border-black' : 'bg-zinc-900 border-zinc-800'
        } flex items-center justify-center pointer-events-none`}
      >
        <div className={`w-4 h-4 rounded-full ${shaders.amoled ? 'bg-zinc-900' : 'bg-zinc-800'}`} />
      </div>
    </div>
  );

  const renderActions = () => (
    <div className="relative w-36 h-32 select-none touch-none">
      {/* X (Top) */}
      <button
        type="button"
        {...bindPadButton('actionX')}
        className={`absolute top-0 left-12 w-12 h-12 rounded-full border-2 font-black text-sm shadow-lg flex items-center justify-center transition active:scale-90 touch-none select-none ${theme.btnXY}`}
        aria-label="Button X"
      >
        X
      </button>
      {/* Y (Left) */}
      <button
        type="button"
        {...bindPadButton('actionY')}
        className={`absolute top-10 left-1 w-12 h-12 rounded-full border-2 font-black text-sm shadow-lg flex items-center justify-center transition active:scale-90 touch-none select-none ${theme.btnXY}`}
        aria-label="Button Y"
      >
        Y
      </button>
      {/* B (Bottom) */}
      <button
        type="button"
        {...bindPadButton('actionB')}
        className={`absolute bottom-0 left-12 w-12 h-12 rounded-full border-2 font-black text-base shadow-xl flex items-center justify-center transition active:scale-90 touch-none select-none ${theme.btnB}`}
        aria-label="Button B"
      >
        B
      </button>
      {/* A (Right) */}
      <button
        type="button"
        {...bindPadButton('actionA')}
        className={`absolute top-10 right-1 w-12 h-12 rounded-full border-2 font-black text-base shadow-xl flex items-center justify-center transition active:scale-90 touch-none select-none ${theme.btnA}`}
        aria-label="Button A"
      >
        A
      </button>
    </div>
  );

  const renderSystem = () => (
    <div className="flex items-center justify-center gap-6 pt-1 pb-1 select-none touch-none">
      <button
        type="button"
        {...bindPadButton('select')}
        className="flex flex-col items-center gap-1 group touch-none select-none"
      >
        <div
          className={`w-12 h-3.5 rounded-full ${
            shaders.amoled ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-800 border-zinc-600'
          } group-active:bg-emerald-400 border shadow-inner -rotate-12 transition`}
        />
        <span className="text-[9px] font-black tracking-widest text-zinc-400 uppercase">
          SELECT
        </span>
      </button>

      <button
        type="button"
        {...bindPadButton('start')}
        className="flex flex-col items-center gap-1 group touch-none select-none"
      >
        <div
          className={`w-12 h-3.5 rounded-full ${
            shaders.amoled ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-800 border-zinc-600'
          } group-active:bg-emerald-400 border shadow-inner -rotate-12 transition`}
        />
        <span className="text-[9px] font-black tracking-widest text-zinc-400 uppercase">
          START
        </span>
      </button>
    </div>
  );

  const renderTransport = (compact = false) => (
    <div className={`flex items-center justify-center ${compact ? 'gap-1.5' : 'gap-2 w-[300px] grid grid-cols-3'} select-none touch-none`}>
      {/* Pause Toggle */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          haptics.toggle();
          setIsPaused((p) => {
            const next = !p;
            if (next) {
              revealTopBar(5000);
            } else {
              if (topBarTimer.current) clearTimeout(topBarTimer.current);
            }
            return next;
          });
        }}
        className={`flex items-center justify-center gap-1.5 ${
          compact ? 'py-1 px-2.5 rounded-lg text-xs' : 'py-2 px-2.5 rounded-xl text-xs'
        } font-bold border transition active:scale-95 touch-none select-none ${
          isPaused
            ? 'bg-amber-500 text-zinc-950 border-amber-300 shadow-lg'
            : shaders.amoled
              ? 'bg-black text-zinc-200 border-zinc-800 hover:bg-zinc-900'
              : 'bg-zinc-950/80 text-zinc-200 border-white/10 hover:bg-zinc-900'
        }`}
        title={isPaused ? 'Resume' : 'Pause'}
      >
        {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
        <span>{isPaused ? 'Resume' : 'Pause'}</span>
      </button>

      {/* Hold Rewind */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          haptics.toggle();
          setIsRewinding(true);
        }}
        onPointerUp={() => setIsRewinding(false)}
        onPointerLeave={() => setIsRewinding(false)}
        onPointerCancel={() => setIsRewinding(false)}
        className={`flex items-center justify-center gap-1.5 ${
          compact ? 'py-1 px-2.5 rounded-lg text-xs' : 'py-2 px-2.5 rounded-xl text-xs'
        } font-bold border transition active:scale-95 touch-none select-none ${
          isRewinding
            ? 'bg-amber-400 text-zinc-950 border-amber-200 shadow-lg'
            : shaders.amoled
              ? 'bg-black text-zinc-200 border-zinc-800 hover:bg-zinc-900'
              : 'bg-zinc-950/80 text-zinc-200 border-white/10 hover:bg-zinc-900'
        }`}
        title="Hold to Rewind"
      >
        <Rewind className="w-3.5 h-3.5" />
        <span>Rewind</span>
      </button>

      {/* Fast-Forward Speed Picker: OFF | 2x | 4x | 8x (cycles on tap) */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          haptics.toggle();
          setFfSpeed((s) => {
            if (s === 0) return 2;
            if (s === 2) return 4;
            if (s === 4) return 8;
            return 0;
          });
        }}
        className={`flex items-center justify-center gap-1.5 ${
          compact ? 'py-1 px-2.5 rounded-lg text-xs' : 'py-2 px-2.5 rounded-xl text-xs'
        } font-bold border transition active:scale-95 touch-none select-none ${
          isFastForward
            ? 'bg-sky-400 text-zinc-950 border-sky-200 shadow-lg'
            : shaders.amoled
              ? 'bg-black text-zinc-200 border-zinc-800 hover:bg-zinc-900'
              : 'bg-zinc-950/80 text-zinc-200 border-white/10 hover:bg-zinc-900'
        }`}
        title="Fast Forward (Cycles 1x -> 2x -> 4x -> 8x)"
      >
        <FastForward className="w-3.5 h-3.5" />
        <span>{isFastForward ? `${ffSpeed}x` : '1x'}</span>
      </button>
    </div>
  );

  const renderGameScreen = () => (
    <>
      {activeGame.real ? (
        romUrl ? (
          <iframe
            key={romUrl}
            ref={emuFrameRef}
            title="emulator"
            className="w-full h-full block border-0 pointer-events-none bg-black"
            allow="autoplay; gamepad"
            srcDoc={buildPlayerHtml(EJS_CORES[activeGame.core] || 'gb', romUrl, activeGame.title)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs font-mono text-zinc-400">
            Loading ROM...
          </div>
        )
      ) : (
        <canvas
          ref={canvasRef}
          width={320}
          height={240}
          className="w-full h-full object-fill block"
          style={{ imageRendering: 'pixelated' }}
        />
      )}

      {/* Shader Layer 1: CRT Horizontal Scanlines */}
      {shaders.scanlines && (
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            backgroundImage:
              'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.38) 50%), linear-gradient(90deg, rgba(255,0,0,0.04), rgba(0,255,0,0.02), rgba(0,0,255,0.04))',
            backgroundSize: '100% 4px, 6px 100%'
          }}
        />
      )}

      {/* Shader Layer 2: Game Boy Dot-Matrix LCD Grid Lines */}
      {shaders.gbGrid && (
        <div
          className="absolute inset-0 pointer-events-none z-10 opacity-70"
          style={{
            backgroundImage: shaders.amoled
              ? 'linear-gradient(to right, rgba(0, 0, 0, 0.55) 0.5px, transparent 0.5px), linear-gradient(to bottom, rgba(0, 0, 0, 0.55) 0.5px, transparent 0.5px)'
              : 'linear-gradient(to right, rgba(15, 23, 42, 0.18) 0.5px, transparent 0.5px), linear-gradient(to bottom, rgba(15, 23, 42, 0.18) 0.5px, transparent 0.5px)',
            backgroundSize: '3px 3px'
          }}
        />
      )}

      {/* Shader Layer 3: Bezel Vignette & CRT Corner Shadow */}
      {shaders.bezelVignette && (
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            background:
              'radial-gradient(circle at center, transparent 58%, rgba(0, 0, 0, 0.68) 100%)'
          }}
        />
      )}

      {/* Pause Overlay */}
      {isPaused && (
        <div
          onClick={() => revealTopBar(5000)}
          className="absolute inset-0 z-20 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center gap-2 cursor-pointer select-none"
        >
          <Pause className="w-8 h-8 text-amber-400" />
          <span className="font-mono font-black text-sm tracking-widest text-white">
            EMULATION PAUSED
          </span>
          <span className="text-[10px] text-zinc-400 font-sans tracking-normal">
            Tap screen to show menu • Tap Resume to play
          </span>
        </div>
      )}
    </>
  );

  const renderCustomizer = () => (
    <div className="absolute left-2 right-2 bottom-2 z-40 rounded-2xl bg-zinc-950/95 border border-zinc-700 p-2.5 shadow-2xl space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-bold text-emerald-300">{PAD_LABELS[selectedPad]}</span>
        <span className="text-zinc-400">Drag to move • slider to resize</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min="0.5"
          max="1.8"
          step="0.05"
          value={padLayout[selectedPad]?.s || 1}
          onChange={(e) => scalePad(selectedPad, parseFloat(e.target.value))}
          className="flex-1"
        />
        <button
          onClick={() => setPadLayout(DEFAULT_PAD_LAYOUT)}
          className="px-2.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 text-xs font-bold"
        >
          Reset
        </button>
        <button
          onClick={() => {
            setCustomizing(false);
            showToast('Controls saved');
          }}
          className="px-3 py-1.5 rounded-lg bg-emerald-500 text-zinc-950 text-xs font-black"
        >
          Done
        </button>
      </div>
    </div>
  );

  return (
    <div
      className={`fixed inset-0 w-full overflow-hidden ${shaders.amoled ? 'bg-black' : 'bg-zinc-950'}`}
      style={{ height: '100dvh' }}
    >
      {/* Handheld Shell — portrait: flex-col, landscape: flex-row (game + controls side by side) */}
      <div
        className={`relative w-full h-full ${isLandscape ? '' : 'max-w-[560px]'} mx-auto flex ${
          isLandscape ? 'flex-row' : 'flex-col'
        } overflow-hidden ${
          shaders.amoled ? 'bg-black border-zinc-900' : theme.shellBg
        }`}
        style={
          isLandscape
            ? {
                paddingLeft: 'max(env(safe-area-inset-left, 0px), 6px)',
                paddingRight: 'max(env(safe-area-inset-right, 0px), 6px)',
              }
            : undefined
        }
      >
        {/* Tap zone at top: reveals the auto-hiding top bar */}
        <button
          aria-label="Show top bar"
          onClick={() => revealTopBar()}
          className={`absolute top-0 ${isLandscape ? 'left-1/3 right-1/3' : 'left-0 right-0'} z-30 cursor-pointer`}
          style={{ height: 'max(env(safe-area-inset-top, 0px) + 28px, 44px)' }}
        />
        {/* 1. TOP BAR (auto-hides) */}
        <div
          className={`absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-3.5 pb-2.5 ${
            shaders.amoled
              ? 'bg-black border-b border-zinc-900'
              : 'bg-black/90 backdrop-blur-md border-b border-white/10'
          } transition-all duration-300 shadow-xl ${
            topBarVisible
              ? 'translate-y-0 opacity-100 pointer-events-auto'
              : '-translate-y-full opacity-0 pointer-events-none'
          }`}
          style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 14px)' }}
          onClick={() => revealTopBar()}
        >
          <button
            onClick={() => {
              flushLiveProgress();
              setInGameMenuOpen(false);
              setCurrentView('home');
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border border-white/10 text-xs font-bold transition active:scale-95"
          >
            <Home className="w-3.5 h-3.5 text-emerald-400" />
            <span>Library</span>
          </button>

          <div className="flex flex-col items-center text-center truncate px-2">
            <span className="text-xs font-extrabold text-zinc-100 truncate max-w-[180px]">
              {formatGameTitle(activeGame.title)}
            </span>
          </div>

          {/* Top Settings Gear Button + Fullscreen Toggle */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl border text-xs font-bold transition active:scale-95 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-100 border-white/10"
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setInGameMenuOpen((o) => !o)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition active:scale-95 ${
                inGameMenuOpen
                  ? theme.accentBg
                  : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-100 border-white/10'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Menu</span>
            </button>
          </div>
        </div>

        {/* DROPDOWN DRAWER FROM TOP SETTINGS BUTTON */}
        {inGameMenuOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            style={{
              paddingTop: 'max(env(safe-area-inset-top, 0px) + 20px, 36px)',
              paddingBottom: 'max(env(safe-area-inset-bottom, 0px) + 20px, 36px)'
            }}
            onClick={() => setInGameMenuOpen(false)}
          >
            <div
              className="w-full max-w-sm max-h-[85vh] overflow-y-auto bg-zinc-950 border border-zinc-700 rounded-2xl shadow-2xl p-4 space-y-2.5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-300">
                  MENU
                </span>
                <button
                  onClick={() => setInGameMenuOpen(false)}
                  className="p-1 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Save State Button */}
                <button
                  onClick={() => {
                    setInGameMenuOpen(false);
                    setInGameSaveModalMode('save');
                  }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition"
                >
                  <Save className="w-4 h-4" />
                  <span>Save State Slots</span>
                </button>

                {/* Load State Button */}
                <button
                  onClick={() => {
                    setInGameMenuOpen(false);
                    setInGameSaveModalMode('load');
                  }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-bold transition"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Load State Slots</span>
                </button>

                <button
                  onClick={() => {
                    setInGameMenuOpen(false);
                    setHidePad(false);
                    setCustomizing(true);
                    setSelectedPad('dpad');
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-semibold transition"
                >
                  <Sliders className="w-4 h-4 text-sky-400" />
                  <span>Customize Controls</span>
                </button>

                {/* CRT & Game Boy LCD Grid Shader Settings */}
                <button
                  onClick={() => {
                    setInGameMenuOpen(false);
                    setGlobalSettingsOpen(true);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-semibold transition"
                >
                  <Sliders className="w-4 h-4 text-purple-400" />
                  <span>Shaders & Theme</span>
                </button>
              </div>

              {/* Cartridge Battery Save (.SAV / .SRM) Export */}
              <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-zinc-400">
                  <span className="font-bold uppercase tracking-wider text-amber-300/90">
                    Export Battery Save (.sav / .srm)
                  </span>
                  <span className="text-emerald-400">Auto-Saved Offline</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => exportBatterySave(activeGame, 'sav')}
                    className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-[11px] font-bold transition"
                    title="Download .sav for physical cartridge flashers (GB Operator / FlashGBX)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export .SAV</span>
                  </button>
                  <button
                    onClick={() => exportBatterySave(activeGame, 'srm')}
                    className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-[11px] font-semibold transition"
                    title="Download .srm for RetroArch"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>Export .SRM</span>
                  </button>
                </div>
              </div>

              {/* Audio Toggle Row */}
              <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80 text-xs">
                <div className="flex items-center gap-1.5 text-zinc-300 font-bold">
                  {isMuted ? (
                    <VolumeX className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>Game Audio</span>
                </div>
                <button
                  onClick={toggleAudio}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition active:scale-95 ${
                    isMuted
                      ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 hover:bg-rose-500/25'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  <span>{isMuted ? 'Muted' : 'Audio On'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. GAME VIEWPORT CONTAINER (Stable DOM element across orientations) */}
        <div
          key="game-screen-area"
          className={`${isLandscape ? 'flex-1 min-w-0 h-full' : 'flex-none w-full'} p-2 flex flex-col items-center justify-center relative ${
            shaders.amoled ? 'bg-black' : theme.bezelBg
          }`}
          style={{
            order: 0,
            paddingTop: isLandscape ? '8px' : 'max(env(safe-area-inset-top, 0px), 24px)',
          }}
        >
          {/* Floating Compact Transport Bar (Landscape only) */}
          {isLandscape && (
            <div className="absolute top-2 z-20 flex items-center justify-center pointer-events-auto">
              <div className="bg-black/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-xl">
                {renderTransport(true)}
              </div>
            </div>
          )}

          <div
            className={`relative bg-black overflow-hidden border-2 ${
              shaders.amoled ? 'border-zinc-900 shadow-none' : 'border-zinc-800 shadow-inner'
            } ${
              shaders.crtCurve ? 'rounded-2xl scale-[0.99]' : 'rounded-lg'
            }`}
            style={{
              aspectRatio: String(coreRatio(activeGame.core)),
              maxWidth: '100%',
              maxHeight: isLandscape ? 'calc(100dvh - 16px)' : undefined,
              width: isLandscape ? 'auto' : `min(100%, ${(48 * coreRatio(activeGame.core)).toFixed(2)}dvh)`,
              height: isLandscape ? 'calc(100dvh - 16px)' : undefined,
              boxShadow: !shaders.amoled && shaders.rgbBloom
                ? `0 0 28px ${theme.hex}33, inset 0 0 18px rgba(0,0,0,0.75)`
                : 'none',
              filter: !shaders.amoled && shaders.rgbBloom
                ? 'contrast(1.08) saturate(1.18) brightness(1.04)'
                : 'none'
            }}
          >
            {renderGameScreen()}
          </div>

          {/* In landscape mode, if customizing controls: show scaling panel */}
          {isLandscape && customizing && renderCustomizer()}
        </div>

        {/* 3. LANDSCAPE CONTROLS: LEFT FLANK & RIGHT FLANK */}
        {isLandscape && (!hidePad || customizing) && (
          <>
            {/* Left Flank (order: -1 -> placed visually on the LEFT) */}
            <div
              className={`flex-none w-[160px] sm:w-[180px] md:w-[200px] h-full flex flex-col justify-between items-center py-3 px-2 select-none touch-none z-20 ${
                shaders.amoled ? 'bg-black border-r border-zinc-900' : `${theme.deckBg} border-r border-white/5`
              }`}
              style={{
                order: -1,
                touchAction: 'none',
                WebkitTouchCallout: 'none',
                userSelect: 'none',
              }}
            >
              {/* L Shoulder Button */}
              <div className="w-full flex justify-start pl-1">
                <button
                  type="button"
                  {...bindPadButton('btnL')}
                  className={`w-20 h-10 rounded-xl font-black text-xs border-2 shadow-lg flex items-center justify-center transition active:scale-90 touch-none select-none ${
                    shaders.amoled
                      ? 'bg-zinc-900 text-zinc-100 border-zinc-700 active:bg-zinc-800'
                      : 'bg-zinc-800/90 text-zinc-100 border-white/20 active:bg-zinc-700'
                  }`}
                  aria-label="L Shoulder"
                >
                  L
                </button>
              </div>

              {/* D-Pad */}
              <div
                className="my-auto select-none touch-none"
                style={{ transform: `scale(${padLayout.dpad.s})` }}
              >
                {renderDpad()}
              </div>

              {/* SELECT Button */}
              <div className="pb-1">
                <button
                  type="button"
                  {...bindPadButton('select')}
                  className="flex flex-col items-center gap-1 group touch-none select-none"
                >
                  <div
                    className={`w-12 h-3.5 rounded-full ${
                      shaders.amoled ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-800 border-zinc-600'
                    } group-active:bg-emerald-400 border shadow-inner -rotate-12 transition`}
                  />
                  <span className="text-[9px] font-black tracking-widest text-zinc-400 uppercase">
                    SELECT
                  </span>
                </button>
              </div>
            </div>

            {/* Right Flank (order: 1 -> placed visually on the RIGHT) */}
            <div
              className={`flex-none w-[160px] sm:w-[180px] md:w-[200px] h-full flex flex-col justify-between items-center py-3 px-2 select-none touch-none z-20 ${
                shaders.amoled ? 'bg-black border-l border-zinc-900' : `${theme.deckBg} border-l border-white/5`
              }`}
              style={{
                order: 1,
                touchAction: 'none',
                WebkitTouchCallout: 'none',
                userSelect: 'none',
              }}
            >
              {/* R Shoulder Button */}
              <div className="w-full flex justify-end pr-1">
                <button
                  type="button"
                  {...bindPadButton('btnR')}
                  className={`w-20 h-10 rounded-xl font-black text-xs border-2 shadow-lg flex items-center justify-center transition active:scale-90 touch-none select-none ${
                    shaders.amoled
                      ? 'bg-zinc-900 text-zinc-100 border-zinc-700 active:bg-zinc-800'
                      : 'bg-zinc-800/90 text-zinc-100 border-white/20 active:bg-zinc-700'
                  }`}
                  aria-label="R Shoulder"
                >
                  R
                </button>
              </div>

              {/* Action Buttons (A, B, X, Y) */}
              <div
                className="my-auto select-none touch-none"
                style={{ transform: `scale(${padLayout.actions.s})` }}
              >
                {renderActions()}
              </div>

              {/* START Button */}
              <div className="pb-1">
                <button
                  type="button"
                  {...bindPadButton('start')}
                  className="flex flex-col items-center gap-1 group touch-none select-none"
                >
                  <div
                    className={`w-12 h-3.5 rounded-full ${
                      shaders.amoled ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-800 border-zinc-600'
                    } group-active:bg-emerald-400 border shadow-inner -rotate-12 transition`}
                  />
                  <span className="text-[9px] font-black tracking-widest text-zinc-400 uppercase">
                    START
                  </span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* 4. PORTRAIT CONTROLS: BOTTOM CONTROL DECK */}
        {!isLandscape && (
          <div
            ref={deckRef}
            className={`relative flex-1 min-h-0 border-t ${
              shaders.amoled ? 'bg-black border-zinc-900' : theme.deckBg
            } overflow-hidden select-none touch-none`}
            style={{
              order: 1,
              paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 14px)',
              touchAction: 'none',
              WebkitTouchCallout: 'none',
              userSelect: 'none',
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* L & R Shoulder Buttons in Portrait */}
            {(!hidePad || customizing) && (
              <div className="absolute top-2.5 left-4 right-4 z-20 flex justify-between pointer-events-none">
                <button
                  type="button"
                  {...bindPadButton('btnL')}
                  className={`w-14 h-8 rounded-xl font-black text-xs border shadow-md pointer-events-auto flex items-center justify-center transition active:scale-90 touch-none select-none ${
                    shaders.amoled
                      ? 'bg-zinc-900 text-zinc-200 border-zinc-800'
                      : 'bg-zinc-800/90 text-zinc-100 border-white/10'
                  }`}
                  aria-label="L Shoulder"
                >
                  L
                </button>
                <button
                  type="button"
                  {...bindPadButton('btnR')}
                  className={`w-14 h-8 rounded-xl font-black text-xs border shadow-md pointer-events-auto flex items-center justify-center transition active:scale-90 touch-none select-none ${
                    shaders.amoled
                      ? 'bg-zinc-900 text-zinc-200 border-zinc-800'
                      : 'bg-zinc-800/90 text-zinc-100 border-white/10'
                  }`}
                  aria-label="R Shoulder"
                >
                  R
                </button>
              </div>
            )}

            <PadGroup
              id="transport"
              layout={padLayout}
              customizing={customizing}
              selected={customizing && selectedPad === 'transport'}
              onSelect={setSelectedPad}
              onMove={movePad}
              deckRef={deckRef}
            >
              {renderTransport(false)}
            </PadGroup>

            {(!hidePad || customizing) && (
              <PadGroup
                id="dpad"
                layout={padLayout}
                customizing={customizing}
                selected={customizing && selectedPad === 'dpad'}
                onSelect={setSelectedPad}
                onMove={movePad}
                deckRef={deckRef}
              >
                {renderDpad()}
              </PadGroup>
            )}

            {(!hidePad || customizing) && (
              <PadGroup
                id="actions"
                layout={padLayout}
                customizing={customizing}
                selected={customizing && selectedPad === 'actions'}
                onSelect={setSelectedPad}
                onMove={movePad}
                deckRef={deckRef}
              >
                {renderActions()}
              </PadGroup>
            )}

            {(!hidePad || customizing) && (
              <PadGroup
                id="system"
                layout={padLayout}
                customizing={customizing}
                selected={customizing && selectedPad === 'system'}
                onSelect={setSelectedPad}
                onMove={movePad}
                deckRef={deckRef}
              >
                {renderSystem()}
              </PadGroup>
            )}

            {customizing && renderCustomizer()}
          </div>
        )}
      </div>
    </div>
  );
};
