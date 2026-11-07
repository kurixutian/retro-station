import test from 'node:test';
import assert from 'node:assert/strict';

// ---- Mirror of src/services/boxartResolver.ts pure matching logic ----

function normalizeForMatch(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[''`´]/g, '')
    .replace(/&/g, ' and ')
    .trim();
}

function getCoreKey(name) {
  const stripped = (name || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^)]*\)/g, '');
  let folded = normalizeForMatch(stripped);
  folded = folded.replace(/,\s*the(?=\s*-|\s*$)/g, '').replace(/^the /, '');
  return folded.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function getFullKey(name) {
  return normalizeForMatch(name)
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getRegionScore(fullKey) {
  if (/\bjapan\b/.test(fullKey)) return 1;
  if (/\busa\b/.test(fullKey)) return 10;
  if (/\bworld\b/.test(fullKey)) return 7;
  if (/\beurope\b/.test(fullKey)) return 6;
  if (/\b(en|fr|de|es|it|nl|sv|pt|pl|ko|zh|ru)\b/.test(fullKey)) return 5;
  if (/\baustralia\b/.test(fullKey)) return 3;
  return 4;
}

const SPECIAL_TOKENS =
  / (sample|beta|proto|debug|kiosk|promo|unl|bios|aftermarket|homebrew|hack|redux|romhack|fan|reborn|rebalanced) /;

function buildCandidates(titles) {
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

function betterCandidate(a, b, fuzzy = false) {
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

function matchBoxartTitle(romName, titles) {
  if (!romName || !titles?.length) return null;
  const romCore = getCoreKey(romName);
  if (!romCore) return null;
  const romFull = getFullKey(romName);
  const romTokens = romCore.split(' ').filter(Boolean);

  const candidates = buildCandidates(titles);
  let bestAll = null;
  let bestCore = null;
  let bestFuzzy = null;

  for (const c of candidates) {
    if (c.fullKey && c.fullKey === romFull) {
      bestAll = bestAll ? betterCandidate(c, bestAll) : c;
      continue;
    }
    if (c.coreKey === romCore) {
      bestCore = bestCore ? betterCandidate(c, bestCore) : c;
      continue;
    }
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

// Real titles from libretro-thumbnails (Nintendo - Game Boy Color)
const GBC_TITLES = [
  'Pokemon - Crystal Version (Australia).png',
  'Pokemon - Crystal Version (USA).png',
  'Pokemon - Crystal Version (USA, Europe) (Rev 1).png',
  'Pokemon - Crystal Version (Japan).png',
  'Pokemon - Gold Version (USA, Europe) (SGB Enhanced) (GB Compatible).png',
  'Pocket Monsters - Crystal Version (Japan).png',
  'Tetris DX (World) (SGB Enhanced) (GB Compatible).png',
  'Legend of Zelda, The - Links Awakening DX (USA, Europe) (SGB Enhanced) (GB Compatible).png',
  'Donkey Kong Country (USA, Europe) (En,Fr,De,Es,It).png',
  'Donkey Kong Country (USA, Europe) (En,Fr,De,Es,It) (Sample).png',
];

test('exact full filename match wins (level 0)', () => {
  const r = matchBoxartTitle('Pokemon - Crystal Version (USA, Europe) (Rev 1).gbc', GBC_TITLES);
  assert.equal(r.title, 'Pokemon - Crystal Version (USA, Europe) (Rev 1).png');
  assert.equal(r.level, 0);
});

test('clean title match maps to the realized Libretro name with region preference', () => {
  const r = matchBoxartTitle('Pokemon Crystal Version.gbc', GBC_TITLES);
  assert.equal(r.title, 'Pokemon - Crystal Version (USA).png');
  assert.equal(r.level, 1);
});

test('hyphenated rom name matches with clean title (level 1)', () => {
  const r = matchBoxartTitle('Pokemon - Gold Version (USA).gbc', GBC_TITLES);
  assert.equal(r.title, 'Pokemon - Gold Version (USA, Europe) (SGB Enhanced) (GB Compatible).png');
});

test('Tetris DX (World) hits the SGB-tagged real file', () => {
  const r = matchBoxartTitle('Tetris DX (World).gbc', GBC_TITLES);
  assert.equal(r.title, 'Tetris DX (World) (SGB Enhanced) (GB Compatible).png');
});

test('", The" inversion matches both directions', () => {
  const files = matchBoxartTitle('Legend of Zelda - Links Awakening DX (UE) [!].gbc', GBC_TITLES);
  assert.equal(files.title, 'Legend of Zelda, The - Links Awakening DX (USA, Europe) (SGB Enhanced) (GB Compatible).png');
});

test('fuzzy token match (level 2) for stripped rom names', () => {
  const r = matchBoxartTitle('Pokemon Crystal (UE) [!].gbc', GBC_TITLES);
  assert.equal(r.title, 'Pokemon - Crystal Version (USA).png');
  assert.equal(r.level, 2);
});

test('prefers exact core candidate over fuzzy extras with same tokens', () => {
  const titles = ['Donkey Kong (USA, Europe) (Rev 1).png', 'Donkey Kong Land - DX (USA).png'];
  const r = matchBoxartTitle('Donkey Kong (U).gb', titles);
  assert.equal(r.title, 'Donkey Kong (USA, Europe) (Rev 1).png');
});

test('sample/beta candidates are demoted', () => {
  const r = matchBoxartTitle('Donkey Kong Country (E).gbc', GBC_TITLES);
  assert.equal(r.title, 'Donkey Kong Country (USA, Europe) (En,Fr,De,Es,It).png');
});

test('unknown game returns null', () => {
  assert.equal(matchBoxartTitle('Random Unknown Game (USA).gbc', GBC_TITLES), null);
});

test('fuzzy match prefers fewest extra tokens (real title over hack suffixes)', () => {
  const titles = [
    "Legend of Zelda, The - Links Awakening DX (USA, Europe) (SGB Enhanced) (GB Compatible).png",
    "Legend of Zelda, The - Links Awakening DX - Redux (USA).png",
    "Legend of Zelda, The - Links Awakening DX - DX Plus (USA).png",
  ];
  const r = matchBoxartTitle('Zelda Links Awakening DX.gbc', titles);
  assert.equal(r.title, "Legend of Zelda, The - Links Awakening DX (USA, Europe) (SGB Enhanced) (GB Compatible).png");
  assert.equal(r.level, 2);
});

test('redux/hack candidates are demoted at every level', () => {
  const titles = [
    'Tetris DX - Redux (USA).png',
    'Tetris DX (World) (SGB Enhanced) (GB Compatible).png',
  ];
  const r = matchBoxartTitle('Tetris DX (World).gbc', titles);
  assert.equal(r.title, 'Tetris DX (World) (SGB Enhanced) (GB Compatible).png');
  assert.equal(r.level, 1);
});

test('diacritics and quotes are folded for matching', () => {
  assert.equal(getCoreKey('Pokémon - Crystal Version [!].gbc'), getCoreKey('Pokemon Crystal Version'));
  assert.equal(getCoreKey("Link's Awakening"), getCoreKey('Links Awakening'));
});

test('core of real SGB-tagged file equals clean rom title core', () => {
  assert.equal(getCoreKey('Pokemon - Gold Version (USA, Europe) (SGB Enhanced) (GB Compatible).png'), 'pokemon gold version');
});
