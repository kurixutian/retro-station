import React, { useState, useMemo, useEffect } from 'react';
import { Gamepad2 } from 'lucide-react';
import { getBoxartUrls, formatGameTitle } from '../../constants/cores';
import { idbGet, idbPut } from '../../services/storage/idb';

interface GameCoverImageProps {
  game: any;
  className?: string;
  imgClassName?: string;
  showBadge?: boolean;
}

export const GameCoverImage: React.FC<GameCoverImageProps> = ({
  game,
  className = '',
  imgClassName = '',
  showBadge = false
}) => {
  const [srcIndex, setSrcIndex] = useState(0);
  const [failedAll, setFailedAll] = useState(false);
  const [cachedUrl, setCachedUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (game?.id) {
      idbGet(`cover:${game.id}`)
        .then((saved) => {
          if (active && saved && typeof saved === 'string') {
            setCachedUrl(saved);
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [game?.id]);

  const urls = useMemo(() => {
    const list = getBoxartUrls(game);
    if (cachedUrl && !list.includes(cachedUrl)) {
      return [cachedUrl, ...list];
    }
    return list;
  }, [game, cachedUrl]);

  const currentUrl = cachedUrl || urls[srcIndex];

  if (!currentUrl || failedAll) {
    return (
      <div
        className={`relative w-full h-full bg-gradient-to-br ${
          game?.coverGradient || 'from-zinc-900 to-zinc-950'
        } flex flex-col justify-between p-3 overflow-hidden border border-black/40 ${className}`}
      >
        <div className="absolute inset-0 cartridge-grip opacity-30 pointer-events-none" />
        {showBadge && (
          <span className="self-start relative z-10 px-2 py-0.5 rounded-md text-[10px] font-black bg-black/60 text-white backdrop-blur-sm border border-white/15">
            {game?.shortSystem || 'ROM'}
          </span>
        )}
        <div className="my-auto flex items-center justify-center">
          <Gamepad2 className="w-10 h-10 text-white/40" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full h-full overflow-hidden flex items-center justify-center bg-zinc-950 ${className}`}
    >
      <img
        src={currentUrl}
        alt={formatGameTitle(game?.title || '')}
        onLoad={() => {
          if (currentUrl && game?.id && currentUrl !== cachedUrl) {
            idbPut(`cover:${game.id}`, currentUrl).catch(() => {});
          }
        }}
        onError={() => {
          if (cachedUrl) {
            setCachedUrl(null);
            return;
          }
          if (srcIndex + 1 < urls.length) {
            setSrcIndex((i) => i + 1);
          } else {
            setFailedAll(true);
          }
        }}
        className={`w-full h-full object-cover ${
          imgClassName.includes('object-') || imgClassName.includes('hero-art-pan')
            ? ''
            : 'object-center'
        } ${imgClassName}`}
        loading="lazy"
      />
      {showBadge && (
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-black bg-black/60 text-white backdrop-blur-sm border border-white/15">
          {game?.shortSystem || 'ROM'}
        </span>
      )}
    </div>
  );
};
