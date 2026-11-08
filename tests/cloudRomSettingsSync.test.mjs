// ---------------------------------------------------------------------------
// Mirror of the ROM-binary & settings sync logic added to src/cloudSync.ts
// (tests run in plain node, so the pure logic is replicated here)
// ---------------------------------------------------------------------------
import test from 'node:test';
import assert from 'node:assert/strict';

const CAP_ROM_BYTES = 150 * 1024 * 1024;

const SETTINGS_SYNC_KEY = 'retro_settings';
const SETTINGS_SYNC_KEYS = [
  'retro_theme',
  'retro_shaders',
  'retro_haptics',
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

const isRomKey = (key) => key.startsWith('rom:') && key.length > 'rom:'.length;
const romLocalIdbKey = (key) => (isRomKey(key) ? key.slice('rom:'.length) : null);

function keyToDriveFilename(key, ext = 'json') {
  return `rs_v2_${encodeURIComponent(key)}.${ext}`;
}

function driveFilenameToKey(filename) {
  if (!filename) return null;
  if (filename.startsWith('rs_v2_') && filename.endsWith('.json')) {
    try {
      return decodeURIComponent(filename.slice('rs_v2_'.length, -'.json'.length));
    } catch (e) {
      return null;
    }
  }
  if (filename.startsWith('rs_v2_') && filename.endsWith('.bin')) {
    try {
      return decodeURIComponent(filename.slice('rs_v2_'.length, -'.bin'.length));
    } catch (e) {
      return null;
    }
  }
  return null;
}

function isSyncableKey(key) {
  return (
    key === 'retro_games' ||
    key === 'library_games' ||
    key === 'retro_deleted_games' ||
    key === SETTINGS_SYNC_KEY ||
    key.startsWith('state:') ||
    key.startsWith('srm:') ||
    key.startsWith('rtc:') ||
    key.startsWith('cover:') ||
    key.startsWith('rom:')
  );
}

// Pull-phase decision for a remote ROM file mirroring the fast-path in pullOne
function decideRomPull(entry, localSize) {
  if (localSize && localSize > 0) {
    if (entry.size && localSize === entry.size) {
      return { download: false, pendingUpload: false, note: 'skipped-re-download' };
    }
    return { download: false, pendingUpload: true, note: 'kept-local-rom' };
  }
  return { download: true, pendingUpload: false, note: 'restore-from-drive' };
}

// Local wins on push, but remote-only settings keys survive the merge
function mergeSettingsForPush(localSnap, remoteSnap) {
  return { ...(remoteSnap || {}), ...localSnap };
}

// applySettingsSnapshot: only write keys whose value actually differs
function applySettingsSnapshot(snapshot, storage) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return false;
  let changed = false;
  for (const k of SETTINGS_SYNC_KEYS) {
    const incoming = snapshot[k];
    if (typeof incoming !== 'string') continue;
    if (storage[k] !== incoming) {
      storage[k] = incoming;
      changed = true;
    }
  }
  return changed;
}

test('rom: cloud keys decode to bare IndexedDB ids', () => {
  assert.equal(romLocalIdbKey('rom:rom_0x12345678'), 'rom_0x12345678');
  assert.equal(romLocalIdbKey('rom:pokemon_gold'), 'pokemon_gold');
  assert.equal(romLocalIdbKey('srm:rom_0x12345678'), null);
  assert.equal(romLocalIdbKey('rom:'), null);
});

test('ROM binaries round-trip through .bin Drive filenames', () => {
  const key = 'rom:rom_0x1a1a1a1a';
  const fname = keyToDriveFilename(key, 'bin');
  assert.equal(fname, 'rs_v2_rom%3Arom_0x1a1a1a1a.bin');
  const decoded = driveFilenameToKey(fname);
  assert.equal(decoded, key);
  assert.ok(isSyncableKey(decoded));
});

test('bare rom_ game ids stay out of the item sync namespace', () => {
  assert.equal(isSyncableKey('rom_0x12345678'), false);
  assert.equal(isSyncableKey('rom:rom_0x12345678'), true);
  assert.equal(isSyncableKey(SETTINGS_SYNC_KEY), true);
});

test('device that already has the same-size ROM never re-downloads it', () => {
  const entry = { id: 'x', name: 'rs_v2_rom%3Arom_a.bin', size: 512, updatedAt: 100 };
  const decision = decideRomPull(entry, 512);
  assert.equal(decision.download, false);
  assert.equal(decision.pendingUpload, false);
  assert.equal(decision.note, 'skipped-re-download');
});

test('device with a different-size ROM keeps local copy and queues upload', () => {
  const entry = { id: 'x', name: 'rs_v2_rom%3Arom_a.bin', size: 1024, updatedAt: 100 };
  const decision = decideRomPull(entry, 512);
  assert.equal(decision.download, false);
  assert.equal(decision.pendingUpload, true);
  assert.equal(decision.note, 'kept-local-rom');
});

test('device without the ROM restores it from Drive', () => {
  const entry = { id: 'x', size: 2048 };
  const decision = decideRomPull(entry, null);
  assert.equal(decision.download, true);
});

test('settings push merges remote-only keys but local wins conflicts', () => {
  const local = { retro_theme: '"emerald"', retro_shaders: '{"scanlines":false}' };
  const remote = {
    retro_theme: '"midnight"',
    retro_pad_layout: '{"up":{"primaryKey":"W"}}',
  };
  const merged = mergeSettingsForPush(local, remote);
  assert.equal(merged.retro_theme, '"emerald"'); // local wins (fresher edit)
  assert.equal(merged.retro_pad_layout, '{"up":{"primaryKey":"W"}}'); // remote-only preserved
});

test('applySettingsSnapshot is a no-op when nothing changed (prevents pull/push ping-pong)', () => {
  const storage = {
    retro_theme: '"crt"',
    retro_haptics: 'true',
  };
  const incomingServerCopy = { retro_theme: '"crt"', retro_haptics: 'true' };
  assert.equal(applySettingsSnapshot(incomingServerCopy, storage), false);
  assert.equal(applySettingsSnapshot({ retro_theme: '"pixel"', retro_haptics: 'true' }, storage), true);
  assert.equal(storage.retro_theme, '"pixel"');
  // Unknown keys and non-string values are ignored, never synced
  assert.equal(applySettingsSnapshot({ retro_token: 'secret', retro_theme: 5, retro_deleted_games: '[]' }, storage), false);
  assert.equal(storage.retro_token, undefined);
});

test('ROM payloads respect the size cap', () => {
  const prepare = (size) => {
    if (!size || size <= 0) return { ok: false, reason: 'no local ROM data' };
    if (size > CAP_ROM_BYTES) {
      return { ok: false, reason: `ROM too large (${Math.round(size / 1048576)} MB)`, size };
    }
    return { ok: true, raw: 'blob', size };
  };
  assert.equal(prepare(0).ok, false);
  assert.equal(prepare(512).ok, true);
  assert.equal(prepare(CAP_ROM_BYTES + 1).ok, false);
  assert.ok(prepare(CAP_ROM_BYTES + 1).reason.includes('ROM too large'));
});

test('ROM pull gating keeps remote ROM archives untouched while sync is off', () => {
  const deletionTombstoneBlock = (key, romSyncEnabled) => !(isRomKey(key) && !romSyncEnabled);
  assert.equal(deletionTombstoneBlock('rom:rom_a', false), false); // skipped while disabled
  assert.equal(deletionTombstoneBlock('rom:rom_a', true), true); // syncs when enabled
  assert.equal(deletionTombstoneBlock('srm:rom_a', false), true); // saves always sync
});
