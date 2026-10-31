import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  HardDrive,
  Tv,
  Volume2,
  VolumeX,
  Gamepad2,
  FolderOpen,
  Cpu,
  Layers,
  Sparkles,
  Camera,
  Save,
  FastForward,
  Rewind,
  FileCode,
  Sliders,
  Trash2,
  Disc,
  Zap,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  X,
  Settings,
  Plus,
  Search,
  Home,
  Check,
  Eye,
  EyeOff,
  Grid,
  Shield,
  Trophy,
  Clock,
  FolderPlus,
  Bookmark,
  Palette,
  Cloud,
  CloudOff,
  RefreshCw,
  LogOut,
  AlertCircle
} from 'lucide-react';
import {
  CloudSyncStatus,
  GoogleUserProfile,
  ConflictBackupItem,
  getSyncStatus,
  subscribeSyncStatus,
  signInWithGoogle,
  signOutGoogle,
  getGoogleClientId,
  setGoogleClientId,
  getCachedUserProfile,
  executeFullSync,
  markLocalSaveModified,
  initGlobalSyncListeners,
  listCloudConflictBackups,
  getCloudFilesSummary,
  deleteAllCloudSaves,
  subscribeDataUpdated,
  normalizeBinaryData,
  SyncTargetStore
} from './cloudSync';

