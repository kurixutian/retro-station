import React from 'react';
import { Game, Theme } from '../../types';
import { formatGameTitle } from '../../constants/cores';
import { GameCoverImage } from '../common/GameCoverImage';
import { Play } from 'lucide-react';

interface GameCardProps {
  game: Game;
  theme: Theme;
  onSelect: (game: Game) => void;
}

export const GameCard: React.FC<GameCardProps> = ({ game, theme, onSelect }) => {
  const systemLabel = game.shortSystem || game.system || 'ROM';

  return (
    <div
      onClick={() => onSelect(game)}
      className={`group cursor-pointer rounded-2xl overflow-hidden border cartridge-card flex flex-col ${theme.cardBg} hardware-panel relative select-none p-1.5 pb-2 transition-all duration-150 active:scale-[0.97] ${
        theme.isLight
          ? 'border-stone-300 hover:border-stone-400 shadow-sm'
          : 'border-zinc-800/90 hover:border-zinc-600'
      }`}
      role="button"
      tabIndex={0}
      aria-label={`Select ${formatGameTitle(game.title)}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(game);
        }
      }}
    >
      {/* Molded Cartridge Top Grip & System Stamp */}
      <div className={`h-5 w-full rounded-t-xl border-b px-2.5 flex items-center justify-between relative overflow-hidden mb-1.5 ${
        theme.isLight ? 'bg-stone-300/80 border-stone-400/40' : 'bg-black/50 border-white/5'
      }`}>
        <div className="w-16 h-full cartridge-grip opacity-50" />
        <span className={`text-[9px] font-mono font-black uppercase tracking-widest ${
          theme.isLight ? 'text-amber-800' : 'text-amber-300/90'
        }`}>
          {systemLabel}
        </span>
      </div>

      {/* Recessed Cartridge Sticker Label Frame */}
      <div className={`relative aspect-square rounded-xl overflow-hidden border-2 shadow-inner ${
        theme.isLight ? 'bg-stone-200 border-stone-300' : 'bg-zinc-950 border-black/80'
      }`}>
        <GameCoverImage game={game} />

        {/* Quick Play Trigger Overlay */}
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-[opacity,transform] duration-150 transform translate-y-1 group-hover:translate-y-0 z-10">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg font-bold tactile-btn ${theme.accentBg}`}>
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          </div>
        </div>
      </div>

      {/* Cartridge Label Footer & Insertion Triangle */}
      <div className="pt-2 px-1.5 flex items-end justify-between gap-1.5">
        <div className="min-w-0 flex-1 space-y-0.5">
          <h3 className={`font-extrabold text-xs sm:text-sm truncate transition-colors ${
            theme.isLight ? 'text-zinc-900 group-hover:text-black' : 'text-zinc-100 group-hover:text-white'
          }`}>
            {formatGameTitle(game.title)}
          </h3>
          <p className={`text-[10px] font-mono truncate ${
            theme.isLight ? 'text-stone-600' : 'text-zinc-400'
          }`}>
            {game.system || game.shortSystem}
          </p>
        </div>
        <span
          className={`text-[9px] font-mono transition-colors shrink-0 pb-0.5 ${
            theme.isLight ? 'text-stone-400 group-hover:text-stone-700' : 'text-zinc-600 group-hover:text-emerald-400'
          }`}
          aria-hidden="true"
        >
          ▼
        </span>
      </div>
    </div>
  );
};
