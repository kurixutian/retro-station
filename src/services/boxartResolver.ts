// ---------------- Libretro box art resolver ----------------
// The URL-guessing approach in `getBoxartUrls()` can't know Libretro's real
// thumbnail names or their region/revision/_SGB_ tags (e.g. a naive guess of
// "Pokemon - Crystal Version (USA, Europe)" 404s because the actual file is
// "(USA)"). This resolver fetches the real file listing of a system's
// Named_Boxarts folder from the libretro-thumbnails GitHub repo, caches it in
// IndexedDB, and fuzzy-matches a ROM name against the actual titles.

import { getLibretroSystem } from '../constants/cores';
import { idbGet, idbPut } from './storage/idb';

const GH_API = 'https://api.github.com/repos/libretro-thumbnails';
const THUMB_HOST = 'https://thumbnails.libretro.com';
const INDEX_TTL = 14 * 24 * 60 * 60 * 1000; // 14 days
const FETCH_COOLDOWN = 60 * 1000; // wait before re-asking GitHub after a failure

interface BoxartIndex {
  fetchedAt: number;
  titles: string[];
}

interface MatchResult {
  title: string;
  /** 0 = exact full name, 1 = exact clean title, 2 = fuzzy token match */
  level: 0 | 1 | 2;
}

// In-memory caches (per page session)
const indexCache = new Map<string, { titles: string[]; expiresAt: number }>();
const indexInFlight = new Map<string, Promise<BoxartIndex | null>>();
const indexFailedAt = new Map<string, number>();
const resolveInFlight = new Map<string, Promise<string | null>>();
/** Session-level memo for games whose match was verified (index known, no row fits) */
const verifiedMisses = new Set<string>();

// ------------------------------------------------------------------ matching

