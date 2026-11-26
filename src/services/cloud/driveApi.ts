// ============================================================================
// Google Drive AppData HTTP Client & Key Encoding
// ============================================================================

export const TOMBSTONES_DRIVE_FILENAME = 'rs_v2___tombstones__.json';
export const DEMO_GAME_IDS = new Set(['pokemon_gold']);

export const isRomKey = (key: string): boolean => key.startsWith('rom:') && key.length > 'rom:'.length;

/** Cloud sync key `rom:<gameId>` -> local IndexedDB key `<gameId>`. */
export function romLocalIdbKey(key: string): string | null {
  return isRomKey(key) ? key.slice('rom:'.length) : null;
}

export function isSyncableKey(key: string): boolean {
  if (!key) return false;
  if (
    key === 'retro_games' ||
    key === 'library_games' ||
    key === 'retro_deleted_games' ||
    key === 'retro_settings'
  ) {
    return true;
  }
  if (key.startsWith('state:') || key.startsWith('srm:') || key.startsWith('rtc:') || key.startsWith('cover:')) {
    for (const demoId of DEMO_GAME_IDS) {
      if (key.includes(`:${demoId}:`) || key.endsWith(`:${demoId}`)) return false;
    }
    return true;
  }
  if (isRomKey(key)) {
    const gId = romLocalIdbKey(key);
    return !!gId && !DEMO_GAME_IDS.has(gId);
  }
  return false;
}

export function keyToDriveFilename(key: string): string {
  if (isRomKey(key)) {
    return `rs_v2_${encodeURIComponent(key)}.bin`;
  }
  return `rs_v2_${encodeURIComponent(key)}.json`;
}

