import { SaveSlot } from '../../types';
import { uint8ArrayToBase64 } from './binary';

const NATIVE_CHUNK_BYTES = 192 * 1024;

function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function streamBlobToNativeSession(
  bridge: any,
  sessionId: string,
  blob: Blob
): Promise<string> {
  try {
    for (let offset = 0; offset < blob.size; offset += NATIVE_CHUNK_BYTES) {
      const slice = blob.slice(offset, Math.min(offset + NATIVE_CHUNK_BYTES, blob.size));
      const buf = await slice.arrayBuffer();
      const b64 = uint8ArrayToBase64(new Uint8Array(buf));
      const res: string = bridge.appendChunk(sessionId, b64);
      if (typeof res === 'string' && res.startsWith('ERR:')) {
        throw new Error(res.slice(4));
      }
      await new Promise((r) => setTimeout(r, 0));
    }
    const done: string = bridge.finishSave(sessionId);
    if (typeof done === 'string' && done.startsWith('ERR:')) {
      throw new Error(done.slice(4));
    }
    return typeof done === 'string' && done.startsWith('OK:') ? done.slice(3) : 'Downloads';
  } catch (err) {
    try {
      bridge.cancelSave(sessionId);
    } catch {}
    throw err;
  }
}

function pickNativeDestination(bridge: any, fileName: string, mimeType: string): Promise<string> {
  return new Promise((resolve) => {
    const w = window as any;
    const cbId = `cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const prev = w.__retroFilePickerDone;
    const callbacks: Map<string, (res: string) => void> =
      w.__retroFilePickerCallbacks || (w.__retroFilePickerCallbacks = new Map());

    callbacks.set(cbId, resolve);
    if (!prev) {
      w.__retroFilePickerDone = (id: string, payload: string) => {
        const fn = callbacks.get(id);
        if (fn) {
          callbacks.delete(id);
          fn(payload);
        }
      };
    }
    bridge.pickSaveDestination(cbId, fileName, mimeType);
  });
}

export async function saveFileToDevice(
  blob: Blob,
  fileName: string,
  mimeType = 'application/octet-stream',
  chooseLocation = false
): Promise<{ saved: boolean; location?: string; cancelled?: boolean }> {
  const w = typeof window !== 'undefined' ? (window as any) : undefined;
  const androidDownloads = w?.AndroidDownloads;

  if (androidDownloads) {
    if (chooseLocation && typeof androidDownloads.pickSaveDestination === 'function') {
      const sid = await pickNativeDestination(androidDownloads, fileName, mimeType);
      if (sid === 'CANCELLED') return { saved: false, cancelled: true };
      if (sid.startsWith('ERR:')) throw new Error(sid.slice(4));
      const location = await streamBlobToNativeSession(androidDownloads, sid, blob);
      return { saved: true, location };
    }
    if (typeof androidDownloads.beginDownloadsSave === 'function') {
      const sid: string = androidDownloads.beginDownloadsSave(fileName, mimeType);
      if (typeof sid === 'string' && sid.startsWith('ERR:')) {
        throw new Error(sid.slice(4));
      }
      const location = await streamBlobToNativeSession(androidDownloads, sid, blob);
      return { saved: true, location };
    }
  }

  if (chooseLocation && w && typeof w.showSaveFilePicker === 'function') {
    try {
      const extMatch = fileName.match(/\.[a-z0-9]+$/i);
      const handle = await w.showSaveFilePicker({
        suggestedName: fileName,
        types: extMatch
          ? [{ description: 'File', accept: { [mimeType]: [extMatch[0].toLowerCase()] } }]
          : undefined,
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { saved: true, location: fileName };
    } catch (err: any) {
      if (err?.name === 'AbortError') return { saved: false, cancelled: true };
    }
  }

  if (chooseLocation && typeof navigator !== 'undefined' && navigator.share) {
    const file = new File([blob], fileName, { type: mimeType });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: fileName });
        return { saved: true, location: 'Shared' };
      } catch (err: any) {
        if (err?.name === 'AbortError') return { saved: false, cancelled: true };
      }
    }
  }

  triggerBrowserDownload(blob, fileName);
  return { saved: true, location: `Downloads/${fileName}` };
}

export function downloadBinaryFile(uint8Array: Uint8Array, fileName: string) {
  const blob = new Blob([uint8Array as any], { type: 'application/octet-stream' });
  saveFileToDevice(blob, fileName, 'application/octet-stream', false).catch(() =>
    triggerBrowserDownload(blob, fileName)
  );
}

export function createEmptySlotsForGame(_gameId?: string): SaveSlot[] {
  return [1, 2, 3, 4].map((slot) => ({
    slot,
    empty: true,
    label: 'Empty Slot',
    timestamp: null,
    score: 0,
    frame: 0,
    screenshot: null,
    stateData: null
  }));
}
