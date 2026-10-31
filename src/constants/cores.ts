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

  // 1. User custom boxart override (Base64 data URI or custom URL)
  if (game.customBoxart) urls.push(game.customBoxart);
  if (game.coverUrl && !urls.includes(game.coverUrl)) urls.push(game.coverUrl);

  const ext = game.ext || (game.fileName ? game.fileName.split('.').pop().toLowerCase() : '');
  const libSystem =
    LIBRETRO_SYSTEM_MAP[ext] ||
    (game.shortSystem === 'GBC'
      ? 'Nintendo - Game Boy Color'
      : game.shortSystem === 'GBA'
      ? 'Nintendo - Game Boy Advance'
      : game.shortSystem === 'GB'
      ? 'Nintendo - Game Boy'
      : game.shortSystem === 'NES'
      ? 'Nintendo - Nintendo Entertainment System'
      : game.shortSystem === 'SNES'
      ? 'Nintendo - Super Nintendo Entertainment System'
      : game.shortSystem === 'GEN' || game.shortSystem === 'MD'
      ? 'Sega - Mega Drive - Genesis'
      : null);

  if (!libSystem) return urls;

  const candidateTitles = new Set<string>();

  // Raw filename without extension
  if (game.fileName) {
    const rawBase = game.fileName.replace(/\.[^/.]+$/, '').trim();
    if (rawBase) candidateTitles.add(rawBase);
  }

  // Game Title
  if (game.title) {
    candidateTitles.add(game.title.trim());
  }

  // Clean title without bracketed regions
  const clean = formatGameTitle(game.title || game.fileName || '');
  if (clean) {
    candidateTitles.add(clean);
    // Common Libretro regional variations
    candidateTitles.add(`${clean} (USA, Europe)`);
    candidateTitles.add(`${clean} (USA)`);
    candidateTitles.add(`${clean} (Europe)`);
    candidateTitles.add(`${clean} (World)`);
    candidateTitles.add(`${clean} (Japan)`);
    // Hyphenated forms (e.g. Pokemon - Emerald Version)
    if (clean.includes(' ')) {
      const parts = clean.split(' ');
      if (parts.length >= 2) {
        candidateTitles.add(`${parts[0]} - ${parts.slice(1).join(' ')}`);
        candidateTitles.add(`${parts[0]} - ${parts.slice(1).join(' ')} (USA)`);
        candidateTitles.add(`${parts[0]} - ${parts.slice(1).join(' ')} (USA, Europe)`);
      }
    }
  }

  const encodedSystem = encodeURIComponent(libSystem);
  for (const title of candidateTitles) {
    const safeTitle = title.replace(/[/:*?"<>|\\]/g, '_').trim();
    const encodedTitle = encodeURIComponent(safeTitle);
    // GitHub raw CDN (Fastest, zero CORS limits, global cache)
    urls.push(`https://raw.githubusercontent.com/libretro-thumbnails/${encodedSystem}/master/Named_Boxarts/${encodedTitle}.png`);
    // Libretro official thumbnails mirror
    urls.push(`https://thumbnails.libretro.com/${encodedSystem}/Named_Boxarts/${encodedTitle}.png`);
  }

  return urls;
}
