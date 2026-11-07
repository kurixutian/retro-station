import test from 'node:test';
import assert from 'node:assert/strict';

// Helper replicate of mergeAndDeduplicateGames core logic
function deduplicateGames(localList, remoteList = [], deletedIds = []) {
  const deletedSet = new Set(deletedIds);
  const result = [];

  const getKey = (g) => {
    const titleKey = g?.title && g?.core ? `${String(g.title).trim().toLowerCase()}::${String(g.core).toLowerCase()}` : null;
    const fileKey = g?.fileName ? String(g.fileName).trim().toLowerCase() : null;
    const idKey = g?.id ? String(g.id).trim().toLowerCase() : null;
    const crcKey = g?.crc32 ? String(g.crc32).trim().toLowerCase() : null;
    return { idKey, fileKey, titleKey, crcKey };
  };

  const findExistingIndex = (g) => {
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

  for (const g of remoteList) {
    if (!g || !g.id || deletedSet.has(g.id)) continue;
    const idx = findExistingIndex(g);
    if (idx >= 0) result[idx] = { ...result[idx], ...g };
    else result.push({ ...g });
  }

  for (const g of localList) {
    if (!g || !g.id || deletedSet.has(g.id)) continue;
    const idx = findExistingIndex(g);
    if (idx >= 0) result[idx] = { ...g, ...result[idx] };
    else result.push({ ...g });
  }

  return result;
}

test('mergeAndDeduplicateGames deduplicates matching game IDs', () => {
  const local = [{ id: 'rom_123', title: 'Pokemon Red', core: 'gambatte' }];
  const remote = [{ id: 'rom_123', title: 'Pokemon Red (Updated)', core: 'gambatte' }];
  const merged = deduplicateGames(local, remote);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'rom_123');
  assert.equal(merged[0].title, 'Pokemon Red (Updated)');
});

test('mergeAndDeduplicateGames filters tombstoned deleted games', () => {
  const local = [
    { id: 'rom_keep', title: 'Zelda', core: 'gambatte' },
    { id: 'rom_deleted', title: 'Mario', core: 'fceumm' }
  ];
  const remote = [{ id: 'rom_deleted', title: 'Mario', core: 'fceumm' }];
  const merged = deduplicateGames(local, remote, ['rom_deleted']);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'rom_keep');
});

test('base64 byte conversion round-trips correctly', () => {
  const original = new Uint8Array([0, 1, 2, 250, 255, 42]);
  const b64 = Buffer.from(original).toString('base64');
  const restored = new Uint8Array(Buffer.from(b64, 'base64'));
  assert.deepEqual(Array.from(restored), Array.from(original));
});

test('Google Drive filename encoding round-trips keys with double underscores and colons losslessly', () => {
  const keyToDriveFilename = (key) => `rs_v2_${encodeURIComponent(key)}.json`;
  const driveFilenameToKey = (filename) => {
    if (filename.startsWith('rs_v2_') && filename.endsWith('.json')) {
      return decodeURIComponent(filename.slice('rs_v2_'.length, -'.json'.length));
    }
    return null;
  };

  const trickyKeys = [
    'library_games',
    'retro_games',
    'state:rom_pokemon__emerald_v1:1',
    'srm:rom_zelda__links_awakening',
    'rtc:rom_gold:crystal',
    'cover:rom_ff7__disc1',
  ];

  for (const key of trickyKeys) {
    const fname = keyToDriveFilename(key);
    assert.ok(fname.endsWith('.json'));
    assert.equal(driveFilenameToKey(fname), key);
  }
});

