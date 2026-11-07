// ============================================================================
// RETROSTATION CLOUD SYNC ENGINE (GOOGLE DRIVE APPDATA + OFFLINE-FIRST)
// ----------------------------------------------------------------------------
// Architecture:
//   - Zero server cost ($0.00 forever): saves are stored directly in each
//     player's own Google Drive hidden `appDataFolder` via OAuth 2.0.
//   - One JSON file per item (`rs_v2_<encodeURIComponent(key)>.json`) with
//     lossless bijective key encoding (fixes the old `__` gameId corruption).
//   - All binary payloads (save states `Uint8Array`, SRAM `.srm`, RTC clocks)
//     are serialized as base64 inside valid JSON and restored to exact
//     `Uint8Array` instances on pull (fixes the old JSON.stringify Uint8Array
//     and binary `.srm` corruption bugs).
//   - ROM binaries are NEVER uploaded (prevents 20-50 MB mobile timeouts).
//   - Access tokens are cached with their expiry timestamp so page reloads
//     within the hour stay connected; expired sessions surface `needs_reauth`
//     cleanly and reconnect in one tap.
//   - Tombstones propagate deletions across devices and actually remove stale
//     files from Drive.
// ============================================================================

import { idbGet, idbPut, idbDelete, idbGetAllKeys } from './services/storage/idb';

declare global {
  interface Window {
    google?: any;
  }
}

export type CloudSyncStatus =
  | 'unlinked'
  | 'idle'
  | 'syncing'
  | 'needs_reauth'
  | 'offline'
  | 'error';

export interface GoogleUserProfile {
  email: string;
  name?: string;
  picture?: string;
}

