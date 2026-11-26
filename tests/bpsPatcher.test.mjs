import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCrc32,
  formatCrc32Hex,
  applyBpsPatch,
  applyUpsPatch,
  applyRomPatch,
  buildPatchedRomFileName,
} from '../src/services/bpsPatcher.ts';

function encodeVarInt(value) {
  const out = [];
  let v = value;
  while (true) {
    const x = v & 0x7f;
    v = Math.floor(v / 128);
    if (v === 0) {
      out.push(0x80 | x);
      break;
    }
    out.push(x);
    v -= 1;
  }
  return out;
}

function writeUint32LE(value) {
  return [
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ];
}

function buildSyntheticBps(source, target, actions, metadata = '') {
  const metaBytes = Array.from(new TextEncoder().encode(metadata));
  const body = [
    0x42, 0x50, 0x53, 0x31, // BPS1
    ...encodeVarInt(source.length),
    ...encodeVarInt(target.length),
    ...encodeVarInt(metaBytes.length),
    ...metaBytes,
    ...actions,
    ...writeUint32LE(computeCrc32(source)),
    ...writeUint32LE(computeCrc32(target)),
  ];
  const patchCrc = computeCrc32(new Uint8Array(body));
  return new Uint8Array([...body, ...writeUint32LE(patchCrc)]);
}

test('computeCrc32 matches standard IEEE 802.3 CRC-32 for "123456789"', () => {
  const bytes = new TextEncoder().encode('123456789');
  assert.equal(formatCrc32Hex(computeCrc32(bytes)), '0xCBF43926');
});

test('applyBpsPatch applies SourceRead, TargetRead, SourceCopy, and overlapping TargetCopy', () => {
  const source = new TextEncoder().encode('ABCDEFGH12345678');
  // Target: "ABC" (SourceRead 3) + "XYZ" (TargetRead 3) + "1234" (SourceCopy +8, len 4) + "AB" (TargetRead 2) + "ABAB" (TargetCopy to 10, len 4)
  const target = new TextEncoder().encode('ABCXYZ1234ABABAB');

  const actions = [
    // 0: SourceRead len 3 -> (3 - 1) << 2 | 0 = 8
    ...encodeVarInt((2 << 2) | 0),
    // 1: TargetRead len 3 -> (3 - 1) << 2 | 1 = 9, bytes "XYZ"
    ...encodeVarInt((2 << 2) | 1),
    0x58, 0x59, 0x5a,
    // 2: SourceCopy len 4 -> (4 - 1) << 2 | 2 = 14, delta = +8 (to index 8 "1234") -> encoded 8 << 1 = 16
    ...encodeVarInt((3 << 2) | 2),
    ...encodeVarInt(8 << 1),
    // 3: TargetRead len 2 -> (2 - 1) << 2 | 1 = 5, bytes "AB" (at index 10)
    ...encodeVarInt((1 << 2) | 1),
    0x41, 0x42,
    // 4: TargetCopy len 4 -> (4 - 1) << 2 | 3 = 15, delta = +10 (to index 10 "AB", overlapping!) -> encoded 10 << 1 = 20
    ...encodeVarInt((3 << 2) | 3),
    ...encodeVarInt(10 << 1),
  ];

  const patch = buildSyntheticBps(source, target, actions, 'Test Patch');
  const result = applyBpsPatch(source, patch);

  assert.equal(new TextDecoder().decode(result.patched), 'ABCXYZ1234ABABAB');
  assert.equal(result.metadata, 'Test Patch');
  assert.equal(result.sourceCrc32, formatCrc32Hex(computeCrc32(source)));
  assert.equal(result.targetCrc32, formatCrc32Hex(computeCrc32(target)));
});

