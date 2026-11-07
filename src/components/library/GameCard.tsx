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
      className={`group cursor-pointer rounded-2xl overflow-hidden border border-zinc-800/90 hover:border-zinc-600 cartridge-card flex flex-col ${theme.cardBg} hardware-panel relative select-none p-1.5 pb-2`}
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
      <div className="h-5 w-full rounded-t-xl bg-black/50 border-b border-white/5 px-2.5 flex items-center justify-between relative overflow-hidden mb-1.5">
        <div className="w-16 h-full cartridge-grip opacity-50" />
        <span className="text-[9px] font-mono font-black uppercase tracking-widest text-amber-300/90">
          {systemLabel}
        </span>
      </div>

      {/* Recessed Cartridge Sticker Label Frame */}
      <div className="relative h-40 sm:h-44 rounded-xl overflow-hidden bg-zinc-950 border-2 border-black/80 shadow-inner">
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
          <h3 className="font-bold text-xs sm:text-sm text-zinc-100 truncate group-hover:text-white transition-colors">
            {formatGameTitle(game.title)}
          </h3>
          <p className="text-[10px] font-mono text-zinc-400 truncate">
            {game.system || game.shortSystem}
          </p>
        </div>
        <span
          className="text-[9px] font-mono text-zinc-600 group-hover:text-emerald-400 transition-colors shrink-0 pb-0.5"
          aria-hidden="true"
        >
          ▼
        </span>
      </div>
    </div>
  );
};