export interface SyncStatusInfo {
  status: CloudSyncStatus;
  details: string;
  lastSyncTime: string | null;
  syncCode: string | null;
  user: GoogleUserProfile | null;
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
const CLIENT_ID_STORAGE_KEY = 'retro_google_client_id';
const USER_PROFILE_STORAGE_KEY = 'retro_google_user';
const TOKEN_STORAGE_KEY = 'retro_google_token';
const LAST_SYNC_TIME_KEY = 'retro_last_sync_time';
const SYNC_META_KEY = 'retro_sync_meta';
const DEVICE_ID_KEY = 'retro_device_id';
const DELETED_GAMES_KEY = 'retro_deleted_games';
const TOMBSTONES_DRIVE_FILENAME = 'rs_v2___tombstones__.json';

// Per-item size caps (visible in the sync report; no silent skips)
const CAP_STATE_BYTES = 10 * 1024 * 1024; // 10 MB state payload
const CAP_SRAM_BYTES = 5 * 1024 * 1024;   // 5 MB SRAM/RTC bytes
const CAP_COVER_BYTES = 1024 * 1024;      // 1 MB cover data URL
const MAX_CONCURRENT_PULLS = 4;

// Demo-only pseudo-games are never synced
const DEMO_GAME_IDS = new Set(['pokemon_gold']);

export const DEFAULT_GOOGLE_CLIENT_ID =
  '812701015700-srefneer1disk609pa2s4pqj7s2c8ln0.apps.googleusercontent.com';

// Persistent Device ID
export function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID().slice(0, 8)
          : `dev-${Math.random().toString(36).substring(2, 10)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch (e) {
    return 'dev-browser';
  }
}

// ============================================================================
// GOOGLE OAUTH 2.0 & USER PROFILE MANAGEMENT
// ============================================================================

export function getGoogleClientId(): string {
  try {
    const custom = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (custom && custom.trim()) return custom.trim();
    return (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;
  } catch (e) {
    return DEFAULT_GOOGLE_CLIENT_ID;
  }
}

export function setGoogleClientId(id: string | null): void {
  try {
    const clean = (id || '').trim();
    if (!clean || clean === DEFAULT_GOOGLE_CLIENT_ID) {
      localStorage.removeItem(CLIENT_ID_STORAGE_KEY);
    } else {
      localStorage.setItem(CLIENT_ID_STORAGE_KEY, clean);
    }
    tokenClient = null;
  } catch (e) {}
}

export function getCustomGoogleClientId(): string | null {
  try {
    return localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  } catch (e) {
    return null;
  }
}

export function getCachedUserProfile(): GoogleUserProfile | null {
  try {
    const raw = localStorage.getItem(USER_PROFILE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setCachedUserProfile(profile: GoogleUserProfile | null): void {
  try {
    if (profile) {
      localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } else {
      localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
    }
  } catch (e) {}
}

interface StoredToken {
  accessToken: string;
  expiresAt: number;
}

function loadStoredToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredToken;
    if (parsed?.accessToken && parsed?.expiresAt && Date.now() < parsed.expiresAt - 60_000) {
      return parsed;
    }
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch (e) {}
  return null;
}

function saveStoredToken(accessToken: string | null, expiresAt = 0): void {
  try {
    if (accessToken && expiresAt > Date.now()) {
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ accessToken, expiresAt }));
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch (e) {}
}

const initialToken = loadStoredToken();
let inMemoryAccessToken: string | null = initialToken?.accessToken || null;
let tokenExpiresAt: number = initialToken?.expiresAt || 0;
let tokenClient: any = null;

export function hasValidToken(): boolean {
  if (inMemoryAccessToken && Date.now() < tokenExpiresAt - 60_000) {
    return true;
  }
  const stored = loadStoredToken();
  if (stored) {
    inMemoryAccessToken = stored.accessToken;
    tokenExpiresAt = stored.expiresAt;
    return true;
  }
  return false;
}

// Compatibility helper used by App.tsx / SettingsModal.tsx to check if cloud sync is linked
export function getSyncCode(): string | null {
  const user = getCachedUserProfile();
  if (user?.email) return user.email;
  if (hasValidToken()) return 'google-drive';
  return null;
}

// Dynamically load Google Identity Services script
let gisLoadingPromise: Promise<boolean> | null = null;
export async function loadGisScript(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (window.google?.accounts?.oauth2) return true;
  if (gisLoadingPromise) return gisLoadingPromise;

  gisLoadingPromise = new Promise<boolean>((resolve) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      gisLoadingPromise = null;
      resolve(false);
      return;
    }
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => {
        gisLoadingPromise = null;
        resolve(false);
      });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn('[CloudSync] GIS script failed to load.');
      gisLoadingPromise = null;
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return gisLoadingPromise;
}

async function fetchUserProfile(token: string): Promise<GoogleUserProfile | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      const profile: GoogleUserProfile = {
        email: data.email || 'Google Drive Connected',
        name: data.name || data.given_name || 'Player',
        picture: data.picture || '',
      };
      setCachedUserProfile(profile);
      notifyStatusListeners();
      return profile;
    }
  } catch (e) {}
  return null;
}

async function initTokenClient(): Promise<any> {
  const clientId = getGoogleClientId();
  if (!clientId) {
    setStatus('unlinked', 'Google Client ID not configured');
    return null;
  }

  const loaded = await loadGisScript();
  if (!loaded || !window.google?.accounts?.oauth2) {
    setStatus(
      typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error',
      'Google Identity Services unavailable'
    );
    return null;
  }

  try {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope:
        'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
      callback: () => {},
    });
    return tokenClient;
  } catch (err: any) {
    console.error('[CloudSync] Failed to initialize token client:', err);
    setStatus('error', err?.message || 'Failed to initialize Google OAuth');
    return null;
  }
}

export async function ensureToken(interactive = false): Promise<string | null> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setStatus('offline', 'Offline (saves kept locally)');
    return null;
  }

  if (hasValidToken() && inMemoryAccessToken) {
    return inMemoryAccessToken;
  }

  // Never trigger popup in background when not interactive
  if (!interactive) {
    if (getCachedUserProfile()) {
      setStatus('needs_reauth', 'Session expired — tap Reconnect or Sync Now');
    } else {
      setStatus('unlinked', 'Not signed in');
    }
    return null;
  }

  if (!tokenClient) {
    await initTokenClient();
  }
  if (!tokenClient) return null;

  return new Promise<string | null>((resolve) => {
    let settled = false;
    const finish = (token: string | null) => {
      if (settled) return;
      settled = true;
      resolve(token);
    };

    tokenClient.callback = async (resp: any) => {
      if (resp?.error) {
        if (
          resp.error === 'interaction_required' ||
          resp.error === 'consent_required' ||
          resp.error === 'access_denied'
        ) {
          setStatus('needs_reauth', 'Sign-in cancelled or requires approval');
        } else {
          setStatus('error', resp.error_description || resp.error);
        }
        finish(null);
        return;
      }

      if (resp?.access_token) {
        inMemoryAccessToken = resp.access_token;
        const expiresInSec = Number(resp.expires_in) || 3599;
        tokenExpiresAt = Date.now() + (expiresInSec - 60) * 1000;
        saveStoredToken(inMemoryAccessToken, tokenExpiresAt);
        if (!getCachedUserProfile()) {
          setCachedUserProfile({ email: 'Google Drive User', name: 'Player' });
        }
        await fetchUserProfile(resp.access_token);
        setStatus('idle', 'Connected to Google Drive');
        finish(resp.access_token);
      } else {
        finish(null);
      }
    };

    tokenClient.error_callback = (err: any) => {
      const msg = err?.message || err?.type || 'Sign-in window closed';
      setStatus(getCachedUserProfile() ? 'needs_reauth' : 'unlinked', msg);
      finish(null);
    };

    try {
      const cached = getCachedUserProfile();
      const reqOpts: Record<string, string> = { prompt: '' };
      if (cached?.email && cached.email.includes('@')) {
        reqOpts.hint = cached.email;
      }
      tokenClient.requestAccessToken(reqOpts);
    } catch (err: any) {
      setStatus('error', err?.message || 'Could not open Google sign-in');
      finish(null);
    }
  });
}

export async function signInWithGoogle(): Promise<boolean> {
  const token = await ensureToken(true);
  if (!token) return false;
  return true;
}

export async function signOutGoogle(): Promise<void> {
  const tok = inMemoryAccessToken;
  inMemoryAccessToken = null;
  tokenExpiresAt = 0;
  saveStoredToken(null, 0);
  setCachedUserProfile(null);
  try {
    localStorage.removeItem(LAST_SYNC_TIME_KEY);
  } catch (e) {}
  if (tok && typeof window !== 'undefined' && window.google?.accounts?.oauth2?.revoke) {
    try {
      window.google.accounts.oauth2.revoke(tok, () => {});
    } catch (e) {}
  }
  setStatus('unlinked', 'Disconnected from Google Drive');
}

// ============================================================================
// TOMBSTONE MANAGEMENT
// ============================================================================

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

// ============================================================================
// STATUS STATE & LISTENERS
// ============================================================================

function getInitialStatus(): { status: CloudSyncStatus; details: string } {
  try {
    const user = getCachedUserProfile();
    const valid = hasValidToken();
    if (!user && !valid) return { status: 'unlinked', details: 'Not signed in to Google Drive' };
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { status: 'offline', details: 'Offline (saves kept locally)' };
    }
    if (!valid) {
      return { status: 'needs_reauth', details: 'Session expired — tap Sync Now to reconnect' };
    }
    const lastSync = localStorage.getItem(LAST_SYNC_TIME_KEY);
    return {
      status: 'idle',
      details: lastSync ? `Synced (${lastSync})` : 'Connected to Google Drive',
    };
  } catch (e) {
    return { status: 'unlinked', details: '' };
  }
}

const initStatus = getInitialStatus();
let currentStatus: CloudSyncStatus = initStatus.status;
let statusDetails = initStatus.details;
const statusListeners = new Set<(status: CloudSyncStatus, details: string) => void>();

function notifyStatusListeners() {
  statusListeners.forEach((fn) => {
    try {
      fn(currentStatus, statusDetails);
    } catch (e) {}
  });
}

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
    user: getCachedUserProfile(),
  };
}

export function subscribeSyncStatus(
  listener: (status: CloudSyncStatus, details: string) => void
): () => void {
  statusListeners.add(listener);
  listener(currentStatus, statusDetails);
  return () => statusListeners.delete(listener);
}

function setStatus(status: CloudSyncStatus, details = '') {
  currentStatus = status;
  statusDetails = details;
  notifyStatusListeners();
}

const dataUpdateListeners = new Set<(updatedKeys: string[]) => void>();

export function onDataUpdated(listener: (updatedKeys: string[]) => void): () => void {
  dataUpdateListeners.add(listener);
  return () => dataUpdateListeners.delete(listener);
}

function notifyDataUpdated(updatedKeys: string[]) {
  if (updatedKeys.length === 0) return;
  dataUpdateListeners.forEach((fn) => {
    try {
      fn(updatedKeys);
    } catch (e) {}
  });
}

let lastSyncReport: SyncReport = { ...EMPTY_SYNC_REPORT };
export function getSyncReport(): SyncReport {
  return lastSyncReport;
}

// ============================================================================
// KEY FILTERING, FILENAME ENCODING & BINARY HELPERS
// ============================================================================

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
const isItemKey = (key: string) =>
  isStateLikeKey(key) || isBinaryKey(key) || key.startsWith('cover:');

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

export function keyToDriveFilename(key: string): string {
  return `rs_v2_${encodeURIComponent(key)}.json`;
}

export function driveFilenameToKey(filename: string): string | null {
  if (!filename || filename === TOMBSTONES_DRIVE_FILENAME) return null;
  if (filename.startsWith('rs_v2_') && filename.endsWith('.json')) {
    try {
      const k = decodeURIComponent(filename.slice('rs_v2_'.length, -'.json'.length));
      return isSyncableKey(k) ? k : null;
    } catch (e) {
      return null;
    }
  }
  // Legacy v1 filename support (reads older saves if present in appDataFolder)
  if (filename === 'retro_library_games.json') return 'library_games';
  if (
    filename.startsWith('retro_') &&
    filename.endsWith('.json') &&
    !filename.includes('.conflict.bak')
  ) {
    const raw = filename.slice('retro_'.length, -'.json'.length);
    if (raw.startsWith('state__')) {
      const rest = raw.slice('state__'.length);
      const lastSep = rest.lastIndexOf('__');
      if (lastSep > 0) {
        const gId = rest.slice(0, lastSep);
        const slot = rest.slice(lastSep + 2);
        return `state:${gId}:${slot}`;
      }
    }
    if (raw.startsWith('srm__')) return `srm:${raw.slice('srm__'.length)}`;
    if (raw.startsWith('rtc__')) return `rtc:${raw.slice('rtc__'.length)}`;
  }
  return null;
}

export function mergeAndDeduplicateGames(
  localList: any[],
  remoteList: any[] = [],
  preferRemote = true
): any[] {
  const deletedSet = new Set(getDeletedGameIds());
  const result: any[] = [];

  const getKey = (g: any) => {
    const titleKey =
      g?.title && g?.core
        ? `${String(g.title).trim().toLowerCase()}::${String(g.core).toLowerCase()}`
        : null;
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
        const aliases = Array.from(
          new Set([...(result[idx].aliasIds || []), ...(g.aliasIds || []), result[idx].id, g.id])
        );
        result[idx] = { ...result[idx], ...g, aliasIds: aliases };
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
        const aliases = Array.from(
          new Set([...(result[idx].aliasIds || []), ...(g.aliasIds || []), result[idx].id, g.id])
        );
        if (!preferRemote) {
          result[idx] = { ...result[idx], ...g, aliasIds: aliases };
        } else {
          result[idx] = { ...result[idx], aliasIds: aliases };
        }
      } else {
        result.push({ ...g });
      }
    }
  }

  return result.filter((g) => g && g.id && !deletedSet.has(g.id));
}

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
    if (typeof (val as any).base64 === 'string') {
      return base64ToUint8((val as any).base64);
    }
    const keys = Object.keys(val);
    if (keys.length > 0 && keys[0] === '0' && typeof (val as any)[0] === 'number') {
      const vals = Object.values(val);
      if (typeof vals[0] === 'number') {
        bytes = new Uint8Array(vals as number[]);
      }
    }
  }

  if (bytes && bytes.length > 4) {
    if (
      (bytes[0] === 0x7b &&
        bytes[1] === 0x22 &&
        bytes[2] === 0x30 &&
        bytes[3] === 0x22 &&
        bytes[4] === 0x3a) ||
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
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, Math.min(i + chunkSize, len)) as any
    );
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

// ============================================================================
// LOCAL SYNC METADATA & SCHEDULING
// ============================================================================

interface SyncMeta {
  updatedAt: number;
  pendingUpload?: boolean;
  fileId?: string;
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
  if (key.startsWith('autosave:') || key.startsWith('rom:') || key.startsWith('rom_')) return;
  const map = getLocalMetaMap();
  map[key] = {
    ...map[key],
    updatedAt: Date.now(),
    pendingUpload: true,
  };
  saveLocalMetaMap(map);
  // Save states and battery saves sync quickly (2.5s) even while in-game
  const isUrgentSave = key.startsWith('state:') || key.startsWith('srm:') || key.startsWith('rtc:');
  triggerDebouncedCloudSync(isUrgentSave ? 2500 : 8000, isUrgentSave);
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let gameplayActive = false;
let deferredSyncPending = false;

export function setGameplayActive(active: boolean): void {
  gameplayActive = active;
  if (!active && deferredSyncPending) {
    deferredSyncPending = false;
    if (hasValidToken() && typeof navigator !== 'undefined' && navigator.onLine) {
      triggerDebouncedCloudSync(2000, true);
    }
  }
}

export function triggerDebouncedCloudSync(delayMs = 8000, allowDuringGameplay = false) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    if (gameplayActive && !allowDuringGameplay) {
      deferredSyncPending = true;
      return;
    }
    if (hasValidToken() && typeof navigator !== 'undefined' && navigator.onLine) {
      syncNow(false).catch((e) => console.warn('[CloudSync] Auto-sync warning:', e));
    }
  }, delayMs);
}

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
  if (['syncing', 'offline', 'unlinked', 'needs_reauth'].includes(currentStatus)) return;
  const delay = RETRY_DELAYS[Math.min(retryAttempt, RETRY_DELAYS.length - 1)];
  retryAttempt++;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (hasValidToken() && navigator.onLine && !gameplayActive) {
      syncNow(false).catch(() => {});
    } else if (hasValidToken() && gameplayActive) {
      deferredSyncPending = true;
    }
  }, delay);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (getCachedUserProfile()) {
      if (hasValidToken()) {
        setStatus('idle', 'Back online; syncing...');
        resetRetryTimer();
        syncNow(false).catch(() => {});
      } else {
        setStatus('needs_reauth', 'Session expired — tap Sync Now');
      }
    }
  });

  window.addEventListener('offline', () => {
    if (getCachedUserProfile()) {
      setStatus('offline', 'Offline (saves kept locally)');
    }
  });
}

// ============================================================================
// GOOGLE DRIVE REST API HELPERS (appDataFolder)
// ============================================================================

interface DriveFileEntry {
  id: string;
  name: string;
  modifiedTime: string;
  updatedAt: number;
  size: number;
}

async function listAppDataFiles(token: string): Promise<DriveFileEntry[]> {
  const results: DriveFileEntry[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      spaces: 'appDataFolder',
      q: 'trashed=false',
      fields: 'nextPageToken,files(id,name,modifiedTime,size)',
      pageSize: '500',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (res.status === 401) {
      inMemoryAccessToken = null;
      saveStoredToken(null, 0);
      setStatus('needs_reauth', 'Session expired — tap Reconnect');
      throw new Error('Google Drive session expired. Please tap Reconnect.');
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Drive list failed (HTTP ${res.status}): ${txt.slice(0, 120)}`);
    }

    const data = await res.json();
    for (const f of data.files || []) {
      results.push({
        id: f.id,
        name: f.name,
        modifiedTime: f.modifiedTime,
        updatedAt: Date.parse(f.modifiedTime) || 0,
        size: Number(f.size) || 0,
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return results;
}

async function downloadDriveJson(token: string, fileId: string): Promise<any> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Download failed: HTTP ${res.status}`);
  }
  return await res.json();
}

async function uploadDriveJson(
  token: string,
  filename: string,
  jsonString: string,
  existingFileId?: string
): Promise<{ id: string; updatedAt: number }> {
  const boundary = '-------rs_drive_' + Math.random().toString(36).slice(2);
  const metadata = existingFileId
    ? { name: filename, mimeType: 'application/json' }
    : { name: filename, mimeType: 'application/json', parents: ['appDataFolder'] };

  const headerPart =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n`;
  const footerPart = `\r\n--${boundary}--`;
  const multipartBlob = new Blob([headerPart, jsonString, footerPart], {
    type: `multipart/related; boundary=${boundary}`,
  });

  const url = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingFileId)}?uploadType=multipart&fields=id,name,modifiedTime`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime`;

  const method = existingFileId ? 'PATCH' : 'POST';
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBlob,
  });

  if (res.status === 404 && existingFileId) {
    return uploadDriveJson(token, filename, jsonString, undefined);
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Upload failed (HTTP ${res.status}): ${errText.slice(0, 120)}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    updatedAt: Date.parse(data.modifiedTime) || Date.now(),
  };
}

