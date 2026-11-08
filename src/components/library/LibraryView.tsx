import React from 'react';
import {
  Gamepad2,
  HardDrive,
  Plus,
  Settings,
  Play,
  Cloud,
  Shuffle,
  History,
  Coffee,
  Sun,
  Moon,
  MoreVertical,
} from 'lucide-react';
import { Game, Theme } from '../../types';
import { formatGameTitle, getBoxartUrls } from '../../constants/cores';
import { idbGet } from '../../services/storage/idb';
import { GameCoverImage } from '../common/GameCoverImage';
import { GameCard } from './GameCard';
import appIcon from '../../assets/icon.png';

interface LibraryViewProps {
  games: Game[];
  filteredGames: Game[];
  theme: Theme;
  showSearch: boolean;
  setShowSearch: React.Dispatch<React.SetStateAction<boolean>>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  systemFilter: string;
  setSystemFilter: (s: string) => void;
  onSelectGame: (game: Game) => void;
  onLaunchGame: (game: Game) => void;
  onOpenSettings: () => void;
  onTriggerAddRom: () => void;
  onOpenCloudSync: () => void;
  cloudStatus?: 'unlinked' | 'idle' | 'syncing' | 'needs_reauth' | 'offline' | 'error';
  onOpenControls?: () => void;
  recentGameIds?: string[];
  onToggleLightDark?: () => void;
}

const AmbientBackdropTile: React.FC<{ game: Game; theme: Theme }> = ({ game, theme }) => {
  return (
    <div className="w-full h-full overflow-hidden relative">
      <GameCoverImage
        game={game}
        className="w-full h-full border-0 !bg-transparent"
        imgClassName="w-full h-full object-cover"
      />
    </div>
  );
};

