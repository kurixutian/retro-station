import React, { useState, useEffect, useRef } from 'react';
import { Play, Trash2, Layers, Camera, X, AlertTriangle, Pencil, ImagePlus, RotateCcw, Wand2, Sparkles, Search, ExternalLink, MoreHorizontal } from 'lucide-react';
import { Game, SaveSlot, Theme } from '../../types';
import { GameCoverImage } from '../common/GameCoverImage';
import { ModalShell } from '../common/ModalShell';
import { getGameDisplayTitle } from '../../constants/cores';
import { createEmptySlotsForGame } from '../../services/storage/saveSlots';
import { autoFetchAndCacheBoxart, BoxartSearchCandidate, searchOnlineBoxartCandidates } from '../../services/boxartResolver';

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
  onRenameGame?: (gameId: string, newTitle: string) => void;
  initialMode?: 'save' | 'load' | null;
  onChangeArtwork?: (gameId: string, dataUrl: string | null) => void;
  onOpenPatcher?: (game: Game) => void;
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
  onRenameGame,
  initialMode = null,
  onChangeArtwork,
  onOpenPatcher,
}) => {
  const [confirmDeleteRom, setConfirmDeleteRom] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'load' | 'overwrite'; slot: number } | null>(null);
  const [confirmDeleteSlot, setConfirmDeleteSlot] = useState<number | null>(null);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingGameTitle, setEditingGameTitle] = useState(false);
  const [gameTitleEditValue, setGameTitleEditValue] = useState('');
  const [isFetchingArt, setIsFetchingArt] = useState(false);
  const [artRefreshKey, setArtRefreshKey] = useState(0);
  const [artPickerOpen, setArtPickerOpen] = useState(false);
  const [artSearchQuery, setArtSearchQuery] = useState('');
  const [artSearchResults, setArtSearchResults] = useState<BoxartSearchCandidate[]>([]);
  const [artSearching, setArtSearching] = useState(false);
  const [artCustomUrl, setArtCustomUrl] = useState('');
  const [manageMenuOpen, setManageMenuOpen] = useState(false);
  const artInputRef = useRef<HTMLInputElement | null>(null);
  const manageMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!manageMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (manageMenuRef.current && !manageMenuRef.current.contains(e.target as Node)) {
        setManageMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [manageMenuOpen]);

  const runArtSearch = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || !targetGame) return;
    setArtSearching(true);
    try {
      const results = await searchOnlineBoxartCandidates(trimmed, targetGame);
      setArtSearchResults(results);
    } finally {
      setArtSearching(false);
    }
  };

  const handleAutoFetchArtwork = async () => {
    if (!targetGame || isFetchingArt) return;
    setIsFetchingArt(true);
    try {
      const url = await autoFetchAndCacheBoxart(targetGame, true);
      if (url) {
        if (targetGame.customCover) onChangeArtwork?.(targetGame.id, null);
        setArtRefreshKey((k) => k + 1);
      } else {
        const defaultQuery = getGameDisplayTitle(targetGame);
        setArtSearchQuery(defaultQuery);
        setArtSearchResults([]);
        setArtCustomUrl('');
        setArtPickerOpen(true);
        runArtSearch(defaultQuery);
      }
    } finally {
      setIsFetchingArt(false);
    }
  };

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
      setEditingSlot(null);
      setEditValue('');
      setEditingGameTitle(false);
      setGameTitleEditValue('');
      setArtPickerOpen(false);
      setArtSearchResults([]);
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

  const commitGameTitleRename = () => {
    const trimmed = gameTitleEditValue.trim();
    if (trimmed && onRenameGame) {
      onRenameGame(targetGame.id, trimmed);
    }
    setEditingGameTitle(false);
    setGameTitleEditValue('');
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="save-slots-title"
      closeOnScrim
      panelClassName={`w-full max-w-2xl max-h-[88vh] shadow-xl ${
        theme?.isLight
          ? 'bg-[#eae6dd] border-[#cfcac0] text-[#121214]'
          : 'bg-[#131316] border-[#222227] text-[#f4f4f6]'
      }`}
    >
      {/* Dialog Header Banner */}
      <div className="relative p-5 bg-[#18181c] flex-none border-b border-black/40">
        <div className="absolute inset-0">
          <GameCoverImage key={`${targetGame.id}-${artRefreshKey}`} game={targetGame} imgClassName="opacity-65" />
        </div>
        <div className="absolute inset-0 bg-zinc-950/70" />
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-black/60 text-amber-300 border border-amber-400/30">
                {targetGame.system}
              </span>
            </div>
            <h2 id="save-slots-title" className="text-xl sm:text-2xl font-black text-white">{getGameDisplayTitle(targetGame)}</h2>
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
        <div className="relative z-10 mt-3.5 flex flex-wrap items-center justify-between gap-2">
          {currentView === 'home' && (
            <button
              onClick={() => launchGame(targetGame)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-xs font-bold shadow-md tactile-btn transition"
              title={`Play ${getGameDisplayTitle(targetGame)}`}
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Play</span>
            </button>
          )}

          <div className="relative flex items-center gap-1.5 ml-auto" ref={manageMenuRef}>
            <input
              ref={artInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleArtworkPick}
            />

            <button
              type="button"
              onClick={() => setManageMenuOpen((o) => !o)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold tactile-btn transition ${
                theme?.isLight
                  ? 'bg-stone-200/90 hover:bg-stone-300 text-stone-800 border-stone-300'
                  : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 hover:text-white border-zinc-800 hover:border-zinc-600'
              }`}
              aria-haspopup="menu"
              aria-expanded={manageMenuOpen}
              aria-label="Manage cartridge"
            >
              <MoreHorizontal className="w-4 h-4" />
              <span>Manage</span>
            </button>

            {manageMenuOpen && (
              <div
                role="menu"
                className={`absolute right-0 top-[calc(100%+8px)] z-30 w-56 rounded-2xl border shadow-xl hardware-panel p-1.5 ${
                  theme?.isLight
                    ? 'border-[#cfcac0] bg-[#eae6dd] text-[#121214]'
                    : 'border-[#222227] bg-[#131316] text-[#f4f4f6]'
                }`}
              >
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setManageMenuOpen(false);
                    handleAutoFetchArtwork();
                  }}
                  disabled={isFetchingArt}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition text-left disabled:opacity-50 ${
                    theme?.isLight ? 'hover:bg-[#dedad0]' : 'hover:bg-[#1c1c22]'
                  }`}
                >
                  <Sparkles className={`w-4 h-4 shrink-0 ${isFetchingArt ? 'animate-pulse text-amber-400' : ''}`} />
                  <span>Auto-fetch Artwork</span>
                </button>

                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setManageMenuOpen(false);
                    artInputRef.current?.click();
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition text-left ${
                    theme?.isLight ? 'hover:bg-[#dedad0]' : 'hover:bg-[#1c1c22]'
                  }`}
                >
                  <ImagePlus className="w-4 h-4 shrink-0" />
                  <span>{targetGame.customCover ? 'Replace Custom Artwork' : 'Custom Artwork'}</span>
                </button>

                {targetGame.customCover && (
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setManageMenuOpen(false);
                      onChangeArtwork?.(targetGame.id, null);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition text-left ${
                      theme?.isLight ? 'hover:bg-[#dedad0]' : 'hover:bg-[#1c1c22]'
                    }`}
                  >
                    <RotateCcw className="w-4 h-4 shrink-0" />
                    <span>Reset Artwork</span>
                  </button>
                )}

                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setManageMenuOpen(false);
                    setGameTitleEditValue(targetGame.customTitle || targetGame.title || '');
                    setEditingGameTitle(true);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition text-left ${
                    theme?.isLight ? 'hover:bg-[#dedad0]' : 'hover:bg-[#1c1c22]'
                  }`}
                >
                  <Pencil className="w-4 h-4 shrink-0" />
                  <span>Rename Cartridge</span>
                </button>

                {onOpenPatcher && targetGame.real && (
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setManageMenuOpen(false);
                      onOpenPatcher(targetGame);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition text-left ${
                      theme?.isLight ? 'hover:bg-[#dedad0]' : 'hover:bg-[#1c1c22]'
                    }`}
                  >
                    <Wand2 className="w-4 h-4 shrink-0" />
                    <span>Patch ROM (.bps / .ups)</span>
                  </button>
                )}

                <div className={`my-1 border-t ${theme?.isLight ? 'border-[#d2cdc3]' : 'border-[#222227]'}`} />

                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setManageMenuOpen(false);
                    setConfirmDeleteRom(true);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition text-left ${
                    theme?.isLight
                      ? 'text-rose-600 hover:bg-rose-100'
                      : 'text-rose-400 hover:bg-rose-950/50'
                  }`}
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span>Delete ROM</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* In-Modal Destructive ROM Delete Confirmation Banner */}
        {confirmDeleteRom && (
          <div className="relative z-20 mt-3 p-3.5 rounded-xl bg-rose-950/90 border border-rose-500/60 shadow-xl space-y-2.5">
            <div className="flex items-center gap-2 text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span className="text-xs font-black">Confirm Cartridge Deletion</span>
            </div>
            <p className="text-[11px] text-rose-200/90 leading-snug">
              Permanently delete <strong className="text-white">"{getGameDisplayTitle(targetGame)}"</strong> from your local library? This will delete the ROM and cannot be undone.
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

      {/* Per-Game Save State Slots Grid */}
      <div className="p-4 sm:p-5 space-y-3 flex-1 overflow-y-auto modal-scroll">
        <div className="flex items-center justify-between gap-2">
          <h3 className={`text-sm font-bold flex items-center gap-2 ${
            theme?.isLight ? 'text-zinc-900' : 'text-zinc-100'
          }`}>
            <Layers className="w-4 h-4 text-emerald-500" />
            <span>State Slots</span>
          </h3>
          {(initialMode === 'save' || initialMode === 'load') && (
            <span className={`text-[11px] ${theme?.isLight ? 'text-stone-600' : 'text-zinc-400'}`}>
              {initialMode === 'save' ? 'Pick a slot to save' : 'Pick a slot to load'}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {gameSlots.map((slotObj) => {
            const customName = slotNames[slotObj.slot];
            const displayName = customName || slotObj.label;
            return (
            <div
              key={slotObj.slot}
              className={`rounded-xl border p-2.5 flex flex-col justify-between gap-2 transition ${
                slotObj.empty
                  ? theme?.isLight
                    ? 'bg-stone-200/60 border-stone-300'
                    : 'bg-zinc-900/40 border-zinc-800/80'
                  : theme?.isLight
                    ? 'bg-stone-100 border-emerald-600/40'
                    : 'bg-zinc-900/90 border-emerald-500/40'
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
                          if (e.key === 'Enter' || e.key === 'Escape') {
                            e.stopPropagation();
                            commitRename(slotObj.slot);
                          }
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
          <div className={`w-full max-w-sm rounded-2xl border shadow-xl p-4 space-y-3 ${
            theme?.isLight ? 'bg-[#dedad0] border-[#cfcac0]' : 'bg-zinc-950 border-zinc-700'
          }`}>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 shrink-0 ${
                confirmAction.type === 'load'
                  ? theme?.isLight ? 'text-cyan-600' : 'text-cyan-400'
                  : theme?.isLight ? 'text-amber-600' : 'text-amber-400'
              }`} />
              <span className={`text-xs font-black ${theme?.isLight ? 'text-zinc-900' : 'text-white'}`}>
                {confirmAction.type === 'load' ? 'Load State Slot' : 'Overwrite State Slot'}
              </span>
            </div>
            <p className={`text-[11px] leading-snug ${theme?.isLight ? 'text-stone-700' : 'text-zinc-300'}`}>
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
                className={`flex-1 py-2 rounded-lg font-black text-xs tactile-btn ${
                  theme?.isLight
                    ? 'bg-stone-300 hover:bg-stone-400/70 text-zinc-900'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Slot Confirmation Dialog */}
      {confirmDeleteSlot !== null && (
        <div className="absolute inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-2xl border shadow-xl p-4 space-y-3 ${
            theme?.isLight ? 'bg-[#dedad0] border-rose-500/50' : 'bg-zinc-950 border-rose-500/50'
          }`}>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 shrink-0 ${theme?.isLight ? 'text-rose-600' : 'text-rose-400'}`} />
              <span className={`text-xs font-black ${theme?.isLight ? 'text-zinc-900' : 'text-white'}`}>Delete State Slot</span>
            </div>
            <p className={`text-[11px] leading-snug ${theme?.isLight ? 'text-stone-700' : 'text-zinc-300'}`}>
              Permanently delete the save in Slot #{confirmDeleteSlot}? This cannot be undone.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  const n = confirmDeleteSlot;
                  setConfirmDeleteSlot(null);
                  deleteGameSlot(targetGame.id, n);
                }}
                className="flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-xs tactile-btn"
              >
                Delete Slot
              </button>
              <button
                onClick={() => setConfirmDeleteSlot(null)}
                className={`flex-1 py-2 rounded-lg font-black text-xs tactile-btn ${
                  theme?.isLight
                    ? 'bg-stone-300 hover:bg-stone-400/70 text-zinc-900'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Game Dialog */}
      {editingGameTitle && (
        <div className="absolute inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-2xl border shadow-xl p-4 space-y-3 ${
            theme?.isLight ? 'bg-[#dedad0] border-[#cfcac0]' : 'bg-zinc-950 border-zinc-700'
          }`}>
            <div className="flex items-center gap-2">
              <Pencil className={`w-4 h-4 shrink-0 ${theme?.isLight ? 'text-stone-700' : 'text-emerald-400'}`} />
              <span className={`text-xs font-black ${theme?.isLight ? 'text-zinc-900' : 'text-white'}`}>Rename Game</span>
            </div>
            <p className={`text-[11px] leading-snug ${theme?.isLight ? 'text-stone-700' : 'text-zinc-300'}`}>
              Enter a new display name for this game. This won't change the filename.
            </p>
            <input
              type="text"
              autoFocus
              value={gameTitleEditValue}
              onChange={(e) => setGameTitleEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitGameTitleRename();
                else if (e.key === 'Escape') {
                  e.stopPropagation();
                  setEditingGameTitle(false);
                  setGameTitleEditValue('');
                }
              }}
              placeholder="Game title"
              aria-label="New game title"
              className={`w-full px-3 py-2 rounded-xl border text-sm font-bold outline-none focus:border-emerald-500 ${
                theme?.isLight
                  ? 'bg-white border-stone-300 text-zinc-900'
                  : 'bg-zinc-950 border-zinc-700 text-zinc-100'
              }`}
            />
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={commitGameTitleRename}
                className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs tactile-btn"
              >
                Rename
              </button>
              <button
                onClick={() => { setEditingGameTitle(false); setGameTitleEditValue(''); }}
                className={`flex-1 py-2 rounded-lg font-black text-xs tactile-btn ${
                  theme?.isLight
                    ? 'bg-stone-300 hover:bg-stone-400/70 text-zinc-900'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Online Box Art Picker Dialog (fallback when Libretro has no exact match) */}
      {artPickerOpen && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4">
          <div className={`w-full max-w-lg max-h-[82vh] rounded-2xl border shadow-xl p-4 flex flex-col gap-3 ${
            theme?.isLight ? 'bg-[#eae6dd] border-[#cfcac0] text-zinc-900' : 'bg-zinc-950 border-zinc-700 text-zinc-100'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-black">Choose Online Box Art</span>
              </div>
              <button
                onClick={() => setArtPickerOpen(false)}
                className="p-1 rounded-lg hover:bg-zinc-800/60 text-zinc-400 hover:text-white"
                aria-label="Close box art picker"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                autoFocus
                value={artSearchQuery}
                onChange={(e) => setArtSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') runArtSearch(artSearchQuery);
                  else if (e.key === 'Escape') {
                    e.stopPropagation();
                    setArtPickerOpen(false);
                  }
                }}
                placeholder="Search box art..."
                aria-label="Search box art query"
                className={`flex-1 min-w-0 px-3 py-1.5 rounded-xl border text-xs font-bold outline-none focus:border-emerald-500 ${
                  theme?.isLight
                    ? 'bg-white border-stone-300 text-zinc-900'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-100'
                }`}
              />
              <button
                onClick={() => runArtSearch(artSearchQuery)}
                disabled={artSearching}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1 tactile-btn disabled:opacity-50"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{artSearching ? '...' : 'Search'}</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto modal-scroll min-h-[140px]">
              {artSearching ? (
                <div className="py-10 text-center text-xs text-zinc-400">
                  Searching Libretro, Wikimedia, Wikipedia & Archive.org...
                </div>
              ) : artSearchResults.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-400 space-y-2">
                  <p>No direct results found for that query.</p>
                  <p className="text-[11px] text-zinc-500">
                    Try shortening to the base game title, or search externally and paste the image URL below.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {artSearchResults.map((item) => (
                    <button
                      key={item.url}
                      onClick={() => {
                        onChangeArtwork?.(targetGame.id, item.url);
                        setArtRefreshKey((k) => k + 1);
                        setArtPickerOpen(false);
                      }}
                      className={`group rounded-xl border p-1.5 text-left transition flex flex-col gap-1.5 ${
                        theme?.isLight
                          ? 'bg-stone-100 hover:border-emerald-600 border-stone-300'
                          : 'bg-zinc-900 hover:border-emerald-500 border-zinc-800'
                      }`}
                    >
                      <div className="aspect-square w-full rounded-lg overflow-hidden bg-black flex items-center justify-center">
                        <img
                          src={item.url}
                          alt={item.label}
                          className="w-full h-full object-contain group-hover:scale-105 transition"
                          onError={(e) => {
                            (e.currentTarget.closest('button') as HTMLElement | null)?.style.setProperty('display', 'none');
                          }}
                        />
                      </div>
                      <div className="px-0.5">
                        <div className="text-[10px] font-bold truncate">{item.label}</div>
                        <div className="text-[9px] font-mono text-emerald-400">{item.source}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-zinc-800/60 space-y-2">
              <div className="flex items-center gap-1.5">
                <input
                  type="url"
                  value={artCustomUrl}
                  onChange={(e) => setArtCustomUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && artCustomUrl.trim()) {
                      onChangeArtwork?.(targetGame.id, artCustomUrl.trim());
                      setArtRefreshKey((k) => k + 1);
                      setArtPickerOpen(false);
                    } else if (e.key === 'Escape') {
                      e.stopPropagation();
                      setArtPickerOpen(false);
                    }
                  }}
                  placeholder="Or paste image URL (https://...)"
                  aria-label="Paste image URL"
                  className={`flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border text-[11px] outline-none focus:border-emerald-500 ${
                    theme?.isLight
                      ? 'bg-white border-stone-300 text-zinc-900'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-100'
                  }`}
                />
                <button
                  disabled={!artCustomUrl.trim()}
                  onClick={() => {
                    const u = artCustomUrl.trim();
                    if (!u) return;
                    onChangeArtwork?.(targetGame.id, u);
                    setArtRefreshKey((k) => k + 1);
                    setArtPickerOpen(false);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[11px] font-black tactile-btn"
                >
                  Use URL
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 text-[10px]">
                <span className="text-zinc-500">External search:</span>
                <div className="flex items-center gap-2">
                  <a
                    href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(artSearchQuery)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-400 hover:underline font-bold"
                  >
                    <span>Google Images</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={`https://gamesdb.launchbox-app.com/games/results?title=${encodeURIComponent(artSearchQuery || getGameDisplayTitle(targetGame))}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-400 hover:underline font-bold"
                  >
                    <span>LaunchBox DB</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </ModalShell>
  );
};