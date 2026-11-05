export type ColorProfile = 'vivid' | 'warm' | 'punch' | 'off';

export interface ColorProfileOption {
  id: ColorProfile;
  name: string;
  badge: string;
  desc: string;
  filter: string;
}

export const COLOR_PROFILES: ColorProfileOption[] = [
  {
    id: 'vivid',
    name: 'RetroArch Vivid',
    badge: 'Recommended',
    desc: 'Compensates reflective LCD palettes with +26% rich saturation & +14% deep contrast',
    filter: 'contrast(1.14) saturate(1.26) brightness(1.02)',
  },
  {
    id: 'warm',
    name: 'Warm Handheld LCD',
    badge: 'Authentic',
    desc: 'Soft warm backlight with natural color depth and balanced handheld gamma',
    filter: 'contrast(1.12) saturate(1.20) brightness(1.03) sepia(0.04)',
  },
  {
    id: 'punch',
    name: 'OLED High Punch',
    badge: 'Punchy',
    desc: 'Deep inky blacks with +20% contrast and ultra-vibrant +36% saturated colors',
    filter: 'contrast(1.20) saturate(1.36) brightness(1.02)',
  },
  {
    id: 'off',
    name: 'Neutral / Raw',
    badge: 'Raw',
    desc: 'Unadjusted flat core RGB output with zero color processing',
    filter: 'none',
  },
];

export function getComputedGameFilter(shaders: Record<string, any>): string {
  if (shaders.colorCorrection === false || shaders.colorProfile === 'off') {
    return 'none';
  }
  const profileId = (shaders.colorProfile as ColorProfile) || 'vivid';
  const found = COLOR_PROFILES.find((p) => p.id === profileId);
  return found ? found.filter : 'contrast(1.14) saturate(1.26) brightness(1.02)';
}
