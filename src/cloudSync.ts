// ============================================================================
// RETROSTATION SYNC ENGINE v2 (CLOUDFLARE WORKER + DURABLE OBJECT + R2)
// ----------------------------------------------------------------------------
// Architecture:
//   - Vault is stored as ONE R2 OBJECT PER ITEM (not one giant JSON blob),
//     so a big save state syncs without dragging the whole library along.
//   - A Durable Object (one per sync code) serializes every write and stamps
//     SERVER timestamps. Client-device clocks are no longer trusted for
//     remote-side comparison, which kills the "last write silently wins by
//     skewed clock" bug class.
//   - Deletes are explicit tombstoned DELETE calls (also propagated for save
//     slots/SRAM/RTC/covers when the owning game is deleted), so saves do not
//     resurrect from stale copies on other devices.
//   - Failures are retried with exponential backoff and surfaced in a sync
//     report (pulled / pushed / skipped-too-large / errors) instead of being
//     swallowed by empty catch blocks.
//   - ROM binaries are NEVER synced (by design; re-link ROMs on new devices)
//     and the server rejects those keys outright.
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

export interface SyncReport {
  at: number;
  success: boolean;
  pulled: number;
  pushed: number;
  skipped: { key: string; size: number; reason: string }[];
  errors: { key?: string; message: string }[];
  revision: number;
}

export const EMPTY_SYNC_REPORT: SyncReport = {
  at: 0,
  success: false,
  pulled: 0,
  pushed: 0,
  skipped: [],
  errors: [],
  revision: 0,
};

// Storage Keys
const SYNC_CODE_KEY = 'retro_sync_code';
const SYNC_ENDPOINT_KEY = 'retro_sync_endpoint';
const LAST_SYNC_TIME_KEY = 'retro_last_sync_time';
const SYNC_META_KEY = 'retro_sync_meta';
const DEVICE_ID_KEY = 'retro_device_id';
const DELETED_GAMES_KEY = 'retro_deleted_games';

// Per-item size caps (visible in the sync report; no more silent skips)
const CAP_STATE_BYTES = 6 * 1024 * 1024; // JSON w/ base64 state payload
const CAP_SRAM_BYTES = 4 * 1024 * 1024;  // raw SRAM/RTC bytes
const CAP_COVER_BYTES = 512 * 1024;      // data URL string
const MAX_CONCURRENT_PULLS = 4;

// Demo-only pseudo-games are never synced.
const DEMO_GAME_IDS = new Set(['pokemon_gold']);

// Default worker endpoint (your live Cloudflare Worker)
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
// NOTE: unlike v1, a FAILED sync must never erase a custom endpoint here -
// v1 silently deleting it caused surprise re-syncs against the official vault.
export function getSyncEndpoint(): string {
  try {
    const custom = localStorage.getItem(SYNC_ENDPOINT_KEY);
    if (!custom) return DEFAULT_SYNC_ENDPOINT;
    const clean = custom.trim().replace(/\/+$/, '');
    if (
      !clean ||
      clean === DEFAULT_SYNC_ENDPOINT.replace(/\/+$/, '') ||
      clean === 'https://retro-vault.workers.dev' ||
      clean.includes('your-subdomain') ||
      clean.includes('your-worker') ||
      clean.includes('placeholder')
    ) {
      return DEFAULT_SYNC_ENDPOINT;
    }
    return clean;
  } catch (e) {
    return DEFAULT_SYNC_ENDPOINT;
  }
}

export function setSyncEndpoint(url: string | null): void {
  try {
    if (!url) {
      localStorage.removeItem(SYNC_ENDPOINT_KEY);
      return;
    }
    const clean = url.trim().replace(/\/+$/, '');
    if (
      clean &&
      clean !== DEFAULT_SYNC_ENDPOINT.replace(/\/+$/, '') &&
      clean !== 'https://retro-vault.workers.dev' &&
      !clean.includes('your-subdomain') &&
      !clean.includes('your-worker') &&
      !clean.includes('placeholder')
    ) {
      localStorage.setItem(SYNC_ENDPOINT_KEY, clean);
    } else {
      localStorage.removeItem(SYNC_ENDPOINT_KEY);
    }
  } catch (e) {}
}

