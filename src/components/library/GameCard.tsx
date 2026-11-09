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
      className={`group cursor-pointer rounded-2xl overflow-hidden border cartridge-card flex flex-col ${theme.cardBg} hardware-panel relative select-none p-1.5 pb-2 transition-[transform,border-color,box-shadow] duration-150 active:scale-[0.98] ${
        theme.isLight
          ? 'border-[#d2cdc3] hover:border-[#b8b2a6]'
          : 'border-[#222227] hover:border-[#34343d]'
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
        theme.isLight ? 'bg-[#dedad0]/80 border-[#cfcac0]' : 'bg-[#0a0a0c] border-[#222227]'
      }`}>
        <div className="w-16 h-full cartridge-grip opacity-40" />
        <span className={`text-[10px] font-bold ${
          theme.isLight ? 'text-[#575654]' : 'text-[#8e8e93]'
        }`}>
          {systemLabel}
        </span>
      </div>

      {/* Recessed Cartridge Sticker Label Frame */}
      <div className={`relative aspect-square rounded-xl overflow-hidden border ${
        theme.isLight ? 'bg-[#eae6dd] border-[#cfcac0]' : 'bg-[#0a0a0c] border-[#222227]'
      }`}>
        <GameCoverImage game={game} />

        {/* Quick Play Trigger Overlay */}
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-[opacity,transform] duration-150 transform translate-y-1 group-hover:translate-y-0 z-10">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md font-bold tactile-btn ${theme.accentBg}`}>
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          </div>
        </div>
      </div>

      {/* Cartridge Label Footer */}
      <div className="pt-2 px-1.5 flex items-center justify-between gap-1.5">
        <div className="min-w-0 flex-1 space-y-0.5">
          <h3 className={`font-bold text-xs sm:text-sm truncate transition-colors ${
            theme.isLight ? 'text-[#121214] group-hover:text-black' : 'text-[#f4f4f6] group-hover:text-white'
          }`}>
            {formatGameTitle(game.title)}
          </h3>
          <p className={`text-[11px] truncate ${
            theme.isLight ? 'text-[#575654]' : 'text-[#8e8e93]'
          }`}>
            {game.system || game.shortSystem}
          </p>
        </div>
      </div>
    </div>
  );
};
