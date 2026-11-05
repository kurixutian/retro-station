// ============================================================================
// RETROSTATION SYNC CODE CLOUD VAULT ENGINE (ZERO-COST, OFFLINE-FIRST)
// Free Cloudflare Worker / Edge Vault Integration
// Works 100% offline on the go; automatically syncs when online
// ============================================================================

import { idbGet, idbPut, idbDelete, idbGetAllKeys } from './services/storage/idb';

export type CloudSyncStatus =
  | 'unlinked'
  | 'idle'
  | 'syncing'
  | 'offline'
  | 'error';

export interface SyncStatusInfo {
  status: CloudSyncStatus;
  details: string;
  lastSyncTime: string | null;
  syncCode: string | null;
}

export interface SyncVaultItem {
  key: string;
  data: any;
  updatedAt: number;
  isBinary: boolean;
}

// Storage Keys
const SYNC_CODE_KEY = 'retro_sync_code';
const SYNC_ENDPOINT_KEY = 'retro_sync_endpoint';
const LAST_SYNC_TIME_KEY = 'retro_last_sync_time';
const SYNC_META_KEY = 'retro_sync_meta';
const DEVICE_ID_KEY = 'retro_device_id';
const DELETED_GAMES_KEY = 'retro_deleted_games';

// Default worker endpoint (configured to your live Cloudflare Worker)
export const DEFAULT_SYNC_ENDPOINT = 'https://retro-vault.xtian-xtn.workers.dev';

