import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import { Game, SaveSlot, PadLayout, PadGroupId, Theme } from './types';
import { CORE_MAP } from './constants/cores';
import { THEMES } from './constants/themes';
import {
  loadPadLayout,
  savePadLayout,
  getActiveSlot,
  setActiveSlot,
  LayoutSlot,
  EMU_INPUT_MAP,
  PAD_KEYS,
} from './constants/controls';
import { idbOpen, idbPut, idbGet, idbDelete, idbDeleteGameData } from './services/storage/idb';
import { soundFX } from './services/audio/synth';
import { haptics } from './services/haptics';
import { createEmptySlotsForGame, downloadBinaryFile } from './services/storage/saveSlots';
import {
  normalizeBinaryData,
  markLocalSaveModified,
  onDataUpdated,
  subscribeSyncStatus,
  mergeAndDeduplicateGames,
  CloudSyncStatus,
  getSyncCode,
  syncNow,
  recordDeletedGame,
  unrecordDeletedGame,
  getDeletedGameIds,
  setGameplayActive,
  SETTINGS_SYNC_KEY,
} from './cloudSync';
import { onBackupApplied } from './services/backup';

import { LibraryView } from './components/library/LibraryView';
import { InGameView } from './components/emulator/InGameView';
import { SettingsModal } from './components/modals/SettingsModal';
import { SaveSlotsModal } from './components/modals/SaveSlotsModal';
import { CloudSyncModal } from './components/modals/CloudSyncModal';
import { ControlsModal } from './components/modals/ControlsModal';
import { MissingRomModal } from './components/modals/MissingRomModal';
import { isZipFile, isZipBuffer, extractRomsFromZip } from './services/romArchive';
import { useGamepadInput } from './hooks/useGamepadInput';

const INITIAL_GAMES: Game[] = [];

function sanitizeGameList(rawList: any[]): Game[] {
  if (!Array.isArray(rawList)) return [];
  const deletedSet = new Set(getDeletedGameIds());
  const filtered = rawList.filter((g) => g && g.id && !deletedSet.has(g.id));
  const deduped = mergeAndDeduplicateGames(filtered, [], false);
  return deduped.map((g) => ({
    ...g,
    subtitle: (g.subtitle || g.system || '').replace(/\s*•\s*Auto-Detected Core/i, '')
  }));
}

interface SlotUpdateRecord {
  gId: string;
  slotN: number;
  key: string;
  val: any;
}

