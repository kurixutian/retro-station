/**
 * Pure TypeScript BPS (Beat Patching System) & UPS (Universal Patching System)
 * ROM patcher + IEEE 802.3 CRC-32.
 * BPS Spec: https://www.romhacking.net/documents/746/
 */

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function formatCrc32Hex(crc: number): string {
  return '0x' + (crc >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

function readUint32LE(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset] |
      (buf[offset + 1] << 8) |
      (buf[offset + 2] << 16) |
      (buf[offset + 3] << 24)) >>>
    0
  );
}

export interface BpsPatchResult {
  patched: Uint8Array;
  metadata: string;
  sourceCrc32: string;
  targetCrc32: string;
}

export function applyBpsPatch(source: Uint8Array, patch: Uint8Array): BpsPatchResult {
  if (patch.length < 19) {
    throw new Error('Invalid BPS patch: file is too small.');
  }

  // Magic "BPS1"
  if (patch[0] !== 0x42 || patch[1] !== 0x50 || patch[2] !== 0x53 || patch[3] !== 0x31) {
    throw new Error('Invalid BPS patch: missing BPS1 header.');
  }

  const footerOffset = patch.length - 12;
  const expectedSourceCrc = readUint32LE(patch, footerOffset);
  const expectedTargetCrc = readUint32LE(patch, footerOffset + 4);
  const expectedPatchCrc = readUint32LE(patch, footerOffset + 8);

  const actualPatchCrc = computeCrc32(patch.subarray(0, patch.length - 4));
  if (actualPatchCrc !== expectedPatchCrc) {
    throw new Error(
      `Corrupt BPS patch: patch checksum mismatch (expected ${formatCrc32Hex(expectedPatchCrc)}, got ${formatCrc32Hex(actualPatchCrc)}).`
    );
  }

  let offset = 4;
  const readVarInt = (): number => {
    let data = 0;
    let shift = 1;
    while (true) {
      if (offset >= footerOffset) {
        throw new Error('Invalid BPS patch: unexpected end of patch stream.');
      }
      const x = patch[offset++];
      data += (x & 0x7f) * shift;
      if (x & 0x80) break;
      shift *= 128;
      data += shift;
    }
    return data;
  };

  const sourceSize = readVarInt();
  const targetSize = readVarInt();
  const metadataSize = readVarInt();

  if (offset + metadataSize > footerOffset) {
    throw new Error('Invalid BPS patch: metadata extends past patch body.');
  }

  let metadata = '';
  if (metadataSize > 0) {
    metadata = new TextDecoder().decode(patch.subarray(offset, offset + metadataSize));
    offset += metadataSize;
  }

  const actualSourceCrc = computeCrc32(source);
  if (source.length !== sourceSize || actualSourceCrc !== expectedSourceCrc) {
    throw new Error(
      `Base ROM does not match this BPS patch (expected ${sourceSize} bytes / ${formatCrc32Hex(expectedSourceCrc)}, got ${source.length} bytes / ${formatCrc32Hex(actualSourceCrc)}).`
    );
  }

  const target = new Uint8Array(targetSize);
  let outputOffset = 0;
  let sourceRelativeOffset = 0;
  let targetRelativeOffset = 0;

  while (offset < footerOffset) {
    const data = readVarInt();
    const command = data & 3;
    const length = Math.floor(data / 4) + 1;

    if (outputOffset + length > targetSize) {
      throw new Error('Invalid BPS patch: output exceeds target size.');
    }

    if (command === 0) {
      // SourceRead
      for (let i = 0; i < length; i++) {
        target[outputOffset] = outputOffset < source.length ? source[outputOffset] : 0;
        outputOffset++;
      }
    } else if (command === 1) {
      // TargetRead
      if (offset + length > footerOffset) {
        throw new Error('Invalid BPS patch: TargetRead extends past patch body.');
      }
      target.set(patch.subarray(offset, offset + length), outputOffset);
      offset += length;
      outputOffset += length;
    } else if (command === 2) {
      // SourceCopy
      const rawDelta = readVarInt();
      const signedDelta = (rawDelta & 1 ? -1 : 1) * Math.floor(rawDelta / 2);
      sourceRelativeOffset += signedDelta;
      if (sourceRelativeOffset < 0 || sourceRelativeOffset + length > source.length) {
        throw new Error('Invalid BPS patch: SourceCopy out of bounds.');
      }
      target.set(source.subarray(sourceRelativeOffset, sourceRelativeOffset + length), outputOffset);
      sourceRelativeOffset += length;
      outputOffset += length;
    } else {
      // TargetCopy (must copy byte-by-byte to support overlapping runs)
      const rawDelta = readVarInt();
      const signedDelta = (rawDelta & 1 ? -1 : 1) * Math.floor(rawDelta / 2);
      targetRelativeOffset += signedDelta;
      if (targetRelativeOffset < 0 || targetRelativeOffset >= outputOffset) {
        throw new Error('Invalid BPS patch: TargetCopy out of bounds.');
      }
      for (let i = 0; i < length; i++) {
        target[outputOffset++] = target[targetRelativeOffset++];
      }
    }
  }

  if (outputOffset !== targetSize) {
    throw new Error(
      `Invalid BPS patch: output size mismatch (expected ${targetSize}, got ${outputOffset}).`
    );
  }

  const actualTargetCrc = computeCrc32(target);
  if (actualTargetCrc !== expectedTargetCrc) {
    throw new Error(
      `Patched ROM checksum mismatch (expected ${formatCrc32Hex(expectedTargetCrc)}, got ${formatCrc32Hex(actualTargetCrc)}).`
    );
  }

  return {
    patched: target,
    metadata,
    sourceCrc32: formatCrc32Hex(actualSourceCrc),
    targetCrc32: formatCrc32Hex(actualTargetCrc),
  };
}

