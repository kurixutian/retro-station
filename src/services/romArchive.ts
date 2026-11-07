import { unzip } from 'fflate';
import type { Unzipped } from 'fflate';
import { CORE_MAP } from '../constants/cores.ts';

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
 * Decompresses a ZIP archive and extracts all recognized ROM files inside it.
 * Automatically ignores directories, macOS metadata files (__MACOSX, ._*),
 * and non-game files (readme, images, etc.).
 */
export async function extractRomsFromZip(
  fileOrBytes: File | Blob | ArrayBuffer | Uint8Array
): Promise<File[]> {
  let bytes: Uint8Array;
  if (fileOrBytes instanceof Uint8Array) {
    bytes = fileOrBytes;
  } else if (fileOrBytes instanceof ArrayBuffer) {
    bytes = new Uint8Array(fileOrBytes);
  } else {
    const ab = await fileOrBytes.arrayBuffer();
    bytes = new Uint8Array(ab);
  }

  const unzipped = await new Promise<Unzipped>((resolve, reject) => {
    unzip(bytes, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  const romFiles: File[] = [];

  for (const [rawPath, data] of Object.entries(unzipped)) {
    if (!data || data.length === 0 || rawPath.endsWith('/')) {
      continue;
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
      continue;
    }

    const parts = fileName.split('.');
    if (parts.length < 2) continue;
    const ext = parts.pop()!.toLowerCase();

    if (CORE_MAP[ext]) {
      const romFile = new File([data], fileName, {
        type: 'application/octet-stream',
        lastModified: Date.now(),
      });
      romFiles.push(romFile);
    }
  }

  romFiles.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );

  return romFiles;
}
