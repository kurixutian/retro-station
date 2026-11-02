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
  up: ['ArrowUp / W', 38],
  down: ['ArrowDown / S', 40],
  left: ['ArrowLeft / A', 37],
  right: ['ArrowRight / D', 39],
  actionA: ['X / L', 88],
  actionB: ['Z / K', 90],
  actionX: ['C / I', 67],
  actionY: ['V / J', 86],
  start: ['Enter', 13],
  select: ['Shift / Space', 16],
  btnL: ['Q / U', 81],
  btnR: ['E / O', 69]
};

export interface ControlBinding {
  category: string;
  name: string;
  primaryKey: string;
  altKey: string;
  gamepad: string;
}

export const CONTROL_BINDINGS: ControlBinding[] = [
  { category: 'Movement', name: 'D-Pad Up', primaryKey: 'W', altKey: '↑ Arrow', gamepad: 'D-Pad Up / L-Stick' },
  { category: 'Movement', name: 'D-Pad Down', primaryKey: 'S', altKey: '↓ Arrow', gamepad: 'D-Pad Down / L-Stick' },
  { category: 'Movement', name: 'D-Pad Left', primaryKey: 'A', altKey: '← Arrow', gamepad: 'D-Pad Left / L-Stick' },
  { category: 'Movement', name: 'D-Pad Right', primaryKey: 'D', altKey: '→ Arrow', gamepad: 'D-Pad Right / L-Stick' },
  { category: 'Action', name: 'Button A', primaryKey: 'X', altKey: 'L', gamepad: 'Button A (East)' },
  { category: 'Action', name: 'Button B', primaryKey: 'Z', altKey: 'K', gamepad: 'Button B (South)' },
  { category: 'Action', name: 'Button X', primaryKey: 'C', altKey: 'I', gamepad: 'Button X (North)' },
  { category: 'Action', name: 'Button Y', primaryKey: 'V', altKey: 'J', gamepad: 'Button Y (West)' },
  { category: 'Shoulders', name: 'Shoulder L', primaryKey: 'Q', altKey: 'U', gamepad: 'Left Bumper (LB / L1)' },
  { category: 'Shoulders', name: 'Shoulder R', primaryKey: 'E', altKey: 'O', gamepad: 'Right Bumper (RB / R1)' },
  { category: 'System', name: 'Start', primaryKey: 'Enter', altKey: '—', gamepad: 'Start / Options' },
  { category: 'System', name: 'Select', primaryKey: 'Space', altKey: 'Right Shift', gamepad: 'Select / Share' },
  { category: 'Hotkeys', name: 'In-Game Menu', primaryKey: 'Escape', altKey: '` (Backquote)', gamepad: 'Home / Guide' },
  { category: 'Hotkeys', name: 'Pause / Resume', primaryKey: 'P', altKey: '—', gamepad: '—' },
  { category: 'Hotkeys', name: 'Rewind (Hold)', primaryKey: 'R', altKey: 'Backspace', gamepad: '—' },
  { category: 'Hotkeys', name: 'Fast-Forward', primaryKey: 'F', altKey: '—', gamepad: '—' },
  { category: 'Hotkeys', name: 'Quick Save (Slot 1)', primaryKey: 'F1', altKey: '—', gamepad: '—' },
  { category: 'Hotkeys', name: 'Quick Load (Slot 1)', primaryKey: 'F3', altKey: '—', gamepad: '—' },
  { category: 'Hotkeys', name: 'Mute Audio', primaryKey: 'M', altKey: '—', gamepad: '—' },
];

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