async function deleteDriveFile(token: string, fileId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return res.ok || res.status === 404;
  } catch (e) {
    return false;
  }
}

export async function deleteAllCloudSaves(): Promise<boolean> {
  const token = await ensureToken(true);
  if (!token) return false;

  setStatus('syncing', 'Clearing Google Drive saves...');
  try {
    const files = await listAppDataFiles(token);
    for (const f of files) {
      await deleteDriveFile(token, f.id);
    }
    saveLocalMetaMap({});
    setStatus('idle', 'Google Drive saves cleared');
    return true;
  } catch (err: any) {
    setStatus('error', err?.message || 'Failed to clear cloud saves');
    return false;
  }
}

// ============================================================================
// GOOGLE DRIVE SYNC ENGINE
// ============================================================================

let activeSyncPromise: Promise<{
  success: boolean;
  error?: string;
  pulledCount: number;
  pushedCount: number;
}> | null = null;

export async function syncNow(forceInteractive = false): Promise<{
  success: boolean;
  error?: string;
  pulledCount: number;
  pushedCount: number;
}> {
  if (activeSyncPromise) {
    if (forceInteractive) {
      await activeSyncPromise.catch(() => {});
      return executeSync(true);
    }
    return activeSyncPromise;
  }
  activeSyncPromise = executeSync(forceInteractive);
  try {
    return await activeSyncPromise;
  } finally {
    activeSyncPromise = null;
  }
}

