// ---------------- Libretro box art resolver ----------------
// The URL-guessing approach in `getBoxartUrls()` can't know Libretro's real
// thumbnail names or their region/revision/_SGB_ tags (e.g. a naive guess of
// "Pokemon - Crystal Version (USA, Europe)" 404s because the actual file is
// "(USA)"). This resolver fetches the real file listing of a system's
// Named_Boxarts folder from the libretro-thumbnails GitHub repo, caches it in
// IndexedDB, and fuzzy-matches a ROM name against the actual titles.

import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { getLibretroSystem } from '../constants/cores';
import { idbGet, idbPut } from './storage/idb';
import { markLocalSaveModified } from '../cloudSync';

const GH_API = 'https://api.github.com/repos/libretro-thumbnails';
const RAW_HOST = 'https://raw.githubusercontent.com/libretro-thumbnails';
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

const PATCH_MOD_TOKENS =
  /^(patched|patch|mod|modded|hack|romhack|redux|kaizo|randomizer|randomized|rando|nuzlocke|translated|translation|english|eng|uncensored|restored|rebalanced|reborn|remix|beta|alpha|proto|demo|ips|bps|ups|v\d+|\d+)$/;

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

  // Fallback for patched/modded ROM filenames (e.g. "Pokemon Emerald Kaizo v1.2.gba"):
  // strip common patch/mod/version tokens and retry exact/fuzzy matching against base titles.
  const baseTokens = romTokens.filter((t) => !PATCH_MOD_TOKENS.test(t));
  if (baseTokens.length >= 2 && baseTokens.length < romTokens.length) {
    const baseCore = baseTokens.join(' ');
    let bestBaseCore: Candidate | null = null;
    let bestBaseFuzzy: Candidate | null = null;
    for (const c of candidates) {
      if (c.coreKey === baseCore) {
        bestBaseCore = bestBaseCore ? betterCandidate(c, bestBaseCore) : c;
        continue;
      }
      if (baseTokens.every((t) => c.coreTokens.has(t))) {
        const withExtra = { ...c, extra: c.coreTokens.size - baseTokens.length };
        bestBaseFuzzy = bestBaseFuzzy ? betterCandidate(withExtra, bestBaseFuzzy, true) : withExtra;
      }
    }
    if (bestBaseCore) return { title: bestBaseCore.title, level: 1 };
    if (bestBaseFuzzy) return { title: bestBaseFuzzy.title, level: 2 };
  }

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
export async function resolveBoxartUrl(game: any, force = false): Promise<string | null> {
  const gid = game?.id;
  if (!gid) return null;
  const missKey = `${gid}:${game?.customTitle?.trim() || ''}`;
  if (force) verifiedMisses.delete(missKey);
  if (verifiedMisses.has(missKey)) return null;
  const inflight = resolveInFlight.get(missKey);
  if (inflight) return inflight;

  const p = (async () => {
    try {
      const libSystem = getLibretroSystem(game);
      if (!libSystem) {
        verifiedMisses.add(missKey);
        return null;
      }
      const index = await fetchBoxartIndex(libSystem.replace(/ /g, '_'));
      if (!index) return null; // fetch failed, do not memo — may retry later

      const customName = game.customTitle?.trim() || '';
      const fromCustom = customName ? matchBoxartTitle(customName, index.titles) : null;
      if (fromCustom && fromCustom.level <= 1) {
        return buildUrl(libSystem, fromCustom.title);
      }

      const romName = (game.fileName || game.title || '').trim();
      const fromFile = romName ? matchBoxartTitle(romName, index.titles) : null;
      if (fromFile && fromFile.level <= 1) {
        return buildUrl(libSystem, fromFile.title);
      }
      // The clean title can match exactly where the raw filename can't
      const fromTitle = game.title?.trim() ? matchBoxartTitle(game.title.trim(), index.titles) : null;
      const candidates = [fromCustom, fromFile, fromTitle].filter(Boolean) as MatchResult[];
      const best = candidates.sort((a, b) => a.level - b.level)[0] || null;
      if (best) {
        return buildUrl(libSystem, best.title);
      }

      verifiedMisses.add(missKey);
      return null;
    } catch {
      return null;
    } finally {
      resolveInFlight.delete(missKey);
    }
  })();
  resolveInFlight.set(missKey, p);
  return p;
}

function buildUrl(libSystem: string, title: string): string {
  // Listing titles come directly from the GitHub repo tree, so serve from
  // raw.githubusercontent.com (thumbnails.libretro.com can be out of sync/404).
  const repo = libSystem.replace(/ /g, '_');
  return `${RAW_HOST}/${repo}/master/Named_Boxarts/${encodeURIComponent(title)}.png`;
}

