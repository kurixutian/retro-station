import React, { memo } from 'react';
import { Game, Theme } from '../../types';
import { getGameDisplayTitle } from '../../constants/cores';
import { GameCoverImage } from '../common/GameCoverImage';
import { Star } from 'lucide-react';

interface GameCardProps {
  game: Game;
  theme: Theme;
  onSelect: (game: Game) => void;
  compact?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (gameId: string) => void;
}

const GameCardInner: React.FC<GameCardProps> = ({
  game,
  theme,
  onSelect,
  compact = false,
  isFavorite = false,
  onToggleFavorite,
}) => {
  const systemLabel = game.shortSystem || game.system || 'ROM';

  return (
    <div
      onClick={() => onSelect(game)}
      className={`group cursor-pointer ${compact ? 'rounded-xl p-1.5' : 'rounded-xl p-2'} overflow-hidden border cartridge-card flex flex-col ${theme.cardBg} relative select-none transition-[transform,border-color] duration-150 active:scale-[0.98] ${
        theme.isLight
          ? 'border-[#d2cdc3] hover:border-[#b8b2a6]'
          : 'border-[#222227] hover:border-[#34343d]'
      }`}
      role="button"
      tabIndex={0}
      aria-label={`Select ${getGameDisplayTitle(game)}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(game);
        }
      }}
    >
      {/* Molded Cartridge Top Grip & System Stamp */}
      <div className={`${compact ? 'h-3.5 px-1.5 mb-1' : 'h-4 px-2 mb-1.5'} w-full rounded-t-lg border-b flex items-center justify-between relative overflow-hidden ${
        theme.isLight ? 'bg-[#dedad0]/80 border-[#cfcac0]' : 'bg-[#0a0a0c] border-[#222227]'
      }`}>
        <div className={`${compact ? 'w-8' : 'w-12'} h-full cartridge-grip opacity-35`} />
        <span className={`${compact ? 'text-[9px]' : 'text-[10px]'} font-mono font-bold tracking-wide ${
          theme.isLight ? 'text-[#575654]' : 'text-[#8e8e93]'
        }`}>
          {systemLabel}
        </span>
      </div>

      {/* Recessed Cartridge Sticker Label Frame */}
      <div className={`relative aspect-square rounded-lg overflow-hidden border ${
        theme.isLight ? 'bg-[#eae6dd] border-[#cfcac0]' : 'bg-[#0a0a0c] border-[#222227]'
      }`}>
        <GameCoverImage game={game} imgClassName="group-hover:scale-[1.02] transition-transform duration-200" />

        {/* Favorite Star Toggle (subtly visible on touch, hover-revealed on desktop) */}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(game.id);
            }}
            className={`absolute top-1.5 right-1.5 z-10 ${compact ? 'w-6 h-6' : 'w-7 h-7'} rounded-full flex items-center justify-center border transition before:content-[''] before:absolute before:-inset-2 ${
              isFavorite
                ? 'bg-amber-400/95 text-zinc-950 border-amber-300 shadow-sm opacity-100'
                : 'bg-black/60 text-white/85 border-white/20 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 hover:text-amber-300'
            }`}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-label={isFavorite ? `Unfavorite ${getGameDisplayTitle(game)}` : `Favorite ${getGameDisplayTitle(game)}`}
            aria-pressed={isFavorite}
          >
            <Star className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        )}
      </div>

      {/* Cartridge Label Footer */}
      <div className={`${compact ? 'pt-1.5 px-1' : 'pt-2 px-1'} flex items-center justify-between gap-1.5`}>
        <h3 className={`font-semibold min-w-0 flex-1 ${compact ? 'text-[11px] leading-snug line-clamp-2 min-h-[2.5em]' : 'text-xs sm:text-sm leading-snug line-clamp-2'} transition-colors ${
          theme.isLight ? 'text-[#121214] group-hover:text-black' : 'text-[#f4f4f6] group-hover:text-white'
        }`}>
          {getGameDisplayTitle(game)}
        </h3>
      </div>
    </div>
  );
};

export const GameCard = memo(GameCardInner);
