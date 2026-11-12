import React, { memo } from 'react';
import { Game, Theme } from '../../types';
import { formatGameTitle } from '../../constants/cores';
import { GameCoverImage } from '../common/GameCoverImage';
import { Play } from 'lucide-react';

interface GameCardProps {
  game: Game;
  theme: Theme;
  onSelect: (game: Game) => void;
  compact?: boolean;
}

const GameCardInner: React.FC<GameCardProps> = ({ game, theme, onSelect, compact = false }) => {
  const systemLabel = game.shortSystem || game.system || 'ROM';

  return (
    <div
      onClick={() => onSelect(game)}
      className={`group cursor-pointer ${compact ? 'rounded-xl p-1 pb-1.5' : 'rounded-2xl p-1.5 pb-2'} overflow-hidden border cartridge-card flex flex-col ${theme.cardBg} hardware-panel relative select-none transition-[transform,border-color,box-shadow] duration-150 active:scale-[0.98] ${
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
      <div className={`${compact ? 'h-4 px-1.5 mb-1' : 'h-5 px-2.5 mb-1.5'} w-full rounded-t-lg border-b flex items-center justify-between relative overflow-hidden ${
        theme.isLight ? 'bg-[#dedad0]/80 border-[#cfcac0]' : 'bg-[#0a0a0c] border-[#222227]'
      }`}>
        <div className={`${compact ? 'w-10' : 'w-16'} h-full cartridge-grip opacity-40`} />
        <span className={`${compact ? 'text-[9px]' : 'text-[11px]'} font-bold ${
          theme.isLight ? 'text-[#575654]' : 'text-[#8e8e93]'
        }`}>
          {systemLabel}
        </span>
      </div>

      {/* Recessed Cartridge Sticker Label Frame */}
      <div className={`relative aspect-square ${compact ? 'rounded-lg' : 'rounded-xl'} overflow-hidden border ${
        theme.isLight ? 'bg-[#eae6dd] border-[#cfcac0]' : 'bg-[#0a0a0c] border-[#222227]'
      }`}>
        <GameCoverImage game={game} imgClassName="group-hover:scale-[1.02] transition-transform duration-200" />

        {/* Quick Play Trigger Overlay */}
        <div className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-[opacity,transform] duration-150 transform translate-y-1 group-hover:translate-y-0 z-10">
          <div className={`${compact ? 'w-6 h-6' : 'w-8 h-8'} rounded-full flex items-center justify-center shadow-md font-bold tactile-btn ${theme.accentBg}`}>
            <Play className={`${compact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} fill-current ml-0.5`} />
          </div>
        </div>
      </div>

      {/* Cartridge Label Footer */}
      <div className={`${compact ? 'pt-1.5 px-1' : 'pt-2 px-1.5'} flex items-center justify-between gap-1.5`}>
        <div className="min-w-0 flex-1 space-y-0.5">
          <h3 className={`font-bold ${compact ? 'text-[11px] leading-snug line-clamp-2 min-h-[2.5em]' : 'text-xs sm:text-sm leading-snug line-clamp-2'} transition-colors ${
            theme.isLight ? 'text-[#121214] group-hover:text-black' : 'text-[#f4f4f6] group-hover:text-white'
          }`}>
            {formatGameTitle(game.title)}
          </h3>
          {!compact && (
            <p className={`text-[11px] truncate ${theme.isLight ? 'text-[#575654]' : 'text-[#8e8e93]'}`}>
              {game.system || game.shortSystem}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export const GameCard = memo(GameCardInner);