// Persistent Device ID
export function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().slice(0, 8)
        : `dev-${Math.random().toString(36).substring(2, 10)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch (e) {
    return 'dev-browser';
  }
}

// Tombstone Management (Tracks deleted games so they don't resurrect across devices)
export function getDeletedGameIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_GAMES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function recordDeletedGame(gameId: string): void {
  try {
    const existing = new Set(getDeletedGameIds());
    existing.add(gameId);
    localStorage.setItem(DELETED_GAMES_KEY, JSON.stringify(Array.from(existing)));
    markLocalSaveModified(DELETED_GAMES_KEY);
    markLocalSaveModified('retro_games');
    markLocalSaveModified('library_games');
  } catch (e) {}
}

export function unrecordDeletedGame(gameId: string): void {
  try {
    const existing = new Set(getDeletedGameIds());
    if (existing.has(gameId)) {
      existing.delete(gameId);
      localStorage.setItem(DELETED_GAMES_KEY, JSON.stringify(Array.from(existing)));
      markLocalSaveModified(DELETED_GAMES_KEY);
    }
  } catch (e) {}
}

// Sync Code Management
export function getSyncCode(): string | null {
  try {
    const code = localStorage.getItem(SYNC_CODE_KEY);
    return code ? code.trim().toUpperCase() : null;
  } catch (e) {
    return null;
  }
}

export function setSyncCode(code: string | null): void {
  try {
    if (code && code.trim()) {
      localStorage.setItem(SYNC_CODE_KEY, code.trim().toUpperCase());
      setStatus('idle', 'Sync code linked');
    } else {
      localStorage.removeItem(SYNC_CODE_KEY);
      localStorage.removeItem(LAST_SYNC_TIME_KEY);
      setStatus('unlinked', 'No sync code linked');
    }
  } catch (e) {}
}

export function clearSyncCode(): void {
  setSyncCode(null);
}

// Generate friendly Sync Code: RETRO-XXXX-XXXX
export function generateSyncCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Omitting 0/O, 1/I
  const randPart = (len: number) => {
    let res = '';
    for (let i = 0; i < len; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };
  return `RETRO-${randPart(4)}-${randPart(4)}`;
}

// Vault Endpoint Management
export function getSyncEndpoint(): string {
  try {
    const custom = localStorage.getItem(SYNC_ENDPOINT_KEY);
    if (!custom) return DEFAULT_SYNC_ENDPOINT;
    const clean = custom.trim().replace(/\/+$/, '');
    if (
      !clean ||
      clean === DEFAULT_SYNC_ENDPOINT.replace(/\/+$/, '') ||
      clean === 'https://retro-vault.workers.dev' ||
      clean.includes('retro-vault.workers.dev') ||
      clean.includes('your-subdomain') ||
      clean.includes('your-worker') ||
      clean.includes('placeholder')
    ) {
      localStorage.removeItem(SYNC_ENDPOINT_KEY);
      return DEFAULT_SYNC_ENDPOINT;
    }
    return clean;
  } catch (e) {
    return DEFAULT_SYNC_ENDPOINT;
  }
}

export function setSyncEndpoint(url: string): void {
  try {
    const clean = url.trim().replace(/\/+$/, '');
    if (
      clean &&
      clean !== DEFAULT_SYNC_ENDPOINT.replace(/\/+$/, '') &&
      clean !== 'https://retro-vault.workers.dev' &&
      !clean.includes('retro-vault.workers.dev') &&
      !clean.includes('your-subdomain') &&
      !clean.includes('your-worker')
    ) {
      localStorage.setItem(SYNC_ENDPOINT_KEY, clean);
    } else {
      localStorage.removeItem(SYNC_ENDPOINT_KEY);
    }
  } catch (e) {}
}

// Status State & Listeners
function getInitialStatus(): { status: CloudSyncStatus; details: string } {
  try {
    const code = localStorage.getItem(SYNC_CODE_KEY);
    if (!code) return { status: 'unlinked', details: 'No sync code linked' };
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { status: 'offline', details: 'Offline (saves kept locally)' };
    }
    const lastSync = localStorage.getItem(LAST_SYNC_TIME_KEY);
    return {
      status: 'idle',
      details: lastSync ? `Synced (${lastSync})` : 'Connected',
    };
  } catch (e) {
    return { status: 'unlinked', details: '' };
  }
}

const initStatus = getInitialStatus();
let currentStatus: CloudSyncStatus = initStatus.status;
let statusDetails = initStatus.details;
const statusListeners = new Set<(status: CloudSyncStatus, details: string) => void>();

export function getSyncStatus(): SyncStatusInfo {
  let lastSyncTime: string | null = null;
  try {
    lastSyncTime = localStorage.getItem(LAST_SYNC_TIME_KEY);
  } catch (e) {}
  return {
    status: currentStatus,
    details: statusDetails,
    lastSyncTime,
    syncCode: getSyncCode(),
  };
}

export function subscribeSyncStatus(listener: (status: CloudSyncStatus, details: string) => void): () => void {
  statusListeners.add(listener);
  listener(currentStatus, statusDetails);
  return () => statusListeners.delete(listener);
}

function setStatus(status: CloudSyncStatus, details = '') {
  currentStatus = status;
  statusDetails = details;
  statusListeners.forEach((fn) => {
    try { fn(status, details); } catch (e) {}
  });
}

// Listener for when remote saves/games are downloaded and updated locally
const dataUpdateListeners = new Set<(updatedKeys: string[]) => void>();

export function onDataUpdated(listener: (updatedKeys: string[]) => void): () => void {
  dataUpdateListeners.add(listener);
  return () => dataUpdateListeners.delete(listener);
}

function notifyDataUpdated(updatedKeys: string[]) {
  if (updatedKeys.length === 0) return;
  dataUpdateListeners.forEach((fn) => {
    try { fn(updatedKeys); } catch (e) {}
  });
}

// Key Filter & Helpers
export function isSyncableKey(key: string): boolean {
  return (
    key === 'retro_games' ||
    key === 'library_games' ||
    key === 'retro_deleted_games' ||
    key === 'deleted_games' ||
    key.startsWith('state:') ||
    key.startsWith('srm:') ||
    key.startsWith('rtc:') ||
    key.startsWith('cover:')
  );
}

/**
 * Deduplicates and merges game lists.
 * Matches games by:
 * 1) id
 * 2) fileName (case-insensitive)
 * 3) title (case-insensitive) + core
 * 4) crc32 (if present)
 * Overwrites existing entries instead of duplicating.
 * Automatically excludes any tombstoned/deleted game IDs.
 */
export function mergeAndDeduplicateGames(localList: any[], remoteList: any[] = [], preferRemote = true): any[] {
  const deletedSet = new Set(getDeletedGameIds());
  const result: any[] = [];

  const getKey = (g: any) => {
    const titleKey = g?.title && g?.core ? `${String(g.title).trim().toLowerCase()}::${String(g.core).toLowerCase()}` : null;
    const fileKey = g?.fileName ? String(g.fileName).trim().toLowerCase() : null;
    const idKey = g?.id ? String(g.id).trim().toLowerCase() : null;
    const crcKey = g?.crc32 ? String(g.crc32).trim().toLowerCase() : null;
    return { idKey, fileKey, titleKey, crcKey };
  };

  const findExistingIndex = (g: any): number => {
    if (!g) return -1;
    const gKeys = getKey(g);
    return result.findIndex((item) => {
      const itemKeys = getKey(item);
      if (gKeys.idKey && itemKeys.idKey && gKeys.idKey === itemKeys.idKey) return true;
      if (gKeys.fileKey && itemKeys.fileKey && gKeys.fileKey === itemKeys.fileKey) return true;
      if (gKeys.titleKey && itemKeys.titleKey && gKeys.titleKey === itemKeys.titleKey) return true;
      if (gKeys.crcKey && itemKeys.crcKey && gKeys.crcKey === itemKeys.crcKey) return true;
      return false;
    });
  };

  const primary = preferRemote ? remoteList : localList;
  const secondary = preferRemote ? localList : remoteList;

  if (Array.isArray(primary)) {
    for (const g of primary) {
      if (!g || !g.id || deletedSet.has(g.id)) continue;
      const idx = findExistingIndex(g);
      if (idx >= 0) {
        result[idx] = { ...result[idx], ...g };
      } else {
        result.push({ ...g });
      }
    }
  }

  if (Array.isArray(secondary)) {
    for (const g of secondary) {
      if (!g || !g.id || deletedSet.has(g.id)) continue;
      const idx = findExistingIndex(g);
      if (idx >= 0) {
        if (!preferRemote) {
          result[idx] = { ...result[idx], ...g };
        }
      } else {
        result.push({ ...g });
      }
    }
  }

  return result.filter((g) => g && g.id && !deletedSet.has(g.id));
}

// Binary Normalizer & Fast Base64 converters
export function normalizeBinaryData(val: any): Uint8Array | null {
  if (!val) return null;
  let bytes: Uint8Array | null = null;

  if (val instanceof Uint8Array) {
    bytes = new Uint8Array(val.length);
    bytes.set(val);
  } else if (ArrayBuffer.isView(val)) {
    const view = new Uint8Array(val.buffer, val.byteOffset, val.byteLength);
    bytes = new Uint8Array(view.length);
    bytes.set(view);
  } else if (val instanceof ArrayBuffer) {
    bytes = new Uint8Array(val.byteLength);
    bytes.set(new Uint8Array(val));
  } else if (Array.isArray(val)) {
    if (val.length > 0 && typeof val[0] === 'number') {
      bytes = new Uint8Array(val);
    } else {
      return null;
    }
  } else if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return normalizeBinaryData(parsed);
      } catch (e) {}
    }
    try {
      const bin = atob(trimmed);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch (e) {
      return null;
    }
  } else if (typeof val === 'object' && val !== null) {
    // Only deserialize if it's a numeric-indexed object map like {"0": 1, "1": 2, ...}
    const keys = Object.keys(val);
    if (keys.length > 0 && keys[0] === '0' && typeof (val as any)[0] === 'number') {
      const vals = Object.values(val);
      if (typeof vals[0] === 'number') {
        bytes = new Uint8Array(vals as number[]);
      }
    } else {
      return null;
    }
  }

  // Repair case where a JSON-stringified Uint8Array was wrapped raw into a Uint8Array
  if (bytes && bytes.length > 4) {
    if (
      (bytes[0] === 0x7b && bytes[1] === 0x22 && bytes[2] === 0x30 && bytes[3] === 0x22 && bytes[4] === 0x3a) ||
      (bytes[0] === 0x5b && bytes[bytes.length - 1] === 0x5d)
    ) {
      try {
        const text = new TextDecoder().decode(bytes);
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object') {
          const vals = Array.isArray(parsed) ? parsed : Object.values(parsed);
          if (vals.length > 0 && typeof vals[0] === 'number') {
            return new Uint8Array(vals as number[]);
          }
        }
      } catch (e) {}
    }
  }

  return bytes && bytes.length > 0 ? bytes : null;
}

export function uint8ToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  const len = bytes.length;
  let binary = '';
  for (let i = 0; i < len; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunkSize, len)) as any);
  }
  return btoa(binary);
}

export function base64ToUint8(str: string): Uint8Array {
  const bin = atob(str);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

// Local Sync Metadata Cache
function getLocalMetaMap(): Record<string, { updatedAt: number; pendingUpload?: boolean }> {
  try {
    return JSON.parse(localStorage.getItem(SYNC_META_KEY) || '{}');
  } catch (e) {
    return {};
  }
}

function saveLocalMetaMap(map: Record<string, { updatedAt: number; pendingUpload?: boolean }>) {
  try {
    localStorage.setItem(SYNC_META_KEY, JSON.stringify(map));
  } catch (e) {}
}

export async function markLocalSaveModified(key: string): Promise<void> {
  const map = getLocalMetaMap();
  map[key] = {
    updatedAt: Date.now(),
    pendingUpload: true,
  };
  saveLocalMetaMap(map);
  triggerDebouncedCloudSync();
}

// Debounced Auto-Sync (10 minutes = 600,000ms)
// Gives plenty of time for battery saves/states to accumulate, avoiding repetitive worker invocations.
// Manual sync is always available instantly in the Sync Modal or Top Bar.
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
export function triggerDebouncedCloudSync(delayMs = 10 * 60 * 1000) {
  if (debounceTimer) return; // Keep the active 10-minute schedule without resetting on every minor change
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    const code = getSyncCode();
    if (code && navigator.onLine) {
      syncNow().catch((e) => console.warn('[CloudSync] Periodic auto-sync warning:', e));
    }
  }, delayMs);
}

// Network Online Listener
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    const code = getSyncCode();
    if (code) {
      setStatus('idle', 'Back online; syncing...');
      syncNow().catch(() => {});
    }
  });

  window.addEventListener('offline', () => {
    const code = getSyncCode();
    if (code) {
      setStatus('offline', 'Offline (saves kept locally)');
    }
  });
}

// Full 2-Way Sync Operation
let isSyncRunning = false;

export async function syncNow(): Promise<{
  success: boolean;
  error?: string;
  pulledCount: number;
  pushedCount: number;
}> {
  const code = getSyncCode();
  if (!code) {
    setStatus('unlinked', 'No sync code linked');
    return { success: false, error: 'No sync code linked', pulledCount: 0, pushedCount: 0 };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setStatus('offline', 'Offline (changes kept locally)');
    return { success: false, error: 'Device is offline', pulledCount: 0, pushedCount: 0 };
  }

  if (isSyncRunning) {
    return { success: true, pulledCount: 0, pushedCount: 0 };
  }

  isSyncRunning = true;
  setStatus('syncing', 'Syncing saves...');

  try {
    const endpoint = getSyncEndpoint();
    const metaMap = getLocalMetaMap();
    const updatedLocalKeys: string[] = [];
    let pulledCount = 0;
    let pushedCount = 0;

    // 1. Fetch remote vault from Cloudflare Worker
    const fetchUrl = `${endpoint}/api/sync/${encodeURIComponent(code)}`;
    let remoteVault: { exists?: boolean; items?: Record<string, SyncVaultItem>; lastModified?: number } | null = null;

    try {
      const res = await fetch(fetchUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (res.ok) {
        remoteVault = await res.json();
      } else if (res.status === 404) {
        // Vault doesn't exist yet on remote, initialize empty
        remoteVault = { exists: false, items: {}, lastModified: 0 };
      } else {
        throw new Error(`Vault server returned HTTP ${res.status}`);
      }
    } catch (networkErr: any) {
      console.warn('[CloudSync] Network request failed:', networkErr);
      if (endpoint !== DEFAULT_SYNC_ENDPOINT) {
        console.warn(`[CloudSync] Custom endpoint ${endpoint} failed. Resetting to default worker.`);
        localStorage.removeItem(SYNC_ENDPOINT_KEY);
        isSyncRunning = false;
        return syncNow();
      }
      const isPlaceholder = (endpoint as string) === 'https://retro-vault.workers.dev';
      const errorMsg = isPlaceholder
        ? 'Vault worker not deployed yet. Deploy your free worker or paste your URL below.'
        : `Could not reach sync vault (${networkErr.message || 'network error'})`;
      setStatus('error', errorMsg);
      isSyncRunning = false;
      return { success: false, error: errorMsg, pulledCount: 0, pushedCount: 0 };
    }

    const remoteItems = remoteVault?.items || {};

    // 2. Scan all local keys
    const rawIdbKeys = await idbGetAllKeys().catch(() => [] as string[]);
    const allLocalSyncableKeys = new Set<string>();
    rawIdbKeys.forEach((k) => {
      if (isSyncableKey(k)) allLocalSyncableKeys.add(k);
    });

    // Add retro_games from localStorage if present
    try {
      const localGames = localStorage.getItem('retro_games');
      if (localGames) allLocalSyncableKeys.add('retro_games');
    } catch (e) {}

    // Add retro_deleted_games if any tombstones exist
    if (getDeletedGameIds().length > 0) {
      allLocalSyncableKeys.add(DELETED_GAMES_KEY);
    }

    // Add any keys that only exist remotely
    Object.keys(remoteItems).forEach((remoteKey) => {
      if (isSyncableKey(remoteKey)) {
        allLocalSyncableKeys.add(remoteKey);
      }
    });

    // 3. Reconcile / Download newer items from remote
    for (const [rKey, rItem] of Object.entries(remoteItems)) {
      if (!isSyncableKey(rKey)) continue;

      const localMeta = metaMap[rKey];
      const localUpdatedAt = localMeta?.updatedAt || 0;
      const remoteUpdatedAt = rItem.updatedAt || 0;

      const isGamesKey = rKey === 'retro_games' || rKey === 'library_games';
      const isDeletedKey = rKey === DELETED_GAMES_KEY || rKey === 'deleted_games';
      const shouldDownload = isGamesKey || isDeletedKey || remoteUpdatedAt > localUpdatedAt || !localMeta;

      // If remote has newer data (or local never had it, or game library / tombstone sync)
      if (shouldDownload) {
        try {
          if (isDeletedKey) {
            const remoteDeletedList = Array.isArray(rItem.data) ? rItem.data : [];
            if (remoteDeletedList.length > 0) {
              const localDeletedSet = new Set(getDeletedGameIds());
              let anyNew = false;
              remoteDeletedList.forEach((id: string) => {
                if (id && !localDeletedSet.has(id)) {
                  localDeletedSet.add(id);
                  anyNew = true;
                }
              });
              if (anyNew) {
                localStorage.setItem(DELETED_GAMES_KEY, JSON.stringify(Array.from(localDeletedSet)));
              }

              // Purge remotely deleted games from local library and storage
              let localGamesList: any[] = [];
              try {
                localGamesList = JSON.parse(localStorage.getItem('retro_games') || '[]');
              } catch (e) {}
              const pruned = localGamesList.filter((g: any) => g && g.id && !localDeletedSet.has(g.id));
              if (pruned.length !== localGamesList.length) {
                localStorage.setItem('retro_games', JSON.stringify(pruned));
                await idbPut('library_games', pruned.filter((g: any) => g.real && g.id !== 'pokemon_gold')).catch(() => {});
                for (const delId of remoteDeletedList) {
                  await idbDelete(delId).catch(() => {});
                  await idbDelete(`rom:${delId}`).catch(() => {});
                  await idbDelete(`srm:${delId}`).catch(() => {});
                  await idbDelete(`rtc:${delId}`).catch(() => {});
                  await idbDelete(`autosave:${delId}`).catch(() => {});
                  await idbDelete(`cover:${delId}`).catch(() => {});
                  for (let s = 1; s <= 4; s++) {
                    await idbDelete(`state:${delId}:${s}`).catch(() => {});
                  }
                }
                updatedLocalKeys.push('retro_games');
                updatedLocalKeys.push('library_games');
                pulledCount++;
              }
            }
          } else if (isGamesKey) {
            const remoteGamesList = Array.isArray(rItem.data) ? rItem.data : [];
            if (remoteGamesList.length > 0) {
              let localGamesList: any[] = [];
              try {
                localGamesList = JSON.parse(localStorage.getItem('retro_games') || '[]');
              } catch (e) {}
              if (!Array.isArray(localGamesList) || localGamesList.length === 0) {
                const idbGames = await idbGet('library_games').catch(() => null);
                if (Array.isArray(idbGames) && idbGames.length > 0) {
                  localGamesList = idbGames;
                }
              }

              const deletedSet = new Set(getDeletedGameIds());
              const filteredLocal = localGamesList.filter((g: any) => g && g.id && !deletedSet.has(g.id));
              const filteredRemote = remoteGamesList.filter((g: any) => g && g.id && !deletedSet.has(g.id));

              // Overwrite existing games by ID, fileName, title+core, or CRC instead of duplicating
              const merged = mergeAndDeduplicateGames(filteredLocal, filteredRemote, true).filter(
                (g: any) => g && g.id && !deletedSet.has(g.id)
              );

              // Check if any new game was added or changed
              const changed = JSON.stringify(merged) !== JSON.stringify(localGamesList);
              if (changed || !localMeta) {
                localStorage.setItem('retro_games', JSON.stringify(merged));
                await idbPut('library_games', merged.filter((g: any) => g.real && g.id !== 'pokemon_gold')).catch(() => {});
                updatedLocalKeys.push('retro_games');
                updatedLocalKeys.push('library_games');
                pulledCount++;
              }
            }
          } else if (rKey.startsWith('state:')) {
            // Save state slot JSON or object
            let valToSave = rItem.data;
            if (valToSave && typeof valToSave === 'object') {
              // Unpack base64 emuState back if present
              if (valToSave.emuStateBase64) {
                valToSave.emuState = base64ToUint8(valToSave.emuStateBase64);
              }
              if (valToSave.stateData?.emuStateBase64) {
                valToSave.stateData.emuState = base64ToUint8(valToSave.stateData.emuStateBase64);
              }
              await idbPut(rKey, valToSave);
            }
            updatedLocalKeys.push(rKey);
            pulledCount++;
          } else if (rItem.isBinary && typeof rItem.data === 'string') {
            const rawBytes = base64ToUint8(rItem.data);
            await idbPut(rKey, rawBytes);
            updatedLocalKeys.push(rKey);
            pulledCount++;
          } else {
            await idbPut(rKey, rItem.data);
            updatedLocalKeys.push(rKey);
            pulledCount++;
          }

          metaMap[rKey] = {
            updatedAt: remoteUpdatedAt,
            pendingUpload: false,
          };
        } catch (itemErr) {
          console.warn(`[CloudSync] Error saving downloaded item ${rKey}:`, itemErr);
        }
      }
    }

    // 4. Gather local items to push to remote
    const itemsToUpload: Record<string, SyncVaultItem> = {};

    for (const key of Array.from(allLocalSyncableKeys)) {
      const localMeta = metaMap[key];
      const remoteItem = remoteItems[key];
      const localUpdatedAt = localMeta?.updatedAt || 0;
      const remoteUpdatedAt = remoteItem?.updatedAt || 0;

      // Force push if remote has invalid/corrupted data for games or states
      const remoteCorrupt =
        remoteItem &&
        ((key === 'retro_games' && (!Array.isArray(remoteItem.data) || remoteItem.isBinary)) ||
         (key.startsWith('state:') && (typeof remoteItem.data !== 'object' || remoteItem.isBinary)));

      const needsPush =
        localMeta?.pendingUpload ||
        !remoteItem ||
        remoteCorrupt ||
        localUpdatedAt > remoteUpdatedAt;

      if (needsPush) {
        try {
          if (key === DELETED_GAMES_KEY || key === 'deleted_games') {
            const deletedIds = getDeletedGameIds();
            itemsToUpload[DELETED_GAMES_KEY] = {
              key: DELETED_GAMES_KEY,
              data: deletedIds,
              updatedAt: Date.now(),
              isBinary: false,
            };
          } else if (key === 'retro_games') {
            let localGames: any[] = [];
            try {
              localGames = JSON.parse(localStorage.getItem('retro_games') || '[]');
            } catch (e) {}
            const deletedSet = new Set(getDeletedGameIds());
            const cleanGames = mergeAndDeduplicateGames(localGames, [], false).filter(
              (g: any) => g && g.id && !deletedSet.has(g.id)
            );
            itemsToUpload[key] = {
              key,
              data: cleanGames,
              updatedAt: Date.now(),
              isBinary: false,
            };
          } else if (key === 'library_games') {
            const libGames = await idbGet('library_games');
            if (Array.isArray(libGames)) {
              const deletedSet = new Set(getDeletedGameIds());
              const cleanLib = mergeAndDeduplicateGames(libGames, [], false).filter(
                (g: any) => g && g.id && !deletedSet.has(g.id)
              );
              itemsToUpload[key] = {
                key,
                data: cleanLib,
                updatedAt: Date.now(),
                isBinary: false,
              };
            }
          } else if (key.startsWith('state:')) {
            const slotData = await idbGet(key);
            if (slotData && typeof slotData === 'object') {
              const serializable = { ...slotData };
              let stateTooLarge = false;
              if (serializable.emuState) {
                const b = normalizeBinaryData(serializable.emuState);
                if (b) {
                  if (b.length > 768 * 1024) stateTooLarge = true;
                  else {
                    serializable.emuStateBase64 = uint8ToBase64(b);
                    delete serializable.emuState;
                  }
                }
              }
              if (!stateTooLarge && serializable.stateData?.emuState) {
                const b2 = normalizeBinaryData(serializable.stateData.emuState);
                if (b2) {
                  if (b2.length > 768 * 1024) stateTooLarge = true;
                  else {
                    serializable.stateData = { ...serializable.stateData, emuStateBase64: uint8ToBase64(b2) };
                    delete serializable.stateData.emuState;
                  }
                }
              }
              if (stateTooLarge) {
                console.warn(`[CloudSync] Skipping oversized save state ${key} (>768KB) to protect edge limits`);
                continue;
              }
              itemsToUpload[key] = {
                key,
                data: serializable,
                updatedAt: localUpdatedAt || Date.now(),
                isBinary: false,
              };
            }
          } else {
            // srm:*, rtc:*, cover:*
            const raw = await idbGet(key);
            if (raw) {
              let bytes: Uint8Array | null = null;
              if (raw instanceof Blob) {
                const ab = await raw.arrayBuffer();
                bytes = new Uint8Array(ab);
              } else {
                bytes = normalizeBinaryData(raw);
              }
              if (bytes && bytes.length > 0) {
                if (bytes.length > 1024 * 1024) {
                  console.warn(`[CloudSync] Skipping oversized binary item ${key} (>1MB)`);
                  continue;
                }
                itemsToUpload[key] = {
                  key,
                  data: uint8ToBase64(bytes),
                  updatedAt: localUpdatedAt || Date.now(),
                  isBinary: true,
                };
              } else if (typeof raw === 'string' && key.startsWith('cover:')) {
                if (raw.length <= 512 * 1024) {
                  itemsToUpload[key] = {
                    key,
                    data: raw,
                    updatedAt: localUpdatedAt || Date.now(),
                    isBinary: false,
                  };
                }
              }
            }
          }
        } catch (prepErr) {
          console.warn(`[CloudSync] Error preparing ${key} for upload:`, prepErr);
        }
      }
    }

    // 5. Send POST batch to remote in safe, lightweight chunks (<= 160KB)
    const uploadEntries = Object.entries(itemsToUpload);
    if (uploadEntries.length > 0) {
      const MAX_BATCH_BYTES = 160 * 1024;
      const batches: Record<string, SyncVaultItem>[] = [];
      let currentBatch: Record<string, SyncVaultItem> = {};
      let currentSize = 0;

      for (const [k, it] of uploadEntries) {
        let est = 0;
        try {
          est = JSON.stringify(it).length;
        } catch (e) {
          est = 1024;
        }

        if (currentSize + est > MAX_BATCH_BYTES && Object.keys(currentBatch).length > 0) {
          batches.push(currentBatch);
          currentBatch = {};
          currentSize = 0;
        }
        currentBatch[k] = it;
        currentSize += est;
      }
      if (Object.keys(currentBatch).length > 0) {
        batches.push(currentBatch);
      }

      for (const batch of batches) {
        const postUrl = `${endpoint}/api/sync/${encodeURIComponent(code)}`;
        const payload = {
          clientDeviceId: getOrCreateDeviceId(),
          items: batch,
        };

        const pushRes = await fetch(postUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!pushRes.ok) {
          throw new Error(`Vault server upload error: HTTP ${pushRes.status}`);
        }

        // Mark items in this batch as synced
        for (const [upKey, upItem] of Object.entries(batch)) {
          metaMap[upKey] = {
            updatedAt: upItem.updatedAt,
            pendingUpload: false,
          };
          pushedCount++;
        }
      }
    }

    // Save updated metadata map
    saveLocalMetaMap(metaMap);

    // Record last sync time
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try {
      localStorage.setItem(LAST_SYNC_TIME_KEY, timeStr);
    } catch (e) {}

    setStatus('idle', `Synced (${timeStr})`);

    // Notify UI of local updates
    if (updatedLocalKeys.length > 0) {
      notifyDataUpdated(updatedLocalKeys);
    }

    isSyncRunning = false;
    return { success: true, pulledCount, pushedCount };
  } catch (err: any) {
    console.error('[CloudSync] syncNow error:', err);
    setStatus('error', err?.message || 'Sync failed');
    isSyncRunning = false;
    return { success: false, error: err?.message, pulledCount: 0, pushedCount: 0 };
  }
}
