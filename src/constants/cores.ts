export interface CoreInfo {
  core: string;
  system: string;
  shortSystem: string;
  badgeColor: string;
}

export const CORE_MAP: Record<string, CoreInfo> = {
  gb: { core: 'gambatte', system: 'Game Boy', shortSystem: 'GB', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  gbc: { core: 'gambatte', system: 'Game Boy Color', shortSystem: 'GBC', badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40' },
  gba: { core: 'mgba', system: 'Game Boy Advance', shortSystem: 'GBA', badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' },
  nes: { core: 'fceumm', system: 'Nintendo Entertainment System', shortSystem: 'NES', badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  sfc: { core: 'snes9x', system: 'Super Nintendo (SNES)', shortSystem: 'SNES', badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  smc: { core: 'snes9x', system: 'Super Nintendo (SNES)', shortSystem: 'SNES', badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  md: { core: 'genesis_plus_gx', system: 'Sega Genesis / Mega Drive', shortSystem: 'GEN', badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  gen: { core: 'genesis_plus_gx', system: 'Sega Genesis / Mega Drive', shortSystem: 'GEN', badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  smd: { core: 'genesis_plus_gx', system: 'Sega Genesis / Mega Drive', shortSystem: 'GEN', badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  bin: { core: 'genesis_plus_gx', system: 'Sega Genesis / Binary ROM', shortSystem: 'BIN', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
};

export const EJS_CORES: Record<string, string> = {
  gambatte: 'gb',
  mgba: 'gba',
  fceumm: 'nes',
  snes9x: 'snes',
  genesis_plus_gx: 'segaMD',
};

export const LIBRETRO_SYSTEM_MAP: Record<string, string> = {
  gb: 'Nintendo - Game Boy',
  gbc: 'Nintendo - Game Boy Color',
  gba: 'Nintendo - Game Boy Advance',
  nes: 'Nintendo - Nintendo Entertainment System',
  sfc: 'Nintendo - Super Nintendo Entertainment System',
  smc: 'Nintendo - Super Nintendo Entertainment System',
  md: 'Sega - Mega Drive - Genesis',
  gen: 'Sega - Mega Drive - Genesis',
  smd: 'Sega - Mega Drive - Genesis',
  bin: 'Sega - Mega Drive - Genesis',
};

export const coreRatio = (core: string): number =>
  ({ gambatte: 10 / 9, mgba: 3 / 2, fceumm: 8 / 7, snes9x: 8 / 7 }[core] || 4 / 3);

export function formatGameTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  return rawTitle
    .replace(/\.[a-zA-Z0-9]+$/, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || rawTitle;
}

export function getBoxartUrls(game: any): string[] {
  if (!game) return [];
  const urls: string[] = [];
  if (game.coverUrl) urls.push(game.coverUrl);

  const ext = game.ext || (game.fileName ? game.fileName.split('.').pop().toLowerCase() : '');
  const libSystem = LIBRETRO_SYSTEM_MAP[ext] || (game.shortSystem === 'GBC' ? 'Nintendo - Game Boy Color' : null);

  if (libSystem && game.fileName) {
    const rawBase = game.fileName.replace(/\.[^/.]+$/, '');
    urls.push(`https://thumbnails.libretro.com/${encodeURIComponent(libSystem)}/Named_Boxarts/${encodeURIComponent(rawBase)}.png`);
  }
  if (libSystem && game.title) {
    urls.push(`https://thumbnails.libretro.com/${encodeURIComponent(libSystem)}/Named_Boxarts/${encodeURIComponent(game.title)}.png`);
    const clean = formatGameTitle(game.title);
    if (clean !== game.title) {
      urls.push(`https://thumbnails.libretro.com/${encodeURIComponent(libSystem)}/Named_Boxarts/${encodeURIComponent(clean)}.png`);
    }
  }
  return urls;
}
