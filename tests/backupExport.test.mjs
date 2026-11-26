import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function loadBackupModule() {
  const res = await build({
    entryPoints: ['src/services/backup.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    external: ['@capacitor/*'],
  });
  const code = res.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

test('buildBackupBlob serializes backup lists and items as valid JSON', async () => {
  const { buildBackupBlob, getBackupFileName } = await loadBackupModule();
  const sample = {
    app: 'retro-station',
    kind: 'backup',
    version: 1,
    createdAt: Date.UTC(2026, 10, 27),
    lists: {
      retro_games: [{ id: 'g1', title: 'Test Game' }],
      library_games: [{ id: 'g1', title: 'Test Game', real: true }],
      retro_deleted_games: ['old_1'],
    },
    items: {
      'rom:g1': 'AQID',
      'cover:g1': 'data:image/webp;base64,AAA',
    },
  };

  assert.equal(getBackupFileName(sample), 'retro-station-backup-2026-11-27.json');
  const blob = buildBackupBlob(sample);
  assert.equal(blob.type, 'application/json');
  const parsed = JSON.parse(await blob.text());
  assert.deepEqual(parsed, sample);
});