export function getCustomEndpoint(): string | null {
  try {
    return localStorage.getItem(SYNC_ENDPOINT_KEY);
  } catch (e) {
    return null;
  }
}

// Checks the deployed worker reports a sane config (R2 bound; NOT the old
// in-memory fallback that silently accepted writes then evaporated).
export async function getVaultHealth(endpoint: string): Promise<{ ok: boolean; storage: string }> {
  try {
    const res = await fetch(`${endpoint}/health`, { method: 'GET', cache: 'no-store' });
    if (!res.ok) return { ok: false, storage: 'error' };
    const body = await res.json();
    return {
      ok: body.status === 'ok' && body.storage === 'R2',
      storage: String(body.storage || 'unknown'),
    };
  } catch (e) {
    return { ok: false, storage: 'unreachable' };
  }
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

// Sync Report (pulled / pushed / skipped-too-large / errors) - consumed by UI
let lastSyncReport: SyncReport = { ...EMPTY_SYNC_REPORT };
export function getSyncReport(): SyncReport {
  return lastSyncReport;
}

// Key Filter & Helpers
export function isSyncableKey(key: string): boolean {
  return (
    key === 'retro_games' ||
    key === 'library_games' ||
    key === 'retro_deleted_games' ||
    key.startsWith('state:') ||
    key.startsWith('srm:') ||
    key.startsWith('rtc:') ||
    key.startsWith('cover:')
  );
}

const isStateLikeKey = (key: string) => key.startsWith('state:');
const isBinaryKey = (key: string) => key.startsWith('srm:') || key.startsWith('rtc:');
const isItemKey = (key: string) => isStateLikeKey(key) || isBinaryKey(key) || key.startsWith('cover:');

/** gameId embedded in a per-save item key (slot may itself contain ':') */
function gameIdFromItemKey(key: string): string | null {
  if (key.startsWith('state:')) {
    const parts = key.split(':');
    return parts.length > 2 ? parts.slice(1, parts.length - 1).join(':') : parts[1] || null;
  }
  if (key.startsWith('srm:') || key.startsWith('rtc:') || key.startsWith('cover:')) {
    return key.slice(key.indexOf(':') + 1) || null;
  }
  return null;
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

// Binary Normalizer: repairs every historical corruption shape into clean bytes
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
    const keys = Object.keys(val);
    if (keys.length > 0 && keys[0] === '0' && typeof (val as any)[0] === 'number') {
      const vals = Object.values(val);
      if (typeof vals[0] === 'number') {
        bytes = new Uint8Array(vals as number[]);
      }
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

export function areByteArraysEqual(a: Uint8Array | null, b: Uint8Array | null): boolean {
  if (!a || !b) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Local Sync Metadata Cache (updatedAt is a server-stamped timestamp after
// each successful push/pull; before the first push it's the local clock)
interface SyncMeta {
  updatedAt: number;
  pendingUpload?: boolean;
}
function getLocalMetaMap(): Record<string, SyncMeta> {
  try {
    return JSON.parse(localStorage.getItem(SYNC_META_KEY) || '{}');
  } catch (e) {
    return {};
  }
}
function saveLocalMetaMap(map: Record<string, SyncMeta>) {
  try {
    localStorage.setItem(SYNC_META_KEY, JSON.stringify(map));
  } catch (e) {}
}

export async function markLocalSaveModified(key: string): Promise<void> {
  if (key.startsWith('autosave:')) return; // ephemeral; never synced, never debounces
  const map = getLocalMetaMap();
  map[key] = {
    updatedAt: Date.now(),
    pendingUpload: true,
  };
  saveLocalMetaMap(map);
  triggerDebouncedCloudSync();
}

// Debounced Auto-Sync (10 minutes default)
// Deferred automatically while active gameplay is running so serialization
// never stalls the frame loop, and retried on its own after failures.
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let gameplayActive = false;
let deferredSyncPending = false;

export function setGameplayActive(active: boolean): void {
  gameplayActive = active;
  if (!active && deferredSyncPending) {
    deferredSyncPending = false;
    const code = getSyncCode();
    if (code && typeof navigator !== 'undefined' && navigator.onLine) {
      triggerDebouncedCloudSync(4000);
    }
  }
}

export function triggerDebouncedCloudSync(delayMs = 10 * 60 * 1000) {
  if (debounceTimer) return; // keep schedule; don't reset on every minor change
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    if (gameplayActive) {
      deferredSyncPending = true;
      return;
    }
    const code = getSyncCode();
    if (code && navigator.onLine) {
      syncNow().catch((e) => console.warn('[CloudSync] Periodic auto-sync warning:', e));
    }
  }, delayMs);
}

// Retry with exponential backoff. v1 just left pendingUpload=true and hoped a
// future trigger would arrive; v2 retries on its own timer.
const RETRY_DELAYS = [5_000, 30_000, 2 * 60_000, 10 * 60_000];
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;

function resetRetryTimer() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  retryAttempt = 0;
}

function scheduleRetry() {
  if (['syncing', 'offline', 'unlinked'].includes(currentStatus)) return;
  const delay = RETRY_DELAYS[Math.min(retryAttempt, RETRY_DELAYS.length - 1)];
  retryAttempt++;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    const code = getSyncCode();
    if (code && navigator.onLine && !gameplayActive) {
      syncNow().catch(() => {});
    } else if (code && gameplayActive) {
      deferredSyncPending = true;
    }
  }, delay);
}