interface RemoteTombstones {
  deletedItems: Record<string, number>;
  deletedGames: string[];
}

async function executeSync(interactive = false): Promise<{
  success: boolean;
  error?: string;
  pulledCount: number;
  pushedCount: number;
}> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setStatus('offline', 'Offline (changes kept locally)');
    return { success: false, error: 'Device is offline', pulledCount: 0, pushedCount: 0 };
  }

  const token = await ensureToken(interactive);
  if (!token) {
    const errMsg = getCachedUserProfile()
      ? 'Google Drive session expired — tap Reconnect or Sync Now'
      : 'Not signed in to Google Drive';
    return { success: false, error: errMsg, pulledCount: 0, pushedCount: 0 };
  }

  setStatus('syncing', 'Syncing with Google Drive...');

  const metaMap = getLocalMetaMap();
  const updatedLocalKeys: string[] = [];
  const touchedThisRun = new Set<string>();
  const skipped: SyncReport['skipped'] = [];
  const errors: SyncReport['errors'] = [];
  let pulledCount = 0;
  let pushedCount = 0;

  try {
    // -------- 1. List all files in Google Drive appDataFolder --------
    const allFiles = await listAppDataFiles(token);
    const remoteItems: Record<string, DriveFileEntry> = {};
    let tombstonesFile: DriveFileEntry | null = null;

    for (const f of allFiles) {
      if (f.name === TOMBSTONES_DRIVE_FILENAME) {
        if (!tombstonesFile || f.updatedAt > tombstonesFile.updatedAt) {
          tombstonesFile = f;
        }
        continue;
      }
      const key = driveFilenameToKey(f.name);
      if (!key) continue;

      const existing = remoteItems[key];
      if (!existing) {
        remoteItems[key] = f;
      } else {
        // Deduplicate if multiple files for the same key exist; keep newest
        if (f.updatedAt >= existing.updatedAt) {
          deleteDriveFile(token, existing.id).catch(() => {});
          remoteItems[key] = f;
        } else {
          deleteDriveFile(token, f.id).catch(() => {});
        }
      }
    }

    let remoteTombstones: RemoteTombstones = { deletedItems: {}, deletedGames: [] };
    if (tombstonesFile) {
      try {
        const tData = await downloadDriveJson(token, tombstonesFile.id);
        if (tData && typeof tData === 'object') {
          remoteTombstones = {
            deletedItems: tData.deletedItems || {},
            deletedGames: Array.isArray(tData.deletedGames) ? tData.deletedGames : [],
          };
        }
      } catch (e) {}
    }

    let tombstonesDirty = false;
    const mergedDeletedGames = new Set<string>([
      ...getDeletedGameIds(),
      ...remoteTombstones.deletedGames,
    ]);
    if (mergedDeletedGames.size !== getDeletedGameIds().length) {
      localStorage.setItem(DELETED_GAMES_KEY, JSON.stringify(Array.from(mergedDeletedGames)));
      updatedLocalKeys.push(DELETED_GAMES_KEY);
    }
    if (mergedDeletedGames.size !== remoteTombstones.deletedGames.length) {
      remoteTombstones.deletedGames = Array.from(mergedDeletedGames);
      tombstonesDirty = true;
    }

    // -------- 2. Pull phase: download remote items newer than local --------
    const pullKeys = Object.keys(remoteItems).filter((k) => {
      const owningGame = isItemKey(k) ? gameIdFromItemKey(k) : null;
      if (owningGame && mergedDeletedGames.has(owningGame)) return false;
      const rItem = remoteItems[k];
      const tombTs = remoteTombstones.deletedItems[k] || 0;
      if (tombTs > rItem.updatedAt) return false;
      const local = metaMap[k];
      if (!local) return true;
      return rItem.updatedAt > local.updatedAt;
    });

    pulledCount = await pullItemsFromDrive({
      token,
      keys: pullKeys,
      remoteItems,
      metaMap,
      updatedLocalKeys,
      touchedThisRun,
      skipped,
      errors,
    });

    // -------- 3. Push & Reconcile phase --------
    const candidates = new Set<string>(['retro_games', 'library_games', DELETED_GAMES_KEY]);
    for (const k of Object.keys(metaMap)) if (isSyncableKey(k)) candidates.add(k);
    for (const k of Object.keys(remoteItems)) if (isSyncableKey(k)) candidates.add(k);
    try {
      const idbKeys = await idbGetAllKeys();
      for (const k of idbKeys) {
        const ks = String(k);
        if (isSyncableKey(ks)) candidates.add(ks);
      }
    } catch (e) {}

    for (const key of Array.from(candidates)) {
      if (touchedThisRun.has(key)) continue;
      const localMeta = metaMap[key];
      const remote = remoteItems[key];
      const remoteTombTs = remoteTombstones.deletedItems[key] || 0;

      // Purge any remote files belonging to a deleted game
      const owningGameId = isItemKey(key) ? gameIdFromItemKey(key) : null;
      if (owningGameId && mergedDeletedGames.has(owningGameId)) {
        if (remote) {
          await deleteDriveFile(token, remote.id);
          delete remoteItems[key];
        }
        delete metaMap[key];
        continue;
      }

      // Load local value
      let localVal: any = null;
      if (key === 'retro_games') {
        try {
          localVal = JSON.parse(localStorage.getItem('retro_games') || 'null');
        } catch (e) {}
      } else if (key === DELETED_GAMES_KEY) {
        localVal = Array.from(mergedDeletedGames);
      } else if (key === 'library_games' || isItemKey(key)) {
        localVal = await idbGet(key).catch(() => null);
      }

      // Remote tombstoned this item
      if (remoteTombTs > 0 && (!remote || remoteTombTs > remote.updatedAt)) {
        if (localVal != null && localMeta?.pendingUpload && localMeta.updatedAt > remoteTombTs) {
          // Local has a fresher edit; re-upload below and clear tombstone
          delete remoteTombstones.deletedItems[key];
          tombstonesDirty = true;
        } else {
          if (localVal != null && isItemKey(key)) {
            await idbDelete(key).catch(() => {});
            delete metaMap[key];
            updatedLocalKeys.push(key);
          }
          touchedThisRun.add(key);
          continue;
        }
      }

      // Local item was deleted on this device (we have localMeta, no localVal, and remote exists)
      if (remote && localVal == null && localMeta && isItemKey(key)) {
        await deleteDriveFile(token, remote.id);
        remoteTombstones.deletedItems[key] = Date.now();
        tombstonesDirty = true;
        delete metaMap[key];
        touchedThisRun.add(key);
        continue;
      }

      if (localVal == null) continue;

      if (remote && remote.updatedAt > (localMeta?.updatedAt || 0) && !localMeta?.pendingUpload) {
        continue;
      }

      const needsPush =
        Boolean(localMeta?.pendingUpload) ||
        !remote ||
        (localMeta?.updatedAt || 0) > remote.updatedAt;

      if (!needsPush) continue;

      // For game list keys, merge with remote list before pushing
      let remoteListForMerge: any[] | null = null;
      if ((key === 'retro_games' || key === 'library_games') && remote) {
        try {
          const rList = await downloadDriveJson(token, remote.id);
          if (Array.isArray(rList)) remoteListForMerge = rList;
        } catch (e) {}
      }

      const prepared = prepareDrivePayload(key, localVal, remoteListForMerge);
      if (!prepared.ok || !prepared.jsonString) {
        if (prepared.reason && prepared.reason !== 'no local value') {
          skipped.push({ key, size: prepared.size || 0, reason: prepared.reason });
        }
        continue;
      }

      try {
        const driveFilename = keyToDriveFilename(key);
        const uploaded = await uploadDriveJson(
          token,
          driveFilename,
          prepared.jsonString,
          remote?.id
        );
        metaMap[key] = {
          updatedAt: uploaded.updatedAt,
          pendingUpload: false,
          fileId: uploaded.id,
        };
        if (remoteTombstones.deletedItems[key]) {
          delete remoteTombstones.deletedItems[key];
          tombstonesDirty = true;
        }
        touchedThisRun.add(key);
        pushedCount++;
      } catch (upErr: any) {
        errors.push({ key, message: upErr?.message || 'Upload failed' });
        if (localMeta) metaMap[key] = { ...localMeta, pendingUpload: true };
      }
    }

    if (tombstonesDirty) {
      try {
        await uploadDriveJson(
          token,
          TOMBSTONES_DRIVE_FILENAME,
          JSON.stringify(remoteTombstones),
          tombstonesFile?.id
        );
      } catch (e) {}
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
      revision: Date.now(),
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
    console.error('[CloudSync] Google Drive sync error:', err);
    const msg = err?.message || 'Google Drive sync failed';
    lastSyncReport = {
      at: Date.now(),
      success: false,
      pulled: pulledCount,
      pushed: pushedCount,
      skipped,
      errors: [{ message: msg }],
      revision: 0,
    };
    if (currentStatus !== 'needs_reauth') {
      setStatus('error', msg);
      scheduleRetry();
    }
    return { success: false, error: msg, pulledCount, pushedCount };
  }
}

