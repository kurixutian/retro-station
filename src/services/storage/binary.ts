// ============================================================================
// Binary / Base64 Conversion Utilities
// ============================================================================

export function base64ToUint8Array(b64: string): Uint8Array {
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const CHUNK_SIZE = 0x8000;
  for (let i = 0; i < len; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

export function normalizeBinaryData(val: any): Uint8Array | null {
  if (!val) return null;
  let bytes: Uint8Array | null = null;

  if (val instanceof Uint8Array) {
    bytes = new Uint8Array(val.length);
    bytes.set(val);
  } else if (ArrayBuffer.isView(val)) {
    const view = new Uint8Array(val.buffer, val.byteOffset, val.byteLength);
    bytes = new Uint8Array(view.length);
    bytes.set(view);
  } else if (val instanceof ArrayBuffer) {
    bytes = new Uint8Array(val.byteLength);
    bytes.set(new Uint8Array(val));
  } else if (Array.isArray(val)) {
    if (val.length > 0 && typeof val[0] === 'number') {
      bytes = new Uint8Array(val);
    } else {
      return null;
    }
  } else if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return normalizeBinaryData(JSON.parse(trimmed));
      } catch {}
    }
    try {
      bytes = base64ToUint8Array(trimmed);
    } catch {
      return null;
    }
  } else if (typeof val === 'object') {
    if (typeof val.base64 === 'string') {
      return base64ToUint8Array(val.base64);
    }
    if (val.buffer instanceof ArrayBuffer) {
      bytes = new Uint8Array(val.buffer, val.byteOffset || 0, val.byteLength || val.buffer.byteLength);
    } else {
      const keys = Object.keys(val);
      if (keys.length > 0 && keys[0] === '0' && typeof val[0] === 'number') {
        const vals = Object.values(val);
        if (typeof vals[0] === 'number') {
          bytes = new Uint8Array(vals as number[]);
        }
      }
    }
  }

  // Repair double-serialized JSON byte arrays
  if (
    bytes &&
    bytes.length > 4 &&
    ((bytes[0] === 0x7b && bytes[1] === 0x22 && bytes[2] === 0x30 && bytes[3] === 0x22 && bytes[4] === 0x3a) ||
      (bytes[0] === 0x5b && bytes[bytes.length - 1] === 0x5d))
  ) {
    try {
      const parsed = JSON.parse(new TextDecoder().decode(bytes));
      if (parsed && typeof parsed === 'object') {
        const vals = Array.isArray(parsed) ? parsed : Object.values(parsed);
        if (vals.length > 0 && typeof vals[0] === 'number') {
          return new Uint8Array(vals as number[]);
        }
      }
    } catch {}
  }

  return bytes && bytes.length > 0 ? bytes : null;
}
