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
  RefreshCw,
  Gamepad2,
  GripHorizontal,
  GripVertical,
  Layers,
  Pencil,
  Check,
  Tv,
  Sun,
  Moon,
} from 'lucide-react';
import { Game, Theme, PadLayout, PadGroupId, SaveSlot } from '../../types';
import { coreRatio, formatGameTitle, EJS_CORES } from '../../constants/cores';
import {
  DEFAULT_PAD_LAYOUT,
  DEFAULT_LANDSCAPE_PAD_LAYOUT,
  PAD_LABELS,
  LayoutSlot,
  getLayoutNames,
  setLayoutName,
} from '../../constants/controls';
import { getComputedGameFilter } from '../../constants/shaders';
import { buildPlayerHtml } from '../../services/emulator/playerBridge';
import { haptics } from '../../services/haptics';
import { PadGroup, SnapGuide } from '../controls/PadGroup';

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
  onReturnHome?: () => void;
  setInGameSaveModalMode: (mode: 'save' | 'load' | null) => void;
  setGlobalSettingsOpen: (o: boolean) => void;
  exportBatterySave: (game: any, format: 'sav' | 'srm') => void;
  showToast: (msg: string) => void;
  emuFrameRef: React.RefObject<HTMLIFrameElement | null>;
  deckRef: React.RefObject<HTMLDivElement | null>;
  slotPortrait: LayoutSlot;
  setSlotPortrait: (slot: LayoutSlot) => void;
  slotLandscape: LayoutSlot;
  setSlotLandscape: (slot: LayoutSlot) => void;
  padLayoutPortrait: PadLayout;
  setPadLayoutPortrait: React.Dispatch<React.SetStateAction<PadLayout>>;
  padLayoutLandscape: PadLayout;
  setPadLayoutLandscape: React.Dispatch<React.SetStateAction<PadLayout>>;
  customizing: boolean;
  setCustomizing: (c: boolean) => void;
  selectedPad: PadGroupId;
  setSelectedPad: (id: PadGroupId) => void;
  hidePad: boolean;
  setHidePad: (h: boolean) => void;
  bindPadButton: (name: string) => Record<string, any>;
  setButtonDown?: (name: string) => void;
  setButtonUp?: (name: string) => void;
  topBarTimer: React.MutableRefObject<any>;
  fps?: number;
  launchGame?: (game: Game) => void;
  systemKey?: string;
  onOpenControls?: () => void;
  toggleShader?: (key: string) => void;
  setColorProfile?: (profile: string) => void;
  savesByGameId?: Record<string, SaveSlot[]>;
  onToggleLightDark?: () => void;
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
  onReturnHome,
  setInGameSaveModalMode,
  setGlobalSettingsOpen,
  exportBatterySave,
  showToast,
  emuFrameRef,
  deckRef,
  slotPortrait,
  setSlotPortrait,
  slotLandscape,
  setSlotLandscape,
  padLayoutPortrait,
  setPadLayoutPortrait,
  padLayoutLandscape,
  setPadLayoutLandscape,
  customizing,
  setCustomizing,
  selectedPad,
  setSelectedPad,
  hidePad,
  setHidePad,
  bindPadButton,
  setButtonDown,
  setButtonUp,
  topBarTimer,
  fps,
  launchGame,
  systemKey,
  onOpenControls,
  toggleShader,
  setColorProfile,
  savesByGameId,
  onToggleLightDark,
}) => {
  const dpadContainerRef = React.useRef<HTMLDivElement | null>(null);
  const dpadRectRef = React.useRef<DOMRect | null>(null);
  const dpadArmRefs = React.useRef<Record<'up' | 'down' | 'left' | 'right', HTMLElement | null>>({
    up: null,
    down: null,
    left: null,
    right: null,
  });
  const landscapeDeckRef = React.useRef<HTMLDivElement | null>(null);
  const activeDpadPointerId = React.useRef<number | null>(null);
  const activeDpadMaskRef = React.useRef<number>(0);
  const activeDpadDirs = React.useRef<Record<string, boolean>>({
    up: false,
    down: false,
    left: false,
    right: false,
  });

  const touchStartYRef = React.useRef<number | null>(null);
  const [isPoweringOff, setIsPoweringOff] = React.useState(false);
  const [showCartridgeTools, setShowCartridgeTools] = React.useState(false);
  const [saveFormat, setSaveFormat] = React.useState<'sav' | 'srm'>('sav');

  const triggerExitWithCeremony = React.useCallback(() => {
    setInGameMenuOpen(false);
    setIsPoweringOff(true);
    showToast('Progress auto-saved • Safe to resume anytime');
    setTimeout(() => {
      if (onReturnHome) {
        onReturnHome();
      } else {
        flushLiveProgress();
        setCurrentView('home');
      }
    }, 260);
  }, [onReturnHome, flushLiveProgress, setCurrentView, setInGameMenuOpen, showToast]);

  const latestSaveSlot = React.useMemo(() => {
    const slots = (savesByGameId && activeGame?.id ? savesByGameId[activeGame.id] : []) || [];
    return slots.find((s) => !s.empty && s.timestamp) || slots.find((s) => !s.empty) || null;
  }, [savesByGameId, activeGame?.id]);

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

  // ── Orientation-specific Pad Layout & Controls ────────────────────────────
  const activeSlot = isLandscape ? slotLandscape : slotPortrait;
  const setActiveSlotHandler = isLandscape ? setSlotLandscape : setSlotPortrait;
  const padLayout = isLandscape ? padLayoutLandscape : padLayoutPortrait;
  const setPadLayout = isLandscape ? setPadLayoutLandscape : setPadLayoutPortrait;

  // ── Auto-fit: shrink pads proportionally on small decks so they never clip ─
  const [deckBox, setDeckBox] = React.useState({ w: 0, h: 0 });
  React.useEffect(() => {
    const el = (isLandscape ? landscapeDeckRef : deckRef).current;
    if (!el) { setDeckBox({ w: 0, h: 0 }); return; }
    const update = () => setDeckBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLandscape, hidePad, customizing, showCartridgeTools]);

  const padFitScale = React.useMemo(() => {
    if (!deckBox.w || !deckBox.h) return 1;
    return Math.max(0.55, Math.min(1, Math.min(deckBox.w / 440, deckBox.h / 540)));
  }, [deckBox]);

  const scaledPadLayout = React.useMemo(() => {
    if (padFitScale === 1) return padLayout;
    const out = { ...padLayout } as PadLayout;
    (Object.keys(out) as PadGroupId[]).forEach((k) => {
      out[k] = { ...out[k], s: (out[k].s || 1) * padFitScale };
    });
    return out;
  }, [padLayout, padFitScale]);

  const movePad = React.useCallback(
    (id: PadGroupId, x: number, y: number) => {
      setPadLayout((l) => ({ ...l, [id]: { ...l[id], x, y } }));
    },
    [setPadLayout]
  );

  const scalePad = React.useCallback(
    (id: PadGroupId, s: number) => {
      setPadLayout((l) => ({ ...l, [id]: { ...l[id], s } }));
    },
    [setPadLayout]
  );

  const safeBindPadButton = React.useCallback(
    (name: string) => {
      if (customizing) {
        return {
          onPointerDown: (e: React.SyntheticEvent) => {
            e.preventDefault();
            e.stopPropagation();
          },
          onPointerUp: (e: React.SyntheticEvent) => {
            e.preventDefault();
            e.stopPropagation();
          },
          onPointerCancel: (e: React.SyntheticEvent) => {
            e.preventDefault();
            e.stopPropagation();
          },
          onTouchStart: (e: React.SyntheticEvent) => {
            e.preventDefault();
            e.stopPropagation();
          },
          onTouchEnd: (e: React.SyntheticEvent) => {
            e.preventDefault();
            e.stopPropagation();
          },
          onTouchCancel: (e: React.SyntheticEvent) => {
            e.preventDefault();
            e.stopPropagation();
          },
          onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
        };
      }
      return bindPadButton(name);
    },
    [customizing, bindPadButton]
  );

  React.useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  React.useEffect(() => {
    return () => {
      try {
        const frame = emuFrameRef.current;
        const win = frame?.contentWindow as any;
        if (win) {
          if (typeof win.destroyEmulator === 'function') {
            win.destroyEmulator();
          } else if (win.EJS_emulator?.gameManager?.toggleMainLoop) {
            win.EJS_emulator.gameManager.toggleMainLoop(0);
          }
          if (typeof win.setAudioMuted === 'function') win.setAudioMuted(true);
        }
        if (frame) {
          frame.src = 'about:blank';
        }
      } catch (e) {}
    };
  }, [romUrl, emuFrameRef]);

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

  // ── Draggable customizer state ───────────────────────────────────────────
  const [customizerPos, setCustomizerPos] = React.useState<{ x: number; y: number } | null>(null);
  const customizerRef = React.useRef<HTMLDivElement | null>(null);
  const isDraggingCustomizer = React.useRef(false);
  const dragStartOffset = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleCustomizerDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = customizerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragStartOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    isDraggingCustomizer.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}
    setCustomizerPos({ x: rect.left, y: rect.top });
  };

  const handleCustomizerDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingCustomizer.current) return;
    const el = customizerRef.current;
    const width = el ? el.offsetWidth : 320;
    const height = el ? el.offsetHeight : 120;
    const newX = Math.max(8, Math.min(window.innerWidth - width - 8, e.clientX - dragStartOffset.current.x));
    const newY = Math.max(8, Math.min(window.innerHeight - height - 8, e.clientY - dragStartOffset.current.y));
    setCustomizerPos({ x: newX, y: newY });
  };

  const handleCustomizerDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingCustomizer.current) {
      isDraggingCustomizer.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
  };

  // ── Canva-style Snap Guides & Screen Dragging ─────────────────────────────
  const [activeSnapGuide, setActiveSnapGuide] = React.useState<SnapGuide | null>(null);
  const screenDraggingRef = React.useRef(false);
  const screenStartClientYRef = React.useRef(0);
  const screenInitialYRef = React.useRef(0.5);
  const screenSnappedRef = React.useRef(false);

  // ── Layout names and inline renaming ──────────────────────────────────────
  const [layoutNames, setLayoutNames] = React.useState<Record<LayoutSlot, string>>(() => getLayoutNames(isLandscape, systemKey));
  const [editingLayoutName, setEditingLayoutName] = React.useState(false);
  const [nameInput, setNameInput] = React.useState('');

  React.useEffect(() => {
    setLayoutNames(getLayoutNames(isLandscape, systemKey));
  }, [isLandscape, systemKey]);

  React.useEffect(() => {
    const handleLayoutUpdate = () => {
      setLayoutNames(getLayoutNames(isLandscape, systemKey));
    };
    window.addEventListener('retro_layout_updated', handleLayoutUpdate);
    return () => window.removeEventListener('retro_layout_updated', handleLayoutUpdate);
  }, [isLandscape, systemKey]);

  React.useEffect(() => {
    const refreshDpadRect = () => {
      if (dpadContainerRef.current) {
        dpadRectRef.current = dpadContainerRef.current.getBoundingClientRect();
      }
    };
    refreshDpadRect();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && dpadContainerRef.current) {
      ro = new ResizeObserver(refreshDpadRect);
      ro.observe(dpadContainerRef.current);
    }
    window.addEventListener('resize', refreshDpadRect);
    window.addEventListener('orientationchange', refreshDpadRect);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', refreshDpadRect);
      window.removeEventListener('orientationchange', refreshDpadRect);
    };
  }, [isLandscape, padLayout.dpad, customizing]);

  const syncDpadArmVisuals = React.useCallback((mask: number) => {
    const arms = dpadArmRefs.current;
    if (arms.up) arms.up.dataset.pressed = (mask & 16) !== 0 ? 'true' : 'false';
    if (arms.down) arms.down.dataset.pressed = (mask & 32) !== 0 ? 'true' : 'false';
    if (arms.left) arms.left.dataset.pressed = (mask & 64) !== 0 ? 'true' : 'false';
    if (arms.right) arms.right.dataset.pressed = (mask & 128) !== 0 ? 'true' : 'false';
  }, []);

  const updateDpadByCoords = React.useCallback((clientX: number, clientY: number) => {
    const rect = dpadRectRef.current;
    if (!rect || rect.width === 0) return;
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const distSq = dx * dx + dy * dy;

    // 5px radial deadzone (25px^2) ensures edge & inner-arm taps register immediately without sqrt()
    const outsideDeadzone = distSq > 25;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    const up = outsideDeadzone && dy < -4 && absDy > absDx * 0.42;
    const down = outsideDeadzone && dy > 4 && absDy > absDx * 0.42;
    const left = outsideDeadzone && dx < -4 && absDx > absDy * 0.42;
    const right = outsideDeadzone && dx > 4 && absDx > absDy * 0.42;

    const nextMask = (up ? 16 : 0) | (down ? 32 : 0) | (left ? 64 : 0) | (right ? 128 : 0);
    if (nextMask === activeDpadMaskRef.current) return;

    activeDpadMaskRef.current = nextMask;
    syncDpadArmVisuals(nextMask);

    const nextDirs = { up, down, left, right };
    (['up', 'down', 'left', 'right'] as const).forEach((dir) => {
      if (nextDirs[dir] && !activeDpadDirs.current[dir]) {
        activeDpadDirs.current[dir] = true;
        setButtonDown?.(dir);
      } else if (!nextDirs[dir] && activeDpadDirs.current[dir]) {
        activeDpadDirs.current[dir] = false;
        setButtonUp?.(dir);
      }
    });
  }, [setButtonDown, setButtonUp, syncDpadArmVisuals]);

  const releaseDpadAll = React.useCallback(() => {
    activeDpadPointerId.current = null;
    if (activeDpadMaskRef.current === 0) return;
    activeDpadMaskRef.current = 0;
    syncDpadArmVisuals(0);
    (['up', 'down', 'left', 'right'] as const).forEach((dir) => {
      if (activeDpadDirs.current[dir]) {
        activeDpadDirs.current[dir] = false;
        setButtonUp?.(dir);
      }
    });
  }, [setButtonUp, syncDpadArmVisuals]);

  const renderDpad = () => (
    <div
      ref={dpadContainerRef}
      className="relative w-36 h-36 select-none touch-none gb-dpad-base rounded-2xl flex items-center justify-center"
      style={{
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (customizing) return;
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        activeDpadPointerId.current = e.pointerId;
        const win = emuFrameRef.current?.contentWindow as any;
        if (win && typeof win.unlockAudio === 'function') {
          try { win.unlockAudio(); } catch (err) {}
        }
        if (!dpadRectRef.current || dpadRectRef.current.width === 0) {
          dpadRectRef.current = e.currentTarget.getBoundingClientRect();
        }
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
        updateDpadByCoords(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (customizing || activeDpadPointerId.current !== e.pointerId) return;
        updateDpadByCoords(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (customizing || activeDpadPointerId.current !== e.pointerId) return;
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) {}
        releaseDpadAll();
      }}
      onPointerCancel={(e) => {
        if (customizing || activeDpadPointerId.current !== e.pointerId) return;
        releaseDpadAll();
      }}
      onPointerLeave={(e) => {
        if (customizing || activeDpadPointerId.current !== e.pointerId) return;
        try {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) return;
        } catch (err) {}
        releaseDpadAll();
      }}
    >
      {/* Up */}
      <div
        ref={(el) => { dpadArmRefs.current.up = el; }}
        className="absolute top-0 left-12 w-12 h-14 rounded-t-lg gb-dpad-arm flex items-start justify-center pt-2 pointer-events-none select-none dpad-arm"
        aria-hidden="true"
      >
        <span className="text-[10px] font-black text-black/80 drop-shadow-[0_1px_0_rgba(255,255,255,0.2)]">▲</span>
      </div>
      {/* Down */}
      <div
        ref={(el) => { dpadArmRefs.current.down = el; }}
        className="absolute bottom-0 left-12 w-12 h-14 rounded-b-lg gb-dpad-arm flex items-end justify-center pb-2 pointer-events-none select-none dpad-arm"
        aria-hidden="true"
      >
        <span className="text-[10px] font-black text-black/80 drop-shadow-[0_1px_0_rgba(255,255,255,0.2)]">▼</span>
      </div>
      {/* Left */}
      <div
        ref={(el) => { dpadArmRefs.current.left = el; }}
        className="absolute top-12 left-0 w-14 h-12 rounded-l-lg gb-dpad-arm flex items-center justify-start pl-2 pointer-events-none select-none dpad-arm"
        aria-hidden="true"
      >
        <span className="text-[10px] font-black text-black/80 drop-shadow-[0_1px_0_rgba(255,255,255,0.2)]">◀</span>
      </div>
      {/* Right */}
      <div
        ref={(el) => { dpadArmRefs.current.right = el; }}
        className="absolute top-12 right-0 w-14 h-12 rounded-r-lg gb-dpad-arm flex items-center justify-end pr-2 pointer-events-none select-none dpad-arm"
        aria-hidden="true"
      >
        <span className="text-[10px] font-black text-black/80 drop-shadow-[0_1px_0_rgba(255,255,255,0.2)]">▶</span>
      </div>
      {/* Molded Center Pivot Dish (Authentic Game Boy Concave indentation) */}
      <div
        className="absolute top-12 left-12 w-12 h-12 gb-dpad-arm flex items-center justify-center pointer-events-none z-10"
      >
        <div className="w-5 h-5 rounded-full gb-pivot-dish" />
      </div>
    </div>
  );

  const renderActions = () => (
    <div className="relative select-none touch-none flex items-center justify-center p-2">
      {/* Molded Recessed Shell Socket Bed with -25deg Rotation */}
      <div
        className="rounded-[40px] gb-socket-bed flex items-center gap-4 px-3.5 py-2.5 -rotate-[25deg]"
        aria-hidden="true"
      >
        {/* Button B (Left in rotated frame -> lower-left physically) */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            {...safeBindPadButton('actionB')}
            className="rounded-full font-black text-base flex items-center justify-center touch-none select-none gb-action-dome"
            style={{ width: '3.4rem', height: '3.4rem' }}
            aria-label="Button B"
          />
          <span className="mt-1.5 text-[12px] font-black italic tracking-widest text-indigo-900 dark:text-indigo-300 drop-shadow-[0_1px_0_rgba(255,255,255,0.3)] select-none">
            B
          </span>
        </div>

        {/* Button A (Right in rotated frame -> upper-right physically) */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            {...safeBindPadButton('actionA')}
            className="rounded-full font-black text-base flex items-center justify-center touch-none select-none gb-action-dome"
            style={{ width: '3.4rem', height: '3.4rem' }}
            aria-label="Button A"
          />
          <span className="mt-1.5 text-[12px] font-black italic tracking-widest text-indigo-900 dark:text-indigo-300 drop-shadow-[0_1px_0_rgba(255,255,255,0.3)] select-none">
            A
          </span>
        </div>
      </div>
    </div>
  );

  const renderSystem = () => (
    <div className="flex items-center justify-center gap-7 pt-1 pb-1 select-none touch-none">
      <button
        type="button"
        {...safeBindPadButton('select')}
        className="flex flex-col items-center gap-1.5 group touch-none select-none"
      >
        <div
          className="rounded-full gb-rubber-pill -rotate-[25deg]"
          style={{ width: '3.2rem', height: '0.95rem' }}
        />
        <span className="text-[10px] font-black italic tracking-widest text-indigo-900 dark:text-indigo-300 uppercase select-none drop-shadow-[0_1px_0_rgba(255,255,255,0.2)]">
          SELECT
        </span>
      </button>

      <button
        type="button"
        {...safeBindPadButton('start')}
        className="flex flex-col items-center gap-1.5 group touch-none select-none"
      >
        <div
          className="rounded-full gb-rubber-pill -rotate-[25deg]"
          style={{ width: '3.2rem', height: '0.95rem' }}
        />
        <span className="text-[10px] font-black italic tracking-widest text-indigo-900 dark:text-indigo-300 uppercase select-none drop-shadow-[0_1px_0_rgba(255,255,255,0.2)]">
          START
        </span>
      </button>
    </div>
  );

  const renderTransport = (compact = false) => (
    <div className={`flex items-center justify-center ${compact ? 'gap-[72px]' : 'gap-2 w-[300px] grid grid-cols-3'} select-none touch-none`}>
      {/* Pause Toggle */}
      <button
        type="button"
        aria-label={isPaused ? 'Resume game' : 'Pause game'}
        onClick={() => {
          if (customizing) {
            setSelectedPad('transport');
            return;
          }
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
        className={`relative flex items-center justify-center gap-1.5 ${
          compact ? 'h-[28px] min-w-[92px] px-3.5 rounded-md before:content-[\'\'] before:absolute before:-top-4 before:-bottom-4 before:-inset-x-2' : 'py-2.5 px-3 min-h-[44px] rounded-xl text-xs font-bold'
        } border transition active:scale-95 touch-none select-none tactile-btn ${
          isPaused
            ? 'bg-amber-500 text-zinc-950 border-amber-300 shadow-lg'
            : shaders.amoled
              ? 'bg-black text-zinc-200 border-zinc-800 hover:bg-zinc-900'
              : 'bg-zinc-950/80 text-zinc-200 border-white/10 hover:bg-zinc-900'
        }`}
        title={isPaused ? 'Resume' : 'Pause'}
      >
        {isPaused ? <Play className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} fill-current`} /> : <Pause className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
        {!compact && <span>{isPaused ? 'Resume' : 'Pause'}</span>}
      </button>

      {/* Hold Rewind */}
      <button
        type="button"
        aria-label="Hold to Rewind"
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            setIsRewinding(true);
          }
        }}
        onKeyUp={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            setIsRewinding(false);
          }
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          if (customizing) {
            setSelectedPad('transport');
            return;
          }
          try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch (err) {}
          haptics.toggle();
          setIsRewinding(true);
        }}
        onPointerUp={(e) => {
          try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch (err) {}
          if (!customizing) setIsRewinding(false);
        }}
        onPointerCancel={(e) => {
          try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch (err) {}
          if (!customizing) setIsRewinding(false);
        }}
        onPointerLeave={(e) => {
          try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch (err) {}
          if (!customizing) setIsRewinding(false);
        }}
        onTouchEnd={() => {
          if (!customizing) setIsRewinding(false);
        }}
        onTouchCancel={() => {
          if (!customizing) setIsRewinding(false);
        }}
        onContextMenu={(e) => e.preventDefault()}
        className={`relative flex items-center justify-center gap-1.5 ${
          compact ? 'h-[28px] min-w-[92px] px-3.5 rounded-md before:content-[\'\'] before:absolute before:-top-4 before:-bottom-4 before:-inset-x-2' : 'py-2.5 px-3 min-h-[44px] rounded-xl text-xs font-bold'
        } border transition active:scale-95 touch-none select-none tactile-btn ${
          isRewinding
            ? 'bg-amber-400 text-zinc-950 border-amber-200 shadow-lg'
            : shaders.amoled
              ? 'bg-black text-zinc-200 border-zinc-800 hover:bg-zinc-900'
              : 'bg-zinc-950/80 text-zinc-200 border-white/10 hover:bg-zinc-900'
        }`}
        title="Hold to Rewind"
      >
        <Rewind className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        {!compact && <span>Rewind</span>}
      </button>

      {/* Fast-Forward Speed Picker: 1x | 2x | 4x | 8x (cycles on tap) */}
      <button
        type="button"
        aria-label={isFastForward ? `Fast Forward ${ffSpeed}x` : 'Fast Forward 1x'}
        onClick={() => {
          if (customizing) {
            setSelectedPad('transport');
            return;
          }
          haptics.toggle();
          setFfSpeed((s) => {
            if (s <= 1) return 2;
            if (s === 2) return 4;
            if (s === 4) return 8;
            return 1;
          });
        }}
        className={`relative flex items-center justify-center gap-1.5 ${
          compact ? 'h-[28px] min-w-[92px] px-3.5 rounded-md before:content-[\'\'] before:absolute before:-top-4 before:-bottom-4 before:-inset-x-2' : 'py-2.5 px-3 min-h-[44px] rounded-xl text-xs font-bold'
        } border transition active:scale-95 touch-none select-none tactile-btn ${
          isFastForward
            ? 'bg-sky-400 text-zinc-950 border-sky-200 shadow-lg'
            : shaders.amoled
              ? 'bg-black text-zinc-200 border-zinc-800 hover:bg-zinc-900'
              : 'bg-zinc-950/80 text-zinc-200 border-white/10 hover:bg-zinc-900'
        }`}
        title={isFastForward ? `Fast Forward (${ffSpeed}x)` : 'Fast Forward'}
      >
        <FastForward className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        <span className={compact ? 'text-[9px] font-mono font-black' : ''}>{isFastForward ? `${ffSpeed}x` : '1x'}</span>
      </button>
    </div>
  );

  const playerSrcDoc = React.useMemo(() => {
    if (!activeGame.real || !romUrl) return '';
    return buildPlayerHtml(EJS_CORES[activeGame.core] || 'gb', romUrl, activeGame.title);
  }, [activeGame.core, activeGame.real, activeGame.title, romUrl]);

  const isGba = activeGame.core === 'mgba' || activeGame.shortSystem === 'GBA';
  const isGbc = activeGame.shortSystem === 'GBC';
  const isGb = activeGame.shortSystem === 'GB' || (activeGame.core === 'gambatte' && !isGbc);
  const screenRatio = coreRatio(activeGame.core, isLandscape);

  const renderGameScreen = () => {
    const gameFilter = getComputedGameFilter(shaders);

    return (
      <>
        {activeGame.real ? (
          romUrl ? (
            <iframe
              key={romUrl}
              ref={emuFrameRef}
              title="emulator"
              className="w-full h-full block border-0 bg-black pointer-events-none"
              allow="autoplay; gamepad"
              style={{ filter: gameFilter, contain: 'strict' }}
              srcDoc={playerSrcDoc}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs font-mono text-zinc-400">
              Loading ROM...
            </div>
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs font-mono text-zinc-400">
            No ROM loaded
          </div>
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
            backgroundSize: isGba ? '2px 2px' : '3px 3px'
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

        {isPaused && (
          <div
            onClick={() => revealTopBar(5000)}
            className="absolute inset-0 z-20 bg-black/70 flex flex-col items-center justify-center gap-2 cursor-pointer select-none"
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
  };

  const transportScale = (padLayout.transport?.s ?? 1) * padFitScale;
  const screenScale = padLayout.screen?.s ?? 1;
  const screenY = padLayout.screen?.y ?? 0.5;

  const renderCustomizer = () => {
    const activeKey = selectedPad;
    const currentScale = padLayout[activeKey]?.s || 1;
    const isTransport = activeKey === 'transport';
    const isScreen = activeKey === 'screen';

    return (
      <div
        ref={customizerRef}
        className="fixed z-50 w-[320px] max-w-[calc(100vw-20px)] rounded-2xl bg-zinc-950/95 backdrop-blur-md border border-zinc-700 p-3 shadow-2xl space-y-2.5 select-none"
        style={
          customizerPos
            ? { left: `${customizerPos.x}px`, top: `${customizerPos.y}px` }
            : isLandscape
              ? { bottom: '16px', right: '16px' }
              : { bottom: '16px', left: '50%', transform: 'translateX(-50%)' }
        }
      >
        {/* Drag handle header */}
        <div
          className="w-full flex items-center justify-between pb-1.5 border-b border-zinc-800/80 cursor-grab active:cursor-grabbing select-none touch-none"
          onPointerDown={handleCustomizerDragStart}
          onPointerMove={handleCustomizerDragMove}
          onPointerUp={handleCustomizerDragEnd}
          onPointerCancel={handleCustomizerDragEnd}
        >
          <div className="flex items-center gap-1.5">
            <GripHorizontal className="w-4 h-4 text-emerald-400" />
            <span className="font-extrabold text-xs text-emerald-300">
              {PAD_LABELS[selectedPad]}
            </span>
          </div>
          <span className="text-[10px] text-zinc-400 font-mono">
            {Math.round(currentScale * 100)}% • Drag dialog
          </span>
        </div>

        {/* Layout Slot Selector Dropdown (Call of Duty Mobile style with custom rename) */}
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs">
          {editingLayoutName ? (
            <div className="flex items-center gap-1.5 w-full">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const trimmed = nameInput.trim() || `Layout ${activeSlot}`;
                    setLayoutName(isLandscape, activeSlot, trimmed);
                    setLayoutNames(getLayoutNames(isLandscape));
                    setEditingLayoutName(false);
                    showToast(`Renamed to "${trimmed}"`);
                  } else if (e.key === 'Escape') {
                    setEditingLayoutName(false);
                  }
                }}
                maxLength={20}
                autoFocus
                placeholder={`Layout ${activeSlot}`}
                className="flex-1 bg-zinc-800 text-emerald-300 font-bold text-xs rounded-lg px-2 py-1 border border-emerald-500/50 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              />
              <button
                onClick={() => {
                  const trimmed = nameInput.trim() || `Layout ${activeSlot}`;
                  setLayoutName(isLandscape, activeSlot, trimmed, systemKey);
                  setLayoutNames(getLayoutNames(isLandscape, systemKey));
                  setEditingLayoutName(false);
                  showToast(`Renamed to "${trimmed}"`);
                }}
                className="p-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold transition active:scale-95"
                title="Save layout name"
                aria-label="Save layout name"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
              <button
                onClick={() => setEditingLayoutName(false)}
                className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition active:scale-95"
                title="Cancel"
                aria-label="Cancel rename"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5 text-zinc-400 font-mono font-bold text-[11px] shrink-0">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>LAYOUT</span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <select
                  aria-label="Preset layout selector"
                  value={activeSlot}
                  onChange={(e) => {
                    const newSlot = parseInt(e.target.value, 10) as LayoutSlot;
                    setActiveSlotHandler(newSlot);
                    showToast(`Loaded ${layoutNames[newSlot] || `Layout ${newSlot}`} (${isLandscape ? 'Landscape' : 'Portrait'})`);
                  }}
                  className="bg-zinc-800 hover:bg-zinc-700 text-emerald-300 font-bold text-xs rounded-lg px-2.5 py-1 border border-zinc-700 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer transition max-w-[145px] truncate"
                >
                  <option value={1}>{layoutNames[1] || 'Layout 1'}</option>
                  <option value={2}>{layoutNames[2] || 'Layout 2'}</option>
                  <option value={3}>{layoutNames[3] || 'Layout 3'}</option>
                </select>
                <button
                  onClick={() => {
                    setNameInput(layoutNames[activeSlot] || `Layout ${activeSlot}`);
                    setEditingLayoutName(true);
                  }}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition active:scale-95 shrink-0"
                  title="Rename this layout"
                  aria-label="Rename layout"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Resizing slider */}
        <div className="flex items-center gap-2 pt-0.5">
          <input
            type="range"
            min={isTransport ? '0.65' : isScreen ? '0.6' : '0.5'}
            max={isTransport ? '1.5' : isScreen ? '1.5' : '1.8'}
            step="0.05"
            value={currentScale}
            onChange={(e) => scalePad(activeKey, parseFloat(e.target.value))}
            className="flex-1 accent-emerald-500 cursor-pointer"
          />
          <button
            onClick={() => {
              if (isLandscape) {
                setPadLayoutLandscape(DEFAULT_LANDSCAPE_PAD_LAYOUT);
              } else {
                setPadLayoutPortrait(DEFAULT_PAD_LAYOUT);
              }
              showToast(`Reset Layout ${activeSlot} to default`);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition active:scale-95"
            title="Reset layout to default"
          >
            Reset
          </button>
          <button
            onClick={() => {
              setCustomizing(false);
              setCustomizerPos(null);
              showToast('Controls saved');
            }}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-black transition active:scale-95"
          >
            Done
          </button>
        </div>

        {/* Screen Vertical Slide Position Slider (Centered X, Only Moves Y Up/Down) */}
        {isScreen && !isLandscape && (
          <div className="space-y-1 pt-1.5 border-t border-zinc-800/80">
            <div className="flex items-center justify-between text-[11px] font-bold text-zinc-300">
              <span className="flex items-center gap-1.5">
                <span>Vertical Position</span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-emerald-400">Centered X</span>
              </span>
              <span className="text-[10px] font-mono text-emerald-400">
                {screenY === 0.5 ? 'Center (0%)' : `${Math.round((screenY - 0.5) * 200)}%`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-zinc-500">Up</span>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.02"
                value={screenY}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  const snapped = Math.abs(val - 0.5) < 0.03 ? 0.5 : val;
                  if (snapped === 0.5 && screenY !== 0.5) {
                    haptics.selection();
                  }
                  movePad('screen', 0.5, snapped);
                }}
                className="flex-1 accent-emerald-500 cursor-pointer"
              />
              <span className="text-[9px] font-mono text-zinc-500">Down</span>
              <button
                type="button"
                onClick={() => {
                  movePad('screen', 0.5, 0.5);
                  haptics.selection();
                }}
                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-bold transition active:scale-95"
                title="Reset to center"
              >
                Center
              </button>
            </div>
          </div>
        )}

        {/* Pad Selection Pills (both portrait and landscape) */}
        <div className="grid grid-cols-5 gap-1 pt-1 border-t border-zinc-800/80">
          {(['screen', 'dpad', 'actions', 'system', 'transport'] as PadGroupId[]).map((key) => (
            <button
              key={key}
              onClick={() => setSelectedPad(key)}
              className={`py-1 px-1 rounded-lg text-[10px] font-bold border transition ${
                selectedPad === key
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {key === 'screen'
                ? 'Screen'
                : key === 'dpad'
                ? 'D-Pad'
                : key === 'actions'
                ? 'ABXY'
                : key === 'system'
                ? 'System'
                : '3-Btn'}
            </button>
          ))}
        </div>

        {selectedPad === 'screen' && (
          <div className="text-[10px] text-zinc-400 text-center">
            Slide screen up/down or adjust scale. Screen stays strictly centered horizontally.
          </div>
        )}
        {selectedPad === 'transport' && (
          <div className="text-[10px] text-zinc-400 text-center">
            Resizing 3-button bar dynamically fits the controls
          </div>
        )}
        {selectedPad !== 'transport' && selectedPad !== 'screen' && (
          <div className="text-[10px] text-zinc-400 text-center">
            Drag the {PAD_LABELS[selectedPad]} on screen to move it
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`fixed inset-0 w-full overflow-hidden ${shaders.amoled ? 'bg-black' : 'bg-zinc-950'}`}
      style={{ height: '100lvh' }}
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
        {/* Tap & Swipe zone at top: reveals the auto-hiding top bar */}
        <button
          aria-label="Show top bar"
          onClick={() => revealTopBar()}
          onTouchStart={(e) => {
            touchStartYRef.current = e.touches[0].clientY;
          }}
          onTouchMove={(e) => {
            if (touchStartYRef.current !== null) {
              const deltaY = e.touches[0].clientY - touchStartYRef.current;
              if (deltaY > 15) {
                revealTopBar(5000);
                touchStartYRef.current = null;
              }
            }
          }}
          onTouchEnd={() => {
            touchStartYRef.current = null;
          }}
          className={`absolute top-0 ${isLandscape ? 'left-1/3 right-1/3' : 'left-0 right-0'} z-30 cursor-pointer flex flex-col items-center pt-2`}
          style={{ height: 'max(env(safe-area-inset-top, 0px) + 28px, 44px)' }}
        >
          <span className="w-10 h-1 rounded-full bg-white/20 border border-white/10 shadow-sm opacity-50 hover:opacity-100 transition-opacity" />
        </button>

        {/* 1. TOP BAR (auto-hides) */}
        <div
          className={`absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-3.5 pb-2.5 ${
            shaders.amoled
              ? 'bg-black border-b border-zinc-900'
              : 'bg-black/90 border-b border-white/10'
          } transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-xl ${
            topBarVisible
              ? 'translate-y-0 opacity-100 pointer-events-auto'
              : '-translate-y-full opacity-0 pointer-events-none'
          }`}
          style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 14px)' }}
          onClick={() => revealTopBar()}
        >
          <button
            onClick={triggerExitWithCeremony}
            className="p-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border border-white/10 text-xs font-bold transition active:scale-95 tactile-btn"
            aria-label="Library"
            title="Save & Return to Cartridge Binder"
          >
            <Home className="w-3.5 h-3.5 text-emerald-400" />
          </button>

          <div className="flex flex-col items-center text-center truncate px-2">
            <span className="text-xs font-extrabold text-zinc-100 truncate max-w-[180px]">
              {formatGameTitle(activeGame.title)}
            </span>
            <div className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-400">
              <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-amber-300 font-bold uppercase">{activeGame.shortSystem || activeGame.core}</span>
              <span>•</span>
              <span className="text-emerald-400 font-bold">
                {fps || 60} FPS
              </span>
              {isMuted && (
                <>
                  <span>•</span>
                  <span className="text-rose-400 font-bold">MUTED</span>
                </>
              )}
            </div>
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
              aria-label="Menu"
              title="Menu"
            >
              <Settings className="w-4 h-4" />
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
              className="w-full max-w-sm max-h-[85vh] overflow-y-auto modal-scroll bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl p-4 space-y-3 hardware-panel"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-1 border-b border-zinc-800/80">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 hardware-led" />
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-200">
                    PAUSE MENU
                  </span>
                </div>
                <button
                  onClick={() => setInGameMenuOpen(false)}
                  className="p-1.5 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white tactile-btn border border-zinc-800"
                  aria-label="Close Pause Menu"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Primary CTA: Resume Playing */}
              <button
                onClick={() => setInGameMenuOpen(false)}
                className="w-full py-2.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg tactile-btn transition active:scale-[0.98]"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Resume Playing</span>
              </button>

              {/* Tier 1: Primary State Actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setInGameMenuOpen(false);
                    setInGameSaveModalMode('save');
                  }}
                  className="flex flex-col items-start gap-1 p-3 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 transition active:scale-[0.98] tactile-btn text-left"
                >
                  <div className="flex items-center gap-1.5 w-full justify-between">
                    <Save className="w-4 h-4 text-emerald-400" />
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold uppercase">
                      {latestSaveSlot ? `SLOT ${latestSaveSlot.slot}` : 'SLOTS'}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-white mt-1">Save State</span>
                  <span className="text-[10px] text-emerald-400/80 truncate max-w-full">
                    {latestSaveSlot ? `Slot ${latestSaveSlot.slot} • ${latestSaveSlot.timestamp || 'Saved'}` : 'Capture frame • 4 slots'}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setInGameMenuOpen(false);
                    setInGameSaveModalMode('load');
                  }}
                  className="flex flex-col items-start gap-1 p-3 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 transition active:scale-[0.98] tactile-btn text-left"
                >
                  <div className="flex items-center gap-1.5 w-full justify-between">
                    <FolderOpen className="w-4 h-4 text-cyan-400" />
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold uppercase">
                      {latestSaveSlot ? 'SAVED' : 'EMPTY'}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-white mt-1">Load State</span>
                  <span className="text-[10px] text-cyan-400/80 truncate max-w-full">
                    {latestSaveSlot ? `Resume Slot ${latestSaveSlot.slot}` : 'No saved states yet'}
                  </span>
                </button>
              </div>

              {/* Tier 2: Quick Control & Display Toggles (Compact horizontal pill row) */}
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  onClick={toggleAudio}
                  className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border text-center transition active:scale-95 ${
                    isMuted
                      ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                      : 'bg-zinc-900/80 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                  }`}
                  title="Toggle Audio Mute"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                  <span className="text-[10px] font-bold">{isMuted ? 'Muted' : 'Audio'}</span>
                </button>

                <button
                  onClick={() => {
                    setInGameMenuOpen(false);
                    setHidePad(false);
                    setCustomizing(true);
                    setSelectedPad('dpad');
                  }}
                  className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 text-center transition active:scale-95"
                  title="Reposition and scale touch controls"
                >
                  <Sliders className="w-4 h-4 text-sky-400" />
                  <span className="text-[10px] font-bold">Edit Pad</span>
                </button>

                <button
                  onClick={() => {
                    setInGameMenuOpen(false);
                    setGlobalSettingsOpen(true);
                  }}
                  className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 text-center transition active:scale-95"
                  title="CRT Scanlines & Visual Settings"
                >
                  <Tv className="w-4 h-4 text-purple-400" />
                  <span className="text-[10px] font-bold">Shaders</span>
                </button>

                {onToggleLightDark && (
                  <button
                    onClick={onToggleLightDark}
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 text-center transition active:scale-95"
                    title={theme.isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                  >
                    {theme.isLight ? (
                      <Moon className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <Sun className="w-4 h-4 text-amber-400" />
                    )}
                    <span className="text-[10px] font-bold">{theme.isLight ? 'Dark' : 'Light'}</span>
                  </button>
                )}
              </div>

              {/* Tier 3: Collapsible Cartridge Tools & Session Exit */}
              <div className="pt-2 border-t border-zinc-800/80 space-y-2">
                <button
                  type="button"
                  onClick={() => setShowCartridgeTools((v) => !v)}
                  aria-expanded={showCartridgeTools}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 text-[11px] font-bold text-zinc-300 transition"
                >
                  <span className="flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>Cartridge Tools & Battery Export</span>
                  </span>
                  {showCartridgeTools ? (
                    <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                </button>

                {showCartridgeTools && (
                  <div className="space-y-2 pt-1">
                    {/* Unified Battery Save Export with Format Switcher */}
                    <div className="flex items-center justify-between gap-1.5 rounded-xl bg-zinc-900 border border-amber-500/30 p-1">
                      <button
                        onClick={() => exportBatterySave(activeGame, saveFormat)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[11px] font-bold transition active:scale-95"
                        title={
                          saveFormat === 'sav'
                            ? 'Download .sav for physical cartridge flashers (GB Operator / FlashGBX)'
                            : 'Download .srm for RetroArch'
                        }
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Battery ({saveFormat.toUpperCase()})</span>
                      </button>
                      <div className="flex items-center gap-0.5 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800" role="group" aria-label="Save format">
                        <button
                          type="button"
                          onClick={() => setSaveFormat('sav')}
                          className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition ${
                            saveFormat === 'sav'
                              ? 'bg-amber-400 text-zinc-950'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                          title="Flasher format (.sav)"
                        >
                          .SAV
                        </button>
                        <button
                          type="button"
                          onClick={() => setSaveFormat('srm')}
                          className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition ${
                            saveFormat === 'srm'
                              ? 'bg-amber-400 text-zinc-950'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                          title="RetroArch format (.srm)"
                        >
                          .SRM
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {onOpenControls && (
                        <button
                          onClick={() => {
                            setInGameMenuOpen(false);
                            onOpenControls();
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-[11px] font-semibold transition active:scale-95"
                        >
                          <Gamepad2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Controls Guide</span>
                        </button>
                      )}

                      {launchGame && (
                        <button
                          onClick={() => {
                            setInGameMenuOpen(false);
                            launchGame(activeGame);
                            showToast(`Rebooted ${activeGame.title}`);
                          }}
                          className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-rose-950/30 border border-zinc-800 hover:border-rose-500/30 text-zinc-400 hover:text-rose-300 text-[11px] font-semibold transition active:scale-95"
                          title="Reload cartridge and restart emulator core"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                          <span>Reboot</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={triggerExitWithCeremony}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-bold transition active:scale-95"
                >
                  <Home className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Save & Power Off to Shelf</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. GAME VIEWPORT CONTAINER (Stable DOM element across orientations) */}
        <div
          key="game-screen-area"
          className={`${isLandscape ? 'flex-1 min-w-0 h-full' : 'flex-none w-full'} ${
            shaders.edgeToEdge ? 'p-0' : 'p-2'
          } flex flex-col items-center justify-center relative ${
            shaders.edgeToEdge || shaders.amoled ? 'bg-black' : theme.bezelBg
          }`}
          style={{
            order: 0,
            paddingTop: isLandscape
              ? (shaders.edgeToEdge ? '0px' : '6px')
              : shaders.edgeToEdge
              ? `max(0px, max(env(safe-area-inset-top, 0px), calc(env(safe-area-inset-top, 0px) + ${(screenY - 0.5) * 35}vh)))`
              : `max(0px, max(env(safe-area-inset-top, 0px), calc(24px + ${(screenY - 0.5) * 35}vh)))`,
            paddingBottom: shaders.edgeToEdge
              ? (isLandscape ? '0px' : undefined)
              : (isLandscape ? 'max(env(safe-area-inset-bottom, 0px), 6px)' : undefined),
          }}
        >
          {/* Permanent Minimal Hardware Bezel Status Indicator (FPS LED + Mute Indicator) */}
          {!topBarVisible && (
            <div
              onClick={() => revealTopBar()}
              className="absolute top-1.5 right-2.5 z-30 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/65 border border-white/10 cursor-pointer select-none opacity-75 hover:opacity-100 transition-opacity"
              title="Tap to reveal top status bar"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full hardware-led ${
                  (fps || 60) >= 55 ? 'bg-emerald-400 text-emerald-400' : 'bg-amber-400 text-amber-400'
                }`}
              />
              <span className="text-[9px] font-mono font-bold text-zinc-300">
                {isGba ? 'GBA' : (fps || 60)}
              </span>
              {isMuted && <VolumeX className="w-2.5 h-2.5 text-rose-400" />}
            </div>
          )}

          {/* Portrait Screen + Lens Assembly (Centered horizontally, vertical position driven by flow paddingTop) */}
          <div className="w-full flex flex-col items-center justify-center">
            <div
              onClick={() => {
                if (customizing) {
                  setSelectedPad('screen');
                }
              }}
              className={`relative bg-black overflow-hidden ${
                isPoweringOff ? 'crt-power-off' : ''
              } ${
                customizing && selectedPad === 'screen'
                  ? 'border-2 border-emerald-400 ring-2 ring-emerald-400/50 cursor-pointer'
                  : customizing
                  ? 'border-2 border-white/30 cursor-pointer'
                  : shaders.edgeToEdge
                  ? 'border-0 shadow-none'
                  : isGba
                  ? 'border-2 border-zinc-800 shadow-2xl ring-1 ring-white/5'
                  : shaders.amoled
                  ? 'border-2 border-zinc-900 shadow-none'
                  : 'border-2 border-zinc-800 shadow-inner'
              } ${
                shaders.edgeToEdge
                  ? 'rounded-none'
                  : isGba
                  ? 'rounded-xl'
                  : shaders.crtCurve
                  ? 'rounded-2xl scale-[0.99]'
                  : 'rounded-lg'
              }`}
              style={{
                aspectRatio: String(screenRatio),
                maxWidth: isLandscape
                  ? '100%'
                  : `min(100%, calc(48lvh * ${screenRatio} * ${screenScale}))`,
                maxHeight: isLandscape
                  ? `calc((100lvh - ${Math.round(22 * transportScale + 10)}px) * ${screenScale})`
                  : `calc(48lvh * ${screenScale})`,
                width: isLandscape
                  ? `min(100%, calc((100lvh - ${Math.round(22 * transportScale + 10)}px) * ${screenRatio} * ${screenScale}))`
                  : shaders.edgeToEdge
                  ? `calc(100% * ${screenScale})`
                  : `min(100%, calc(48lvh * ${screenRatio} * ${screenScale}))`,
                height: 'auto',
                boxShadow: !shaders.edgeToEdge && !shaders.amoled && shaders.rgbBloom
                  ? `0 0 28px ${theme.hex}33, inset 0 0 18px rgba(0,0,0,0.75)`
                  : 'none',
                filter: 'none',
                contain: 'layout paint'
              }}
            >
              {renderGameScreen()}

              {/* Direct Vertical Screen Drag Handle in Customizing Mode (Strictly Centered Horizontally) */}
              {customizing && (
                <div
                  className={`absolute inset-0 touch-none cursor-ns-resize pointer-events-auto z-30 flex items-center justify-center ${
                    selectedPad === 'screen'
                      ? 'border-2 border-dashed border-emerald-400 bg-emerald-400/15'
                      : 'border-2 border-dashed border-white/40 bg-black/40 hover:border-emerald-400/60'
                  }`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    } catch (err) {}
                    screenDraggingRef.current = true;
                    screenStartClientYRef.current = e.clientY;
                    screenInitialYRef.current = padLayout.screen?.y ?? 0.5;
                    setSelectedPad('screen');
                  }}
                  onPointerMove={(e) => {
                    if (!screenDraggingRef.current) return;
                    const deltaY = (e.clientY - screenStartClientYRef.current) / (window.innerHeight * 0.35);
                    const rawY = Math.min(0.9, Math.max(0.1, screenInitialYRef.current + deltaY));
                    let snappedY = rawY;
                    let snapLabel: string | null = null;
                    if (Math.abs(rawY - 0.5) < 0.035) {
                      snappedY = 0.5;
                      snapLabel = 'Screen Centered (0%)';
                      if (!screenSnappedRef.current) {
                        haptics.selection();
                        screenSnappedRef.current = true;
                      }
                    } else {
                      screenSnappedRef.current = false;
                      const offsetPct = Math.round((snappedY - 0.5) * 200);
                      snapLabel = offsetPct > 0 ? `Screen Slide Down +${offsetPct}%` : `Screen Slide Up ${offsetPct}%`;
                    }
                    setActiveSnapGuide({ y: snappedY === 0.5 ? 0.5 : null, label: snapLabel });
                    movePad('screen', 0.5, snappedY); // X is strictly 0.5 (CENTERED, NO LEFT/RIGHT!)
                  }}
                  onPointerUp={(e) => {
                    if (screenDraggingRef.current) {
                      screenDraggingRef.current = false;
                      screenSnappedRef.current = false;
                      setActiveSnapGuide(null);
                      try {
                        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                      } catch (err) {}
                    }
                  }}
                  onPointerCancel={(e) => {
                    if (screenDraggingRef.current) {
                      screenDraggingRef.current = false;
                      screenSnappedRef.current = false;
                      setActiveSnapGuide(null);
                      try {
                        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                      } catch (err) {}
                    }
                  }}
                >
                  {selectedPad === 'screen' && (
                    <div className="px-3 py-1.5 rounded-xl bg-black/85 border border-emerald-400/80 text-emerald-300 text-xs font-mono font-bold shadow-2xl flex items-center gap-2 pointer-events-none select-none backdrop-blur-md">
                      <GripVertical className="w-4 h-4 text-emerald-400" />
                      <span>Slide Up / Down • Centered X</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Authentic Handheld Screen Lens Badge (Only when not in Edge-to-Edge mode) */}
            {!shaders.edgeToEdge && !isLandscape && (
              <div className="w-full flex items-center justify-center pt-2 pb-0.5 select-none pointer-events-none">
                {isGba ? (
                  <div className="flex items-center gap-1.5 opacity-85 tracking-widest text-[11px] font-sans">
                    <span className="font-black text-zinc-300">GAME BOY</span>
                    <span className="italic font-black text-indigo-400 text-xs">ADVANCE</span>
                  </div>
                ) : isGbc ? (
                  <div className="flex items-center gap-1 opacity-85 font-sans font-black tracking-widest text-[10px] text-zinc-300">
                    <span>GAME BOY</span>
                    <span className="font-extrabold tracking-normal inline-flex text-[9px] gap-0.5">
                      <span className="text-rose-500">C</span>
                      <span className="text-amber-400">O</span>
                      <span className="text-emerald-400">L</span>
                      <span className="text-cyan-400">O</span>
                      <span className="text-indigo-400">R</span>
                    </span>
                  </div>
                ) : isGb ? (
                  <div className="w-full flex items-center justify-between px-3 opacity-75">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      <span className="text-[8px] font-mono font-bold tracking-wider text-zinc-400">BATTERY</span>
                    </div>
                    <span className="text-[8px] font-mono font-bold tracking-widest text-zinc-400">
                      DOT MATRIX WITH STEREO SOUND
                    </span>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Compact Transport Bar in Landscape: Positioned cleanly BELOW screen so it never obscures game content */}
          {isLandscape && (
            <div
              className="relative z-30 flex items-center justify-center pointer-events-auto shrink-0 select-none"
              style={{
                height: `${Math.round(22 * transportScale)}px`,
                marginTop: '2px',
              }}
            >
              <div
                onClick={() => {
                  if (customizing) {
                    setSelectedPad('transport');
                  }
                }}
                className={`bg-black/90 px-2.5 py-0.5 rounded-lg border ${
                  customizing && selectedPad === 'transport'
                    ? 'border-emerald-400 ring-2 ring-emerald-400/50 bg-emerald-950/20 cursor-pointer'
                    : customizing
                    ? 'border-white/30 cursor-pointer'
                    : 'border-white/10'
                } shadow-xl flex items-center transition-[transform,border-color,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] origin-center`}
                style={{
                  transform: `scale(${transportScale})`,
                  transformOrigin: 'center center',
                }}
              >
                {renderTransport(true)}
              </div>
            </div>
          )}
        </div>

        {/* 3. LANDSCAPE CONTROLS: MOVABLE CONTROLS OVERLAY */}
        {isLandscape && (!hidePad || customizing) && (
          <div
            ref={landscapeDeckRef}
            className="absolute inset-0 pointer-events-none z-20 overflow-hidden select-none"
          >
            {/* Canva Alignment Dot Grid & Guidelines (visible when customizing) */}
            {customizing && (
              <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                <div
                  className="absolute inset-0 opacity-15"
                  style={{
                    backgroundImage: 'radial-gradient(circle, rgba(255, 255, 255, 0.4) 1px, transparent 1px)',
                    backgroundSize: '24px 24px'
                  }}
                />
                {activeSnapGuide?.x != null && (
                  <div
                    className="absolute top-0 bottom-0 w-0 border-l-2 border-dashed border-cyan-400 z-30 shadow-[0_0_12px_rgba(6,182,212,0.9)]"
                    style={{ left: `${activeSnapGuide.x * 100}%` }}
                  />
                )}
                {activeSnapGuide?.y != null && (
                  <div
                    className="absolute left-0 right-0 h-0 border-t-2 border-dashed border-cyan-400 z-30 shadow-[0_0_12px_rgba(6,182,212,0.9)]"
                    style={{ top: `${activeSnapGuide.y * 100}%` }}
                  />
                )}
                {activeSnapGuide?.label && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 px-2.5 py-1 rounded-full bg-cyan-950/90 border border-cyan-400/80 text-cyan-200 text-[10px] font-mono font-bold shadow-xl flex items-center gap-1.5 backdrop-blur-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                    <span>{activeSnapGuide.label}</span>
                  </div>
                )}
              </div>
            )}

            {/* Movable D-Pad */}
            <PadGroup
              id="dpad"
              layout={scaledPadLayout}
              customizing={customizing}
              selected={customizing && selectedPad === 'dpad'}
              onSelect={setSelectedPad}
              onMove={movePad}
              onSnapGuide={setActiveSnapGuide}
              deckRef={landscapeDeckRef}
            >
              <div className="pointer-events-auto">
                {renderDpad()}
              </div>
            </PadGroup>

            {/* Movable Actions */}
            <PadGroup
              id="actions"
              layout={scaledPadLayout}
              customizing={customizing}
              selected={customizing && selectedPad === 'actions'}
              onSelect={setSelectedPad}
              onMove={movePad}
              onSnapGuide={setActiveSnapGuide}
              deckRef={landscapeDeckRef}
            >
              <div className="pointer-events-auto">
                {renderActions()}
              </div>
            </PadGroup>
          </div>
        )}

        {/* 4. LANDSCAPE FLANKS: BEZELS, SHOULDERS & SYSTEM BUTTONS */}
        {isLandscape && (!hidePad || customizing) && (
          <>
            {/* Left Flank (order: -1 -> placed visually on the LEFT) */}
            <div
              className={`flex-none ${isGba ? 'w-[96px] sm:w-[110px] md:w-[124px]' : 'w-[112px] sm:w-[130px] md:w-[150px]'} h-full flex flex-col justify-between items-center py-3 px-2 select-none touch-none z-10 ${
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
              <div className="w-full flex justify-start pl-1 pointer-events-auto">
                <button
                  type="button"
                  {...safeBindPadButton('btnL')}
                  className={`w-20 h-10 rounded-xl font-mono font-black text-xs shadow-lg flex items-center justify-center tactile-btn touch-none select-none ${
                    shaders.amoled
                      ? 'bg-zinc-950 text-zinc-200 border border-white/10 hover:bg-zinc-900'
                      : 'bg-zinc-950/80 text-zinc-200 border border-white/10 hover:bg-zinc-900'
                  }`}
                  aria-label="L Shoulder"
                >
                  L
                </button>
              </div>

              {/* Flex spacer for center area where D-pad floats */}
              <div className="flex-1" />

              {/* SELECT Button */}
              <div className="pb-1 pointer-events-auto" style={{ transform: `scale(${padLayout.system?.s || 1})` }}>
                <button
                  type="button"
                  {...safeBindPadButton('select')}
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
              className={`flex-none ${isGba ? 'w-[96px] sm:w-[110px] md:w-[124px]' : 'w-[112px] sm:w-[130px] md:w-[150px]'} h-full flex flex-col justify-between items-center py-3 px-2 select-none touch-none z-10 ${
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
              <div className="w-full flex justify-end pr-1 pointer-events-auto">
                <button
                  type="button"
                  {...safeBindPadButton('btnR')}
                  className={`w-20 h-10 rounded-xl font-mono font-black text-xs shadow-lg flex items-center justify-center tactile-btn touch-none select-none ${
                    shaders.amoled
                      ? 'bg-zinc-950 text-zinc-200 border border-white/10 hover:bg-zinc-900'
                      : 'bg-zinc-950/80 text-zinc-200 border border-white/10 hover:bg-zinc-900'
                  }`}
                  aria-label="R Shoulder"
                >
                  R
                </button>
              </div>

              {/* Flex spacer for center area where Actions float */}
              <div className="flex-1" />

              {/* START Button */}
              <div className="pb-1 pointer-events-auto" style={{ transform: `scale(${padLayout.system?.s || 1})` }}>
                <button
                  type="button"
                  {...safeBindPadButton('start')}
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
            {/* Canva Alignment Dot Grid & Guidelines (visible when customizing) */}
            {customizing && (
              <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                {/* Dot Grid Pattern */}
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage: 'radial-gradient(circle, rgba(255, 255, 255, 0.4) 1px, transparent 1px)',
                    backgroundSize: '24px 24px'
                  }}
                />
                {/* Center Crosshair Lines (Faint) */}
                <div className="absolute left-1/2 top-0 bottom-0 w-[1px] border-l border-dashed border-white/10" />
                <div className="absolute top-1/2 left-0 right-0 h-[1px] border-t border-dashed border-white/10" />

                {/* Magnetic Snap Guidelines (Active Canva Lines) */}
                {activeSnapGuide?.x != null && (
                  <div
                    className="absolute top-0 bottom-0 w-0 border-l-2 border-dashed border-cyan-400 z-30 shadow-[0_0_12px_rgba(6,182,212,0.9)]"
                    style={{ left: `${activeSnapGuide.x * 100}%` }}
                  />
                )}
                {activeSnapGuide?.y != null && (
                  <div
                    className="absolute left-0 right-0 h-0 border-t-2 border-dashed border-cyan-400 z-30 shadow-[0_0_12px_rgba(6,182,212,0.9)]"
                    style={{ top: `${activeSnapGuide.y * 100}%` }}
                  />
                )}

                {/* Canva Alignment Floating Pill Badge */}
                {activeSnapGuide?.label && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 px-2.5 py-1 rounded-full bg-cyan-950/90 border border-cyan-400/80 text-cyan-200 text-[10px] font-mono font-bold shadow-xl animate-fade-in flex items-center gap-1.5 backdrop-blur-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                    <span>{activeSnapGuide.label}</span>
                  </div>
                )}
              </div>
            )}

            {/* L & R Shoulder Buttons in Portrait */}
            {(!hidePad || customizing) && (
              <div className="absolute top-2.5 left-4 right-4 z-20 flex justify-between pointer-events-none">
                <button
                  type="button"
                  {...safeBindPadButton('btnL')}
                  className={`w-16 h-8 rounded-xl font-mono font-black text-xs shadow-md pointer-events-auto flex items-center justify-center tactile-btn touch-none select-none ${
                    shaders.amoled
                      ? 'bg-zinc-950 text-zinc-200 border border-white/10 hover:bg-zinc-900'
                      : 'bg-zinc-950/80 text-zinc-200 border border-white/10 hover:bg-zinc-900'
                  }`}
                  aria-label="L Shoulder"
                >
                  L
                </button>
                <button
                  type="button"
                  {...safeBindPadButton('btnR')}
                  className={`w-16 h-8 rounded-xl font-mono font-black text-xs shadow-md pointer-events-auto flex items-center justify-center tactile-btn touch-none select-none ${
                    shaders.amoled
                      ? 'bg-zinc-950 text-zinc-200 border border-white/10 hover:bg-zinc-900'
                      : 'bg-zinc-950/80 text-zinc-200 border border-white/10 hover:bg-zinc-900'
                  }`}
                  aria-label="R Shoulder"
                >
                  R
                </button>
              </div>
            )}

            <PadGroup
              id="transport"
              layout={scaledPadLayout}
              customizing={customizing}
              selected={customizing && selectedPad === 'transport'}
              onSelect={setSelectedPad}
              onMove={movePad}
              onSnapGuide={setActiveSnapGuide}
              deckRef={deckRef}
            >
              {renderTransport(false)}
            </PadGroup>

            {(!hidePad || customizing) && (
              <PadGroup
                id="dpad"
                layout={scaledPadLayout}
                customizing={customizing}
                selected={customizing && selectedPad === 'dpad'}
                onSelect={setSelectedPad}
                onMove={movePad}
                onSnapGuide={setActiveSnapGuide}
                deckRef={deckRef}
              >
                {renderDpad()}
              </PadGroup>
            )}

            {(!hidePad || customizing) && (
              <PadGroup
                id="actions"
                layout={scaledPadLayout}
                customizing={customizing}
                selected={customizing && selectedPad === 'actions'}
                onSelect={setSelectedPad}
                onMove={movePad}
                onSnapGuide={setActiveSnapGuide}
                deckRef={deckRef}
              >
                {renderActions()}
              </PadGroup>
            )}

            {/* Game Boy Diagonal Speaker Grille Accents (Bottom Right) */}
            <div className="absolute bottom-3 right-4 flex items-center gap-1.5 rotate-[28deg] opacity-40 pointer-events-none select-none" aria-hidden="true">
              <div className="w-1.5 h-7 rounded-full bg-black/70 shadow-inner" />
              <div className="w-1.5 h-8 rounded-full bg-black/70 shadow-inner" />
              <div className="w-1.5 h-9 rounded-full bg-black/70 shadow-inner" />
              <div className="w-1.5 h-9 rounded-full bg-black/70 shadow-inner" />
              <div className="w-1.5 h-8 rounded-full bg-black/70 shadow-inner" />
              <div className="w-1.5 h-7 rounded-full bg-black/70 shadow-inner" />
            </div>

            {(!hidePad || customizing) && (
              <PadGroup
                id="system"
                layout={scaledPadLayout}
                customizing={customizing}
                selected={customizing && selectedPad === 'system'}
                onSelect={setSelectedPad}
                onMove={movePad}
                onSnapGuide={setActiveSnapGuide}
                deckRef={deckRef}
              >
                {renderSystem()}
              </PadGroup>
            )}
          </div>
        )}

        {/* Persistent Fast-Forward Multiplier Indicator (both orientations) */}
        {isFastForward && (
          <div
            className="absolute top-2.5 right-3 z-40 pointer-events-none select-none flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-400 text-zinc-950 text-[10px] font-mono font-black shadow-lg"
            aria-label={`Fast forwarding at ${ffSpeed} times speed`}
          >
            <FastForward className="w-3 h-3" />
            <span>{ffSpeed}x</span>
          </div>
        )}

        {/* Draggable Customizer Dialog (visible across all orientations, floats above all layers) */}
        {customizing && renderCustomizer()}
      </div>
    </div>
  );
};
