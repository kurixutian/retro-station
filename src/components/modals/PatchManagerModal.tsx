import React, { useState, useEffect, useRef } from 'react';
import {
  Wand2,
  X,
  Upload,
  Download,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  FileCode2,
} from 'lucide-react';
import { Game, Theme } from '../../types';
import { ModalShell } from '../common/ModalShell';
import { getGameDisplayTitle } from '../../constants/cores';
import { idbGet } from '../../services/storage/idb';
import { saveFileToDevice } from '../../services/storage/saveSlots';
import { applyRomPatch, buildPatchedRomFileName } from '../../services/bpsPatcher';

interface PatchManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  games: Game[];
  initialGameId?: string | null;
  theme?: Theme;
  onImportPatchedRom: (file: File) => Promise<void>;
  onUpdateExistingGameRom?: (gameId: string, file: File) => Promise<void>;
  showToast: (msg: string) => void;
}

async function readStoredRomBytes(raw: unknown): Promise<Uint8Array | null> {
  if (!raw) return null;
  if (raw instanceof Uint8Array) return raw;
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  if (typeof Blob !== 'undefined' && raw instanceof Blob) {
    return new Uint8Array(await raw.arrayBuffer());
  }
  return null;
}

export const PatchManagerModal: React.FC<PatchManagerModalProps> = ({
  isOpen,
  onClose,
  games,
  initialGameId = null,
  theme,
  onImportPatchedRom,
  onUpdateExistingGameRom,
  showToast,
}) => {
  const libraryRoms = games.filter((g) => g.real);

  const [romSourceMode, setRomSourceMode] = useState<'library' | 'file'>('library');
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [updateTargetGameId, setUpdateTargetGameId] = useState<string>('');
  const [uploadedRomFile, setUploadedRomFile] = useState<File | null>(null);
  const [patchFile, setPatchFile] = useState<File | null>(null);

  const [isPatching, setIsPatching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [patchedResult, setPatchedResult] = useState<{
    bytes: Uint8Array;
    fileName: string;
    crc32: string;
    metadata: string;
  } | null>(null);
  const [outputFileName, setOutputFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importedToLibrary, setImportedToLibrary] = useState(false);
  const [isUpdatingExisting, setIsUpdatingExisting] = useState(false);
  const [updatedExisting, setUpdatedExisting] = useState(false);

  const romInputRef = useRef<HTMLInputElement | null>(null);
  const patchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setPatchedResult(null);
    setImportedToLibrary(false);
    setUpdatedExisting(false);
    setUpdatedExisting(false);
    if (initialGameId && libraryRoms.some((g) => g.id === initialGameId)) {
      setRomSourceMode('library');
      setSelectedGameId(initialGameId);
      setUpdateTargetGameId(initialGameId);
    } else if (libraryRoms.length > 0 && !selectedGameId) {
      setRomSourceMode('library');
      setSelectedGameId(libraryRoms[0].id);
      setUpdateTargetGameId(libraryRoms[0].id);
    } else if (libraryRoms.length === 0) {
      setRomSourceMode('file');
    } else if (libraryRoms.length > 0 && !updateTargetGameId) {
      setUpdateTargetGameId(libraryRoms[0].id);
    }
  }, [isOpen, initialGameId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isLight = Boolean(theme?.isLight);
  const selectedLibraryGame = libraryRoms.find((g) => g.id === selectedGameId) || null;

  const handlePatch = async () => {
    setErrorMsg(null);
    setPatchedResult(null);
    setImportedToLibrary(false);
    setUpdatedExisting(false);

    if (!patchFile) {
      setErrorMsg('Please select a .bps or .ups patch file.');
      return;
    }

    setIsPatching(true);
    try {
      let sourceBytes: Uint8Array | null = null;
      let baseRomName = 'patched.gba';

      if (romSourceMode === 'library') {
        if (!selectedLibraryGame) {
          throw new Error('Please select a base ROM from your library or upload one.');
        }
        const stored = await idbGet(selectedLibraryGame.id);
        sourceBytes = await readStoredRomBytes(stored);
        if (!sourceBytes) {
          throw new Error(
            `"${getGameDisplayTitle(selectedLibraryGame)}" is not cached locally on this device yet. Upload the ROM file directly or launch it once to download.`
          );
        }
        baseRomName = selectedLibraryGame.fileName || `${getGameDisplayTitle(selectedLibraryGame)}.gba`;
      } else {
        if (!uploadedRomFile) {
          throw new Error('Please choose a base ROM file to patch.');
        }
        sourceBytes = new Uint8Array(await uploadedRomFile.arrayBuffer());
        baseRomName = uploadedRomFile.name;
      }

      const patchBytes = new Uint8Array(await patchFile.arrayBuffer());
      const result = applyRomPatch(sourceBytes, patchBytes);
      const suggestedName = buildPatchedRomFileName(baseRomName, patchFile.name);

      setOutputFileName(suggestedName);
      setPatchedResult({
        bytes: result.patched,
        fileName: suggestedName,
        crc32: result.targetCrc32,
        metadata: result.metadata,
      });
      showToast('ROM patched successfully');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to apply ROM patch.');
    } finally {
      setIsPatching(false);
    }
  };

  const buildPatchedFile = (): File | null => {
    if (!patchedResult) return null;
    const cleanName = outputFileName.trim() || patchedResult.fileName;
    const copy = new Uint8Array(patchedResult.bytes.length);
    copy.set(patchedResult.bytes);
    return new File([copy.buffer], cleanName, { type: 'application/octet-stream' });
  };

  const handleDownloadPatched = async (chooseLocation = false) => {
    const file = buildPatchedFile();
    if (!file) return;
    try {
      const res = await saveFileToDevice(file, file.name, 'application/octet-stream', chooseLocation);
      if (res.cancelled) return;
      showToast(res.location ? `Saved to ${res.location}` : `Downloaded ${file.name}`);
    } catch (err: any) {
      showToast(`Save failed: ${err?.message || 'Could not write file'}`);
    }
  };

  const handleImportPatched = async () => {
    const file = buildPatchedFile();
    if (!file) return;
    setIsImporting(true);
    try {
      await onImportPatchedRom(file);
      setImportedToLibrary(true);
    } finally {
      setIsImporting(false);
    }
  };

  const handleUpdateExisting = async () => {
    const file = buildPatchedFile();
    if (!file || !onUpdateExistingGameRom || !updateTargetGameId) return;
    setIsUpdatingExisting(true);
    try {
      await onUpdateExistingGameRom(updateTargetGameId, file);
      setUpdatedExisting(true);
    } finally {
      setIsUpdatingExisting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="patch-manager-title"
      closeOnScrim
      panelClassName={`w-full max-w-lg max-h-[88vh] shadow-xl ${
        isLight
          ? 'bg-[#eae6dd] border-[#cfcac0] text-[#121214]'
          : 'bg-[#131316] border-[#222227] text-[#f4f4f6]'
      }`}
    >
      {/* Header */}
      <div
        className={`px-5 py-4 border-b flex items-center justify-between gap-3 ${
          isLight ? 'border-[#cfcac0] bg-[#dedad0]' : 'border-[#222227] bg-[#18181c]'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl ${theme?.accentBg || 'bg-emerald-500 text-zinc-950'}`}>
            <Wand2 className="w-4 h-4" />
          </div>
          <div>
            <h2 id="patch-manager-title" className="text-base font-black leading-tight">
              ROM Patcher (BPS / UPS)
            </h2>
            <p className={`text-[11px] ${isLight ? 'text-stone-600' : 'text-zinc-400'}`}>
              Patch a ROM in-browser without overwriting your original game.
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className={`p-2 rounded-full border tactile-btn transition ${
            isLight
              ? 'bg-stone-200 hover:bg-stone-300 border-stone-300 text-stone-700'
              : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-300'
          }`}
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4 overflow-y-auto modal-scroll">
        {/* Step 1: Base ROM */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-black uppercase tracking-wider opacity-80">
              1. Base ROM
            </label>
            <div className="flex rounded-lg overflow-hidden border border-black/15 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => {
                  setRomSourceMode('library');
                  setPatchedResult(null);
                  setErrorMsg(null);
                }}
                disabled={libraryRoms.length === 0}
                className={`px-2.5 py-1 transition ${
                  romSourceMode === 'library'
                    ? theme?.accentBg || 'bg-emerald-500 text-zinc-950'
                    : isLight
                      ? 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white'
                } disabled:opacity-40`}
              >
                From Library
              </button>
              <button
                type="button"
                onClick={() => {
                  setRomSourceMode('file');
                  setPatchedResult(null);
                  setErrorMsg(null);
                }}
                className={`px-2.5 py-1 transition ${
                  romSourceMode === 'file'
                    ? theme?.accentBg || 'bg-emerald-500 text-zinc-950'
                    : isLight
                      ? 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white'
                }`}
              >
                Upload File
              </button>
            </div>
          </div>

          {romSourceMode === 'library' ? (
            <div className="relative">
              <HardDrive className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none" />
              <select
                aria-label="Select base ROM from library"
                value={selectedGameId}
                onChange={(e) => {
                  setSelectedGameId(e.target.value);
                  setPatchedResult(null);
                  setErrorMsg(null);
                }}
                className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-xs font-bold outline-none ${
                  isLight
                    ? 'bg-white border-stone-300 text-zinc-900'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-100'
                }`}
              >
                {libraryRoms.map((g) => (
                  <option key={g.id} value={g.id}>
                    [{g.shortSystem}] {getGameDisplayTitle(g)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <input
                ref={romInputRef}
                type="file"
                accept="*/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  e.target.value = '';
                  setUploadedRomFile(file);
                  setPatchedResult(null);
                  setErrorMsg(null);
                }}
              />
              <button
                type="button"
                onClick={() => romInputRef.current?.click()}
                className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-dashed text-xs font-bold transition ${
                  isLight
                    ? 'bg-white/70 hover:bg-white border-stone-400 text-stone-800'
                    : 'bg-zinc-900/70 hover:bg-zinc-900 border-zinc-700 text-zinc-200'
                }`}
              >
                <span className="truncate">
                  {uploadedRomFile ? uploadedRomFile.name : 'Choose base ROM file (.gba, .gbc, .gb...)'}
                </span>
                <Upload className="w-4 h-4 shrink-0 opacity-70" />
              </button>
            </div>
          )}
        </div>

        {/* Step 2: Patch File */}
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-wider opacity-80 block">
            2. Patch File (.bps / .ups)
          </label>
          <input
            ref={patchInputRef}
            type="file"
            accept="*/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              e.target.value = '';
              setPatchFile(file);
              setPatchedResult(null);
              setErrorMsg(null);
            }}
          />
          <button
            type="button"
            onClick={() => patchInputRef.current?.click()}
            className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-dashed text-xs font-bold transition ${
              isLight
                ? 'bg-white/70 hover:bg-white border-stone-400 text-stone-800'
                : 'bg-zinc-900/70 hover:bg-zinc-900 border-zinc-700 text-zinc-200'
            }`}
          >
            <span className="truncate flex items-center gap-2">
              <FileCode2 className="w-4 h-4 shrink-0 opacity-70" />
              <span>{patchFile ? patchFile.name : 'Choose .bps or .ups patch file'}</span>
            </span>
            <Upload className="w-4 h-4 shrink-0 opacity-70" />
          </button>
        </div>

        {/* Apply Patch Button */}
        <button
          type="button"
          onClick={handlePatch}
          disabled={isPatching || !patchFile}
          className={`w-full py-2.5 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md tactile-btn transition disabled:opacity-50 ${
            theme?.accentBg || 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
          }`}
        >
          <Wand2 className="w-4 h-4" />
          <span>{isPatching ? 'Applying Patch...' : 'Patch ROM'}</span>
        </button>

        {/* Error State */}
        {errorMsg && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-rose-950/90 border border-rose-500/60 text-rose-200 text-xs flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-snug">{errorMsg}</span>
          </div>
        )}

        {/* Success State: Download or Import */}
        {patchedResult && (
          <div
            className={`p-3.5 rounded-2xl border space-y-3 ${
              isLight
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-100'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold">Patched ROM Ready</p>
                <div className="flex items-center gap-2 text-[11px] font-mono opacity-80">
                  <span>{(patchedResult.bytes.length / (1024 * 1024)).toFixed(2)} MB</span>
                  <span>CRC {patchedResult.crc32}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="patched-rom-filename" className="text-[11px] font-bold opacity-80 block">
                Patched Filename
              </label>
              <input
                id="patched-rom-filename"
                type="text"
                value={outputFileName}
                onChange={(e) => setOutputFileName(e.target.value)}
                className={`w-full px-3 py-1.5 rounded-lg border text-xs font-bold outline-none ${
                  isLight
                    ? 'bg-white border-emerald-300 text-zinc-900'
                    : 'bg-zinc-950 border-zinc-700 text-zinc-100'
                }`}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => handleDownloadPatched(false)}
                className={`flex-1 py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 tactile-btn transition ${
                  isLight
                    ? 'bg-white hover:bg-stone-100 text-zinc-900 border border-stone-300'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadPatched(true)}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 tactile-btn transition ${
                  isLight
                    ? 'bg-stone-200 hover:bg-stone-300 text-zinc-900 border border-stone-300'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                }`}
              >
                <span>Choose Folder…</span>
              </button>

              <button
                type="button"
                onClick={handleImportPatched}
                disabled={isImporting || importedToLibrary}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 tactile-btn transition disabled:opacity-60 ${
                  theme?.accentBg || 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>
                  {importedToLibrary
                    ? 'Added as New Game'
                    : isImporting
                      ? 'Adding...'
                      : 'Add as New Game'}
                </span>
              </button>
            </div>

            {onUpdateExistingGameRom && libraryRoms.length > 0 && (
              <div
                className={`pt-2.5 border-t space-y-2 ${
                  isLight ? 'border-emerald-300/80' : 'border-emerald-500/25'
                }`}
              >
                <label
                  htmlFor="update-target-game"
                  className="text-[11px] font-black uppercase tracking-wider opacity-85 block"
                >
                  Or Update Existing Game (Keep Saves & Art)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    id="update-target-game"
                    value={updateTargetGameId}
                    onChange={(e) => {
                      setUpdateTargetGameId(e.target.value);
                      setUpdatedExisting(false);
                    }}
                    className={`flex-1 min-w-0 px-2.5 py-2 rounded-xl border text-xs font-bold outline-none ${
                      isLight
                        ? 'bg-white border-emerald-300 text-zinc-900'
                        : 'bg-zinc-950 border-zinc-700 text-zinc-100'
                    }`}
                  >
                    {libraryRoms.map((g) => (
                      <option key={g.id} value={g.id}>
                        [{g.shortSystem}] {getGameDisplayTitle(g)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleUpdateExisting}
                    disabled={isUpdatingExisting || updatedExisting || !updateTargetGameId}
                    className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-xs whitespace-nowrap tactile-btn transition disabled:opacity-60"
                  >
                    {updatedExisting
                      ? 'Updated!'
                      : isUpdatingExisting
                        ? 'Updating...'
                        : 'Update & Keep Saves'}
                  </button>
                </div>
                <p className="text-[10px] opacity-75 leading-snug">
                  Replaces only the ROM binary for the selected game while keeping all in-game saves (.sav), save slots, custom name, and artwork intact.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  );
};