// ============================================================================
// 1. LIBRETRO CORE AUTO-DETECTION MATRIX
// ============================================================================
const CORE_MAP = {
  gb: { core: 'gambatte', system: 'Game Boy', shortSystem: 'GB', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  gbc: { core: 'gambatte', system: 'Game Boy Color', shortSystem: 'GBC', badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40' },
  gba: { core: 'mgba', system: 'Game Boy Advance', shortSystem: 'GBA', badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' },
  nes: { core: 'fceumm', system: 'Nintendo Entertainment System', shortSystem: 'NES', badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  sfc: { core: 'snes9x', system: 'Super Nintendo (SNES)', shortSystem: 'SNES', badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  smc: { core: 'snes9x', system: 'Super Nintendo (SNES)', shortSystem: 'SNES', badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  md: { core: 'genesis_plus_gx', system: 'Sega Genesis / Mega Drive', shortSystem: 'GEN', badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  gen: { core: 'genesis_plus_gx', system: 'Sega Genesis / Mega Drive', shortSystem: 'GEN', badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  smd: { core: 'genesis_plus_gx', system: 'Sega Genesis / Mega Drive', shortSystem: 'GEN', badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  bin: { core: 'genesis_plus_gx', system: 'Sega Genesis / Binary ROM', shortSystem: 'BIN', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
};

// ============================================================================
// 2. HARDWARE SHELL & UI THEMES
// ============================================================================
const THEMES = {
  midnight: {
    id: 'midnight',
    name: 'Midnight OLED',
    desc: 'Deep obsidian carbon shell with cyber emerald & cyan phosphor accents',
    appBg: 'bg-zinc-950 text-zinc-100',
    shellBg: 'bg-zinc-900 border-zinc-800',
    deckBg: 'bg-zinc-900/95 border-zinc-800',
    bezelBg: 'bg-zinc-950 border-zinc-800',
    cardBg: 'bg-zinc-900/90 border-zinc-800/90 hover:border-emerald-500/50',
    accentText: 'text-emerald-400',
    accentBg: 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950',
    accentBorder: 'border-emerald-500/40',
    accentSoft: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    dpadBg: 'bg-zinc-800 active:bg-emerald-500 active:text-zinc-950 border-zinc-700 text-zinc-200',
    btnA: 'bg-emerald-500 active:bg-emerald-300 text-zinc-950 border-emerald-300',
    btnB: 'bg-cyan-500 active:bg-cyan-300 text-zinc-950 border-cyan-300',
    btnXY: 'bg-zinc-800 active:bg-zinc-600 text-zinc-200 border-zinc-600',
    hex: '#10b981'
  },
  dmg: {
    id: 'dmg',
    name: 'DMG Olive Classic',
    desc: '1989 Dot-Matrix Game Boy warm pebble shell with magenta A/B buttons',
    appBg: 'bg-stone-950 text-stone-100',
    shellBg: 'bg-stone-800 border-stone-700',
    deckBg: 'bg-stone-800 border-stone-700',
    bezelBg: 'bg-stone-900 border-stone-700',
    cardBg: 'bg-stone-900/90 border-stone-800 hover:border-lime-500/50',
    accentText: 'text-lime-400',
    accentBg: 'bg-lime-500 hover:bg-lime-400 text-stone-950',
    accentBorder: 'border-lime-500/40',
    accentSoft: 'bg-lime-500/10 text-lime-300 border-lime-500/30',
    dpadBg: 'bg-stone-900 active:bg-lime-500 active:text-stone-950 border-stone-700 text-stone-200',
    btnA: 'bg-rose-600 active:bg-rose-400 text-white border-rose-400',
    btnB: 'bg-rose-700 active:bg-rose-500 text-white border-rose-500',
    btnXY: 'bg-stone-700 active:bg-stone-600 text-stone-200 border-stone-600',
    hex: '#84cc16'
  },
  atomic: {
    id: 'atomic',
    name: 'Atomic Purple',
    desc: 'Translucent-inspired indigo-violet GBC shell with neon teal highlights',
    appBg: 'bg-slate-950 text-slate-100',
    shellBg: 'bg-indigo-950/90 border-indigo-800/70',
    deckBg: 'bg-indigo-950/95 border-indigo-800/60',
    bezelBg: 'bg-slate-950 border-indigo-900',
    cardBg: 'bg-slate-900/90 border-indigo-900/60 hover:border-purple-400/60',
    accentText: 'text-purple-300',
    accentBg: 'bg-purple-500 hover:bg-purple-400 text-slate-950',
    accentBorder: 'border-purple-400/40',
    accentSoft: 'bg-purple-500/15 text-purple-200 border-purple-400/30',
    dpadBg: 'bg-slate-900 active:bg-purple-400 active:text-slate-950 border-indigo-800 text-slate-200',
    btnA: 'bg-teal-400 active:bg-teal-300 text-slate-950 border-teal-200',
    btnB: 'bg-amber-400 active:bg-amber-300 text-slate-950 border-amber-200',
    btnXY: 'bg-indigo-900 active:bg-indigo-700 text-indigo-100 border-indigo-700',
    hex: '#a855f7'
  },
  famicom: {
    id: 'famicom',
    name: 'Famicom Crimson',
    desc: 'Deep burgundy & brushed gold anodized Japanese console edition',
    appBg: 'bg-neutral-950 text-amber-50',
    shellBg: 'bg-rose-950/90 border-amber-500/40',
    deckBg: 'bg-rose-950/95 border-amber-500/30',
    bezelBg: 'bg-neutral-950 border-amber-600/40',
    cardBg: 'bg-neutral-900/90 border-rose-900/60 hover:border-amber-400/60',
    accentText: 'text-amber-400',
    accentBg: 'bg-amber-500 hover:bg-amber-400 text-neutral-950',
    accentBorder: 'border-amber-500/40',
    accentSoft: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    dpadBg: 'bg-neutral-900 active:bg-amber-400 active:text-neutral-950 border-amber-600/40 text-amber-100',
    btnA: 'bg-amber-400 active:bg-amber-300 text-neutral-950 border-amber-200',
    btnB: 'bg-rose-600 active:bg-rose-400 text-white border-rose-400',
    btnXY: 'bg-rose-900 active:bg-rose-800 text-amber-100 border-amber-600/30',
    hex: '#f59e0b'
  },
  silver: {
    id: 'silver',
    name: 'Pocket Silver',
    desc: 'Brushed gunmetal metallic slate with high-contrast tactical orange',
    appBg: 'bg-slate-950 text-slate-100',
    shellBg: 'bg-slate-800 border-slate-600',
    deckBg: 'bg-slate-800/95 border-slate-600',
    bezelBg: 'bg-slate-950 border-slate-700',
    cardBg: 'bg-slate-900 border-slate-800 hover:border-orange-400/60',
    accentText: 'text-orange-400',
    accentBg: 'bg-orange-500 hover:bg-orange-400 text-slate-950',
    accentBorder: 'border-orange-500/40',
    accentSoft: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    dpadBg: 'bg-slate-900 active:bg-orange-500 active:text-slate-950 border-slate-700 text-slate-200',
    btnA: 'bg-orange-500 active:bg-orange-300 text-slate-950 border-orange-300',
    btnB: 'bg-sky-500 active:bg-sky-300 text-slate-950 border-sky-300',
    btnXY: 'bg-slate-700 active:bg-slate-600 text-slate-100 border-slate-500',
    hex: '#f97316'
  }
};

// ============================================================================
// 3. BUILT-IN GAMES & UPGRADED PLAYABLE CARTRIDGES
// ============================================================================
const INITIAL_GAMES = [];

const STUB_GAME = {
  id: "none", title: "", fileName: "", core: "gambatte", system: "", shortSystem: "", engineType: "pokegold", real: false
};

// ============================================================================
// 4. RETRO WEB AUDIO SYNTHESIZER
// ============================================================================
class RetroAudioSynth {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  tone(freq = 440, duration = 0.08, type = 'square', slide = null, vol = 0.06) {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      if (slide) {
        osc.frequency.exponentialRampToValueAtTime(slide, this.ctx.currentTime + duration);
      }
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Ignore audio policy restrictions before user gesture
    }
  }

  jump() { this.tone(240, 0.13, 'square', 640, 0.05); }
  laser() { this.tone(920, 0.08, 'sawtooth', 190, 0.05); }
  coin() {
    this.tone(987.77, 0.06, 'square', null, 0.06);
    setTimeout(() => this.tone(1318.51, 0.14, 'square', null, 0.06), 60);
  }
  hit() { this.tone(140, 0.18, 'sawtooth', 48, 0.07); }
  encounter() {
    this.tone(600, 0.06, 'square', 900, 0.06);
    setTimeout(() => this.tone(750, 0.06, 'square', 1100, 0.06), 70);
    setTimeout(() => this.tone(900, 0.14, 'square', 400, 0.06), 140);
  }
  save() {
    this.tone(523.25, 0.06, 'triangle', null, 0.07);
    setTimeout(() => this.tone(659.25, 0.06, 'triangle', null, 0.07), 65);
    setTimeout(() => this.tone(1046.5, 0.14, 'triangle', null, 0.07), 130);
  }
}

const soundFX = new RetroAudioSynth();

// ============================================================================
// 5. BATTERY SAVE (.SAV / .SRM) BRIDGE & THUMBNAIL GENERATOR
// ============================================================================
function downloadBinaryFile(uint8Array, fileName) {
  const blob = new Blob([uint8Array], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Generate an authentic pixel-art dataURL thumbnail for pre-populated Pokémon Gold save states
function createPrepopulatedThumbnail(mode = 'overworld') {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 120;
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  if (mode === 'overworld') {
    ctx.fillStyle = '#65a30d';
    ctx.fillRect(0, 0, 160, 120);
    // Dirt path
    ctx.fillStyle = '#fde047';
    ctx.fillRect(20, 46, 120, 28);
    // Tall grass patches
    ctx.fillStyle = '#15803d';
    ctx.fillRect(16, 12, 64, 28);
    ctx.fillRect(84, 80, 60, 28);
    // House roof
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(96, 10, 44, 20);
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(100, 30, 36, 14);
    // Trainer sprite
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(74, 52, 12, 14);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 160, 14);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 8px monospace';
    ctx.fillText('ROUTE 29 • LV.7 CYNDAQUIL', 6, 10);
  } else {
    ctx.fillStyle = '#fef9c3';
    ctx.fillRect(0, 0, 160, 120);
    // Enemy box
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(8, 10, 82, 24);
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(14, 24, 58, 4);
    // Enemy Hoothoot sprite
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.arc(122, 30, 14, 0, Math.PI * 2);
    ctx.fill();
    // Player Cyndaquil back sprite
    ctx.fillStyle = '#f97316';
    ctx.fillRect(24, 58, 22, 22);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 84, 160, 36);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 8px monospace';
    ctx.fillText('WILD HOOTHOOT APPEARED!', 8, 98);
  }
  return c.toDataURL('image/png');
}

// ============================================================================
// 6. INITIAL GAME ENGINE STATE FACTORY (SUPPORTS ALL 4 ENGINES)
// ============================================================================
function createInitialEngineState(engineType = 'pokegold', presetVariant = 'default') {
  const base = {
    engineType,
    frame: presetVariant === 'slot1' ? 1420 : presetVariant === 'slot2' ? 2890 : 0,
    score: presetVariant === 'slot1' ? 650 : presetVariant === 'slot2' ? 1280 : 0,
    level: presetVariant === 'slot1' ? 2 : presetVariant === 'slot2' ? 3 : 1,
    // ------------------------------------------------------------------------
    // ENGINE 1: POKÉMON GOLD VERSION (GBC TOP-DOWN RPG + TURN-BASED BATTLE)
    // ------------------------------------------------------------------------
    trainerX: presetVariant === 'slot1' ? 92 : 156,
    trainerY: presetVariant === 'slot1' ? 76 : 118,
    trainerDir: 'down',
    stepCount: 0,
    pokeName: 'CYNDAQUIL',
    pokeLevel: presetVariant === 'slot1' ? 7 : presetVariant === 'slot2' ? 8 : 5,
    pokeHp: presetVariant === 'slot2' ? 26 : 28,
    pokeMaxHp: presetVariant === 'slot2' ? 30 : 28,
    pokeXp: presetVariant === 'slot1' ? 40 : 15,
    pokeballs: 8,
    caughtCount: presetVariant === 'slot1' ? 2 : presetVariant === 'slot2' ? 3 : 1,
    goldCoins: presetVariant === 'slot1' ? 1400 : 800,
    battle:
      presetVariant === 'slot2'
        ? {
            active: true,
            enemyName: 'HOOTHOOT',
            enemyLv: 6,
            enemyHp: 19,
            enemyMaxHp: 24,
            enemyColor: '#d97706',
            menuIndex: 0, // 0: EMBER, 1: TACKLE, 2: POKEBALL, 3: RUN
            message: 'Wild HOOTHOOT appeared! Choose move:',
            cooldown: 0,
          }
        : {
            active: false,
            enemyName: 'SENTRET',
            enemyLv: 4,
            enemyHp: 18,
            enemyMaxHp: 18,
            enemyColor: '#b45309',
            menuIndex: 0,
            message: '',
            cooldown: 0,
          },
    dialogText: 'ROUTE 29: Walk in tall grass for wild battles!',

    // ------------------------------------------------------------------------
    // ENGINE 2: CYBERRUN '89 DX (NES ACTION PLATFORMER)
    // ------------------------------------------------------------------------
    playerY: 168,
    playerVy: 0,
    jumpsLeft: 2,
    isDucking: false,
    bullets: [],
    obstacles: [
      { x: 250, y: 152, w: 16, h: 18, type: 'drone' },
      { x: 390, y: 128, w: 20, h: 14, type: 'flyer' },
    ],
    crystals: [
      { x: 300, y: 120, collected: false },
      { x: 440, y: 150, collected: false }
    ],

    // ------------------------------------------------------------------------
    // ENGINE 3: STARBLADE SUPER DX (SNES SPACE SHMUP)
    // ------------------------------------------------------------------------
    shipX: 54,
    shipY: 112,
    shield: 100,
    weaponTier: 1,
    lasers: [],
    enemies: [
      { x: 250, y: 60, vy: 1.2, hp: 2 },
      { x: 295, y: 140, vy: -1.1, hp: 3 },
      { x: 335, y: 95, vy: 0.9, hp: 2 },
    ],
    stars: Array.from({ length: 40 }, (_, i) => ({
      x: (i * 37) % 320,
      y: (i * 53) % 240,
      speed: (i % 3) + 1
    })),
    particles: [],

    // ------------------------------------------------------------------------
    // ENGINE 4: NEON DRIFT ADVANCE (GBA SYNTHWAVE OUTRUN RACER)
    // ------------------------------------------------------------------------
    carX: 0,
    speed: 145,
    nitro: 100,
    roadPos: 0,
    curvePhase: 0,
    traffic: [
      { lane: -0.45, z: 45, color: '#22d3ee' },
      { lane: 0.45, z: 88, color: '#fbbf24' }
    ],
  };
  return base;
}

function createEmptySlotsForGame(gameId) {
  if (gameId === 'pokemon_gold') {
    const slot1State = createInitialEngineState('pokegold', 'slot1');
    const slot2State = createInitialEngineState('pokegold', 'slot2');
    return [
      {
        slot: 1,
        empty: false,
        label: 'Route 29 Tall Grass • Lv.7 Cyndaquil',
        timestamp: '10:15 PM',
        score: 650,
        frame: 1420,
        screenshot: createPrepopulatedThumbnail('overworld'),
        stateData: {
          version: 'RETRO_POCKET_V2',
          gameId: 'pokemon_gold',
          romFileName: 'Pokemon_Gold_Version.gbc',
          core: 'gambatte',
          timestamp: '10:15 PM',
          score: 650,
          frame: 1420,
          engineState: slot1State
        }
      },
      {
        slot: 2,
        empty: false,
        label: 'Wild Hoothoot Battle • HP 26/30',
        timestamp: '10:42 PM',
        score: 1280,
        frame: 2890,
        screenshot: createPrepopulatedThumbnail('battle'),
        stateData: {
          version: 'RETRO_POCKET_V2',
          gameId: 'pokemon_gold',
          romFileName: 'Pokemon_Gold_Version.gbc',
          core: 'gambatte',
          timestamp: '10:42 PM',
          score: 1280,
          frame: 2890,
          engineState: slot2State
        }
      },
      { slot: 3, empty: true, label: 'Empty Slot', timestamp: null, score: 0, frame: 0, screenshot: null, stateData: null },
      { slot: 4, empty: true, label: 'Empty Slot', timestamp: null, score: 0, frame: 0, screenshot: null, stateData: null },
    ];
  }

  return [1, 2, 3, 4].map((slot) => ({
    slot,
    empty: true,
    label: 'Empty Slot',
    timestamp: null,
    score: 0,
    frame: 0,
    screenshot: null,
    stateData: null
  }));
}

// ============================================================================
// MAIN APPLICATION COMPONENT
// ============================================================================
const coreRatio = (core) => ({ gambatte: 10 / 9, mgba: 3 / 2, fceumm: 8 / 7, snes9x: 8 / 7 }[core] || 4 / 3);

const DEFAULT_PAD_LAYOUT = {
  transport: { x: 0.5, y: 0.1, s: 1 },
  dpad: { x: 0.24, y: 0.42, s: 1 },
  actions: { x: 0.76, y: 0.42, s: 1 },
  system: { x: 0.5, y: 0.74, s: 1 }
};
const PAD_LABELS = { transport: 'Pause / Rewind / Speed', dpad: 'D-Pad', actions: 'A / B Buttons', system: 'Select / Start' };

function loadPadLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem('retro_pad_layout') || 'null');
    if (saved) return { ...DEFAULT_PAD_LAYOUT, ...saved };
  } catch (e) {}
  return DEFAULT_PAD_LAYOUT;
}

function PadGroup({ id, layout, customizing, selected, onSelect, onMove, deckRef, children }) {
  const g = layout[id];
  const dragging = useRef(false);
  return (
    <div
      className="absolute"
      style={{
        left: `${g.x * 100}%`,
        top: `${g.y * 100}%`,
        transform: `translate(-50%, -50%) scale(${g.s})`,
        zIndex: selected ? 30 : 10
      }}
    >
      {children}
      {customizing && (
        <div
          className={`absolute -inset-2 rounded-2xl border-2 border-dashed touch-none cursor-move ${
            selected ? 'border-emerald-400 bg-emerald-400/15' : 'border-white/40 bg-white/5'
          }`}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            dragging.current = true;
            onSelect(id);
          }}
          onPointerMove={(e) => {
            if (!dragging.current || !deckRef.current) return;
            const r = deckRef.current.getBoundingClientRect();
            const x = Math.min(0.97, Math.max(0.03, (e.clientX - r.left) / r.width));
            const y = Math.min(0.97, Math.max(0.03, (e.clientY - r.top) / r.height));
            onMove(id, x, y);
          }}
          onPointerUp={() => { dragging.current = false; }}
          onPointerCancel={() => { dragging.current = false; }}
        />
      )}
    </div>
  );
}

// ---------------- ROM storage (IndexedDB) + EmulatorJS player ----------------
const idbOpen = () => new Promise((res, rej) => {
  const r = indexedDB.open('retro_station', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('roms');
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const idbPut = async (key, blob) => {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction('roms', 'readwrite');
    tx.objectStore('roms').put(blob, key);
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
  });
};
const idbGet = async (key) => {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const q = db.transaction('roms').objectStore('roms').get(key);
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
};
const idbDelete = async (key) => {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction('roms', 'readwrite');
    tx.objectStore('roms').delete(key);
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
  });
};

const idbGetAllKeys = async (): Promise<string[]> => {
  const db = (await idbOpen()) as IDBDatabase;
  return new Promise((res, rej) => {
    const q = db.transaction('roms', 'readonly').objectStore('roms').getAllKeys();
    q.onsuccess = () => {
      const keys = ((q.result as any[]) || []).map(String);
      const expanded = new Set(keys);
      keys.forEach((k) => {
        if (k.startsWith('rom_')) expanded.add(`rom:${k}`);
      });
      res(Array.from(expanded));
    };
    q.onerror = () => rej(q.error);
  });
};

const syncTargetStore: SyncTargetStore = {
  getItem: async (key) => {
    if (key.startsWith('rom:')) {
      const realId = key.slice(4);
      return (await idbGet(realId)) || (await idbGet(key));
    }
    return idbGet(key);
  },
  setItem: async (key, val) => {
    if (key.startsWith('rom:')) {
      const realId = key.slice(4);
      await idbPut(realId, val);
      return idbPut(key, val);
    }
    return idbPut(key, val);
  },
  getAllKeys: () => idbGetAllKeys(),
};

const EJS_CORES = { gambatte: 'gb', mgba: 'gba', fceumm: 'nes', snes9x: 'snes', genesis_plus_gx: 'segaMD' };

const EMU_INPUT_MAP = {
  actionB: 0, // RetroArch B
  actionY: 1, // RetroArch Y
  select: 2,  // RetroArch Select
  start: 3,   // RetroArch Start
  up: 4,      // RetroArch Up
  down: 5,    // RetroArch Down
  left: 6,    // RetroArch Left
  right: 7,   // RetroArch Right
  actionA: 8, // RetroArch A
  actionX: 9, // RetroArch X
  btnL: 10,   // RetroArch L
  btnR: 11    // RetroArch R
};

const PAD_KEYS = {
  up: ['ArrowUp', 38],
  down: ['ArrowDown', 40],
  left: ['ArrowLeft', 37],
  right: ['ArrowRight', 39],
  actionA: ['x', 88],
  actionB: ['z', 90],
  actionX: ['s', 83],
  actionY: ['a', 65],
  start: ['Enter', 13],
  select: ['ShiftRight', 16],
  btnL: ['q', 81],
  btnR: ['w', 87]
};

function buildPlayerHtml(core, romUrl, title) {
  const close = '<' + '/script>';
  return '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">' +
    '<style>' +
    'html,body{margin:0;padding:0;width:100%;height:100%;background:#000;overflow:hidden;touch-action:none;user-select:none}' +
    '#game{width:100%;height:100%}' +
    '.ejs_virtualGamepad_parent,.ejs_virtualGamepad_parent *,' +
    '.ejs_virtualGamepad_top,.ejs_virtualGamepad_bottom,.ejs_virtualGamepad_left,.ejs_virtualGamepad_right,' +
    '.ejs_dpad_main,.ejs_dpad_vertical,.ejs_dpad_horizontal,' +
    '.ejs_virtual_gamepad,.ejs_menu_bar,.ejs_context_menu,#ejs_menu_bar,' +
    'div[class*="virtualGamepad"],div[class*="dpad"],div[class*="gamepad"],div[class*="touch"]{' +
    'display:none!important;opacity:0!important;pointer-events:none!important;visibility:hidden!important;' +
    'width:0!important;height:0!important;overflow:hidden!important}' +
    '</style></head><body>' +
    '<div id="game"></div><script>' +
    'window.EJS_player="#game";' +
    'window.EJS_core=' + JSON.stringify(core) + ';' +
    'window.EJS_gameUrl=' + JSON.stringify(romUrl) + ';' +
    'window.EJS_gameName=' + JSON.stringify(title || 'game') + ';' +
    'window.EJS_pathtodata="https://cdn.emulatorjs.org/stable/data/";' +
    'window.EJS_startOnLoaded=true;' +
    'window.EJS_fixedSaveInterval=10000;' +
    'window.EJS_VirtualGamepadSettings=[];' +
    'window.EJS_defaultOptions={"virtual-gamepad":"disabled","settings.virtual-gamepad":"disabled","settings.fast-forward-ratio":"2","fast-forward-ratio":"2"};' +
    'window.simulateButton=function(name,down){' +
    '  var map={actionb:0,b:0,actiony:1,y:1,select:2,start:3,up:4,down:5,left:6,right:7,actiona:8,a:8,actionx:9,x:9,btnl:10,l:10,btnr:11,r:11};' +
    '  var idx=map[String(name).toLowerCase()];' +
    '  if(idx!==undefined&&window.EJS_emulator&&window.EJS_emulator.gameManager){' +
    '    try{window.EJS_emulator.gameManager.simulateInput(0,idx,down?1:0);}catch(e){}' +
    '  }' +
    '};' +
    'window.setFastForward=function(active){' +
    '  try{' +
    '    if(window.EJS_emulator&&window.EJS_emulator.gameManager){' +
    '      var gm=window.EJS_emulator.gameManager;' +
    '      if(typeof gm.setFastForwardRatio==="function")gm.setFastForwardRatio(2);' +
    '      if(typeof gm.toggleFastForward==="function")gm.toggleFastForward(active?1:0);' +
    '    }' +
    '  }catch(e){}' +
    '};' +
    'window._toU8=function(b){' +
    '  if(!b)return null;' +
    '  if(b instanceof Uint8Array)return b;' +
    '  if(ArrayBuffer.isView(b))return new Uint8Array(b.buffer,b.byteOffset,b.byteLength);' +
    '  if(b instanceof ArrayBuffer)return new Uint8Array(b);' +
    '  if(Array.isArray(b))return new Uint8Array(b);' +
    '  if(typeof b==="object"){var v=Object.values(b);if(v.length>0)return new Uint8Array(v);}' +
    '  return null;' +
    '};' +
    'window.loadSrmData=function(srmBytes,rtcBytes){' +
    '  try{' +
    '    if(!window.EJS_emulator||!window.EJS_emulator.gameManager)return false;' +
    '    var gm=window.EJS_emulator.gameManager;' +
    '    var mod=gm.Module||window.EJS_emulator.Module;' +
    '    var fs=gm.FS||(mod&&mod.FS);' +
    '    var srmArr=window._toU8(srmBytes);' +
    '    var rtcArr=window._toU8(rtcBytes);' +
    '    var writeFiles=function(){' +
    '      if(!fs)return;' +
    '      try{fs.mkdir("/data");}catch(e){}' +
    '      try{fs.mkdir("/data/saves");}catch(e){}' +
    '      var paths=[];' +
    '      if(typeof gm.getSaveFilePath==="function"){try{paths.push(gm.getSaveFilePath());}catch(e){}}' +
    '      if(gm.savePath)paths.push(gm.savePath);' +
    '      if(window.EJS_gameName){' +
    '        paths.push("/data/saves/"+window.EJS_gameName+".srm");' +
    '        paths.push("/data/saves/"+window.EJS_gameName+".sav");' +
    '      }' +
    '      try{' +
    '        var existing=fs.readdir("/data/saves");' +
    '        existing.forEach(function(fn){' +
    '          if(fn!=="."&&fn!==".."&&(fn.endsWith(".srm")||fn.endsWith(".sav")))paths.push("/data/saves/"+fn);' +
    '        });' +
    '      }catch(e){}' +
    '      paths.forEach(function(p){' +
    '        if(!p)return;' +
    '        if(srmArr){try{fs.writeFile(p,srmArr);}catch(e){}}' +
    '        if(rtcArr){var r=p.replace(/\\.[^/.]+$/,".rtc");try{fs.writeFile(r,rtcArr);}catch(e){}}' +
    '      });' +
    '    };' +
    '    var applyWasmMemory=function(){' +
    '      writeFiles();' +
    '      if(typeof gm.loadSaveFiles==="function"){try{gm.loadSaveFiles();}catch(e){}}' +
    '      if(mod&&mod.HEAPU8){' +
    '        var getMemData=mod._retro_get_memory_data||(gm.functions&&gm.functions.getMemoryData);' +
    '        var getMemSize=mod._retro_get_memory_size||(gm.functions&&gm.functions.getMemorySize);' +
    '        if(typeof getMemData==="function"&&typeof getMemSize==="function"){' +
    '          if(srmArr){' +
    '            var ptr=getMemData(0),sz=getMemSize(0);' +
    '            if(ptr&&sz>0)mod.HEAPU8.set(srmArr.subarray(0,Math.min(srmArr.length,sz)),ptr);' +
    '          }' +
    '          if(rtcArr){' +
    '            var rPtr=getMemData(1),rSz=getMemSize(1);' +
    '            if(rPtr&&rSz>0)mod.HEAPU8.set(rtcArr.subarray(0,Math.min(rtcArr.length,rSz)),rPtr);' +
    '          }' +
    '        }' +
    '      }' +
    '    };' +
    '    applyWasmMemory();' +
    '    if(fs&&typeof fs.syncfs==="function"){try{fs.syncfs(false,function(){});}catch(e){}}' +
    '    if(typeof gm.restart==="function"){try{gm.restart();}catch(e){}}' +
    '    else if(mod&&typeof mod._retro_reset==="function"){try{mod._retro_reset();}catch(e){}}' +
    '    setTimeout(applyWasmMemory,120);' +
    '    setTimeout(applyWasmMemory,400);' +
    '    return true;' +
    '  }catch(e){console.error("loadSrmData err",e);return false;}' +
    '};' +
    'window.getSrmData=function(){' +
    '  try{' +
    '    if(!window.EJS_emulator||!window.EJS_emulator.gameManager)return null;' +
    '    var gm=window.EJS_emulator.gameManager;' +
    '    var mod=gm.Module||window.EJS_emulator.Module;' +
    '    if(typeof gm.saveSaveFiles==="function"){try{gm.saveSaveFiles();}catch(e){}}' +
    '    if(mod&&mod.HEAPU8){' +
    '      var getMemData=mod._retro_get_memory_data||(gm.functions&&gm.functions.getMemoryData);' +
    '      var getMemSize=mod._retro_get_memory_size||(gm.functions&&gm.functions.getMemorySize);' +
    '      if(typeof getMemData==="function"&&typeof getMemSize==="function"){' +
    '        var ptr=getMemData(0),sz=getMemSize(0);' +
    '        if(ptr&&sz>0)return new Uint8Array(mod.HEAPU8.buffer,ptr,sz).slice();' +
    '      }' +
    '    }' +
    '    if(typeof gm.getSaveFile==="function"){' +
    '      var sf=gm.getSaveFile(false);' +
    '      if(sf&&sf.length>0)return new Uint8Array(sf).slice();' +
    '    }' +
    '    var fs=gm.FS||(mod&&mod.FS);' +
    '    var p=typeof gm.getSaveFilePath==="function"?gm.getSaveFilePath():("/data/saves/"+window.EJS_gameName+".srm");' +
    '    if(fs&&fs.readFile){var rf=fs.readFile(p);return rf?new Uint8Array(rf).slice():null;}' +
    '  }catch(e){}' +
    '  return null;' +
    '};' +
    'window.getRtcData=function(){' +
    '  try{' +
    '    if(!window.EJS_emulator||!window.EJS_emulator.gameManager)return null;' +
    '    var gm=window.EJS_emulator.gameManager;' +
    '    var fs=gm.FS||(window.EJS_emulator.Module&&window.EJS_emulator.Module.FS);' +
    '    var p=typeof gm.getSaveFilePath==="function"?gm.getSaveFilePath():("/data/saves/"+window.EJS_gameName+".srm");' +
    '    var r=p.replace(/\\.[^/.]+$/,".rtc");' +
    '    if(fs&&fs.readFile){var rf=fs.readFile(r);return rf?new Uint8Array(rf).slice():null;}' +
    '  }catch(e){}' +
    '  return null;' +
    '};' +
    'window.loadStateData=function(bytes){' +
    '  try{' +
    '    if(!window.EJS_emulator||!window.EJS_emulator.gameManager)return false;' +
    '    var arr=window._toU8(bytes);' +
    '    if(!arr||!arr.length)return false;' +
    '    window.EJS_emulator.gameManager.loadState(arr);' +
    '    return true;' +
    '  }catch(e){console.error("loadStateData err",e);return false;}' +
    '};' +
    'window.getStateData=function(){' +
    '  try{' +
    '    if(!window.EJS_emulator||!window.EJS_emulator.gameManager)return null;' +
    '    var st=window.EJS_emulator.gameManager.getState();' +
    '    return st?new Uint8Array(st).slice():null;' +
    '  }catch(e){return null;}' +
    '};' +
    'var _lastSrmHash=0;' +
    'setInterval(function(){' +
    '  try{' +
    '    var srm=window.getSrmData&&window.getSrmData();' +
    '    if(!srm||!srm.length)return;' +
    '    var h=0,nonEmpty=false;' +
    '    for(var i=0;i<srm.length;i+=4){' +
    '      var b=srm[i];' +
    '      if(b!==0&&b!==255)nonEmpty=true;' +
    '      h=((h<<5)-h+b)|0;' +
    '    }' +
    '    if(nonEmpty&&h!==_lastSrmHash){' +
    '      _lastSrmHash=h;' +
    '      parent.postMessage({type:"ejs-srm-update",save:Array.from(srm)},"*");' +
    '    }' +
    '  }catch(e){}' +
    '},3000);' +
    'window.EJS_onSaveUpdate=function(e){' +
    '  try{' +
    '    if(e&&e.save){' +
    '      parent.postMessage({type:"ejs-srm-update",save:Array.from(e.save instanceof Uint8Array?e.save:new Uint8Array(e.save))},"*");' +
    '    }' +
    '  }catch(e){}' +
    '};' +
    'window.EJS_onGameStart=function(){' +
    '  try{' +
    '    if(window.EJS_emulator){' +
    '      if(typeof window.EJS_emulator.toggleVirtualGamepad==="function")window.EJS_emulator.toggleVirtualGamepad(false);' +
    '      if(window.EJS_emulator.virtualGamepad)window.EJS_emulator.virtualGamepad.remove();' +
    '    }' +
    '    var el=document.querySelector(".ejs_virtualGamepad_parent");if(el)el.remove();' +
    '  }catch(e){}' +
    '  parent.postMessage({type:"ejs-ready"},"*");' +
    '};' +
    'window.setAudioMuted=function(m){' +
    '  try{' +
    '    if(window.EJS_emulator){' +
    '      if(typeof window.EJS_emulator.setVolume==="function")window.EJS_emulator.setVolume(m?0:1);' +
    '      if(window.EJS_emulator.gameManager&&typeof window.EJS_emulator.gameManager.setVolume==="function")window.EJS_emulator.gameManager.setVolume(m?0:1);' +
    '    }' +
    '  }catch(e){}' +
    '  try{' +
    '    var audios=document.querySelectorAll("audio,video");' +
    '    for(var i=0;i<audios.length;i++){audios[i].muted=m;}' +
    '  }catch(e){}' +
    '};' +
    'setInterval(function(){' +
    '  try{' +
    '    var el=document.querySelector(".ejs_virtualGamepad_parent");' +
    '    if(el)el.remove();' +
    '    if(window.EJS_emulator&&window.EJS_emulator.virtualGamepad)window.EJS_emulator.virtualGamepad.style.display="none";' +
    '  }catch(e){}' +
    '},250);' + close +
    '<script src="https://cdn.emulatorjs.org/stable/data/loader.js">' + close + '</body></html>';
}

const LIBRETRO_SYSTEM_MAP = {
  gb: 'Nintendo - Game Boy',
  gbc: 'Nintendo - Game Boy Color',
  gba: 'Nintendo - Game Boy Advance',
  nes: 'Nintendo - Nintendo Entertainment System',
  sfc: 'Nintendo - Super Nintendo Entertainment System',
  smc: 'Nintendo - Super Nintendo Entertainment System',
  md: 'Sega - Mega Drive - Genesis',
  gen: 'Sega - Mega Drive - Genesis',
  smd: 'Sega - Mega Drive - Genesis',
  bin: 'Sega - Mega Drive - Genesis'
};

function formatGameTitle(rawTitle) {
  if (!rawTitle) return '';
  return rawTitle
    .replace(/\.[a-zA-Z0-9]+$/, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || rawTitle;
}

function getBoxartUrls(game) {
  if (!game) return [];
  const urls = [];
  if (game.coverUrl) urls.push(game.coverUrl);

  const ext = game.ext || (game.fileName ? game.fileName.split('.').pop().toLowerCase() : '');
  const libSystem = LIBRETRO_SYSTEM_MAP[ext] || (game.shortSystem === 'GBC' ? 'Nintendo - Game Boy Color' : null);

  if (libSystem && game.fileName) {
    const rawBase = game.fileName.replace(/\.[^/.]+$/, '');
    urls.push(`https://thumbnails.libretro.com/${encodeURIComponent(libSystem)}/Named_Boxarts/${encodeURIComponent(rawBase)}.png`);
  }
  if (libSystem && game.title) {
    urls.push(`https://thumbnails.libretro.com/${encodeURIComponent(libSystem)}/Named_Boxarts/${encodeURIComponent(game.title)}.png`);
    const clean = formatGameTitle(game.title);
    if (clean !== game.title) {
      urls.push(`https://thumbnails.libretro.com/${encodeURIComponent(libSystem)}/Named_Boxarts/${encodeURIComponent(clean)}.png`);
    }
  }
  return urls;
}

const GameCoverImage = ({ game, className = '', imgClassName = '', showBadge = false }) => {
  const [srcIndex, setSrcIndex] = useState(0);
  const [failedAll, setFailedAll] = useState(false);
  const urls = useMemo(() => getBoxartUrls(game), [game]);

  const currentUrl = urls[srcIndex];

  if (!currentUrl || failedAll) {
    return (
      <div className={`relative w-full h-full bg-gradient-to-br ${game?.coverGradient || 'from-zinc-800 to-zinc-950'} flex flex-col justify-between p-3 overflow-hidden ${className}`}>
        {showBadge && (
          <span className="self-start px-2 py-0.5 rounded-md text-[10px] font-black bg-black/60 text-white backdrop-blur-sm border border-white/15">
            {game?.shortSystem || 'ROM'}
          </span>
        )}
        <div className="my-auto flex items-center justify-center">
          <Gamepad2 className="w-10 h-10 text-white/40" />
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full overflow-hidden flex items-center justify-center bg-zinc-950 ${className}`}>
      <img
        src={currentUrl}
        alt={formatGameTitle(game?.title || '')}
        onError={() => {
          if (srcIndex + 1 < urls.length) {
            setSrcIndex((i) => i + 1);
          } else {
            setFailedAll(true);
          }
        }}
        className={`w-full h-full object-cover object-center ${imgClassName}`}
        loading="lazy"
      />
      {showBadge && (
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-black bg-black/60 text-white backdrop-blur-sm border border-white/15">
          {game?.shortSystem || 'ROM'}
        </span>
      )}
    </div>
  );
};

export default function App() {
  // Navigation View: 'home' (Netflix Library) | 'ingame' (Vertical Handheld)
  const [currentView, setCurrentView] = useState('home');

  // Games Library & Filter State
  const [games, setGames] = useState(() => {
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
  const [activeGame, setActiveGame] = useState(STUB_GAME);
  const emuFrameRef = useRef(null);
  const pendingStateRef = useRef(null);
  const pendingSrmRef = useRef(null);
  const pendingRtcRef = useRef(null);
  const hasUserInteractedRef = useRef(false);
  const [romUrl, setRomUrl] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [systemFilter, setSystemFilter] = useState('ALL');
  const [showSearch, setShowSearch] = useState(false);

  // Per-Game Isolated Save State Slots Dictionary: { [gameId]: [Slot1, Slot2, Slot3, Slot4] }
  const [savesByGameId, setSavesByGameId] = useState(() => {
    const initialMap = {};
    let games = [];
    try { games = JSON.parse(localStorage.getItem('retro_games') || '[]') || []; } catch (e) {}
    games.forEach((g) => {
      initialMap[g.id] = createEmptySlotsForGame(g.id);
    });
    return initialMap;
  });

  // Modals & Drawers
  // detailGame: opens the Home Page Game Detail & Save State Slots Pop-up Dialog
  const [detailGame, setDetailGame] = useState(null);
  // globalSettingsOpen: opens the Settings Modal (CRT/GB Grid Shaders + Theme Picker)
  const [globalSettingsOpen, setGlobalSettingsOpen] = useState(false);
  // inGameMenuOpen: opens the Top Settings Gear Menu while inside a game
  const [inGameMenuOpen, setInGameMenuOpen] = useState(false);
  // inGameSaveModalMode: null | 'save' | 'load' (opens Per-Game Save State Slots overlay inside a game)
  const [inGameSaveModalMode, setInGameSaveModalMode] = useState(null);
  // cloudModalOpen: opens Google Cloud Save & Sync settings dialog
  const [cloudModalOpen, setCloudModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState(() => getSyncStatus());
  const [cachedUser, setCachedUser] = useState<GoogleUserProfile | null>(() => getCachedUserProfile());
  const [conflictBackups, setConflictBackups] = useState<ConflictBackupItem[]>([]);
  const [showConflictsList, setShowConflictsList] = useState(false);
  const [cloudFiles, setCloudFiles] = useState<{ name: string; size: string; modifiedTime: string }[]>([]);
  const [showCloudFiles, setShowCloudFiles] = useState(false);

  // Theme & Combinable Shader Pipeline State (Auto-saved to localStorage)
  const [themeId, setThemeId] = useState(() => {
    try {
      return localStorage.getItem('retro_theme') || 'midnight';
    } catch (e) {
      return 'midnight';
    }
  });
  const [shaders, setShaders] = useState(() => {
    const defaultShaders = {
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

  // Cloud Sync Listener & Background Sync Initialization
  useEffect(() => {
    const unsub = subscribeSyncStatus(() => {
      setSyncStatus(getSyncStatus());
      setCachedUser(getCachedUserProfile());
    });
    const cleanupListeners = initGlobalSyncListeners(syncTargetStore);

    // Reconcile any downloaded games, save states, and SRAM from IndexedDB into React state
    const reconcileCloudDataFromIdb = async (keys?: string[]) => {
      try {
        const cloudGames = await idbGet('library_games');
        if (Array.isArray(cloudGames) && cloudGames.length > 0) {
          setGames((prev) => {
            const currentIds = new Set(prev.map((g) => g.id));
            const missing = cloudGames.filter((g) => g && g.id && !currentIds.has(g.id));
            if (missing.length === 0) return prev;
            const merged = [...missing, ...prev];
            try { localStorage.setItem('retro_games', JSON.stringify(merged)); } catch (e) {}
            return merged;
          });
        }
      } catch (e) {}

      // Refresh any incoming save states
      const targetKeys = keys || (await idbGetAllKeys().catch(() => []));
      const stateKeys = targetKeys.filter((k) => k.startsWith('state:'));
      if (stateKeys.length > 0) {
        for (const k of stateKeys) {
          const parts = k.split(':');
          const gId = parts[1];
          const slotN = parseInt(parts[2], 10);
          const val = await idbGet(k);
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
      }
    };

    reconcileCloudDataFromIdb();
    const unsubData = subscribeDataUpdated((keys) => {
      reconcileCloudDataFromIdb(keys);
    });

    // Ensure any previously uploaded ROMs on this device are queued to sync to Drive
    const userImported = games.filter((g) => g.real && g.id !== 'pokemon_gold');
    if (userImported.length > 0) {
      idbPut('library_games', userImported).then(() => {
        markLocalSaveModified(syncTargetStore, 'library_games');
        userImported.forEach((g) => {
          idbGet(g.id).then((blob) => {
            if (blob) markLocalSaveModified(syncTargetStore, `rom:${g.id}`);
          });
        });
      });
    }

    return () => {
      unsub();
      cleanupListeners();
      unsubData();
    };
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

  // When paused, automatically reveal the top bar for 5 seconds; when unpaused, auto-hide immediately
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
  const [padLayout, setPadLayout] = useState(loadPadLayout);
  const [customizing, setCustomizing] = useState(false);
  const [selectedPad, setSelectedPad] = useState('dpad');
  const deckRef = useRef(null);
  useEffect(() => {
    try { localStorage.setItem('retro_pad_layout', JSON.stringify(padLayout)); } catch (e) {}
  }, [padLayout]);
  useEffect(() => {
    try { localStorage.setItem('retro_games', JSON.stringify(games)); } catch (e) {}
  }, [games]);
  const getEmu = () => {
    try { return emuFrameRef.current?.contentWindow?.EJS_emulator || null; } catch (e) { return null; }
  };
  const sendKey = (name, down) => {
    if (down) hasUserInteractedRef.current = true;
    const win = emuFrameRef.current?.contentWindow;
    if (!win) return;

    // 1. Direct simulation into EmulatorJS / RetroArch core WASM (Instant 0ms latency)
    try {
      if (typeof win.simulateButton === 'function') {
        win.simulateButton(name, down);
        return; // Direct WASM input succeeded; avoid redundant keyboard event overhead!
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

    // 2. Synthetic keyboard event dispatch to #game and canvas
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
  };
  useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type === 'ejs-srm-update') {
        if (activeGame?.id && e.data?.save) {
          const srmArr = normalizeBinaryData(e.data.save);
          if (srmArr) {
            idbPut(`srm:${activeGame.id}`, srmArr).then(() => {
              markLocalSaveModified(syncTargetStore, `srm:${activeGame.id}`);
            }).catch(() => {});
          }
        }
        return;
      }
      if (e.data?.type !== 'ejs-ready') return;
      const win = emuFrameRef.current?.contentWindow;
      try { win?.setAudioMuted?.(isMuted); } catch (e) {}

      // 1. Inject any pending battery save (.srm) or RTC (.rtc)
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

      // 2. Inject any pending save state (.state)
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
  }, [activeGame?.id]);
  const movePad = (id, x, y) => setPadLayout((l) => ({ ...l, [id]: { ...l[id], x, y } }));
  const scalePad = (id, sc) => setPadLayout((l) => ({ ...l, [id]: { ...l[id], s: sc } }));
  const [isMuted, setIsMuted] = useState(false);
  const [fps, setFps] = useState(60);
  const [liveScore, setLiveScore] = useState(0);
  const [liveFrame, setLiveFrame] = useState(0);
  const [toastMessage, setToastMessage] = useState(null);

  // Refs for Canvas, Game State, Rewind Buffer, and Inputs
  const canvasRef = useRef(null);
  const engineStateRef = useRef(createInitialEngineState('pokegold'));
  const rewindBufferRef = useRef([]);
  const keysRef = useRef({
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
  const EdgeTapRef = useRef({ up: false, down: false, left: false, right: false, actionA: false, actionB: false });

  // Hidden File Input
  const romInputRef = useRef(null);

  const theme = THEMES[themeId] || THEMES.midnight;

  // Helper to show a sleek floating toast banner
  const showToast = useCallback((msg) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 2600);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const applyTheme = (id) => {
    setThemeId(id);
    try { localStorage.setItem('retro_theme', id); } catch (e) {}
    showToast(`Theme Applied: ${THEMES[id]?.name || id}`);
  };

  const toggleShader = (key) => {
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
      const win = emuFrameRef.current?.contentWindow;
      win?.setAudioMuted?.(next);
      const emu = getEmu();
      if (emu) {
        if (typeof emu.setVolume === 'function') emu.setVolume(next ? 0 : 1);
        if (emu.gameManager && typeof emu.gameManager.setVolume === 'function') emu.gameManager.setVolume(next ? 0 : 1);
      }
    } catch (e) {}
    showToast(next ? 'Game Audio Muted' : 'Game Audio On');
  };

  const deleteRom = useCallback(async (gameId) => {
    try {
      await idbDelete(gameId);
      await idbDelete(`rom:${gameId}`);
    } catch (e) {}
    setGames((prev) => {
      const remaining = prev.filter((g) => g.id !== gameId);
      const userImportedOnly = remaining.filter((g) => g.real && g.id !== 'pokemon_gold');
      idbPut('library_games', userImportedOnly).catch(() => {});
      markLocalSaveModified(syncTargetStore, 'library_games');
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

  // ============================================================================
  // AUTOMATIC ROM FILE LOADER & CORE DETECTOR
  // ============================================================================
  const handleRomUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const parts = file.name.split('.');
    const ext = parts.length > 1 ? parts.pop().toLowerCase() : 'gbc';
    const detected = CORE_MAP[ext] || {
      core: 'gambatte',
      system: `Custom ROM (${ext.toUpperCase()})`,
      shortSystem: ext.toUpperCase().slice(0, 4),
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
    };

    // Compute real CRC32-like hash from first 4KB of ROM
    const buffer = await file.slice(0, 4096).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let hash = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i++) {
      hash ^= bytes[i];
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    const crcHex = '0x' + hash.toString(16).toUpperCase().padStart(8, '0');

    // Map core to the best interactive engine so user's uploaded ROM is immediately playable in preview
    const coreToEngine = {
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

    const cleanTitle = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[_-]+/g, ' ');

    const newGame = {
      id: `rom_${Date.now()}`,
      title: cleanTitle,
      subtitle: detected.system,
      fileName: file.name,
      ext,
      core: detected.core,
      system: detected.system,
      shortSystem: detected.shortSystem,
      crc32: crcHex,
      size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
      isDemo: false,
      real: true,
      engineType,
      coverGradient,
      accentColor: '#10b981',
      year: 'USER ROM',
      players: '1 Player',
      description: `Loaded from local device (${file.size.toLocaleString()} bytes). Runs on EmulatorJS core "${detected.core}" (${detected.system}).`,
    };

    try {
      await idbPut(newGame.id, file);
      markLocalSaveModified(syncTargetStore, `rom:${newGame.id}`);
    } catch (err) {
      showToast('Could not store ROM for offline use');
    }
    setGames((prev) => {
      const nextGames = [newGame, ...prev.filter((g) => g.id !== newGame.id)];
      const userImportedOnly = nextGames.filter((g) => g.real && g.id !== 'pokemon_gold');
      idbPut('library_games', userImportedOnly).catch(() => {});
      markLocalSaveModified(syncTargetStore, 'library_games');
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

  // ============================================================================
  // LAUNCH GAME (FRESH OR DIRECTLY INTO A SAVED STATE SLOT)
  // ============================================================================
  const launchGame = useCallback((game, optionalStateData = null) => {
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

  // ============================================================================
  // PER-GAME SAVE STATE CAPTURE, LOAD, EXPORT (.state) & BATTERY (.srm)
  // ============================================================================
  const saveStateToGameSlot = useCallback((game, slotNumber) => {
    if (game.real) {
      const win = emuFrameRef.current?.contentWindow;
      const emu = getEmu();
      let rawState = null;
      try { rawState = win?.getStateData?.() || emu?.gameManager.getState(); } catch (e) {}
      const emuState = normalizeBinaryData(rawState);
      if (!emuState) { showToast('Emulator not ready yet'); return; }
      let shot = null;
      try {
        shot = emuFrameRef.current.contentDocument.querySelector('canvas').toDataURL('image/png');
      } catch (e) {}
      const timeStr0 = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setSavesByGameId((prev) => {
        const existing = prev[game.id] || createEmptySlotsForGame(game.id);
        return {
          ...prev,
          [game.id]: existing.map((sl) =>
            sl.slot === slotNumber
              ? { slot: slotNumber, empty: false, label: `Saved ${timeStr0}`, timestamp: timeStr0, score: 0, frame: 0, screenshot: shot,
                  stateData: { version: 'EJS_STATE', gameId: game.id, timestamp: timeStr0, emuState } }
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
      }).then(() => {
        markLocalSaveModified(syncTargetStore, `state:${game.id}:${slotNumber}`);
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
    markLocalSaveModified(syncTargetStore, `state:${game.id}:${slotNumber}`);

    soundFX.save();
    showToast(`Saved ${game.title} → Slot #${slotNumber}`);
  }, [showToast]);

  const loadStateFromGameSlot = useCallback((game, slotNumber) => {
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
        const win = emuFrameRef.current?.contentWindow;
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

  const deleteGameSlot = useCallback((gameId, slotNumber) => {
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

  // ============================================================================
  // AUTOMATIC OFFLINE PROGRESS PERSISTENCE & BATTERY SAVE (.SAV / .SRM) EXPORT
  // ============================================================================
  const flushLiveProgress = useCallback(async () => {
    if (currentView !== 'ingame' || !activeGame?.id || !activeGame?.real) return;
    const win = emuFrameRef.current?.contentWindow;
    if (!win) return;
    try {
      const srm = normalizeBinaryData(win.getSrmData?.());
      if (srm && srm.length > 0) {
        let nonEmpty = false;
        for (let i = 0; i < srm.length; i += 4) {
          if (srm[i] !== 0 && srm[i] !== 255) { nonEmpty = true; break; }
        }
        if (nonEmpty) {
          await idbPut(`srm:${activeGame.id}`, srm).catch(() => {});
          await markLocalSaveModified(syncTargetStore, `srm:${activeGame.id}`);
        }
      }
      const rtc = normalizeBinaryData(win.getRtcData?.());
      if (rtc && rtc.length > 0) {
        await idbPut(`rtc:${activeGame.id}`, rtc).catch(() => {});
        await markLocalSaveModified(syncTargetStore, `rtc:${activeGame.id}`);
      }
      // Only overwrite autosave if the user has actively played in this session (prevents title-screen clobbering)
      if (hasUserInteractedRef.current) {
        const stArr = normalizeBinaryData(win.getStateData?.());
        if (stArr && stArr.length > 0) {
          await idbPut(`autosave:${activeGame.id}`, stArr).catch(() => {});
          await markLocalSaveModified(syncTargetStore, `autosave:${activeGame.id}`);
        }
      }
    } catch (e) {}
  }, [activeGame?.id, activeGame?.real, currentView]);

  const flushAllBeforeManualSync = useCallback(async () => {
    await flushLiveProgress();
    // Also ensure any in-memory Save State Slots are persisted to IndexedDB with clean Uint8Array buffers
    for (const [gId, slots] of Object.entries(savesByGameId)) {
      if (!Array.isArray(slots)) continue;
      for (const sl of slots) {
        if (sl && !sl.empty && sl.stateData) {
          const key = `state:${gId}:${sl.slot}`;
          const existing = await idbGet(key).catch(() => null);
          if (!existing) {
            const emuSt = normalizeBinaryData(sl.stateData.emuState);
            await idbPut(key, {
              slot: sl.slot,
              label: sl.label,
              timestamp: sl.timestamp,
              screenshot: sl.screenshot,
              emuState: emuSt,
              stateData: sl.stateData
            }).catch(() => {});
            await markLocalSaveModified(syncTargetStore, key);
          }
        }
      }
    }
  }, [flushLiveProgress, savesByGameId]);

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

  const exportBatterySave = useCallback(async (game, ext = 'sav') => {
    if (!game) return;
    const win = emuFrameRef.current?.contentWindow;
    let srmBytes = null;
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

  // ============================================================================
  // KEYBOARD CONTROLS (FOR LAPTOP / DESKTOP PLAYABILITY)
  // ============================================================================
  useEffect(() => {
    const onKeyDown = (e) => {
      if (currentView !== 'ingame') return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      const k = keysRef.current;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') { k.up = true; sendKey('up', true); }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') { k.down = true; sendKey('down', true); }
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { k.left = true; sendKey('left', true); }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') { k.right = true; sendKey('right', true); }
      if (e.code === 'KeyX' || e.code === 'KeyL') { k.actionA = true; sendKey('actionA', true); }
      if (e.code === 'KeyZ' || e.code === 'KeyK') { k.actionB = true; sendKey('actionB', true); }
      if (e.code === 'KeyS') { k.actionX = true; sendKey('actionX', true); }
      if (e.code === 'KeyA') { k.actionY = true; sendKey('actionY', true); }
      if (e.code === 'Enter') { k.start = true; sendKey('start', true); }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'Space') { k.select = true; sendKey('select', true); }
      if (e.code === 'KeyP') setIsPaused((p) => !p);
      if (e.code === 'KeyR' || e.code === 'Backspace') setIsRewinding(true);
      if (e.code === 'KeyF') setIsFastForward((f) => !f);
    };

    const onKeyUp = (e) => {
      const k = keysRef.current;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') { k.up = false; sendKey('up', false); }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') { k.down = false; sendKey('down', false); }
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { k.left = false; sendKey('left', false); }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') { k.right = false; sendKey('right', false); }
      if (e.code === 'KeyX' || e.code === 'KeyL') { k.actionA = false; sendKey('actionA', false); }
      if (e.code === 'KeyZ' || e.code === 'KeyK') { k.actionB = false; sendKey('actionB', false); }
      if (e.code === 'KeyS') { k.actionX = false; sendKey('actionX', false); }
      if (e.code === 'KeyA') { k.actionY = false; sendKey('actionY', false); }
      if (e.code === 'Enter') { k.start = false; sendKey('start', false); }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'Space') { k.select = false; sendKey('select', false); }
      if (e.code === 'KeyR' || e.code === 'Backspace') setIsRewinding(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [currentView]);

  // ============================================================================
  // 60 FPS EMULATION ENGINE & CANVAS RENDERER (4 COMPLETE GAME ENGINES)
  // ============================================================================
  useEffect(() => {
    if (currentView !== 'ingame') return;

    let animId;
    let frameCounter = 0;
    let fpsTimer = performance.now();

    const stepGameFrame = (st, keys) => {
      st.frame += 1;

      // Detect rising-edge button taps for RPG battle menus
      const tap = {
        up: keys.up && !EdgeTapRef.current.up,
        down: keys.down && !EdgeTapRef.current.down,
        left: keys.left && !EdgeTapRef.current.left,
        right: keys.right && !EdgeTapRef.current.right,
        actionA: keys.actionA && !EdgeTapRef.current.actionA,
        actionB: keys.actionB && !EdgeTapRef.current.actionB,
      };
      EdgeTapRef.current = { ...keys };

      // ======================================================================
      // ENGINE 1: POKÉMON GOLD VERSION (GBC RPG + WILD BATTLE ENGINE)
      // ======================================================================
      if (st.engineType === 'pokegold') {
        if (st.battle.active) {
          if (st.battle.cooldown > 0) {
            st.battle.cooldown -= 1;
            return;
          }
          // Navigate 2x2 Battle Command Menu
          if (tap.right && st.battle.menuIndex % 2 === 0) st.battle.menuIndex += 1;
          if (tap.left && st.battle.menuIndex % 2 === 1) st.battle.menuIndex -= 1;
          if (tap.down && st.battle.menuIndex < 2) st.battle.menuIndex += 2;
          if (tap.up && st.battle.menuIndex >= 2) st.battle.menuIndex -= 2;

          if (tap.actionA) {
            const cmd = st.battle.menuIndex;
            // 0: EMBER, 1: TACKLE, 2: POKéBALL, 3: RUN
            if (cmd === 0 || cmd === 1) {
              const moveName = cmd === 0 ? 'EMBER' : 'TACKLE';
              const dmg = cmd === 0 ? 7 + (st.pokeLevel % 4) : 5 + (st.pokeLevel % 3);
              st.battle.enemyHp = Math.max(0, st.battle.enemyHp - dmg);
              soundFX.laser();

              if (st.battle.enemyHp <= 0) {
                st.score += 150;
                st.goldCoins += 200;
                st.pokeXp += 25;
                if (st.pokeXp >= 50) {
                  st.pokeLevel += 1;
                  st.pokeXp = 0;
                  st.pokeMaxHp += 4;
                  st.pokeHp = st.pokeMaxHp;
                  st.dialogText = `CYNDAQUIL grew to Lv.${st.pokeLevel}!`;
                } else {
                  st.dialogText = `Defeated wild ${st.battle.enemyName}! +150 PTS`;
                }
                soundFX.coin();
                st.battle.active = false;
              } else {
                const counterDmg = 2 + (st.battle.enemyLv % 3);
                st.pokeHp = Math.max(4, st.pokeHp - counterDmg);
                st.battle.message = `${st.pokeName} used ${moveName}! (-${dmg} HP)`;
                st.battle.cooldown = 18;
              }
            } else if (cmd === 2) {
              // Throw PokéBall
              if (st.pokeballs > 0) {
                st.pokeballs -= 1;
                const catchChance = st.battle.enemyHp <= st.battle.enemyMaxHp * 0.65;
                if (catchChance || st.frame % 2 === 0) {
                  st.caughtCount += 1;
                  st.score += 300;
                  st.dialogText = `Gotcha! ${st.battle.enemyName} was caught!`;
                  soundFX.save();
                  st.battle.active = false;
                } else {
                  st.battle.message = `Oh no! ${st.battle.enemyName} broke free!`;
                  st.battle.cooldown = 20;
                  soundFX.hit();
                }
              } else {
                st.battle.message = 'No POKéBALLS left!';
              }
            } else if (cmd === 3) {
              st.battle.active = false;
              st.dialogText = 'Got away safely from wild battle!';
              soundFX.jump();
            }
          }
        } else {
          // Overworld Top-Down Movement (New Bark Town / Route 29)
          const speed = 1.6;
          let moved = false;
          if (keys.up) { st.trainerY = Math.max(26, st.trainerY - speed); st.trainerDir = 'up'; moved = true; }
          if (keys.down) { st.trainerY = Math.min(182, st.trainerY + speed); st.trainerDir = 'down'; moved = true; }
          if (keys.left) { st.trainerX = Math.max(16, st.trainerX - speed); st.trainerDir = 'left'; moved = true; }
          if (keys.right) { st.trainerX = Math.min(300, st.trainerX + speed); st.trainerDir = 'right'; moved = true; }

          // Heal at Pokémon Lab House door (top-right house)
          if (st.trainerX > 215 && st.trainerX < 275 && st.trainerY < 72 && tap.actionA) {
            st.pokeHp = st.pokeMaxHp;
            st.pokeballs = Math.max(st.pokeballs, 8);
            st.dialogText = 'PROF. ELM LAB: Cyndaquil fully healed & Balls refilled!';
            soundFX.save();
          }

          if (moved) {
            st.stepCount += 1;
            // Check if walking inside Tall Grass patches
            const inLeftGrass = st.trainerX >= 22 && st.trainerX <= 125 && st.trainerY >= 32 && st.trainerY <= 92;
            const inBottomGrass = st.trainerX >= 150 && st.trainerX <= 285 && st.trainerY >= 122 && st.trainerY <= 180;

            if ((inLeftGrass || inBottomGrass) && st.stepCount % 55 === 0) {
              const wildPool = [
                { name: 'SENTRET', lv: 4, hp: 18, color: '#b45309' },
                { name: 'HOOTHOOT', lv: 5, hp: 22, color: '#d97706' },
                { name: 'TOTODILE', lv: 6, hp: 25, color: '#0284c7' },
                { name: 'PIKACHU', lv: 7, hp: 24, color: '#eab308' }
              ];
              const pick = wildPool[(st.frame + st.stepCount) % wildPool.length];
              st.battle = {
                active: true,
                enemyName: pick.name,
                enemyLv: pick.lv,
                enemyHp: pick.hp,
                enemyMaxHp: pick.hp,
                enemyColor: pick.color,
                menuIndex: 0,
                message: `Wild ${pick.name} appeared!`,
                cooldown: 12
              };
              soundFX.encounter();
            }
          }
        }
      }

      // ======================================================================
      // ENGINE 2: CYBERRUN '89 DX (NES PLATFORMER)
      // ======================================================================
      else if (st.engineType === 'cyberrun') {
        const groundY = 168;
        if ((tap.up || tap.actionA) && st.jumpsLeft > 0) {
          st.playerVy = -7.2;
          st.jumpsLeft -= 1;
          soundFX.jump();
        }
        st.isDucking = keys.down && st.playerY >= groundY;
        st.playerY += st.playerVy;
        st.playerVy += 0.42;
        if (st.playerY >= groundY) {
          st.playerY = groundY;
          st.playerVy = 0;
          st.jumpsLeft = 2;
        }

        if (keys.actionB && st.frame % 10 === 0 && st.bullets.length < 5) {
          st.bullets.push({ x: 62, y: st.playerY - 12 });
          soundFX.laser();
        }
        st.bullets.forEach((b) => { b.x += 7; });
        st.bullets = st.bullets.filter((b) => b.x < 330);

        const speed = 2.8 + st.level * 0.3;
        st.obstacles.forEach((obs) => {
          obs.x -= speed;
          st.bullets.forEach((b) => {
            if (b.x > obs.x && b.x < obs.x + obs.w && b.y > obs.y - 8 && b.y < obs.y + obs.h) {
              obs.x = -40;
              b.x = 400;
              st.score += 60;
              soundFX.coin();
            }
          });
          const pTop = st.isDucking ? st.playerY - 12 : st.playerY - 24;
          if (obs.x < 56 && obs.x + obs.w > 40 && obs.y + obs.h > pTop && obs.y < st.playerY) {
            obs.x = 340 + Math.random() * 60;
            st.score = Math.max(0, st.score - 40);
            soundFX.hit();
          }
          if (obs.x < -25) {
            obs.x = 325 + Math.random() * 80;
            obs.type = Math.random() > 0.45 ? 'drone' : 'flyer';
            obs.y = obs.type === 'flyer' ? 134 : 152;
            st.score += 25;
          }
        });

        st.crystals.forEach((c) => {
          c.x -= speed;
          if (!c.collected && Math.abs(c.x - 48) < 16 && Math.abs(c.y - (st.playerY - 12)) < 20) {
            c.collected = true;
            st.score += 100;
            soundFX.coin();
          }
          if (c.x < -20) {
            c.x = 330 + Math.random() * 110;
            c.y = 110 + Math.random() * 45;
            c.collected = false;
          }
        });
        st.level = 1 + Math.floor(st.score / 500);
      }

      // ======================================================================
      // ENGINE 3: STARBLADE SUPER DX (SNES SPACE SHMUP)
      // ======================================================================
      else if (st.engineType === 'starblade') {
        if (keys.up) st.shipY = Math.max(28, st.shipY - 3.3);
        if (keys.down) st.shipY = Math.min(205, st.shipY + 3.3);
        if (keys.left) st.shipX = Math.max(20, st.shipX - 3.3);
        if (keys.right) st.shipX = Math.min(240, st.shipX + 3.3);

        if ((keys.actionA || keys.actionB) && st.frame % 8 === 0) {
          st.lasers.push({ x: st.shipX + 18, y: st.shipY - 5, vy: keys.actionB ? -0.8 : 0 });
          st.lasers.push({ x: st.shipX + 18, y: st.shipY + 5, vy: keys.actionB ? 0.8 : 0 });
          soundFX.laser();
        }
        st.lasers.forEach((l) => { l.x += 7.5; l.y += l.vy || 0; });
        st.lasers = st.lasers.filter((l) => l.x < 330);

        st.stars.forEach((s) => {
          s.x -= s.speed;
          if (s.x < 0) { s.x = 320; s.y = Math.random() * 220; }
        });

        st.enemies.forEach((en) => {
          en.x -= 1.9 + st.level * 0.25;
          en.y += en.vy;
          if (en.y < 28 || en.y > 200) en.vy *= -1;

          st.lasers.forEach((l) => {
            if (Math.abs(l.x - en.x) < 14 && Math.abs(l.y - en.y) < 14) {
              en.hp -= 1;
              l.x = 400;
              if (en.hp <= 0) {
                st.score += 125;
                soundFX.coin();
                for (let p = 0; p < 6; p++) {
                  st.particles.push({
                    x: en.x,
                    y: en.y,
                    vx: (Math.random() - 0.5) * 4,
                    vy: (Math.random() - 0.5) * 4,
                    ttl: 16
                  });
                }
                en.x = 330 + Math.random() * 60;
                en.y = 40 + Math.random() * 150;
                en.hp = 2;
              }
            }
          });

          if (Math.abs(en.x - st.shipX) < 15 && Math.abs(en.y - st.shipY) < 14) {
            en.x = 340;
            st.shield = Math.max(0, (st.shield || 100) - 20);
            soundFX.hit();
          }
          if (en.x < -20) {
            en.x = 330 + Math.random() * 50;
            en.y = 40 + Math.random() * 150;
          }
        });

        st.particles.forEach((p) => { p.x += p.vx; p.y += p.vy; p.ttl -= 1; });
        st.particles = st.particles.filter((p) => p.ttl > 0);
        st.level = 1 + Math.floor(st.score / 600);
      }

      // ======================================================================
      // ENGINE 4: NEON DRIFT ADVANCE (GBA SYNTHWAVE RACER)
      // ======================================================================
      else if (st.engineType === 'neondrift') {
        const targetSpeed = keys.actionA ? 245 : keys.actionB ? 80 : 160;
        st.speed += (targetSpeed - st.speed) * 0.08;
        if (keys.left) st.carX = Math.max(-95, st.carX - 3.6);
        if (keys.right) st.carX = Math.min(95, st.carX + 3.6);
        st.roadPos = (st.roadPos + st.speed * 0.04) % 100;
        if (st.frame % 5 === 0) st.score += Math.round(st.speed / 25);

        st.traffic.forEach((t) => {
          t.z -= st.speed * 0.012;
          if (t.z < 12 && t.z > 2) {
            const tx = t.lane * 110;
            if (Math.abs(tx - st.carX) < 28) {
              st.speed = 65;
              t.z = 100;
              soundFX.hit();
            }
          }
          if (t.z <= 1) {
            t.z = 100;
            t.lane = (Math.random() - 0.5) * 1.4;
            st.score += 50;
            soundFX.coin();
          }
        });
        st.level = 1 + Math.floor(st.score / 700);
      }
    };

    const drawGameCanvas = (ctx, st) => {
      const W = 320;
      const H = 240;
      ctx.clearRect(0, 0, W, H);

      // ======================================================================
      // RENDER 1: POKÉMON GOLD VERSION (GBC RPG & WILD BATTLE SCREEN)
      // ======================================================================
      if (st.engineType === 'pokegold') {
        if (!st.battle.active) {
          // Overworld Grass Background
          ctx.fillStyle = '#65a30d';
          ctx.fillRect(0, 0, W, H);

          // Border Trees
          ctx.fillStyle = '#14532d';
          for (let x = 0; x < W; x += 20) {
            ctx.fillRect(x, 18, 18, 12);
          }

          // Golden Dirt Road (Route 29)
          ctx.fillStyle = '#fde047';
          ctx.fillRect(14, 92, 292, 34);
          ctx.fillRect(126, 48, 36, 140);

          // Water Pond (Bottom-left)
          ctx.fillStyle = '#0ea5e9';
          ctx.fillRect(24, 138, 86, 46);
          ctx.fillStyle = '#bae6fd';
          ctx.fillRect(34 + ((st.frame >> 4) % 8), 152, 18, 3);
          ctx.fillRect(64 - ((st.frame >> 4) % 8), 168, 22, 3);

          // Prof. Elm's Lab / Healing House (Top-Right)
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(212, 28, 76, 24);
          ctx.fillStyle = '#fef3c7';
          ctx.fillRect(216, 52, 68, 24);
          ctx.fillStyle = '#78350f';
          ctx.fillRect(242, 60, 14, 16);
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(222, 56, 12, 10);
          ctx.fillRect(264, 56, 12, 10);

          // Tall Grass Patch 1 (Top-Left)
          ctx.fillStyle = '#15803d';
          ctx.fillRect(22, 36, 100, 52);
          ctx.fillStyle = '#4ade80';
          for (let gx = 28; gx < 118; gx += 12) {
            for (let gy = 42; gy < 84; gy += 12) {
              ctx.fillRect(gx, gy, 3, 6);
              ctx.fillRect(gx + 4, gy + 2, 3, 5);
            }
          }

          // Tall Grass Patch 2 (Bottom-Right)
          ctx.fillStyle = '#15803d';
          ctx.fillRect(168, 130, 124, 52);
          ctx.fillStyle = '#4ade80';
          for (let gx = 174; gx < 286; gx += 12) {
            for (let gy = 136; gy < 178; gy += 12) {
              ctx.fillRect(gx, gy, 3, 6);
              ctx.fillRect(gx + 4, gy + 2, 3, 5);
            }
          }

          // Player Trainer Sprite (Gold / Ethan)
          const tx = Math.round(st.trainerX);
          const ty = Math.round(st.trainerY);
          const stepBob = Math.sin(st.stepCount * 0.5) * 1.5;
          // Shadow
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(tx - 6, ty + 8, 12, 4);
          // Body & Gold/Black Cap
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(tx - 6, ty - 6 + stepBob, 12, 14);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(tx - 7, ty - 10 + stepBob, 14, 6);
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(tx - 5, ty - 9 + stepBob, 6, 3);
          // Face
          ctx.fillStyle = '#fde68a';
          ctx.fillRect(tx - 4, ty - 4 + stepBob, 8, 5);

          // Bottom GBC Text Dialog Box
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(6, 194, W - 12, 40);
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 3;
          ctx.strokeRect(8, 196, W - 16, 36);

          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 10px monospace';
          ctx.fillText(st.dialogText.slice(0, 44), 16, 212);
          ctx.fillStyle = '#475569';
          ctx.fillText(
            `LV:${st.pokeLevel} HP:${st.pokeHp}/${st.pokeMaxHp} BALLS:${st.pokeballs} CAUGHT:${st.caughtCount}`,
            16,
            225
          );
        } else {
          // TURN-BASED WILD POKÉMON BATTLE SCREEN
          ctx.fillStyle = '#fefce8';
          ctx.fillRect(0, 0, W, H);

          // Enemy Status HUD (Top-Left)
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(14, 24, 142, 42);
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(14, 24, 142, 42);
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 10px monospace';
          ctx.fillText(`${st.battle.enemyName} :L${st.battle.enemyLv}`, 22, 39);
          // Enemy HP Bar
          ctx.fillStyle = '#334155';
          ctx.fillRect(22, 46, 116, 8);
          const eRatio = Math.max(0, st.battle.enemyHp / st.battle.enemyMaxHp);
          ctx.fillStyle = eRatio > 0.5 ? '#22c55e' : eRatio > 0.2 ? '#eab308' : '#ef4444';
          ctx.fillRect(23, 47, Math.round(114 * eRatio), 6);

          // Wild Pokémon Animated Sprite (Top-Right Platform)
          ctx.fillStyle = '#d9f99d';
          ctx.beginPath();
          ctx.ellipse(236, 82, 44, 14, 0, 0, Math.PI * 2);
          ctx.fill();
          const bounce = Math.sin(st.frame * 0.12) * 3;
          ctx.fillStyle = st.battle.enemyColor || '#d97706';
          ctx.fillRect(216, 38 + bounce, 38, 36);
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(222, 46 + bounce, 8, 8);
          ctx.fillRect(238, 46 + bounce, 8, 8);

          // Player Cyndaquil Back Sprite (Bottom-Left Platform)
          ctx.fillStyle = '#d9f99d';
          ctx.beginPath();
          ctx.ellipse(76, 154, 48, 14, 0, 0, Math.PI * 2);
          ctx.fill();
          // Flame on back
          ctx.fillStyle = st.frame % 4 < 2 ? '#ef4444' : '#f59e0b';
          ctx.fillRect(46, 108, 18, 18);
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(54, 116, 36, 34);
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(62, 126, 26, 24);

          // Player Status Box (Bottom-Right)
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(164, 108, 144, 48);
          ctx.strokeStyle = '#0f172a';
          ctx.strokeRect(164, 108, 144, 48);
          ctx.fillStyle = '#0f172a';
          ctx.fillText(`${st.pokeName} :L${st.pokeLevel}`, 172, 123);
          ctx.fillStyle = '#334155';
          ctx.fillRect(172, 130, 120, 8);
          const pRatio = Math.max(0, st.pokeHp / st.pokeMaxHp);
          ctx.fillStyle = pRatio > 0.5 ? '#22c55e' : '#eab308';
          ctx.fillRect(173, 131, Math.round(118 * pRatio), 6);
          ctx.fillStyle = '#0f172a';
          ctx.fillText(`HP: ${st.pokeHp}/${st.pokeMaxHp}`, 172, 149);

          // Battle Command Box
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(6, 164, W - 12, 70);
          ctx.strokeStyle = '#f8fafc';
          ctx.strokeRect(8, 166, W - 16, 66);

          ctx.fillStyle = '#fde047';
          ctx.fillText(st.battle.message.slice(0, 42), 16, 184);

          const moves = ['EMBER', 'TACKLE', `BALL(${st.pokeballs})`, 'RUN'];
          moves.forEach((m, idx) => {
            const col = idx % 2;
            const row = Math.floor(idx / 2);
            const mx = 24 + col * 142;
            const my = 204 + row * 18;
            const selected = st.battle.menuIndex === idx;
            ctx.fillStyle = selected ? '#4ade80' : '#f8fafc';
            ctx.fillText(`${selected ? '▶ ' : '  '}${m}`, mx, my);
          });
        }
      }

      // ======================================================================
      // RENDER 2: CYBERRUN '89 DX (NES)
      // ======================================================================
      else if (st.engineType === 'cyberrun') {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#090d16');
        grad.addColorStop(0.7, '#0f172a');
        grad.addColorStop(1, '#1e1b4b');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Parallax Skyline
        ctx.fillStyle = '#1e293b';
        for (let i = 0; i < 8; i++) {
          const bx = ((i * 45 - (st.frame * 0.5) % 45) + W) % W - 20;
          const bh = 45 + ((i * 29) % 55);
          ctx.fillRect(bx, 180 - bh, 32, bh);
        }

        // Neon Grid Ground
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 180, W, 60);
        ctx.strokeStyle = '#22d3ee';
        ctx.beginPath();
        ctx.moveTo(0, 180);
        ctx.lineTo(W, 180);
        ctx.stroke();

        // Crystals
        st.crystals.forEach((c) => {
          if (!c.collected) {
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(c.x - 5, c.y - 5, 10, 10);
          }
        });

        // Player
        const ph = st.isDucking ? 14 : 24;
        const py = st.playerY - ph;
        ctx.fillStyle = '#22d3ee';
        ctx.fillRect(42, py, 14, ph);
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(48, py + 3, 8, 4);

        // Bullets & Obstacles
        ctx.fillStyle = '#e879f9';
        st.bullets.forEach((b) => ctx.fillRect(b.x, b.y, 10, 3));
        st.obstacles.forEach((obs) => {
          ctx.fillStyle = obs.type === 'flyer' ? '#f43f5e' : '#ef4444';
          ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        });
      }

      // ======================================================================
      // RENDER 3: STARBLADE SUPER DX (SNES)
      // ======================================================================
      else if (st.engineType === 'starblade') {
        ctx.fillStyle = '#050711';
        ctx.fillRect(0, 0, W, H);
        st.stars.forEach((s) => {
          ctx.fillStyle = s.speed > 2 ? '#38bdf8' : '#94a3b8';
          ctx.fillRect(s.x, s.y, s.speed, s.speed);
        });
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(st.shipX + 20, st.shipY);
        ctx.lineTo(st.shipX - 8, st.shipY - 11);
        ctx.lineTo(st.shipX - 8, st.shipY + 11);
        ctx.closePath();
        ctx.fill();

        // Cockpit & Thruster
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(st.shipX + 2, st.shipY - 3, 7, 6);
        ctx.fillStyle = st.frame % 4 < 2 ? '#f43f5e' : '#fbbf24';
        ctx.fillRect(st.shipX - 14, st.shipY - 3, 6, 6);

        // Twin Lasers
        ctx.fillStyle = '#e879f9';
        st.lasers.forEach((l) => ctx.fillRect(l.x, l.y - 1, 10, 3));

        // Enemy Interceptors
        st.enemies.forEach((en) => {
          ctx.fillStyle = en.hp > 1 ? '#f43f5e' : '#fb923c';
          ctx.fillRect(en.x - 9, en.y - 9, 18, 18);
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(en.x - 5, en.y - 3, 5, 6);
        });

        // Explosion Particles
        ctx.fillStyle = '#fde047';
        st.particles.forEach((p) => ctx.fillRect(p.x, p.y, 3, 3));
      }

      // ======================================================================
      // RENDER 4: NEON DRIFT ADVANCE (GBA SYNTHWAVE OUTRUN)
      // ======================================================================
      else if (st.engineType === 'neondrift') {
        const sky = ctx.createLinearGradient(0, 0, 0, 115);
        sky.addColorStop(0, '#1e1b4b');
        sky.addColorStop(0.6, '#701a75');
        sky.addColorStop(1, '#f43f5e');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, 115);

        // Retro Synthwave Sun
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(W / 2, 82, 26, 0, Math.PI * 2);
        ctx.fill();

        // Ground & Perspective Highway
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 115, W, 125);
        for (let y = 115; y < H; y += 6) {
          const p = (y - 115) / 125;
          const roadW = 36 + p * 230;
          const stripe = Math.floor((y + st.roadPos) / 12) % 2 === 0;
          ctx.fillStyle = stripe ? '#1e293b' : '#0f172a';
          ctx.fillRect(W / 2 - roadW / 2, y, roadW, 6);
          ctx.fillStyle = stripe ? '#f43f5e' : '#22d3ee';
          ctx.fillRect(W / 2 - roadW / 2 - 5, y, 5, 6);
          ctx.fillRect(W / 2 + roadW / 2, y, 5, 6);
        }

        // Traffic Cars
        st.traffic.forEach((t) => {
          const p = Math.max(0.05, 1 - t.z / 100);
          const ty = 118 + p * 102;
          const tx = W / 2 + t.lane * (p * 185);
          const cw = 10 + p * 24;
          const ch = 7 + p * 15;
          ctx.fillStyle = t.color;
          ctx.fillRect(tx - cw / 2, ty - ch, cw, ch);
        });

        // Player Outrun Supercar
        const px = W / 2 + st.carX;
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(px - 20, 198, 40, 16);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(px - 14, 192, 28, 7);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(px - 17, 202, 7, 4);
        ctx.fillRect(px + 10, 202, 7, 4);
      }

      // Top In-Canvas Telemetry Strip
      ctx.fillStyle = 'rgba(9, 13, 22, 0.78)';
      ctx.fillRect(0, 0, W, 18);
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`${activeGame.shortSystem} • ${activeGame.core.toUpperCase()}`, 6, 12);
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(`SCORE: ${String(st.score).padStart(5, '0')}`, 225, 12);

      if (isRewinding) {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.28)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('⏪ REWINDING TIME...', 80, H / 2);
      } else if (isFastForward) {
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('⏩ 2X TURBO', 142, 12);
      }
    };

    const loop = (now) => {
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
              stepGameFrame(engineStateRef.current, keysRef.current);
            }
            if (engineStateRef.current.frame % 3 === 0) {
              rewindBufferRef.current.push(JSON.parse(JSON.stringify(engineStateRef.current)));
              if (rewindBufferRef.current.length > 180) {
                rewindBufferRef.current.shift();
              }
            }
          }
        }
        drawGameCanvas(ctx, engineStateRef.current);
      }

      animId = requestAnimationFrame(loop);
    };

    if (!activeGame.real) animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [currentView, activeGame, isPaused, isRewinding, isFastForward]);

  // Drive the real emulator from the pause / fast-forward / rewind controls
  useEffect(() => {
    if (!activeGame.real || !romUrl) return;
    const t = setTimeout(() => {
      const emu = getEmu();
      try { isPaused ? emu?.pause() : emu?.play(); } catch (e) {}
    }, 50);
    return () => clearTimeout(t);
  }, [isPaused, romUrl, activeGame]);
  useEffect(() => {
    if (!activeGame.real) return;
    try {
      const win = emuFrameRef.current?.contentWindow;
      win?.setFastForward?.(isFastForward);
      const emu = getEmu();
      if (emu?.gameManager) {
        if (typeof emu.gameManager.setFastForwardRatio === 'function') emu.gameManager.setFastForwardRatio(2);
        if (typeof emu.gameManager.toggleFastForward === 'function') emu.gameManager.toggleFastForward(isFastForward ? 1 : 0);
      }
      // Re-synchronize currently held keys so inputs never stick or drop when toggling 2x
      Object.entries(keysRef.current).forEach(([k, down]) => {
        if (down) win?.simulateButton?.(k, true);
      });
    } catch (e) {}
  }, [isFastForward]);
  useEffect(() => {
    if (!activeGame.real) return;
    try { getEmu()?.gameManager.toggleRewind(isRewinding ? 1 : 0); } catch (e) {}
  }, [isRewinding]);

  // Filtered Games for Library
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

  // Pointer helper for virtual touch buttons
  const bindPadButton = (keyName) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      e.stopPropagation();
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch (err) {}
      keysRef.current[keyName] = true;
      sendKey(keyName, true);
    },
    onPointerUp: (e) => {
      e.preventDefault();
      e.stopPropagation();
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch (err) {}
      keysRef.current[keyName] = false;
      sendKey(keyName, false);
    },
    onPointerLeave: (e) => {
      if (keysRef.current[keyName]) {
        try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch (err) {}
        keysRef.current[keyName] = false;
        sendKey(keyName, false);
      }
    },
    onPointerCancel: (e) => {
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch (err) {}
      if (keysRef.current[keyName]) sendKey(keyName, false);
      keysRef.current[keyName] = false;
    }
  });

  // Active shaders count badge
  const activeShaderCount = Object.values(shaders).filter(Boolean).length;

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

      {/* ====================================================================
          VIEW 1: NETFLIX-STYLE HOME LIBRARY (MOBILE + LAPTOP RESPONSIVE)
      ==================================================================== */}
      {currentView === 'home' && (
        <div className="pb-16">
          {/* Sticky Top Navigation Bar */}
          <header
            className="sticky top-0 z-30 backdrop-blur-xl bg-zinc-950/85 border-b border-zinc-800/80 px-4 sm:px-6 py-3"
            style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
          >
            <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
              {/* Brand Logo */}
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${theme.accentSoft}`}>
                  <Gamepad2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black tracking-tight text-base sm:text-lg text-zinc-100">RETRO</span>
                    <span className={`font-black tracking-tight text-base sm:text-lg ${theme.accentText}`}>POCKET</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 hidden sm:block">
                    Mobile & Web Libretro Frontend • Auto-Core & Per-Game State Slots
                  </p>
                </div>
              </div>

              {/* Right Action Buttons: Search Toggle, + Load ROM, Settings */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSearch((s) => !s)}
                  className={`p-2.5 rounded-xl border transition active:scale-95 ${
                    showSearch
                      ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                      : 'bg-zinc-900/90 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
                  }`}
                  title="Search ROMs"
                >
                  <Search className="w-4 h-4" />
                </button>

                <button
                  onClick={() => romInputRef.current?.click()}
                  className={`p-2.5 rounded-xl font-bold shadow-lg transition active:scale-95 ${theme.accentBg}`}
                  title="Load ROM"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </button>

                {/* Cloud Save Sync Button / User Avatar */}
                <button
                  onClick={() => setCloudModalOpen(true)}
                  className={`px-2.5 py-2 rounded-xl border transition active:scale-95 flex items-center gap-1.5 cursor-pointer ${
                    cachedUser
                      ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-100'
                      : 'bg-zinc-900/90 hover:bg-zinc-800 border-zinc-800 text-sky-400'
                  }`}
                  title={
                    cachedUser
                      ? `Google Cloud Save: ${cachedUser.email} (${syncStatus.status})`
                      : 'Sign In to Google for Cloud Save'
                  }
                >
                  {cachedUser ? (
                    <div className="relative flex items-center justify-center">
                      {cachedUser.picture ? (
                        <img
                          src={cachedUser.picture}
                          alt={cachedUser.name || 'User'}
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-sky-500 text-zinc-950 font-black text-[10px] flex items-center justify-center">
                          {(cachedUser.name || cachedUser.email || 'G')[0].toUpperCase()}
                        </div>
                      )}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-zinc-900 ${
                          syncStatus.status === 'idle'
                            ? 'bg-emerald-400'
                            : syncStatus.status === 'syncing'
                              ? 'bg-amber-400 animate-ping'
                              : syncStatus.status === 'offline'
                                ? 'bg-zinc-500'
                                : syncStatus.status === 'needs_reauth'
                                  ? 'bg-amber-400'
                                  : 'bg-rose-400'
                        }`}
                      />
                    </div>
                  ) : (
                    <Cloud className="w-4 h-4 text-sky-400" />
                  )}
                  <span className="hidden sm:inline text-xs font-bold">
                    {cachedUser ? (cachedUser.name?.split(' ')[0] || 'Cloud') : 'Cloud Save'}
                  </span>
                </button>

                <button
                  onClick={() => setGlobalSettingsOpen(true)}
                  className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 transition active:scale-95"
                  title="Appearance"
                >
                  <Settings className="w-4 h-4 text-emerald-400" />
                </button>
              </div>
            </div>

            {/* Collapsible Search Bar */}
            {showSearch && (
              <div className="mt-2.5 max-w-6xl mx-auto relative">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search loaded ROMs or systems..."
                  className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl pl-8 pr-8 py-2 text-xs text-zinc-100 outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </header>

          {/* Main Netflix-Style Content Container */}
          <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 space-y-7">
            {/* Hero Spotlight Banner (Most Recent Loaded ROM) */}
            {games[0] && (
              <div
                className="relative rounded-3xl overflow-hidden border border-zinc-800/90 shadow-2xl h-56 sm:h-64 flex items-end p-5 sm:p-8"
              >
                {/* Full Cover Image Background */}
                <div className="absolute inset-0">
                  <GameCoverImage game={games[0]} imgClassName="w-full h-full object-cover opacity-60" />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-transparent" />
                </div>

                <div className="relative z-10 w-full flex items-end justify-between gap-4">
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-zinc-950">
                        Featured Cartridge
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-zinc-900/80 text-zinc-200 border border-white/15">
                        {games[0].system}
                      </span>
                    </div>

                    <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white drop-shadow">
                      {formatGameTitle(games[0].title)}
                    </h1>
                  </div>

                  <button
                    onClick={() => launchGame(games[0])}
                    className="w-12 h-12 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 flex items-center justify-center shadow-2xl transition active:scale-95 shrink-0"
                    title={`Play ${formatGameTitle(games[0].title)}`}
                  >
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Filter Bar: System Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {['ALL', 'GBC', 'GBA', 'NES', 'SNES', 'GEN'].map((sys) => (
                <button
                  key={sys}
                  onClick={() => setSystemFilter(sys)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    systemFilter === sys
                      ? theme.accentBg
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                  }`}
                >
                  {sys}
                </button>
              ))}
            </div>

            {/* GAME LIBRARY */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className={`w-4 h-4 ${theme.accentText}`} />
                  <h2 className="text-sm sm:text-base font-extrabold tracking-tight">
                    Game Library ({filteredGames.length})
                  </h2>
                </div>
                <button
                  onClick={() => romInputRef.current?.click()}
                  className={`text-xs font-semibold flex items-center gap-1 ${theme.accentText} hover:underline`}
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Add ROM</span>
                </button>
              </div>

              {filteredGames.length === 0 && games.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                    <Gamepad2 className="w-8 h-8 text-zinc-500" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-zinc-200">No ROMs in Library</h3>
                    <p className="text-xs text-zinc-500 max-w-xs">
                      Load your own .gbc, .gba, .nes, .sfc, or .md ROM files to start playing.
                    </p>
                  </div>
                  <button
                    onClick={() => romInputRef.current?.click()}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg transition active:scale-95 ${theme.accentBg}`}
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Load ROM</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                  {filteredGames.map((game) => (
                    <div
                      key={game.id}
                      onClick={() => setDetailGame(game)}
                      className={`group cursor-pointer rounded-2xl overflow-hidden border transition-all duration-200 hover:-translate-y-1 shadow-lg ${theme.cardBg}`}
                    >
                      {/* Cartridge Cover Poster */}
                      <div className="relative h-44 sm:h-48 overflow-hidden rounded-t-xl bg-zinc-900">
                        <GameCoverImage game={game} />
                      </div>

                      {/* Card Footer */}
                      <div className="p-3 space-y-1">
                        <h3 className="font-bold text-xs sm:text-sm text-zinc-100 truncate">
                          {formatGameTitle(game.title)}
                        </h3>
                        <p className="text-[11px] text-zinc-400 truncate">
                          {game.system || game.shortSystem}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Quick "Add ROM" Card */}
                  <button
                    onClick={() => romInputRef.current?.click()}
                    className="rounded-2xl border-2 border-dashed border-zinc-800 hover:border-emerald-500/60 bg-zinc-900/40 hover:bg-zinc-900/80 p-4 flex flex-col items-center justify-center gap-2 min-h-[200px] transition group"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-zinc-800 group-hover:bg-emerald-500/20 flex items-center justify-center transition">
                      <Plus className="w-6 h-6 text-zinc-400 group-hover:text-emerald-400" />
                    </div>
                    <span className="text-xs font-bold text-zinc-200">Load Downloaded ROM</span>
                    <span className="text-[10px] text-zinc-500 text-center leading-tight">
                      Auto-detects .gbc, .gba, .nes, .sfc, .md
                    </span>
                  </button>
                </div>
              )}
            </section>
          </main>
        </div>
      )}

      {/* ====================================================================
          VIEW 2: VERTICAL IN-GAME HANDHELD LAYOUT
          (Top Settings Bar -> Upper Game Screen -> Lower Control Deck)
      ==================================================================== */}
      {currentView === 'ingame' && (
        <div className={`fixed inset-0 w-full overflow-hidden ${shaders.amoled ? 'bg-black' : 'bg-zinc-950'}`} style={{ height: '100dvh' }}>
          {/* Vertical Handheld Shell Container */}
          <div
            className={`relative w-full h-full max-w-[560px] mx-auto flex flex-col overflow-hidden ${shaders.amoled ? 'bg-black border-zinc-900' : theme.shellBg}`}
          >
            {/* Tap zone at top: reveals the auto-hiding top bar */}
            <button
              aria-label="Show top bar"
              onClick={() => revealTopBar()}
              className="absolute top-0 left-0 right-0 z-30 cursor-pointer"
              style={{ height: 'max(env(safe-area-inset-top, 0px) + 28px, 44px)' }}
            />
            {/* 1. TOP BAR (auto-hides) */}
            <div
              className={`absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-3.5 pb-2.5 ${
                shaders.amoled ? 'bg-black border-b border-zinc-900' : 'bg-black/90 backdrop-blur-md border-b border-white/10'
              } transition-all duration-300 shadow-xl ${
                topBarVisible ? 'translate-y-0 opacity-100 pointer-events-auto' : '-translate-y-full opacity-0 pointer-events-none'
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

              {/* Top Settings Gear Button (Contains Hide Pad, Save State, Load State, Shaders) */}
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
                  {/* Save State Button -> Opens this game's Save Slots */}
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

                  {/* Load State Button -> Opens this game's Save Slots */}
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

                {/* Google Cloud Save */}
                <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                      <Cloud className="w-3.5 h-3.5 text-sky-400" />
                      <span>Google Cloud Save</span>
                    </span>
                    <span
                      className={`font-semibold ${
                        syncStatus.status === 'idle'
                          ? 'text-emerald-400'
                          : syncStatus.status === 'syncing'
                            ? 'text-amber-400 animate-pulse'
                            : syncStatus.status === 'offline'
                              ? 'text-zinc-400'
                              : 'text-amber-300'
                      }`}
                    >
                      {syncStatus.status === 'idle'
                        ? 'Synced'
                        : syncStatus.status === 'syncing'
                          ? 'Syncing...'
                          : syncStatus.status === 'offline'
                            ? 'Offline'
                            : syncStatus.status === 'needs_reauth'
                              ? 'Reconnect'
                              : 'Not Linked'}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        setInGameMenuOpen(false);
                        setCloudModalOpen(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-semibold transition cursor-pointer"
                    >
                      <Cloud className="w-3.5 h-3.5 text-sky-400" />
                      <span className="truncate max-w-[140px]">{cachedUser ? (cachedUser.email || 'Cloud Account') : 'Connect Account'}</span>
                    </button>
                    {cachedUser && (
                      <button
                        onClick={async () => {
                          await flushAllBeforeManualSync();
                          const ok = await executeFullSync(syncTargetStore, true);
                          if (ok) showToast('Cloud Sync Complete!');
                        }}
                        disabled={syncStatus.status === 'syncing'}
                        className="px-2.5 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        title="Sync now"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.status === 'syncing' ? 'animate-spin' : ''}`} />
                        <span>Sync</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Cartridge Battery Save (.SAV / .SRM) Export */}
                <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400">
                    <span className="font-bold uppercase tracking-wider text-amber-300/90">Export Battery Save (.sav / .srm)</span>
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

                {/* Audio Toggle Row (Mutes/Unmutes emulator and sound FX) */}
                <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80 text-xs">
                  <div className="flex items-center gap-1.5 text-zinc-300 font-bold">
                    {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
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

            {/* 2. UPPER SCREEN AREA: GAME VIEWPORT + COMBINABLE SHADERS */}
            <div
              className={`flex-none p-2 flex flex-col items-center justify-center ${shaders.amoled ? 'bg-black border-b border-zinc-900' : theme.bezelBg}`}
              style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 24px)' }}
            >
              <div
                className={`relative bg-black overflow-hidden border-2 ${
                  shaders.amoled ? 'border-zinc-900 shadow-none' : 'border-zinc-800 shadow-inner'
                } ${
                  shaders.crtCurve ? 'rounded-2xl scale-[0.99]' : 'rounded-lg'
                }`}
                style={{
                  aspectRatio: String(coreRatio(activeGame.core)),
                  width: `min(100%, ${(48 * coreRatio(activeGame.core)).toFixed(2)}dvh)`,
                  boxShadow: !shaders.amoled && shaders.rgbBloom
                    ? `0 0 28px ${theme.hex}33, inset 0 0 18px rgba(0,0,0,0.75)`
                    : 'none',
                  filter: !shaders.amoled && shaders.rgbBloom ? 'contrast(1.08) saturate(1.18) brightness(1.04)' : 'none'
                }}
              >
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

                {/* Shader Layer 2: Game Boy Dot-Matrix LCD Grid Lines (Combinable!) */}
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
              </div>
            </div>

            {/* 3. CONTROL DECK: free-placement, resizable pad groups */}
            <div
              ref={deckRef}
              className={`relative flex-1 min-h-0 border-t ${shaders.amoled ? 'bg-black border-zinc-900' : theme.deckBg} overflow-hidden`}
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 14px)' }}
            >
              <PadGroup id="transport" layout={padLayout} customizing={customizing} selected={customizing && selectedPad === 'transport'} onSelect={setSelectedPad} onMove={movePad} deckRef={deckRef}>
<div className="grid grid-cols-3 gap-2 w-[300px]">
                {/* Pause Toggle */}
                <button
                  onClick={() => {
                    setIsPaused((p) => {
                      const next = !p;
                      if (next) {
                        revealTopBar(5000);
                      } else {
                        if (topBarTimer.current) clearTimeout(topBarTimer.current);
                        setTopBarVisible(false);
                      }
                      return next;
                    });
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl font-bold text-xs border transition active:scale-95 ${
                    isPaused
                      ? 'bg-amber-500 text-zinc-950 border-amber-300 shadow-lg'
                      : shaders.amoled
                        ? 'bg-black text-zinc-200 border-zinc-800 hover:bg-zinc-900'
                        : 'bg-zinc-950/80 text-zinc-200 border-white/10 hover:bg-zinc-900'
                  }`}
                >
                  {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
                  <span>{isPaused ? 'Resume' : 'Pause'}</span>
                </button>

                {/* Hold Rewind */}
                <button
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setIsRewinding(true);
                  }}
                  onPointerUp={() => setIsRewinding(false)}
                  onPointerLeave={() => setIsRewinding(false)}
                  onPointerCancel={() => setIsRewinding(false)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl font-bold text-xs border transition active:scale-95 ${
                    isRewinding
                      ? 'bg-amber-400 text-zinc-950 border-amber-200 shadow-lg'
                      : shaders.amoled
                        ? 'bg-black text-zinc-200 border-zinc-800 hover:bg-zinc-900'
                        : 'bg-zinc-950/80 text-zinc-200 border-white/10 hover:bg-zinc-900'
                  }`}
                >
                  <Rewind className="w-3.5 h-3.5" />
                  <span>Rewind</span>
                </button>

                {/* 2x Speed Turbo Toggle */}
                <button
                  onClick={() => setIsFastForward((f) => !f)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl font-bold text-xs border transition active:scale-95 ${
                    isFastForward
                      ? 'bg-sky-400 text-zinc-950 border-sky-200 shadow-lg'
                      : shaders.amoled
                        ? 'bg-black text-zinc-200 border-zinc-800 hover:bg-zinc-900'
                        : 'bg-zinc-950/80 text-zinc-200 border-white/10 hover:bg-zinc-900'
                  }`}
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span>2x Speed</span>
                </button>
              </div>
</PadGroup>
              {(!hidePad || customizing) && (<PadGroup id="dpad" layout={padLayout} customizing={customizing} selected={customizing && selectedPad === 'dpad'} onSelect={setSelectedPad} onMove={movePad} deckRef={deckRef}>
<div className="relative w-32 h-32 select-none touch-none">
                      {/* Up */}
                      <button
                        {...bindPadButton('up')}
                        className={`absolute top-0 left-10 w-11 h-11 rounded-t-xl border flex items-center justify-center shadow-md touch-none select-none ${theme.dpadBg}`}
                        aria-label="Up"
                      >
                        <ChevronUp className="w-6 h-6" />
                      </button>
                      {/* Down */}
                      <button
                        {...bindPadButton('down')}
                        className={`absolute bottom-0 left-10 w-11 h-11 rounded-b-xl border flex items-center justify-center shadow-md touch-none select-none ${theme.dpadBg}`}
                        aria-label="Down"
                      >
                        <ChevronDown className="w-6 h-6" />
                      </button>
                      {/* Left */}
                      <button
                        {...bindPadButton('left')}
                        className={`absolute top-10 left-0 w-11 h-11 rounded-l-xl border flex items-center justify-center shadow-md touch-none select-none ${theme.dpadBg}`}
                        aria-label="Left"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                      {/* Right */}
                      <button
                        {...bindPadButton('right')}
                        className={`absolute top-10 right-0 w-11 h-11 rounded-r-xl border flex items-center justify-center shadow-md touch-none select-none ${theme.dpadBg}`}
                        aria-label="Right"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>
                      {/* Center Pivot */}
                      <div className={`absolute top-10 left-10 w-11 h-11 ${shaders.amoled ? 'bg-black border-black' : 'bg-zinc-900 border-zinc-800'} flex items-center justify-center pointer-events-none`}>
                        <div className={`w-4 h-4 rounded-full ${shaders.amoled ? 'bg-zinc-900' : 'bg-zinc-800'}`} />
                      </div>
                    </div>
</PadGroup>
              )}
              {(!hidePad || customizing) && (<PadGroup id="actions" layout={padLayout} customizing={customizing} selected={customizing && selectedPad === 'actions'} onSelect={setSelectedPad} onMove={movePad} deckRef={deckRef}>
<div className="relative w-36 h-32 select-none touch-none">
                      {/* X (Top) */}
                      <button
                        {...bindPadButton('actionX')}
                        className={`absolute top-0 left-12 w-12 h-12 rounded-full border-2 font-black text-sm shadow-lg flex items-center justify-center transition active:scale-90 touch-none select-none ${theme.btnXY}`}
                      >
                        X
                      </button>
                      {/* Y (Left) */}
                      <button
                        {...bindPadButton('actionY')}
                        className={`absolute top-10 left-1 w-12 h-12 rounded-full border-2 font-black text-sm shadow-lg flex items-center justify-center transition active:scale-90 touch-none select-none ${theme.btnXY}`}
                      >
                        Y
                      </button>
                      {/* B (Bottom) */}
                      <button
                        {...bindPadButton('actionB')}
                        className={`absolute bottom-0 left-12 w-12 h-12 rounded-full border-2 font-black text-base shadow-xl flex items-center justify-center transition active:scale-90 touch-none select-none ${theme.btnB}`}
                      >
                        B
                      </button>
                      {/* A (Right) */}
                      <button
                        {...bindPadButton('actionA')}
                        className={`absolute top-10 right-1 w-12 h-12 rounded-full border-2 font-black text-base shadow-xl flex items-center justify-center transition active:scale-90 touch-none select-none ${theme.btnA}`}
                      >
                        A
                      </button>
                    </div>
</PadGroup>
              )}
              {(!hidePad || customizing) && (<PadGroup id="system" layout={padLayout} customizing={customizing} selected={customizing && selectedPad === 'system'} onSelect={setSelectedPad} onMove={movePad} deckRef={deckRef}>
<div className="flex items-center justify-center gap-6 pt-1 pb-1 select-none touch-none">
                    <button
                      {...bindPadButton('select')}
                      className="flex flex-col items-center gap-1 group touch-none select-none"
                    >
                      <div className={`w-12 h-3.5 rounded-full ${shaders.amoled ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-800 border-zinc-600'} group-active:bg-emerald-400 border shadow-inner -rotate-12 transition`} />
                      <span className="text-[9px] font-black tracking-widest text-zinc-400 uppercase">
                        SELECT
                      </span>
                    </button>

                    <button
                      {...bindPadButton('start')}
                      className="flex flex-col items-center gap-1 group touch-none select-none"
                    >
                      <div className={`w-12 h-3.5 rounded-full ${shaders.amoled ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-800 border-zinc-600'} group-active:bg-emerald-400 border shadow-inner -rotate-12 transition`} />
                      <span className="text-[9px] font-black tracking-widest text-zinc-400 uppercase">
                        START
                      </span>
                    </button>
                  </div>
</PadGroup>
              )}
              {customizing && (
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
                      value={padLayout[selectedPad].s}
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
                      onClick={() => { setCustomizing(false); showToast('Controls saved'); }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 text-zinc-950 text-xs font-black"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 1: GAME DETAIL & PER-GAME SAVE STATE SLOTS POP-UP DIALOG
          (Triggered when clicking a Game on Home Page OR Save/Load in-game)
      ==================================================================== */}
      {(detailGame || inGameSaveModalMode) && (() => {
        const targetGame = detailGame || activeGame;
        const gameSlots = savesByGameId[targetGame.id] || createEmptySlotsForGame(targetGame.id);

        return (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
            style={{
              paddingTop: 'max(env(safe-area-inset-top, 0px) + 20px, 36px)',
              paddingBottom: 'max(env(safe-area-inset-bottom, 0px) + 20px, 36px)',
              paddingLeft: 'max(env(safe-area-inset-left, 0px) + 12px, 16px)',
              paddingRight: 'max(env(safe-area-inset-right, 0px) + 12px, 16px)'
            }}
          >
            <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden my-auto">
              {/* Dialog Header Banner */}
              <div className={`relative p-5 bg-gradient-to-r ${targetGame.coverGradient} flex-none`}>
                <div className="absolute inset-0 bg-zinc-950/65" />
                <div className="relative z-10 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-black/60 text-amber-300 border border-amber-400/30">
                        {targetGame.system}
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-white">{formatGameTitle(targetGame.title)}</h2>
                  </div>

                  <button
                    onClick={() => {
                      setDetailGame(null);
                      setInGameSaveModalMode(null);
                    }}
                    className="p-2 rounded-full bg-black/50 hover:bg-black/80 text-zinc-200 border border-white/15"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Primary Play & Actions Bar */}
                <div className="relative z-10 mt-4 flex flex-wrap items-center gap-2.5">
                  {currentView === 'home' && (
                    <button
                      onClick={() => launchGame(targetGame)}
                      className="p-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-black shadow-lg transition active:scale-95"
                      title={`Play ${formatGameTitle(targetGame.title)}`}
                    >
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </button>
                  )}

                  <button
                    onClick={() => exportBatterySave(targetGame, 'sav')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-amber-300 border border-amber-500/30 text-xs font-bold transition"
                    title="Download .sav for physical cartridge flasher (GB Operator / FlashGBX)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export .SAV</span>
                  </button>

                  <button
                    onClick={() => exportBatterySave(targetGame, 'srm')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-bold transition"
                    title="Download .srm for RetroArch"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>Export .SRM</span>
                  </button>

                  <button
                    onClick={() => {
                      if (window.confirm(`Delete "${formatGameTitle(targetGame.title)}" from library?`)) {
                        deleteRom(targetGame.id);
                      }
                    }}
                    className="p-2.5 rounded-xl bg-zinc-900/90 hover:bg-rose-900/30 text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-500/40 transition active:scale-95"
                    title="Delete ROM"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Per-Game Save State Slots Grid (4 Isolated Slots per Game) */}
              <div className="p-5 space-y-3 flex-1 overflow-y-auto">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-extrabold text-zinc-100 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      <span>Save State Slots • {formatGameTitle(targetGame.title)}</span>
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Each game has its own dedicated save state slots. Switch or resume anytime.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {gameSlots.map((slotObj) => (
                    <div
                      key={slotObj.slot}
                      className={`rounded-2xl border p-3 flex flex-col justify-between gap-2.5 transition ${
                        slotObj.empty
                          ? 'bg-zinc-900/40 border-zinc-800/80'
                          : 'bg-zinc-900/95 border-emerald-500/40 shadow-md'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Thumbnail Preview */}
                        <div className="w-20 h-16 rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                          {slotObj.screenshot ? (
                            <img
                              src={slotObj.screenshot}
                              alt={`Slot ${slotObj.slot}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-[10px] font-mono text-zinc-600">EMPTY</span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-emerald-400 font-mono">
                              SLOT #{slotObj.slot}
                            </span>
                            {slotObj.timestamp && (
                              <span className="text-[10px] font-mono text-zinc-400">
                                {slotObj.timestamp}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-zinc-100 truncate mt-0.5">
                            {slotObj.label}
                          </p>
                          {!slotObj.empty && (
                            <p className="text-[10px] font-mono text-zinc-400">
                              Score: {slotObj.score} • Frame: {slotObj.frame}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Slot Action Buttons */}
                      <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-800/80">
                        {/* Load & Play Slot */}
                        <button
                          disabled={slotObj.empty}
                          onClick={() => loadStateFromGameSlot(targetGame, slotObj.slot)}
                          className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition ${
                            slotObj.empty
                              ? 'bg-zinc-800/50 text-zinc-600 cursor-not-allowed'
                              : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
                          }`}
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>{currentView === 'home' ? 'Play State' : 'Load'}</span>
                        </button>

                        {/* Save Current Frame into Slot (When in-game on this game) */}
                        {currentView === 'ingame' && activeGame.id === targetGame.id && (
                          <button
                            onClick={() => saveStateToGameSlot(targetGame, slotObj.slot)}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold transition"
                          >
                            <Camera className="w-3 h-3" />
                            <span>Save Here</span>
                          </button>
                        )}

                        {/* Clear Slot */}
                        {!slotObj.empty && (
                          <button
                            onClick={() => deleteGameSlot(targetGame.id, slotObj.slot)}
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-500/30 text-rose-400"
                            title="Delete slot"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ====================================================================
          MODAL 2: GLOBAL SETTINGS (CRT + GAME BOY GRID SHADERS & THEMES)
      ==================================================================== */}
      {globalSettingsOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
          style={{
            paddingTop: 'max(env(safe-area-inset-top, 0px) + 20px, 36px)',
            paddingBottom: 'max(env(safe-area-inset-bottom, 0px) + 20px, 36px)',
            paddingLeft: 'max(env(safe-area-inset-left, 0px) + 12px, 16px)',
            paddingRight: 'max(env(safe-area-inset-right, 0px) + 12px, 16px)'
          }}
        >
          <div className="w-full max-w-xl max-h-[88vh] flex flex-col rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden my-auto">
            <div className="flex-none flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950">
              <div className="flex items-center gap-2.5">
                <Sliders className={`w-5 h-5 ${theme.accentText}`} />
                <h2 className="text-base font-black text-white">Appearance</h2>
              </div>
              <button
                onClick={() => setGlobalSettingsOpen(false)}
                className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* AMOLED Battery Saver Dedicated Toggle Card */}
              <div
                onClick={() => toggleShader('amoled')}
                className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                  shaders.amoled
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-white'
                    : 'bg-zinc-900/70 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${shaders.amoled ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                    <span className="text-sm font-extrabold text-white">AMOLED Black Mode</span>
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Battery Saver
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-snug">
                    Turns chassis & display pure pitch black (<span className="text-zinc-200 font-mono">#000000</span>) to physically power off OLED pixels, disables screen bloom, and turns grid lines true black.
                  </p>
                </div>

                <div
                  className={`shrink-0 w-12 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                    shaders.amoled ? 'bg-emerald-500 justify-end' : 'bg-zinc-800 border border-zinc-700 justify-start'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-white shadow-md" />
                </div>
              </div>

              {/* Section 1: CRT & LCD SHADER FILTER */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Tv className="w-4 h-4 text-emerald-400" />
                  <span>CRT & LCD SHADER FILTER</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    {
                      key: 'scanlines',
                      title: 'CRT Scanlines',
                      desc: 'Authentic horizontal phosphor scanline grilles'
                    },
                    {
                      key: 'gbGrid',
                      title: 'Game Boy LCD Grid Lines',
                      desc: 'Dot-matrix pixel grid overlay (combines with AMOLED black!)'
                    },
                    {
                      key: 'rgbBloom',
                      title: 'Post-RGB Phosphor Bloom',
                      desc: 'High-contrast halation glow & color boost'
                    },
                    {
                      key: 'bezelVignette',
                      title: 'Bezel Vignette Shadow',
                      desc: 'Subtle tube corner darkening around screen edges'
                    },
                    {
                      key: 'crtCurve',
                      title: 'CRT Curved Glass',
                      desc: 'Rounded Trinitron-style cabinet bezel corners'
                    }
                  ].map((item) => {
                    const checked = shaders[item.key];
                    return (
                      <button
                        key={item.key}
                        onClick={() => toggleShader(item.key)}
                        className={`text-left p-3 rounded-2xl border transition flex items-start gap-3 ${
                          checked
                            ? 'bg-emerald-500/15 border-emerald-500/50 text-white'
                            : 'bg-zinc-900/70 border-zinc-800 text-zinc-400 hover:bg-zinc-900'
                        }`}
                      >
                        <div
                          className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ${
                            checked
                              ? 'bg-emerald-400 border-emerald-300 text-zinc-950'
                              : 'border-zinc-700 bg-zinc-950'
                          }`}
                        >
                          {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div>
                          <div className="text-xs font-bold">{item.title}</div>
                          <div className="text-[10px] text-zinc-400 leading-snug mt-0.5">
                            {item.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: THEME */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-amber-400" />
                  <span>THEME</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {Object.values(THEMES).map((t) => {
                    const active = themeId === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => applyTheme(t.id)}
                        className={`p-3 rounded-2xl border text-left transition flex items-center justify-between ${
                          active
                            ? 'bg-zinc-900 border-emerald-400 text-white shadow-lg'
                            : 'bg-zinc-900/50 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                        }`}
                      >
                        <div className="text-xs font-bold flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-full inline-block border border-white/20"
                            style={{ backgroundColor: t.hex }}
                          />
                          <span>{t.name}</span>
                        </div>
                        {active && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 3: GOOGLE DRIVE CLOUD SAVE & SYNC
      ==================================================================== */}
      {cloudModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
          style={{
            paddingTop: 'max(env(safe-area-inset-top, 0px) + 20px, 36px)',
            paddingBottom: 'max(env(safe-area-inset-bottom, 0px) + 20px, 36px)',
            paddingLeft: 'max(env(safe-area-inset-left, 0px) + 12px, 16px)',
            paddingRight: 'max(env(safe-area-inset-right, 0px) + 12px, 16px)'
          }}
          onClick={() => setCloudModalOpen(false)}
        >
          <div
            className="w-full max-w-xl max-h-[88vh] flex flex-col rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-none flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950">
              <div className="flex items-center gap-2.5">
                <Cloud className="w-5 h-5 text-sky-400" />
                <div>
                  <h2 className="text-base font-black text-white flex items-center gap-2">
                    Google Cloud Save
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30">
                      Offline-First
                    </span>
                  </h2>
                </div>
              </div>
              <button
                onClick={() => setCloudModalOpen(false)}
                className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Account / Status Banner */}
              {cachedUser ? (
                <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {cachedUser.picture ? (
                        <img
                          src={cachedUser.picture}
                          alt={cachedUser.name || 'User'}
                          className="w-10 h-10 rounded-full object-cover border border-white/20"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-sky-500 text-zinc-950 font-black text-sm flex items-center justify-center">
                          {(cachedUser.name || cachedUser.email || 'G')[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-extrabold text-white">{cachedUser.name || 'Google Account'}</div>
                        <div className="text-xs text-zinc-400 font-mono">{cachedUser.email}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center gap-1.5 justify-end">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            syncStatus.status === 'idle'
                              ? 'bg-emerald-400'
                              : syncStatus.status === 'syncing'
                                ? 'bg-amber-400 animate-ping'
                                : syncStatus.status === 'offline'
                                  ? 'bg-zinc-500'
                                  : syncStatus.status === 'needs_reauth'
                                    ? 'bg-amber-400'
                                    : 'bg-rose-400'
                          }`}
                        />
                        <span className="text-xs font-bold text-zinc-200 capitalize">
                          {syncStatus.status === 'idle'
                            ? 'Synced'
                            : syncStatus.status === 'syncing'
                              ? 'Syncing'
                              : syncStatus.status === 'offline'
                                ? 'Offline'
                                : syncStatus.status === 'needs_reauth'
                                  ? 'Session Expired'
                                  : syncStatus.status === 'error'
                                    ? 'Sync Error'
                                    : 'Disconnected'}
                        </span>
                      </div>
                      {syncStatus.lastSyncTime && (
                        <div className="text-[10px] text-zinc-500 mt-0.5">
                          Last: {syncStatus.lastSyncTime}
                        </div>
                      )}
                    </div>
                  </div>

                  {syncStatus.details && (
                    <div className="text-[11px] bg-black/40 px-3 py-2 rounded-lg border border-white/5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={syncStatus.status === 'error' ? 'text-rose-400 font-semibold' : 'text-zinc-400'}>
                          {syncStatus.details}
                        </span>
                        {syncStatus.status === 'needs_reauth' && (
                          <button
                            onClick={() => signInWithGoogle()}
                            className="text-amber-400 hover:text-amber-300 font-bold ml-2 underline cursor-pointer shrink-0"
                          >
                            Reconnect
                          </button>
                        )}
                      </div>
                      {syncStatus.status === 'error' && syncStatus.details.includes('Enable at console.developers.google.com') && (
                        <a
                          href="https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=812701015700"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block text-[10px] text-sky-400 hover:text-sky-300 underline font-bold mt-1"
                        >
                          👉 Click here to enable Google Drive API in Google Cloud Console
                        </a>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={async () => {
                        await flushAllBeforeManualSync();
                        const ok = await executeFullSync(syncTargetStore, true);
                        if (showCloudFiles) {
                          getCloudFilesSummary(false).then(setCloudFiles);
                        }
                        if (ok) showToast('Google Drive Cloud Sync Complete!');
                      }}
                      disabled={syncStatus.status === 'syncing'}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 font-extrabold text-xs flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.status === 'syncing' ? 'animate-spin' : ''}`} />
                      <span>{syncStatus.status === 'syncing' ? 'Syncing...' : 'Sync Now'}</span>
                    </button>

                    <button
                      onClick={async () => {
                        await signOutGoogle();
                        showToast('Signed out of Google Cloud Save');
                      }}
                      className="py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-sky-400" />
                      <span>Cross-Device Cloud Saves</span>
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Connect your Google Account to automatically sync save states, battery saves (<span className="text-zinc-200 font-mono">.sav</span>), and progress across your phone, tablet, and PC.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-2 text-[11px] text-zinc-300">
                    <div className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong className="text-white">Zero Server Cost:</strong> Saves directly to your private Google Drive app storage (<span className="text-zinc-400 font-mono">appDataFolder</span>).</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong className="text-white">Seamless Offline Play:</strong> Saves are always written instantly to your device. When Wi-Fi reconnects, changes automatically sync in the background.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong className="text-white">Private & Isolated:</strong> Files are invisible in your standard Drive and only accessible by Retro Station.</span>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      const ok = await signInWithGoogle();
                      if (ok) {
                        showToast('Connected to Google Drive!');
                        await executeFullSync(syncTargetStore, true);
                      }
                    }}
                    className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-zinc-100 text-zinc-950 font-black text-sm flex items-center justify-center gap-2.5 shadow-xl transition active:scale-95 cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span>Sign in with Google</span>
                  </button>
                </div>
              )}

              {/* Conflict Backups & Data Management */}
              {cachedUser && (
                <div className="space-y-2.5 pt-2 border-t border-zinc-900">
                  {/* Google Drive Storage Inspector */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">Google Drive AppData Storage</span>
                    <button
                      onClick={async () => {
                        const files = await getCloudFilesSummary(true);
                        setCloudFiles(files);
                        setShowCloudFiles((s) => !s);
                      }}
                      className="text-xs text-sky-400 hover:text-sky-300 font-bold cursor-pointer"
                    >
                      {showCloudFiles ? 'Hide Files' : 'View Stored Files'}
                    </button>
                  </div>

                  {showCloudFiles && (
                    <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                      <div className="text-[11px] font-bold text-zinc-300 flex items-center justify-between">
                        <span>Files stored in your Google Drive:</span>
                        <span className="text-[10px] text-zinc-500 font-mono">{cloudFiles.length} files</span>
                      </div>
                      {cloudFiles.length === 0 ? (
                        <div className="text-[10px] py-2 text-center">
                          {syncStatus.status === 'error' ? (
                            <span className="text-rose-400 font-medium">{syncStatus.details}</span>
                          ) : (
                            <span className="text-zinc-500">No files in Google Drive yet. Tap "Sync Now" above to upload!</span>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {cloudFiles.map((file, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-black/40 text-[10px] border border-white/5">
                              <div>
                                <div className="font-bold text-zinc-200">{file.name}</div>
                                <div className="text-zinc-500">Modified: {file.modifiedTime}</div>
                              </div>
                              <span className="font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">{file.size}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">Conflict Safety Copies</span>
                    <button
                      onClick={async () => {
                        const list = await listCloudConflictBackups();
                        setConflictBackups(list);
                        setShowConflictsList((s) => !s);
                      }}
                      className="text-xs text-sky-400 hover:text-sky-300 font-bold cursor-pointer"
                    >
                      {showConflictsList ? 'Hide Backups' : 'View Backups'}
                    </button>
                  </div>

                  {showConflictsList && (
                    <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                      <div className="text-[11px] font-bold text-zinc-300">Conflict Safety Copies:</div>
                      {conflictBackups.length === 0 ? (
                        <div className="text-[10px] text-zinc-500 py-2 text-center">No conflicts detected. All saves are in sync!</div>
                      ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {conflictBackups.map((bk, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-black/40 text-[10px] border border-white/5">
                              <div>
                                <div className="font-mono text-zinc-200 truncate max-w-[200px]">{bk.filename}</div>
                                <div className="text-zinc-500">Device: {bk.deviceId} • {new Date(bk.timestamp).toLocaleString()}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={async () => {
                      if (window.confirm('Are you sure you want to delete all cloud save files from your Google Drive appDataFolder? (Your local saves on this device will remain intact).')) {
                        const ok = await deleteAllCloudSaves();
                        if (ok) showToast('Cloud saves deleted from Google Drive');
                      }
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Cloud Saves from Google Drive</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}