import React from 'react';
import { Game } from '../../types';
import { GameCoverImage } from './GameCoverImage';

interface CartridgeInstallOverlayProps {
  game?: Game | null;
  title?: string;
  mode?: 'install' | 'insert';
  inline?: boolean;
}

export const CartridgeInstallOverlay: React.FC<CartridgeInstallOverlayProps> = ({
  game,
  title,
  mode = 'insert',
  inline = false,
}) => {
  const statusLabel = mode === 'install' ? 'Installing Cartridge...' : 'Plugging In Cartridge...';

  const body = (
    <div className="flex flex-col items-center justify-center gap-4 text-center px-6 py-5">
      {/* Cartridge + Console Slot Visual */}
      <div className="relative w-28 h-28 flex items-end justify-center overflow-hidden">
        {/* Moving Cartridge */}
        <div className="cartridge-insert relative z-10 w-16 h-20 rounded-t-lg rounded-b-sm bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-900 border border-zinc-500/60 shadow-xl flex flex-col items-center justify-between p-1.5">
          {/* Top grip ridges */}
          <div className="w-full flex flex-col gap-0.5 px-1">
            <div className="h-0.5 w-full rounded bg-zinc-500/50" />
            <div className="h-0.5 w-full rounded bg-zinc-500/40" />
          </div>
          {/* Label area */}
          <div className="w-11 h-9 rounded-sm overflow-hidden bg-gradient-to-br from-emerald-500/90 via-teal-600 to-zinc-900 border border-emerald-300/40 flex items-center justify-center shadow-inner">
            {game ? (
              <GameCoverImage game={game} className="w-full h-full" />
            ) : (
              <span className="text-[8px] font-mono font-black tracking-wider text-white/95">
                ROM
              </span>
            )}
          </div>
          {/* Gold connector pins */}
          <div className="w-12 h-2 flex items-end justify-between px-0.5">
            {Array.from({ length: 7 }).map((_, i) => (
              <span
                key={i}
                className="w-1 h-2 rounded-t-[1px] bg-amber-400/90"
              />
            ))}
          </div>
        </div>

        {/* Console Cartridge Slot */}
        <div className="absolute bottom-0 inset-x-2 h-6 rounded-lg bg-zinc-950 border border-zinc-700/80 shadow-inner z-20 flex items-center justify-center">
          <div className="slot-contact-glow w-16 h-1.5 rounded-full bg-emerald-400/70" />
        </div>
      </div>

      <div className="space-y-1 max-w-[240px]">
        <p className="text-xs font-mono font-bold tracking-wide text-emerald-400 uppercase">
          {statusLabel}
        </p>
        {title && (
          <p className="text-xs font-semibold text-zinc-200 truncate">
            {title}
          </p>
        )}
      </div>
    </div>
  );

  if (inline) {
    return (
      <div className="absolute inset-0 z-20 w-full h-full flex items-center justify-center bg-black/95">
        {body}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm modal-in"
      role="status"
      aria-live="polite"
      aria-label={statusLabel}
    >
      <div className="rounded-2xl bg-zinc-900/95 border border-zinc-700/80 shadow-2xl modal-pop">
        {body}
      </div>
    </div>
  );
};
