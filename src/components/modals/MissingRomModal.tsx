import React, { useRef, useEffect, useState } from 'react';
import { HardDrive, X, FolderPlus, Gamepad2, ShieldCheck, Cloud, RefreshCw } from 'lucide-react';
import { Game, Theme } from '../../types';
import { formatGameTitle } from '../../constants/cores';
import { ModalShell } from '../common/ModalShell';
import { fetchRomFromCloud, getCachedUserProfile } from '../../cloudSync';

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
  const [downloadingCloud, setDownloadingCloud] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const user = getCachedUserProfile();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !game) return null;

  const handleDownloadFromCloud = async () => {
    if (!game) return;
    setDownloadingCloud(true);
    try {
      showToast(`Downloading ${game.title} from Cloud Vault...`);
      const res = await fetchRomFromCloud(game.id, game.fileName, true);
      if (res.file) {
        showToast(`ROM downloaded from Cloud Vault! Launching ${game.title}...`);
        onRomSelected(res.file);
        onClose();
      } else {
        showToast(res.error || 'ROM not found in Cloud Vault. Please select a local ROM file.');
      }
    } catch (e: any) {
      showToast(`Cloud fetch error: ${e?.message || 'Failed'}`);
    } finally {
      setDownloadingCloud(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onRomSelected(file);
    e.target.value = '';
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="missing-rom-dialog-title"
      panelClassName="w-full max-w-md shadow-2xl bg-zinc-950 border-zinc-800"
    >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${theme.accentSoft}`}>
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h2 id="missing-rom-dialog-title" className="text-sm sm:text-base font-black text-white">Locate Game ROM</h2>
              <p className="text-[11px] text-zinc-400 font-medium">
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
            <div className={`p-2 rounded-xl ${theme.accentSoft} shrink-0 mt-0.5`}>
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="text-xs space-y-1">
              <div className="font-extrabold text-white flex items-center gap-1.5">
                <span>Save Progress Synced</span>
                <span className={`text-[11px] px-1.5 py-0.5 rounded uppercase font-black tracking-wider ${theme.accentSoft}`}>
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
              <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-mono text-[11px]">
                {game.shortSystem || game.system}
              </span>
              <span>•</span>
              <span className="font-mono text-[11px] text-zinc-400 truncate max-w-[200px]">
                {game.fileName || `${game.title}.rom`}
              </span>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".gb,.gbc,.gba,.zip,application/zip"
            onChange={handleFileChange}
            className="hidden"
          />

          {user ? (
            <>
              <button
                onClick={handleDownloadFromCloud}
                disabled={downloadingCloud}
                className={`w-full py-3 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg tactile-btn transition ${
                  theme.accentBg
                } disabled:opacity-50`}
              >
                {downloadingCloud ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Downloading from Cloud Vault...</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-4 h-4 stroke-[2.5]" />
                    <span>Download from Cloud Vault</span>
                  </>
                )}
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 font-semibold text-xs tactile-btn transition flex items-center justify-center gap-2"
              >
                <FolderPlus className="w-4 h-4" />
                <span>Select Local ROM File</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`w-full py-3 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg tactile-btn transition ${theme.accentBg}`}
            >
              <FolderPlus className="w-4 h-4 stroke-[2.5]" />
              <span>Select ROM File</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 font-semibold text-xs tactile-btn transition"
          >
            Cancel
          </button>
        </div>
    </ModalShell>
  );
};
