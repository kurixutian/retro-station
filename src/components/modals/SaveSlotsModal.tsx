import React from 'react';
import { Play, Download, Trash2, Layers, Camera, X } from 'lucide-react';
import { Game, SaveSlot } from '../../types';
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
  saveStateToGameSlot: (game: Game, slotNum: number) => void;
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
  if (!isOpen || !targetGame) return null;

  const gameSlots = savesByGameId[targetGame.id] || createEmptySlotsForGame(targetGame.id);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px) + 20px, 36px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px) + 20px, 36px)',
        paddingLeft: 'max(env(safe-area-inset-left, 0px) + 12px, 16px)',
        paddingRight: 'max(env(safe-area-inset-right, 0px) + 12px, 16px)'
      }}
    >
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden my-auto">
        {/* Dialog Header Banner */}
        <div className={`relative p-5 bg-gradient-to-r ${targetGame.coverGradient || 'from-zinc-800 to-zinc-950'} flex-none`}>
          <div className="absolute inset-0 bg-zinc-950/65" />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-black/60 text-amber-300 border border-amber-400/30">
                  {targetGame.system}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">{formatGameTitle(targetGame.title)}</h2>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-black/50 hover:bg-black/80 text-zinc-200 border border-white/15"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Primary Play & Actions Bar */}
          <div className="relative z-10 mt-4 flex flex-wrap items-center gap-2.5">
            {currentView === 'home' && (
              <button
                onClick={() => launchGame(targetGame)}
                className="p-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-black shadow-lg transition active:scale-95"
                title={`Play ${formatGameTitle(targetGame.title)}`}
              >
                <Play className="w-5 h-5 fill-current ml-0.5" />
              </button>
            )}

            <button
              onClick={() => exportBatterySave(targetGame, 'sav')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-amber-300 border border-amber-500/30 text-xs font-bold transition"
              title="Download .sav for physical cartridge flasher (GB Operator / FlashGBX)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .SAV</span>
            </button>

            <button
              onClick={() => exportBatterySave(targetGame, 'srm')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-bold transition"
              title="Download .srm for RetroArch"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Export .SRM</span>
            </button>

            <button
              onClick={() => {
                if (window.confirm(`Delete "${formatGameTitle(targetGame.title)}" from library?`)) {
                  deleteRom(targetGame.id);
                }
              }}
              className="p-2.5 rounded-xl bg-zinc-900/90 hover:bg-rose-900/30 text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-500/40 transition active:scale-95"
              title="Delete ROM"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Per-Game Save State Slots Grid (4 Isolated Slots per Game) */}
        <div className="p-5 space-y-3 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-zinc-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Save State Slots • {formatGameTitle(targetGame.title)}</span>
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
                    {slotObj.screenshot ? (
                      <img
                        src={slotObj.screenshot}
                        alt={`Slot ${slotObj.slot}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] font-mono text-zinc-600">EMPTY</span>
                    )}
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
                    {!slotObj.empty && (
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
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition ${
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
                    <button
                      onClick={() => saveStateToGameSlot(targetGame, slotObj.slot)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold transition"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Save Here</span>
                    </button>
                  )}

                  {/* Clear Slot */}
                  {!slotObj.empty && (
                    <button
                      onClick={() => deleteGameSlot(targetGame.id, slotObj.slot)}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-500/30 text-rose-400"
                      title="Delete slot"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
