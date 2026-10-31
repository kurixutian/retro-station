import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Sparkles } from 'lucide-react';

import { Game, SaveSlot, PadLayout, PadGroupId } from './types';
import { CORE_MAP } from './constants/cores';
import { THEMES } from './constants/themes';
import { DEFAULT_PAD_LAYOUT, loadPadLayout, EMU_INPUT_MAP, PAD_KEYS } from './constants/controls';
import { idbOpen, idbPut, idbGet, idbDelete } from './services/storage/idb';
import { soundFX } from './services/audio/synth';
import { createEmptySlotsForGame, createPrepopulatedThumbnail, downloadBinaryFile } from './services/storage/saveSlots';
import { createInitialEngineState } from './demoEngines/engineState';
import { stepGameFrame } from './demoEngines/gameLogic';
import { drawGameCanvas } from './demoEngines/gameRenderer';
import { normalizeBinaryData } from './cloudSync';

import { LibraryView } from './components/library/LibraryView';
import { InGameView } from './components/emulator/InGameView';
import { SettingsModal } from './components/modals/SettingsModal';
import { SaveSlotsModal } from './components/modals/SaveSlotsModal';

const INITIAL_GAMES: Game[] = [];

const STUB_GAME: Game = {
  id: 'none',
  title: '',
  fileName: '',
  core: 'gambatte',
  system: '',
  shortSystem: '',
  engineType: 'pokegold',
  real: false
};

