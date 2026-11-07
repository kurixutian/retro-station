// ============================================================================
// Offline Backup - manual "export everything / import a previous export"
// ----------------------------------------------------------------------------
// Independent of the cloud vault: a single JSON file containing cartridges,
// save states (base64), SRAM/RTC (base64), RTC clocks and cover art.
// ROM binaries are intentionally NOT included - they are the user's original
// files and are typically the largest, replaceable assets. The irreplaceable
// progress data is everything else.
// ============================================================================

import { idbGet, idbGetAllKeys, idbPut } from './storage/idb';
import {
  uint8ToBase64,
  base64ToUint8,
  normalizeBinaryData,
  markLocalSaveModified,
  getDeletedGameIds,
} from '../cloudSync';

const BACKUP_VERSION = 1;

export interface BackupFile {
  app: 'retro-station';
  kind: 'backup';
  version: number;
  createdAt: number;
  lists: {
    retro_games?: any[];
    library_games?: any[];
    retro_deleted_games?: string[];
  };
  items: Record<string, string | Uint8Array>;
}

const BACKUP_ITEMS_KEY = 'retro_backup_import_at';

function lastImportAt(): number {
  try {
    return Number(localStorage.getItem(BACKUP_ITEMS_KEY)) || 0;
  } catch (e) {
    return 0;
  }
}

export async function createBackupFile(): Promise<BackupFile> {
  const items: Record<string, string | Uint8Array> = {};

  try {
    const keys = await idbGetAllKeys();
    for (const k of keys) {
      const key = String(k);
      if (
        !(
          key.startsWith('state:') ||
          key.startsWith('srm:') ||
          key.startsWith('rtc:') ||
          key.startsWith('cover:')
        )
      ) {
        continue; // ROMs excluded on purpose
      }
      const val = await idbGet(key);
      if (val == null) continue;

      if (typeof val === 'string') {
        items[key] = val; // cover: data URL string
      } else if (val instanceof Uint8Array) {
        items[key] = uint8ToBase64(val); // srm:/rtc:
      } else if (typeof val === 'object') {
        // state: JSON with embedded binary -> base64'd copy
        const copy = JSON.parse(JSON.stringify(val));
        const emu = normalizeBinaryData(val.emuState);
        if (emu) {
          copy.emuStateBase64 = uint8ToBase64(emu);
          delete copy.emuState;
        }
        if (val.stateData?.emuState) {
          const emu2 = normalizeBinaryData(val.stateData.emuState);
          if (emu2) {
            copy.stateData = { ...copy.stateData, emuStateBase64: uint8ToBase64(emu2) };
            delete copy.stateData.emuState;
          }
        }
        items[key] = uint8ToBase64(new TextEncoder().encode(JSON.stringify(copy)));
      }
    }
  } catch (e) {
    // fallthrough: lists stay intact even if IDB items failed
  }

  let libraryGames: any[] | undefined;
  try {
    const lib = await idbGet('library_games');
    if (Array.isArray(lib)) libraryGames = lib;
  } catch (e) {}

  let retroGames: any[] | undefined;
  try {
    retroGames = JSON.parse(localStorage.getItem('retro_games') || 'null');
  } catch (e) {}

  return {
    app: 'retro-station',
    kind: 'backup',
    version: BACKUP_VERSION,
    createdAt: Date.now(),
    lists: {
      retro_games: Array.isArray(retroGames) ? retroGames : undefined,
      library_games: libraryGames,
      retro_deleted_games: getDeletedGameIds(),
    },
    items,
  };
}

