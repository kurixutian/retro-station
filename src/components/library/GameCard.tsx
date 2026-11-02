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
      className={`group cursor-pointer rounded-2xl overflow-hidden border cartridge-card flex flex-col ${theme.cardBg} hardware-panel relative select-none`}
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
      {/* Molded Cartridge Top Notch & Grip Lines */}
      <div className="h-2.5 w-full bg-black/40 border-b border-white/5 flex items-center justify-center relative overflow-hidden">
        <div className="w-16 h-full cartridge-grip opacity-40" />
      </div>

      {/* Cartridge Cover Art Label */}
      <div className="relative h-44 sm:h-48 overflow-hidden bg-zinc-950 border-b border-black/40">
        <GameCoverImage game={game} />

        {/* System Cartridge Tag */}
        <div className="absolute top-2 left-2 z-10">
          <span className="px-2 py-0.5 rounded-md text-[9px] font-mono font-black uppercase tracking-wider bg-black/75 text-amber-300 border border-white/10 backdrop-blur-xs shadow-md">
            {systemLabel}
          </span>
        </div>

        {/* Quick Play Trigger Overlay */}
        <div className="absolute bottom-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-[opacity,transform] duration-150 transform translate-y-1 group-hover:translate-y-0 z-10">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg font-bold tactile-btn ${theme.accentBg}`}>
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          </div>
        </div>
      </div>

      {/* Card Label Footer */}
      <div className="p-3 space-y-0.5 bg-zinc-950/40">
        <h3 className="font-bold text-xs sm:text-sm text-zinc-100 truncate group-hover:text-white transition-colors">
          {formatGameTitle(game.title)}
        </h3>
        <p className="text-[11px] font-mono text-zinc-400 truncate">
          {game.system || game.shortSystem}
        </p>
      </div>
    </div>
  );
};
