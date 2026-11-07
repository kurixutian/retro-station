import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Gamepad2 } from 'lucide-react';
import { getBoxartUrls, formatGameTitle } from '../../constants/cores';
import { resolveBoxartUrl } from '../../services/boxartResolver';
import { idbGet, idbPut, idbDelete } from '../../services/storage/idb';

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
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const attemptedResolveRef = useRef<string | null>(null);

  // Reset indices whenever the displayed game changes
  useEffect(() => {
    setSrcIndex(0);
    setFailedAll(false);
    setResolvedSrc(null);
    attemptedResolveRef.current = null;
  }, [game?.id]);

  useEffect(() => {
    let active = true;
    if (game?.id) {
      idbGet(`cover:${game.id}`)
        .then((saved) => {
          if (active && saved && typeof saved === 'string') {
            // Discard previously cached broken URLs with %20 in raw.githubusercontent.com
            if (saved.includes('raw.githubusercontent.com') && saved.includes('%20')) {
              idbDelete(`cover:${game.id}`).catch(() => {});
            } else {
              setCachedUrl(saved);
            }
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

  // Last resort when every URL guess 404s: resolve against the real Libretro
  // thumbnail listing (cached per system). Runs once per game per session.
  const attemptBoxartResolve = () => {
    const gid = game?.id;
    if (!gid) {
      setFailedAll(true);
      return;
    }
    if (attemptedResolveRef.current === gid) {
      setFailedAll(true);
      return;
    }
    attemptedResolveRef.current = gid;
    resolveBoxartUrl(game)
      .then((url) => {
        if (attemptedResolveRef.current !== gid) return;
        if (url) setResolvedSrc(url);
        else setFailedAll(true);
      })
      .catch(() => {
        if (attemptedResolveRef.current === gid) setFailedAll(true);
      });
  };

  const currentUrl = cachedUrl || resolvedSrc || urls[srcIndex];

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
            // Persist whatever works (resolver hit or fresh guess URL) so
            // reloads don't re-resolve and cloud sync can propagate it.
            idbPut(`cover:${game.id}`, currentUrl).catch(() => {});
          }
        }}
        onError={() => {
          if (cachedUrl) {
            setCachedUrl(null);
            if (game?.id) {
              idbDelete(`cover:${game.id}`).catch(() => {});
            }
            return;
          }
          if (resolvedSrc) {
            // The listing-verified URL also failed (stale cache) — give up
            setResolvedSrc(null);
            setFailedAll(true);
            return;
          }
          if (srcIndex + 1 < urls.length) {
            setSrcIndex((i) => i + 1);
          } else {
            attemptBoxartResolve();
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