export function applyUpsPatch(source: Uint8Array, patch: Uint8Array): BpsPatchResult {
  if (patch.length < 18) {
    throw new Error('Invalid UPS patch: file is too small.');
  }

  // Magic "UPS1"
  if (patch[0] !== 0x55 || patch[1] !== 0x50 || patch[2] !== 0x53 || patch[3] !== 0x31) {
    throw new Error('Invalid UPS patch: missing UPS1 header.');
  }

  const footerOffset = patch.length - 12;
  const expectedSourceCrc = readUint32LE(patch, footerOffset);
  const expectedTargetCrc = readUint32LE(patch, footerOffset + 4);
  const expectedPatchCrc = readUint32LE(patch, footerOffset + 8);

  const actualPatchCrc = computeCrc32(patch.subarray(0, patch.length - 4));
  if (actualPatchCrc !== expectedPatchCrc) {
    throw new Error(
      `Corrupt UPS patch: patch checksum mismatch (expected ${formatCrc32Hex(expectedPatchCrc)}, got ${formatCrc32Hex(actualPatchCrc)}).`
    );
  }

  let offset = 4;
  const readVarInt = (): number => {
    let data = 0;
    let shift = 1;
    while (true) {
      if (offset >= footerOffset) {
        throw new Error('Invalid UPS patch: unexpected end of patch stream.');
      }
      const x = patch[offset++];
      data += (x & 0x7f) * shift;
      if (x & 0x80) break;
      shift *= 128;
      data += shift;
    }
    return data;
  };

  const sourceSize = readVarInt();
  const targetSize = readVarInt();

  const actualSourceCrc = computeCrc32(source);
  if (source.length !== sourceSize || actualSourceCrc !== expectedSourceCrc) {
    throw new Error(
      `Base ROM does not match this UPS patch (expected ${sourceSize} bytes / ${formatCrc32Hex(expectedSourceCrc)}, got ${source.length} bytes / ${formatCrc32Hex(actualSourceCrc)}).`
    );
  }

  const target = new Uint8Array(targetSize);
  target.set(source.subarray(0, Math.min(source.length, targetSize)));

  let outputOffset = 0;
  while (offset < footerOffset) {
    outputOffset += readVarInt();
    while (offset < footerOffset) {
      const xorByte = patch[offset++];
      if (xorByte === 0) {
        outputOffset++;
        break;
      }
      if (outputOffset >= targetSize) {
        throw new Error('Invalid UPS patch: output exceeds target size.');
      }
      const srcByte = outputOffset < source.length ? source[outputOffset] : 0;
      target[outputOffset++] = srcByte ^ xorByte;
    }
  }

  const actualTargetCrc = computeCrc32(target);
  if (actualTargetCrc !== expectedTargetCrc) {
    throw new Error(
      `Patched ROM checksum mismatch (expected ${formatCrc32Hex(expectedTargetCrc)}, got ${formatCrc32Hex(actualTargetCrc)}).`
    );
  }

  return {
    patched: target,
    metadata: '',
    sourceCrc32: formatCrc32Hex(actualSourceCrc),
    targetCrc32: formatCrc32Hex(actualTargetCrc),
  };
}

export function applyRomPatch(source: Uint8Array, patch: Uint8Array): BpsPatchResult {
  if (patch.length >= 4) {
    if (patch[0] === 0x42 && patch[1] === 0x50 && patch[2] === 0x53 && patch[3] === 0x31) {
      return applyBpsPatch(source, patch);
    }
    if (patch[0] === 0x55 && patch[1] === 0x50 && patch[2] === 0x53 && patch[3] === 0x31) {
      return applyUpsPatch(source, patch);
    }
  }
  throw new Error('Unsupported patch format. Expected a .bps (BPS1) or .ups (UPS1) patch file.');
}

export function buildPatchedRomFileName(romFileName: string, patchFileName: string): string {
  const romDot = romFileName.lastIndexOf('.');
  const romBase = romDot > 0 ? romFileName.slice(0, romDot) : romFileName;
  const romExt = romDot > 0 ? romFileName.slice(romDot) : '.gba';

  const patchDot = patchFileName.lastIndexOf('.');
  const patchBase = (patchDot > 0 ? patchFileName.slice(0, patchDot) : patchFileName).trim() || 'Patched';

  return `${romBase} [${patchBase}]${romExt}`;
}