export default function App() {
  // Navigation View: 'home' (Netflix Library) | 'ingame' (Vertical Handheld)
  const [currentView, setCurrentView] = useState<'home' | 'ingame'>('home');

  // Games Library & Filter State
  const [games, setGames] = useState<Game[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('retro_games') || 'null');
      if (Array.isArray(saved)) {
        return saved.map((g) => ({
          ...g,
          subtitle: (g.subtitle || g.system || '').replace(/\s*•\s*Auto-Detected Core/i, '')
        }));
      }
    } catch (e) {}
    return INITIAL_GAMES;
  });

  const [activeGame, setActiveGame] = useState<Game>(STUB_GAME);
  const [isMuted, setIsMuted] = useState(false);
  const emuFrameRef = useRef<HTMLIFrameElement | null>(null);
  const pendingStateRef = useRef<any>(null);
  const pendingSrmRef = useRef<any>(null);
  const pendingRtcRef = useRef<any>(null);
  const hasUserInteractedRef = useRef(false);
  const [romUrl, setRomUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [systemFilter, setSystemFilter] = useState('ALL');
  const [showSearch, setShowSearch] = useState(false);

  // Per-Game Isolated Save State Slots Dictionary: { [gameId]: [Slot1, Slot2, Slot3, Slot4] }
  const [savesByGameId, setSavesByGameId] = useState<Record<string, SaveSlot[]>>(() => {
    const initialMap: Record<string, SaveSlot[]> = {};
    let gList: Game[] = [];
    try { gList = JSON.parse(localStorage.getItem('retro_games') || '[]') || []; } catch (e) {}
    gList.forEach((g) => {
      initialMap[g.id] = createEmptySlotsForGame(g.id);
    });
    return initialMap;
  });

  // Modals & Drawers
  const [detailGame, setDetailGame] = useState<Game | null>(null);
  const [globalSettingsOpen, setGlobalSettingsOpen] = useState(false);
  const [inGameMenuOpen, setInGameMenuOpen] = useState(false);
  const [inGameSaveModalMode, setInGameSaveModalMode] = useState<'save' | 'load' | null>(null);

  // Theme & Combinable Shader Pipeline State (Auto-saved to localStorage)
  const [themeId, setThemeId] = useState(() => {
    try {
      return localStorage.getItem('retro_theme') || 'midnight';
    } catch (e) {
      return 'midnight';
    }
  });

  const [shaders, setShaders] = useState(() => {
    const defaultShaders: Record<string, boolean> = {
      scanlines: true,
      rgbBloom: true,
      bezelVignette: true,
      crtCurve: true,
      gbGrid: false,
      amoled: false,
    };
    try {
      const saved = localStorage.getItem('retro_shaders');
      return saved ? { ...defaultShaders, ...JSON.parse(saved) } : defaultShaders;
    } catch (e) {
      return defaultShaders;
    }
  });

  useEffect(() => {
    try { localStorage.setItem('retro_theme', themeId); } catch (e) {}
  }, [themeId]);

  useEffect(() => {
    try { localStorage.setItem('retro_shaders', JSON.stringify(shaders)); } catch (e) {}
  }, [shaders]);

  // Restore saved slots from IndexedDB on startup
  useEffect(() => {
    (async () => {
      try {
        const db = await idbOpen();
        const tx = db.transaction('roms', 'readonly');
        const store = tx.objectStore('roms');
        const req = store.openCursor();
        req.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest).result;
          if (cursor) {
            const key = String(cursor.key);
            if (key.startsWith('state:')) {
              const parts = key.split(':');
              const gId = parts[1];
              const slotN = parseInt(parts[2], 10);
              const val = cursor.value;
              if (val && gId && slotN) {
                const emuSt = normalizeBinaryData(val.emuState || val.emuStateBase64 || val.stateData?.emuState || val.stateData?.emuStateBase64);
                setSavesByGameId((prev) => {
                  const list = prev[gId] || createEmptySlotsForGame(gId);
                  return {
                    ...prev,
                    [gId]: list.map((s) =>
                      s.slot === slotN
                        ? {
                            slot: slotN,
                            empty: false,
                            label: val.label || `Slot #${slotN}`,
                            timestamp: val.timestamp || '',
                            score: 0,
                            frame: 0,
                            screenshot: val.screenshot || null,
                            stateData: val.stateData
                              ? { ...val.stateData, emuState: emuSt || val.stateData.emuState }
                              : {
                                  version: 'EJS_STATE',
                                  gameId: gId,
                                  timestamp: val.timestamp,
                                  emuState: emuSt
                                }
                          }
                        : s
                    )
                  };
                });
              }
            }
            cursor.continue();
          }
        };
      } catch (err) {}
    })();
  }, []);

  // In-Game Emulation Runtime State
  const [isPaused, setIsPaused] = useState(false);
  const [topBarVisible, setTopBarVisible] = useState(false);
  const topBarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const revealTopBar = useCallback((customDuration?: number) => {
    setTopBarVisible(true);
    if (topBarTimer.current) clearTimeout(topBarTimer.current);
    const duration = typeof customDuration === 'number' ? customDuration : (isPaused ? 5000 : 3000);
    topBarTimer.current = setTimeout(() => setTopBarVisible(false), duration);
  }, [isPaused]);

  useEffect(() => {
    if (isPaused) {
      revealTopBar(5000);
    } else {
      if (topBarTimer.current) {
        clearTimeout(topBarTimer.current);
        topBarTimer.current = null;
      }
      setTopBarVisible(false);
    }
  }, [isPaused, revealTopBar]);

  const [isRewinding, setIsRewinding] = useState(false);
  const [isFastForward, setIsFastForward] = useState(false);
  const [hidePad, setHidePad] = useState(false);
  const [padLayout, setPadLayout] = useState<PadLayout>(loadPadLayout);
  const [customizing, setCustomizing] = useState(false);
  const [selectedPad, setSelectedPad] = useState<PadGroupId>('dpad');
  const deckRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try { localStorage.setItem('retro_pad_layout', JSON.stringify(padLayout)); } catch (e) {}
  }, [padLayout]);

  useEffect(() => {
    try { localStorage.setItem('retro_games', JSON.stringify(games)); } catch (e) {}
  }, [games]);

  const getEmu = () => {
    try { return (emuFrameRef.current?.contentWindow as any)?.EJS_emulator || null; } catch (e) { return null; }
  };

  const pressStartTimesRef = useRef<Record<string, number>>({});
  const releaseTimersRef = useRef<Record<string, any>>({});

  const sendKey = useCallback((name: string, down: boolean) => {
    if (down) hasUserInteractedRef.current = true;
    const win = emuFrameRef.current?.contentWindow as any;
    if (!win) return;

    try {
      if (typeof win.simulateButton === 'function') {
        win.simulateButton(name, down);
        return;
      }
      const idx = EMU_INPUT_MAP[name];
      if (idx !== undefined) {
        const emu = win.EJS_emulator;
        if (emu?.gameManager && typeof emu.gameManager.simulateInput === 'function') {
          emu.gameManager.simulateInput(0, idx, down ? 1 : 0);
          return;
        }
      }
    } catch (e) {
      console.error(e);
    }

    const k = PAD_KEYS[name];
    if (k) {
      try {
        const target = win.document.getElementById('game') || win.document.querySelector('canvas') || win;
        const ev = new win.KeyboardEvent(down ? 'keydown' : 'keyup', {
          key: k[0],
          code: k[0],
          bubbles: true,
          cancelable: true
        });
        Object.defineProperty(ev, 'keyCode', { get: () => k[1] });
        Object.defineProperty(ev, 'which', { get: () => k[1] });
        target.dispatchEvent(ev);
        win.dispatchEvent(ev);
      } catch (e) {}
    }
  }, []);

  const setButtonDown = useCallback((name: string) => {
    if (releaseTimersRef.current[name]) {
      clearTimeout(releaseTimersRef.current[name]);
      releaseTimersRef.current[name] = null;
    }
    pressStartTimesRef.current[name] = performance.now();
    keysRef.current[name] = true;
    sendKey(name, true);
  }, [sendKey]);

  const setButtonUp = useCallback((name: string) => {
    const minHold = 75; // 75ms minimum hold ensures emulator core / Libretro VBlank polls the key press even at 2x speed
    const elapsed = performance.now() - (pressStartTimesRef.current[name] || 0);

    const performRelease = () => {
      keysRef.current[name] = false;
      sendKey(name, false);
      releaseTimersRef.current[name] = null;
    };

    if (elapsed < minHold) {
      if (releaseTimersRef.current[name]) clearTimeout(releaseTimersRef.current[name]);
      releaseTimersRef.current[name] = setTimeout(performRelease, minHold - elapsed);
    } else {
      performRelease();
    }
  }, [sendKey]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'ejs-user-input') {
        hasUserInteractedRef.current = true;
        return;
      }
      if (e.data?.type === 'ejs-srm-update') {
        if (hasUserInteractedRef.current && activeGame?.id && e.data?.save) {
          const srmArr = normalizeBinaryData(e.data.save);
          if (srmArr) {
            idbPut(`srm:${activeGame.id}`, srmArr).catch(() => {});
          }
        }
        return;
      }
      if (e.data?.type !== 'ejs-ready') return;
      const win = emuFrameRef.current?.contentWindow as any;
      try { win?.setAudioMuted?.(isMuted); } catch (err) {}

      if (pendingSrmRef.current || pendingRtcRef.current) {
        const srm = normalizeBinaryData(pendingSrmRef.current);
        const rtc = normalizeBinaryData(pendingRtcRef.current);
        pendingSrmRef.current = null;
        pendingRtcRef.current = null;
        try {
          win?.loadSrmData?.(srm, rtc);
        } catch (err) {
          console.error('Failed to load pending SRM/RTC:', err);
        }
      }

      const st = pendingStateRef.current;
      if (st) {
        pendingStateRef.current = null;
        setTimeout(() => {
          try {
            const stateToLoad = normalizeBinaryData(st);
            if (!stateToLoad) return;
            if (win?.loadStateData) {
              win.loadStateData(stateToLoad);
            } else {
              getEmu()?.gameManager.loadState(stateToLoad);
            }
          } catch (err) {
            console.error('Failed to load pending state:', err);
          }
        }, 800);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [activeGame?.id, isMuted]);

  const movePad = (id: PadGroupId, x: number, y: number) =>
    setPadLayout((l) => ({ ...l, [id]: { ...l[id], x, y } }));
  const scalePad = (id: PadGroupId, sc: number) =>
    setPadLayout((l) => ({ ...l, [id]: { ...l[id], s: sc } }));

  const [, setFps] = useState(60);
  const [, setLiveScore] = useState(0);
  const [, setLiveFrame] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineStateRef = useRef<any>(createInitialEngineState('pokegold'));
  const rewindBufferRef = useRef<any[]>([]);
  const keysRef = useRef<Record<string, boolean>>({
    up: false,
    down: false,
    left: false,
    right: false,
    actionA: false,
    actionB: false,
    actionX: false,
    actionY: false,
    start: false,
    select: false,
  });
  const EdgeTapRef = useRef<Record<string, boolean>>({
    up: false,
    down: false,
    left: false,
    right: false,
    actionA: false,
    actionB: false
  });

  const romInputRef = useRef<HTMLInputElement | null>(null);
  const theme = THEMES[themeId] || THEMES.midnight;

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 2600);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const applyTheme = (id: string) => {
    setThemeId(id);
    try { localStorage.setItem('retro_theme', id); } catch (e) {}
    showToast(`Theme Applied: ${THEMES[id]?.name || id}`);
  };

  const toggleShader = (key: string) => {
    setShaders((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem('retro_shaders', JSON.stringify(next)); } catch (e) {}
      if (key === 'amoled') {
        showToast(next.amoled ? 'AMOLED Battery Saver Activated (Pure Black)' : 'AMOLED Mode Disabled');
      }
      return next;
    });
  };

  const toggleAudio = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundFX.muted = next;
    try {
      const win = emuFrameRef.current?.contentWindow as any;
      win?.setAudioMuted?.(next);
      const emu = getEmu();
      if (emu) {
        if (typeof emu.setVolume === 'function') emu.setVolume(next ? 0 : 1);
        if (emu.gameManager && typeof emu.gameManager.setVolume === 'function') emu.gameManager.setVolume(next ? 0 : 1);
      }
    } catch (e) {}
    showToast(next ? 'Game Audio Muted' : 'Game Audio On');
  };

  const deleteRom = useCallback(async (gameId: string) => {
    try {
      await idbDelete(gameId);
      await idbDelete(`rom:${gameId}`);
    } catch (e) {}
    setGames((prev) => {
      const remaining = prev.filter((g) => g.id !== gameId);
      const userImportedOnly = remaining.filter((g) => g.real && g.id !== 'pokemon_gold');
      idbPut('library_games', userImportedOnly).catch(() => {});
      return remaining;
    });
    setSavesByGameId((prev) => {
      const next = { ...prev };
      delete next[gameId];
      return next;
    });
    setDetailGame((d) => (d?.id === gameId ? null : d));
    setActiveGame((a) => {
      if (a?.id === gameId) {
        setCurrentView('home');
        return STUB_GAME;
      }
      return a;
    });
    showToast('ROM deleted from library');
  }, [showToast]);

  const handleRomUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const parts = file.name.split('.');
    const ext = parts.length > 1 ? parts.pop()!.toLowerCase() : 'gbc';
    const detected = CORE_MAP[ext] || {
      core: 'gambatte',
      system: `Custom ROM (${ext.toUpperCase()})`,
      shortSystem: ext.toUpperCase().slice(0, 4),
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
    };

    const buffer = await file.slice(0, 4096).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let hash = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i++) {
      hash ^= bytes[i];
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    const crcHex = '0x' + hash.toString(16).toUpperCase().padStart(8, '0');

    const coreToEngine: Record<string, string> = {
      gambatte: 'pokegold',
      fceumm: 'cyberrun',
      snes9x: 'starblade',
      genesis_plus_gx: 'starblade',
      mgba: 'neondrift'
    };
    const engineType = coreToEngine[detected.core] || 'pokegold';

    const gradients = [
      'from-emerald-600 via-teal-800 to-slate-950',
      'from-indigo-600 via-purple-800 to-slate-950',
      'from-amber-500 via-orange-700 to-red-950',
      'from-cyan-500 via-blue-700 to-indigo-950'
    ];
    const coverGradient = gradients[games.length % gradients.length];

    const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
    const existingByCrc = games.find(
      (g: any) => g.real && g.crc32 && String(g.crc32).toLowerCase() === String(crcHex).toLowerCase()
    );
    const deterministicId = existingByCrc?.id || (crcHex && crcHex !== '00000000' ? `rom_${String(crcHex).toLowerCase()}` : `rom_${Date.now()}`);

    const newGame: Game = {
      id: deterministicId,
      title: cleanTitle,
      fileName: file.name,
      core: detected.core,
      system: detected.system,
      shortSystem: detected.shortSystem,
      engineType,
      coverGradient,
      real: true,
      fileSize: file.size,
    };

    try {
      await idbPut(newGame.id, file);
    } catch (err) {
      showToast('Could not store ROM for offline use');
    }
    setGames((prev) => {
      const nextGames = [newGame, ...prev.filter((g) => g.id !== newGame.id)];
      const userImportedOnly = nextGames.filter((g) => g.real && g.id !== 'pokemon_gold');
      idbPut('library_games', userImportedOnly).catch(() => {});
      return nextGames;
    });
    setSavesByGameId((prev) => ({
      ...prev,
      [newGame.id]: createEmptySlotsForGame(newGame.id)
    }));
    setDetailGame(newGame);
    soundFX.save();
    showToast(`Auto-Detected ${detected.shortSystem} ROM (${detected.core}): ${newGame.title}`);
    e.target.value = '';
  };

  const launchGame = useCallback((game: Game, optionalStateData: any = null) => {
    setActiveGame(game);
    if (optionalStateData && optionalStateData.engineState) {
      engineStateRef.current = JSON.parse(JSON.stringify(optionalStateData.engineState));
      setLiveScore(engineStateRef.current.score || 0);
      setLiveFrame(engineStateRef.current.frame || 0);
      showToast(`Loaded State (${optionalStateData.timestamp || 'Saved'}) • ${game.title}`);
    } else {
      engineStateRef.current = createInitialEngineState(game.engineType);
      setLiveScore(0);
      setLiveFrame(0);
      showToast(`Launching ${game.title} [${game.core}]`);
    }
    setRomUrl(null);
    hasUserInteractedRef.current = false;
    pendingStateRef.current = normalizeBinaryData(optionalStateData?.emuState) || null;
    pendingSrmRef.current = null;
    pendingRtcRef.current = null;
    if (game.real) {
      Promise.all([
        idbGet(game.id).catch(() => null),
        idbGet(`srm:${game.id}`).catch(() => null),
        idbGet(`rtc:${game.id}`).catch(() => null),
        optionalStateData?.emuState ? Promise.resolve(null) : idbGet(`autosave:${game.id}`).catch(() => null)
      ]).then(([blob, srm, rtc, autoSt]) => {
        if (srm) pendingSrmRef.current = normalizeBinaryData(srm);
        if (rtc) pendingRtcRef.current = normalizeBinaryData(rtc);
        if (!pendingStateRef.current && autoSt) pendingStateRef.current = normalizeBinaryData(autoSt);
        if (blob) setRomUrl(URL.createObjectURL(blob));
        else showToast('ROM data missing - please re-upload this game');
      });
    }
    rewindBufferRef.current = [];
    setIsPaused(false);
    setIsRewinding(false);
    setIsFastForward(false);
    setDetailGame(null);
    setInGameMenuOpen(false);
    setInGameSaveModalMode(null);
    setCurrentView('ingame');
    soundFX.save();
  }, [showToast]);

  const saveStateToGameSlot = useCallback((game: Game, slotNumber: number) => {
    if (game.real) {
      const win = emuFrameRef.current?.contentWindow as any;
      const emu = getEmu();
      let rawState = null;
      try { rawState = win?.getStateData?.() || emu?.gameManager.getState(); } catch (e) {}
      const emuState = normalizeBinaryData(rawState);
      if (!emuState) { showToast('Emulator not ready yet'); return; }
      let shot: string | null = null;
      try {
        shot = (emuFrameRef.current?.contentDocument?.querySelector('canvas') as HTMLCanvasElement)?.toDataURL('image/png') || null;
      } catch (e) {}
      const timeStr0 = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setSavesByGameId((prev) => {
        const existing = prev[game.id] || createEmptySlotsForGame(game.id);
        return {
          ...prev,
          [game.id]: existing.map((sl) =>
            sl.slot === slotNumber
              ? {
                  slot: slotNumber,
                  empty: false,
                  label: `Saved ${timeStr0}`,
                  timestamp: timeStr0,
                  score: 0,
                  frame: 0,
                  screenshot: shot,
                  stateData: { version: 'EJS_STATE', gameId: game.id, timestamp: timeStr0, emuState }
                }
              : sl
          )
        };
      });
      idbPut(`state:${game.id}:${slotNumber}`, {
        slot: slotNumber,
        label: `Saved ${timeStr0}`,
        timestamp: timeStr0,
        screenshot: shot,
        emuState
      }).catch(console.error);
      soundFX.save();
      showToast(`Saved ${game.title} → Slot #${slotNumber}`);
      return;
    }

    const canvas = canvasRef.current;
    const screenshot = canvas ? canvas.toDataURL('image/png') : createPrepopulatedThumbnail('overworld');
    const clonedEngine = JSON.parse(JSON.stringify(engineStateRef.current));
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    let customLabel = `Frame ${clonedEngine.frame} • Score ${clonedEngine.score}`;
    if (game.engineType === 'pokegold') {
      customLabel = clonedEngine.battle?.active
        ? `Wild ${clonedEngine.battle.enemyName} • Lv.${clonedEngine.pokeLevel}`
        : `Route 29 • Lv.${clonedEngine.pokeLevel} (${clonedEngine.caughtCount} Caught)`;
    }

    const statePayload = {
      version: 'RETRO_POCKET_V2',
      gameId: game.id,
      romFileName: game.fileName,
      core: game.core,
      timestamp: timeStr,
      savedAtISO: new Date().toISOString(),
      score: clonedEngine.score,
      frame: clonedEngine.frame,
      engineState: clonedEngine,
    };

    setSavesByGameId((prev) => {
      const existingSlots = prev[game.id] || createEmptySlotsForGame(game.id);
      const updated = existingSlots.map((s) =>
        s.slot === slotNumber
          ? {
              slot: slotNumber,
              empty: false,
              label: customLabel,
              timestamp: timeStr,
              score: clonedEngine.score,
              frame: clonedEngine.frame,
              screenshot,
              stateData: statePayload
            }
          : s
      );
      return { ...prev, [game.id]: updated };
    });

    idbPut(`state:${game.id}:${slotNumber}`, {
      slot: slotNumber,
      label: customLabel,
      timestamp: timeStr,
      screenshot,
      stateData: statePayload
    }).catch(console.error);

    soundFX.save();
    showToast(`Saved ${game.title} → Slot #${slotNumber}`);
  }, [showToast]);

  const loadStateFromGameSlot = useCallback((game: Game, slotNumber: number) => {
    const gameSlots = savesByGameId[game.id] || [];
    const targetSlot = gameSlots.find((s) => s.slot === slotNumber);
    if (!targetSlot || targetSlot.empty || !targetSlot.stateData) {
      showToast(`Slot #${slotNumber} is empty!`);
      return;
    }

    if (currentView !== 'ingame' || activeGame.id !== game.id) {
      launchGame(game, targetSlot.stateData);
      return;
    }
    if (game.real) {
      try {
        const stateToLoad = normalizeBinaryData(targetSlot.stateData.emuState);
        const win = emuFrameRef.current?.contentWindow as any;
        if (stateToLoad) {
          if (win?.loadStateData) {
            win.loadStateData(stateToLoad);
          } else {
            getEmu()?.gameManager.loadState(stateToLoad);
          }
        }
      } catch (e) {
        console.error(e);
      }
      setIsPaused(false);
      setInGameSaveModalMode(null);
      setInGameMenuOpen(false);
      soundFX.coin();
      showToast(`Loaded ${game.title} • Slot #${slotNumber}`);
      return;
    }

    engineStateRef.current = JSON.parse(JSON.stringify(targetSlot.stateData.engineState));
    setLiveScore(engineStateRef.current.score || 0);
    setLiveFrame(engineStateRef.current.frame || 0);
    setIsPaused(false);
    setInGameSaveModalMode(null);
    setInGameMenuOpen(false);
    soundFX.coin();
    showToast(`Loaded ${game.title} • Slot #${slotNumber}`);
  }, [activeGame.id, currentView, launchGame, savesByGameId, showToast]);

  const deleteGameSlot = useCallback((gameId: string, slotNumber: number) => {
    setSavesByGameId((prev) => {
      const existing = prev[gameId] || [];
      return {
        ...prev,
        [gameId]: existing.map((s) =>
          s.slot === slotNumber
            ? { slot: slotNumber, empty: true, label: 'Empty Slot', timestamp: null, score: 0, frame: 0, screenshot: null, stateData: null }
            : s
        )
      };
    });
    idbDelete(`state:${gameId}:${slotNumber}`).catch(console.error);
    showToast(`Cleared Slot #${slotNumber}`);
  }, [showToast]);

  const flushLiveProgress = useCallback(async () => {
    if (currentView !== 'ingame' || !activeGame?.id || !activeGame?.real) return;
    if (!hasUserInteractedRef.current) return;
    const win = emuFrameRef.current?.contentWindow as any;
    if (!win) return;
    const areBytesEqual = (a: Uint8Array | null, b: Uint8Array | null) => {
      if (!a || !b || a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    };
    try {
      const srm = normalizeBinaryData(win.getSrmData?.());
      if (srm && srm.length > 0) {
        let nonEmpty = false;
        for (let i = 0; i < srm.length; i += 4) {
          if (srm[i] !== 0 && srm[i] !== 255) { nonEmpty = true; break; }
        }
        if (nonEmpty) {
          const prevSrm = normalizeBinaryData(await idbGet(`srm:${activeGame.id}`).catch(() => null));
          if (!areBytesEqual(srm, prevSrm)) {
            await idbPut(`srm:${activeGame.id}`, srm).catch(() => {});
          }
        }
      }
      const rtc = normalizeBinaryData(win.getRtcData?.());
      if (rtc && rtc.length > 0) {
        const prevRtc = normalizeBinaryData(await idbGet(`rtc:${activeGame.id}`).catch(() => null));
        if (!areBytesEqual(rtc, prevRtc)) {
          await idbPut(`rtc:${activeGame.id}`, rtc).catch(() => {});
        }
      }
      const stArr = normalizeBinaryData(win.getStateData?.());
      if (stArr && stArr.length > 0) {
        const prevAuto = normalizeBinaryData(await idbGet(`autosave:${activeGame.id}`).catch(() => null));
        if (!areBytesEqual(stArr, prevAuto)) {
          await idbPut(`autosave:${activeGame.id}`, stArr).catch(() => {});
        }
      }
    } catch (e) {}
  }, [activeGame?.id, activeGame?.real, currentView]);

  useEffect(() => {
    if (currentView !== 'ingame' || !activeGame?.id || !activeGame?.real) return;
    const timer = setInterval(flushLiveProgress, 8000);
    const onHide = () => flushLiveProgress();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onHide);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onHide);
    };
  }, [activeGame?.id, activeGame?.real, currentView, flushLiveProgress]);

  const exportBatterySave = useCallback(async (game: Game, ext = 'sav') => {
    if (!game) return;
    const win = emuFrameRef.current?.contentWindow as any;
    let srmBytes: any = null;
    if (currentView === 'ingame' && activeGame?.id === game.id && win?.getSrmData) {
      try {
        srmBytes = win.getSrmData();
        if (srmBytes && srmBytes.length > 0) {
          await idbPut(`srm:${game.id}`, srmBytes).catch(() => {});
        }
      } catch (e) {}
    }
    if (!srmBytes || srmBytes.length === 0) {
      try {
        srmBytes = await idbGet(`srm:${game.id}`);
      } catch (e) {}
    }
    if (!srmBytes || srmBytes.length === 0) {
      showToast('No in-game battery save found yet — save inside the game first');
      return;
    }
    const baseName = (game.fileName || game.title || 'game').replace(/\.[^/.]+$/, '');
    const outName = `${baseName}.${ext}`;
    downloadBinaryFile(srmBytes, outName);
    soundFX.save();
    showToast(`Exported ${outName} (${(srmBytes.length / 1024).toFixed(1)} KB)`);
  }, [activeGame?.id, currentView, showToast]);

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (currentView !== 'ingame') return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (e.code === 'ArrowUp' || e.code === 'KeyW') setButtonDown('up');
      if (e.code === 'ArrowDown' || e.code === 'KeyS') setButtonDown('down');
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') setButtonDown('left');
      if (e.code === 'ArrowRight' || e.code === 'KeyD') setButtonDown('right');
      if (e.code === 'KeyX' || e.code === 'KeyL') setButtonDown('actionA');
      if (e.code === 'KeyZ' || e.code === 'KeyK') setButtonDown('actionB');
      if (e.code === 'KeyS') setButtonDown('actionX');
      if (e.code === 'KeyA') setButtonDown('actionY');
      if (e.code === 'Enter') setButtonDown('start');
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'Space') setButtonDown('select');
      if (e.code === 'KeyP') setIsPaused((p) => !p);
      if (e.code === 'KeyR' || e.code === 'Backspace') setIsRewinding(true);
      if (e.code === 'KeyF') setIsFastForward((f) => !f);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') setButtonUp('up');
      if (e.code === 'ArrowDown' || e.code === 'KeyS') setButtonUp('down');
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') setButtonUp('left');
      if (e.code === 'ArrowRight' || e.code === 'KeyD') setButtonUp('right');
      if (e.code === 'KeyX' || e.code === 'KeyL') setButtonUp('actionA');
      if (e.code === 'KeyZ' || e.code === 'KeyK') setButtonUp('actionB');
      if (e.code === 'KeyS') setButtonUp('actionX');
      if (e.code === 'KeyA') setButtonUp('actionY');
      if (e.code === 'Enter') setButtonUp('start');
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'Space') setButtonUp('select');
      if (e.code === 'KeyR' || e.code === 'Backspace') setIsRewinding(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [currentView, setButtonDown, setButtonUp]);

  // 60 FPS Emulation Engine & Canvas Renderer Loop
  useEffect(() => {
    if (currentView !== 'ingame') return;

    let animId: number;
    let frameCounter = 0;
    let fpsTimer = performance.now();

    const loop = (now: number) => {
      frameCounter++;
      if (now - fpsTimer >= 500) {
        const computedFps = Math.min(120, Math.round((frameCounter * 1000) / (now - fpsTimer)));
        setFps(isPaused ? 0 : isFastForward ? computedFps * 2 : computedFps);
        setLiveScore(engineStateRef.current.score || 0);
        setLiveFrame(engineStateRef.current.frame || 0);
        frameCounter = 0;
        fpsTimer = now;
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (!isPaused) {
          if (isRewinding && rewindBufferRef.current.length > 0) {
            const prevSnapshot = rewindBufferRef.current.pop();
            if (prevSnapshot) {
              engineStateRef.current = prevSnapshot;
            }
          } else {
            const steps = isFastForward ? 2 : 1;
            for (let s = 0; s < steps; s++) {
              stepGameFrame(engineStateRef.current, keysRef.current, EdgeTapRef);
              if (engineStateRef.current.frame % 3 === 0) {
                rewindBufferRef.current.push(JSON.parse(JSON.stringify(engineStateRef.current)));
                if (rewindBufferRef.current.length > 180) rewindBufferRef.current.shift();
              }
            }
          }
        }

        if (ctx) {
          drawGameCanvas(ctx, engineStateRef.current, activeGame, isRewinding, isFastForward);
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [activeGame, currentView, isFastForward, isPaused, isRewinding]);

  useEffect(() => {
    try {
      const win = emuFrameRef.current?.contentWindow as any;
      win?.setFastForward?.(isFastForward);
      const emu = getEmu();
      if (emu?.gameManager) {
        if (typeof emu.gameManager.setFastForwardRatio === 'function') emu.gameManager.setFastForwardRatio(2);
        if (typeof emu.gameManager.toggleFastForward === 'function') emu.gameManager.toggleFastForward(isFastForward ? 1 : 0);
      }
      Object.entries(keysRef.current).forEach(([k, down]) => {
        if (down) win?.simulateButton?.(k, true);
      });
    } catch (e) {}
  }, [isFastForward]);

  useEffect(() => {
    if (!activeGame.real) return;
    try { getEmu()?.gameManager.toggleRewind(isRewinding ? 1 : 0); } catch (e) {}
  }, [activeGame.real, isRewinding]);

  const filteredGames = useMemo(() => {
    return games.filter((g) => {
      if (systemFilter !== 'ALL' && g.shortSystem !== systemFilter) return false;
      if (
        searchQuery.trim() &&
        !g.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !g.system.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [games, systemFilter, searchQuery]);

  const bindPadButton = useCallback((keyName: string) => {
    const handleDown = (e: React.SyntheticEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setButtonDown(keyName);
    };

    const handleUp = (e: React.SyntheticEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setButtonUp(keyName);
    };

    return {
      onPointerDown: handleDown,
      onPointerUp: handleUp,
      onPointerCancel: handleUp,
      onTouchStart: handleDown,
      onTouchEnd: handleUp,
      onTouchCancel: handleUp,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    };
  }, [setButtonDown, setButtonUp]);

  return (
    <div className={`min-h-screen w-full ${shaders.amoled ? 'bg-black text-zinc-100' : theme.appBg} font-sans select-none overflow-x-hidden`}>
      {/* Hidden File Input for ROMs */}
      <input
        ref={romInputRef}
        type="file"
        accept=".gb,.gbc,.gba,.nes,.sfc,.smc,.md,.gen,.smd,.bin,.zip"
        onChange={handleRomUpload}
        className="hidden"
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-zinc-900/95 border border-emerald-500/50 text-emerald-300 text-xs font-medium shadow-2xl backdrop-blur-md">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* VIEW 1: HOME LIBRARY */}
      {currentView === 'home' && (
        <LibraryView
          games={games}
          filteredGames={filteredGames}
          theme={theme}
          showSearch={showSearch}
          setShowSearch={setShowSearch}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          systemFilter={systemFilter}
          setSystemFilter={setSystemFilter}
          onSelectGame={(g) => setDetailGame(g)}
          onLaunchGame={(g) => launchGame(g)}
          onOpenSettings={() => setGlobalSettingsOpen(true)}
          onTriggerAddRom={() => romInputRef.current?.click()}
        />
      )}

      {/* VIEW 2: IN-GAME HANDHELD EMULATOR */}
      {currentView === 'ingame' && (
        <InGameView
          activeGame={activeGame}
          theme={theme}
          shaders={shaders}
          romUrl={romUrl}
          isPaused={isPaused}
          setIsPaused={setIsPaused}
          isRewinding={isRewinding}
          setIsRewinding={setIsRewinding}
          isFastForward={isFastForward}
          setIsFastForward={setIsFastForward}
          isMuted={isMuted}
          toggleAudio={toggleAudio}
          inGameMenuOpen={inGameMenuOpen}
          setInGameMenuOpen={setInGameMenuOpen}
          topBarVisible={topBarVisible}
          revealTopBar={revealTopBar}
          flushLiveProgress={flushLiveProgress}
          setCurrentView={(v) => setCurrentView(v as any)}
          setInGameSaveModalMode={setInGameSaveModalMode}
          setGlobalSettingsOpen={setGlobalSettingsOpen}
          exportBatterySave={exportBatterySave}
          showToast={showToast}
          emuFrameRef={emuFrameRef}
          canvasRef={canvasRef}
          deckRef={deckRef}
          padLayout={padLayout}
          setPadLayout={setPadLayout}
          customizing={customizing}
          setCustomizing={setCustomizing}
          selectedPad={selectedPad}
          setSelectedPad={setSelectedPad}
          movePad={movePad}
          scalePad={scalePad}
          hidePad={hidePad}
          setHidePad={setHidePad}
          bindPadButton={bindPadButton}
          setButtonDown={setButtonDown}
          setButtonUp={setButtonUp}
          topBarTimer={topBarTimer}
        />
      )}

      {/* MODAL 1: SAVE SLOTS & CARTRIDGE MANAGER */}
      <SaveSlotsModal
        isOpen={Boolean(detailGame || (currentView === 'ingame' && inGameSaveModalMode))}
        onClose={() => {
          setDetailGame(null);
          setInGameSaveModalMode(null);
        }}
        targetGame={detailGame || activeGame}
        activeGame={activeGame}
        currentView={currentView}
        savesByGameId={savesByGameId}
        launchGame={launchGame}
        exportBatterySave={exportBatterySave}
        deleteRom={deleteRom}
        loadStateFromGameSlot={loadStateFromGameSlot}
        saveStateToGameSlot={saveStateToGameSlot}
        deleteGameSlot={deleteGameSlot}
      />

      {/* MODAL 2: APPEARANCE & SHADERS SETTINGS */}
      <SettingsModal
        isOpen={globalSettingsOpen}
        onClose={() => setGlobalSettingsOpen(false)}
        theme={theme}
        themeId={themeId}
        applyTheme={applyTheme}
        shaders={shaders}
        toggleShader={toggleShader}
      />
    </div>
  );
}
