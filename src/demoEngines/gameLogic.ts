import { soundFX } from '../services/audio/synth';

export function stepGameFrame(
  st: any,
  keys: Record<string, boolean>,
  edgeTapState: { current: Record<string, boolean> }
) {
  st.frame += 1;

  // Detect rising-edge button taps for RPG battle menus
  const prevKeys = edgeTapState.current || {};
  const tap = {
    up: keys.up && !prevKeys.up,
    down: keys.down && !prevKeys.down,
    left: keys.left && !prevKeys.left,
    right: keys.right && !prevKeys.right,
    actionA: keys.actionA && !prevKeys.actionA,
    actionB: keys.actionB && !prevKeys.actionB,
  };
  edgeTapState.current = { ...keys };

  // ======================================================================
  // ENGINE 1: POKÉMON GOLD VERSION (GBC RPG + WILD BATTLE ENGINE)
  // ======================================================================
  if (st.engineType === 'pokegold') {
    if (st.battle.active) {
      if (st.battle.cooldown > 0) {
        st.battle.cooldown -= 1;
        return;
      }
      // Navigate 2x2 Battle Command Menu
      if (tap.right && st.battle.menuIndex % 2 === 0) st.battle.menuIndex += 1;
      if (tap.left && st.battle.menuIndex % 2 === 1) st.battle.menuIndex -= 1;
      if (tap.down && st.battle.menuIndex < 2) st.battle.menuIndex += 2;
      if (tap.up && st.battle.menuIndex >= 2) st.battle.menuIndex -= 2;

      if (tap.actionA) {
        const cmd = st.battle.menuIndex;
        // 0: EMBER, 1: TACKLE, 2: POKéBALL, 3: RUN
        if (cmd === 0 || cmd === 1) {
          const moveName = cmd === 0 ? 'EMBER' : 'TACKLE';
          const dmg = cmd === 0 ? 7 + (st.pokeLevel % 4) : 5 + (st.pokeLevel % 3);
          st.battle.enemyHp = Math.max(0, st.battle.enemyHp - dmg);
          soundFX.laser();

          if (st.battle.enemyHp <= 0) {
            st.score += 150;
            st.goldCoins += 200;
            st.pokeXp += 25;
            if (st.pokeXp >= 50) {
              st.pokeLevel += 1;
              st.pokeXp = 0;
              st.pokeMaxHp += 4;
              st.pokeHp = st.pokeMaxHp;
              st.dialogText = `CYNDAQUIL grew to Lv.${st.pokeLevel}!`;
            } else {
              st.dialogText = `Defeated wild ${st.battle.enemyName}! +150 PTS`;
            }
            soundFX.coin();
            st.battle.active = false;
          } else {
            const counterDmg = 2 + (st.battle.enemyLv % 3);
            st.pokeHp = Math.max(4, st.pokeHp - counterDmg);
            st.battle.message = `${st.pokeName} used ${moveName}! (-${dmg} HP)`;
            st.battle.cooldown = 18;
          }
        } else if (cmd === 2) {
          // Throw PokéBall
          if (st.pokeballs > 0) {
            st.pokeballs -= 1;
            const catchChance = st.battle.enemyHp <= st.battle.enemyMaxHp * 0.65;
            if (catchChance || st.frame % 2 === 0) {
              st.caughtCount += 1;
              st.score += 300;
              st.dialogText = `Gotcha! ${st.battle.enemyName} was caught!`;
              soundFX.save();
              st.battle.active = false;
            } else {
              st.battle.message = `Oh no! ${st.battle.enemyName} broke free!`;
              st.battle.cooldown = 20;
              soundFX.hit();
            }
          } else {
            st.battle.message = 'No POKéBALLS left!';
          }
        } else if (cmd === 3) {
          st.battle.active = false;
          st.dialogText = 'Got away safely from wild battle!';
          soundFX.jump();
        }
      }
    } else {
      // Overworld Top-Down Movement (New Bark Town / Route 29)
      const speed = 1.6;
      let moved = false;
      if (keys.up) { st.trainerY = Math.max(26, st.trainerY - speed); st.trainerDir = 'up'; moved = true; }
      if (keys.down) { st.trainerY = Math.min(182, st.trainerY + speed); st.trainerDir = 'down'; moved = true; }
      if (keys.left) { st.trainerX = Math.max(16, st.trainerX - speed); st.trainerDir = 'left'; moved = true; }
      if (keys.right) { st.trainerX = Math.min(300, st.trainerX + speed); st.trainerDir = 'right'; moved = true; }

      // Heal at Pokémon Lab House door (top-right house)
      if (st.trainerX > 215 && st.trainerX < 275 && st.trainerY < 72 && tap.actionA) {
        st.pokeHp = st.pokeMaxHp;
        st.pokeballs = Math.max(st.pokeballs, 8);
        st.dialogText = 'PROF. ELM LAB: Cyndaquil fully healed & Balls refilled!';
        soundFX.save();
      }

      if (moved) {
        st.stepCount += 1;
        // Check if walking inside Tall Grass patches
        const inLeftGrass = st.trainerX >= 22 && st.trainerX <= 125 && st.trainerY >= 32 && st.trainerY <= 92;
        const inBottomGrass = st.trainerX >= 150 && st.trainerX <= 285 && st.trainerY >= 122 && st.trainerY <= 180;

        if ((inLeftGrass || inBottomGrass) && st.stepCount % 55 === 0) {
          const wildPool = [
            { name: 'SENTRET', lv: 4, hp: 18, color: '#b45309' },
            { name: 'HOOTHOOT', lv: 5, hp: 22, color: '#d97706' },
            { name: 'TOTODILE', lv: 6, hp: 25, color: '#0284c7' },
            { name: 'PIKACHU', lv: 7, hp: 24, color: '#eab308' }
          ];
          const pick = wildPool[(st.frame + st.stepCount) % wildPool.length];
          st.battle = {
            active: true,
            enemyName: pick.name,
            enemyLv: pick.lv,
            enemyHp: pick.hp,
            enemyMaxHp: pick.hp,
            enemyColor: pick.color,
            menuIndex: 0,
            message: `Wild ${pick.name} appeared!`,
            cooldown: 12
          };
          soundFX.encounter();
        }
      }
    }
  }

  // ======================================================================
  // ENGINE 2: CYBERRUN '89 DX (NES PLATFORMER)
  // ======================================================================
  else if (st.engineType === 'cyberrun') {
    const groundY = 168;
    if ((tap.up || tap.actionA) && st.jumpsLeft > 0) {
      st.playerVy = -7.2;
      st.jumpsLeft -= 1;
      soundFX.jump();
    }
    st.isDucking = keys.down && st.playerY >= groundY;
    st.playerY += st.playerVy;
    st.playerVy += 0.42;
    if (st.playerY >= groundY) {
      st.playerY = groundY;
      st.playerVy = 0;
      st.jumpsLeft = 2;
    }

    if (keys.actionB && st.frame % 10 === 0 && st.bullets.length < 5) {
      st.bullets.push({ x: 62, y: st.playerY - 12 });
      soundFX.laser();
    }
    st.bullets.forEach((b: any) => { b.x += 7; });
    st.bullets = st.bullets.filter((b: any) => b.x < 330);

    const speed = 2.8 + st.level * 0.3;
    st.obstacles.forEach((obs: any) => {
      obs.x -= speed;
      st.bullets.forEach((b: any) => {
        if (b.x > obs.x && b.x < obs.x + obs.w && b.y > obs.y - 8 && b.y < obs.y + obs.h) {
          obs.x = -40;
          b.x = 400;
          st.score += 60;
          soundFX.coin();
        }
      });
      const pTop = st.isDucking ? st.playerY - 12 : st.playerY - 24;
      if (obs.x < 56 && obs.x + obs.w > 40 && obs.y + obs.h > pTop && obs.y < st.playerY) {
        obs.x = 340 + Math.random() * 60;
        st.score = Math.max(0, st.score - 40);
        soundFX.hit();
      }
      if (obs.x < -25) {
        obs.x = 325 + Math.random() * 80;
        obs.type = Math.random() > 0.45 ? 'drone' : 'flyer';
        obs.y = obs.type === 'flyer' ? 134 : 152;
        st.score += 25;
      }
    });

    st.crystals.forEach((c: any) => {
      c.x -= speed;
      if (!c.collected && Math.abs(c.x - 48) < 16 && Math.abs(c.y - (st.playerY - 12)) < 20) {
        c.collected = true;
        st.score += 100;
        soundFX.coin();
      }
      if (c.x < -20) {
        c.x = 330 + Math.random() * 110;
        c.y = 110 + Math.random() * 45;
        c.collected = false;
      }
    });
    st.level = 1 + Math.floor(st.score / 500);
  }

  // ======================================================================
  // ENGINE 3: STARBLADE SUPER DX (SNES SPACE SHMUP)
  // ======================================================================
  else if (st.engineType === 'starblade') {
    if (keys.up) st.shipY = Math.max(28, st.shipY - 3.3);
    if (keys.down) st.shipY = Math.min(205, st.shipY + 3.3);
    if (keys.left) st.shipX = Math.max(20, st.shipX - 3.3);
    if (keys.right) st.shipX = Math.min(240, st.shipX + 3.3);

    if ((keys.actionA || keys.actionB) && st.frame % 8 === 0) {
      st.lasers.push({ x: st.shipX + 18, y: st.shipY - 5, vy: keys.actionB ? -0.8 : 0 });
      st.lasers.push({ x: st.shipX + 18, y: st.shipY + 5, vy: keys.actionB ? 0.8 : 0 });
      soundFX.laser();
    }
    st.lasers.forEach((l: any) => { l.x += 7.5; l.y += l.vy || 0; });
    st.lasers = st.lasers.filter((l: any) => l.x < 330);

    st.stars.forEach((s: any) => {
      s.x -= s.speed;
      if (s.x < 0) { s.x = 320; s.y = Math.random() * 220; }
    });

    st.enemies.forEach((en: any) => {
      en.x -= 1.9 + st.level * 0.25;
      en.y += en.vy;
      if (en.y < 28 || en.y > 200) en.vy *= -1;

      st.lasers.forEach((l: any) => {
        if (Math.abs(l.x - en.x) < 14 && Math.abs(l.y - en.y) < 14) {
          en.hp -= 1;
          l.x = 400;
          if (en.hp <= 0) {
            st.score += 125;
            soundFX.coin();
            for (let p = 0; p < 6; p++) {
              st.particles.push({
                x: en.x,
                y: en.y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                ttl: 16
              });
            }
            en.x = 330 + Math.random() * 60;
            en.y = 40 + Math.random() * 150;
            en.hp = 2;
          }
        }
      });

      if (Math.abs(en.x - st.shipX) < 15 && Math.abs(en.y - st.shipY) < 14) {
        en.x = 340;
        st.shield = Math.max(0, (st.shield || 100) - 20);
        soundFX.hit();
      }
      if (en.x < -20) {
        en.x = 330 + Math.random() * 50;
        en.y = 40 + Math.random() * 150;
      }
    });

    st.particles.forEach((p: any) => { p.x += p.vx; p.y += p.vy; p.ttl -= 1; });
    st.particles = st.particles.filter((p: any) => p.ttl > 0);
    st.level = 1 + Math.floor(st.score / 600);
  }

  // ======================================================================
  // ENGINE 4: NEON DRIFT ADVANCE (GBA SYNTHWAVE RACER)
  // ======================================================================
  else if (st.engineType === 'neondrift') {
    const targetSpeed = keys.actionA ? 245 : keys.actionB ? 80 : 160;
    st.speed += (targetSpeed - st.speed) * 0.08;
    if (keys.left) st.carX = Math.max(-95, st.carX - 3.6);
    if (keys.right) st.carX = Math.min(95, st.carX + 3.6);
    st.roadPos = (st.roadPos + st.speed * 0.04) % 100;
    if (st.frame % 5 === 0) st.score += Math.round(st.speed / 25);

    st.traffic.forEach((t: any) => {
      t.z -= st.speed * 0.012;
      if (t.z < 12 && t.z > 2) {
        const tx = t.lane * 110;
        if (Math.abs(tx - st.carX) < 28) {
          st.speed = 65;
          t.z = 100;
          soundFX.hit();
        }
      }
      if (t.z <= 1) {
        t.z = 100;
        t.lane = (Math.random() - 0.5) * 1.4;
        st.score += 50;
        soundFX.coin();
      }
    });
    st.level = 1 + Math.floor(st.score / 700);
  }
}
