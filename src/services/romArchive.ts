import { unzip } from 'fflate';
import type { Unzipped } from 'fflate';
import { createExtractorFromData } from 'node-unrar-js';
import { CORE_MAP } from '../constants/cores.ts';

let cachedUnrarWasm: ArrayBuffer | null = null;

async function getUnrarWasmBinary(): Promise<ArrayBuffer | undefined> {
  if (typeof window === 'undefined') return undefined;
  if (cachedUnrarWasm) return cachedUnrarWasm;
  const res = await fetch('./unrar.wasm');
  if (!res.ok) {
    throw new Error(`Failed to load unrar.wasm (${res.status})`);
  }
  cachedUnrarWasm = await res.arrayBuffer();
  return cachedUnrarWasm;
}

async function toBytes(fileOrBytes: File | Blob | ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  if (fileOrBytes instanceof Uint8Array) return fileOrBytes;
  if (fileOrBytes instanceof ArrayBuffer) return new Uint8Array(fileOrBytes);
  return new Uint8Array(await fileOrBytes.arrayBuffer());
}

function collectSupportedRomFile(rawPath: string, data: Uint8Array | null | undefined, out: File[]): void {
  if (!data || data.length === 0 || rawPath.endsWith('/')) {
    return;
  }

  const normalizedPath = rawPath.replace(/\\/g, '/');
  const segments = normalizedPath.split('/');
  const fileName = segments[segments.length - 1];

  // Filter macOS resource forks and hidden files
  if (
    normalizedPath.includes('__MACOSX/') ||
    fileName.startsWith('.') ||
    fileName.startsWith('._')
  ) {
    return;
  }

  const parts = fileName.split('.');
  if (parts.length < 2) return;
  const ext = parts.pop()!.toLowerCase();

  if (CORE_MAP[ext]) {
    out.push(
      new File([new Uint8Array(data)], fileName, {
        type: 'application/octet-stream',
        lastModified: Date.now(),
      })
    );
  }
}

function sortRomFiles(romFiles: File[]): File[] {
  return romFiles.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );
}

/**
 * Checks if a file represents a ZIP archive by extension or MIME type.
 */
export function isZipFile(file: { name?: string; type?: string }): boolean {
  if (file.name && /\.zip$/i.test(file.name)) return true;
  if (file.type && /^(application\/zip|application\/x-zip|application\/x-zip-compressed)$/i.test(file.type)) {
    return true;
  }
  return false;
}

/**
 * Checks if a binary buffer has the standard PK zip header magic signature (PK\x03\x04 or PK\x05\x06).
 */
export function isZipBuffer(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07) &&
    (bytes[3] === 0x04 || bytes[3] === 0x06 || bytes[3] === 0x08)
  );
}

/**
 * Checks if a file represents a RAR archive by extension or MIME type.
 */
export function isRarFile(file: { name?: string; type?: string }): boolean {
  if (file.name && /\.rar$/i.test(file.name)) return true;
  if (file.type && /^(application\/vnd\.rar|application\/x-rar-compressed|application\/x-rar)$/i.test(file.type)) {
    return true;
  }
  return false;
}

/**
 * Checks if a binary buffer has the RAR4 or RAR5 magic signature ("Rar!\x1a\x07").
 */
export function isRarBuffer(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 7 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x61 &&
    bytes[2] === 0x72 &&
    bytes[3] === 0x21 &&
    bytes[4] === 0x1a &&
    bytes[5] === 0x07 &&
    (bytes[6] === 0x00 || bytes[6] === 0x01)
  );
}

/**
 * Decompresses a ZIP archive and extracts all recognized ROM files inside it.
 * Automatically ignores directories, macOS metadata files (__MACOSX, ._*),
 * and non-game files (readme, images, etc.).
 */
export async function extractRomsFromZip(
  fileOrBytes: File | Blob | ArrayBuffer | Uint8Array
): Promise<File[]> {
  const bytes = await toBytes(fileOrBytes);

  const unzipped = await new Promise<Unzipped>((resolve, reject) => {
    unzip(bytes, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  const romFiles: File[] = [];
  for (const [rawPath, data] of Object.entries(unzipped)) {
    collectSupportedRomFile(rawPath, data, romFiles);
  }

  return sortRomFiles(romFiles);
}

/**
 * Decompresses a RAR archive (RAR4/RAR5) and extracts all recognized ROM files inside it.
 */
export async function extractRomsFromRar(
  fileOrBytes: File | Blob | ArrayBuffer | Uint8Array
): Promise<File[]> {
  const bytes = await toBytes(fileOrBytes);
  const wasmBinary = await getUnrarWasmBinary();
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const extractor = await createExtractorFromData({ data, wasmBinary });
  const extracted = extractor.extract();

  const romFiles: File[] = [];
  for (const item of extracted.files) {
    if (item.fileHeader.flags.directory) continue;
    collectSupportedRomFile(item.fileHeader.name, item.extraction, romFiles);
  }

  return sortRomFiles(romFiles);
}
