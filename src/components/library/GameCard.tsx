import React from 'react';
import { Game, Theme } from '../../types';
import { formatGameTitle } from '../../constants/cores';
import { GameCoverImage } from '../common/GameCoverImage';

interface GameCardProps {
  game: Game;
  theme: Theme;
  onSelect: (game: Game) => void;
}

export const GameCard: React.FC<GameCardProps> = ({ game, theme, onSelect }) => {
  return (
    <div
      onClick={() => onSelect(game)}
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
  );
};
