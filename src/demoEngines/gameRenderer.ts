// ============================================================================
// 2D CANVAS RENDERER FOR BUILT-IN ENGINES (POKÉGOLD, CYBERRUN, STARBLADE, NEONDRIFT)
// ============================================================================
export function drawGameCanvas(
  ctx: CanvasRenderingContext2D,
  st: any,
  activeGame: { shortSystem?: string; core?: string },
  isRewinding = false,
  isFastForward = false
) {
  const W = 320;
  const H = 240;
  ctx.clearRect(0, 0, W, H);

  // ======================================================================
  // RENDER 1: POKÉMON GOLD VERSION (GBC RPG & WILD BATTLE SCREEN)
  // ======================================================================
  if (st.engineType === 'pokegold') {
    if (!st.battle.active) {
      // Overworld Grass Background
      ctx.fillStyle = '#65a30d';
      ctx.fillRect(0, 0, W, H);

      // Border Trees
      ctx.fillStyle = '#14532d';
      for (let x = 0; x < W; x += 20) {
        ctx.fillRect(x, 18, 18, 12);
      }

      // Golden Dirt Road (Route 29)
      ctx.fillStyle = '#fde047';
      ctx.fillRect(14, 92, 292, 34);
      ctx.fillRect(126, 48, 36, 140);

      // Water Pond (Bottom-left)
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(24, 138, 86, 46);
      ctx.fillStyle = '#bae6fd';
      ctx.fillRect(34 + ((st.frame >> 4) % 8), 152, 18, 3);
      ctx.fillRect(64 - ((st.frame >> 4) % 8), 168, 22, 3);

      // Prof. Elm's Lab / Healing House (Top-Right)
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(212, 28, 76, 24);
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(216, 52, 68, 24);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(242, 60, 14, 16);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(222, 56, 12, 10);
      ctx.fillRect(264, 56, 12, 10);

      // Tall Grass Patch 1 (Top-Left)
      ctx.fillStyle = '#15803d';
      ctx.fillRect(22, 36, 100, 52);
      ctx.fillStyle = '#4ade80';
      for (let gx = 28; gx < 118; gx += 12) {
        for (let gy = 42; gy < 84; gy += 12) {
          ctx.fillRect(gx, gy, 3, 6);
          ctx.fillRect(gx + 4, gy + 2, 3, 5);
        }
      }

      // Tall Grass Patch 2 (Bottom-Right)
      ctx.fillStyle = '#15803d';
      ctx.fillRect(168, 130, 124, 52);
      ctx.fillStyle = '#4ade80';
      for (let gx = 174; gx < 286; gx += 12) {
        for (let gy = 136; gy < 178; gy += 12) {
          ctx.fillRect(gx, gy, 3, 6);
          ctx.fillRect(gx + 4, gy + 2, 3, 5);
        }
      }

      // Player Trainer Sprite (Gold / Ethan)
      const tx = Math.round(st.trainerX);
      const ty = Math.round(st.trainerY);
      const stepBob = Math.sin(st.stepCount * 0.5) * 1.5;
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(tx - 6, ty + 8, 12, 4);
      // Body & Gold/Black Cap
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(tx - 6, ty - 6 + stepBob, 12, 14);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(tx - 7, ty - 10 + stepBob, 14, 6);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(tx - 5, ty - 9 + stepBob, 6, 3);
      // Face
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(tx - 4, ty - 4 + stepBob, 8, 5);

      // Bottom GBC Text Dialog Box
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(6, 194, W - 12, 40);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.strokeRect(8, 196, W - 16, 36);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(st.dialogText.slice(0, 44), 16, 212);
      ctx.fillStyle = '#475569';
      ctx.fillText(
        `LV:${st.pokeLevel} HP:${st.pokeHp}/${st.pokeMaxHp} BALLS:${st.pokeballs} CAUGHT:${st.caughtCount}`,
        16,
        225
      );
    } else {
      // TURN-BASED WILD POKÉMON BATTLE SCREEN
      ctx.fillStyle = '#fefce8';
      ctx.fillRect(0, 0, W, H);

      // Enemy Status HUD (Top-Left)
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(14, 24, 142, 42);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(14, 24, 142, 42);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`${st.battle.enemyName} :L${st.battle.enemyLv}`, 22, 39);
      // Enemy HP Bar
      ctx.fillStyle = '#334155';
      ctx.fillRect(22, 46, 116, 8);
      const eRatio = Math.max(0, st.battle.enemyHp / st.battle.enemyMaxHp);
      ctx.fillStyle = eRatio > 0.5 ? '#22c55e' : eRatio > 0.2 ? '#eab308' : '#ef4444';
      ctx.fillRect(23, 47, Math.round(114 * eRatio), 6);

      // Wild Pokémon Animated Sprite (Top-Right Platform)
      ctx.fillStyle = '#d9f99d';
      ctx.beginPath();
      ctx.ellipse(236, 82, 44, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      const bounce = Math.sin(st.frame * 0.12) * 3;
      ctx.fillStyle = st.battle.enemyColor || '#d97706';
      ctx.fillRect(216, 38 + bounce, 38, 36);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(222, 46 + bounce, 8, 8);
      ctx.fillRect(238, 46 + bounce, 8, 8);

      // Player Cyndaquil Back Sprite (Bottom-Left Platform)
      ctx.fillStyle = '#d9f99d';
      ctx.beginPath();
      ctx.ellipse(76, 154, 48, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      // Flame on back
      ctx.fillStyle = st.frame % 4 < 2 ? '#ef4444' : '#f59e0b';
      ctx.fillRect(46, 108, 18, 18);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(54, 116, 36, 34);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(62, 126, 26, 24);

      // Player Status Box (Bottom-Right)
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(164, 108, 144, 48);
      ctx.strokeStyle = '#0f172a';
      ctx.strokeRect(164, 108, 144, 48);
      ctx.fillStyle = '#0f172a';
      ctx.fillText(`${st.pokeName} :L${st.pokeLevel}`, 172, 123);
      ctx.fillStyle = '#334155';
      ctx.fillRect(172, 130, 120, 8);
      const pRatio = Math.max(0, st.pokeHp / st.pokeMaxHp);
      ctx.fillStyle = pRatio > 0.5 ? '#22c55e' : '#eab308';
      ctx.fillRect(173, 131, Math.round(118 * pRatio), 6);
      ctx.fillStyle = '#0f172a';
      ctx.fillText(`HP: ${st.pokeHp}/${st.pokeMaxHp}`, 172, 149);

      // Battle Command Box
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(6, 164, W - 12, 70);
      ctx.strokeStyle = '#f8fafc';
      ctx.strokeRect(8, 166, W - 16, 66);

      ctx.fillStyle = '#fde047';
      ctx.fillText(st.battle.message.slice(0, 42), 16, 184);

      const moves = ['EMBER', 'TACKLE', `BALL(${st.pokeballs})`, 'RUN'];
      moves.forEach((m, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const mx = 24 + col * 142;
        const my = 204 + row * 18;
        const selected = st.battle.menuIndex === idx;
        ctx.fillStyle = selected ? '#4ade80' : '#f8fafc';
        ctx.fillText(`${selected ? '▶ ' : '  '}${m}`, mx, my);
      });
    }
  }

  // ======================================================================
  // RENDER 2: CYBERRUN '89 DX (NES)
  // ======================================================================
  else if (st.engineType === 'cyberrun') {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#090d16');
    grad.addColorStop(0.7, '#0f172a');
    grad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Parallax Skyline
    ctx.fillStyle = '#1e293b';
    for (let i = 0; i < 8; i++) {
      const bx = ((i * 45 - (st.frame * 0.5) % 45) + W) % W - 20;
      const bh = 45 + ((i * 29) % 55);
      ctx.fillRect(bx, 180 - bh, 32, bh);
    }

    // Neon Grid Ground
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 180, W, 60);
    ctx.strokeStyle = '#22d3ee';
    ctx.beginPath();
    ctx.moveTo(0, 180);
    ctx.lineTo(W, 180);
    ctx.stroke();

    // Crystals
    st.crystals.forEach((c: any) => {
      if (!c.collected) {
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(c.x - 5, c.y - 5, 10, 10);
      }
    });

    // Player
    const ph = st.isDucking ? 14 : 24;
    const py = st.playerY - ph;
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(42, py, 14, ph);
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(48, py + 3, 8, 4);

    // Bullets & Obstacles
    ctx.fillStyle = '#e879f9';
    st.bullets.forEach((b: any) => ctx.fillRect(b.x, b.y, 10, 3));
    st.obstacles.forEach((obs: any) => {
      ctx.fillStyle = obs.type === 'flyer' ? '#f43f5e' : '#ef4444';
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
    });
  }

  // ======================================================================
  // RENDER 3: STARBLADE SUPER DX (SNES)
  // ======================================================================
  else if (st.engineType === 'starblade') {
    ctx.fillStyle = '#050711';
    ctx.fillRect(0, 0, W, H);
    st.stars.forEach((s: any) => {
      ctx.fillStyle = s.speed > 2 ? '#38bdf8' : '#94a3b8';
      ctx.fillRect(s.x, s.y, s.speed, s.speed);
    });
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(st.shipX + 20, st.shipY);
    ctx.lineTo(st.shipX - 8, st.shipY - 11);
    ctx.lineTo(st.shipX - 8, st.shipY + 11);
    ctx.closePath();
    ctx.fill();

    // Cockpit & Thruster
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(st.shipX + 2, st.shipY - 3, 7, 6);
    ctx.fillStyle = st.frame % 4 < 2 ? '#f43f5e' : '#fbbf24';
    ctx.fillRect(st.shipX - 14, st.shipY - 3, 6, 6);

    // Twin Lasers
    ctx.fillStyle = '#e879f9';
    st.lasers.forEach((l: any) => ctx.fillRect(l.x, l.y - 1, 10, 3));

    // Enemy Interceptors
    st.enemies.forEach((en: any) => {
      ctx.fillStyle = en.hp > 1 ? '#f43f5e' : '#fb923c';
      ctx.fillRect(en.x - 9, en.y - 9, 18, 18);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(en.x - 5, en.y - 3, 5, 6);
    });

    // Explosion Particles
    ctx.fillStyle = '#fde047';
    st.particles.forEach((p: any) => ctx.fillRect(p.x, p.y, 3, 3));
  }

  // ======================================================================
  // RENDER 4: NEON DRIFT ADVANCE (GBA SYNTHWAVE OUTRUN)
  // ======================================================================
  else if (st.engineType === 'neondrift') {
    const sky = ctx.createLinearGradient(0, 0, 0, 115);
    sky.addColorStop(0, '#1e1b4b');
    sky.addColorStop(0.6, '#701a75');
    sky.addColorStop(1, '#f43f5e');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, 115);

    // Retro Synthwave Sun
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(W / 2, 82, 26, 0, Math.PI * 2);
    ctx.fill();

    // Ground & Perspective Highway
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 115, W, 125);
    for (let y = 115; y < H; y += 6) {
      const p = (y - 115) / 125;
      const roadW = 36 + p * 230;
      const stripe = Math.floor((y + st.roadPos) / 12) % 2 === 0;
      ctx.fillStyle = stripe ? '#1e293b' : '#0f172a';
      ctx.fillRect(W / 2 - roadW / 2, y, roadW, 6);
      ctx.fillStyle = stripe ? '#f43f5e' : '#22d3ee';
      ctx.fillRect(W / 2 - roadW / 2 - 5, y, 5, 6);
      ctx.fillRect(W / 2 + roadW / 2, y, 5, 6);
    }

    // Traffic Cars
    st.traffic.forEach((t: any) => {
      const p = Math.max(0.05, 1 - t.z / 100);
      const ty = 118 + p * 102;
      const tx = W / 2 + t.lane * (p * 185);
      const cw = 10 + p * 24;
      const ch = 7 + p * 15;
      ctx.fillStyle = t.color;
      ctx.fillRect(tx - cw / 2, ty - ch, cw, ch);
    });

    // Player Outrun Supercar
    const px = W / 2 + st.carX;
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(px - 20, 198, 40, 16);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(px - 14, 192, 28, 7);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(px - 17, 202, 7, 4);
    ctx.fillRect(px + 10, 202, 7, 4);
  }

  // Top In-Canvas Telemetry Strip
  ctx.fillStyle = 'rgba(9, 13, 22, 0.78)';
  ctx.fillRect(0, 0, W, 18);
  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 9px monospace';
  ctx.fillText(`${activeGame?.shortSystem || 'ROM'} • ${(activeGame?.core || '').toUpperCase()}`, 6, 12);
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(`SCORE: ${String(st.score).padStart(5, '0')}`, 225, 12);

  if (isRewinding) {
    ctx.fillStyle = 'rgba(245, 158, 11, 0.28)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('⏪ REWINDING TIME...', 80, H / 2);
  } else if (isFastForward) {
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('⏩ 2X TURBO', 142, 12);
  }
}
