// ============================================================================
// ZERO-COST OFFLINE-FIRST GOOGLE DRIVE CLOUD SAVE ENGINE
// Saves to private appDataFolder (No developer database or server required)
// ============================================================================

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
  | 'quota_exceeded'
  | 'error';

export interface GoogleUserProfile {
  email: string;
  name?: string;
  picture?: string;
}

export interface CloudSaveMetadata {
  fileId?: string;
  lastSyncedServerModifiedTime?: string;
  lastSyncedLocalUpdatedAt?: number;
  localUpdatedAt: number;
  pendingUpload: boolean;
}

export interface ConflictBackupItem {
  key: string;
  filename: string;
  deviceId: string;
  timestamp: string;
  fileId?: string;
  data: any;
}

const CLIENT_ID_STORAGE_KEY = 'retro_google_client_id';
const USER_PROFILE_STORAGE_KEY = 'retro_google_user';
const DEVICE_ID_STORAGE_KEY = 'retro_device_id';
const LAST_SYNC_TIME_KEY = 'retro_last_sync_time';

// Persistent Device ID for identifying conflict backups
export function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : `dev-${Math.random().toString(36).substring(2, 10)}`;
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
    }
    return id;
  } catch (e) {
    return 'dev-browser';
  }
}

// In-Memory Authentication State (Never stored in localStorage for security)
let inMemoryAccessToken: string | null = null;
let tokenExpiresAt = 0; // Timestamp (ms)
let tokenClient: any = null;
let currentStatus: CloudSyncStatus = 'unlinked';
let statusDetails = '';
const statusListeners = new Set<(status: CloudSyncStatus, details: string) => void>();