// Network Online Listener
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    const code = getSyncCode();
    if (code) {
      setStatus('idle', 'Back online; syncing...');
      resetRetryTimer();
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

// ============================================================================
// v2 SYNC ENGINE
// ============================================================================

export async function syncNow(forceCheck = false): Promise<{
  success: boolean;
  error?: string;
  pulledCount: number;
  pushedCount: number;
}> {
  if (activeSyncPromise) {
    if (forceCheck) {
      await activeSyncPromise.catch(() => {});
      return executeSync(true);
    }
    return activeSyncPromise;
  }
  activeSyncPromise = executeSync(forceCheck);
  try {
    return await activeSyncPromise;
  } finally {
    activeSyncPromise = null;
  }
}

let activeSyncPromise: Promise<{
  success: boolean;
  error?: string;
  pulledCount: number;
  pushedCount: number;
}> | null = null;

interface VaultIndex {
  revision: number;
  items: Record<string, { updatedAt: number; size: number }>;
  deleted: Record<string, { updatedAt: number }>;
}

async function executeSync(forceCheck = false): Promise<{
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

  setStatus('syncing', 'Syncing saves...');

  const endpoint = getSyncEndpoint();
  const metaMap = getLocalMetaMap();
  const updatedLocalKeys: string[] = [];
  const touchedThisRun = new Set<string>();
  const skipped: SyncReport['skipped'] = [];
  const errors: SyncReport['errors'] = [];
  let pulledCount = 0;
  let pushedCount = 0;
  let revision = 0;

  try {
    // -------- 1. Fetch vault index (one small request; no mega-blob) --------
    const indexUrl = `${endpoint}/api/sync/${encodeURIComponent(code)}`;
    const indexRes = await fetch(indexUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (!indexRes.ok) {
      const errText = await indexRes.text().catch(() => '');
      let errorMsg = `Vault server error: HTTP ${indexRes.status}`;
      try {
        errorMsg = JSON.parse(errText).error || errorMsg;
      } catch (e) {}
      throw new Error(errorMsg);
    }

    const vaultIndex: VaultIndex = await indexRes.json();
    revision = vaultIndex.revision || 0;
    const remoteItems = vaultIndex.items || {};
    const remoteDeleted = vaultIndex.deleted || {};

    // -------- 2. Pull phase: fetch remote items newer than local --------
    const pullKeys = Object.keys(remoteItems).filter((k) =>
      shouldPull(k, remoteItems[k].updatedAt, metaMap, remoteDeleted)
    );

    pulledCount = await pullItems({
      endpoint,
      code,
      keys: pullKeys,
      remoteItems,
      metaMap,
      updatedLocalKeys,
      touchedThisRun,
      skipped,
      errors,
    });

    // -------- 3. Push phase --------
    // Candidate keys: everything we track locally plus everything remote
    const candidates = new Set<string>(['retro_games', 'library_games', DELETED_GAMES_KEY]);
    for (const k of Object.keys(metaMap)) if (isSyncableKey(k)) candidates.add(k);
    try {
      const idbKeys = await idbGetAllKeys();
      for (const k of idbKeys) {
        const ks = String(k);
        if (isSyncableKey(ks)) candidates.add(ks);
      }
    } catch (e) {}

    const deletedIds = new Set(getDeletedGameIds());
    const idsNeedingRemoteDelete = new Set(deletedIds);

    for (const key of Array.from(candidates)) {
      if (touchedThisRun.has(key)) continue;
      const localMeta = metaMap[key];
      const remote = remoteItems[key];
      const remoteTombstone = remoteDeleted[key];

      // Per-save item keys for a game this device has tombstoned: ask the DO
      // to purge every save/covers-related key server-side.
      const owningGameId = isItemKey(key) ? gameIdFromItemKey(key) : null;
      if (owningGameId && deletedIds.has(owningGameId)) {
        continue; // handled by the delete-games call below
      }

      // Remote tombstoned this item (deleted on another device): true
      // tombstone semantics - delete locally too, unless we have unsent
      // local changes in which case our re-push overwrites the tombstone.
      if (remoteTombstone) {
        let localVal: any = null;
        if (isItemKey(key)) localVal = await idbGet(key).catch(() => null);
        if (localVal != null && localMeta?.pendingUpload) {
          continue; // fall through to normal push; PUT clears the tombstone
        }
        if (localVal != null) {
          await idbDelete(key).catch(() => {});
          delete metaMap[key];
          updatedLocalKeys.push(key);
        }
        touchedThisRun.add(key);
        continue;
      }

      // Load local value (null = not on this device)
      let localVal: any = null;
      if (key === 'retro_games') {
        try { localVal = JSON.parse(localStorage.getItem('retro_games') || 'null'); } catch (e) {}
      } else if (key === DELETED_GAMES_KEY) {
        localVal = getDeletedGameIds();
      } else if (key === 'library_games' || isItemKey(key)) {
        localVal = await idbGet(key).catch(() => null);
      }

      // Save slot/SRAM/cover exists on remote but not locally anymore AND we
      // remember having had it; propagate the deletion to the vault.
      // (Requires localMeta so a brand-new empty device can never purge a
      // vault's saves just by connecting.)
      if (remote && !localVal && localMeta && isItemKey(key)) {
        const delRes = await fetch(
          `${endpoint}/api/sync/${encodeURIComponent(code)}/item/${encodeURIComponent(key)}`,
          { method: 'DELETE' }
        );
        if (delRes.ok) {
          try {
            const resp = await delRes.json();
            if (typeof resp.revision === 'number') revision = resp.revision;
          } catch (e) {}
          touchedThisRun.add(key);
        } else {
          errors.push({ key, message: `Tombstone delete failed: HTTP ${delRes.status}` });
        }
        continue;
      }

      if (remote && remote.updatedAt > (localMeta?.updatedAt || 0) && !localMeta?.pendingUpload) {
        continue; // remote is newer and we're not pushing - pull phase handled it
      }

      const needsPush =
        Boolean(localMeta?.pendingUpload) ||
        !remote ||
        (localVal != null && (localMeta?.updatedAt || 0) > remote.updatedAt);

      if (!needsPush) continue;

      // For list keys, fetch the remote list and merge locally BEFORE
      // uploading so we can never wipe remote-only games.
      let remoteListForMerge: any[] | null = null;
      if (key === 'retro_games' || key === 'library_games') {
        remoteListForMerge = await fetchRemoteList(endpoint, code, key);
      }

      const prepared = await prepareUpload(key, localVal, remoteListForMerge);
      if (!prepared.ok) {
        if (prepared.reason) {
          skipped.push({ key, size: prepared.size || 0, reason: prepared.reason });
        }
        continue;
      }
      const { body, contentType } = prepared;

      // No manual Content-Length (browsers forbid it; fetch sets it itself)
      const putRes = await fetch(
        `${endpoint}/api/sync/${encodeURIComponent(code)}/item/${encodeURIComponent(key)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: body as any,
        }
      );

      if (!putRes.ok) {
        const errText = await putRes.text().catch(() => '');
        let msg = `Upload failed: HTTP ${putRes.status}`;
        try { msg = JSON.parse(errText).error || msg; } catch (e) {}
        errors.push({ key, message: msg });
        if (putRes.status >= 500 || putRes.status === 429) {
          if (localMeta) metaMap[key] = { ...localMeta, pendingUpload: true };
        }
        continue;
      }

      try {
        const resp = await putRes.json();
        const serverTs = Number(resp.updatedAt) || Date.now();
        if (typeof resp.revision === 'number') revision = resp.revision;
        metaMap[key] = { updatedAt: serverTs, pendingUpload: false }; // SERVER clock
      } catch (e) {
        metaMap[key] = { updatedAt: Date.now(), pendingUpload: false };
      }
      touchedThisRun.add(key);
      pushedCount++;
    }

    // -------- 4. Tombstone purge request for any locally-deleted games --------
    if (idsNeedingRemoteDelete.size > 0) {
      try {
        const purgeRes = await fetch(`${endpoint}/api/sync/${encodeURIComponent(code)}/delete-games`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: Array.from(idsNeedingRemoteDelete) }),
        });
        if (purgeRes.ok) {
          try {
            const resp = await purgeRes.json();
            if (typeof resp.revision === 'number') revision = resp.revision;
            if (typeof resp.deleted === 'number' && resp.deleted > 0) {
              touchedThisRun.add(DELETED_GAMES_KEY);
            }
          } catch (e) {}
        } else {
          errors.push({ message: `delete-games failed: HTTP ${purgeRes.status}` });
        }
      } catch (e: any) {
        errors.push({ message: `delete-games network error: ${e.message}` });
      }
    }

    saveLocalMetaMap(metaMap);

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try {
      localStorage.setItem(LAST_SYNC_TIME_KEY, timeStr);
    } catch (e) {}

    lastSyncReport = {
      at: Date.now(),
      success: errors.length === 0,
      pulled: pulledCount,
      pushed: pushedCount,
      skipped,
      errors,
      revision,
    };
    resetRetryTimer();

    setStatus(
      errors.length > 0 ? 'error' : 'idle',
      errors.length > 0 ? `${errors.length} item(s) failed` : `Synced (${timeStr})`
    );

    if (updatedLocalKeys.length > 0) notifyDataUpdated(updatedLocalKeys);

    return {
      success: lastSyncReport.success,
      error: errors.length > 0 ? errors[0].message : undefined,
      pulledCount,
      pushedCount,
    };
  } catch (err: any) {
    console.error('[CloudSync] syncNow error:', err);
    const msg = err?.message || 'Sync failed';
    lastSyncReport = {
      at: Date.now(),
      success: false,
      pulled: 0,
      pushed: pushedCount,
      skipped,
      errors: [{ message: msg }],
      revision,
    };
    setStatus('error', msg);
    scheduleRetry();
    return { success: false, error: msg, pulledCount: 0, pushedCount };
  }
}

function shouldPull(
  key: string,
  remoteUpdatedAt: number,
  metaMap: Record<string, SyncMeta>,
  remoteDeleted: Record<string, any>
): boolean {
  if (remoteDeleted[key]) return false;
  const local = metaMap[key];
  if (!local) return true; // brand new on remote
  if (local.pendingUpload) return remoteUpdatedAt > local.updatedAt;
  return remoteUpdatedAt > local.updatedAt;
}

async function fetchRemoteList(endpoint: string, code: string, key: string): Promise<any[] | null> {
  try {
    const res = await fetch(
      `${endpoint}/api/sync/${encodeURIComponent(code)}/item/${encodeURIComponent(key)}`,
      { method: 'GET', cache: 'no-store' }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch (e) {}
  return null;
}

async function prepareUpload(
  key: string,
  localVal: any,
  remoteListForMerge: any[] | null
): Promise<{ ok: boolean; body?: Uint8Array; contentType?: string; size?: number; reason?: string }> {
  if (localVal == null) return { ok: false, reason: 'no local value' };

  if (key === DELETED_GAMES_KEY) {
    const ids = Array.isArray(localVal) ? localVal : Array.from(getDeletedGameIds());
    const merged = Array.from(new Set([...(remoteListForMerge || []), ...ids]));
    const body = new TextEncoder().encode(JSON.stringify(merged));
    return { ok: true, body, contentType: 'application/json', size: body.byteLength };
  }

  if (key === 'retro_games' || key === 'library_games') {
    const localGames = Array.isArray(localVal) ? localVal : [];
    const deletedSet = new Set(getDeletedGameIds());
    const merged = mergeAndDeduplicateGames(localGames, remoteListForMerge || [], false).filter(
      (g: any) => g && g.id && !deletedSet.has(g.id) && !DEMO_GAME_IDS.has(String(g.id))
    );
    const body = new TextEncoder().encode(JSON.stringify(merged));
    return { ok: true, body, contentType: 'application/json', size: body.byteLength };
  }

  if (isStateLikeKey(key)) {
    if (!localVal || typeof localVal !== 'object') return { ok: false, reason: 'no local value' };

    let serializable: any;
    try {
      serializable = JSON.parse(JSON.stringify({ ...localVal }));
    } catch (e) {
      return { ok: false, reason: 'state not serializable' };
    }
    delete serializable.emuState;
    if (serializable.stateData) delete serializable.stateData.emuState;

    const emuBytes = localVal.emuState ? normalizeBinaryData(localVal.emuState) : null;
    const stateBytes = localVal.stateData?.emuState ? normalizeBinaryData(localVal.stateData.emuState) : null;
    if (!emuBytes && !stateBytes) return { ok: false, reason: 'no save state payload' };

    const biggest = Math.max(emuBytes?.length || 0, stateBytes?.length || 0);
    if (biggest > CAP_STATE_BYTES) {
      return { ok: false, reason: `state too large (${biggest} > ${CAP_STATE_BYTES} bytes)`, size: biggest };
    }
    if (emuBytes) serializable.emuStateBase64 = uint8ToBase64(emuBytes);
    if (stateBytes) {
      serializable.stateData = { ...(serializable.stateData || {}), emuStateBase64: uint8ToBase64(stateBytes) };
    }
    const body = new TextEncoder().encode(JSON.stringify(serializable));
    return { ok: true, body, contentType: 'application/json', size: body.byteLength };
  }

  if (isBinaryKey(key)) {
    const bytes = normalizeBinaryData(localVal);
    if (!bytes || bytes.length === 0) return { ok: false, reason: 'empty or unrecognized binary' };
    if (bytes.length > CAP_SRAM_BYTES) {
      return {
        ok: false,
        reason: `${key.startsWith('srm:') ? 'SRAM' : 'RTC'} too large (${bytes.length} > ${CAP_SRAM_BYTES} bytes)`,
        size: bytes.length,
      };
    }
    return { ok: true, body: bytes, contentType: 'application/octet-stream', size: bytes.length };
  }

  if (key.startsWith('cover:')) {
    if (typeof localVal !== 'string') return { ok: false, reason: 'cover not a data URL' };
    if (localVal.length > CAP_COVER_BYTES) {
      return {
        ok: false,
        reason: `cover art too large (${localVal.length} > ${CAP_COVER_BYTES} bytes)`,
        size: localVal.length,
      };
    }
    const body = new TextEncoder().encode(localVal);
    return { ok: true, body, contentType: 'text/plain; charset=utf-8', size: body.byteLength };
  }

  return { ok: false, reason: 'unsupported key type' };
}

async function pullItems(opts: {
  endpoint: string;
  code: string;
  keys: string[];
  remoteItems: VaultIndex['items'];
  metaMap: Record<string, SyncMeta>;
  updatedLocalKeys: string[];
  touchedThisRun: Set<string>;
  skipped: SyncReport['skipped'];
  errors: SyncReport['errors'];
}): Promise<number> {
  const { endpoint, code, keys, remoteItems, metaMap, updatedLocalKeys, touchedThisRun, skipped, errors } = opts;
  let pulledCount = 0;

  const pullOne = async (rKey: string) => {
    try {
      const url = `${endpoint}/api/sync/${encodeURIComponent(code)}/item/${encodeURIComponent(rKey)}`;
      const res = await fetch(url, { method: 'GET', cache: 'no-store' });
      if (res.status === 404) return; // gone; index will self-correct next sync
      if (!res.ok) {
        errors.push({ key: rKey, message: `Download failed: HTTP ${res.status}` });
        return;
      }

      const serverTs =
        Number(res.headers.get('X-Retro-Updated-At')) || remoteItems[rKey]?.updatedAt || Date.now();
      const contentType = res.headers.get('Content-Type') || '';

      if (contentType.includes('application/json')) {
        let data: any;
        try {
          data = await res.json();
        } catch (e) {
          errors.push({ key: rKey, message: 'Malformed JSON item on vault' });
          return;
        }
        await applyJsonItem(rKey, data, updatedLocalKeys, skipped);
      } else if (contentType.includes('octet-stream')) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        await idbPut(rKey, bytes);
        if (rKey.startsWith('srm:')) {
          await idbDelete(`autosave:${rKey.slice('srm:'.length)}`).catch(() => {});
        }
        updatedLocalKeys.push(rKey);
      } else if (contentType.startsWith('text/')) {
        // cover art data-URL strings (plain text)
        const str = await res.text();
        await idbPut(rKey, str).catch(() => {});
        updatedLocalKeys.push(rKey);
      } else {
        errors.push({ key: rKey, message: `Unknown content type: ${contentType}` });
        return;
      }

      metaMap[rKey] = { updatedAt: serverTs, pendingUpload: false };
      touchedThisRun.add(rKey);
      pulledCount++;
    } catch (itemErr: any) {
      console.warn(`[CloudSync] Error saving downloaded item ${rKey}:`, itemErr);
      errors.push({ key: rKey, message: itemErr?.message || String(itemErr) });
    }
  };

  const queue = [...keys];
  const runners = Array.from(
    { length: Math.min(MAX_CONCURRENT_PULLS, queue.length) },
    async () => {
      while (queue.length > 0) {
        const next = queue.shift();
        if (next) await pullOne(next);
      }
    }
  );
  await Promise.all(runners);
  return pulledCount;
}

async function applyJsonItem(
  rKey: string,
  data: any,
  updatedLocalKeys: string[],
  skipped: SyncReport['skipped']
): Promise<void> {
  if (rKey === DELETED_GAMES_KEY) {
    if (Array.isArray(data)) {
      const merged = Array.from(new Set([...getDeletedGameIds(), ...data]));
      localStorage.setItem(DELETED_GAMES_KEY, JSON.stringify(merged));
      updatedLocalKeys.push(DELETED_GAMES_KEY);
    }
    return;
  }

  if (rKey === 'retro_games' || rKey === 'library_games') {
    if (!Array.isArray(data)) {
      skipped.push({ key: rKey, size: 0, reason: 'malformed games list on vault' });
      return;
    }
    const deletedSet = new Set(getDeletedGameIds());
    let localList: any[] = [];
    if (rKey === 'retro_games') {
      try { localList = JSON.parse(localStorage.getItem('retro_games') || '[]'); } catch (e) {}
    } else {
      localList = (await idbGet('library_games').catch(() => [])) || [];
      if (!Array.isArray(localList)) localList = [];
    }
    const filteredLocal = localList.filter((g: any) => g && g.id && !deletedSet.has(g.id));
    const filteredRemote = data.filter((g: any) => g && g.id && !deletedSet.has(g.id));
    const merged = mergeAndDeduplicateGames(filteredLocal, filteredRemote, true).filter(
      (g: any) => g && g.id && !deletedSet.has(g.id)
    );

    if (rKey === 'retro_games') {
      localStorage.setItem('retro_games', JSON.stringify(merged));
      // keep the IDB mirror in sync (dual-copy storage by design)
      await idbPut(
        'library_games',
        merged.filter((g: any) => g && g.real && !DEMO_GAME_IDS.has(String(g.id)))
      ).catch(() => {});
      updatedLocalKeys.push('retro_games', 'library_games');
    } else {
      await idbPut(
        'library_games',
        merged.filter((g: any) => g && g.real && !DEMO_GAME_IDS.has(String(g.id)))
      ).catch(() => {});
      updatedLocalKeys.push('library_games');
    }
    return;
  }

  if (isStateLikeKey(rKey)) {
    if (!data || typeof data !== 'object') return;
    if (data.emuStateBase64) data.emuState = base64ToUint8(data.emuStateBase64);
    if (data.stateData?.emuStateBase64) data.stateData.emuState = base64ToUint8(data.stateData.emuStateBase64);
    await idbPut(rKey, data);
    const gId = gameIdFromItemKey(rKey);
    if (gId) await idbDelete(`autosave:${gId}`).catch(() => {});
    updatedLocalKeys.push(rKey);
    return;
  }

  await idbPut(rKey, data);
  updatedLocalKeys.push(rKey);
}