function tokenMatchesWithTypo(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  // Allow 1-character substitution, transposition, insertion, or deletion
  let i = 0;
  let j = 0;
  let diffs = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    diffs++;
    if (diffs > 1) return false;
    if (a[i + 1] === b[j] && a[i] === b[j + 1]) {
      i += 2;
      j += 2;
    } else if (a.length > b.length) {
      i++;
    } else if (b.length > a.length) {
      j++;
    } else {
      i++;
      j++;
    }
  }
  if (i < a.length || j < b.length) diffs++;
  return diffs <= 1;
}

export interface BoxartSearchCandidate {
  url: string;
  label: string;
  source: 'LaunchBox' | 'Libretro' | 'Wikimedia' | 'Wikipedia' | 'Archive.org';
}

async function fetchLaunchBoxHtml(titleQuery: string): Promise<string | null> {
  const path = `/games/results?title=${encodeURIComponent(titleQuery)}`;
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({
      url: `https://gamesdb.launchbox-app.com${path}`,
      headers: { Accept: 'text/html' },
    });
    return typeof res.data === 'string' ? res.data : null;
  }
  // In Vite dev, /api/launchbox is proxied to https://gamesdb.launchbox-app.com
  const res = await fetch(`/api/launchbox${path}`);
  if (!res.ok) return null;
  const text = await res.text();
  // Guard against SPA index.html fallback when running outside Vite dev proxy
  if (!text.includes('images.launchbox-app.com') && text.includes('<!doctype html>')) {
    return null;
  }
  return text;
}

function parseLaunchBoxCandidates(html: string): BoxartSearchCandidate[] {
  const out: BoxartSearchCandidate[] = [];
  const seen = new Set<string>();
  // Match <img ... src="https://images.launchbox-app.com/..." alt="..." />
  const imgRe = /<img[^>]+src="(https:\/\/images\.launchbox-app\.com\/[^"]+)"[^>]*alt="([^"]*)"/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html)) !== null) {
    const url = m[1];
    const alt = m[2]
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({
      url,
      label: alt || 'LaunchBox Box Art',
      source: 'LaunchBox',
    });
  }
  // Prefer .jpg box art over .png clear logos
  return out.sort((a, b) => {
    const aJpg = /\.jpe?g$/i.test(a.url) ? 0 : 1;
    const bJpg = /\.jpe?g$/i.test(b.url) ? 0 : 1;
    return aJpg - bJpg;
  });
}

/**
 * Search multiple CORS-friendly online sources (Libretro partial match,
 * Wikimedia Commons, Wikipedia, and Internet Archive) and return candidate
 * box art thumbnails for the user to choose from.
 */