/** ASCII-fold a string for fuzzy title comparison */
export function normalizeForMatch(str: string): string {
  if (!str) return '';
  return (
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip diacritics
      .replace(/[\u2018\u2019]/g, "'") // curly apostrophes
      .replace(/[''`´]/g, '')          // drop apostrophes: Link's -> links
      .replace(/&/g, ' and ')
      .trim()
  );
}

/** Comparable "clean" key: no extension, brackets or region/dump tags */
export function getCoreKey(name: string): string {
  const stripped = (name || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^)]*\)/g, '');
  let folded = normalizeForMatch(stripped);
  // Libretro format is "Series, The - Title"; drop ", the" so it lines up
  // with plain rom names ("Legend of Zelda - Links Awakening DX"),
  // and drop a leading "The" (Smurfs, The <-> The Smurfs)
  folded = folded.replace(/,\s*the(?=\s*-|\s*$)/g, '').replace(/^the /, '');
  return folded.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Comparable "full" key: keeps region tags, for exact filename matches */
export function getFullKey(name: string): string {
  return normalizeForMatch(name)
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getRegionScore(fullKey: string): number {
  if (/\bjapan\b/.test(fullKey)) return 1;
  if (/\busa\b/.test(fullKey)) return 10;
  if (/\bworld\b/.test(fullKey)) return 7;
  if (/\beurope\b/.test(fullKey)) return 6;
  if (/\b(en|fr|de|es|it|nl|sv|pt|pl|ko|zh|ru)\b/.test(fullKey)) return 5;
  if (/\baustralia\b/.test(fullKey)) return 3;
  return 4; // untagged releases
}

const SPECIAL_TOKENS =
  / (sample|beta|proto|debug|kiosk|promo|unl|bios|aftermarket|homebrew|hack|redux|romhack|fan|reborn|rebalanced) /;

interface Candidate {
  title: string;
  fullKey: string;
  coreKey: string;
  coreTokens: Set<string>;
  regionScore: number;
  parens: number;
  special: boolean;
  /** fuzzy level only: candidate core tokens not present in the rom name */
  extra?: number;
}

function buildCandidates(titles: string[]): Candidate[] {
  return titles.map((title) => {
    const fullKey = getFullKey(title);
    const coreKey = getCoreKey(title);
    return {
      title,
      fullKey,
      coreKey,
      coreTokens: new Set(coreKey.split(' ').filter(Boolean)),
      regionScore: getRegionScore(fullKey),
      parens: (title.match(/\([^)]*\)/g) || []).length,
      special: SPECIAL_TOKENS.test(` ${fullKey} `),
    };
  });
}

function betterCandidate(a: Candidate, b: Candidate, fuzzy = false): Candidate {
  // Strict hierarchy: non-special > special, fewer extra tokens (fuzzy only),
  // richer region, fewer parenthetical tags, then alphabetical for ties.
  if (a.special !== b.special) return a.special ? b : a;
  if (fuzzy) {
    const ax = a.extra ?? Number.MAX_SAFE_INTEGER;
    const bx = b.extra ?? Number.MAX_SAFE_INTEGER;
    if (ax !== bx) return ax < bx ? a : b;
  }
  if (a.regionScore !== b.regionScore) return a.regionScore > b.regionScore ? a : b;
  if (a.parens !== b.parens) return a.parens < b.parens ? a : b;
  return a.title <= b.title ? a : b;
}

/**
 * Match a ROM file name (or clean title) against a list of real Libretro
 * thumbnail titles from the listing. Returns the best title, or null.
 */
export function matchBoxartTitle(romName: string, titles: string[]): MatchResult | null {
  if (!romName || !titles?.length) return null;
  const romCore = getCoreKey(romName);
  if (!romCore) return null;
  const romFull = getFullKey(romName);
  const romTokens = romCore.split(' ').filter(Boolean);

  const candidates = buildCandidates(titles);
  let bestAll: Candidate | null = null;
  let bestCore: Candidate | null = null;
  let bestFuzzy: Candidate | null = null;

  for (const c of candidates) {
    if (c.fullKey && c.fullKey === romFull) {
      bestAll = bestAll ? betterCandidate(c, bestAll) : c;
      continue;
    }
    if (c.coreKey === romCore) {
      bestCore = bestCore ? betterCandidate(c, bestCore) : c;
      continue;
    }
    // Fuzzy: every rom core token appears in the candidate title.
    // "Pokemon Crystal" -> "Pokemon - Crystal Version (USA)"
    if (romTokens.length >= 2 && romTokens.every((t) => c.coreTokens.has(t))) {
      const withExtra = { ...c, extra: c.coreTokens.size - romTokens.length };
      bestFuzzy = bestFuzzy ? betterCandidate(withExtra, bestFuzzy, true) : withExtra;
    }
  }

  if (bestAll) return { title: bestAll.title, level: 0 };
  if (bestCore) return { title: bestCore.title, level: 1 };
  if (bestFuzzy) return { title: bestFuzzy.title, level: 2 };
  return null;
}

// ------------------------------------------------------------------- fetching

async function fetchIndexFromGitHub(repo: string): Promise<BoxartIndex | null> {
  const headers = { Accept: 'application/vnd.github+json' };
  // The repo has ~1500 box arts per system, so the contents API (capped at
  // 1000 entries) is not enough — resolve Named_Boxarts through the git trees API.
  const rootRes = await fetch(`${GH_API}/${repo}/git/trees/master`, { headers });
  if (!rootRes.ok) return null;
  const root = await rootRes.json();
  const subTree = (root.tree || []).find(
    (t: any) => t.path === 'Named_Boxarts' && t.type === 'tree'
  );
  if (!subTree?.sha) return null;
  const boxRes = await fetch(`${GH_API}/${repo}/git/trees/${subTree.sha}`, { headers });
  if (!boxRes.ok) return null;
  const box = await boxRes.json();
  if (box.truncated) return null;
  const titles = (box.tree || [])
    .filter((t: any) => t.type === 'blob' && typeof t.path === 'string' && t.path.endsWith('.png'))
    .map((t: any) => t.path.replace(/\.png$/i, ''));
  if (!titles.length) return null;
  return { fetchedAt: Date.now(), titles };
}

/**
 * Real thumbnail titles for a Libretro system repo ("Nintendo_-_Game_Boy_Color").
 * IndexedDB cache first, GitHub second; failures fail soft (callers fall back
 * to URL guessing) and are throttled.
 */
export async function fetchBoxartIndex(repo: string): Promise<BoxartIndex | null> {
  if (!repo) return null;
  const memo = indexCache.get(repo);
  if (memo && memo.expiresAt > Date.now()) {
    return { fetchedAt: memo.expiresAt - INDEX_TTL, titles: memo.titles };
  }
  const failedAt = indexFailedAt.get(repo);
  if (failedAt && Date.now() - failedAt < FETCH_COOLDOWN) return null;

  const inflight = indexInFlight.get(repo);
  if (inflight) return inflight;

  const p = (async () => {
    try {
      const cached = await idbGet(`boxart_index:${repo}`);
      if (
        cached &&
        typeof cached === 'object' &&
        typeof cached.fetchedAt === 'number' &&
        Array.isArray(cached.titles) &&
        cached.titles.length &&
        Date.now() - cached.fetchedAt < INDEX_TTL
      ) {
        indexCache.set(repo, { titles: cached.titles, expiresAt: cached.fetchedAt + INDEX_TTL });
        return { fetchedAt: cached.fetchedAt, titles: cached.titles } as BoxartIndex;
      }
    } catch {
      /* cache read failures are non-fatal */
    }
    try {
      const fresh = await fetchIndexFromGitHub(repo);
      if (fresh) {
        indexCache.set(repo, { titles: fresh.titles, expiresAt: fresh.fetchedAt + INDEX_TTL });
        try {
          await idbPut(`boxart_index:${repo}`, fresh);
        } catch {
          /* cache write failures are non-fatal */
        }
        return fresh;
      }
    } catch {
      /* offline or rate limited — fall through to failure recording */
    }
    indexFailedAt.set(repo, Date.now());
    return null;
  })()

    .finally(() => {
      indexInFlight.delete(repo);
    });
  indexInFlight.set(repo, p);
  return p;
}

// ------------------------------------------------------------------ resolving

/**
 * Resolve a real, verified box art URL for a game by matching its ROM name
 * against the actual Libretro thumbnail listing. Returns null when the game
 * cannot be matched (verified miss is memoized for the session) or when the
 * listing cannot be fetched.
 */
export async function resolveBoxartUrl(game: any): Promise<string | null> {
  const gid = game?.id;
  if (!gid) return null;
  if (verifiedMisses.has(gid)) return null;
  const inflight = resolveInFlight.get(gid);
  if (inflight) return inflight;

  const p = (async () => {
    try {
      const libSystem = getLibretroSystem(game);
      if (!libSystem) {
        verifiedMisses.add(gid);
        return null;
      }
      const index = await fetchBoxartIndex(libSystem.replace(/ /g, '_'));
      if (!index) return null; // fetch failed, do not memo — may retry later

      const romName = (game.fileName || game.title || '').trim();
      const fromFile = romName ? matchBoxartTitle(romName, index.titles) : null;
      if (fromFile && fromFile.level <= 1) {
        return buildUrl(libSystem, fromFile.title);
      }
      // The clean title can match exactly where the raw filename can't
      const fromTitle = game.title?.trim() ? matchBoxartTitle(game.title.trim(), index.titles) : null;
      const best =
        fromFile && fromTitle
          ? fromFile.level <= fromTitle.level
            ? fromFile
            : fromTitle
          : fromFile || fromTitle;
      if (!best) {
        verifiedMisses.add(gid);
        return null;
      }
      return buildUrl(libSystem, best.title);
    } catch {
      return null;
    } finally {
      resolveInFlight.delete(game.id);
    }
  })();
  resolveInFlight.set(gid, p);
  return p;
}

function buildUrl(libSystem: string, title: string): string {
  // Listing titles are already in Libretro's on-disk form (their own sanitizer
  // turned `&` -> `_`, dropped illegal chars, ...) — use them verbatim.
  return `${THUMB_HOST}/${encodeURIComponent(libSystem)}/Named_Boxarts/${encodeURIComponent(title)}.png`;
}

/** Test hook: clear module-level memo state */
export function resetResolverState() {
  indexCache.clear();
  indexInFlight.clear();
  indexFailedAt.clear();
  resolveInFlight.clear();
  verifiedMisses.clear();
}
