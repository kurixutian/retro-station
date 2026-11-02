import React from 'react';
import {
  Gamepad2,
  HardDrive,
  FolderPlus,
  Plus,
  Search,
  Settings,
  Play,
  X,
  Cloud,
} from 'lucide-react';
import { Game, Theme } from '../../types';
import { formatGameTitle } from '../../constants/cores';
import { GameCoverImage } from '../common/GameCoverImage';
import { GameCard } from './GameCard';

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
  cloudStatus?: 'unlinked' | 'idle' | 'syncing' | 'offline' | 'error';
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
}) => {
  return (
    <div className="pb-16 min-h-[100dvh]">
      {/* Sticky Top Navigation Bar */}
      <header
        className="sticky top-0 z-30 backdrop-blur-xl bg-zinc-950/85 border-b border-zinc-800/80 px-4 sm:px-6 py-3 hardware-panel"
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
              className={`p-2.5 rounded-xl border tactile-btn transition ${
                showSearch
                  ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                  : 'bg-zinc-900/90 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
              }`}
              title="Search ROMs"
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              onClick={onTriggerAddRom}
              className={`p-2.5 rounded-xl font-bold shadow-lg tactile-btn transition ${theme.accentBg}`}
              title="Load ROM"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </button>

            <button
              onClick={onOpenCloudSync}
              className={`p-2.5 rounded-xl border tactile-btn transition flex items-center gap-1.5 ${
                cloudStatus === 'idle'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                  : cloudStatus === 'syncing'
                  ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                  : 'bg-zinc-900/90 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
              }`}
              title="Cloud Save Vault"
            >
              <Cloud className="w-4 h-4" />
              {cloudStatus === 'idle' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              )}
            </button>

            <button
              onClick={onOpenSettings}
              className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 tactile-btn transition"
              title="Configuration"
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

      {/* Main Content Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 space-y-7">
        {/* Hero Spotlight Banner */}
        {games[0] && (
          <div className="relative rounded-3xl overflow-hidden border border-zinc-800/90 shadow-2xl h-56 sm:h-64 flex items-end p-5 sm:p-8 hardware-panel">
            {/* Full Cover Image Background */}
            <div className="absolute inset-0">
              <GameCoverImage game={games[0]} imgClassName="w-full h-full object-cover opacity-65 hero-art-pan" />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/50 to-transparent" />
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
                onClick={() => onLaunchGame(games[0])}
                className="w-12 h-12 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 flex items-center justify-center shadow-2xl tactile-btn transition shrink-0"
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
              className={`px-3 py-1.5 rounded-xl text-xs font-bold tactile-btn transition ${
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
              onClick={onTriggerAddRom}
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
                onClick={onTriggerAddRom}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs tactile-btn shadow-lg transition ${theme.accentBg}`}
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Load ROM</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {filteredGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  theme={theme}
                  onSelect={onSelectGame}
                />
              ))}

              {/* Quick "Add ROM" Card */}
              <button
                onClick={onTriggerAddRom}
                className="rounded-2xl border-2 border-dashed border-zinc-800 hover:border-emerald-500/60 bg-zinc-900/40 hover:bg-zinc-900/80 p-4 flex flex-col items-center justify-center gap-2 min-h-[200px] transition group tactile-btn"
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
  );
};
