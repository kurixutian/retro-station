import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Gamepad2,
  HardDrive,
  Plus,
  Settings,
  Play,
  Cloud,
  History,
  Sun,
  Moon,
  MoreVertical,
  Search,
  X,
  Grid2X2,
  Grid3X3,
  List,
  Wand2,
  Star,
  ArrowUpDown,
} from 'lucide-react';
import { haptics } from '../../services/haptics';
import { Game, Theme } from '../../types';
import { getGameDisplayTitle, getBoxartUrls } from '../../constants/cores';
import { idbGet } from '../../services/storage/idb';
import { GameCoverImage } from '../common/GameCoverImage';
import { GameCard } from './GameCard';
import appIcon from '../../assets/icon.png';

interface LibraryViewProps {
  games: Game[];
  theme: Theme;
  showSearch: boolean;
  setShowSearch: (s: boolean) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  systemFilter: string;
  setSystemFilter: (s: string) => void;
  onSelectGame: (game: Game) => void;
  onLaunchGame: (game: Game) => void;
  onOpenSettings: () => void;
  onTriggerAddRom: () => void;
  onOpenPatcher?: () => void;
  onOpenCloudSync: () => void;
  cloudStatus?: 'unlinked' | 'idle' | 'syncing' | 'needs_reauth' | 'offline' | 'error';
  onOpenControls?: () => void;
  recentGameIds?: string[];
  onToggleLightDark?: () => void;
  onRenameGame?: (gameId: string, newTitle: string) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  games,
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
  onOpenPatcher,
  onOpenCloudSync,
  cloudStatus,
  onOpenControls,
  recentGameIds,
  onToggleLightDark,
}) => {
  // ── Debounced Search (local state, synced to parent after delay) ───────────
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Sync from parent when it changes externally
    setDebouncedSearchQuery(searchQuery);
  }, [searchQuery]);

  const handleSearchChange = useCallback((q: string) => {
    setDebouncedSearchQuery(q);
    // Debounce parent sync
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setSearchQuery(q);
    }, 180);
  }, [setSearchQuery]);

  type BinderSortMode = 'default' | 'title' | 'recent' | 'system';
  const [binderSort, setBinderSort] = React.useState<BinderSortMode>(() => {
    try {
      const saved = localStorage.getItem('retro_binder_sort');
      if (saved === 'default' || saved === 'title' || saved === 'recent' || saved === 'system') return saved;
    } catch {}
    return 'default';
  });

  const switchBinderSort = (mode: BinderSortMode) => {
    setBinderSort(mode);
    try {
      localStorage.setItem('retro_binder_sort', mode);
    } catch {}
  };

  const [favoriteIds, setFavoriteIds] = React.useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('retro_favorite_games');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  });

  const favoriteSet = React.useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const toggleFavorite = React.useCallback((gameId: string) => {
    haptics.selection();
    setFavoriteIds((prev) => {
      const next = prev.includes(gameId) ? prev.filter((id) => id !== gameId) : [...prev, gameId];
      try {
        localStorage.setItem('retro_favorite_games', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  React.useEffect(() => {
    if (systemFilter === 'FAV' && favoriteIds.length === 0) {
      setSystemFilter('ALL');
    }
  }, [systemFilter, favoriteIds.length, setSystemFilter]);

  // Memoized filtered & sorted games (computed locally from debounced query)
  const filteredGames = useMemo(() => {
    const base = games.filter((g) => {
      if (systemFilter === 'FAV') {
        if (!favoriteSet.has(g.id)) return false;
      } else if (systemFilter !== 'ALL' && g.shortSystem !== systemFilter) {
        return false;
      }
      const q = debouncedSearchQuery.trim().toLowerCase();
      if (
        q &&
        !g.title.toLowerCase().includes(q) &&
        !(g.customTitle && g.customTitle.toLowerCase().includes(q)) &&
        !g.system.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    if (binderSort === 'default') return base;
    const recentOrder = new Map((recentGameIds || []).map((id, idx) => [id, idx]));
    return [...base].sort((a, b) => {
      if (binderSort === 'title') {
        return getGameDisplayTitle(a).localeCompare(getGameDisplayTitle(b));
      }
      if (binderSort === 'system') {
        const sysCmp = (a.shortSystem || '').localeCompare(b.shortSystem || '');
        return sysCmp !== 0 ? sysCmp : getGameDisplayTitle(a).localeCompare(getGameDisplayTitle(b));
      }
      // 'recent'
      const ra = recentOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const rb = recentOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return ra - rb;
    });
  }, [games, systemFilter, debouncedSearchQuery, favoriteSet, binderSort, recentGameIds]);

  // ── Featured Game Hero Carousel (native CSS scroll-snap) ─────────────────
  const [featuredIndex, setFeaturedIndex] = React.useState<number>(() => {
    return games.length > 0 ? Math.floor(Math.random() * games.length) : 0;
  });
  const [deckHovered, setDeckHovered] = React.useState(false);
  const [deckDragging, setDeckDragging] = React.useState(false);
  const [tabVisible, setTabVisible] = React.useState(() => !document.hidden);
  const carouselRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (games.length > 0) {
      setFeaturedIndex((prev) => prev % games.length);
    }
  }, [games.length]);

  React.useEffect(() => {
    const onVisibility = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const featuredGame = games[featuredIndex] || games[0] || null;

  const scrollToFeatured = React.useCallback((index: number, smooth = true) => {
    const el = carouselRef.current;
    if (!el || games.length === 0) return;
    const targetIdx = ((index % games.length) + games.length) % games.length;
    setFeaturedIndex(targetIdx);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({
      left: targetIdx * el.clientWidth,
      behavior: smooth && !reduced ? 'smooth' : 'auto',
    });
  }, [games.length]);

  // Keep scroll position aligned on initial mount or window resize
  React.useEffect(() => {
    const el = carouselRef.current;
    if (!el || games.length <= 1) return;
    el.scrollLeft = featuredIndex * el.clientWidth;
  }, [games.length]);

  // Auto-advance the hero carousel. Pauses on hover, touch/drag, hidden tab,
  // and prefers-reduced-motion.
  React.useEffect(() => {
    if (games.length <= 1 || deckHovered || deckDragging || !tabVisible) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setInterval(() => scrollToFeatured(featuredIndex + 1), 6000);
    return () => window.clearInterval(t);
  }, [featuredIndex, deckHovered, deckDragging, tabVisible, games.length, scrollToFeatured]);

  const handleCarouselScroll = React.useCallback(() => {
    const el = carouselRef.current;
    if (!el || !el.clientWidth || games.length <= 1) return;
    const idx = Math.max(0, Math.min(games.length - 1, Math.round(el.scrollLeft / el.clientWidth)));
    setFeaturedIndex((prev) => (prev === idx ? prev : idx));
  }, [games.length]);

  type BinderViewMode = 'grid-2' | 'grid-3' | 'list';
  const [binderView, setBinderView] = React.useState<BinderViewMode>(() => {
    try {
      const saved = localStorage.getItem('retro_binder_view');
      if (saved === 'grid-2' || saved === 'grid-3' || saved === 'list') return saved;
    } catch {}
    return 'grid-2';
  });

  const switchBinderView = (mode: BinderViewMode) => {
    setBinderView(mode);
    try {
      localStorage.setItem('retro_binder_view', mode);
    } catch {}
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
    <div className={`relative pb-16 min-h-[100vh] min-h-[100lvh] ${theme.isLight ? 'bg-[#eae6dd] text-zinc-900' : 'bg-[#0a0a0c] text-zinc-100'}`}>
      {/* Sticky Top Navigation Bar */}
      <header
        className={`sticky top-0 z-30 backdrop-blur-md border-b px-4 sm:px-6 py-2.5 ${
          theme.isLight
            ? 'bg-[#dedad0]/95 border-[#cfcac0] text-[#121214]'
            : 'bg-[#0a0a0c]/95 border-[#222227] text-[#f4f4f6]'
        }`}
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 10px)' }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Brand Logo */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center border ${theme.accentSoft} shrink-0 ${theme.isLight ? 'bg-white' : 'bg-zinc-900'}`}>
              <img src={appIcon} alt="Retro Station Logo" className="w-full h-full object-cover" />
            </div>
            <div className="flex items-center gap-1 font-display truncate">
              <span className={`font-bold tracking-tight text-base ${theme.isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>RETRO</span>
              <span className={`font-bold tracking-tight text-base ${theme.accentText}`}>STATION</span>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onOpenCloudSync}
              className={`px-2.5 py-2 rounded-xl border tactile-btn transition flex items-center gap-1.5 ${
                theme.isLight
                  ? 'bg-[#dedad0] hover:bg-[#d5d0c5] border-[#cfcac0] text-[#121214]'
                  : 'bg-[#131316] hover:bg-[#1a1a1f] border-[#222227] text-[#f4f4f6]'
              }`}
              title="Cloud Save Vault"
              aria-label="Cloud Save Vault"
            >
              <Cloud className="w-4 h-4" />
              <span className="hidden md:inline text-xs font-semibold">Cloud</span>
              {cloudStatus === 'idle' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" aria-hidden="true" />
              )}
            </button>

            <button
              onClick={onTriggerAddRom}
              className={`px-2.5 sm:px-3 py-2 rounded-xl font-bold tactile-btn transition flex items-center gap-1.5 ${theme.accentBg}`}
              title="Load ROM"
              aria-label="Load ROM"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden sm:inline text-xs">Load ROM</span>
            </button>

            <button
              onClick={onOpenSettings}
              className={`px-2.5 py-2 rounded-xl border tactile-btn transition hidden sm:flex items-center gap-1.5 ${
                theme.isLight
                  ? 'bg-[#dedad0] hover:bg-[#d5d0c5] border-[#cfcac0] text-[#121214]'
                  : 'bg-[#131316] hover:bg-[#1a1a1f] border-[#222227] text-[#f4f4f6]'
              }`}
              title="Configuration"
              aria-label="Configuration Settings"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden md:inline text-xs font-semibold">Config</span>
            </button>

            {/* Overflow Menu: Patcher / Controls / Theme / Configuration */}
            <div className="relative" ref={actionsMenuRef}>
              <button
                onClick={() => setActionsMenuOpen((o) => !o)}
                className={`p-2 rounded-xl border tactile-btn transition ${
                  theme.isLight
                    ? 'bg-[#dedad0] hover:bg-[#d5d0c5] border-[#cfcac0] text-[#121214]'
                    : 'bg-[#131316] hover:bg-[#1a1a1f] border-[#222227] text-[#f4f4f6]'
                }`}
                title="More tools & settings"
                aria-label="More tools and settings"
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
                  {onOpenPatcher && (
                    <button
                      role="menuitem"
                      onClick={() => { setActionsMenuOpen(false); onOpenPatcher(); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition text-left ${
                        theme.isLight ? 'text-[#121214] hover:bg-[#dedad0]' : 'text-[#f4f4f6] hover:bg-[#1c1c22]'
                      }`}
                    >
                      <Wand2 className="w-4 h-4" />
                      <span className="flex-1">ROM Patcher</span>
                    </button>
                  )}

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
                    className={`sm:hidden w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition text-left ${
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
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-4 space-y-6">
        {/* Featured Cartridge Deck (Tailwind CSS native scroll-snap carousel) */}
        {featuredGame && (
          <div
            className={`relative rounded-2xl overflow-hidden border crt-bezel select-none hero-deck-card ${
              theme.isLight ? 'border-[#cfcac0] bg-[#dedad0]' : 'border-[#27272e] bg-[#0e0e11]'
            }`}
            onMouseEnter={() => setDeckHovered(true)}
            onMouseLeave={() => setDeckHovered(false)}
            onTouchStart={() => setDeckDragging(true)}
            onTouchEnd={() => setDeckDragging(false)}
            onTouchCancel={() => setDeckDragging(false)}
            aria-label={games.length > 1 ? `Featured game carousel, game ${featuredIndex + 1} of ${games.length}. Swipe to change.` : 'Featured game'}
          >
            <div
              ref={carouselRef}
              onScroll={handleCarouselScroll}
              className="flex w-full overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar"
            >
              {games.map((slideGame) => (
                <div
                  key={`hero-slide-${slideGame.id}`}
                  className="w-full shrink-0 snap-center relative min-h-[11.5rem] sm:min-h-[14rem] flex flex-col justify-end"
                >
                  <div className="absolute inset-0">
                    <GameCoverImage
                      game={slideGame}
                      className="w-full h-full"
                      imgClassName="hero-art-pan"
                    />
                  </div>

                  {/* Subtle CRT micro-scanlines + readability scrim */}
                  <div className="absolute inset-0 pointer-events-none retro-scanlines opacity-55" />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        'linear-gradient(to top, rgba(10,10,12,0.97) 0%, rgba(10,10,12,0.72) 38%, rgba(10,10,12,0.18) 72%, rgba(10,10,12,0.45) 100%)',
                    }}
                  />

                  {/* Featured game title + system badge + play (anchored at bottom) */}
                  <div className="relative z-10 flex items-end justify-between gap-3 sm:gap-4 p-4 sm:p-6 pt-16 pb-9 sm:pb-10">
                    <div className="min-w-0 flex-1">
                      <span className="mb-1.5 inline-block px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border bg-black/65 text-white/90 border-white/20">
                        {slideGame.system || slideGame.shortSystem}
                      </span>
                      <h1 className="text-xl sm:text-3xl font-bold tracking-tight truncate text-white drop-shadow-md">
                        {getGameDisplayTitle(slideGame)}
                      </h1>
                    </div>
                    <button
                      onClick={() => onLaunchGame(slideGame)}
                      className={`shrink-0 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl tactile-btn transition shadow-lg active:scale-95 flex items-center gap-2 font-bold text-xs sm:text-sm ${theme.accentBg}`}
                      title={`Play ${getGameDisplayTitle(slideGame)}`}
                      aria-label={`Play ${getGameDisplayTitle(slideGame)}`}
                    >
                      <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                      <span className="hidden xs:inline sm:inline">Play</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Carousel position indicator */}
            {games.length > 1 && (
              <div className="absolute bottom-2.5 inset-x-0 z-20 flex items-center justify-center gap-1.5" role="group" aria-label="Featured game carousel position">
                {games.length <= 8 ? (
                  games.map((g, i) => (
                    <button
                      key={`featured-dot-${g.id}`}
                      onClick={() => scrollToFeatured(i)}
                      className="min-w-[28px] min-h-[36px] flex items-center justify-center active:scale-90 transition-transform"
                      title={`Featured: ${getGameDisplayTitle(g)}`}
                      aria-label={`Featured: ${getGameDisplayTitle(g)}`}
                      aria-current={i === featuredIndex ? 'true' : undefined}
                    >
                      <span
                        className={`rounded-full transition-all ${
                          i === featuredIndex ? 'w-3.5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/35 hover:bg-white/60'
                        }`}
                      />
                    </button>
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
        )}

        {/* Recently Played Strip */}
        {recentGames.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <History className={`w-3.5 h-3.5 ${theme.accentText}`} />
              <h2 className={`text-xs font-bold tracking-tight ${theme.isLight ? 'text-[#121214]' : 'text-[#f4f4f6]'}`}>
                Recent
              </h2>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {recentGames.slice(0, 6).map((game) => (
                <div
                  key={`recent-${game.id}`}
                  onClick={() => onSelectGame(game)}
                  className={`group relative flex items-center gap-2 p-1.5 pr-2 rounded-xl border transition active:scale-[0.98] cursor-pointer w-44 sm:w-52 shrink-0 select-none ${
                    theme.isLight
                      ? 'bg-[#f3efe8] hover:bg-[#eae6dd] border-[#d2cdc3]'
                      : 'bg-[#131316] hover:bg-[#18181c] border-[#222227]'
                  }`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${getGameDisplayTitle(game)}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectGame(game);
                    }
                  }}
                >
                  <div className={`relative w-9 h-9 rounded-lg overflow-hidden shrink-0 border ${
                    theme.isLight ? 'bg-[#dedad0] border-[#cfcac0]' : 'bg-black border-[#222227]'
                  }`}>
                    <GameCoverImage game={game} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-xs font-semibold truncate ${
                      theme.isLight ? 'text-[#121214]' : 'text-[#f4f4f6]'
                    }`}>
                      {getGameDisplayTitle(game)}
                    </h3>
                    <span className={`text-[10px] font-mono ${theme.isLight ? 'text-[#575654]' : 'text-[#8e8e93]'}`}>
                      {game.shortSystem || game.system}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onLaunchGame(game);
                    }}
                    className={`relative w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition active:scale-90 before:content-[''] before:absolute before:-inset-1 ${theme.accentBg}`}
                    title={`Play ${getGameDisplayTitle(game)}`}
                    aria-label={`Play ${getGameDisplayTitle(game)}`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CARTRIDGE BINDER & SYSTEM DIVIDER TABS */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <HardDrive className={`w-4 h-4 shrink-0 ${theme.accentText}`} />
              <h2 className={`text-sm sm:text-base font-bold tracking-tight truncate ${theme.isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
                Cartridge Binder
              </h2>
              <span className={`text-xs font-mono ${theme.isLight ? 'text-[#575654]' : 'text-[#8e8e93]'}`}>
                ({filteredGames.length})
              </span>
            </div>

            {/* View Mode Switcher + Search Toggle */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div
                className={`flex items-center p-0.5 rounded-xl border ${
                  theme.isLight ? 'bg-[#dedad0] border-[#cfcac0]' : 'bg-[#131316] border-[#222227]'
                }`}
                role="group"
                aria-label="Cartridge view options"
              >
                <button
                  type="button"
                  onClick={() => switchBinderView('grid-2')}
                  className={`p-1.5 rounded-lg transition active:scale-95 ${
                    binderView === 'grid-2'
                      ? `${theme.accentBg} shadow-sm`
                      : theme.isLight
                      ? 'text-[#575654] hover:text-[#121214]'
                      : 'text-[#8e8e93] hover:text-[#f4f4f6]'
                  }`}
                  title="2 Columns"
                  aria-label="2 Columns per row"
                  aria-pressed={binderView === 'grid-2'}
                >
                  <Grid2X2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => switchBinderView('grid-3')}
                  className={`p-1.5 rounded-lg transition active:scale-95 ${
                    binderView === 'grid-3'
                      ? `${theme.accentBg} shadow-sm`
                      : theme.isLight
                      ? 'text-[#575654] hover:text-[#121214]'
                      : 'text-[#8e8e93] hover:text-[#f4f4f6]'
                  }`}
                  title="3 Columns"
                  aria-label="3 Columns per row"
                  aria-pressed={binderView === 'grid-3'}
                >
                  <Grid3X3 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => switchBinderView('list')}
                  className={`p-1.5 rounded-lg transition active:scale-95 ${
                    binderView === 'list'
                      ? `${theme.accentBg} shadow-sm`
                      : theme.isLight
                      ? 'text-[#575654] hover:text-[#121214]'
                      : 'text-[#8e8e93] hover:text-[#f4f4f6]'
                  }`}
                  title="List View"
                  aria-label="List View (1 Column)"
                  aria-pressed={binderView === 'list'}
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Search Toggle */}
              <button
                onClick={() => {
                  if (showSearch) {
                    setShowSearch(false);
                    setSearchQuery('');
                  } else {
                    setShowSearch(true);
                  }
                }}
                className={`p-2 rounded-xl border tactile-btn transition ${
                  theme.isLight
                    ? 'bg-[#dedad0] hover:bg-[#d5d0c5] border-[#cfcac0] text-[#121214]'
                    : 'bg-[#131316] hover:bg-[#1a1a1f] border-[#222227] text-[#f4f4f6]'
                }`}
                title={showSearch ? 'Close Search' : 'Search Library'}
                aria-label={showSearch ? 'Close Library Search' : 'Open Library Search'}
                aria-pressed={showSearch}
              >
                {showSearch ? <X className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {showSearch && (
            <input
              type="text"
              value={debouncedSearchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setShowSearch(false);
                  handleSearchChange('');
                }
              }}
              placeholder="Search library…"
              autoFocus
              aria-label="Search library by title"
              className={`w-full px-3.5 py-2 rounded-xl border text-xs font-semibold outline-none transition accent-focus ${
                theme.isLight
                  ? 'bg-white border-[#cfcac0] text-[#121214] placeholder:text-[#8a8780]'
                  : 'bg-[#131316] border-[#222227] text-[#f4f4f6] placeholder:text-[#71717a]'
              }`}
            />
          )}

          {/* System Filter Tabs + Compact Sort */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[
                'ALL',
                ...(favoriteIds.length > 0 ? ['FAV'] : []),
                ...new Set(games.map((g) => g.shortSystem)),
              ]
                .filter(Boolean)
                .map((sys) => (
                <button
                  key={sys}
                  onClick={() => setSystemFilter(sys)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold tactile-btn transition flex items-center gap-1 shrink-0 ${
                    systemFilter === sys
                      ? theme.accentBg
                      : theme.isLight
                      ? 'bg-[#dedad0] text-[#121214] hover:bg-[#d5d0c5] border border-[#cfcac0]'
                      : 'bg-[#18181c] text-[#8e8e93] hover:text-[#f4f4f6] border border-[#222227]'
                  }`}
                >
                  {sys === 'FAV' && <Star className="w-3 h-3 fill-current" />}
                  {sys}
                </button>
              ))}
            </div>

            <div className="relative flex items-center shrink-0">
              <ArrowUpDown className={`w-3 h-3 absolute left-2 pointer-events-none ${
                theme.isLight ? 'text-[#575654]' : 'text-[#8e8e93]'
              }`} />
              <select
                aria-label="Sort cartridge binder"
                value={binderSort}
                onChange={(e) => switchBinderSort(e.target.value as BinderSortMode)}
                className={`pl-6 pr-2 py-1 rounded-lg border text-xs font-semibold outline-none cursor-pointer transition ${
                  theme.isLight
                    ? 'bg-[#dedad0] border-[#cfcac0] text-[#121214]'
                    : 'bg-[#131316] border-[#222227] text-[#f4f4f6]'
                }`}
              >
                <option value="default">Default</option>
                <option value="title">A–Z</option>
                <option value="recent">Recent</option>
                <option value="system">System</option>
              </select>
            </div>
          </div>

          <div>
            {filteredGames.length === 0 && games.length === 0 ? (
              <div className="py-16 px-4 flex flex-col items-center justify-center text-center space-y-5 max-w-md mx-auto">
                <div className="space-y-1.5">
                  <h3 className={`flex items-center justify-center gap-2 text-lg font-bold ${theme.isLight ? 'text-[#121214]' : 'text-[#f4f4f6]'}`}>
                    <Gamepad2 className={`w-5 h-5 ${theme.isLight ? 'text-[#575654]' : 'text-[#8e8e93]'}`} />
                    Your Cartridge Shelf is Empty
                  </h3>
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
                  {onOpenPatcher && (
                    <button
                      onClick={onOpenPatcher}
                      className={`w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border text-xs font-bold transition tactile-btn ${
                        theme.isLight
                          ? 'bg-stone-200 hover:bg-stone-300 text-stone-800 border-stone-300'
                          : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
                      }`}
                    >
                      <Wand2 className="w-4 h-4 text-emerald-500" />
                      <span>ROM Patcher</span>
                    </button>
                  )}

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
            ) : binderView === 'list' ? (
              <div className="grid grid-cols-1 gap-2">
                {filteredGames.map((game) => (
                  <div
                    key={`list-${game.id}`}
                    onClick={() => onSelectGame(game)}
                    className={`group relative flex items-center gap-3 p-2.5 rounded-2xl border transition active:scale-[0.98] cursor-pointer h-16 sm:h-18 overflow-hidden hardware-panel select-none ${
                      theme.isLight
                        ? 'bg-[#f3efe8] hover:bg-[#eae6dd] border-[#d2cdc3] hover:border-[#b8b2a6]'
                        : 'bg-[#131316] hover:bg-[#18181c] border-[#222227] hover:border-[#34343d]'
                    }`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${getGameDisplayTitle(game)}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectGame(game);
                      }
                    }}
                  >
                    {/* Cartridge Art Thumbnail */}
                    <div className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden shrink-0 border ${
                      theme.isLight ? 'bg-[#dedad0] border-[#cfcac0]' : 'bg-black border-[#222227]'
                    }`}>
                      <GameCoverImage
                        game={game}
                        imgClassName="group-hover:scale-105 transition duration-150"
                      />
                    </div>

                    {/* Game Title & System Badge */}
                    <div className="flex-1 min-w-0 pr-2 space-y-0.5">
                      <h3 className={`text-xs sm:text-sm font-bold truncate transition ${
                        theme.isLight ? 'text-[#121214] group-hover:text-black' : 'text-[#f4f4f6] group-hover:text-white'
                      }`}>
                        {getGameDisplayTitle(game)}
                      </h3>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                          theme.isLight
                            ? 'bg-[#dedad0] text-[#575654] border-[#cfcac0]'
                            : 'bg-[#1c1c21] text-[#8e8e93] border-[#2c2c34]'
                        }`}>
                          {game.shortSystem || game.system}
                        </span>
                        {game.system && game.shortSystem && (
                          <span className={`text-[11px] truncate hidden sm:inline ${
                            theme.isLight ? 'text-[#575654]' : 'text-[#8e8e93]'
                          }`}>
                            {game.system}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick Favorite & Play Buttons */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(game.id);
                      }}
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border transition active:scale-90 ${
                        favoriteSet.has(game.id)
                          ? 'bg-amber-400/95 text-zinc-950 border-amber-300'
                          : theme.isLight
                          ? 'bg-[#dedad0] text-[#575654] border-[#cfcac0] hover:text-amber-600'
                          : 'bg-[#1c1c21] text-[#8e8e93] border-[#2c2c34] hover:text-amber-300'
                      }`}
                      title={favoriteSet.has(game.id) ? 'Remove from favorites' : 'Add to favorites'}
                      aria-label={favoriteSet.has(game.id) ? `Unfavorite ${getGameDisplayTitle(game)}` : `Favorite ${getGameDisplayTitle(game)}`}
                      aria-pressed={favoriteSet.has(game.id)}
                    >
                      <Star className={`w-3.5 h-3.5 ${favoriteSet.has(game.id) ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onLaunchGame(game);
                      }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border opacity-80 group-hover:opacity-100 transition active:scale-90 ${
                        theme.isLight
                          ? 'bg-[#dedad0] hover:bg-[#8d1d5c] hover:text-white text-[#121214] border-[#cfcac0]'
                          : 'bg-[#1c1c21] hover:bg-emerald-500 hover:text-black text-[#f4f4f6] border-[#2c2c34]'
                      }`}
                      title={`Play ${getGameDisplayTitle(game)}`}
                      aria-label={`Play ${getGameDisplayTitle(game)}`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </button>
                  </div>
                ))}

                {/* Quick Add ROM Bay in List View */}
                <button
                  onClick={onTriggerAddRom}
                  className={`w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl border-2 border-dashed transition group tactile-btn ${
                    theme.isLight
                      ? 'border-stone-300 hover:border-emerald-500 bg-stone-200/50 hover:bg-stone-200 text-stone-700'
                      : 'border-zinc-800 hover:border-emerald-500/60 bg-black/40 hover:bg-zinc-900/80 text-zinc-300'
                  }`}
                >
                  <Plus className={`w-4 h-4 group-hover:text-emerald-500 ${theme.isLight ? 'text-stone-600' : 'text-zinc-400'}`} />
                  <span className="text-xs font-bold">Insert New Cartridge (.gb, .gbc, .gba, .zip, .rar)</span>
                </button>
              </div>
            ) : binderView === 'grid-3' ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-3">
                {filteredGames.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    theme={theme}
                    onSelect={onSelectGame}
                    compact={true}
                    isFavorite={favoriteSet.has(game.id)}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}

                {/* Quick Add ROM Bay in 3-Col Compact Grid */}
                <button
                  onClick={onTriggerAddRom}
                  className={`rounded-xl border-2 border-dashed p-2 flex flex-col items-center justify-center gap-1.5 min-h-[150px] transition group tactile-btn ${
                    theme.isLight
                      ? 'border-stone-300 hover:border-emerald-500 bg-stone-200/50 hover:bg-stone-200'
                      : 'border-zinc-800 hover:border-emerald-500/60 bg-black/40 hover:bg-zinc-900/80'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center transition ${
                    theme.isLight
                      ? 'bg-stone-300 group-hover:bg-emerald-500/20 border-stone-400'
                      : 'bg-zinc-900 group-hover:bg-emerald-500/20 border-zinc-800'
                  }`}>
                    <Plus className={`w-5 h-5 group-hover:text-emerald-500 ${theme.isLight ? 'text-stone-600' : 'text-zinc-400'}`} />
                  </div>
                  <span className={`text-[11px] font-bold text-center leading-tight ${theme.isLight ? 'text-zinc-900' : 'text-zinc-200'}`}>Insert Cartridge</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-3.5">
                {filteredGames.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    theme={theme}
                    onSelect={onSelectGame}
                    isFavorite={favoriteSet.has(game.id)}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}

                {/* Empty Binder Slot: Quick "Add ROM" Bay */}
                <button
                  onClick={onTriggerAddRom}
                  className={`rounded-2xl border-2 border-dashed p-4 flex flex-col items-center justify-center gap-2 min-h-[200px] transition group tactile-btn ${
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
                    .gb, .gbc, .gba, .zip, .rar
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
