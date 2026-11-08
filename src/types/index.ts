export interface Game {
  id: string;
  title: string;
  fileName: string;
  core: string;
  system: string;
  shortSystem: string;
  engineType?: string;
  real?: boolean;
  coverGradient?: string;
  customBoxart?: string;
  customTitle?: string;
  fileSize?: number;
  cover?: string;
  customCover?: string;
  crc32?: string;
}

export interface SaveSlot {
  slot: number;
  empty: boolean;
  label: string;
  timestamp: string | null;
  score: number;
  frame: number;
  screenshot: string | null;
  stateData: any | null;
}

export interface ShadersState {
  scanlines: boolean;
  curvature: boolean;
  vignette: boolean;
  gbGrid: boolean;
  bloom: boolean;
  amoled: boolean;
}

export interface Theme {
  id: string;
  name: string;
  desc: string;
  isLight?: boolean;
  appBg: string;
  shellBg: string;
  deckBg: string;
  bezelBg: string;
  cardBg: string;
  accentText: string;
  accentBg: string;
  accentBorder: string;
  accentSoft: string;
  dpadBg: string;
  btnA: string;
  btnB: string;
  btnXY: string;
  hex: string;
  customAccent?: string;
}

export interface PadGroupPosition {
  x: number;
  y: number;
  s: number;
}

export interface PadLayout {
  transport: PadGroupPosition;
  dpad: PadGroupPosition;
  actions: PadGroupPosition;
  system: PadGroupPosition;
  screen?: PadGroupPosition;
}

export type PadGroupId = keyof PadLayout;