export function downloadBackup(backup: BackupFile): void {
  const json = JSON.stringify(backup);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date(backup.createdAt).toISOString().slice(0, 10);
  link.href = url;
  link.download = `retro-station-backup-${date}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ImportResult {
  ok: boolean;
  error?: string;
  appliedItems: number;
  appliedListItemCount: number;
}

function decodeItemValue(key: string, stored: string): any {
  if (key.startsWith('cover:')) return stored; // data URL string passthrough

  if (key.startsWith('srm:') || key.startsWith('rtc:')) {
    return base64ToUint8(stored);
  }

  if (key.startsWith('state:')) {
    try {
      const obj = JSON.parse(new TextDecoder().decode(base64ToUint8(stored)));
      if (obj.emuStateBase64) {
        obj.emuState = base64ToUint8(obj.emuStateBase64);
        delete obj.emuStateBase64;
      }
      if (obj.stateData?.emuStateBase64) {
        obj.stateData.emuState = base64ToUint8(obj.stateData.emuStateBase64);
        delete obj.stateData.emuStateBase64;
      }
      return obj;
    } catch (e) {
      return null;
    }
  }
  return null;
}

export async function importBackupFile(raw: string): Promise<ImportResult> {
  let backup: BackupFile;
  try {
    backup = JSON.parse(raw);
  } catch (e: any) {
    return { ok: false, error: 'File is not valid JSON', appliedItems: 0, appliedListItemCount: 0 };
  }

  if (!backup || backup.app !== 'retro-station' || backup.kind !== 'backup') {
    return { ok: false, error: 'Not a RetroStation backup file', appliedItems: 0, appliedListItemCount: 0 };
  }
  if (backup.version > BACKUP_VERSION) {
    return { ok: false, error: `Backup version ${backup.version} is newer than this app`, appliedItems: 0, appliedListItemCount: 0 };
  }

  let createdAt = Number(backup.createdAt) || Date.now();
  // Older imports win locally so a stale file cannot overwrite newer saves
  const knownImport = lastImportAt();
  if (createdAt < knownImport) createdAt = knownImport;

  let appliedItems = 0;
  const updatedKeys: string[] = [];

  // Lists: merge (never overwrite a richer local list with a sparse import)
  const backupGames = Array.isArray(backup.lists?.retro_games) ? backup.lists.retro_games : [];
  const backupLib = Array.isArray(backup.lists?.library_games) ? backup.lists.library_games : [];

  let localRetroGames: any[] = [];
  try {
    localRetroGames = JSON.parse(localStorage.getItem('retro_games') || '[]');
  } catch (e) {}

  const mergeLists = (a: any[], b: any[]) => {
    const map = new Map<string, any>();
    const keyOf = (g: any) => (g?.id ? String(g.id) : null);
    for (const g of a) {
      if (!g || !g.id) continue;
      map.set(keyOf(g)!, g);
    }
    for (const g of b) {
      if (!g || !g.id) continue;
      const k = keyOf(g)!;
      if (!map.has(k)) map.set(k, g);
    }
    return Array.from(map.values());
  };

  const mergedRetro = mergeLists(localRetroGames, backupGames);
  localStorage.setItem('retro_games', JSON.stringify(mergedRetro));
  updatedKeys.push('retro_games');

  if (backup.lists?.retro_deleted_games) {
    const merged = Array.from(new Set([...getDeletedGameIds(), ...backup.lists.retro_deleted_games]));
    localStorage.setItem('retro_deleted_games', JSON.stringify(merged));
    updatedKeys.push('retro_deleted_games');
  }

  // Per-item values
  const items = backup.items || {};
  for (const [key, stored] of Object.entries(items)) {
    if (!(key.startsWith('state:') || key.startsWith('srm:') || key.startsWith('rtc:') || key.startsWith('cover:'))) continue;
    if (typeof stored !== 'string') continue;
    const value = decodeItemValue(key, stored);
    if (value == null) continue;
    await idbPut(key, value).catch(() => {});
    appliedItems++;
    updatedKeys.push(key);
  }

  // IDB library mirror
  const idbLib = await idbGet('library_games').catch(() => []);
  const mergedLibRaw = mergeLists(Array.isArray(idbLib) ? idbLib : [], backupLib);
  const mergedLib = mergedLibRaw.filter((g) => g && g.real && g.id !== 'pokemon_gold');
  await idbPut('library_games', mergedLib).catch(() => {});
  updatedKeys.push('library_games');

  try {
    localStorage.setItem(BACKUP_ITEMS_KEY, String(createdAt));
  } catch (e) {}

  // Arm the sync engine so an import also propagates to the vault
  for (const g of backupListsForSync(mergedRetro, mergedLib, backup.lists?.retro_deleted_games)) {
    await markLocalSaveModified(g);
  }
  for (const key of Object.keys(items)) {
    await markLocalSaveModified(key).catch(() => {});
  }

  notifyBackupApplied(updatedKeys);

  return {
    ok: true,
    appliedItems,
    appliedListItemCount: mergedRetro.length,
  };
}

function backupListsForSync(retro: any[], lib: any[], deleted?: string[]): string[] {
  const out = ['retro_games', 'library_games'];
  if (deleted && deleted.length > 0) out.push('retro_deleted_games');
  return out;
}

const backupListeners = new Set<(keys: string[]) => void>();
function notifyBackupApplied(keys: string[]) {
  backupListeners.forEach((fn) => {
    try { fn(keys); } catch (e) {}
  });
}
export function onBackupApplied(listener: (keys: string[]) => void): () => void {
  backupListeners.add(listener);
  return () => backupListeners.delete(listener);
}
