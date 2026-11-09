export interface CoreInfo {
  core: string;
  system: string;
  shortSystem: string;
  badgeColor: string;
}

export const CORE_MAP: Record<string, CoreInfo> = {
  gb: { core: 'gambatte', system: 'Game Boy', shortSystem: 'GB', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  gbc: { core: 'gambatte', system: 'Game Boy Color', shortSystem: 'GBC', badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40' },
  gba: { core: 'mgba', system: 'Game Boy Advance', shortSystem: 'GBA', badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
};

export const EJS_CORES: Record<string, string> = {
  gambatte: 'gb',
  mgba: 'gba',
};

export const LIBRETRO_SYSTEM_MAP: Record<string, string> = {
  gb: 'Nintendo - Game Boy',
  gbc: 'Nintendo - Game Boy Color',
  gba: 'Nintendo - Game Boy Advance',
};

export const coreRatio = (core: string, isLandscape: boolean = false): number => {
  return ({ gambatte: 10 / 9, mgba: 3 / 2 }[core] || 10 / 9);
};

export function formatGameTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  let title = rawTitle
    .replace(/\.[a-zA-Z0-9]+$/, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (/, The$/i.test(title)) {
    title = `The ${title.replace(/, The$/i, '').trim()}`;
  }
  return title || rawTitle;
}

/** Sanitize title to Libretro thumbnail filename standards (replaces & * / : ` < > ? \ | " with _) */
export function sanitizeLibretroTitle(title: string): string {
  return title.replace(/[&*\/:\`<>?\\|"]/g, '_').trim();
}

/** Capitalize words for Title Case matching */
export function toTitleCase(str: string): string {
  return str.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** Map a game object to its Libretro thumbnails system folder (e.g. "Nintendo - Game Boy Color") */
export function getLibretroSystem(game: any): string | null {
  if (!game) return null;
  const ext = game.ext || (game.fileName ? game.fileName.split('.').pop()?.toLowerCase() : '');
  return (
    (ext && LIBRETRO_SYSTEM_MAP[ext]) ||
    (game.shortSystem === 'GBC'
      ? 'Nintendo - Game Boy Color'
      : game.shortSystem === 'GBA'
      ? 'Nintendo - Game Boy Advance'
      : game.shortSystem === 'GB'
      ? 'Nintendo - Game Boy'
      : game.shortSystem === 'NES'
      ? 'Nintendo - Nintendo Entertainment System'
      : game.shortSystem === 'SNES' || game.shortSystem === 'SFC'
      ? 'Nintendo - Super Nintendo Entertainment System'
      : game.shortSystem === 'GEN' || game.shortSystem === 'MD' || game.shortSystem === 'SMD'
      ? 'Sega - Mega Drive - Genesis'
      : game.core === 'mgba'
      ? 'Nintendo - Game Boy Advance'
      : game.core === 'fceumm'
      ? 'Nintendo - Nintendo Entertainment System'
      : game.core === 'snes9x'
      ? 'Nintendo - Super Nintendo Entertainment System'
      : game.core === 'genesis_plus_gx'
      ? 'Sega - Mega Drive - Genesis'
      : game.core === 'gambatte'
      ? (game.shortSystem === 'GB' ? 'Nintendo - Game Boy' : 'Nintendo - Game Boy Color')
      : null) ||
    null
  );
}

export function getBoxartUrls(game: any): string[] {
  if (!game) return [];
  const urls: string[] = [];

  // 1. User custom boxart override (Base64 data URI, custom cover, or custom URL)
  if (game.customCover) urls.push(game.customCover);
  if (game.customBoxart) urls.push(game.customBoxart);
  if (game.cover && !urls.includes(game.cover)) urls.push(game.cover);
  if (game.coverUrl && !urls.includes(game.coverUrl)) urls.push(game.coverUrl);

  const libSystem = getLibretroSystem(game);
  if (!libSystem) return urls;

  const candidateTitles = new Set<string>();
  const rawFile = game.fileName ? game.fileName.trim() : '';
  const rawBase = rawFile ? rawFile.replace(/\.[^/.]+$/, '').trim() : '';

  // A. Raw exact base filename (e.g. "Pokemon - Emerald Version (USA, Europe)")
  if (rawBase) {
    candidateTitles.add(rawBase);

    // Strip bracketed dump/release tags like [!], [b1], [h1C]
    const withoutDumpTags = rawBase.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
    if (withoutDumpTags && withoutDumpTags !== rawBase) {
      candidateTitles.add(withoutDumpTags);
    }

    // Expand GoodTools short region codes e.g. (U) -> (USA), (E) -> (Europe)
    const expandedGoodTools = withoutDumpTags
      .replace(/\(U\)/gi, '(USA)')
      .replace(/\(E\)/gi, '(Europe)')
      .replace(/\(J\)/gi, '(Japan)')
      .replace(/\(UE\)/gi, '(USA, Europe)')
      .replace(/\(JU\)/gi, '(Japan, USA)')
      .replace(/\(W\)/gi, '(World)')
      .trim();
    if (expandedGoodTools && expandedGoodTools !== withoutDumpTags) {
      candidateTitles.add(expandedGoodTools);
    }
  }

  // B. Game title (if specified directly on game object)
  if (game.title && game.title.trim()) {
    candidateTitles.add(game.title.trim());
  }

  // C. Clean normalized title
  const clean = (game.title || rawBase || '')
    .replace(/\.[a-zA-Z0-9]+$/, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (clean) {
    candidateTitles.add(clean);
    candidateTitles.add(`${clean} (USA)`);
    candidateTitles.add(`${clean} (World)`);
  }

  // GitHub repo slug in libretro-thumbnails
  const githubRepo = libSystem.replace(/ /g, '_');
  const encodedLibSystem = encodeURIComponent(libSystem);
  const primaryUrls: string[] = [];

  for (const title of candidateTitles) {
    const safeTitle = sanitizeLibretroTitle(title);
    const encodedTitle = encodeURIComponent(safeTitle);
    primaryUrls.push(`https://raw.githubusercontent.com/libretro-thumbnails/${githubRepo}/master/Named_Boxarts/${encodedTitle}.png`);
  }

  // Combine: Custom cover -> Libretro repo -> official thumbnail server mirror
  const combined = [
    ...urls,
    ...primaryUrls,
    `https://thumbnails.libretro.com/${encodedLibSystem}/Named_Boxarts/${encodeURIComponent(clean || rawBase)}.png`
  ];

  return Array.from(new Set(combined)).slice(0, 6);
}
