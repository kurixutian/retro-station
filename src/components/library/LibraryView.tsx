import React from 'react';
import {
  Gamepad2,
  HardDrive,
  Plus,
  Settings,
  Play,
  Cloud,
  History,
  Coffee,
  Sun,
  Moon,
  MoreVertical,
  Search,
  X,
} from 'lucide-react';
import { haptics } from '../../services/haptics';
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

const AmbientBackdropTile: React.FC<{ game: Game }> = ({ game }) => {
  return (
    <div className="w-full h-full overflow-hidden relative">
      <GameCoverImage
        game={game}
        className="w-full h-full border-0 !bg-transparent"
        imgClassName=""
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
  // ── Featured Game Hero Carousel ──────────────────────────────────────────
  const [featuredIndex, setFeaturedIndex] = React.useState<number>(() => {
    return games.length > 0 ? Math.floor(Math.random() * games.length) : 0;
  });
  const [deckHovered, setDeckHovered] = React.useState(false);
  const [deckDragging, setDeckDragging] = React.useState(false);
  const [tabVisible, setTabVisible] = React.useState(() => !document.hidden);

  // Keep the carousel index valid as the library grows/shrinks
  React.useEffect(() => {
    if (games.length > 0) {
      setFeaturedIndex((prev) => prev % games.length);
    }
  }, [games.length]);

  React.useEffect(() => {
    const onVisibility = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const featuredGame = games[featuredIndex] || games[0] || null;

  const cycleFeatured = React.useCallback((step: number) => {
    if (games.length === 0) return;
    setFeaturedIndex((prev) => (prev + step + games.length) % games.length);
  }, [games.length]);

  // Auto-advance the hero carousel. Pauses on hover, drag, hidden tab, and
  // prefers-reduced-motion; re-creating the interval on featuredIndex change
  // also resets the timer after every manual navigation.
  React.useEffect(() => {
    if (games.length <= 1 || deckHovered || deckDragging || !tabVisible) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setInterval(() => cycleFeatured(1), 6000);
    return () => window.clearInterval(t);
  }, [featuredIndex, deckHovered, deckDragging, tabVisible, games.length, cycleFeatured]);

  // ── Hero Card Swipe (horizontal drag cycles featured game) ───────────────
  // touch-action: pan-y keeps vertical page scroll native (pointercancel
  // ends the gesture); only horizontal intent gets captured.
  const [featuredDrag, setFeaturedDrag] = React.useState(0);
  const dragRef = React.useRef<{ x: number; y: number; horizontal: boolean; dx: number } | null>(null);

  const endDeckDrag = (commit: boolean) => {
    const start = dragRef.current;
    dragRef.current = null;
    setDeckDragging(false);
    setFeaturedDrag(0);
    if (commit && start && games.length > 1 && Math.abs(start.dx) > 60) {
      haptics.selection();
      cycleFeatured(start.dx < 0 ? 1 : -1);
    }
  };

  const onDeckPointerDown = (e: React.PointerEvent) => {
    if (games.length <= 1) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Don't hijack taps on controls (dots, play) — capture breaks their click.
    if ((e.target as HTMLElement).closest('button, a')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, horizontal: false, dx: 0 };
  };

  const onDeckPointerMove = (e: React.PointerEvent) => {
    const start = dragRef.current;
    if (!start || games.length <= 1) return;
    const dx = e.clientX - start.x;
    if (!start.horizontal) {
      if (Math.abs(dx) < 10 && Math.abs(e.clientY - start.y) < 10) return;
      if (Math.abs(dx) <= Math.abs(e.clientY - start.y)) {
        dragRef.current = null;
        return;
      }
      start.horizontal = true;
      setDeckDragging(true);
    }
    start.dx = dx;
    setFeaturedDrag(Math.max(-48, Math.min(48, dx * 0.55)));
  };

  // ── Recently Played Games ──────────────────────────────────────────────
  const recentGames = React.useMemo(() => {
    if (!recentGameIds || recentGameIds.length === 0) return [];
    return recentGameIds
      .map((id) => games.find((g) => g.id === id))
      .filter((g): g is Game => Boolean(g));
  }, [recentGameIds, games]);

  // ── Blurred Background of Installed ROMs (GPU-capped 4 tiles) ──
  // Pool is shuffled once per library change; rotating by featuredIndex makes
  // the backdrop drift gently as the hero carousel cycles instead of flashing.
  const shuffledPool = React.useMemo(() => {
    return [...games].sort(() => 0.5 - Math.random());
  }, [games]);

  const bgGames = React.useMemo(() => {
    if (games.length === 0 || !featuredGame) return [];
    const rest = shuffledPool.filter((g) => g.id !== featuredGame.id);
    const selected: Game[] = [featuredGame];
    if (rest.length > 0) {
      for (let i = 0; i < 3; i++) {
        selected.push(rest[(featuredIndex + i) % rest.length]);
      }
    }
    return selected;
  }, [featuredGame, featuredIndex, shuffledPool]);

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
      {/* Ambient Animated Blurred ROM Backdrop (Homescreen Only) */}
      <div className={`fixed inset-0 pointer-events-none overflow-hidden z-0 select-none ${theme.isLight ? 'bg-[#eae6dd]' : 'bg-[#0a0a0c]'}`}>
        {bgGames.length > 0 && (
          <div className="grid grid-cols-2 grid-rows-2 w-full h-full opacity-25 sm:opacity-35 blur-xl ambient-backdrop-pan scale-115">
            {bgGames.map((g, idx) => (
              <AmbientBackdropTile key={`bg-tile-${g.id}-${idx}`} game={g} />
            ))}
          </div>
        )}
        <div
          className="absolute inset-0"
          style={{
            background: theme.isLight
              ? `radial-gradient(ellipse at 50% 30%, rgba(234,230,221,0.35) 0%, rgba(234,230,221,0.80) 65%, rgba(234,230,221,0.98) 100%)`
              : `radial-gradient(ellipse at 50% 30%, rgba(10,10,12,0.25) 0%, rgba(10,10,12,0.72) 65%, rgba(10,10,12,0.95) 100%)`
          }}
        />
      </div>
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
        {/* Slot-1 Active Cartridge Deck Bay — full-bleed boxart hero card */}
        {featuredGame && (
          <div
            className={`relative rounded-3xl overflow-hidden border hardware-panel select-none ${
              games.length > 1 ? 'cursor-grab' : ''
            } ${deckDragging ? 'cursor-grabbing' : ''} ${
              theme.isLight ? 'border-[#cfcac0]' : 'border-[#222227]'
            }`}
            style={{ touchAction: 'pan-y' }}
            onMouseEnter={() => setDeckHovered(true)}
            onMouseLeave={() => setDeckHovered(false)}
            onPointerDown={onDeckPointerDown}
            onPointerMove={onDeckPointerMove}
            onPointerUp={() => endDeckDrag(true)}
            onPointerCancel={() => endDeckDrag(false)}
            aria-label={games.length > 1 ? `Featured game carousel, game ${featuredIndex + 1} of ${games.length}. Swipe to change.` : 'Featured game'}
          >
            {/* Boxart Background (keyed per game for the swap crossfade) */}
            <div
              className="transition-transform"
              style={{
                transform: `translate3d(${featuredDrag}px, 0, 0)`,
                transition: featuredDrag ? 'none' : 'transform 0.32s var(--ease-out)',
              }}
            >
              <div className="relative min-h-[9rem] sm:min-h-[10rem]">
                <div key={`featured-art-${featuredGame.id}`} className="absolute inset-0 featured-swap">
                  <GameCoverImage
                    game={featuredGame}
                    className="w-full h-full"
                    imgClassName="hero-art-pan"
                  />
                </div>

                {/* Readability scrim — content is always light-on-dark over art */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(to top, rgba(10,10,12,0.88) 0%, rgba(10,10,12,0.45) 40%, rgba(10,10,12,0.18) 75%, rgba(10,10,12,0.42) 100%)',
                  }}
                />

                {/* Featured game title + system badge + play */}
                <div className="relative z-10 flex items-start justify-between gap-4 p-4 sm:p-6 pt-8 sm:pt-10 pb-11">
                  <div key={`featured-copy-${featuredGame.id}`} className="min-w-0 flex-1 featured-swap">
                    <h1 className="text-lg sm:text-2xl font-bold tracking-tight truncate text-white drop-shadow-sm">
                      {formatGameTitle(featuredGame.title)}
                    </h1>
                    <span className="mt-1.5 inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-black/45 text-white/85 border-white/15">
                      {featuredGame.system || featuredGame.shortSystem}
                    </span>
                  </div>
                  <button
                    onClick={() => onLaunchGame(featuredGame)}
                    className={`shrink-0 p-3 rounded-xl tactile-btn transition shadow-sm active:scale-95 ${theme.accentBg}`}
                    title={`Play ${formatGameTitle(featuredGame.title)}`}
                    aria-label={`Play ${formatGameTitle(featuredGame.title)}`}
                  >
                    <Play className="w-5 h-5 fill-current" />
                  </button>
                </div>

                {/* Carousel position indicator */}
                {games.length > 1 && (
                  <div className="absolute bottom-3 inset-x-0 z-10 flex items-center justify-center gap-1.5" role="group" aria-label="Featured game carousel position">
                    {games.length <= 8 ? (
                      games.map((g, i) => (
                        <button
                          key={`featured-dot-${g.id}`}
                          onClick={() => setFeaturedIndex(i)}
                          className={`rounded-full transition-all active:scale-90 ${
                            i === featuredIndex ? 'w-3 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/50'
                          }`}
                          title={`Featured: ${formatGameTitle(g.title)}`}
                          aria-label={`Featured: ${formatGameTitle(g.title)}`}
                          aria-current={i === featuredIndex ? 'true' : undefined}
                        />
                      ))
                    ) : (
                      <span
                        className="px-1.5 py-0.5 rounded-md text-[10px] font-tabular border bg-black/45 text-white/85 border-white/20"
                        aria-label={`${featuredIndex + 1} of ${games.length}`}
                      >
                        {featuredIndex + 1} / {games.length}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Molded Cartridge Slot Top Grip Rib (static overlay above swiping art) */}
            <div className="absolute inset-x-0 top-0 z-20 h-5 sm:h-6 flex items-center justify-between px-3 pointer-events-none bg-black/40 border-b border-white/10 rounded-t-[inherit]">
              <div className="w-24 h-full cartridge-grip opacity-40" />
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 hardware-led" />
                <span className="text-[11px] font-semibold tracking-normal text-white/60">Slot-1 Cartridge Deck</span>
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
                      imgClassName="group-hover:scale-105 transition duration-150"
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