export function driveFilenameToKey(filename: string): string | null {
  if (!filename || filename === TOMBSTONES_DRIVE_FILENAME) return null;
  if (filename.startsWith('rs_v2_') && filename.endsWith('.json')) {
    try {
      const k = decodeURIComponent(filename.slice('rs_v2_'.length, -'.json'.length));
      return isSyncableKey(k) ? k : null;
    } catch {
      return null;
    }
  }
  if (filename.startsWith('rs_v2_') && filename.endsWith('.bin')) {
    try {
      const k = decodeURIComponent(filename.slice('rs_v2_'.length, -'.bin'.length));
      return isSyncableKey(k) ? k : null;
    } catch {
      return null;
    }
  }
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

export interface DriveFileEntry {
  id: string;
  name: string;
  modifiedTime: string;
  updatedAt: number;
  size: number;
}

export interface UploadedFileInfo {
  id: string;
  updatedAt: number;
}

export class DriveUnauthorizedError extends Error {
  constructor() {
    super('Google Drive session expired. Please tap Reconnect.');
    this.name = 'DriveUnauthorizedError';
  }
}

export async function listAppDataFiles(token: string): Promise<DriveFileEntry[]> {
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

    if (res.status === 401) throw new DriveUnauthorizedError();

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

  const deduped: DriveFileEntry[] = [];
  const byName = new Map<string, DriveFileEntry>();
  for (const item of results) {
    const existing = byName.get(item.name);
    if (!existing) {
      byName.set(item.name, item);
      deduped.push(item);
    } else if (item.updatedAt > existing.updatedAt) {
      deleteDriveFile(token, existing.id).catch(() => {});
      byName.set(item.name, item);
      const idx = deduped.indexOf(existing);
      if (idx !== -1) deduped[idx] = item;
    } else {
      deleteDriveFile(token, item.id).catch(() => {});
    }
  }

  return deduped;
}

export async function downloadDriveJson(token: string, fileId: string): Promise<any> {
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

/** Raw binary download (used for ROM files). 404 -> null. */
export async function downloadDriveBinary(token: string, fileId: string): Promise<Uint8Array | null> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }
  );
  if (res.status === 401) throw new DriveUnauthorizedError();
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`ROM download failed (HTTP ${res.status})`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function uploadDriveBinaryMultipart(
  token: string,
  filename: string,
  blob: Blob,
  existingFileId?: string
): Promise<UploadedFileInfo> {
  const boundary = '-------rs_drive_bin_' + Math.random().toString(36).slice(2);
  const mimeType = 'application/octet-stream';
  const metadata = existingFileId
    ? { name: filename, mimeType }
    : { name: filename, mimeType, parents: ['appDataFolder'] };

  const headerPart =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`;
  const multipartBlob = new Blob([headerPart, blob, `\r\n--${boundary}--`], {
    type: `multipart/related; boundary=${boundary}`,
  });

  const url = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingFileId)}?uploadType=multipart&fields=id,name,modifiedTime`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime`;

  const res = await fetch(url, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBlob,
  });

  if (res.status === 404 && existingFileId) {
    return uploadDriveBinaryMultipart(token, filename, blob, undefined);
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`ROM multipart upload failed (HTTP ${res.status}): ${txt.slice(0, 120)}`);
  }
  const body = await res.json().catch(() => ({} as any));
  return {
    id: body?.id || existingFileId || filename,
    updatedAt: Date.parse(body?.modifiedTime) || Date.now(),
  };
}

async function uploadDriveBinaryResumable(
  token: string,
  filename: string,
  blob: Blob,
  existingFileId?: string
): Promise<UploadedFileInfo> {
  const mimeType = 'application/octet-stream';
  const totalSize = blob.size;
  const metadata: Record<string, any> = existingFileId
    ? { name: filename, mimeType }
    : { name: filename, parents: ['appDataFolder'], mimeType };
  const initUrl = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingFileId)}?uploadType=resumable&fields=id,modifiedTime`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,modifiedTime`;

  const initRes = await fetch(initUrl, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType,
      'X-Upload-Content-Length': String(totalSize),
    },
    body: JSON.stringify(metadata),
  });

  if (initRes.status === 404 && existingFileId) {
    return uploadDriveBinaryResumable(token, filename, blob, undefined);
  }
  if (!initRes.ok) {
    const txt = await initRes.text().catch(() => '');
    throw new Error(`ROM upload init failed (HTTP ${initRes.status}): ${txt.slice(0, 120)}`);
  }

  const uploadUrl = initRes.headers.get('Location') || initRes.headers.get('location') || '';
  if (!uploadUrl) throw new Error('ROM upload session missing URL');

  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType,
      'Content-Range': `bytes 0-${totalSize - 1}/${totalSize}`,
    },
    body: blob,
  });

  if (res.status === 200 || res.status === 201) {
    const body = await res.json().catch(() => ({} as any));
    return {
      id: body?.id || existingFileId || filename,
      updatedAt: Date.parse(body?.modifiedTime) || Date.now(),
    };
  }

  const txt = await res.text().catch(() => '');
  throw new Error(`ROM upload failed (HTTP ${res.status}): ${txt.slice(0, 120)}`);
}

export async function uploadDriveBinary(
  token: string,
  filename: string,
  data: Blob | Uint8Array | ArrayBuffer,
  existingFileId?: string
): Promise<UploadedFileInfo> {
  const mimeType = 'application/octet-stream';
  const part: BlobPart =
    data instanceof Uint8Array ? (data as unknown as BlobPart) : (new Uint8Array(data as ArrayBuffer) as BlobPart);
  const blob =
    typeof Blob !== 'undefined' && data instanceof Blob
      ? data
      : new Blob([part], { type: mimeType });
  if (blob.size <= 0) throw new Error('No ROM data to upload');

  if (blob.size <= 5 * 1024 * 1024) {
    return await uploadDriveBinaryMultipart(token, filename, blob, existingFileId);
  }
  return await uploadDriveBinaryResumable(token, filename, blob, existingFileId);
}

export async function uploadDriveJson(
  token: string,
  filename: string,
  jsonString: string,
  existingFileId?: string
): Promise<UploadedFileInfo> {
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
  const multipartBody = `${headerPart}${jsonString}\r\n--${boundary}--`;

  const url = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingFileId)}?uploadType=multipart&fields=id,name,modifiedTime`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime`;

  const res = await fetch(url, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
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

export async function deleteDriveFile(token: string, fileId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}