function applySlotUpdates(
  prev: Record<string, SaveSlot[]>,
  updates: SlotUpdateRecord[]
): Record<string, SaveSlot[]> {
  const next = { ...prev };
  let knownGames: any[] = [];
  try {
    knownGames = JSON.parse(localStorage.getItem('retro_games') || '[]') || [];
  } catch (e) {}

  for (const { gId, slotN, key, val } of updates) {
    const targetIds = new Set<string>([gId]);
    // Also map to any local game that matches by aliasIds, crc32, fileName, or title
    if (Array.isArray(knownGames)) {
      for (const g of knownGames) {
        if (!g?.id) continue;
        if (Array.isArray(g.aliasIds) && g.aliasIds.includes(gId)) {
          targetIds.add(String(g.id));
          continue;
        }
        if (
          val &&
          ((val.crc32 && g.crc32 && String(val.crc32).toLowerCase() === String(g.crc32).toLowerCase()) ||
            (val.fileName && g.fileName && String(val.fileName).toLowerCase() === String(g.fileName).toLowerCase()) ||
            (val.gameTitle && g.title && String(val.gameTitle).toLowerCase() === String(g.title).toLowerCase()))
        ) {
          targetIds.add(String(g.id));
        }
      }
    }

    for (const targetId of Array.from(targetIds)) {
      const list = next[targetId] || createEmptySlotsForGame(targetId);
      next[targetId] = list.map((s) =>
        s.slot === slotN
          ? val
            ? {
                slot: slotN,
                empty: false,
                label: val.label || `Slot #${slotN}`,
                timestamp: val.timestamp || '',
                score: 0,
                frame: 0,
                screenshot: val.screenshot || null,
                stateData: {
                  version: 'EJS_STATE',
                  gameId: targetId,
                  timestamp: val.timestamp,
                  lazyIdbKey: key,
                },
              }
            : {
                slot: slotN,
                empty: true,
                label: 'Empty Slot',
                timestamp: null,
                score: 0,
                frame: 0,
                screenshot: null,
                stateData: null,
              }
          : s
      );
    }
  }
  return next;
}

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
        return sanitizeGameList(saved);
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
  const prevRomUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevRomUrlRef.current && prevRomUrlRef.current !== romUrl) {
      URL.revokeObjectURL(prevRomUrlRef.current);
    }
    prevRomUrlRef.current = romUrl;
    return () => {
      if (prevRomUrlRef.current) {
        URL.revokeObjectURL(prevRomUrlRef.current);
      }
    };
  }, [romUrl]);
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

  const [slotNamesByGameId, setSlotNamesByGameId] = useState<Record<string, Record<number, string>>>(() => {
    try {
      return JSON.parse(localStorage.getItem('retro_slot_names') || '{}') || {};
    } catch (e) {
      return {};
    }
  });

  const renameGameSlot = useCallback((gameId: string, slotNum: number, name: string) => {
    setSlotNamesByGameId((prev) => {
      const forGame = { ...(prev[gameId] || {}) };
      if (name) forGame[slotNum] = name;
      else delete forGame[slotNum];
      const next = { ...prev, [gameId]: forGame };
      try {
        localStorage.setItem('retro_slot_names', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  }, []);

  // Custom cartridge artwork override → idb `cover:` key (already wired into the
  // cloud-sync + backup item pipeline) + immediate state for live render.
  const setGameCustomCover = useCallback((gameId: string, dataUrl: string | null) => {
    setGames((prev) =>
      prev.map((g) => (g.id === gameId ? { ...g, customCover: dataUrl || undefined } : g))
    );
    if (dataUrl) {
      idbPut(`cover:${gameId}`, dataUrl)
        .then(() => markLocalSaveModified(`cover:${gameId}`))
        .catch(() => {});
    } else {
      idbDelete(`cover:${gameId}`)
        .then(() => markLocalSaveModified(`cover:${gameId}`))
        .catch(() => {});
    }
  }, []);

  // Boot hydration: pull synced covers for games without a runtime customCover.
  const hydratedCoverIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pending = games.filter((g) => !g.customCover && !hydratedCoverIdsRef.current.has(g.id));
      if (pending.length === 0) return;
      pending.forEach((g) => hydratedCoverIdsRef.current.add(g.id));
      const found: Record<string, string> = {};
      await Promise.all(
        pending.map(async (g) => {
          try {
            const val = await idbGet(`cover:${g.id}`);
            if (typeof val === 'string' && val.startsWith('data:image')) found[g.id] = val;
          } catch (e) {}
        })
      );
      if (cancelled || Object.keys(found).length === 0) return;
      setGames((prev) =>
        prev.map((g) => (found[g.id] && !g.customCover ? { ...g, customCover: found[g.id] } : g))
      );
    })();
    return () => { cancelled = true; };
  }, [games]);

  // Modals & Drawers
  const [detailGame, setDetailGame] = useState<Game | null>(null);
  const [globalSettingsOpen, setGlobalSettingsOpen] = useState(false);
  const [controlsModalOpen, setControlsModalOpen] = useState(false);
  const [inGameMenuOpen, setInGameMenuOpen] = useState(false);
  const [inGameSaveModalMode, setInGameSaveModalMode] = useState<'save' | 'load' | null>(null);
  const [cloudModalOpen, setCloudModalOpen] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>('unlinked');
  const [missingRomData, setMissingRomData] = useState<{ game: Game; optionalStateData?: any } | null>(null);

  useEffect(() => {
    const unsub = subscribeSyncStatus((st) => setCloudStatus(st));
    return () => unsub();
  }, []);

  // Auto-sync on startup if a Sync Code is linked
  useEffect(() => {
    const code = getSyncCode();
    if (code && typeof navigator !== 'undefined' && navigator.onLine) {
      syncNow().catch((err) => console.warn('[CloudSync] Startup sync warning:', err));
    }
  }, []);

  // Restore library from IndexedDB if localStorage was empty
  useEffect(() => {
    if (games.length === 0) {
      idbGet('library_games').then((saved) => {
        if (Array.isArray(saved) && saved.length > 0) {
          setGames(sanitizeGameList(saved));
        }
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const refreshGameList = () => {
      try {
        const applyGameList = (list: any[]) => {
          if (!Array.isArray(list)) return;
          const sanitized = sanitizeGameList(list);
          setGames(sanitized);
          setSavesByGameId((prev) => {
            const next = { ...prev };
            sanitized.forEach((g) => {
              if (!next[g.id]) next[g.id] = createEmptySlotsForGame(g.id);
            });
            return next;
          });
          // Re-bind any save states in IndexedDB (including alias IDs) to the updated game list
          (async () => {
            try {
              const db = await idbOpen();
              const tx = db.transaction('roms', 'readonly');
              const store = tx.objectStore('roms');
              const req = store.openCursor();
              const pendingSlots: Array<{ gId: string; slotN: number; key: string; val: any }> = [];
              req.onsuccess = (e) => {
                const cursor = (e.target as IDBRequest).result;
                if (cursor) {
                  const key = String(cursor.key);
                  if (key.startsWith('state:')) {
                    const parts = key.split(':');
                    const slotN = parseInt(parts[parts.length - 1], 10);
                    const gId = parts.slice(1, parts.length - 1).join(':');
                    const val = cursor.value;
                    if (val && gId && slotN) {
                      pendingSlots.push({ gId, slotN, key, val });
                    }
                  }
                  cursor.continue();
                } else if (pendingSlots.length > 0) {
                  setSavesByGameId((prev) => applySlotUpdates(prev, pendingSlots));
                }
              };
            } catch (err) {}
          })();
        };

        let saved: any[] | null = null;
        try {
          saved = JSON.parse(localStorage.getItem('retro_games') || 'null');
        } catch (e) {}

        if (Array.isArray(saved) && saved.length > 0) {
          applyGameList(saved);
        } else {
          idbGet('library_games').then((idbList) => {
            if (Array.isArray(idbList)) {
              applyGameList(idbList);
            }
          }).catch(() => {});
        }
      } catch (e) {}
    };

    const handleUpdatedKeys = (keys: string[]) => {
      if (
        keys.includes('retro_games') ||
        keys.includes('library_games') ||
        keys.includes('retro_deleted_games') ||
        keys.includes('deleted_games')
      ) {
        refreshGameList();
      }
      // Live settings application when preferences arrive from Drive
      if (keys.includes(SETTINGS_SYNC_KEY)) {
        try {
          const t = localStorage.getItem('retro_theme');
          if (t) setThemeId(t);
        } catch (e) {}
        setShaders((prev: Record<string, any>) => {
          try {
            const saved = localStorage.getItem('retro_shaders');
            if (!saved) return prev;
            const incoming = { ...prev, ...JSON.parse(saved) };
            return JSON.stringify(incoming) === JSON.stringify(prev) ? prev : incoming;
          } catch (err) {
            return prev;
          }
        });
      }
      const stateKeys = keys.filter((k) => k.startsWith('state:'));
      if (stateKeys.length > 0) {
        (async () => {
          const updates: Array<{ gId: string; slotN: number; key: string; val: any }> = [];
          for (const key of stateKeys) {
            const parts = key.split(':');
            const slotN = parseInt(parts[parts.length - 1], 10);
            const gId = parts.slice(1, parts.length - 1).join(':');
            const val = await idbGet(key).catch(() => null);
            if (gId && slotN) {
              updates.push({ gId, slotN, key, val });
            }
          }
          if (updates.length > 0) {
            setSavesByGameId((prev) => applySlotUpdates(prev, updates));
          }
        })();
      }
    };

    const unsubSync = onDataUpdated(handleUpdatedKeys);
    const unsubBackup = onBackupApplied(handleUpdatedKeys);

    return () => {
      unsubSync();
      unsubBackup();
    };
  }, []);

  // Theme & Combinable Shader Pipeline State (Auto-saved to localStorage)
  const [themeId, setThemeId] = useState(() => {
    try {
      return localStorage.getItem('retro_theme') || 'midnight';
    } catch (e) {
      return 'midnight';
    }
  });

  const [shaders, setShaders] = useState<Record<string, any>>(() => {
    const defaultShaders: Record<string, any> = {
      scanlines: true,
      rgbBloom: true,
      bezelVignette: true,
      crtCurve: true,
      gbGrid: false,
      amoled: false,
      edgeToEdge: false,
      colorCorrection: true,
      colorProfile: 'vivid',
    };
    try {
      const saved = localStorage.getItem('retro_shaders');
      return saved ? { ...defaultShaders, ...JSON.parse(saved) } : defaultShaders;
    } catch (e) {
      return defaultShaders;
    }
  });

  const [hapticsEnabled, setHapticsEnabled] = useState(() => haptics.isEnabled());

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
        const pendingSlots: Array<{ gId: string; slotN: number; key: string; val: any }> = [];
        req.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest).result;
          if (cursor) {
            const key = String(cursor.key);
            if (key.startsWith('state:')) {
              const parts = key.split(':');
              const slotN = parseInt(parts[parts.length - 1], 10);
              const gId = parts.slice(1, parts.length - 1).join(':');
              const val = cursor.value;
              if (val && gId && slotN) {
                pendingSlots.push({ gId, slotN, key, val });
              }
            }
            cursor.continue();
          } else {
            // Cursor complete: single batched state update
            if (pendingSlots.length > 0) {
              setSavesByGameId((prev) => applySlotUpdates(prev, pendingSlots));
            }
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
  // 0 = off; 2 / 3 / 4 / 8 = fast-forward multiplier
  const [ffSpeed, setFfSpeed] = useState<number>(0);
  const currentSystemKey = 'default';

  useEffect(() => {
    const active = currentView === 'ingame' && !isPaused;
    (window as any).__retroGameplayActive = currentView === 'ingame';
    setGameplayActive(active);
    return () => {
      if (currentView !== 'ingame') {
        (window as any).__retroGameplayActive = false;
        setGameplayActive(false);
      }
    };
  }, [currentView, isPaused]);

  const [hidePad, setHidePad] = useState(false);
  const [slotPortrait, setSlotPortrait] = useState<LayoutSlot>(() => getActiveSlot(false, currentSystemKey));
  const [slotLandscape, setSlotLandscape] = useState<LayoutSlot>(() => getActiveSlot(true, currentSystemKey));
  const [padLayoutPortrait, setPadLayoutPortrait] = useState<PadLayout>(() => loadPadLayout(false, getActiveSlot(false, currentSystemKey), currentSystemKey));
  const [padLayoutLandscape, setPadLayoutLandscape] = useState<PadLayout>(() => loadPadLayout(true, getActiveSlot(true, currentSystemKey), currentSystemKey));

  // Landscape overlay button transparency (0.15–1.0), device-local
  const [padOpacity, setPadOpacity] = useState<number>(() => {
    try {
      const v = parseFloat(localStorage.getItem('retro_pad_opacity') || '0.85');
      return Number.isFinite(v) ? Math.min(1, Math.max(0.15, v)) : 0.85;
    } catch (e) { return 0.85; }
  });
  const changePadOpacity = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0.15, v));
    setPadOpacity(clamped);
    try { localStorage.setItem('retro_pad_opacity', String(clamped)); } catch (e) {}
  }, []);
  const [customizing, setCustomizing] = useState(false);
  const [selectedPad, setSelectedPad] = useState<PadGroupId>('dpad');
  const deckRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    savePadLayout(false, slotPortrait, padLayoutPortrait, currentSystemKey);
  }, [slotPortrait, padLayoutPortrait, currentSystemKey]);

  useEffect(() => {
    savePadLayout(true, slotLandscape, padLayoutLandscape, currentSystemKey);
  }, [slotLandscape, padLayoutLandscape, currentSystemKey]);

  useEffect(() => {
    const handleLayoutUpdate = () => {
      const sp = getActiveSlot(false, currentSystemKey);
      const sl = getActiveSlot(true, currentSystemKey);
      setSlotPortrait(sp);
      setSlotLandscape(sl);
      setPadLayoutPortrait(loadPadLayout(false, sp, currentSystemKey));
      setPadLayoutLandscape(loadPadLayout(true, sl, currentSystemKey));
    };
    window.addEventListener('retro_layout_updated', handleLayoutUpdate);
    return () => window.removeEventListener('retro_layout_updated', handleLayoutUpdate);
  }, [currentSystemKey]);

  const switchSlotPortrait = useCallback((slot: LayoutSlot) => {
    setSlotPortrait(slot);
    setActiveSlot(false, slot, currentSystemKey);
    setPadLayoutPortrait(loadPadLayout(false, slot, currentSystemKey));
  }, [currentSystemKey]);

  const switchSlotLandscape = useCallback((slot: LayoutSlot) => {
    setSlotLandscape(slot);
    setActiveSlot(true, slot, currentSystemKey);
    setPadLayoutLandscape(loadPadLayout(true, slot, currentSystemKey));
  }, [currentSystemKey]);

  const [recentGameIds, setRecentGameIds] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('retro_recent_games') || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });

  const recordRecentGame = useCallback((gameId: string) => {
    setRecentGameIds((prev) => {
      const next = [gameId, ...prev.filter((id) => id !== gameId)].slice(0, 10);
      try {
        localStorage.setItem('retro_recent_games', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  }, []);

  const isFirstMountRef = useRef(true);

  useEffect(() => {
    // Durable backup to IndexedDB so libraries exceeding localStorage 5MB quota never get lost
    const userImportedOnly = games.filter((g) => g.real && g.id !== 'pokemon_gold');
    idbPut('library_games', userImportedOnly).catch(() => {});

    try {
      localStorage.setItem('retro_games', JSON.stringify(games));
      if (isFirstMountRef.current) {
        isFirstMountRef.current = false;
        return;
      }
      if (games.length > 0) {
        markLocalSaveModified('library_games');
        markLocalSaveModified('retro_games');
      }
    } catch (e) {
      console.warn('[Storage] localStorage quota reached; library preserved in IndexedDB');
    }
  }, [games]);

  const getEmu = () => {
    try { return (emuFrameRef.current?.contentWindow as any)?.EJS_emulator || null; } catch (e) { return null; }
  };

  const sendKey = useCallback((name: string, down: boolean) => {
    if (down) {
      hasUserInteractedRef.current = true;
      try {
        const win = emuFrameRef.current?.contentWindow as any;
        if (typeof win?.unlockAudio === 'function') win.unlockAudio();
      } catch (e) {}
    }
    const win = emuFrameRef.current?.contentWindow as any;
    if (!win) return;

    const idx = EMU_INPUT_MAP[name];
    try {
      if (idx !== undefined && typeof win.setButtonBit === 'function') {
        win.setButtonBit(idx, down);
        return;
      }
      if (typeof win.simulateButton === 'function') {
        win.simulateButton(name, down);
        return;
      }
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
      } catch (e) {}
    }
  }, []);

  const setButtonDown = useCallback((name: string) => {
    keysRef.current[name] = true;
    sendKey(name, true);
    if (['up', 'down', 'left', 'right'].includes(name)) {
      haptics.dpad();
    } else {
      haptics.tap();
    }
  }, [sendKey]);

  const setButtonUp = useCallback((name: string) => {
    keysRef.current[name] = false;
    sendKey(name, false);
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
            markLocalSaveModified(`srm:${activeGame.id}`).catch(() => {});
          }
        }
        return;
      }
      if (e.data?.type !== 'ejs-ready') return;
      const win = emuFrameRef.current?.contentWindow as any;
      try { win?.setAudioMuted?.(isMuted); } catch (err) {}

      if (pendingStateRef.current) {
        const st = pendingStateRef.current;
        pendingStateRef.current = null;
        pendingSrmRef.current = null;
        pendingRtcRef.current = null;
        const stateToLoad = normalizeBinaryData(st);
        if (stateToLoad) {
          setTimeout(() => {
            try {
              const w = emuFrameRef.current?.contentWindow as any;
              if (w?.loadStateData) {
                w.loadStateData(stateToLoad);
              } else if (w?.EJS_emulator?.gameManager?.loadState) {
                w.EJS_emulator.gameManager.loadState(stateToLoad);
              }
            } catch (err) {
              console.error('Failed to load pending state:', err);
            }
          }, 300);
        }
      } else if (pendingSrmRef.current || pendingRtcRef.current) {
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
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [activeGame?.id, isMuted]);

  const [fps, setFps] = useState(60);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  const romInputRef = useRef<HTMLInputElement | null>(null);

  // Hold watchdog: some browser/emulator paths silently drop a latched button
  // mid-hold (tap works, hold dies). Re-assert every held key while playing;
  // simulateInput with the same value is idempotent, so this can't mispress.
  useEffect(() => {
    if (currentView !== 'ingame') return;
    const id = setInterval(() => {
      const win = emuFrameRef.current?.contentWindow as any;
      if (!win) return;
      for (const [name, held] of Object.entries(keysRef.current)) {
        if (held) sendKey(name, true);
      }
    }, 250);
    return () => clearInterval(id);
  }, [currentView, sendKey]);

  const theme = THEMES[themeId] || THEMES.midnight;

  useEffect(() => {
    const root = document.documentElement;
    const isLight = !!theme.isLight;
    if (isLight) {
      root.classList.remove('dark');
      root.classList.add('light');
      root.style.colorScheme = 'light';
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    }

    const themeColor = isLight ? '#eae6dd' : (shaders.amoled ? '#000000' : '#0a0a0c');
    document.body.style.backgroundColor = themeColor;

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', themeColor);
    }
  }, [theme.isLight, shaders.amoled]);

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
    markLocalSaveModified(SETTINGS_SYNC_KEY).catch(() => {});
    showToast(`Theme Applied: ${THEMES[id]?.name || id}`);
  };

  const toggleShader = (key: string) => {
    setShaders((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem('retro_shaders', JSON.stringify(next)); } catch (e) {}
      if (key === 'amoled') {
        showToast(next.amoled ? 'AMOLED Battery Saver Activated (Pure Black)' : 'AMOLED Mode Disabled');
      } else if (key === 'edgeToEdge') {
        showToast(next.edgeToEdge ? 'Edge-to-Edge Bezel-less Screen: Enabled' : 'Edge-to-Edge Screen: Disabled (Standard Bezel)');
      } else if (key === 'colorCorrection') {
        showToast(next.colorCorrection ? 'RetroArch Colors: Vivid Saturation & Contrast' : 'RetroArch Colors: Disabled (Raw RGB)');
      }
      return next;
    });
    markLocalSaveModified(SETTINGS_SYNC_KEY).catch(() => {});
  };

  const setColorProfile = (profile: string) => {
    setShaders((prev) => {
      const next = { ...prev, colorProfile: profile, colorCorrection: profile !== 'off' };
      try { localStorage.setItem('retro_shaders', JSON.stringify(next)); } catch (e) {}
      showToast(`Color Profile: ${profile.toUpperCase()}`);
      return next;
    });
    markLocalSaveModified(SETTINGS_SYNC_KEY).catch(() => {});
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

  const handleRomSelectedForMissingGame = async (file: File) => {
    if (!missingRomData) return;
    const { game, optionalStateData } = missingRomData;
    try {
      let romFile = file;
      let isZip = isZipFile(file);
      if (!isZip) {
        const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
        if (isZipBuffer(header)) isZip = true;
      }

      if (isZip) {
        showToast('Extracting ROM from zip...');
        const extracted = await extractRomsFromZip(file);
        if (!extracted.length) {
          showToast('No supported ROM found in zip file');
          return;
        }
        const match =
          extracted.find((r) => r.name.toLowerCase() === game.fileName?.toLowerCase()) ||
          extracted.find((r) => r.name.toLowerCase().includes(game.title.toLowerCase())) ||
          extracted[0];
        romFile = match;
      }

      await idbPut(game.id, romFile);
      // Make the restored ROM available in the cloud vault (if ROM sync is on)
      markLocalSaveModified(`rom:${game.id}`).catch(() => {});
      setMissingRomData(null);
      showToast(`Linked ROM for ${game.title}! Launching...`);
      launchGame(game, optionalStateData);
    } catch (e) {
      showToast('Could not store ROM file on this device');
    }
  };

  const deleteRom = useCallback(async (gameId: string) => {
    // 1. Record tombstone so this game never resurrects across devices
    recordDeletedGame(gameId);

    // 2. Clean up all IndexedDB keys for this game
    await idbDeleteGameData(gameId);

    // 3. Update state and localStorage
    setGames((prev) => {
      const remaining = prev.filter((g) => g.id !== gameId);
      const userImportedOnly = remaining.filter((g) => g.real && g.id !== 'pokemon_gold');
      localStorage.setItem('retro_games', JSON.stringify(remaining));
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

    // 4. Mark modified to trigger instant sync
    markLocalSaveModified('retro_games');
    markLocalSaveModified('library_games');
    markLocalSaveModified('retro_deleted_games');

    showToast('ROM deleted from library');
  }, [showToast]);

  const importRomFiles = async (files: File[]) => {
    if (!files.length) return;

    const cartridgeTones = [
      'bg-[#18181c]',
      'bg-[#1c1a18]',
      'bg-[#161a1a]',
      'bg-[#1f1b20]'
    ];

    const coreToEngine: Record<string, string> = {
      gambatte: 'pokegold',
      fceumm: 'cyberrun',
      snes9x: 'starblade',
      genesis_plus_gx: 'starblade',
      mgba: 'neondrift',
    };

    const newGamesToAdd: { game: Game; file: File; detected: any }[] = [];

    for (let index = 0; index < files.length; index++) {
      const file = files[index];
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
      const engineType = coreToEngine[detected.core] || 'pokegold';
      const coverGradient = cartridgeTones[(games.length + index) % cartridgeTones.length];
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');

      const existingGame = games.find(
        (g: any) =>
          (g.crc32 && String(g.crc32).toLowerCase() === String(crcHex).toLowerCase()) ||
          (g.fileName && g.fileName.toLowerCase() === file.name.toLowerCase()) ||
          (g.title && g.title.toLowerCase() === cleanTitle.toLowerCase() && g.core === detected.core)
      );

      const deterministicId =
        existingGame?.id ||
        (crcHex && crcHex !== '00000000' ? `rom_${String(crcHex).toLowerCase()}` : `rom_${Date.now()}_${index}`);

      const newGame: Game = {
        id: deterministicId,
        title: cleanTitle,
        fileName: file.name,
        core: detected.core,
        system: detected.system,
        shortSystem: detected.shortSystem,
        engineType,
        coverGradient: existingGame?.coverGradient || coverGradient,
        real: true,
        fileSize: file.size,
        crc32: crcHex,
      };

      unrecordDeletedGame(newGame.id);

      try {
        await idbPut(newGame.id, file);
        // Queue the ROM binary itself for the cloud vault (if ROM sync is on)
        markLocalSaveModified(`rom:${newGame.id}`).catch(() => {});
      } catch (err) {
        showToast('Could not store ROM for offline use');
      }

      newGamesToAdd.push({ game: newGame, file, detected });
    }

    if (!newGamesToAdd.length) return;

    markLocalSaveModified('library_games');
    markLocalSaveModified('retro_games');

    const addedIds = new Set(newGamesToAdd.map((n) => n.game.id));
    const addedFileNames = new Set(newGamesToAdd.map((n) => n.game.fileName.toLowerCase()));

    setGames((prev) => {
      const remaining = prev.filter(
        (g) =>
          !addedIds.has(g.id) &&
          !addedFileNames.has(String(g.fileName || '').toLowerCase()) &&
          !newGamesToAdd.some(
            (n) =>
              n.game.title.toLowerCase() === String(g.title || '').toLowerCase() &&
              n.game.core === g.core
          )
      );
      const nextGames = [...newGamesToAdd.map((n) => n.game), ...remaining];
      const userImportedOnly = nextGames.filter((g) => g.real && g.id !== 'pokemon_gold');
      localStorage.setItem('retro_games', JSON.stringify(nextGames));
      idbPut('library_games', userImportedOnly).catch(() => {});
      return nextGames;
    });

    setSavesByGameId((prev) => {
      const next = { ...prev };
      for (const item of newGamesToAdd) {
        if (!next[item.game.id]) {
          next[item.game.id] = createEmptySlotsForGame(item.game.id);
        }
      }
      return next;
    });

    const firstItem = newGamesToAdd[0];
    setDetailGame(firstItem.game);
    soundFX.save();

    if (newGamesToAdd.length === 1) {
      showToast(`Auto-Detected ${firstItem.detected.shortSystem} ROM (${firstItem.detected.core}): ${firstItem.game.title}`);
    } else {
      showToast(`Imported ${newGamesToAdd.length} ROMs into library`);
    }
  };

  const handleRomUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;
    e.target.value = '';

    const romsToImport: File[] = [];

    for (const file of selectedFiles) {
      let isZip = isZipFile(file);
      if (!isZip) {
        const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
        if (isZipBuffer(header)) isZip = true;
      }

      if (isZip) {
        try {
          const extracted = await extractRomsFromZip(file);
          if (extracted.length === 0) {
            showToast(`No supported ROM found in ${file.name}`);
          } else {
            romsToImport.push(...extracted);
          }
        } catch (err) {
          showToast(`Failed to unzip ${file.name}: invalid or corrupt archive`);
        }
      } else {
        romsToImport.push(file);
      }
    }

    if (romsToImport.length > 0) {
      await importRomFiles(romsToImport);
    }
  };

  const launchGame = useCallback((game: Game, optionalStateData: any = null) => {
    recordRecentGame(game.id);
    if (game.real) {
      const hasSlotTarget = Boolean(optionalStateData?.emuState || optionalStateData?.lazyIdbKey);
      Promise.all([
        idbGet(game.id).catch(() => null),
        idbGet(`srm:${game.id}`).catch(() => null),
        idbGet(`rtc:${game.id}`).catch(() => null),
        hasSlotTarget ? Promise.resolve(null) : idbGet(`autosave:${game.id}`).catch(() => null),
        !optionalStateData?.emuState && optionalStateData?.lazyIdbKey
          ? idbGet(optionalStateData.lazyIdbKey).catch(() => null)
          : Promise.resolve(null)
      ]).then(([blob, srm, rtc, autoSt, lazySlotRec]) => {
        if (!blob) {
          // ROM binary not on this device yet! Prompt user to select file
          setMissingRomData({ game, optionalStateData });
          return;
        }

        setActiveGame(game);
        if (hasSlotTarget) {
          showToast(`Loaded State (${optionalStateData?.timestamp || 'Saved'}) • ${game.title}`);
        } else {
          showToast(`Launching ${game.title} [${game.core}]`);
        }

        const resolvedSlotState = normalizeBinaryData(
          optionalStateData?.emuState ||
          lazySlotRec?.emuState ||
          lazySlotRec?.emuStateBase64 ||
          lazySlotRec?.stateData?.emuState
        );

        setRomUrl(URL.createObjectURL(blob));
        hasUserInteractedRef.current = false;
        const normAuto = autoSt ? normalizeBinaryData(autoSt) : null;
        pendingStateRef.current = resolvedSlotState || normAuto;
        pendingSrmRef.current = srm ? normalizeBinaryData(srm) : null;
        pendingRtcRef.current = rtc ? normalizeBinaryData(rtc) : null;

        setIsPaused(false);
        setIsRewinding(false);
        setFfSpeed(0);
        setDetailGame(null);
        setInGameMenuOpen(false);
        setInGameSaveModalMode(null);
        setCurrentView('ingame');
        soundFX.save();
      });
      return;
    }

    showToast('Select a ROM file to launch');
  }, [recordRecentGame, showToast]);

  const saveStateToGameSlot = useCallback(async (game: Game, slotNumber: number) => {
    if (game.real) {
      const win = emuFrameRef.current?.contentWindow as any;
      const emu = getEmu();
      let rawState = null;
      try { rawState = win?.getStateData?.() || emu?.gameManager?.getState(); } catch (e) {}
      const emuState = normalizeBinaryData(rawState);
      if (!emuState) { showToast('Emulator not ready yet'); return; }

      let shot: string | null = null;
      try {
        if (typeof win?.captureGameScreenshot === 'function') {
          shot = await win.captureGameScreenshot();
        }
      } catch (e) {}

      if (!shot) {
        try {
          const doc = emuFrameRef.current?.contentDocument;
          const canvases = Array.from(doc?.querySelectorAll('canvas') || []) as HTMLCanvasElement[];
          let best: HTMLCanvasElement | null = null;
          let maxArea = 0;
          for (const c of canvases) {
            const area = (c.width || 0) * (c.height || 0);
            if (area > maxArea && c.style.display !== 'none') {
              maxArea = area;
              best = c;
            }
          }
          if (best && best.width > 0 && best.height > 0) {
            const maxW = 320;
            let w = best.width;
            let h = best.height;
            if (w > maxW) {
              const s = maxW / w;
              w = Math.round(w * s);
              h = Math.round(h * s);
            }
            const thumb = document.createElement('canvas');
            thumb.width = w;
            thumb.height = h;
            const ctx = thumb.getContext('2d');
            if (ctx) {
              ctx.imageSmoothingEnabled = true;
              ctx.drawImage(best, 0, 0, w, h);
              shot = thumb.toDataURL('image/jpeg', 0.85);
            } else {
              shot = best.toDataURL('image/jpeg', 0.85);
            }
          }
        } catch (e) {}
      }

      if (!shot) {
        shot = game.customCover || game.cover || null;
      }

      const timeStr0 = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const slotIdbKey = `state:${game.id}:${slotNumber}`;
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
                  // Store lightweight IDB pointer instead of retaining 25MB Uint8Array in React heap
                  stateData: { version: 'EJS_STATE', gameId: game.id, timestamp: timeStr0, lazyIdbKey: slotIdbKey }
                }
              : sl
          )
        };
      });
      idbPut(slotIdbKey, {
        slot: slotNumber,
        gameId: game.id,
        gameTitle: game.title,
        fileName: game.fileName,
        crc32: game.crc32,
        label: `Saved ${timeStr0}`,
        timestamp: timeStr0,
        screenshot: shot,
        emuState
      }).then(() => markLocalSaveModified(slotIdbKey)).catch(console.error);
      soundFX.save();
      showToast(`Saved ${game.title} → Slot #${slotNumber}`);
      return;
    }
  }, [showToast]);

  const loadStateFromGameSlot = useCallback(async (game: Game, slotNumber: number) => {
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
        let raw = targetSlot.stateData.emuState;
        if (!raw && targetSlot.stateData.lazyIdbKey) {
          const rec = await idbGet(targetSlot.stateData.lazyIdbKey).catch(() => null);
          raw = rec?.emuState || rec?.emuStateBase64 || rec?.stateData?.emuState;
        }
        const stateToLoad = normalizeBinaryData(raw);
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
    idbDelete(`state:${gameId}:${slotNumber}`)
      .then(() => markLocalSaveModified(`state:${gameId}:${slotNumber}`))
      .catch(console.error);
    showToast(`Cleared Slot #${slotNumber}`);
  }, [showToast]);

  const flushLiveProgress = useCallback(async (includeFullState = true) => {
    if (currentView !== 'ingame' || !activeGame?.id || !activeGame?.real) return;
    if (!hasUserInteractedRef.current) return;
    const win = emuFrameRef.current?.contentWindow as any;
    if (!win) return;
    const areBytesEqual = (a: Uint8Array | null, b: Uint8Array | null) => {
      if (!a || !b || a.length !== b.length) return false;
      const step = a.length > 65536 ? 16 : 1;
      for (let i = 0; i < a.length; i += step) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    };
    try {
      const srm = normalizeBinaryData(win.getSrmData?.(false));
      if (srm && srm.length > 0) {
        let nonEmpty = false;
        for (let i = 0; i < srm.length; i += 4) {
          if (srm[i] !== 0 && srm[i] !== 255) { nonEmpty = true; break; }
        }
        if (nonEmpty) {
          const prevSrm = normalizeBinaryData(await idbGet(`srm:${activeGame.id}`).catch(() => null));
          if (!areBytesEqual(srm, prevSrm)) {
            await idbPut(`srm:${activeGame.id}`, srm).catch(() => {});
            markLocalSaveModified(`srm:${activeGame.id}`);
          }
        }
      }
      const rtc = normalizeBinaryData(win.getRtcData?.());
      if (rtc && rtc.length > 0) {
        const prevRtc = normalizeBinaryData(await idbGet(`rtc:${activeGame.id}`).catch(() => null));
        if (!areBytesEqual(rtc, prevRtc)) {
          await idbPut(`rtc:${activeGame.id}`, rtc).catch(() => {});
          markLocalSaveModified(`rtc:${activeGame.id}`);
        }
      }
      if (includeFullState) {
        const stArr = normalizeBinaryData(win.getStateData?.());
        if (stArr && stArr.length > 0) {
          const prevAuto = normalizeBinaryData(await idbGet(`autosave:${activeGame.id}`).catch(() => null));
          if (!areBytesEqual(stArr, prevAuto)) {
            await idbPut(`autosave:${activeGame.id}`, stArr).catch(() => {});
            markLocalSaveModified(`autosave:${activeGame.id}`);
          }
        }
      }
    } catch (e) {}
  }, [activeGame?.core, activeGame?.id, activeGame?.real, activeGame?.shortSystem, currentView]);

  const handleReturnHome = useCallback(async () => {
    setInGameMenuOpen(false);

    // 1. Flush current game's SRAM/RTC and autosave while iframe is still mounted
    try {
      await flushLiveProgress(true);
    } catch (e) {
      console.warn('[App] flushLiveProgress on return home warning:', e);
    }

    // 2. Teardown active emulator instance so no loops or audio linger
    try {
      const win = emuFrameRef.current?.contentWindow as any;
      if (typeof win?.destroyEmulator === 'function') {
        win.destroyEmulator();
      } else if (win?.EJS_emulator?.gameManager?.toggleMainLoop) {
        win.EJS_emulator.gameManager.toggleMainLoop(0);
      }
      if (typeof win?.setAudioMuted === 'function') win.setAudioMuted(true);
      if (emuFrameRef.current) emuFrameRef.current.src = 'about:blank';
    } catch (e) {}
    setRomUrl(null);

    // 3. Switch back to library view
    setCurrentView('home');

    // 4. Mark gameplay inactive so cloud sync isn't deferred
    (window as any).__retroGameplayActive = false;
    setGameplayActive(false);

    // 5. Auto-sync saves to cloud vault if a sync code is linked and online
    const code = getSyncCode();
    if (code && typeof navigator !== 'undefined' && navigator.onLine) {
      syncNow().catch((err) => {
        console.warn('[CloudSync] Auto-sync on return to library warning:', err);
      });
    }
  }, [flushLiveProgress]);

  useEffect(() => {
    if (currentView !== 'ingame' || !activeGame?.id || !activeGame?.real) return;
    const timer = setInterval(() => {
      flushLiveProgress(true);
    }, 15000);
    const onHide = () => {
      flushLiveProgress(true);
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onHide);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onHide);
    };
  }, [activeGame?.core, activeGame?.id, activeGame?.real, activeGame?.shortSystem, currentView, flushLiveProgress]);

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
    let normalized = normalizeBinaryData(srmBytes);
    if (!normalized || normalized.length === 0) {
      showToast('No in-game battery save found yet — save inside the game first');
      return;
    }
    const baseName = (game.fileName || game.title || 'game').replace(/\.[^/.]+$/, '');
    const outName = `${baseName}.${ext}`;
    downloadBinaryFile(normalized, outName);
    soundFX.save();

    // RTC sidecar: GB/GBC (gambatte) cartridges clock keeps real time between
    // sessions; flash it next to the .sav so real-cart restores keep the clock.
    const rtcEnabled = game.core === 'gambatte' || ['GB', 'GBC'].includes(game.shortSystem || '');
    if (rtcEnabled) {
      try {
        let rtcBytes: any = null;
        if (currentView === 'ingame' && activeGame?.id === game.id && win?.getRtcData) {
          rtcBytes = win.getRtcData();
        }
        if (!rtcBytes || rtcBytes.length === 0) {
          rtcBytes = await idbGet(`rtc:${game.id}`);
        }
        const rtcNormalized = normalizeBinaryData(rtcBytes);
        if (rtcNormalized && rtcNormalized.length > 0) {
          downloadBinaryFile(rtcNormalized, `${baseName}.rtc`);
        }
      } catch (e) {}
    }

    showToast(`Exported ${outName}${rtcEnabled ? ' (+ .rtc clock)' : ''} (${(normalized.length / 1024).toFixed(1)} KB)`);
  }, [activeGame?.id, currentView, showToast]);

  // Keyboard controls with zero collision & hotkeys
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (currentView !== 'ingame') return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      // D-Pad / Movement
      if (e.code === 'ArrowUp' || e.code === 'KeyW') setButtonDown('up');
      if (e.code === 'ArrowDown' || e.code === 'KeyS') setButtonDown('down');
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') setButtonDown('left');
      if (e.code === 'ArrowRight' || e.code === 'KeyD') setButtonDown('right');

      // Action Buttons (Decoupled from WASD: X/L for A, Z/K for B, C/I for X, V/J for Y)
      if (e.code === 'KeyX' || e.code === 'KeyL') setButtonDown('actionA');
      if (e.code === 'KeyZ' || e.code === 'KeyK') setButtonDown('actionB');
      if (e.code === 'KeyC' || e.code === 'KeyI') setButtonDown('actionX');
      if (e.code === 'KeyV' || e.code === 'KeyJ') setButtonDown('actionY');

      // Shoulder Buttons
      if (e.code === 'KeyQ' || e.code === 'KeyU') setButtonDown('btnL');
      if (e.code === 'KeyE' || e.code === 'KeyO') setButtonDown('btnR');

      // System Controls
      if (e.code === 'Enter') setButtonDown('start');
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'Space') setButtonDown('select');

      // In-Game Hotkeys
      if (e.code === 'Escape' || e.code === 'Backquote') {
        e.preventDefault();
        setInGameMenuOpen((o) => !o);
      }
      if (e.code === 'KeyP') setIsPaused((p) => !p);
      if (e.code === 'KeyR' || e.code === 'Backspace') setIsRewinding(true);
      if (e.code === 'KeyF') {
        setFfSpeed((s) => {
          if (s === 0) return 2;
          if (s === 2) return 4;
          if (s === 4) return 8;
          return 0;
        });
      }
      if (e.code === 'KeyM') toggleAudio();
      if (e.code === 'F1') {
        e.preventDefault();
        if (e.shiftKey) {
          if (activeGame) saveStateToGameSlot(activeGame, 1);
        } else {
          showToast('Press Shift + F1 to Quick Save (Slot 1)');
        }
      }
      if (e.code === 'F3') {
        e.preventDefault();
        if (activeGame) loadStateFromGameSlot(activeGame, 1);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') setButtonUp('up');
      if (e.code === 'ArrowDown' || e.code === 'KeyS') setButtonUp('down');
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') setButtonUp('left');
      if (e.code === 'ArrowRight' || e.code === 'KeyD') setButtonUp('right');
      if (e.code === 'KeyX' || e.code === 'KeyL') setButtonUp('actionA');
      if (e.code === 'KeyZ' || e.code === 'KeyK') setButtonUp('actionB');
      if (e.code === 'KeyC' || e.code === 'KeyI') setButtonUp('actionX');
      if (e.code === 'KeyV' || e.code === 'KeyJ') setButtonUp('actionY');
      if (e.code === 'KeyQ' || e.code === 'KeyU') setButtonUp('btnL');
      if (e.code === 'KeyE' || e.code === 'KeyO') setButtonUp('btnR');
      if (e.code === 'Enter') setButtonUp('start');
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'Space') setButtonUp('select');
      if (e.code === 'KeyR' || e.code === 'Backspace') setIsRewinding(false);
    };

    const onBlur = () => {
      setIsRewinding(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [currentView, setButtonDown, setButtonUp, activeGame, toggleAudio, saveStateToGameSlot, loadStateFromGameSlot]);

  // Gamepad API integration hook (isolated 60fps RAF polling)
  useGamepadInput({
    isActive: currentView === 'ingame',
    onButtonDown: setButtonDown,
    onButtonUp: setButtonUp,
    onShowToast: showToast,
  });

  // Real WASM Core FPS Readback — strictly gated to when Top HUD Bar is visible (zero renders during normal play)
  useEffect(() => {
    if (currentView !== 'ingame' || !activeGame.real || !topBarVisible) return;
    const syncMeasuredFps = () => {
      if (isPaused) {
        setFps(0);
        return;
      }
      try {
        const win = emuFrameRef.current?.contentWindow as any;
        const measured = typeof win?.getMeasuredFps === 'function' ? win.getMeasuredFps() : 60;
        setFps(Number.isFinite(measured) && measured > 0 ? measured : 60);
      } catch {
        setFps(60);
      }
    };
    syncMeasuredFps();
    const timer = setInterval(syncMeasuredFps, 500);
    return () => clearInterval(timer);
  }, [activeGame.real, currentView, isPaused, topBarVisible]);

  useEffect(() => {
    try {
      const win = emuFrameRef.current?.contentWindow as any;
      if (typeof win?.setFastForward === 'function') {
        win.setFastForward(ffSpeed > 1, ffSpeed);
      } else {
        const emu = getEmu();
        if (emu) {
          const r = ffSpeed > 1 ? ffSpeed : 1;
          const active = ffSpeed > 1;
          if (typeof emu.handleSpecialOptions === 'function') {
            if (active) {
              emu.handleSpecialOptions('ff-ratio', String(r));
              if (!emu.isFastForward) emu.handleSpecialOptions('fastForward', 'enabled');
            } else {
              emu.handleSpecialOptions('fastForward', 'disabled');
            }
          } else if (emu.gameManager) {
            const gm = emu.gameManager;
            if (active) {
              if (typeof gm.toggleFastForward === 'function') gm.toggleFastForward(0);
              if (typeof gm.setFastForwardRatio === 'function') gm.setFastForwardRatio(r);
              setTimeout(() => {
                try { if (typeof gm.toggleFastForward === 'function') gm.toggleFastForward(1); } catch (e) {}
              }, 15);
            } else {
              if (typeof gm.setFastForwardRatio === 'function') gm.setFastForwardRatio(1);
              if (typeof gm.toggleFastForward === 'function') gm.toggleFastForward(0);
            }
          }
        }
      }
      Object.entries(keysRef.current).forEach(([k, down]) => {
        if (down) win?.simulateButton?.(k, true);
      });
    } catch (e) {}
  }, [ffSpeed]);

  useEffect(() => {
    if (!activeGame.real) return;
    try {
      const win = emuFrameRef.current?.contentWindow as any;
      if (typeof win?.setPaused === 'function') {
        win.setPaused(isPaused);
      } else {
        const emu = getEmu();
        if (emu) {
          if (isPaused) {
            if (typeof emu.pause === 'function') emu.pause();
            else if (emu.gameManager?.toggleMainLoop) emu.gameManager.toggleMainLoop(0);
          } else {
            if (typeof emu.play === 'function') emu.play();
            else if (emu.gameManager?.toggleMainLoop) emu.gameManager.toggleMainLoop(1);
          }
        }
      }
      if (!isPaused) {
        win?.setAudioMuted?.(isMuted);
      }
    } catch (e) {}
  }, [activeGame.real, isPaused, isMuted]);

  useEffect(() => {
    if (!activeGame.real) return;
    try {
      const win = emuFrameRef.current?.contentWindow as any;
      if (typeof win?.setRewind === 'function') {
        win.setRewind(isRewinding);
      } else {
        const emu = getEmu();
        if (emu?.gameManager) {
          const gm = emu.gameManager;
          const val = isRewinding ? 1 : 0;
          if (typeof gm.simulateInput === 'function') {
            gm.simulateInput(0, 28, val);
          }
          if (gm.functions && typeof gm.functions.toggleRewind === 'function') {
            gm.functions.toggleRewind(val);
          }
        }
      }
      try {
        win?.postMessage({ type: 'ejs-set-rewind', active: isRewinding }, '*');
      } catch (e) {}
    } catch (e) {}
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
    const handleDown = (e: React.PointerEvent) => {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      const el = e.currentTarget as HTMLElement | null;
      if (el) {
        el.dataset.pressed = 'true';
        try { el.setPointerCapture?.(e.pointerId); } catch {}
      }
      setButtonDown(keyName);
    };

    const handleUp = (e: React.PointerEvent) => {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      const el = e.currentTarget as HTMLElement | null;
      if (el) {
        el.dataset.pressed = 'false';
        try {
          if (el.hasPointerCapture?.(e.pointerId)) {
            el.releasePointerCapture(e.pointerId);
          }
        } catch {}
      }
      setButtonUp(keyName);
    };

    const handleLeave = (e: React.PointerEvent) => {
      const el = e.currentTarget as HTMLElement | null;
      try {
        if (el?.hasPointerCapture?.(e.pointerId)) return;
      } catch {}
      if (el) el.dataset.pressed = 'false';
      setButtonUp(keyName);
    };

    return {
      onPointerDown: handleDown,
      onPointerUp: handleUp,
      onPointerCancel: handleUp,
      onPointerLeave: handleLeave,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    };
  }, [setButtonDown, setButtonUp]);

  return (
    <div className={`min-h-[100vh] min-h-[100lvh] w-full ${shaders.amoled ? 'bg-black text-zinc-100' : theme.appBg} font-sans select-none overflow-x-hidden`}>
      {/* Hidden File Input for ROMs */}
      <input
        ref={romInputRef}
        type="file"
        accept=".gb,.gbc,.gba,.zip,application/zip"
        onChange={handleRomUpload}
        className="hidden"
        multiple
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 px-4 py-2 rounded-xl border text-xs font-semibold shadow-md hardware-panel ${
            theme.isLight
              ? 'bg-[#f3efe8] border-[#d2cdc3] text-[#121214]'
              : 'bg-[#131316] border-[#222227] text-[#f4f4f6]'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 hardware-led shrink-0" />
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
          onOpenCloudSync={() => setCloudModalOpen(true)}
          cloudStatus={cloudStatus}
          recentGameIds={recentGameIds}
          onOpenControls={() => setControlsModalOpen(true)}
          onToggleLightDark={() => {
            const nextTheme = theme.isLight ? 'midnight' : 'trooper';
            applyTheme(nextTheme);
          }}
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
          isFastForward={ffSpeed > 1}
          ffSpeed={ffSpeed}
          setFfSpeed={setFfSpeed}
          isMuted={isMuted}
          toggleAudio={toggleAudio}
          inGameMenuOpen={inGameMenuOpen}
          setInGameMenuOpen={setInGameMenuOpen}
          topBarVisible={topBarVisible}
          revealTopBar={revealTopBar}
          flushLiveProgress={flushLiveProgress}
          setCurrentView={(v) => setCurrentView(v as any)}
          onReturnHome={handleReturnHome}
          setInGameSaveModalMode={setInGameSaveModalMode}
          setGlobalSettingsOpen={setGlobalSettingsOpen}
          exportBatterySave={exportBatterySave}
          showToast={showToast}
          emuFrameRef={emuFrameRef}
          deckRef={deckRef}
          slotPortrait={slotPortrait}
          setSlotPortrait={switchSlotPortrait}
          slotLandscape={slotLandscape}
          setSlotLandscape={switchSlotLandscape}
          padLayoutPortrait={padLayoutPortrait}
          setPadLayoutPortrait={setPadLayoutPortrait}
          padLayoutLandscape={padLayoutLandscape}
          setPadLayoutLandscape={setPadLayoutLandscape}
          padOpacity={padOpacity}
          setPadOpacity={changePadOpacity}
          customizing={customizing}
          setCustomizing={setCustomizing}
          selectedPad={selectedPad}
          setSelectedPad={setSelectedPad}
          hidePad={hidePad}
          setHidePad={setHidePad}
          bindPadButton={bindPadButton}
          setButtonDown={setButtonDown}
          setButtonUp={setButtonUp}
          topBarTimer={topBarTimer}
          fps={fps}
          launchGame={launchGame}
          systemKey={currentSystemKey}
          onOpenControls={() => setControlsModalOpen(true)}
          toggleShader={toggleShader}
          setColorProfile={setColorProfile}
          savesByGameId={savesByGameId}
          onToggleLightDark={() => {
            const nextTheme = theme.isLight ? 'midnight' : 'trooper';
            applyTheme(nextTheme);
          }}
        />
      )}

      {/* MODAL 1: SAVE SLOTS & CARTRIDGE MANAGER */}
      <SaveSlotsModal
        isOpen={Boolean(detailGame || (currentView === 'ingame' && inGameSaveModalMode))}
        initialMode={currentView === 'ingame' ? inGameSaveModalMode : null}
        slotNames={slotNamesByGameId[(detailGame || activeGame)?.id || ''] || {}}
        onRenameSlot={(slotNum, name) => {
          const g = detailGame || activeGame;
          if (g) renameGameSlot(g.id, slotNum, name);
        }}
        onChangeArtwork={setGameCustomCover}
        onClose={() => {
          setDetailGame(null);
          setInGameSaveModalMode(null);
        }}
        targetGame={detailGame || activeGame}
        activeGame={activeGame}
        currentView={currentView}
        theme={theme}
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
        setColorProfile={setColorProfile}
        hapticsEnabled={hapticsEnabled}
        setHapticsEnabled={setHapticsEnabled}
        onOpenCloudSync={() => setCloudModalOpen(true)}
        onOpenControls={() => setControlsModalOpen(true)}
      />

      {/* MODAL 3: CLOUD SAVE VAULT (SYNC CODE) */}
      <CloudSyncModal
        isOpen={cloudModalOpen}
        onClose={() => setCloudModalOpen(false)}
        theme={theme}
        showToast={showToast}
      />

      {/* MODAL 4: CONTROLLER & KEYBOARD MAPPING GUIDE */}
      <ControlsModal
        isOpen={controlsModalOpen}
        onClose={() => setControlsModalOpen(false)}
        theme={theme}
      />

      {/* MODAL 5: LOCATE MISSING ROM FOR SYNCED GAME */}
      <MissingRomModal
        isOpen={Boolean(missingRomData)}
        onClose={() => setMissingRomData(null)}
        game={missingRomData?.game || null}
        theme={theme}
        onRomSelected={handleRomSelectedForMissingGame}
        showToast={showToast}
      />
    </div>
  );
}
