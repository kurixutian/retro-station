import React, { useRef } from 'react';
import { HardDrive, X, FolderPlus, Gamepad2, ShieldCheck } from 'lucide-react';
import { Game, Theme } from '../../types';
import { formatGameTitle } from '../../constants/cores';

interface MissingRomModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: Game | null;
  theme: Theme;
  onRomSelected: (file: File) => void;
  showToast: (msg: string) => void;
}

export const MissingRomModal: React.FC<MissingRomModalProps> = ({
  isOpen,
  onClose,
  game,
  theme,
  onRomSelected,
  showToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen || !game) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onRomSelected(file);
    e.target.value = '';
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px) + 20px, 36px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px) + 20px, 36px)',
        paddingLeft: 'max(env(safe-area-inset-left, 0px) + 12px, 16px)',
        paddingRight: 'max(env(safe-area-inset-right, 0px) + 12px, 16px)',
      }}
    >
      <div className="w-full max-w-md flex flex-col rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden my-auto hardware-panel">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${theme.accentSoft}`}>
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white">Locate Game ROM</h2>
              <p className="text-[10px] text-zinc-400 font-medium">
                Cloud saves ready • Link ROM file for this device
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white tactile-btn border border-zinc-800"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto modal-scroll">
          <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="text-xs space-y-1">
              <div className="font-extrabold text-white flex items-center gap-1.5">
                <span>Save Progress Synced</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded uppercase font-black tracking-wider bg-emerald-500/20 text-emerald-300">
                  Ready
                </span>
              </div>
              <p className="text-zinc-400 leading-snug">
                Your save state slots and battery saves for this game are synced in your Cloud Vault. Select your local ROM file once to play on this device.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-2">
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-zinc-400" />
              <span className="text-xs font-bold text-zinc-200">
                {formatGameTitle(game.title)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
              <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-mono text-[10px]">
                {game.shortSystem || game.system}
              </span>
              <span>•</span>
              <span className="font-mono text-[10px] text-zinc-400 truncate max-w-[200px]">
                {game.fileName || `${game.title}.rom`}
              </span>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".gb,.gbc,.gba,.nes,.sfc,.smc,.fig,.swc,.md,.gen,.smd,.bin,.gg,.sms,.sg,.zip,application/zip"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className={`w-full py-3 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg tactile-btn transition ${theme.accentBg}`}
          >
            <FolderPlus className="w-4 h-4 stroke-[2.5]" />
            <span>Select ROM File</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 font-semibold text-xs tactile-btn transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