export async function searchOnlineBoxartCandidates(
  rawQuery: string,
  game?: any
): Promise<BoxartSearchCandidate[]> {
  const cleanQuery = rawQuery.trim();
  if (!cleanQuery) return [];

  const coreQuery = getCoreKey(cleanQuery);
  const queryTokens = coreQuery
    .split(' ')
    .filter(
      (t) =>
        t.length >= 2 &&
        ![
          'cartridge', 'box', 'art', 'boxart', 'cover', 'game', 'rom',
          'full', 'release', 'rip', 'edition', 'version', 'patched', 'hack',
          'gbc', 'gba', 'gb', 'nes', 'snes', 'sfc', 'gen',
        ].includes(t)
    );
  const titleQuery = queryTokens.join(' ') || coreQuery || cleanQuery;

  const results: BoxartSearchCandidate[] = [];
  const seenUrls = new Set<string>();
  const pushResult = (item: BoxartSearchCandidate) => {
    if (!item.url || seenUrls.has(item.url)) return;
    seenUrls.add(item.url);
    results.push(item);
  };

  // 0. LaunchBox GamesDB (via CapacitorHttp on Android or /api/launchbox proxy in Vite dev)
  const launchBoxPromise = (async () => {
    try {
      const queries: string[] = [titleQuery];
      const words = titleQuery.split(' ').filter(Boolean);
      if (words.length > 1) {
        queries.push(words.slice(0, -1).join(' '));
        if (words[0].length >= 4 && !queries.includes(words[0])) {
          queries.push(words[0]);
        }
      } else if (titleQuery.length >= 6) {
        // Handle 1-char trailing typo or stem (e.g. "dragonhymn" -> "dragonhym", "dragon")
        queries.push(titleQuery.slice(0, -1));
        if (titleQuery.length >= 7) {
          queries.push(titleQuery.slice(0, 6));
        }
      }
      for (const q of queries) {
        const html = await fetchLaunchBoxHtml(q);
        if (!html) continue;
        const parsed = parseLaunchBoxCandidates(html);
        if (parsed.length > 0) {
          for (const item of parsed.slice(0, 10)) {
            pushResult(item);
          }
          break;
        }
      }
    } catch {
      /* non-fatal */
    }
  })();

  // 1. Libretro partial / token matches for the game's system
  const libPromise = (async () => {
    try {
      const libSystem = getLibretroSystem(game);
      if (!libSystem || !queryTokens.length) return;
      const index = await fetchBoxartIndex(libSystem.replace(/ /g, '_'));
      if (!index?.titles?.length) return;
      const scored = index.titles
        .map((title) => {
          const titleTokens = getCoreKey(title).split(' ').filter(Boolean);
          const hits = queryTokens.filter((qt) =>
            titleTokens.some((tt) => tokenMatchesWithTypo(qt, tt))
          ).length;
          return { title, hits };
        })
        .filter((x) => x.hits > 0)
        .sort((a, b) => b.hits - a.hits || a.title.length - b.title.length)
        .slice(0, 6);
      for (const s of scored) {
        pushResult({
          url: buildUrl(libSystem, s.title),
          label: s.title,
          source: 'Libretro',
        });
      }
    } catch {
      /* non-fatal */
    }
  })();

  // 2. Wikimedia Commons image search (CORS-enabled)
  const commonsPromise = (async () => {
    try {
      const q = encodeURIComponent(cleanQuery);
      const res = await fetch(
        `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${q}&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url|mime&iiurlwidth=400&format=json&origin=*`
      );
      if (!res.ok) return;
      const json = await res.json();
      const pages = Object.values(json?.query?.pages || {}) as Array<{
        title?: string;
        imageinfo?: Array<{ thumburl?: string; url?: string; mime?: string }>;
      }>;
      for (const p of pages) {
        const info = p.imageinfo?.[0];
        if (!info || (info.mime && !info.mime.startsWith('image/'))) continue;
        const url = info.thumburl || info.url;
        if (url) {
          pushResult({
            url,
            label: (p.title || 'Wikimedia image').replace(/^File:/i, '').replace(/\.[^.]+$/, ''),
            source: 'Wikimedia',
          });
        }
      }
    } catch {
      /* non-fatal */
    }
  })();

  // 3. Wikipedia PageImages (CORS-enabled)
  const wikiPromise = (async () => {
    try {
      const q = encodeURIComponent(cleanQuery);
      const res = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${q}&gsrlimit=5&prop=pageimages&pithumbsize=400&format=json&origin=*`
      );
      if (!res.ok) return;
      const json = await res.json();
      const pages = Object.values(json?.query?.pages || {}) as Array<{
        title?: string;
        thumbnail?: { source?: string };
      }>;
      for (const p of pages) {
        if (!p.thumbnail?.source || !p.title) continue;
        pushResult({
          url: p.thumbnail.source,
          label: p.title,
          source: 'Wikipedia',
        });
      }
    } catch {
      /* non-fatal */
    }
  })();

  // 4. Internet Archive (CORS-enabled)
  const archivePromise = (async () => {
    try {
      const q = encodeURIComponent(titleQuery);
      const res = await fetch(
        `https://archive.org/advancedsearch.php?q=${q}&fl[]=identifier,title,mediatype&rows=6&output=json`
      );
      if (!res.ok) return;
      const json = await res.json();
      const docs: Array<{ identifier?: string; title?: string }> = json?.response?.docs || [];
      for (const d of docs) {
        if (!d.identifier) continue;
        pushResult({
          url: `https://archive.org/services/img/${encodeURIComponent(d.identifier)}`,
          label: d.title || d.identifier,
          source: 'Archive.org',
        });
      }
    } catch {
      /* non-fatal */
    }
  })();

  await Promise.all([launchBoxPromise, libPromise, commonsPromise, wikiPromise, archivePromise]);
  return results;
}

/**
 * Resolve box art for a game and persist the verified URL in IndexedDB so
 * GameCoverImage can render it immediately without waiting for URL guesses.
 */
export async function autoFetchAndCacheBoxart(game: any, force = false): Promise<string | null> {
  let url = await resolveBoxartUrl(game, force);
  if (!url) {
    const query = game?.customTitle || game?.title || game?.fileName || '';
    if (query) {
      const candidates = await searchOnlineBoxartCandidates(query, game);
      const best = candidates.find((c) => c.source === 'LaunchBox') || candidates[0];
      if (best?.url) url = best.url;
    }
  }
  if (url && game?.id) {
    try {
      await idbPut(`cover:${game.id}`, url);
      markLocalSaveModified(`cover:${game.id}`);
    } catch {
      /* cache write failures are non-fatal */
    }
  }
  return url;
}

/** Test hook: clear module-level memo state */
export function resetResolverState() {
  indexCache.clear();
  indexInFlight.clear();
  indexFailedAt.clear();
  resolveInFlight.clear();
  verifiedMisses.clear();
}
