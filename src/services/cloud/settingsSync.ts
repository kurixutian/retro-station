// ============================================================================
// Settings & ROM Sync Helpers
// ============================================================================

export const SETTINGS_SYNC_KEY = 'retro_settings';
const ROM_SYNC_ENABLED_KEY = 'retro_sync_roms';
const DEVICE_ID_KEY = 'retro_device_id';

const SETTINGS_SYNC_KEYS: string[] = [
  'retro_theme',
  'retro_shaders',
  'retro_haptics',
  'retro_sync_roms',
  'retro_pad_opacity',
  'retro_pad_layout',
  'retro_pad_layout_portrait',
  'retro_pad_layout_landscape',
  'retro_pad_layout_portrait_1',
  'retro_pad_layout_portrait_2',
  'retro_pad_layout_portrait_3',
  'retro_pad_layout_landscape_1',
  'retro_pad_layout_landscape_2',
  'retro_pad_layout_landscape_3',
  'retro_layout_names_portrait',
  'retro_layout_names_landscape',
  'retro_pad_slot_portrait',
  'retro_pad_slot_landscape',
];

export function collectSettingsSnapshot(): Record<string, string> {
  const snap: Record<string, string> = {};
  try {
    for (const k of SETTINGS_SYNC_KEYS) {
      const v = localStorage.getItem(k);
      if (v != null) snap[k] = v;
    }
  } catch {}
  return snap;
}

export function applySettingsSnapshot(snapshot: any): boolean {
  if (!snapshot || typeof snapshot !== 'object') return false;
  let changed = false;
  try {
    for (const k of SETTINGS_SYNC_KEYS) {
      if (Object.prototype.hasOwnProperty.call(snapshot, k) && typeof snapshot[k] === 'string') {
        const incoming = snapshot[k];
        if (localStorage.getItem(k) !== incoming) {
          localStorage.setItem(k, incoming);
          changed = true;
        }
      }
    }
  } catch {}
  return changed;
}

export function isRomSyncEnabled(): boolean {
  try {
    if (typeof localStorage === 'undefined') return true;
    return localStorage.getItem(ROM_SYNC_ENABLED_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setRomSyncEnabledStorage(enabled: boolean): void {
  try {
    localStorage.setItem(ROM_SYNC_ENABLED_KEY, enabled ? '1' : '0');
  } catch {}
}

export function findLocalGame(gameId: string): any {
  try {
    const list: any[] = JSON.parse(localStorage.getItem('retro_games') || '[]') || [];
    return list.find((g) => g && String(g.id) === gameId) || null;
  } catch {
    return null;
  }
}

export function blobSizeOf(v: any): number | null {
  if (v == null || typeof v === 'number') return null;
  if (typeof Blob !== 'undefined' && v instanceof Blob) return v.size;
  if (v instanceof Uint8Array) return v.byteLength;
  if (v instanceof ArrayBuffer) return v.byteLength;
  if (ArrayBuffer.isView(v)) return v.byteLength;
  return null;
}

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
  } catch {
    return 'dev-browser';
  }
}
