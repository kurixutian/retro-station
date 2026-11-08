import React, { useState } from 'react';
import { Play, Download, Trash2, Layers, Camera, X, AlertTriangle } from 'lucide-react';
import { Game, SaveSlot } from '../../types';
import { GameCoverImage } from '../common/GameCoverImage';
import { formatGameTitle } from '../../constants/cores';
import { createEmptySlotsForGame } from '../../services/storage/saveSlots';

interface SaveSlotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetGame: Game | null;
  activeGame: Game | null;
  currentView: string;
  savesByGameId: Record<string, SaveSlot[]>;
  launchGame: (game: Game) => void;
  exportBatterySave: (game: Game, format: 'sav' | 'srm') => void;
  deleteRom: (gameId: string) => void;
  loadStateFromGameSlot: (game: Game, slotNum: number) => void;
  saveStateToGameSlot: (game: Game, slotNum: number) => void | Promise<void>;
  deleteGameSlot: (gameId: string, slotNum: number) => void;
}

export const SaveSlotsModal: React.FC<SaveSlotsModalProps> = ({
  isOpen,
  onClose,
  targetGame,
  activeGame,
  currentView,
  savesByGameId,
  launchGame,
  exportBatterySave,
  deleteRom,
  loadStateFromGameSlot,
  saveStateToGameSlot,
  deleteGameSlot,
}) => {
  const [confirmDeleteRom, setConfirmDeleteRom] = useState(false);
  const [confirmOverwriteSlot, setConfirmOverwriteSlot] = useState<number | null>(null);
  const [confirmDeleteSlot, setConfirmDeleteSlot] = useState<number | null>(null);
  const [saveFormat, setSaveFormat] = useState<'sav' | 'srm'>('sav');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !targetGame) return null;

  const gameSlots = savesByGameId[targetGame.id] || createEmptySlotsForGame(targetGame.id);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-slots-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px) + 20px, 36px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px) + 20px, 36px)',
        paddingLeft: 'max(env(safe-area-inset-left, 0px) + 12px, 16px)',
        paddingRight: 'max(env(safe-area-inset-right, 0px) + 12px, 16px)'
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden my-auto hardware-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dialog Header Banner */}
        <div className={`relative p-5 bg-gradient-to-r ${targetGame.coverGradient || 'from-zinc-800 to-zinc-950'} flex-none border-b border-black/40`}>
          <div className="absolute inset-0">
            <GameCoverImage game={targetGame} imgClassName="w-full h-full object-cover opacity-65" />
          </div>
          <div className="absolute inset-0 bg-zinc-950/70" />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-black/60 text-amber-300 border border-amber-400/30">
                  {targetGame.system}
                </span>
              </div>
              <h2 id="save-slots-title" className="text-xl sm:text-2xl font-black text-white">{formatGameTitle(targetGame.title)}</h2>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-black/50 hover:bg-black/80 text-zinc-200 border border-white/15 tactile-btn"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Primary Play & Actions Bar */}
          <div className="relative z-10 mt-4 flex flex-wrap items-center gap-2">
            {currentView === 'home' && (
              <button
                onClick={() => launchGame(targetGame)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-xs font-black shadow-lg tactile-btn transition"
                title={`Play ${formatGameTitle(targetGame.title)}`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Play Cartridge</span>
              </button>
            )}

            <div className="flex items-center rounded-xl bg-zinc-900/95 border border-amber-500/30 p-0.5 shadow-sm">
              <button
                onClick={() => exportBatterySave(targetGame, saveFormat)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-amber-500/15 text-amber-300 text-xs font-bold transition active:scale-95"
                title={
                  saveFormat === 'sav'
                    ? 'Download raw battery RAM (.sav) for cartridge flashers (GB Operator / FlashGBX)'
                    : 'Download libretro battery RAM (.srm) for RetroArch'
                }
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Battery Save</span>
              </button>
              <div className="h-4 w-px bg-zinc-800 mx-0.5" />
              <div className="flex items-center gap-0.5 pr-0.5" role="group" aria-label="Battery save format">
                <button
                  type="button"
                  onClick={() => setSaveFormat('sav')}
                  className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition ${
                    saveFormat === 'sav'
                      ? 'bg-amber-400 text-zinc-950'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Physical Flasher format (.sav)"
                >
                  .SAV
                </button>
                <button
                  type="button"
                  onClick={() => setSaveFormat('srm')}
                  className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition ${
                    saveFormat === 'srm'
                      ? 'bg-amber-400 text-zinc-950'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="RetroArch format (.srm)"
                >
                  .SRM
                </button>
              </div>
            </div>

            <button
              onClick={() => setConfirmDeleteRom(true)}
              className="p-2 rounded-xl bg-zinc-900/90 hover:bg-rose-900/30 text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-500/40 tactile-btn transition ml-auto"
              title="Delete ROM"
              aria-label="Delete ROM"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* In-Modal Destructive ROM Delete Confirmation Banner */}
          {confirmDeleteRom && (
            <div className="relative z-20 mt-3 p-3.5 rounded-xl bg-rose-950/90 border border-rose-500/60 shadow-xl space-y-2.5">
              <div className="flex items-center gap-2 text-rose-300">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span className="text-xs font-black">Confirm Cartridge Deletion</span>
              </div>
              <p className="text-[11px] text-rose-200/90 leading-snug">
                Permanently delete <strong className="text-white">"{formatGameTitle(targetGame.title)}"</strong> from your local library? This will delete the ROM and cannot be undone.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => {
                    setConfirmDeleteRom(false);
                    deleteRom(targetGame.id);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs tactile-btn"
                >
                  Yes, Delete ROM
                </button>
                <button
                  onClick={() => setConfirmDeleteRom(false)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs tactile-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Per-Game Save State Slots Grid (4 Isolated Slots per Game) */}
        <div className="p-5 space-y-3 flex-1 overflow-y-auto modal-scroll">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-zinc-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>State Slots</span>
              </h3>
              <p className="text-[11px] text-zinc-400">
                Each game has its own dedicated save state slots. Switch or resume anytime.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {gameSlots.map((slotObj) => (
              <div
                key={slotObj.slot}
                className={`rounded-2xl border p-3 flex flex-col justify-between gap-2.5 transition ${
                  slotObj.empty
                    ? 'bg-zinc-900/40 border-zinc-800/80'
                    : 'bg-zinc-900/95 border-emerald-500/40 shadow-md'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Thumbnail Preview */}
                  <div className="w-20 h-16 rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                    {(() => {
                      const isValidScreenshot = Boolean(slotObj.screenshot && slotObj.screenshot.length > 50);
                      const previewImg = isValidScreenshot ? slotObj.screenshot : (!slotObj.empty ? (targetGame.customCover || targetGame.cover) : null);
                      if (previewImg) {
                        return (
                          <img
                            src={previewImg}
                            alt={`Slot ${slotObj.slot}`}
                            className="w-full h-full object-cover"
                          />
                        );
                      }
                      return (
                        <span className="text-[10px] font-mono font-bold text-zinc-400">EMPTY</span>
                      );
                    })()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-400 font-mono">
                        SLOT #{slotObj.slot}
                      </span>
                      {slotObj.timestamp && (
                        <span className="text-[10px] font-mono text-zinc-400">
                          {slotObj.timestamp}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-zinc-100 truncate mt-0.5">
                      {slotObj.label}
                    </p>
                    {!slotObj.empty && (slotObj.score > 0 || slotObj.frame > 0) && (
                      <p className="text-[10px] font-mono text-zinc-400">
                        Score: {slotObj.score} • Frame: {slotObj.frame}
                      </p>
                    )}
                  </div>
                </div>

                {/* Slot Action Buttons */}
                <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-800/80">
                  {/* Load & Play Slot */}
                  <button
                    disabled={slotObj.empty}
                    onClick={() => loadStateFromGameSlot(targetGame, slotObj.slot)}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition tactile-btn ${
                      slotObj.empty
                        ? 'bg-zinc-800/50 text-zinc-600 cursor-not-allowed'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
                    }`}
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>{currentView === 'home' ? 'Play State' : 'Load'}</span>
                  </button>

                  {/* Save Current Frame into Slot (When in-game on this game) */}
                  {currentView === 'ingame' && activeGame?.id === targetGame.id && (
                    <>
                      {confirmOverwriteSlot === slotObj.slot ? (
                        <div className="flex-1 flex items-center gap-1">
                          <button
                            onClick={() => {
                              setConfirmOverwriteSlot(null);
                              saveStateToGameSlot(targetGame, slotObj.slot);
                            }}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black transition tactile-btn"
                          >
                            Overwrite?
                          </button>
                          <button
                            onClick={() => setConfirmOverwriteSlot(null)}
                            className="py-1.5 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-semibold"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            if (slotObj.empty) {
                              saveStateToGameSlot(targetGame, slotObj.slot);
                            } else {
                              setConfirmOverwriteSlot(slotObj.slot);
                            }
                          }}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold transition tactile-btn"
                        >
                          <Camera className="w-3 h-3" />
                          <span>{slotObj.empty ? 'Save Here' : 'Overwrite'}</span>
                        </button>
                      )}
                    </>
                  )}

                  {/* Clear Slot */}
                  {!slotObj.empty && (
                    <>
                      {confirmDeleteSlot === slotObj.slot ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setConfirmDeleteSlot(null);
                              deleteGameSlot(targetGame.id, slotObj.slot);
                            }}
                            className="px-2 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold tactile-btn"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setConfirmDeleteSlot(null)}
                            className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteSlot(slotObj.slot)}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-500/30 text-rose-400 tactile-btn"
                          title="Delete slot"
                          aria-label="Delete slot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
