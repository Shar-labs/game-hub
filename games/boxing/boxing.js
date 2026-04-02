/* ============================================================
   BOXING – 2-player canvas game
   ============================================================ */

(function () {
  "use strict";

  // ── Canvas setup ─────────────────────────────────────────
  const canvas = document.getElementById("gameCanvas");
  const ctx    = canvas.getContext("2d");
  const W = 800, H = 450;

  // ── Constants ────────────────────────────────────────────
  const FLOOR       = 320;
  const GRAVITY     = 0.5;
  const JUMP_VEL    = -12;
  const MOVE_SPEED  = 3;
  const MIN_DIST    = 60;
  const MAX_DIST    = 720;

  const PUNCH_RANGE   = 90;
  const KICK_RANGE    = 100;
  const PUNCH_CD      = 400;
  const KICK_CD       = 600;
  const HURT_DUR      = 300;

  const ROUNDS_TO_WIN = 3;

  const COL_P1 = "#ff2d55";
  const COL_P2 = "#00aaff";
  const COL_BG = "#07070f";

  // ── Keyboard state ───────────────────────────────────────
  const keys = {};
  window.addEventListener("keydown", e => {
    keys[e.code] = true;
    // prevent arrow scrolling and space scroll
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code)) e.preventDefault();
    handleMenuInput(e.code);
  });
  window.addEventListener("keyup", e => { keys[e.code] = false; });

  // ── Game state ───────────────────────────────────────────
  let gameState  = "start";   // start | playing | roundEnd | matchEnd
  let round      = 1;
  let roundEndTimer = 0;
  let roundEndMsg   = "";
  let matchWinner   = 0;

  // Flash effect
  let flashTimer = 0;
  let flashColor = "rgba(255,255,255,0.0)";

  // ── Fighter factory ──────────────────────────────────────
  function makeFighter(x, facing, color, controls) {
    return {
      x, y: FLOOR,
      vx: 0, vy: 0,
      hp: 100,
      maxHp: 100,
      state: "idle",
      facing,
      color,
      controls,
      punchTimer: 0,
      kickTimer: 0,
      hurtTimer: 0,
      blockTimer: 0,
      score: 0,
      jumpLock: false,
      walkFrame: 0,
      walkFrameTimer: 0,
      // KO fall
      koAngle: 0,
      koVy: 0,
      koFallen: false,
    };
  }

  const P1_CONTROLS = {
    left: "KeyA", right: "KeyD", jump: "KeyW",
    block: "KeyS", punch: "KeyG", kick: "KeyH"
  };
  const P2_CONTROLS = {
    left: "ArrowLeft", right: "ArrowRight", jump: "ArrowUp",
    block: "ArrowDown", punch: "KeyK", kick: "KeyL"
  };

  let p1, p2;

  function initFighters() {
    p1 = makeFighter(200, 1,  COL_P1, P1_CONTROLS);
    p2 = makeFighter(600, -1, COL_P2, P2_CONTROLS);
  }

  // ── Helper – random int in [a,b] ─────────────────────────
  function rnd(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

  // ── Menu / start input ───────────────────────────────────
  function handleMenuInput(code) {
    if (gameState === "start" && code === "Enter") {
      startGame();
    }
    if (gameState === "matchEnd" && code === "KeyR") {
      p1.score = 0;
      p2.score = 0;
      round = 1;
      startRound();
    }
  }

  function startGame() {
    p1 = makeFighter(200, 1,  COL_P1, P1_CONTROLS);
    p2 = makeFighter(600, -1, COL_P2, P2_CONTROLS);
    round = 1;
    startRound();
  }

  function startRound() {
    // Reset positions & HP, keep scores
    const s1 = p1.score, s2 = p2.score;
    p1 = makeFighter(200, 1,  COL_P1, P1_CONTROLS);
    p2 = makeFighter(600, -1, COL_P2, P2_CONTROLS);
    p1.score = s1;
    p2.score = s2;
    gameState = "roundStart";
    roundEndTimer = 1500; // show "ROUND X" for 1.5s
    roundEndMsg = "ROUND " + round;
    updateHUD();
  }

  // ── Physics update ───────────────────────────────────────
  function updateFighter(f, other, dt) {
    if (f.state === "ko") {
      updateKO(f);
      return;
    }

    const c = f.controls;
    const now = performance.now();

    // Timers
    if (f.punchTimer > 0) f.punchTimer -= dt;
    if (f.kickTimer  > 0) f.kickTimer  -= dt;
    if (f.hurtTimer  > 0) {
      f.hurtTimer -= dt;
      if (f.hurtTimer <= 0) f.state = "idle";
    }

    const stunned = f.state === "hurt";
    const attacking = f.state === "punch" || f.state === "kick";

    // Block
    if (!stunned) {
      if (keys[c.block]) {
        f.state = "block";
      } else if (f.state === "block") {
        f.state = "idle";
      }
    }

    // Horizontal movement
    if (!stunned) {
      const blocked = f.state === "block";
      let moved = false;
      if (keys[c.left]  && !blocked) { f.vx = -MOVE_SPEED; moved = true; }
      if (keys[c.right] && !blocked) { f.vx =  MOVE_SPEED; moved = true; }
      if (!moved) f.vx = 0;

      // Walk animation
      if (f.vx !== 0 && f.y >= FLOOR) {
        f.walkFrameTimer += dt;
        if (f.walkFrameTimer > 140) { f.walkFrame = (f.walkFrame + 1) % 4; f.walkFrameTimer = 0; }
        if (!attacking) f.state = "walk";
      } else if (!attacking && f.state === "walk") {
        f.state = "idle";
      }
    }

    // Jump
    if (!stunned && keys[c.jump] && f.y >= FLOOR && !f.jumpLock) {
      f.vy = JUMP_VEL;
      f.jumpLock = true;
    }
    if (!keys[c.jump]) f.jumpLock = false;

    // Punch
    if (!stunned && keys[c.punch] && f.punchTimer <= 0) {
      f.state = "punch";
      f.punchTimer = PUNCH_CD;
      tryHit(f, other, "punch");
      setTimeout(() => { if (f.state === "punch") f.state = "idle"; }, 250);
    }

    // Kick
    if (!stunned && keys[c.kick] && f.kickTimer <= 0) {
      f.state = "kick";
      f.kickTimer = KICK_CD;
      tryHit(f, other, "kick");
      setTimeout(() => { if (f.state === "kick") f.state = "idle"; }, 300);
    }

    // Gravity
    f.vy += GRAVITY;
    f.y  += f.vy;
    f.x  += f.vx;

    // Floor
    if (f.y >= FLOOR) { f.y = FLOOR; f.vy = 0; }

    // Walls
    f.x = Math.max(40, Math.min(MAX_DIST, f.x));

    // Facing
    if (f.x < other.x) f.facing = 1;
    else if (f.x > other.x) f.facing = -1;

    // Collision push
    const dx = other.x - f.x;
    if (Math.abs(dx) < MIN_DIST) {
      const push = (MIN_DIST - Math.abs(dx)) / 2;
      f.x     -= Math.sign(dx) * push;
      other.x += Math.sign(dx) * push;
    }
  }

  function updateKO(f) {
    if (!f.koFallen) {
      f.koAngle += 0.08;
      if (f.koAngle >= Math.PI / 2) {
        f.koAngle  = Math.PI / 2;
        f.koFallen = true;
      }
    }
  }

  function tryHit(attacker, defender, type) {
    const dx   = Math.abs(attacker.x - defender.x);
    const range = type === "punch" ? PUNCH_RANGE : KICK_RANGE;
    if (dx > range) return;
    if (defender.state === "ko") return;

    // Check attacker is actually facing defender
    const dir = attacker.facing;
    if ((defender.x - attacker.x) * dir < 0) return;

    let dmg = type === "punch" ? rnd(8, 12) : rnd(15, 20);
    if (defender.state === "block") dmg = Math.round(dmg * 0.30);

    defender.hp = Math.max(0, defender.hp - dmg);

    // Flash
    flashTimer = 180;
    flashColor = type === "punch"
      ? "rgba(255,200,50,0.18)"
      : "rgba(255,80,80,0.22)";

    if (defender.state !== "block") {
      defender.state     = "hurt";
      defender.hurtTimer = HURT_DUR;
    }

    if (defender.hp <= 0) {
      defender.hp    = 0;
      defender.state = "ko";
    }

    updateHUD();
  }

  // ── HUD update ───────────────────────────────────────────
  function updateHUD() {
    const setBar = (barId, numId, hp) => {
      const pct = Math.max(0, hp) + "%";
      const bar = document.getElementById(barId);
      const num = document.getElementById(numId);
      if (bar) bar.style.width = pct;
      if (num) num.textContent  = Math.max(0, hp);
    };
    setBar("hp-bar-p1", "hp-num-p1", p1 ? p1.hp : 100);
    setBar("hp-bar-p2", "hp-num-p2", p2 ? p2.hp : 100);

    const rl = document.getElementById("roundlabel");
    if (rl) rl.textContent = "Round " + round;

    // Score pips
    for (let i = 0; i < 3; i++) {
      const e1 = document.getElementById("p1-pip-" + i);
      const e2 = document.getElementById("p2-pip-" + i);
      if (e1) e1.className = "pip" + (p1 && i < p1.score ? " filled-p1" : "");
      if (e2) e2.className = "pip" + (p2 && i < p2.score ? " filled-p2" : "");
    }
  }

  // ── Draw helpers ─────────────────────────────────────────
  function fillRect(x, y, w, h) { ctx.fillRect(x, y, w, h); }

  function drawFighter(f) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(f.facing, 1);

    const col  = f.color;
    const dark = f.color === COL_P1 ? "#991a33" : "#006699";
    const glow = f.color === COL_P1 ? "rgba(255,45,85,0.4)" : "rgba(0,170,255,0.4)";

    // Shadow
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, 2, 28, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // KO fall
    if (f.state === "ko") {
      ctx.rotate(-f.koAngle);
      drawBody(ctx, col, dark, "ko");
      ctx.restore();
      return;
    }

    // Hurt tilt
    if (f.state === "hurt") {
      ctx.rotate(0.18);
    }

    drawBody(ctx, col, dark, f.state, f.walkFrame);

    // Glow on punch/kick
    if (f.state === "punch" || f.state === "kick") {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, -55, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  function drawBody(ctx, col, dark, state, walkFrame) {
    walkFrame = walkFrame || 0;

    // ── Head ──
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, -108, 18, 0, Math.PI * 2);
    ctx.fill();

    // Head sheen
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.arc(-5, -114, 7, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = "#fff";
    ctx.fillRect(-7, -113, 5, 5);
    ctx.fillRect(2,  -113, 5, 5);
    ctx.fillStyle = "#111";
    ctx.fillRect(-6, -112, 3, 3);
    ctx.fillRect(3,  -112, 3, 3);

    // Mouth
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2;
    if (state === "hurt" || state === "ko") {
      ctx.beginPath();
      ctx.arc(0, -102, 4, 0, Math.PI);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(-5, -101); ctx.lineTo(5, -101);
      ctx.stroke();
    }

    // ── Torso ──
    ctx.fillStyle = col;
    ctx.fillRect(-17, -95, 34, 45);
    // Abs lines
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-17, -95, 34, 45);
    ctx.beginPath(); ctx.moveTo(-17,-75); ctx.lineTo(17,-75); ctx.stroke();

    // ── Shorts ──
    ctx.fillStyle = dark;
    ctx.fillRect(-18, -50, 36, 20);

    // ── Arms ──
    ctx.lineWidth = 2;
    if (state === "punch") {
      // Punching arm extended forward
      ctx.fillStyle = col;
      ctx.save(); ctx.translate(17, -85); ctx.rotate(-0.3);
      ctx.fillRect(0, -8, 48, 14); // extended forearm
      ctx.restore();
      // Fist
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.roundRect(58, -96, 16, 16, 4);
      ctx.fill();
      // Back arm
      ctx.fillStyle = col;
      ctx.save(); ctx.translate(-17, -85); ctx.rotate(0.4);
      ctx.fillRect(-18, -7, 18, 12);
      ctx.restore();
    } else if (state === "kick") {
      // Normal punch arms, one arm up for balance
      ctx.fillStyle = col;
      ctx.save(); ctx.translate(17, -85); ctx.rotate(-0.5);
      ctx.fillRect(0, -6, 32, 12);
      ctx.restore();
      ctx.fillStyle = col;
      ctx.save(); ctx.translate(-17, -85); ctx.rotate(0.7);
      ctx.fillRect(-28, -6, 28, 12);
      ctx.restore();
    } else if (state === "block") {
      // Arms crossed in front of face
      ctx.fillStyle = col;
      ctx.fillRect(-5, -105, 22, 12);
      ctx.fillRect(-17, -95, 12, 45);
      ctx.fillRect( 5, -95, 12, 45);
      ctx.fillStyle = dark;
      ctx.fillRect(-8, -108, 16, 8);
    } else {
      // Idle / walk – slight swing
      const swing = state === "walk" ? Math.sin(walkFrame * Math.PI / 2) * 0.3 : 0;
      ctx.fillStyle = col;
      ctx.save(); ctx.translate(17, -85); ctx.rotate(-0.15 + swing);
      ctx.fillRect(0, -6, 28, 12);
      ctx.restore();
      ctx.save(); ctx.translate(-17, -85); ctx.rotate(0.15 - swing);
      ctx.fillRect(-28, -6, 28, 12);
      ctx.restore();
    }

    // ── Legs ──
    if (state === "kick") {
      // Front leg kicked up-forward
      ctx.fillStyle = col;
      ctx.save(); ctx.translate(10, -30); ctx.rotate(-1.1);
      ctx.fillRect(-8, 0, 16, 45);
      ctx.restore();
      // Foot
      ctx.fillStyle = dark;
      ctx.save(); ctx.translate(10, -30); ctx.rotate(-1.1);
      ctx.fillRect(-8, 42, 20, 12);
      ctx.restore();
      // Back leg standing
      ctx.fillStyle = col;
      ctx.fillRect(-18, -30, 14, 50);
      ctx.fillStyle = dark;
      ctx.fillRect(-20, 18, 18, 12);
    } else {
      const legSwing = state === "walk" ? Math.sin(walkFrame * Math.PI / 2) * 10 : 0;
      // Left leg
      ctx.fillStyle = col;
      ctx.save(); ctx.translate(-9, -30);
      ctx.fillRect(-7, legSwing > 0 ? 0 : legSwing, 14, 30 - Math.abs(legSwing * 0.3));
      ctx.restore();
      // Right leg
      ctx.save(); ctx.translate(9, -30);
      ctx.fillRect(-7, legSwing < 0 ? 0 : -legSwing, 14, 30 - Math.abs(legSwing * 0.3));
      ctx.restore();
      // Feet
      ctx.fillStyle = dark;
      ctx.fillRect(-20, 18, 16, 12);
      ctx.fillRect(4,   18, 16, 12);
    }

    // Gloves
    if (state !== "block") {
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.roundRect(16, -92, 14, 14, 3); ctx.fill();
      ctx.beginPath(); ctx.roundRect(-30, -92, 14, 14, 3); ctx.fill();
    }
  }

  // ── Draw arena ───────────────────────────────────────────
  function drawArena() {
    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0d0d1a");
    bg.addColorStop(1, "#070710");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Crowd silhouette
    ctx.fillStyle = "#0e0e1e";
    for (let i = 0; i < 32; i++) {
      const cx = i * 26 + 5;
      const ch = 35 + Math.sin(i * 1.7) * 15;
      ctx.beginPath();
      ctx.arc(cx, H - 60 - ch, 12, Math.PI, 0);
      ctx.fillRect(cx - 8, H - 60 - ch, 16, ch);
      ctx.fill();
    }

    // Ring ropes
    ctx.strokeStyle = "#222240";
    ctx.lineWidth = 3;
    [FLOOR - 130, FLOOR - 100, FLOOR - 70].forEach(y => {
      ctx.beginPath();
      ctx.moveTo(30, y); ctx.lineTo(W - 30, y);
      ctx.stroke();
    });
    // Ring posts
    ctx.fillStyle = "#1c1c3a";
    [[30, FLOOR - 140], [W - 30, FLOOR - 140]].forEach(([px, py]) => {
      ctx.fillRect(px - 6, py, 12, 140);
    });

    // Canvas floor
    const floorGrad = ctx.createLinearGradient(0, FLOOR - 5, 0, FLOOR + 80);
    floorGrad.addColorStop(0, "#1a1a2e");
    floorGrad.addColorStop(1, "#12122a");
    ctx.fillStyle = floorGrad;
    ctx.fillRect(30, FLOOR, W - 60, 80);

    // Floor lines
    ctx.strokeStyle = "#2a2a4a";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(30, FLOOR); ctx.lineTo(W - 30, FLOOR); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W/2, FLOOR); ctx.lineTo(W/2, FLOOR + 70); ctx.stroke();

    // Spotlight
    const spot = ctx.createRadialGradient(W/2, FLOOR - 60, 10, W/2, FLOOR - 60, 280);
    spot.addColorStop(0, "rgba(255,255,240,0.04)");
    spot.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Overlay text helpers ──────────────────────────────────
  function drawCenteredText(text, y, size, color, shadow) {
    ctx.save();
    ctx.font = `900 ${size}px 'Segoe UI', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (shadow) {
      ctx.shadowColor = shadow;
      ctx.shadowBlur  = 30;
    }
    ctx.fillStyle = color;
    ctx.fillText(text, W / 2, y);
    ctx.restore();
  }

  function drawPanel(x, y, w, h, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha || 0.82;
    ctx.fillStyle = "#07070f";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = "#2a2a3a";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 1;
    ctx.stroke();
    ctx.restore();
  }

  // ── Start screen ─────────────────────────────────────────
  function drawStartScreen() {
    drawArena();
    drawPanel(120, 60, 560, 320);

    drawCenteredText("🥊  BOXING", 130, 38, "#ffffff", "#ff2d55");

    ctx.save();
    ctx.font = "bold 13px 'Segoe UI', sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#888";
    ctx.fillText("PLAYER 1", 170, 178);
    ctx.fillStyle = "#aaa";
    ctx.fillText("A / D   — Move    W — Jump    S — Block", 170, 198);
    ctx.fillText("G — Punch    H — Kick", 170, 218);

    ctx.fillStyle = "#888";
    ctx.fillText("PLAYER 2", 170, 252);
    ctx.fillStyle = "#aaa";
    ctx.fillText("← / →  — Move    ↑ — Jump    ↓ — Block", 170, 272);
    ctx.fillText("K — Punch    L — Kick", 170, 292);
    ctx.restore();

    // Pulse Enter prompt
    const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 400);
    ctx.save();
    ctx.globalAlpha = pulse;
    drawCenteredText("PRESS ENTER TO FIGHT", 345, 16, "#ff2d55");
    ctx.restore();
  }

  // ── Round start overlay ───────────────────────────────────
  function drawRoundStart() {
    drawArena();
    drawFighter(p1);
    drawFighter(p2);

    const alpha = Math.min(1, roundEndTimer / 1500);
    ctx.save();
    ctx.globalAlpha = alpha;
    drawCenteredText(roundEndMsg, H / 2 - 10, 56, "#ffffff", "#00aaff");
    ctx.restore();
  }

  // ── Round end overlay ─────────────────────────────────────
  function drawRoundEnd() {
    drawArena();
    drawFighter(p1);
    drawFighter(p2);

    const t = 1 - Math.min(1, roundEndTimer / 2000);
    ctx.save();
    ctx.globalAlpha = Math.min(1, t * 3);
    drawCenteredText("K.O.!", H / 2 - 30, 72, "#ff2d55", "#ff2d55");
    drawCenteredText(roundEndMsg, H / 2 + 30, 20, "#fff");
    ctx.restore();
  }

  // ── Match end overlay ─────────────────────────────────────
  function drawMatchEnd() {
    drawArena();
    drawFighter(p1);
    drawFighter(p2);

    drawPanel(80, 100, 640, 240);
    const col = matchWinner === 1 ? COL_P1 : COL_P2;
    drawCenteredText("PLAYER " + matchWinner + " WINS", H / 2 - 40, 44, col, col);
    drawCenteredText("THE MATCH!", H / 2 + 10, 36, "#fff");

    const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 500);
    ctx.save();
    ctx.globalAlpha = pulse;
    drawCenteredText("PRESS R TO PLAY AGAIN", H / 2 + 68, 15, "#888");
    ctx.restore();
  }

  // ── Main game draw ───────────────────────────────────────
  function drawGame() {
    drawArena();

    // Flash overlay
    if (flashTimer > 0) {
      ctx.save();
      ctx.globalAlpha = flashTimer / 180;
      ctx.fillStyle = flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    drawFighter(p1);
    drawFighter(p2);
  }

  // ── Check round/match end ─────────────────────────────────
  function checkRoundEnd() {
    if (p1.state === "ko" || p2.state === "ko") {
      const winner = p1.state === "ko" ? 2 : 1;
      if (winner === 1) p1.score++;
      else              p2.score++;

      updateHUD();

      roundEndMsg = "PLAYER " + winner + " WINS ROUND " + round;
      gameState = "roundEnd";
      roundEndTimer = 2000;

      if (p1.score >= ROUNDS_TO_WIN || p2.score >= ROUNDS_TO_WIN) {
        matchWinner = p1.score >= ROUNDS_TO_WIN ? 1 : 2;
        setTimeout(() => { gameState = "matchEnd"; }, 2200);
      } else {
        round++;
        setTimeout(() => {
          startRound();
        }, 2200);
      }
    }
  }

  // ── Main loop ─────────────────────────────────────────────
  let lastTime = 0;
  function loop(ts) {
    const dt = ts - lastTime;
    lastTime = ts;

    if (flashTimer > 0) flashTimer -= dt;

    switch (gameState) {
      case "start":
        drawStartScreen();
        break;

      case "roundStart":
        roundEndTimer -= dt;
        if (roundEndTimer <= 0) { gameState = "playing"; }
        drawRoundStart();
        break;

      case "playing":
        updateFighter(p1, p2, dt);
        updateFighter(p2, p1, dt);
        checkRoundEnd();
        drawGame();
        break;

      case "roundEnd":
        roundEndTimer -= dt;
        updateKO(p1);
        updateKO(p2);
        drawRoundEnd();
        break;

      case "matchEnd":
        drawMatchEnd();
        break;
    }

    requestAnimationFrame(loop);
  }

  // ── Boot ─────────────────────────────────────────────────
  initFighters();
  updateHUD();
  requestAnimationFrame(loop);

})();
