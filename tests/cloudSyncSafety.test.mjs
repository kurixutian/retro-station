import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const cloudSyncSrc = fs.readFileSync(
  path.resolve(process.cwd(), 'src/cloudSync.ts'),
  'utf8'
);
const appSrc = fs.readFileSync(
  path.resolve(process.cwd(), 'src/App.tsx'),
  'utf8'
);

test('executeSync never deletes Drive files or tombstones items just because localVal is null', () => {
  assert.doesNotMatch(
    cloudSyncSrc,
    /if\s*\(\s*remote\s*&&\s*localVal\s*==\s*null\s*&&\s*localMeta/,
    'Implicit Drive deletion when IndexedDB returns null causes cross-device data loss'
  );
  assert.doesNotMatch(
    cloudSyncSrc,
    /remoteTombstones\.deletedItems\[key\]\s*=/,
    'Writing implicit item tombstones during sync wipes other devices'
  );
});

test('pullKeys checks IndexedDB key presence so missing local items are re-pulled', () => {
  assert.match(
    cloudSyncSrc,
    /localIdbKeySet/,
    'pullKeys must check actual IndexedDB keys, not only localMeta timestamps'
  );
});

test('App.tsx guards library_games IDB backup against empty first-mount overwrite', () => {
  assert.match(
    appSrc,
    /if\s*\(\s*!isFirstMountRef\.current\s*\|\|\s*userImportedOnly\.length\s*>\s*0\s*\)\s*\{\s*idbPut\('library_games'/,
    'First mount with INITIAL_GAMES must not overwrite library_games in IndexedDB'
  );
  assert.doesNotMatch(
    appSrc,
    /\/\/ Restore library from IndexedDB if localStorage was empty\s*\n\s*useEffect\(\(\)\s*=>\s*\{\s*\n\s*if\s*\(\s*games\.length\s*===\s*0\s*\)/,
    'games starts with INITIAL_GAMES (length 1), so games.length === 0 never triggers restore'
  );
});
