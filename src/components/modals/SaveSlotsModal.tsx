import React, { useState, useEffect, useRef } from 'react';
import { Play, Download, Trash2, Layers, Camera, X, AlertTriangle, Pencil, ImagePlus, RotateCcw } from 'lucide-react';
import { Game, SaveSlot, Theme } from '../../types';
import { GameCoverImage } from '../common/GameCoverImage';
import { formatGameTitle } from '../../constants/cores';
import { createEmptySlotsForGame } from '../../services/storage/saveSlots';

// Resize + compress a picked image into a small data URL (WebP, ~30-60KB).
const processArtworkFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Not a valid image'));
      img.onload = () => {
        try {
          const MAX = 384;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas unavailable'));
          ctx.drawImage(img, 0, 0, w, h);
          let url = canvas.toDataURL('image/webp', 0.85);
          if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', 0.85);
          resolve(url);
        } catch (err) {
          reject(err);
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });

interface SaveSlotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetGame: Game | null;
  activeGame: Game | null;
  currentView: string;
  theme?: Theme;
  savesByGameId: Record<string, SaveSlot[]>;
  launchGame: (game: Game) => void;
  exportBatterySave: (game: Game, format: 'sav' | 'srm') => void;
  deleteRom: (gameId: string) => void;
  loadStateFromGameSlot: (game: Game, slotNum: number) => void;
  saveStateToGameSlot: (game: Game, slotNum: number) => void | Promise<void>;
  deleteGameSlot: (gameId: string, slotNum: number) => void;
  slotNames?: Record<number, string>;
  onRenameSlot?: (slotNum: number, name: string) => void;
  initialMode?: 'save' | 'load' | null;
  onChangeArtwork?: (gameId: string, dataUrl: string | null) => void;
}

// Grows the slot list: always show base slots; when every visible slot is
// used, append one fresh empty slot so the player can keep saving.
const emptySlot = (n: number): SaveSlot => ({
  slot: n, empty: true, label: 'Empty Slot', timestamp: null,
  score: 0, frame: 0, screenshot: null, stateData: null,
});

const buildSlots = (gameSlots: SaveSlot[]): SaveSlot[] => {
  const used = gameSlots.filter((s) => !s.empty).length;
  return used >= gameSlots.length && gameSlots.length > 0
    ? [...gameSlots, emptySlot(gameSlots.length + 1)]
    : gameSlots;
};

