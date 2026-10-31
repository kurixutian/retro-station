import { SaveSlot } from '../../types';
import { createInitialEngineState } from '../../demoEngines/engineState';

export function downloadBinaryFile(uint8Array: Uint8Array, fileName: string) {
  const blob = new Blob([uint8Array as any], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Generate an authentic pixel-art dataURL thumbnail for pre-populated Pokémon Gold save states
export function createPrepopulatedThumbnail(mode = 'overworld'): string | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 120;
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  if (mode === 'overworld') {
    ctx.fillStyle = '#65a30d';
    ctx.fillRect(0, 0, 160, 120);
    // Dirt path
    ctx.fillStyle = '#fde047';
    ctx.fillRect(20, 46, 120, 28);
    // Tall grass patches
    ctx.fillStyle = '#15803d';
    ctx.fillRect(16, 12, 64, 28);
    ctx.fillRect(84, 80, 60, 28);
    // House roof
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(96, 10, 44, 20);
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(100, 30, 36, 14);
    // Trainer sprite
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(74, 52, 12, 14);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 160, 14);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 8px monospace';
    ctx.fillText('ROUTE 29 • LV.7 CYNDAQUIL', 6, 10);
  } else {
    ctx.fillStyle = '#fef9c3';
    ctx.fillRect(0, 0, 160, 120);
    // Enemy box
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(8, 10, 82, 24);
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(14, 24, 58, 4);
    // Enemy Hoothoot sprite
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.arc(122, 30, 14, 0, Math.PI * 2);
    ctx.fill();
    // Player Cyndaquil back sprite
    ctx.fillStyle = '#f97316';
    ctx.fillRect(24, 58, 22, 22);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 84, 160, 36);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 8px monospace';
    ctx.fillText('WILD HOOTHOOT APPEARED!', 8, 98);
  }
  return c.toDataURL('image/png');
}

export function createEmptySlotsForGame(gameId: string): SaveSlot[] {
  if (gameId === 'pokemon_gold') {
    const slot1State = createInitialEngineState('pokegold', 'slot1');
    const slot2State = createInitialEngineState('pokegold', 'slot2');
    return [
      {
        slot: 1,
        empty: false,
        label: 'Route 29 Tall Grass • Lv.7 Cyndaquil',
        timestamp: '10:15 PM',
        score: 650,
        frame: 1420,
        screenshot: createPrepopulatedThumbnail('overworld'),
        stateData: {
          version: 'RETRO_POCKET_V2',
          gameId: 'pokemon_gold',
          romFileName: 'Pokemon_Gold_Version.gbc',
          core: 'gambatte',
          timestamp: '10:15 PM',
          score: 650,
          frame: 1420,
          engineState: slot1State
        }
      },
      {
        slot: 2,
        empty: false,
        label: 'Wild Hoothoot Battle • HP 26/30',
        timestamp: '10:42 PM',
        score: 1280,
        frame: 2890,
        screenshot: createPrepopulatedThumbnail('battle'),
        stateData: {
          version: 'RETRO_POCKET_V2',
          gameId: 'pokemon_gold',
          romFileName: 'Pokemon_Gold_Version.gbc',
          core: 'gambatte',
          timestamp: '10:42 PM',
          score: 1280,
          frame: 2890,
          engineState: slot2State
        }
      },
      { slot: 3, empty: true, label: 'Empty Slot', timestamp: null, score: 0, frame: 0, screenshot: null, stateData: null },
      { slot: 4, empty: true, label: 'Empty Slot', timestamp: null, score: 0, frame: 0, screenshot: null, stateData: null },
    ];
  }

  return [1, 2, 3, 4].map((slot) => ({
    slot,
    empty: true,
    label: 'Empty Slot',
    timestamp: null,
    score: 0,
    frame: 0,
    screenshot: null,
    stateData: null
  }));
}
