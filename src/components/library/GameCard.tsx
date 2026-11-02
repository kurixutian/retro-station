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
  return (
    <div
      onClick={() => onSelect(game)}
      className={`group cursor-pointer rounded-2xl overflow-hidden border cartridge-card flex flex-col ${theme.cardBg}`}
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
      {/* Cartridge Cover Poster */}
      <div className="relative h-44 sm:h-48 overflow-hidden rounded-t-xl bg-zinc-900 border-b border-black/40">
        <GameCoverImage game={game} />

        {/* Quick Play Trigger Overlay */}
        <div className="absolute bottom-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-[opacity,transform] duration-150 transform translate-y-1 group-hover:translate-y-0">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg font-bold tactile-btn ${theme.accentBg}`}>
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="p-3 space-y-1">
        <h3 className="font-bold text-xs sm:text-sm text-zinc-100 truncate group-hover:text-white transition-colors">
          {formatGameTitle(game.title)}
        </h3>
        <p className="text-[11px] text-zinc-400 truncate">
          {game.system || game.shortSystem}
        </p>
      </div>
    </div>
  );
};
