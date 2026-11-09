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
  Search,
  X,
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
    <div className={`relative pb-16 min-h-[100vh] min-h-[100lvh] ${theme.isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
      {/* Matte Console Ground */}
      <div className={`fixed inset-0 pointer-events-none overflow-hidden z-0 select-none ${theme.isLight ? 'bg-[#eae6dd]' : 'bg-[#0a0a0c]'}`} />
      {/* Sticky Top Navigation Bar */}
      <header
        className={`sticky top-0 z-30 backdrop-blur-md border-b px-4 sm:px-6 py-3 hardware-panel ${
          theme.isLight
            ? 'bg-[#dedad0]/95 border-[#cfcac0] text-[#121214]'
            : 'bg-[#0a0a0c]/95 border-[#222227] text-[#f4f4f6]'
        }`}
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Brand Logo */}
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center border ${theme.accentSoft} shadow-sm ${theme.isLight ? 'bg-white' : 'bg-zinc-900'}`}>
              <img src={appIcon} alt="Retro Station Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`font-black tracking-tight text-base sm:text-lg ${theme.isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>RETRO</span>
                <span className={`font-black tracking-tight text-base sm:text-lg ${theme.accentText}`}>STATION</span>
              </div>
              <p className={`text-[10px] hidden sm:block ${theme.isLight ? 'text-stone-600' : 'text-zinc-400'}`}>
                Mobile & Web Libretro Frontend • Auto-Core & Per-Game State Slots
              </p>
            </div>
          </div>

          {/* Right Action Buttons: Cloud Vault, Coffee, + Load ROM, Controls, Theme, Settings */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={onOpenCloudSync}
              className={`p-2 sm:p-2.5 rounded-xl border tactile-btn transition flex items-center gap-1.5 ${
                theme.isLight
                  ? 'bg-[#dedad0] hover:bg-[#d5d0c5] border-[#cfcac0] text-[#121214]'
                  : 'bg-[#131316] hover:bg-[#1a1a1f] border-[#222227] text-[#f4f4f6]'
              }`}
              title="Cloud Save Vault"
              aria-label="Cloud Save Vault"
            >
              <Cloud className="w-4 h-4" />
              {cloudStatus === 'idle' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              )}
            </button>

            <a
              href="https://buymeacoffee.com/kurixutian"
              target="_blank"
              rel="noopener noreferrer"
              className={`p-2 sm:p-2.5 rounded-xl border tactile-btn transition flex items-center justify-center ${
                theme.isLight
                  ? 'bg-[#dedad0] hover:bg-[#d5d0c5] border-[#cfcac0] text-[#121214]'
                  : 'bg-[#131316] hover:bg-[#1a1a1f] border-[#222227] text-[#f4f4f6]'
              }`}
              title="Buy Me a Coffee"
              aria-label="Buy Me a Coffee"
            >
              <Coffee className="w-4 h-4 shrink-0" />
            </a>

            <button
              onClick={onTriggerAddRom}
              className={`p-2 sm:p-2.5 rounded-xl font-bold tactile-btn transition shadow-sm ${theme.accentBg}`}
              title="Load ROM"
              aria-label="Load ROM"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </button>

            {onOpenControls && (
              <button
                onClick={onOpenControls}
                className={`p-2 sm:p-2.5 rounded-xl border tactile-btn transition hidden sm:block ${
                  theme.isLight
                    ? 'bg-[#dedad0] hover:bg-[#d5d0c5] border-[#cfcac0] text-[#121214]'
                    : 'bg-[#131316] hover:bg-[#1a1a1f] border-[#222227] text-[#f4f4f6]'
                }`}
                title="Controls & Keybindings Guide"
                aria-label="Controls and keybindings"
              >
                <Gamepad2 className="w-4 h-4" />
              </button>
            )}

            {onToggleLightDark && (
              <button
                onClick={onToggleLightDark}
                className={`p-2 sm:p-2.5 rounded-xl border tactile-btn transition hidden sm:block ${
                  theme.isLight
                    ? 'bg-[#dedad0] hover:bg-[#d5d0c5] border-[#cfcac0] text-[#121214]'
                    : 'bg-[#131316] hover:bg-[#1a1a1f] border-[#222227] text-[#f4f4f6]'
                }`}
                title={theme.isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                aria-label="Toggle Light/Dark Theme"
              >
                {theme.isLight ? (
                  <Moon className="w-4 h-4" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-500" />
                )}
              </button>
            )}

            <button
              onClick={onOpenSettings}
              className={`p-2 sm:p-2.5 rounded-xl border tactile-btn transition hidden sm:block ${
                theme.isLight
                  ? 'bg-[#dedad0] hover:bg-[#d5d0c5] border-[#cfcac0] text-[#121214]'
                  : 'bg-[#131316] hover:bg-[#1a1a1f] border-[#222227] text-[#f4f4f6]'
              }`}
              title="Configuration"
              aria-label="Configuration Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Mobile Overflow Menu: Controls / Theme / Configuration */}
            <div className="relative sm:hidden" ref={actionsMenuRef}>
              <button
                onClick={() => setActionsMenuOpen((o) => !o)}
                className={`p-2 rounded-xl border tactile-btn transition ${
                  theme.isLight
                    ? 'bg-[#dedad0] hover:bg-[#d5d0c5] border-[#cfcac0] text-[#121214]'
                    : 'bg-[#131316] hover:bg-[#1a1a1f] border-[#222227] text-[#f4f4f6]'
                }`}
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
                  className={`absolute right-0 top-[calc(100%+10px)] w-56 rounded-2xl border shadow-xl hardware-panel p-1.5 ${
                    theme.isLight
                      ? 'border-[#cfcac0] bg-[#eae6dd] text-[#121214]'
                      : 'border-[#222227] bg-[#131316] text-[#f4f4f6]'
                  }`}
                >
                  {onOpenControls && (
                    <button
                      role="menuitem"
                      onClick={() => { setActionsMenuOpen(false); onOpenControls(); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition text-left ${
                        theme.isLight ? 'text-[#121214] hover:bg-[#dedad0]' : 'text-[#f4f4f6] hover:bg-[#1c1c22]'
                      }`}
                    >
                      <Gamepad2 className="w-4 h-4" />
                      <span className="flex-1">Controls</span>
                    </button>
                  )}

                  {onToggleLightDark && (
                    <button
                      role="menuitem"
                      onClick={() => { setActionsMenuOpen(false); onToggleLightDark(); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition text-left ${
                        theme.isLight ? 'text-[#121214] hover:bg-[#dedad0]' : 'text-[#f4f4f6] hover:bg-[#1c1c22]'
                      }`}
                    >
                      {theme.isLight ? (
                        <Moon className="w-4 h-4" />
                      ) : (
                        <Sun className="w-4 h-4 text-amber-500" />
                      )}
                      <span className="flex-1">{theme.isLight ? 'Dark Mode' : 'Light Mode'}</span>
                    </button>
                  )}

                  <button
                    role="menuitem"
                    onClick={() => { setActionsMenuOpen(false); onOpenSettings(); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition text-left ${
                      theme.isLight ? 'text-[#121214] hover:bg-[#dedad0]' : 'text-[#f4f4f6] hover:bg-[#1c1c22]'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
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
          <div className={`relative rounded-3xl overflow-hidden border p-4 sm:p-6 hardware-panel ${
            theme.isLight
              ? 'bg-[#dedad0] border-[#cfcac0]'
              : 'bg-[#131316] border-[#222227]'
          }`}>
            {/* Molded Cartridge Slot Top Grip Rib */}
            <div className={`h-4 w-full rounded-xl border-b mb-4 flex items-center justify-between px-3 ${
              theme.isLight ? 'bg-[#cfcac0]/60 border-[#bfbaa8]' : 'bg-[#0a0a0c] border-[#222227]'
            }`}>
              <div className="w-24 h-full cartridge-grip opacity-40" />
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 hardware-led" />
                <span className={`text-[11px] font-semibold tracking-normal ${
                  theme.isLight ? 'text-[#575654]' : 'text-[#8e8e93]'
                }`}>
                  Slot-1 Cartridge Deck
                </span>
              </div>
            </div>

            <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
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
                  className={`relative w-20 h-24 sm:w-24 sm:h-28 rounded-2xl overflow-hidden shrink-0 border p-1 flex flex-col cursor-pointer cartridge-card ${
                    theme.isLight
                      ? 'bg-[#eae6dd] border-[#cfcac0]'
                      : 'bg-[#18181c] border-[#26262c]'
                  }`}
                >
                  <div className={`h-2.5 w-full rounded-t-lg mb-1 flex items-center justify-center ${
                    theme.isLight ? 'bg-[#dedad0]' : 'bg-[#0a0a0c]'
                  }`}>
                    <div className="w-10 h-full cartridge-grip opacity-50" />
                  </div>
                  <div className="flex-1 rounded-lg overflow-hidden bg-black relative">
                    <GameCoverImage game={featuredGame} imgClassName="w-full h-full object-cover" />
                  </div>
                </div>

                <div className="space-y-1.5 min-w-0 flex-1">
                  <h1 className={`text-lg sm:text-2xl font-bold tracking-tight truncate ${
                    theme.isLight ? 'text-[#121214]' : 'text-[#f4f4f6]'
                  }`}>
                    {formatGameTitle(featuredGame.title)}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                      theme.isLight
                        ? 'bg-[#e5e1d7] text-[#575654] border-[#cfcac0]'
                        : 'bg-[#1c1c21] text-[#8e8e93] border-[#2c2c34]'
                    }`}>
                      {featuredGame.system || featuredGame.shortSystem}
                    </span>
                    {games.length > 1 && (
                      <button
                        onClick={handleShuffleFeatured}
                        className={`p-1 rounded-md border transition active:scale-95 ${
                          theme.isLight
                            ? 'bg-[#e5e1d7] hover:bg-[#dedad0] text-[#575654] border-[#cfcac0]'
                            : 'bg-[#1c1c21] hover:bg-[#25252c] text-[#8e8e93] hover:text-[#f4f4f6] border-[#2c2c34]'
                        }`}
                        title="Cycle Next Cartridge in Deck"
                        aria-label="Cycle next cartridge in deck"
                      >
                        <Shuffle className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Tactile Deck Controls */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                <button
                  onClick={() => onSelectGame(featuredGame)}
                  className={`px-3.5 py-2.5 rounded-xl border text-xs font-semibold tactile-btn transition ${
                    theme.isLight
                      ? 'bg-[#e5e1d7] hover:bg-[#dedad0] text-[#121214] border-[#cfcac0]'
                      : 'bg-[#18181c] hover:bg-[#222227] text-[#f4f4f6] border-[#222227]'
                  }`}
                >
                  Save Slots
                </button>
                <button
                  onClick={() => onLaunchGame(featuredGame)}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs tactile-btn transition shadow-sm ${theme.accentBg}`}
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
                <h2 className={`text-xs sm:text-sm font-bold tracking-tight ${theme.isLight ? 'text-[#121214]' : 'text-[#f4f4f6]'}`}>
                  Recently Played
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-tabular border ${
                  theme.isLight ? 'bg-[#dedad0] border-[#cfcac0] text-[#575654]' : 'bg-[#18181c] border-[#222227] text-[#8e8e93]'
                }`}>
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
                  className={`group relative flex items-center gap-2.5 p-2 rounded-2xl border transition active:scale-[0.98] cursor-pointer h-14 sm:h-16 overflow-hidden hardware-panel select-none ${
                    theme.isLight
                      ? 'bg-[#f3efe8] hover:bg-[#eae6dd] border-[#d2cdc3] hover:border-[#b8b2a6]'
                      : 'bg-[#131316] hover:bg-[#18181c] border-[#222227] hover:border-[#34343d]'
                  }`}
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
                  <div className={`relative w-10 h-10 sm:w-11 sm:h-12 rounded-lg overflow-hidden shrink-0 border ${
                    theme.isLight ? 'bg-[#dedad0] border-[#cfcac0]' : 'bg-black border-[#222227]'
                  }`}>
                    <GameCoverImage
                      game={game}
                      imgClassName="w-full h-full object-cover group-hover:scale-105 transition duration-150"
                    />
                  </div>

                  {/* Name and System beside it */}
                  <div className="flex-1 min-w-0 pr-1 space-y-0.5">
                    <h3 className={`text-xs font-bold truncate transition ${
                      theme.isLight ? 'text-[#121214] group-hover:text-black' : 'text-[#f4f4f6] group-hover:text-white'
                    }`}>
                      {formatGameTitle(game.title)}
                    </h3>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${
                        theme.isLight ? 'bg-[#dedad0] text-[#575654] border-[#cfcac0]' : 'bg-[#1c1c21] text-[#8e8e93] border-[#2c2c34]'
                      }`}>
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
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border opacity-80 group-hover:opacity-100 transition active:scale-90 ${
                      theme.isLight
                        ? 'bg-[#dedad0] hover:bg-white text-[#121214] border-[#cfcac0]'
                        : 'bg-[#1c1c21] hover:bg-white text-[#f4f4f6] hover:text-black border-[#2c2c34]'
                    }`}
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
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <HardDrive className={`w-4 h-4 ${theme.accentText}`} />
              <h2 className={`text-sm sm:text-base font-extrabold tracking-tight ${theme.isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
                Cartridge Binder
              </h2>
            </div>

            {/* Search Toggle (far right) */}
            <button
              onClick={() => {
                if (showSearch) {
                  setShowSearch(false);
                  setSearchQuery('');
                } else {
                  setShowSearch(true);
                }
              }}
              className={`px-2 py-1.5 rounded-xl border tactile-btn transition ${
                theme.isLight
                  ? 'bg-[#dedad0] hover:bg-[#d5d0c5] border-[#cfcac0] text-[#121214]'
                  : 'bg-[#131316] hover:bg-[#1a1a1f] border-[#222227] text-[#f4f4f6]'
              }`}
              title={showSearch ? 'Close Search' : 'Search Library'}
              aria-label={showSearch ? 'Close Library Search' : 'Open Library Search'}
              aria-pressed={showSearch}
            >
              {showSearch ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
            </button>
          </div>

          {/* ROM Count + Search Field + System Divider Tabs (below) */}
          <div className="flex flex-wrap items-center gap-1.5">
            {showSearch && (
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' || e.key === 'Enter') {
                    if (e.key === 'Escape') {
                      setShowSearch(false);
                      setSearchQuery('');
                    }
                  }
                }}
                placeholder="Search library…"
                autoFocus
                aria-label="Search library by title"
                className={`flex-1 min-w-[150px] px-3 py-1 rounded-xl border text-xs font-semibold outline-none transition ${
                  theme.isLight
                    ? 'bg-white border-[#cfcac0] text-[#121214] placeholder:text-[#8a8780] focus:border-[#8d1d5c]'
                    : 'bg-[#131316] border-[#222227] text-[#f4f4f6] placeholder:text-[#71717a] focus:border-[#10b981]'
                }`}
              />
            )}
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-tabular border ${
              theme.isLight
                ? 'bg-[#dedad0] border-[#cfcac0] text-[#575654]'
                : 'bg-[#18181c] border-[#222227] text-[#8e8e93]'
            }`}>
              {filteredGames.length} {filteredGames.length === 1 ? 'ROM' : 'ROMs'}
            </span>

            {/* Binder System Divider Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar ml-auto">
              {['ALL', ...new Set(games.map((g) => g.shortSystem))].filter(Boolean).map((sys) => (
                <button
                  key={sys}
                  onClick={() => setSystemFilter(sys)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold tactile-btn transition ${
                    systemFilter === sys
                      ? theme.accentBg
                      : theme.isLight
                      ? 'bg-[#dedad0] text-[#121214] hover:bg-[#d5d0c5] border border-[#cfcac0]'
                      : 'bg-[#18181c] text-[#8e8e93] hover:text-[#f4f4f6] border border-[#222227]'
                  }`}
                >
                  {sys}
                </button>
              ))}
            </div>
          </div>

          <div className={`rounded-3xl border p-3.5 sm:p-5 binder-page ${
            theme.isLight ? 'bg-[#dedad0]/30 border-[#cfcac0]' : 'bg-[#0e0e11] border-[#222227]'
          }`}>
            {filteredGames.length === 0 && games.length === 0 ? (
              <div className="py-16 px-4 flex flex-col items-center justify-center text-center space-y-5 max-w-md mx-auto">
                <div className={`w-16 h-16 rounded-3xl border flex items-center justify-center ${
                  theme.isLight ? 'bg-[#eae6dd] border-[#cfcac0]' : 'bg-[#131316] border-[#222227]'
                }`}>
                  <Gamepad2 className={`w-8 h-8 ${theme.isLight ? 'text-[#575654]' : 'text-[#8e8e93]'}`} />
                </div>
                <div className="space-y-1.5">
                  <h3 className={`text-lg font-bold ${theme.isLight ? 'text-[#121214]' : 'text-[#f4f4f6]'}`}>Your Cartridge Shelf is Empty</h3>
                  <p className={`text-xs leading-relaxed ${theme.isLight ? 'text-[#575654]' : 'text-[#8e8e93]'}`}>
                    Insert your personal game backup files (<span className={`font-mono ${theme.isLight ? 'text-[#121214]' : 'text-[#f4f4f6]'}`}>.gb, .gbc, .gba, .zip</span>) to play instantly in browser with CRT shaders and battery saves.
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
                      className={`w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border text-xs font-bold transition tactile-btn ${
                        theme.isLight
                          ? 'bg-stone-200 hover:bg-stone-300 text-stone-800 border-stone-300'
                          : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
                      }`}
                    >
                      <Gamepad2 className="w-4 h-4 text-sky-500" />
                      <span>View Keybindings</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                {filteredGames.map((game) => (
                  <div key={game.id} className={`p-1.5 rounded-2xl border binder-slot ${
                    theme.isLight ? 'bg-stone-200/70 border-stone-300' : 'bg-black/40 border-zinc-800/70'
                  }`}>
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
                  className={`rounded-2xl border-2 border-dashed p-4 flex flex-col items-center justify-center gap-2 min-h-[210px] transition group tactile-btn binder-slot ${
                    theme.isLight
                      ? 'border-stone-300 hover:border-emerald-500 bg-stone-200/50 hover:bg-stone-200'
                      : 'border-zinc-800 hover:border-emerald-500/60 bg-black/40 hover:bg-zinc-900/80'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center transition ${
                    theme.isLight
                      ? 'bg-stone-300 group-hover:bg-emerald-500/20 border-stone-400'
                      : 'bg-zinc-900 group-hover:bg-emerald-500/20 border-zinc-800'
                  }`}>
                    <Plus className={`w-6 h-6 group-hover:text-emerald-500 ${theme.isLight ? 'text-stone-600' : 'text-zinc-400'}`} />
                  </div>
                  <span className={`text-xs font-bold ${theme.isLight ? 'text-zinc-900' : 'text-zinc-200'}`}>Insert New Cartridge</span>
                  <span className={`text-[10px] text-center leading-tight ${theme.isLight ? 'text-stone-600' : 'text-zinc-400'}`}>
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