function prepareDrivePayload(
  key: string,
  localVal: any,
  remoteListForMerge: any[] | null
): { ok: boolean; jsonString?: string; size?: number; reason?: string } {
  if (localVal == null) return { ok: false, reason: 'no local value' };

  if (key === DELETED_GAMES_KEY) {
    const ids = Array.isArray(localVal) ? localVal : getDeletedGameIds();
    const merged = Array.from(new Set([...(remoteListForMerge || []), ...ids]));
    const jsonString = JSON.stringify(merged);
    return { ok: true, jsonString, size: jsonString.length };
  }

  if (key === 'retro_games' || key === 'library_games') {
    const localGames = Array.isArray(localVal) ? localVal : [];
    const deletedSet = new Set(getDeletedGameIds());
    const merged = mergeAndDeduplicateGames(localGames, remoteListForMerge || [], true).filter(
      (g: any) => g && g.id && !deletedSet.has(g.id) && !DEMO_GAME_IDS.has(String(g.id))
    );
    const jsonString = JSON.stringify(merged);
    return { ok: true, jsonString, size: jsonString.length };
  }

  if (isStateLikeKey(key)) {
    if (!localVal || typeof localVal !== 'object') return { ok: false, reason: 'no local value' };

    // Extract raw binary BEFORE cloning metadata so JSON.stringify never touches multi-MB Uint8Arrays
    const { emuState: rawEmuState, stateData: rawStateData, ...restMeta } = localVal;
    const serializable: any = { ...restMeta };
    if (rawStateData && typeof rawStateData === 'object') {
      const { emuState: _nestedEmu, ...restStateData } = rawStateData;
      serializable.stateData = { ...restStateData };
    }

    const emuBytes = rawEmuState ? normalizeBinaryData(rawEmuState) : null;
    const stateBytes = rawStateData?.emuState
      ? normalizeBinaryData(rawStateData.emuState)
      : null;
    const existingB64 =
      localVal.emuStateBase64 || rawStateData?.emuStateBase64 || null;

    if (!emuBytes && !stateBytes && !existingB64) {
      return { ok: false, reason: 'no save state payload' };
    }

    const biggest = Math.max(emuBytes?.length || 0, stateBytes?.length || 0);
    if (biggest > CAP_STATE_BYTES) {
      return {
        ok: false,
        reason: `state too large (${biggest} > ${CAP_STATE_BYTES} bytes)`,
        size: biggest,
      };
    }
    if (emuBytes) serializable.emuStateBase64 = uint8ToBase64(emuBytes);
    if (stateBytes) {
      serializable.stateData = {
        ...(serializable.stateData || {}),
        emuStateBase64: uint8ToBase64(stateBytes),
      };
    }
    const jsonString = JSON.stringify(serializable);
    return { ok: true, jsonString, size: jsonString.length };
  }

  if (isBinaryKey(key)) {
    const bytes = normalizeBinaryData(localVal);
    if (!bytes || bytes.length === 0) {
      return { ok: false, reason: 'empty or unrecognized binary' };
    }
    if (bytes.length > CAP_SRAM_BYTES) {
      return {
        ok: false,
        reason: `${key.startsWith('srm:') ? 'SRAM' : 'RTC'} too large (${bytes.length} > ${CAP_SRAM_BYTES} bytes)`,
        size: bytes.length,
      };
    }
    const jsonString = JSON.stringify({
      __rsBinary: true,
      key,
      base64: uint8ToBase64(bytes),
    });
    return { ok: true, jsonString, size: bytes.length };
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
    const jsonString = JSON.stringify({
      __rsCover: true,
      dataUrl: localVal,
    });
    return { ok: true, jsonString, size: localVal.length };
  }

  return { ok: false, reason: 'unsupported key type' };
}