export const SaveSlotsModal: React.FC<SaveSlotsModalProps> = ({
  isOpen,
  onClose,
  targetGame,
  activeGame,
  currentView,
  theme,
  savesByGameId,
  launchGame,
  exportBatterySave,
  deleteRom,
  loadStateFromGameSlot,
  saveStateToGameSlot,
  deleteGameSlot,
  slotNames = {},
  onRenameSlot,
  initialMode = null,
  onChangeArtwork,
}) => {
  const [confirmDeleteRom, setConfirmDeleteRom] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'load' | 'overwrite'; slot: number } | null>(null);
  const [confirmDeleteSlot, setConfirmDeleteSlot] = useState<number | null>(null);
  const [deleteTypeText, setDeleteTypeText] = useState('');
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saveFormat, setSaveFormat] = useState<'sav' | 'srm'>('sav');
  const artInputRef = useRef<HTMLInputElement | null>(null);

  const handleArtworkPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !targetGame) return;
    try {
      const url = await processArtworkFile(file);
      onChangeArtwork?.(targetGame.id, url);
    } catch (err) {}
  };

  useEffect(() => {
    if (!isOpen) {
      setConfirmDeleteRom(false);
      setConfirmAction(null);
      setConfirmDeleteSlot(null);
      setDeleteTypeText('');
      setEditingSlot(null);
      setEditValue('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !targetGame) return null;

  const gameSlots = buildSlots(savesByGameId[targetGame.id] || createEmptySlotsForGame(targetGame.id));

  const commitRename = (slotNum: number) => {
    onRenameSlot?.(slotNum, editValue.trim());
    setEditingSlot(null);
    setEditValue('');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-slots-title"
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px) + 20px, 36px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px) + 20px, 36px)',
        paddingLeft: 'max(env(safe-area-inset-left, 0px) + 12px, 16px)',
        paddingRight: 'max(env(safe-area-inset-right, 0px) + 12px, 16px)'
      }}
      onClick={onClose}
    >
      <div
        className={`w-full max-w-2xl max-h-[88vh] flex flex-col rounded-3xl border shadow-xl overflow-hidden my-auto hardware-panel ${
          theme?.isLight
            ? 'bg-[#eae6dd] border-[#cfcac0] text-[#121214]'
            : 'bg-[#131316] border-[#222227] text-[#f4f4f6]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dialog Header Banner */}
        <div className="relative p-5 bg-[#18181c] flex-none border-b border-black/40">
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

            <div className={`flex items-center rounded-xl p-0.5 shadow-sm border ${
              theme?.isLight
                ? 'bg-stone-200 border-amber-600/40 text-stone-900'
                : 'bg-zinc-900/95 border-amber-500/30 text-amber-300'
            }`}>
              <button
                onClick={() => exportBatterySave(targetGame, saveFormat)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 ${
                  theme?.isLight ? 'hover:bg-amber-500/20 text-amber-800' : 'hover:bg-amber-500/15 text-amber-300'
                }`}
                title={
                  saveFormat === 'sav'
                    ? 'Download raw battery RAM (.sav) for cartridge flashers (GB Operator / FlashGBX)'
                    : 'Download libretro battery RAM (.srm) for RetroArch'
                }
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Battery Save</span>
              </button>
              <div className={`h-4 w-px mx-0.5 ${theme?.isLight ? 'bg-stone-300' : 'bg-zinc-800'}`} />
              <div className="flex items-center gap-0.5 pr-0.5" role="group" aria-label="Battery save format">
                <button
                  type="button"
                  onClick={() => setSaveFormat('sav')}
                  className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition ${
                    saveFormat === 'sav'
                      ? 'bg-amber-400 text-zinc-950'
                      : theme?.isLight
                      ? 'text-stone-600 hover:text-stone-900'
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
                      : theme?.isLight
                      ? 'text-stone-600 hover:text-stone-900'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="RetroArch format (.srm)"
                >
                  .SRM
                </button>
              </div>
            </div>

            {/* Custom Cartridge Artwork (supports ROM hacks that have no online boxart) */}
            <label
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold tactile-btn transition cursor-pointer ${
                theme?.isLight
                  ? 'bg-stone-200/90 hover:bg-stone-300 text-stone-700 border-stone-300'
                  : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border-zinc-800 hover:border-zinc-600'
              }`}
              title={targetGame.customCover ? 'Replace custom artwork' : 'Add custom artwork (great for ROM hacks)'}
            >
              <ImagePlus className="w-3.5 h-3.5" />
              <span>Artwork</span>
              <input
                ref={artInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleArtworkPick}
              />
            </label>
            {targetGame.customCover && (
              <button
                onClick={() => onChangeArtwork?.(targetGame.id, null)}
                className={`p-2 rounded-xl border tactile-btn transition ${
                  theme?.isLight
                    ? 'bg-stone-200/90 hover:bg-stone-300 text-stone-600 border-stone-300'
                    : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-white border-zinc-800'
                }`}
                title="Reset to online artwork"
                aria-label="Reset artwork"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => setConfirmDeleteRom(true)}
              className={`p-2 rounded-xl border tactile-btn transition ml-auto ${
                theme?.isLight
                  ? 'bg-stone-200/90 hover:bg-rose-100 text-stone-600 hover:text-rose-600 border-stone-300 hover:border-rose-300'
                  : 'bg-zinc-900/90 hover:bg-rose-900/30 text-zinc-400 hover:text-rose-400 border-zinc-800 hover:border-rose-500/40'
              }`}
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

        {/* Per-Game Save State Slots Grid (grows as slots fill up) */}
        <div className="p-5 space-y-3 flex-1 overflow-y-auto modal-scroll">
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-sm font-extrabold flex items-center gap-2 ${
                theme?.isLight ? 'text-zinc-900' : 'text-zinc-100'
              }`}>
                <Layers className="w-4 h-4 text-emerald-500" />
                <span>State Slots</span>
              </h3>
              <p className={`text-[11px] ${theme?.isLight ? 'text-stone-600' : 'text-zinc-400'}`}>
                {initialMode === 'save'
                  ? 'Pick a slot to save into. Filled slots can be overwritten.'
                  : initialMode === 'load'
                    ? 'Pick a saved state to resume.'
                    : 'Each game has its own dedicated save state slots. Switch or resume anytime.'}
              </p>
              <p className={`text-[10px] mt-0.5 ${theme?.isLight ? 'text-stone-500' : 'text-zinc-500'}`}>
                When all slots are full, a new empty slot is added automatically.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {gameSlots.map((slotObj) => {
              const customName = slotNames[slotObj.slot];
              const displayName = customName || slotObj.label;
              return (
              <div
                key={slotObj.slot}
                className={`rounded-2xl border p-3 flex flex-col justify-between gap-2.5 transition ${
                  slotObj.empty
                    ? theme?.isLight
                      ? 'bg-stone-200/60 border-stone-300'
                      : 'bg-zinc-900/40 border-zinc-800/80'
                    : theme?.isLight
                      ? 'bg-stone-100 border-emerald-600/40 shadow-sm'
                      : 'bg-zinc-900/95 border-emerald-500/40 shadow-md'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Thumbnail Preview */}
                  <div className={`w-20 h-16 rounded-xl border overflow-hidden shrink-0 flex items-center justify-center ${
                    theme?.isLight ? 'bg-stone-300 border-stone-400/50' : 'bg-zinc-950 border-zinc-800'
                  }`}>
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
                        <span className={`text-[10px] font-mono font-bold ${
                          theme?.isLight ? 'text-stone-500' : 'text-zinc-400'
                        }`}>EMPTY</span>
                      );
                    })()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-black text-emerald-500 font-mono shrink-0">
                        SLOT #{slotObj.slot}
                      </span>
                      <button
                        onClick={() => {
                          setEditingSlot(slotObj.slot);
                          setEditValue(customName || '');
                        }}
                        className={`p-1 rounded-md transition shrink-0 ${
                          theme?.isLight
                            ? 'text-stone-500 hover:text-stone-800 hover:bg-stone-200'
                            : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800'
                        }`}
                        title="Rename slot"
                        aria-label={`Rename slot ${slotObj.slot}`}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                    {editingSlot === slotObj.slot ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <input
                          type="text"
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === 'Escape') commitRename(slotObj.slot);
                          }}
                          onBlur={() => commitRename(slotObj.slot)}
                          placeholder="Slot name"
                          aria-label={`Name for slot ${slotObj.slot}`}
                          className={`flex-1 min-w-0 px-2 py-0.5 rounded-md border text-[11px] font-bold outline-none focus:border-emerald-500 ${
                            theme?.isLight
                              ? 'bg-white border-stone-300 text-zinc-900'
                              : 'bg-zinc-950 border-zinc-700 text-zinc-100'
                          }`}
                        />
                      </div>
                    ) : (
                      <p className={`text-xs font-bold truncate mt-0.5 ${
                        theme?.isLight ? 'text-zinc-900' : 'text-zinc-100'
                      }`}>
                        {displayName}
                      </p>
                    )}
                    {!slotObj.empty && !customName && (slotObj.score > 0 || slotObj.frame > 0) && (
                      <p className={`text-[10px] font-mono ${
                        theme?.isLight ? 'text-stone-500' : 'text-zinc-400'
                      }`}>
                        Score: {slotObj.score} • Frame: {slotObj.frame}
                      </p>
                    )}
                  </div>
                </div>

                {/* Slot Action Buttons */}
                <div className={`flex items-center gap-1.5 pt-1 border-t ${
                  theme?.isLight ? 'border-stone-300' : 'border-zinc-800/80'
                }`}>
                  {/* Load & Play Slot */}
                  <button
                    disabled={slotObj.empty}
                    onClick={() => {
                      if (currentView === 'ingame') {
                        setConfirmAction({ type: 'load', slot: slotObj.slot });
                      } else {
                        loadStateFromGameSlot(targetGame, slotObj.slot);
                      }
                    }}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition tactile-btn ${
                      slotObj.empty
                        ? theme?.isLight
                          ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                          : 'bg-zinc-800/50 text-zinc-600 cursor-not-allowed'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
                    }`}
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>{currentView === 'home' ? 'Play State' : 'Load'}</span>
                  </button>

                  {/* Save Current Frame into Slot (When in-game on this game) */}
                  {currentView === 'ingame' && activeGame?.id === targetGame.id && (
                    <button
                      onClick={() => {
                        if (slotObj.empty) {
                          saveStateToGameSlot(targetGame, slotObj.slot);
                        } else {
                          setConfirmAction({ type: 'overwrite', slot: slotObj.slot });
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold transition tactile-btn"
                    >
                      <Camera className="w-3 h-3" />
                      <span>{slotObj.empty ? 'Save Here' : 'Overwrite'}</span>
                    </button>
                  )}

                  {/* Clear Slot */}
                  {!slotObj.empty && (
                    <button
                      onClick={() => {
                        setConfirmDeleteSlot(slotObj.slot);
                        setDeleteTypeText('');
                      }}
                      className={`p-1.5 rounded-lg tactile-btn transition ${
                        theme?.isLight
                          ? 'bg-stone-200 hover:bg-rose-100 text-rose-600 border border-stone-300'
                          : 'bg-zinc-800 hover:bg-rose-500/30 text-rose-400'
                      }`}
                      title="Delete slot"
                      aria-label="Delete slot"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {/* Load / Overwrite Confirmation Dialog */}
        {confirmAction && (
          <div className="absolute inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl bg-zinc-950 border border-zinc-700 shadow-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 shrink-0 ${confirmAction.type === 'load' ? 'text-cyan-400' : 'text-amber-400'}`} />
                <span className="text-xs font-black text-white">
                  {confirmAction.type === 'load' ? 'Load State Slot' : 'Overwrite State Slot'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-snug">
                {confirmAction.type === 'load'
                  ? 'Load Slot #' + confirmAction.slot + '? Your current unsaved progress will be lost.'
                  : 'Overwrite Slot #' + confirmAction.slot + ' with the current frame? The old save will be replaced.'}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => {
                    const { type, slot: n } = confirmAction;
                    setConfirmAction(null);
                    if (type === 'load') loadStateFromGameSlot(targetGame, n);
                    else saveStateToGameSlot(targetGame, n);
                  }}
                  className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs tactile-btn"
                >
                  {confirmAction.type === 'load' ? 'Load State' : 'Overwrite'}
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-black text-xs tactile-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Slot: type-to-confirm Dialog */}
        {confirmDeleteSlot !== null && (
          <div className="absolute inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl bg-zinc-950 border border-rose-500/50 shadow-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span className="text-xs font-black text-white">Delete State Slot</span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-snug">
                Permanently delete the save in Slot #{confirmDeleteSlot}? This cannot be undone. Type <span className="font-mono font-bold text-rose-300">overwrite</span> to confirm.
              </p>
              <input
                type="text"
                autoFocus
                value={deleteTypeText}
                onChange={(e) => setDeleteTypeText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && deleteTypeText.trim().toLowerCase() === 'overwrite') {
                    const n = confirmDeleteSlot;
                    setConfirmDeleteSlot(null);
                    deleteGameSlot(targetGame.id, n);
                  }
                }}
                placeholder='Type "overwrite" to confirm'
                aria-label='Type "overwrite" to confirm slot deletion'
                className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-bold text-zinc-100 outline-none focus:border-rose-500"
              />
              <div className="flex items-center gap-2 pt-1">
                <button
                  disabled={deleteTypeText.trim().toLowerCase() !== 'overwrite'}
                  onClick={() => {
                    const n = confirmDeleteSlot;
                    setConfirmDeleteSlot(null);
                    deleteGameSlot(targetGame.id, n);
                  }}
                  className="flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs tactile-btn"
                >
                  Delete Slot
                </button>
                <button
                  onClick={() => setConfirmDeleteSlot(null)}
                  className="flex-1 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-black text-xs tactile-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
