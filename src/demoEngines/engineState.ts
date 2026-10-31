// ============================================================================
// INITIAL GAME ENGINE STATE FACTORY (SUPPORTS ALL 4 BUILT-IN ENGINES)
// ============================================================================
export function createInitialEngineState(engineType = 'pokegold', presetVariant = 'default') {
  const base = {
    engineType,
    frame: presetVariant === 'slot1' ? 1420 : presetVariant === 'slot2' ? 2890 : 0,
    score: presetVariant === 'slot1' ? 650 : presetVariant === 'slot2' ? 1280 : 0,
    level: presetVariant === 'slot1' ? 2 : presetVariant === 'slot2' ? 3 : 1,
    // ------------------------------------------------------------------------
    // ENGINE 1: POKÉMON GOLD VERSION (GBC TOP-DOWN RPG + TURN-BASED BATTLE)
    // ------------------------------------------------------------------------
    trainerX: presetVariant === 'slot1' ? 92 : 156,
    trainerY: presetVariant === 'slot1' ? 76 : 118,
    trainerDir: 'down',
    stepCount: 0,
    pokeName: 'CYNDAQUIL',
    pokeLevel: presetVariant === 'slot1' ? 7 : presetVariant === 'slot2' ? 8 : 5,
    pokeHp: presetVariant === 'slot2' ? 26 : 28,
    pokeMaxHp: presetVariant === 'slot2' ? 30 : 28,
    pokeXp: presetVariant === 'slot1' ? 40 : 15,
    pokeballs: 8,
    caughtCount: presetVariant === 'slot1' ? 2 : presetVariant === 'slot2' ? 3 : 1,
    goldCoins: presetVariant === 'slot1' ? 1400 : 800,
    battle:
      presetVariant === 'slot2'
        ? {
            active: true,
            enemyName: 'HOOTHOOT',
            enemyLv: 6,
            enemyHp: 19,
            enemyMaxHp: 24,
            enemyColor: '#d97706',
            menuIndex: 0, // 0: EMBER, 1: TACKLE, 2: POKEBALL, 3: RUN
            message: 'Wild HOOTHOOT appeared! Choose move:',
            cooldown: 0,
          }
        : {
            active: false,
            enemyName: 'SENTRET',
            enemyLv: 4,
            enemyHp: 18,
            enemyMaxHp: 18,
            enemyColor: '#b45309',
            menuIndex: 0,
            message: '',
            cooldown: 0,
          },
    dialogText: 'ROUTE 29: Walk in tall grass for wild battles!',

    // ------------------------------------------------------------------------
    // ENGINE 2: CYBERRUN '89 DX (NES ACTION PLATFORMER)
    // ------------------------------------------------------------------------
    playerY: 168,
    playerVy: 0,
    jumpsLeft: 2,
    isDucking: false,
    bullets: [] as any[],
    obstacles: [
      { x: 250, y: 152, w: 16, h: 18, type: 'drone' },
      { x: 390, y: 128, w: 20, h: 14, type: 'flyer' },
    ],
    crystals: [
      { x: 300, y: 120, collected: false },
      { x: 440, y: 150, collected: false }
    ],

    // ------------------------------------------------------------------------
    // ENGINE 3: STARBLADE SUPER DX (SNES SPACE SHMUP)
    // ------------------------------------------------------------------------
    shipX: 54,
    shipY: 112,
    shield: 100,
    weaponTier: 1,
    lasers: [] as any[],
    enemies: [
      { x: 250, y: 60, vy: 1.2, hp: 2 },
      { x: 295, y: 140, vy: -1.1, hp: 3 },
      { x: 335, y: 95, vy: 0.9, hp: 2 },
    ],
    stars: Array.from({ length: 40 }, (_, i) => ({
      x: (i * 37) % 320,
      y: (i * 53) % 240,
      speed: (i % 3) + 1
    })),
    particles: [] as any[],

    // ------------------------------------------------------------------------
    // ENGINE 4: NEON DRIFT ADVANCE (GBA SYNTHWAVE OUTRUN RACER)
    // ------------------------------------------------------------------------
    carX: 0,
    speed: 145,
    nitro: 100,
    roadPos: 0,
    curvePhase: 0,
    traffic: [
      { lane: -0.45, z: 45, color: '#22d3ee' },
      { lane: 0.45, z: 88, color: '#fbbf24' }
    ],
  };
  return base;
}
