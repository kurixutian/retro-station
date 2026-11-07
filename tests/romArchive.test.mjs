import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync } from 'fflate';
import { isZipFile, isZipBuffer, extractRomsFromZip } from '../src/services/romArchive.ts';

test('isZipFile detects zip by name or mime type', () => {
  assert.equal(isZipFile({ name: 'mario.zip' }), true);
  assert.equal(isZipFile({ name: 'MARIO.ZIP' }), true);
  assert.equal(isZipFile({ name: 'mario.sfc', type: 'application/zip' }), true);
  assert.equal(isZipFile({ name: 'mario.sfc' }), false);
  assert.equal(isZipFile({}), false);
});

test('isZipBuffer identifies PK zip header magic bytes', () => {
  const validHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]);
  assert.equal(isZipBuffer(validHeader), true);

  const emptyZipHeader = new Uint8Array([0x50, 0x4b, 0x05, 0x06]);
  assert.equal(isZipBuffer(emptyZipHeader), true);

  const nesHeader = new Uint8Array([0x4e, 0x45, 0x53, 0x1a]);
  assert.equal(isZipBuffer(nesHeader), false);
});

test('extractRomsFromZip extracts single ROM from zip', async () => {
  const romContent = new TextEncoder().encode('NES\x1aromdata');
  const zipBytes = zipSync({
    'Super Mario Bros (USA).nes': romContent,
    'readme.txt': new TextEncoder().encode('Enjoy the game!'),
  });

  const extracted = await extractRomsFromZip(zipBytes);
  assert.equal(extracted.length, 1);
  assert.equal(extracted[0].name, 'Super Mario Bros (USA).nes');
  assert.equal(extracted[0].size, romContent.length);

  const buf = new Uint8Array(await extracted[0].arrayBuffer());
  assert.deepEqual(buf, romContent);
});

test('extractRomsFromZip handles nested paths and filters macOS metadata', async () => {
  const gbaData = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
  const snesData = new Uint8Array([0x04, 0x05, 0x06, 0x07]);

  const zipBytes = zipSync({
    'folder/subfolder/Pokemon Emerald.gba': gbaData,
    '__MACOSX/._Pokemon Emerald.gba': new Uint8Array([0x00, 0x05, 0x16]),
    'folder/.DS_Store': new Uint8Array([0x00]),
    'folder/._hidden.smc': new Uint8Array([0x00]),
    'nested/Zelda.sfc': snesData,
    'manual.pdf': new Uint8Array([0x25, 0x50, 0x44, 0x46]),
  });

  const extracted = await extractRomsFromZip(zipBytes);
  assert.equal(extracted.length, 2);
  assert.equal(extracted[0].name, 'Pokemon Emerald.gba');
  assert.equal(extracted[1].name, 'Zelda.sfc');
});

test('extractRomsFromZip returns empty array when no supported ROM exists', async () => {
  const zipBytes = zipSync({
    'document.pdf': new Uint8Array([1, 2, 3]),
    'notes.txt': new TextEncoder().encode('just text'),
  });

  const extracted = await extractRomsFromZip(zipBytes);
  assert.equal(extracted.length, 0);
});

test('extractRomsFromZip rejects on corrupt data', async () => {
  const corruptBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff, 0xff]);
  await assert.rejects(async () => {
    await extractRomsFromZip(corruptBytes);
  });
});