test('applyBpsPatch rejects wrong base ROM with clear error', () => {
  const source = new TextEncoder().encode('ORIGINAL_ROM');
  const wrongSource = new TextEncoder().encode('WRONG_ROM_00');
  const target = new TextEncoder().encode('PATCHED_ROM!');
  const actions = [
    ...encodeVarInt(((target.length - 1) << 2) | 1),
    ...Array.from(target),
  ];
  const patch = buildSyntheticBps(source, target, actions);

  assert.throws(
    () => applyBpsPatch(wrongSource, patch),
    /Base ROM does not match this BPS patch/
  );
});

test('applyBpsPatch rejects corrupt patch checksum', () => {
  const source = new TextEncoder().encode('ABCD');
  const target = new TextEncoder().encode('WXYZ');
  const actions = [
    ...encodeVarInt(((target.length - 1) << 2) | 1),
    ...Array.from(target),
  ];
  const patch = buildSyntheticBps(source, target, actions);
  patch[patch.length - 1] ^= 0xff; // corrupt patch CRC

  assert.throws(() => applyBpsPatch(source, patch), /Corrupt BPS patch/);
});

test('buildPatchedRomFileName keeps patched filename distinct from original', () => {
  assert.equal(
    buildPatchedRomFileName('Pokemon - Emerald Version (USA).gba', 'Emerald Kaizo.bps'),
    'Pokemon - Emerald Version (USA) [Emerald Kaizo].gba'
  );
});

function buildSyntheticUps(source, target) {
  const xorStream = [];
  const maxLen = Math.max(source.length, target.length);
  let i = 0;
  while (i < maxLen) {
    let skip = 0;
    while (i + skip < maxLen) {
      const s = i + skip < source.length ? source[i + skip] : 0;
      const t = i + skip < target.length ? target[i + skip] : 0;
      if (s !== t) break;
      skip++;
    }
    i += skip;
    if (i >= maxLen) break;
    xorStream.push(...encodeVarInt(skip));
    while (i < maxLen) {
      const s = i < source.length ? source[i] : 0;
      const t = i < target.length ? target[i] : 0;
      const diff = s ^ t;
      i++;
      if (diff === 0) {
        xorStream.push(0);
        break;
      }
      xorStream.push(diff);
    }
    if (i >= maxLen && xorStream[xorStream.length - 1] !== 0) {
      xorStream.push(0);
    }
  }
  const body = [
    0x55, 0x50, 0x53, 0x31, // UPS1
    ...encodeVarInt(source.length),
    ...encodeVarInt(target.length),
    ...xorStream,
    ...writeUint32LE(computeCrc32(source)),
    ...writeUint32LE(computeCrc32(target)),
  ];
  const patchCrc = computeCrc32(new Uint8Array(body));
  return new Uint8Array([...body, ...writeUint32LE(patchCrc)]);
}

test('applyUpsPatch applies skip, xor diff, 0x00 terminator, and size expansion', () => {
  const source = new TextEncoder().encode('ABCDEFGH');
  const target = new TextEncoder().encode('ABcDeFGH!!');
  const patch = buildSyntheticUps(source, target);

  const result = applyRomPatch(source, patch);
  assert.equal(new TextDecoder().decode(result.patched), 'ABcDeFGH!!');
  assert.equal(result.sourceCrc32, formatCrc32Hex(computeCrc32(source)));
  assert.equal(result.targetCrc32, formatCrc32Hex(computeCrc32(target)));
});

test('applyUpsPatch rejects wrong base ROM and corrupt patch checksum', () => {
  const source = new TextEncoder().encode('ORIGINAL');
  const wrongSource = new TextEncoder().encode('WRONGROM');
  const target = new TextEncoder().encode('MODIFIED');
  const patch = buildSyntheticUps(source, target);

  assert.throws(() => applyUpsPatch(wrongSource, patch), /Base ROM does not match this UPS patch/);

  const corrupt = new Uint8Array(patch);
  corrupt[corrupt.length - 1] ^= 0xff;
  assert.throws(() => applyUpsPatch(source, corrupt), /Corrupt UPS patch/);
});
