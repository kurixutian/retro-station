import test from 'node:test';
import assert from 'node:assert/strict';

function sanitizeLibretroTitle(title) {
  return title.replace(/[&*\/:\`<>?\\|"]/g, '_').trim();
}

function formatGameTitle(rawTitle) {
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

test('formatGameTitle strips tags, brackets and inverts "The"', () => {
  assert.equal(formatGameTitle('Pokemon - Emerald Version (USA, Europe) [!].gba'), 'Pokemon Emerald Version');
  assert.equal(formatGameTitle('Legend of Zelda, The.gbc'), 'The Legend of Zelda');
  assert.equal(formatGameTitle('Super_Mario_World.sfc'), 'Super Mario World');
});

test('sanitizeLibretroTitle replaces forbidden filename characters', () => {
  assert.equal(sanitizeLibretroTitle('Sonic & Knuckles: Special / Edition'), 'Sonic _ Knuckles_ Special _ Edition');
  assert.equal(sanitizeLibretroTitle('Game <Name>?*|`"'), 'Game _Name______');
});
