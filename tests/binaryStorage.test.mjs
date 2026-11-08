import test from 'node:test';
import assert from 'node:assert/strict';
import { base64ToUint8Array, uint8ArrayToBase64, normalizeBinaryData } from '../src/services/storage/binary.ts';

test('shared binary conversion round-trips correctly', () => {
  const original = new Uint8Array([0, 1, 2, 255, 128, 64, 32, 16, 8, 4]);
  const b64 = uint8ArrayToBase64(original);
  const restored = base64ToUint8Array(b64);
  assert.deepEqual(restored, original);
});

test('normalizeBinaryData converts views, strings and buffers', () => {
  const bytes = new Uint8Array([10, 20, 30, 40]);
  assert.deepEqual(normalizeBinaryData(bytes), bytes);
  assert.deepEqual(normalizeBinaryData(bytes.buffer), bytes);
  assert.deepEqual(normalizeBinaryData(uint8ArrayToBase64(bytes)), bytes);
  assert.equal(normalizeBinaryData(null), null);
});