export const LibraryView: React.FC<LibraryViewProps> = ({
  games,
  filteredGames,
  theme,
  showSearch,
  setShowSearch,
  searchQuery,
  setSearchQuery,
  systemFilter,
  setSystemFilter,
  onSelectGame,
  onLaunchGame,
  onOpenSettings,
  onTriggerAddRom,
  onOpenCloudSync,
  cloudStatus,
  onOpenControls,
  recentGameIds,
  onToggleLightDark,
}) => {
  // ── Random Featured Cartridge ──────────────────────────────────────────
  const [featuredIndex, setFeaturedIndex] = React.useState<number>(() => {
    return games.length > 0 ? Math.floor(Math.random() * games.length) : 0;
  });

  React.useEffect(() => {
    if (games.length > 0) {
      setFeaturedIndex(Math.floor(Math.random() * games.length));
    }
  }, [games.length]);

  const featuredGame = games[featuredIndex] || games[0] || null;

  const handleShuffleFeatured = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (games.length <= 1) return;
    setFeaturedIndex((prev) => {
      let next = Math.floor(Math.random() * games.length);
      while (next === prev && games.length > 1) {
        next = Math.floor(Math.random() * games.length);
      }
      return next;
    });
  };

  // ── Recently Played Games ──────────────────────────────────────────────
  const recentGames = React.useMemo(() => {
    if (!recentGameIds || recentGameIds.length === 0) return [];
    return recentGameIds
      .map((id) => games.find((g) => g.id === id))
      .filter((g): g is Game => Boolean(g));
  }, [recentGameIds, games]);

  // ── Blurred Background of Randomized Installed ROMs (GPU-capped 4 tiles) ──
  const bgGames = React.useMemo(() => {
    if (games.length === 0) return [];
    const pool = [...games];
    const featured = games[featuredIndex] || pool[0];
    const rest = pool.filter((g) => g.id !== featured.id).sort(() => 0.5 - Math.random());
    const combined = [featured, ...rest];
    const selected: Game[] = [];
    for (let i = 0; i < 4; i++) {
      selected.push(combined[i % combined.length]);
    }
    return selected;
  }, [games, featuredIndex]);

  // ── Mobile Overflow Menu (secondary header actions) ──────────────────────
  const [actionsMenuOpen, setActionsMenuOpen] = React.useState(false);
  const actionsMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!actionsMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setActionsMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActionsMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [actionsMenuOpen]);

  return (
    <div className="relative pb-16 min-h-[100vh] min-h-[100lvh]">
      {/* Ambient Animated Blurred ROM Backdrop */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none bg-zinc-950">
        <div className="grid grid-cols-2 grid-rows-2 w-full h-full opacity-30 sm:opacity-40 blur-lg sm:blur-xl ambient-backdrop-pan scale-115">
          {bgGames.map((g, idx) => (
            <AmbientBackdropTile key={`bg-tile-${g.id}-${idx}`} game={g} theme={theme} />
          ))}
        </div>
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 50% 30%, rgba(9,9,11,0.2) 0%, rgba(9,9,11,0.68) 65%, rgba(9,9,11,0.92) 100%)`
          }}
        />
      </div>
      {/* Sticky Top Navigation Bar */}
      <header
        className="sticky top-0 z-30 backdrop-blur-xl bg-zinc-950/85 border-b border-zinc-800/80 px-4 sm:px-6 py-3 hardware-panel"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Brand Logo */}
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center border ${theme.accentSoft} shadow-sm bg-zinc-900`}>
              <img src={appIcon} alt="Retro Station Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black tracking-tight text-base sm:text-lg text-zinc-100">RETRO</span>
                <span className={`font-black tracking-tight text-base sm:text-lg ${theme.accentText}`}>STATION</span>
              </div>
              <p className="text-[10px] text-zinc-400 hidden sm:block">
                Mobile & Web Libretro Frontend • Auto-Core & Per-Game State Slots
              </p>
            </div>
          </div>

          {/* Right Action Buttons: Buy Me a Coffee, + Load ROM, Cloud Vault, Controls, Settings */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <a
              href="https://buymeacoffee.com/kurixutian"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 sm:p-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 tactile-btn transition flex items-center justify-center"
              title="Buy Me a Coffee"
              aria-label="Buy Me a Coffee"
            >
              <Coffee className="w-4 h-4 text-amber-400 shrink-0" />
            </a>

            <button
              onClick={onTriggerAddRom}
              className={`p-2 sm:p-2.5 rounded-xl font-bold shadow-lg tactile-btn transition ${theme.accentBg}`}
              title="Load ROM"
              aria-label="Load ROM"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </button>

            <button
              onClick={onOpenCloudSync}
              className={`p-2 sm:p-2.5 rounded-xl border tactile-btn transition hidden sm:flex items-center gap-1.5 ${
                cloudStatus === 'idle'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                  : cloudStatus === 'syncing'
                  ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                  : 'bg-zinc-900/90 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
              }`}
              title="Cloud Save Vault"
              aria-label="Cloud Save Vault"
            >
              <Cloud className="w-4 h-4" />
              {cloudStatus === 'idle' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              )}
            </button>

            {onOpenControls && (
              <button
                onClick={onOpenControls}
                className="p-2 sm:p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 tactile-btn transition hidden sm:block"
                title="Controls & Keybindings Guide"
                aria-label="Controls and keybindings"
              >
                <Gamepad2 className="w-4 h-4 text-sky-400" />
              </button>
            )}

            {onToggleLightDark && (
              <button
                onClick={onToggleLightDark}
                className="p-2 sm:p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 tactile-btn transition hidden sm:block"
                title={theme.isLight ? 'Switch to Vader Obsidian (Dark Mode)' : 'Switch to Trooper White (Light Mode)'}
                aria-label="Toggle Light/Dark Theme"
              >
                {theme.isLight ? (
                  <Moon className="w-4 h-4 text-indigo-400" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-400" />
                )}
              </button>
            )}

            <button
              onClick={onOpenSettings}
              className="p-2 sm:p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 tactile-btn transition hidden sm:block"
              title="Configuration"
              aria-label="Configuration Settings"
            >
              <Settings className="w-4 h-4 text-emerald-400" />
            </button>

            {/* Mobile Overflow Menu: Cloud Vault / Controls / Theme / Configuration */}
            <div className="relative sm:hidden" ref={actionsMenuRef}>
              <button
                onClick={() => setActionsMenuOpen((o) => !o)}
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 tactile-btn transition"
                title="More actions"
                aria-label="More actions"
                aria-haspopup="menu"
                aria-expanded={actionsMenuOpen}
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {actionsMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+10px)] w-56 rounded-2xl border border-zinc-800 bg-zinc-950/95 backdrop-blur-xl shadow-2xl hardware-panel p-1.5"
                >
                  <button
                    role="menuitem"
                    onClick={() => { setActionsMenuOpen(false); onOpenCloudSync(); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-zinc-200 hover:bg-zinc-800/70 transition text-left"
                  >
                    <Cloud className={`w-4 h-4 ${cloudStatus === 'syncing' ? 'text-sky-400' : cloudStatus === 'idle' ? 'text-emerald-400' : 'text-zinc-400'}`} />
                    <span className="flex-1">Cloud Save Vault</span>
                    {cloudStatus === 'idle' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                    {cloudStatus === 'syncing' && <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />}
                  </button>

                  {onOpenControls && (
                    <button
                      role="menuitem"
                      onClick={() => { setActionsMenuOpen(false); onOpenControls(); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-zinc-200 hover:bg-zinc-800/70 transition text-left"
                    >
                      <Gamepad2 className="w-4 h-4 text-sky-400" />
                      <span className="flex-1">Controls</span>
                    </button>
                  )}

                  {onToggleLightDark && (
                    <button
                      role="menuitem"
                      onClick={() => { setActionsMenuOpen(false); onToggleLightDark(); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-zinc-200 hover:bg-zinc-800/70 transition text-left"
                    >
                      {theme.isLight ? (
                        <Moon className="w-4 h-4 text-indigo-400" />
                      ) : (
                        <Sun className="w-4 h-4 text-amber-400" />
                      )}
                      <span className="flex-1">{theme.isLight ? 'Dark Mode' : 'Light Mode'}</span>
                    </button>
                  )}

                  <button
                    role="menuitem"
                    onClick={() => { setActionsMenuOpen(false); onOpenSettings(); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-zinc-200 hover:bg-zinc-800/70 transition text-left"
                  >
                    <Settings className="w-4 h-4 text-emerald-400" />
                    <span className="flex-1">Configuration</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-5 space-y-7">
        {/* Slot-1 Active Cartridge Deck Bay */}
        {featuredGame && (
          <div className="relative rounded-3xl overflow-hidden border border-zinc-800/90 shadow-2xl p-4 sm:p-6 hardware-panel bg-zinc-950/70">
            {/* Ambient Cartridge Art Backdrop */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
              <div className="w-full h-full opacity-45 sm:opacity-50 blur-lg hero-art-pan scale-110">
                <AmbientBackdropTile game={featuredGame} theme={theme} />
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/90 via-zinc-950/65 to-zinc-950/80" />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-transparent to-zinc-950/40" />
            </div>

            {/* Molded Cartridge Slot Top Grip Rib */}
            <div className="relative z-10 h-3 w-full rounded-t-xl bg-black/60 border-b border-white/5 mb-4 flex items-center justify-between px-3">
              <div className="w-24 h-full cartridge-grip opacity-50" />
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 hardware-led" />
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-400">
                  SLOT-1 DECK BAY
                </span>
              </div>
            </div>

            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
              {/* Physical Cartridge Unit Preview + Details */}
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`Play cartridge ${formatGameTitle(featuredGame.title)}`}
                  onClick={() => onSelectGame(featuredGame)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectGame(featuredGame);
                    }
                  }}
                  className="relative w-20 h-24 sm:w-24 sm:h-28 rounded-2xl overflow-hidden shrink-0 bg-zinc-900 border-2 border-zinc-700/80 p-1 flex flex-col cursor-pointer cartridge-card focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <div className="h-2.5 w-full bg-black/60 rounded-t-lg mb-1 flex items-center justify-center">
                    <div className="w-10 h-full cartridge-grip opacity-50" />
                  </div>
                  <div className="flex-1 rounded-lg overflow-hidden bg-black relative">
                    <GameCoverImage game={featuredGame} imgClassName="w-full h-full object-cover" />
                  </div>
                </div>

                <div className="space-y-2 min-w-0 flex-1">
                  <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white truncate">
                    {formatGameTitle(featuredGame.title)}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-black uppercase tracking-wider bg-zinc-900 text-amber-300 border border-amber-400/30">
                      {featuredGame.system || featuredGame.shortSystem}
                    </span>
                    {games.length > 1 && (
                      <button
                        onClick={handleShuffleFeatured}
                        className="flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-[10px] font-bold transition active:scale-95"
                        title="Cycle Next Cartridge in Deck"
                        aria-label="Cycle next cartridge in deck"
                      >
                        <Shuffle className="w-3 h-3 text-emerald-400" />
                        <span>Swap Cart</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Tactile Deck Controls */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                <button
                  onClick={() => onSelectGame(featuredGame)}
                  className="px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-bold tactile-btn transition"
                >
                  Save Slots
                </button>
                <button
                  onClick={() => onLaunchGame(featuredGame)}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs shadow-xl tactile-btn transition ${theme.accentBg}`}
                  title={`Play ${formatGameTitle(featuredGame.title)}`}
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Insert & Play</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recently Played Section (2 Columns x 3 Rows with consistent sizing) */}
        {recentGames.length > 0 && (
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className={`w-4 h-4 ${theme.accentText}`} />
                <h2 className="text-xs sm:text-sm font-extrabold tracking-tight text-zinc-100">
                  Recently Played
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400">
                  {recentGames.length}
                </span>
              </div>
            </div>

            {/* 2-Column Grid (up to 3 rows of consistently sized rows) */}
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              {recentGames.slice(0, 6).map((game) => (
                <div
                  key={`recent-${game.id}`}
                  onClick={() => onSelectGame(game)}
                  className="group relative flex items-center gap-2.5 p-2 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 shadow-sm transition active:scale-[0.98] cursor-pointer h-14 sm:h-16 overflow-hidden hardware-panel select-none"
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${formatGameTitle(game.title)}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectGame(game);
                    }
                  }}
                >
                  {/* Small Cartridge Art */}
                  <div className="relative w-10 h-10 sm:w-11 sm:h-12 rounded-lg overflow-hidden shrink-0 bg-zinc-950 border border-zinc-700/60 shadow-inner">
                    <GameCoverImage
                      game={game}
                      imgClassName="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                  </div>

                  {/* Name and System beside it */}
                  <div className="flex-1 min-w-0 pr-1 space-y-0.5">
                    <h3 className="text-xs font-bold text-zinc-100 truncate group-hover:text-white transition">
                      {formatGameTitle(game.title)}
                    </h3>
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-zinc-800 text-amber-300 border border-white/5">
                        {game.shortSystem || game.system}
                      </span>
                    </div>
                  </div>

                  {/* Quick Play Trigger */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onLaunchGame(game);
                    }}
                    className="w-8 h-8 sm:w-7 sm:h-7 rounded-full bg-zinc-800 hover:bg-white text-zinc-300 hover:text-zinc-950 flex items-center justify-center shrink-0 border border-white/10 opacity-80 group-hover:opacity-100 transition active:scale-90"
                    title={`Play ${formatGameTitle(game.title)}`}
                    aria-label={`Play ${formatGameTitle(game.title)}`}
                  >
                    <Play className="w-3 h-3 fill-current ml-0.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CARTRIDGE BINDER & SYSTEM DIVIDER TABS */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <HardDrive className={`w-4 h-4 ${theme.accentText}`} />
              <h2 className="text-sm sm:text-base font-extrabold tracking-tight">
                Cartridge Binder
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400">
                {filteredGames.length} {filteredGames.length === 1 ? 'ROM' : 'ROMs'}
              </span>
            </div>

            {/* Binder System Divider Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              {['ALL', ...new Set(games.map((g) => g.shortSystem))].filter(Boolean).map((sys) => (
                <button
                  key={sys}
                  onClick={() => setSystemFilter(sys)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold tactile-btn transition ${
                    systemFilter === sys
                      ? theme.accentBg
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                  }`}
                >
                  {sys}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800/90 p-3.5 sm:p-5 binder-page">
            {filteredGames.length === 0 && games.length === 0 ? (
              <div className="py-16 px-4 flex flex-col items-center justify-center text-center space-y-5 max-w-md mx-auto">
                <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-inner">
                  <Gamepad2 className="w-8 h-8 text-zinc-400" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-black text-zinc-100">Your Cartridge Shelf is Empty</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Insert your personal game backup files (<span className="text-zinc-300 font-mono">.gb, .gbc, .gba, .zip</span>) to play instantly in browser with CRT shaders and battery saves.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full justify-center">
                  <button
                    onClick={onTriggerAddRom}
                    className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-xs tactile-btn shadow-lg transition ${theme.accentBg}`}
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Insert Cartridge (.ROM)</span>
                  </button>
                  {onOpenControls && (
                    <button
                      onClick={onOpenControls}
                      className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-bold border border-zinc-800 transition tactile-btn"
                    >
                      <Gamepad2 className="w-4 h-4 text-sky-400" />
                      <span>View Keybindings</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                {filteredGames.map((game) => (
                  <div key={game.id} className="p-1.5 rounded-2xl bg-black/40 border border-zinc-800/70 binder-slot">
                    <GameCard
                      game={game}
                      theme={theme}
                      onSelect={onSelectGame}
                    />
                  </div>
                ))}

                {/* Empty Binder Slot: Quick "Add ROM" Bay */}
                <button
                  onClick={onTriggerAddRom}
                  className="rounded-2xl border-2 border-dashed border-zinc-800 hover:border-emerald-500/60 bg-black/40 hover:bg-zinc-900/80 p-4 flex flex-col items-center justify-center gap-2 min-h-[210px] transition group tactile-btn binder-slot"
                >
                  <div className="w-11 h-11 rounded-2xl bg-zinc-900 group-hover:bg-emerald-500/20 border border-zinc-800 flex items-center justify-center transition">
                    <Plus className="w-6 h-6 text-zinc-400 group-hover:text-emerald-400" />
                  </div>
                  <span className="text-xs font-bold text-zinc-200">Insert New Cartridge</span>
                  <span className="text-[10px] text-zinc-400 text-center leading-tight">
                    .gb, .gbc, .gba, .nes, .sfc, .md
                  </span>
                </button>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};
