import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';

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

test('input polling is configured for late reads during fast-forward', async () => {
  const { buildPlayerHtml } = await import('../src/services/emulator/playerBridge.ts');
  const html = buildPlayerHtml('gba', 'rom.gba');
  // RetroArch poll types: 0 = early, 1 = normal (default), 2 = late.
  assert.match(html, /input_poll_type_behavior",default:2,isString:false/);
  assert.match(html, /input_poll_type_behavior = 2/);
  assert.ok(!/input_poll_type_behavior",default:1/.test(html));
  assert.ok(!/input_poll_type_behavior = 1/.test(html));
});

test('emulator player avoids per-frame rewind serialization overhead and exposes FPS probe', async () => {
  const { buildPlayerHtml } = await import('../src/services/emulator/playerBridge.ts');
  const html = buildPlayerHtml('gba', 'rom.gba');
  assert.ok(!/"rewind_granularity",default:1\b/.test(html));
  assert.ok(!/rewind_granularity = \\"1\\"/.test(html));
  assert.match(html, /window\.getMeasuredFps=function/);
});

test('emulator player generates valid JS and wires WebGL HDR 3D relief shader safely', async () => {
  const { buildPlayerHtml } = await import('../src/services/emulator/playerBridge.ts');
  const htmlDefault = buildPlayerHtml('gba', 'rom.gba', 'Golden Sun');
  const match = htmlDefault.match(/<div id="game"><\/div><script>([\s\S]*?)<\/script><script src=/);
  assert.ok(match, 'inline player script block should exist');
  assert.doesNotThrow(() => new vm.Script(match[1]), 'inline player script must be syntactically valid JS');

  assert.match(htmlDefault, /window\._hdr3dEnabled=false;/);
  assert.match(htmlDefault, /window\.setHdr3dShader=function/);
  assert.match(htmlDefault, /ev\.data\.type==="ejs-set-hdr3d"/);
  assert.match(htmlDefault, /nextAttrs\.preserveDrawingBuffer=true;/);
  assert.match(htmlDefault, /c\.dataset&&c\.dataset\.rsShaderOverlay==="1".*continue/);
  assert.match(htmlDefault, /window\._destroyHdr3dShader\(\)/);
  assert.match(htmlDefault, /acesFilm\(/);
  assert.match(htmlDefault, /_probeRtcSupport/);
  assert.match(htmlDefault, /u_sunDir/);

  const htmlEnabled = buildPlayerHtml('gba', 'rom.gba', 'Golden Sun', { hdr3d: true });
  assert.match(htmlEnabled, /window\._hdr3dEnabled=true;/);
});

test('HDR 3D shader toggle is wired across App, SettingsModal, and InGameView', () => {
  const root = path.resolve('.');
  const appSrc = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
  const settingsSrc = fs.readFileSync(path.join(root, 'src/components/modals/SettingsModal.tsx'), 'utf8');
  const inGameSrc = fs.readFileSync(path.join(root, 'src/components/emulator/InGameView.tsx'), 'utf8');

  assert.match(appSrc, /hdr3d:\s*false/);
  assert.match(appSrc, /key === 'hdr3d'/);
  assert.match(settingsSrc, /key:\s*'hdr3d'/);
  assert.match(inGameSrc, /shaders\.hdr3d/);
  assert.match(inGameSrc, /ejs-set-hdr3d/);
});