export function getSyncStatus(): { status: CloudSyncStatus; details: string; lastSyncTime: string | null } {
  let lastSyncTime: string | null = null;
  try {
    lastSyncTime = localStorage.getItem(LAST_SYNC_TIME_KEY);
  } catch (e) {}
  return { status: currentStatus, details: statusDetails, lastSyncTime };
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

export const DEFAULT_GOOGLE_CLIENT_ID =
  '812701015700-srefneer1disk609pa2s4pqj7s2c8ln0.apps.googleusercontent.com';

// Get saved Google Client ID or default
export function getGoogleClientId(): string {
  try {
    return (
      localStorage.getItem(CLIENT_ID_STORAGE_KEY) ||
      (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
      DEFAULT_GOOGLE_CLIENT_ID
    );
  } catch (e) {
    return DEFAULT_GOOGLE_CLIENT_ID;
  }
}

export function setGoogleClientId(id: string) {
  try {
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, id.trim());
  } catch (e) {}
}

export function getCachedUserProfile(): GoogleUserProfile | null {
  try {
    const raw = localStorage.getItem(USER_PROFILE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setCachedUserProfile(profile: GoogleUserProfile | null) {
  try {
    if (profile) localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
    else localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
  } catch (e) {}
}

// Dynamically load Google Identity Services script safely (offline-tolerant)
let gisLoadingPromise: Promise<boolean> | null = null;
export async function loadGisScript(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (window.google?.accounts?.oauth2) return true;
  if (gisLoadingPromise) return gisLoadingPromise;

  gisLoadingPromise = new Promise<boolean>((resolve) => {
    if (!navigator.onLine) {
      resolve(false);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn('[CloudSync] GIS script failed to load (offline or blocked).');
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return gisLoadingPromise;
}

// Initialize Token Client
async function initTokenClient(interactive = false): Promise<any> {
  const clientId = getGoogleClientId();
  if (!clientId) {
    setStatus('unlinked', 'Google Client ID not configured');
    return null;
  }

  const loaded = await loadGisScript();
  if (!loaded || !window.google?.accounts?.oauth2) {
    setStatus(navigator.onLine ? 'error' : 'offline', 'Google Identity Services unavailable');
    return null;
  }

  return new Promise((resolve) => {
    try {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        callback: (resp: any) => {
          if (resp.error) {
            console.warn('[CloudSync] OAuth error:', resp);
            if (resp.error === 'interaction_required' || resp.error === 'consent_required') {
              setStatus('needs_reauth', 'Please sign in to reconnect Google Drive');
            } else {
              setStatus('error', resp.error_description || resp.error);
            }
            resolve(null);
            return;
          }
          if (resp.access_token) {
            inMemoryAccessToken = resp.access_token;
            const expiresInSec = Number(resp.expires_in) || 3599;
            tokenExpiresAt = Date.now() + (expiresInSec - 60) * 1000;
            fetchUserProfile(resp.access_token).catch(() => {});
            setStatus('idle', 'Connected');
            resolve(tokenClient);
          }
        },
      });
      resolve(tokenClient);
    } catch (err: any) {
      console.error('[CloudSync] Failed to initialize token client:', err);
      setStatus('error', err?.message || 'Failed to initialize OAuth');
      resolve(null);
    }
  });
}

// Fetch Google User Profile using Access Token
async function fetchUserProfile(token: string): Promise<GoogleUserProfile | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      const profile: GoogleUserProfile = {
        email: data.email || 'Google User',
        name: data.name || data.given_name || 'Player',
        picture: data.picture || '',
      };
      setCachedUserProfile(profile);
      return profile;
    }
  } catch (e) {}
  return null;
}

// Ensure Valid Access Token before any sync batch
// Follows rule: prompt: 'none' for silent renewal; handles needs_reauth
export async function ensureToken(interactive = false): Promise<string | null> {
  if (!navigator.onLine) {
    setStatus('offline', 'Offline (changes stored locally)');
    return null;
  }

  // If token is in memory and valid for at least another 5 minutes, reuse it
  if (inMemoryAccessToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return inMemoryAccessToken;
  }

  // Need token client
  if (!tokenClient) {
    await initTokenClient(interactive);
  }

  if (!tokenClient) return null;

  return new Promise((resolve) => {
    // Override callback for this specific token request
    tokenClient.callback = (resp: any) => {
      if (resp.error) {
        if (resp.error === 'interaction_required' || resp.error === 'consent_required' || resp.error === 'popup_blocked_by_browser') {
          setStatus('needs_reauth', 'Session expired. Tap Reconnect to sync.');
        } else {
          setStatus('error', resp.error_description || resp.error);
        }
        resolve(null);
        return;
      }

      if (resp.access_token) {
        inMemoryAccessToken = resp.access_token;
        const expiresInSec = Number(resp.expires_in) || 3599;
        tokenExpiresAt = Date.now() + (expiresInSec - 60) * 1000;
        fetchUserProfile(resp.access_token).catch(() => {});
        setStatus('idle', 'Connected');
        resolve(resp.access_token);
      } else {
        resolve(null);
      }
    };

    try {
      if (interactive) {
        // User explicitly clicked "Sign In" / "Reconnect"
        tokenClient.requestAccessToken({ prompt: '' });
      } else {
        // Background sync: attempt prompt: 'none' (silent renewal)
        tokenClient.requestAccessToken({ prompt: 'none' });
      }
    } catch (err: any) {
      console.warn('[CloudSync] Silent token request failed:', err);
      setStatus('needs_reauth', 'Sign-in required');
      resolve(null);
    }
  });
}

// User-Facing Sign-In Action
export async function signInWithGoogle(): Promise<boolean> {
  const token = await ensureToken(true);
  return !!token;
}

// Sign Out & Revoke Token (Keeps local saves completely intact)
export async function signOutGoogle(): Promise<void> {
  if (inMemoryAccessToken && window.google?.accounts?.oauth2?.revoke) {
    try {
      window.google.accounts.oauth2.revoke(inMemoryAccessToken, () => {});
    } catch (e) {}
  }
  inMemoryAccessToken = null;
  tokenExpiresAt = 0;
  setCachedUserProfile(null);
  setStatus('unlinked', 'Signed out');
}

// Multi-Tab Concurrency Guard using navigator.locks
async function withSyncLock<T>(fn: () => Promise<T>): Promise<T | null> {
  if (typeof navigator !== 'undefined' && 'locks' in navigator) {
    return (navigator.locks as any).request('retro_station_cloud_sync', { ifAvailable: true }, async (lock: any) => {
      if (!lock) {
        // Another tab is currently uploading; gracefully yield
        return null;
      }
      return await fn();
    });
  }
  return await fn();
}

// ============================================================================
// GOOGLE DRIVE APPDATAFOLDER REST API CLIENT
// ============================================================================

interface DriveFileSummary {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
}

// Search file in appDataFolder
async function searchAppDataFile(token: string, filename: string): Promise<DriveFileSummary | null> {
  const q = encodeURIComponent(`name='${filename.replace(/'/g, "\\'")}' and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,name,modifiedTime,size)&pageSize=1`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (res.status === 401) {
    setStatus('needs_reauth', 'Session expired. Please reconnect.');
    inMemoryAccessToken = null;
    return null;
  }
  if (res.status === 403) {
    const txt = await res.text();
    if (txt.includes('storageQuotaExceeded')) setStatus('quota_exceeded', 'Google Drive storage full');
    return null;
  }
  if (!res.ok) return null;

  const data = await res.json();
  return data.files && data.files.length > 0 ? data.files[0] : null;
}

// List all conflict backup files in appDataFolder
export async function listCloudConflictBackups(): Promise<ConflictBackupItem[]> {
  const token = await ensureToken(false);
  if (!token) return [];

  const q = encodeURIComponent(`name contains '.conflict.bak' and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,name,modifiedTime,size)&pageSize=30`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.files || []).map((f: any) => {
      const parts = f.name.split('.');
      return {
        key: parts[0] || 'save',
        filename: f.name,
        deviceId: parts[1] || 'unknown',
        timestamp: f.modifiedTime,
        fileId: f.id,
        data: null
      };
    });
  } catch (e) {
    return [];
  }
}

// List all non-trashed files in appDataFolder for 2-way discovery
export async function listAllAppDataFiles(token: string): Promise<DriveFileSummary[]> {
  try {
    const q = encodeURIComponent('trashed=false');
    const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,name,modifiedTime,size)&pageSize=100`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.files || [];
  } catch (e) {
    return [];
  }
}

// Key to Google Drive Filename Converter
export function keyToFilename(key: string): string {
  if (key === 'library_games') return 'retro_library_games.json';
  if (key.startsWith('rom:')) return `retro_rom__${key.slice(4)}.bin`;
  // state:gameId:slot -> retro_state__gameId__slot.json
  const safe = key.replace(/:/g, '__');
  return `retro_${safe}.json`;
}

// Google Drive Filename to Local Key Converter
export function filenameToKey(filename: string): string | null {
  if (filename === 'retro_library_games.json') return 'library_games';
  if (filename.startsWith('retro_rom__') && filename.endsWith('.bin')) {
    const gameId = filename.slice('retro_rom__'.length, -'.bin'.length);
    return `rom:${gameId}`;
  }
  if (filename.startsWith('retro_') && filename.endsWith('.json')) {
    const raw = filename.slice('retro_'.length, -'.json'.length);
    return raw.replace(/__/g, ':');
  }
  return null;
}

export function isSyncableKey(key: string): boolean {
  return (
    key === 'library_games' ||
    key.startsWith('rom:') ||
    key.startsWith('state:') ||
    key.startsWith('srm:') ||
    key.startsWith('rtc:') ||
    key.startsWith('autosave:')
  );
}

// Multipart Upload (Atomic Create / Update for both JSON and binary Blobs)
async function uploadToAppData(
  token: string,
  filename: string,
  payload: any,
  existingFileId?: string
): Promise<{ id: string; modifiedTime: string } | null> {
  const boundary = '-------retro_station_' + Math.random().toString(36).substring(2);
  const metadata = existingFileId
    ? { name: filename }
    : { name: filename, parents: ['appDataFolder'] };

  let bodyBlob: Blob;

  if (payload instanceof Blob) {
    const isJson = filename.endsWith('.json');
    const mime = isJson ? 'application/json' : 'application/octet-stream';
    const header = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`;
    const footer = `\r\n--${boundary}--`;
    bodyBlob = new Blob([header, payload, footer], { type: `multipart/related; boundary=${boundary}` });
  } else if (payload instanceof Uint8Array || payload instanceof ArrayBuffer) {
    const raw = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
    const header = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`;
    const footer = `\r\n--${boundary}--`;
    bodyBlob = new Blob([header, raw, footer], { type: `multipart/related; boundary=${boundary}` });
  } else {
    const content = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const fullText =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
    bodyBlob = new Blob([fullText], { type: `multipart/related; boundary=${boundary}` });
  }

  const url = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&fields=id,name,modifiedTime`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime`;

  const method = existingFileId ? 'PATCH' : 'POST';
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: bodyBlob,
  });

  if (res.status === 401) {
    setStatus('needs_reauth', 'Session expired. Tap Reconnect to sync.');
    inMemoryAccessToken = null;
    return null;
  }
  if (res.status === 403) {
    const txt = await res.text();
    if (txt.includes('storageQuotaExceeded')) {
      setStatus('quota_exceeded', 'Google Drive storage is full');
    } else {
      setStatus('error', 'Drive API rate limit reached, will retry later');
    }
    return null;
  }
  if (!res.ok) {
    if (res.status === 404 && existingFileId) {
      // File was deleted on remote; retry as new create
      return uploadToAppData(token, filename, payload, undefined);
    }
    return null;
  }

  return await res.json();
}

// Download file contents from appDataFolder (Binary Blob or JSON)
async function downloadFromAppData(token: string, fileId: string, filename = ''): Promise<any | null> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;

  if (filename.endsWith('.bin') || filename.includes('rom__')) {
    return await res.blob();
  }

  try {
    return await res.json();
  } catch (e) {
    return await res.text();
  }
}

// Delete all cloud saves in appDataFolder (Data Lifecycle Control)
export async function deleteAllCloudSaves(): Promise<boolean> {
  const token = await ensureToken(true);
  if (!token) return false;

  setStatus('syncing', 'Deleting cloud saves...');
  try {
    const listRes = await fetch(
      'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id)&pageSize=100',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!listRes.ok) throw new Error('Failed to list files');
    const data = await listRes.json();
    for (const file of data.files || []) {
      await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
    }
    setStatus('idle', 'Cloud saves cleared');
    return true;
  } catch (err: any) {
    setStatus('error', err?.message || 'Failed to delete cloud files');
    return false;
  }
}

// ============================================================================
// OFFLINE-FIRST 3-WAY SYNC ORCHESTRATION WITH BASE-REVISION TRACKING
// ============================================================================

export interface SyncTargetStore {
  getItem: (key: string) => Promise<any>;
  setItem: (key: string, val: any) => Promise<void>;
  getAllKeys: () => Promise<string[]>;
}

// Sync metadata cache
async function getCloudMeta(store: SyncTargetStore, key: string): Promise<CloudSaveMetadata | null> {
  const meta = await store.getItem(`cloud_meta:${key}`);
  return meta || null;
}

async function setCloudMeta(store: SyncTargetStore, key: string, meta: CloudSaveMetadata): Promise<void> {
  await store.setItem(`cloud_meta:${key}`, meta);
}

// Mark a local key as modified and ready for sync
export async function markLocalSaveModified(store: SyncTargetStore, key: string): Promise<void> {
  const now = Date.now();
  const existing = await getCloudMeta(store, key);
  const updated: CloudSaveMetadata = {
    fileId: existing?.fileId,
    lastSyncedServerModifiedTime: existing?.lastSyncedServerModifiedTime,
    lastSyncedLocalUpdatedAt: existing?.lastSyncedLocalUpdatedAt,
    localUpdatedAt: now,
    pendingUpload: true,
  };
  await setCloudMeta(store, key, updated);
  triggerDebouncedCloudSync(store);
}

// Listener for when remote saves/games are downloaded and updated locally
const dataUpdateListeners = new Set<(updatedKeys: string[]) => void>();

export function subscribeDataUpdated(listener: (updatedKeys: string[]) => void): () => void {
  dataUpdateListeners.add(listener);
  return () => dataUpdateListeners.delete(listener);
}

function notifyDataUpdated(updatedKeys: string[]) {
  if (updatedKeys.length === 0) return;
  dataUpdateListeners.forEach((fn) => {
    try { fn(updatedKeys); } catch (e) {}
  });
}

// Execute 3-way sync for a single item (supports pre-fetched remoteFile)
async function syncSingleItem(
  token: string,
  store: SyncTargetStore,
  itemKey: string,
  prefetchedRemoteFile?: DriveFileSummary | null
): Promise<{ success: boolean; downloaded: boolean }> {
  const localVal = await store.getItem(itemKey);
  let meta = await getCloudMeta(store, itemKey);
  const cloudFilename = keyToFilename(itemKey);

  if (!meta) {
    meta = {
      localUpdatedAt: localVal ? Date.now() : 0,
      pendingUpload: !!localVal,
    };
  }

  // 1. Fetch remote file summary (use prefetched if provided, or search)
  let remoteFile = prefetchedRemoteFile !== undefined ? prefetchedRemoteFile : (meta.fileId ? await searchAppDataFile(token, cloudFilename) : null);
  if (prefetchedRemoteFile === undefined && !remoteFile) {
    remoteFile = await searchAppDataFile(token, cloudFilename);
  }

  // If item doesn't exist locally and doesn't exist on remote, nothing to sync
  if (!localVal && !remoteFile) return { success: true, downloaded: false };

  // Case A: Exists only locally -> Upload
  if (localVal && !remoteFile) {
    const uploadRes = await uploadToAppData(token, cloudFilename, localVal);
    if (uploadRes) {
      await setCloudMeta(store, itemKey, {
        fileId: uploadRes.id,
        lastSyncedServerModifiedTime: uploadRes.modifiedTime,
        lastSyncedLocalUpdatedAt: meta.localUpdatedAt,
        localUpdatedAt: meta.localUpdatedAt,
        pendingUpload: false,
      });
      return { success: true, downloaded: false };
    }
    return { success: false, downloaded: false };
  }

  // Case B: Exists only remotely -> Download to local
  if (!localVal && remoteFile) {
    const downloaded = await downloadFromAppData(token, remoteFile.id, cloudFilename);
    if (downloaded) {
      await store.setItem(itemKey, downloaded);
      await setCloudMeta(store, itemKey, {
        fileId: remoteFile.id,
        lastSyncedServerModifiedTime: remoteFile.modifiedTime,
        lastSyncedLocalUpdatedAt: Date.now(),
        localUpdatedAt: Date.now(),
        pendingUpload: false,
      });
      return { success: true, downloaded: true };
    }
    return { success: false, downloaded: false };
  }

  // Case C: Exists both locally and remotely -> Base Revision 3-Way Comparison
  if (localVal && remoteFile) {
    const lastSyncedLocal = meta.lastSyncedLocalUpdatedAt || 0;
    const lastSyncedServer = meta.lastSyncedServerModifiedTime
      ? new Date(meta.lastSyncedServerModifiedTime).getTime()
      : 0;
    const currentServerTime = new Date(remoteFile.modifiedTime).getTime();

    const localChanged = meta.localUpdatedAt > lastSyncedLocal || meta.pendingUpload;
    const remoteChanged = currentServerTime > lastSyncedServer + 1000; // 1s tolerance for timestamp rounding

    if (localChanged && !remoteChanged) {
      // Local is newer -> Upload
      const uploadRes = await uploadToAppData(token, cloudFilename, localVal, remoteFile.id);
      if (uploadRes) {
        await setCloudMeta(store, itemKey, {
          fileId: uploadRes.id,
          lastSyncedServerModifiedTime: uploadRes.modifiedTime,
          lastSyncedLocalUpdatedAt: meta.localUpdatedAt,
          localUpdatedAt: meta.localUpdatedAt,
          pendingUpload: false,
        });
        return { success: true, downloaded: false };
      }
      return { success: false, downloaded: false };
    }

    if (!localChanged && remoteChanged) {
      // Remote is newer -> Download
      const downloaded = await downloadFromAppData(token, remoteFile.id, cloudFilename);
      if (downloaded) {
        await store.setItem(itemKey, downloaded);
        await setCloudMeta(store, itemKey, {
          fileId: remoteFile.id,
          lastSyncedServerModifiedTime: remoteFile.modifiedTime,
          lastSyncedLocalUpdatedAt: Date.now(),
          localUpdatedAt: Date.now(),
          pendingUpload: false,
        });
        return { success: true, downloaded: true };
      }
      return { success: false, downloaded: false };
    }

    if (!localChanged && !remoteChanged) {
      // Both match base revision -> Already in sync
      return { success: true, downloaded: false };
    }

    // Case D: TRUE CONFLICT (Both modified independently while disconnected)
    console.warn(`[CloudSync] True conflict detected for ${itemKey}! Creating non-destructive backup.`);
    const deviceId = getOrCreateDeviceId();
    const isoTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const conflictFilename = `${itemKey}.${deviceId}.${isoTimestamp}.conflict.bak`;

    // Download remote save and store as conflict backup locally and in Drive
    const remoteData = await downloadFromAppData(token, remoteFile.id, cloudFilename);
    if (remoteData) {
      await store.setItem(`conflict:${conflictFilename}`, remoteData);
      await uploadToAppData(token, conflictFilename, remoteData);
    }

    // Now push current local save to current slot
    const uploadRes = await uploadToAppData(token, cloudFilename, localVal, remoteFile.id);
    if (uploadRes) {
      await setCloudMeta(store, itemKey, {
        fileId: uploadRes.id,
        lastSyncedServerModifiedTime: uploadRes.modifiedTime,
        lastSyncedLocalUpdatedAt: meta.localUpdatedAt,
        localUpdatedAt: meta.localUpdatedAt,
        pendingUpload: false,
      });
    }
    return { success: true, downloaded: true };
  }

  return { success: true, downloaded: false };
}

// Full Sync Batch across all saves & ROMs (Two-way discovery)
export async function executeFullSync(store: SyncTargetStore, interactive = false): Promise<boolean> {
  const userProfile = getCachedUserProfile();
  if (!userProfile && !interactive) {
    // User is not signed in
    setStatus('unlinked', 'Sign in to sync with Google Drive');
    return false;
  }

  return (await withSyncLock(async () => {
    const token = await ensureToken(interactive);
    if (!token) return false;

    setStatus('syncing', 'Syncing with Google Drive...');

    try {
      // 1. Fetch remote files in appDataFolder (Two-way reconciliation)
      const remoteFiles = await listAllAppDataFiles(token);
      const remoteFilesMap = new Map<string, DriveFileSummary>();
      remoteFiles.forEach((f) => {
        const k = filenameToKey(f.name);
        if (k) remoteFilesMap.set(k, f);
      });

      // 2. Fetch local syncable keys
      const allLocalKeys = await store.getAllKeys();
      const localSyncKeys = allLocalKeys.filter((k) => isSyncableKey(k));

      // 3. Union of all keys present locally OR on Google Drive
      const allKeysToSync = new Set([
        ...localSyncKeys,
        ...remoteFilesMap.keys(),
      ]);

      const downloadedKeys: string[] = [];
      for (const key of allKeysToSync) {
        const res = await syncSingleItem(token, store, key, remoteFilesMap.get(key));
        if (res.downloaded) {
          downloadedKeys.push(key);
        }
      }

      if (downloadedKeys.length > 0) {
        notifyDataUpdated(downloadedKeys);
      }

      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      try { localStorage.setItem(LAST_SYNC_TIME_KEY, nowStr); } catch (e) {}
      setStatus('idle', `Synced (${nowStr})`);
      return true;
    } catch (err: any) {
      console.error('[CloudSync] Sync batch failed:', err);
      setStatus('error', err?.message || 'Sync failed, will retry');
      return false;
    }
  })) ?? false;
}

// Debounced Cloud Sync Trigger (3 seconds)
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
export function triggerDebouncedCloudSync(store: SyncTargetStore) {
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    executeFullSync(store, false).catch(() => {});
  }, 3000);
}

// Setup Global Event Listeners (Online, VisibilityChange)
export function initGlobalSyncListeners(store: SyncTargetStore): () => void {
  const onOnline = () => {
    console.log('[CloudSync] Network online detected; triggering auto-sync.');
    executeFullSync(store, false).catch(() => {});
  };

  const onVisibilityChange = () => {
    if (!document.hidden) {
      executeFullSync(store, false).catch(() => {});
    }
  };

  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisibilityChange);

  // Initial silent check if signed in
  if (getCachedUserProfile() && navigator.onLine) {
    setTimeout(() => {
      executeFullSync(store, false).catch(() => {});
    }, 1500);
  } else if (!navigator.onLine) {
    setStatus('offline', 'Offline (changes stored locally)');
  }

  return () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
