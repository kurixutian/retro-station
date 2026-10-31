import { PadLayout } from '../types';

export const EMU_INPUT_MAP: Record<string, number> = {
  actionB: 0, // RetroArch B
  actionY: 1, // RetroArch Y
  select: 2,  // RetroArch Select
  start: 3,   // RetroArch Start
  up: 4,      // RetroArch Up
  down: 5,    // RetroArch Down
  left: 6,    // RetroArch Left
  right: 7,   // RetroArch Right
  actionA: 8, // RetroArch A
  actionX: 9, // RetroArch X
  btnL: 10,   // RetroArch L
  btnR: 11    // RetroArch R
};

export const PAD_KEYS: Record<string, [string, number]> = {
  up: ['ArrowUp', 38],
  down: ['ArrowDown', 40],
  left: ['ArrowLeft', 37],
  right: ['ArrowRight', 39],
  actionA: ['x', 88],
  actionB: ['z', 90],
  actionX: ['s', 83],
  actionY: ['a', 65],
  start: ['Enter', 13],
  select: ['ShiftRight', 16],
  btnL: ['q', 81],
  btnR: ['w', 87]
};

export const DEFAULT_PAD_LAYOUT: PadLayout = {
  transport: { x: 0.5, y: 0.1, s: 1 },
  dpad: { x: 0.24, y: 0.42, s: 1 },
  actions: { x: 0.76, y: 0.42, s: 1 },
  system: { x: 0.5, y: 0.74, s: 1 }
};

export const PAD_LABELS: Record<keyof PadLayout, string> = {
  transport: 'Pause / Rewind / Speed',
  dpad: 'D-Pad',
  actions: 'A / B Buttons',
  system: 'Select / Start'
};

export function loadPadLayout(): PadLayout {
  try {
    const saved = JSON.parse(localStorage.getItem('retro_pad_layout') || 'null');
    if (saved) return { ...DEFAULT_PAD_LAYOUT, ...saved };
  } catch (e) {}
  return DEFAULT_PAD_LAYOUT;
}
