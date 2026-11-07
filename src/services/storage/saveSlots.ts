import { SaveSlot } from '../../types';

export function downloadBinaryFile(uint8Array: Uint8Array, fileName: string) {
  const blob = new Blob([uint8Array as any], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function createEmptySlotsForGame(_gameId?: string): SaveSlot[] {
  return [1, 2, 3, 4].map((slot) => ({
    slot,
    empty: true,
    label: 'Empty Slot',
    timestamp: null,
    score: 0,
    frame: 0,
    screenshot: null,
    stateData: null
  }));
}