async function pullItemsFromDrive(opts: {
  token: string;
  keys: string[];
  remoteItems: Record<string, DriveFileEntry>;
  metaMap: Record<string, SyncMeta>;
  updatedLocalKeys: string[];
  touchedThisRun: Set<string>;
  skipped: SyncReport['skipped'];
  errors: SyncReport['errors'];
}): Promise<number> {
  const {
    token,
    keys,
    remoteItems,
    metaMap,
    updatedLocalKeys,
    touchedThisRun,
    skipped,
    errors,
  } = opts;
  let pulledCount = 0;

  const pullOne = async (rKey: string) => {
    const entry = remoteItems[rKey];
    if (!entry) return;
    try {
      const data = await downloadDriveJson(token, entry.id);
      if (data == null) return;

      await applyPulledItem(rKey, data, updatedLocalKeys, skipped);

      metaMap[rKey] = {
        updatedAt: entry.updatedAt || Date.now(),
        pendingUpload: false,
        fileId: entry.id,
      };
      touchedThisRun.add(rKey);
      pulledCount++;
    } catch (itemErr: any) {
      console.warn(`[CloudSync] Error pulling ${rKey} from Drive:`, itemErr);
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

async function applyPulledItem(
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
      skipped.push({ key: rKey, size: 0, reason: 'malformed games list on Drive' });
      return;
    }
    const deletedSet = new Set(getDeletedGameIds());
    let localList: any[] = [];
    if (rKey === 'retro_games') {
      try {
        localList = JSON.parse(localStorage.getItem('retro_games') || '[]');
      } catch (e) {}
    } else {
      localList = (await idbGet('library_games').catch(() => [])) || [];
      if (!Array.isArray(localList)) localList = [];
    }
    const filteredLocal = localList.filter((g: any) => g && g.id && !deletedSet.has(g.id));
    const filteredRemote = data.filter((g: any) => g && g.id && !deletedSet.has(g.id));
    const merged = mergeAndDeduplicateGames(filteredLocal, filteredRemote, true).filter(
      (g: any) => g && g.id && !deletedSet.has(g.id)
    );

    localStorage.setItem('retro_games', JSON.stringify(merged));
    await idbPut(
      'library_games',
      merged.filter((g: any) => g && g.real && !DEMO_GAME_IDS.has(String(g.id)))
    ).catch(() => {});
    updatedLocalKeys.push('retro_games', 'library_games');
    return;
  }

  if (isStateLikeKey(rKey)) {
    if (!data || typeof data !== 'object') return;
    if (data.emuStateBase64) {
      data.emuState = base64ToUint8(data.emuStateBase64);
    } else if (data.emuState) {
      const repaired = normalizeBinaryData(data.emuState);
      if (repaired) data.emuState = repaired;
    }
    if (data.stateData?.emuStateBase64) {
      data.stateData.emuState = base64ToUint8(data.stateData.emuStateBase64);
    } else if (data.stateData?.emuState) {
      const repaired = normalizeBinaryData(data.stateData.emuState);
      if (repaired) data.stateData.emuState = repaired;
    }
    await idbPut(rKey, data);
    const gId = gameIdFromItemKey(rKey);
    if (gId) await idbDelete(`autosave:${gId}`).catch(() => {});
    updatedLocalKeys.push(rKey);
    return;
  }

  if (isBinaryKey(rKey)) {
    const bytes = normalizeBinaryData(data);
    if (!bytes || bytes.length === 0) {
      skipped.push({ key: rKey, size: 0, reason: 'corrupt or empty binary on Drive' });
      return;
    }
    await idbPut(rKey, bytes);
    if (rKey.startsWith('srm:')) {
      await idbDelete(`autosave:${rKey.slice('srm:'.length)}`).catch(() => {});
    }
    updatedLocalKeys.push(rKey);
    return;
  }

  if (rKey.startsWith('cover:')) {
    const dataUrl =
      typeof data === 'string'
        ? data
        : typeof data?.dataUrl === 'string'
          ? data.dataUrl
          : null;
    if (dataUrl) {
      await idbPut(rKey, dataUrl).catch(() => {});
      updatedLocalKeys.push(rKey);
    }
    return;
  }

  await idbPut(rKey, data);
  updatedLocalKeys.push(rKey);
}
