/**
 * Ping Pong – GameHub
 * Full 2-player canvas ping pong game.
 */

(function () {
  'use strict';

  // ─── Canvas Setup ────────────────────────────────────────────────────────────
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const W = 800, H = 500;
  canvas.width = W;
  canvas.height = H;

  // ─── Constants ───────────────────────────────────────────────────────────────
  const PAD_W = 12, PAD_H = 80, PAD_SPEED = 5;
  const BALL_R = 7;
  const BALL_START_SPEED = 4;
  const BALL_MAX_SPEED = 12;
  const BALL_SPEED_INC = 0.15;
  const TRAIL_LEN = 6;
  const WIN_SCORE = 11;
  const COLORS = {
    p1: '#39ff14',
    p2: '#00e5ff',
    ball: '#ffffff',
    field: '#000000',
    hud: '#ffffff',
    accent: '#39ff14',
    dim: 'rgba(255,255,255,0.15)',
  };

  // ─── State ───────────────────────────────────────────────────────────────────
  let gameState = 'start'; // 'start' | 'playing' | 'scored' | 'win'
  let winner = 0;
  let servePlayer = 1; // 1 or 2

  const score = { p1: 0, p2: 0 };

  const p1 = { x: 20, y: H / 2 - PAD_H / 2, dy: 0, flash: 0 };
  const p2 = { x: W - 20 - PAD_W, y: H / 2 - PAD_H / 2, dy: 0, flash: 0 };

  let ball = createBall(servePlayer);
  let trail = [];
  let particles = [];
  let wallFlash = { top: 0, bottom: 0 };
  let scoredTimer = 0;

  const keys = {};

  // ─── Input ───────────────────────────────────────────────────────────────────
  window.addEventListener('keydown', e => {
    keys[e.code] = true;

    if ((e.code === 'Space' || e.code === 'Enter') && gameState === 'start') {
      gameState = 'playing';
    }
    if (e.code === 'KeyR' && gameState === 'win') {
      resetGame();
    }
    // Prevent page scroll
    if (['Space', 'ArrowUp', 'ArrowDown'].some(k => e.code === k)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  function createBall(serveFrom) {
    const angle = (Math.random() * 40 - 20) * (Math.PI / 180);
    const dir = serveFrom === 1 ? 1 : -1;
    return {
      x: W / 2,
      y: H / 2,
      vx: Math.cos(angle) * BALL_START_SPEED * dir,
      vy: Math.sin(angle) * BALL_START_SPEED,
      speed: BALL_START_SPEED,
    };
  }

  function getSpeed(bll) {
    return Math.sqrt(bll.vx * bll.vx + bll.vy * bll.vy);
  }

  function setSpeed(bll, spd) {
    const cur = getSpeed(bll);
    if (cur === 0) return;
    bll.vx = (bll.vx / cur) * spd;
    bll.vy = (bll.vy / cur) * spd;
    bll.speed = spd;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function spawnParticles(x, y, color) {
    for (let i = 0; i < 22; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 5;
      particles.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 1,
        decay: 0.018 + Math.random() * 0.02,
        r: 3 + Math.random() * 4,
        color,
      });
    }
  }

  function resetGame() {
    score.p1 = 0;
    score.p2 = 0;
    servePlayer = 1;
    ball = createBall(servePlayer);
    trail = [];
    particles = [];
    p1.y = H / 2 - PAD_H / 2;
    p2.y = H / 2 - PAD_H / 2;
    gameState = 'start';
    winner = 0;
  }

  function checkWin() {
    const s1 = score.p1, s2 = score.p2;
    if ((s1 >= WIN_SCORE || s2 >= WIN_SCORE) && Math.abs(s1 - s2) >= 2) {
      winner = s1 > s2 ? 1 : 2;
      gameState = 'win';
    }
  }

  // ─── Update ───────────────────────────────────────────────────────────────────
  function update() {
    if (gameState === 'start' || gameState === 'win') return;

    // ── Paddle movement ──────────────────────────────────────────────────────
    const prevP1y = p1.y, prevP2y = p2.y;

    if (keys['KeyW'])  p1.y -= PAD_SPEED;
    if (keys['KeyS'])  p1.y += PAD_SPEED;
    if (keys['ArrowUp'])   p2.y -= PAD_SPEED;
    if (keys['ArrowDown']) p2.y += PAD_SPEED;

    p1.y = clamp(p1.y, 0, H - PAD_H);
    p2.y = clamp(p2.y, 0, H - PAD_H);

    p1.dy = p1.y - prevP1y;
    p2.dy = p2.y - prevP2y;

    // Decrease flash timers
    if (p1.flash > 0) p1.flash -= 0.1;
    if (p2.flash > 0) p2.flash -= 0.1;
    if (wallFlash.top > 0) wallFlash.top -= 0.1;
    if (wallFlash.bottom > 0) wallFlash.bottom -= 0.1;

    // ── Scored pause ────────────────────────────────────────────────────────
    if (gameState === 'scored') {
      scoredTimer--;
      if (scoredTimer <= 0) {
        ball = createBall(servePlayer);
        trail = [];
        gameState = 'playing';
      }
      updateParticles();
      return;
    }

    // ── Trail ────────────────────────────────────────────────────────────────
    trail.push({ x: ball.x, y: ball.y });
    if (trail.length > TRAIL_LEN) trail.shift();

    // ── Ball movement ────────────────────────────────────────────────────────
    ball.x += ball.vx;
    ball.y += ball.vy;

    // ── Wall collisions (top / bottom) ───────────────────────────────────────
    if (ball.y - BALL_R <= 0) {
      ball.y = BALL_R;
      ball.vy = Math.abs(ball.vy);
      wallFlash.top = 1;
    }
    if (ball.y + BALL_R >= H) {
      ball.y = H - BALL_R;
      ball.vy = -Math.abs(ball.vy);
      wallFlash.bottom = 1;
    }

    // ── Paddle collisions ────────────────────────────────────────────────────
    // P1 (left paddle)
    if (
      ball.vx < 0 &&
      ball.x - BALL_R <= p1.x + PAD_W &&
      ball.x - BALL_R >= p1.x - 4 &&
      ball.y >= p1.y - BALL_R &&
      ball.y <= p1.y + PAD_H + BALL_R
    ) {
      ball.x = p1.x + PAD_W + BALL_R + 1;
      const hitPos = (ball.y - (p1.y + PAD_H / 2)) / (PAD_H / 2); // -1..1
      const maxAngle = 65 * (Math.PI / 180);
      const angle = hitPos * maxAngle;
      const spd = Math.min(BALL_MAX_SPEED, getSpeed(ball) + BALL_SPEED_INC);
      ball.vx =  Math.cos(angle) * spd;
      ball.vy =  Math.sin(angle) * spd + p1.dy * 0.3; // spin
      setSpeed(ball, spd);
      ball.speed = spd;
      p1.flash = 1;
    }

    // P2 (right paddle)
    if (
      ball.vx > 0 &&
      ball.x + BALL_R >= p2.x &&
      ball.x + BALL_R <= p2.x + PAD_W + 4 &&
      ball.y >= p2.y - BALL_R &&
      ball.y <= p2.y + PAD_H + BALL_R
    ) {
      ball.x = p2.x - BALL_R - 1;
      const hitPos = (ball.y - (p2.y + PAD_H / 2)) / (PAD_H / 2);
      const maxAngle = 65 * (Math.PI / 180);
      const angle = hitPos * maxAngle;
      const spd = Math.min(BALL_MAX_SPEED, getSpeed(ball) + BALL_SPEED_INC);
      ball.vx = -Math.cos(angle) * spd;
      ball.vy =  Math.sin(angle) * spd + p2.dy * 0.3;
      setSpeed(ball, spd);
      ball.speed = spd;
      p2.flash = 1;
    }

    // ── Scoring ───────────────────────────────────────────────────────────────
    if (ball.x + BALL_R < 0) {
      // P2 scores
      score.p2++;
      servePlayer = 1;
      spawnParticles(ball.x, ball.y, COLORS.p2);
      checkWin();
      if (gameState !== 'win') {
        gameState = 'scored';
        scoredTimer = 80;
      }
    } else if (ball.x - BALL_R > W) {
      // P1 scores
      score.p1++;
      servePlayer = 2;
      spawnParticles(ball.x, ball.y, COLORS.p1);
      checkWin();
      if (gameState !== 'win') {
        gameState = 'scored';
        scoredTimer = 80;
      }
    }

    updateParticles();
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08; // gravity
      p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  // ─── Draw ─────────────────────────────────────────────────────────────────────
  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Field bg
    ctx.fillStyle = COLORS.field;
    ctx.fillRect(0, 0, W, H);

    if (gameState === 'start') {
      drawStartScreen();
      return;
    }

    drawField();
    drawWallFlash();
    drawTrail();
    drawBall();
    drawPaddle(p1, COLORS.p1);
    drawPaddle(p2, COLORS.p2);
    drawParticles();
    drawHUD();

    if (gameState === 'win') drawWinOverlay();
  }

  function drawStartScreen() {
    // Subtle grid
    ctx.strokeStyle = 'rgba(57,255,20,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Center divider
    drawCenterLine();

    // Title
    ctx.save();
    ctx.shadowColor = COLORS.p1;
    ctx.shadowBlur = 24;
    ctx.fillStyle = COLORS.p1;
    ctx.font = 'bold 62px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('🏓 PING PONG', W / 2, 120);
    ctx.restore();

    // Controls box
    const bx = W / 2 - 260, by = 160, bw = 520, bh = 220;
    ctx.fillStyle = 'rgba(57,255,20,0.05)';
    ctx.strokeStyle = 'rgba(57,255,20,0.3)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, bx, by, bw, bh, 8);
    ctx.fill(); ctx.stroke();

    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.p1;
    ctx.fillText('CONTROLS', W / 2, by + 34);

    ctx.font = '15px "Courier New", monospace';
    ctx.fillStyle = '#ccc';
    const lines = [
      ['PLAYER 1 (LEFT)', 'W = Up   S = Down', COLORS.p1],
      ['PLAYER 2 (RIGHT)', '↑ = Up   ↓ = Down', COLORS.p2],
    ];
    let ly = by + 68;
    lines.forEach(([label, ctrl, col]) => {
      ctx.fillStyle = col;
      ctx.font = 'bold 15px "Courier New", monospace';
      ctx.fillText(label, W / 2, ly);
      ctx.fillStyle = '#ccc';
      ctx.font = '15px "Courier New", monospace';
      ctx.fillText(ctrl, W / 2, ly + 22);
      ly += 60;
    });

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '13px "Courier New", monospace';
    ctx.fillText('First to 11 points  •  Win by 2', W / 2, by + bh - 20);

    // Pulsing start prompt
    const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 400);
    ctx.fillStyle = `rgba(57,255,20,${pulse})`;
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.fillText('PRESS SPACE or ENTER TO BEGIN', W / 2, H - 34);
  }

  function drawCenterLine() {
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawField() {
    drawCenterLine();
  }

  function drawWallFlash() {
    if (wallFlash.top > 0) {
      ctx.fillStyle = `rgba(255,255,255,${wallFlash.top * 0.25})`;
      ctx.fillRect(0, 0, W, 6);
    }
    if (wallFlash.bottom > 0) {
      ctx.fillStyle = `rgba(255,255,255,${wallFlash.bottom * 0.25})`;
      ctx.fillRect(0, H - 6, W, 6);
    }
  }

  function drawTrail() {
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i];
      const alpha = ((i + 1) / TRAIL_LEN) * 0.45;
      const radius = BALL_R * ((i + 1) / TRAIL_LEN);
      ctx.beginPath();
      ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fill();
    }
  }

  function drawBall() {
    if (gameState === 'scored') return;
    ctx.save();
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.ball;
    ctx.fill();
    ctx.restore();
  }

  function drawPaddle(pad, color) {
    const alpha = pad.flash > 0 ? 1 : 0.9;
    const glow = pad.flash > 0 ? 20 : 8;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = glow * (pad.flash > 0 ? pad.flash : 0.5);
    ctx.fillStyle = pad.flash > 0
      ? lerpColor(color, '#ffffff', pad.flash * 0.6)
      : color;
    ctx.globalAlpha = alpha;
    roundRect(ctx, pad.x, pad.y, PAD_W, PAD_H, 4);
    ctx.fill();
    ctx.restore();
  }

  function drawParticles() {
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawHUD() {
    // ── Score ──────────────────────────────────────────────────────────────────
    ctx.save();
    ctx.shadowColor = COLORS.p1;
    ctx.shadowBlur = 14;
    ctx.fillStyle = COLORS.p1;
    ctx.font = 'bold 52px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(score.p1, W / 2 - 28, 56);
    ctx.restore();

    ctx.save();
    ctx.shadowColor = COLORS.p2;
    ctx.shadowBlur = 14;
    ctx.fillStyle = COLORS.p2;
    ctx.font = 'bold 52px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(score.p2, W / 2 + 28, 56);
    ctx.restore();

    // Dash between scores
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = 'bold 36px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('—', W / 2, 50);

    // ── Player labels ─────────────────────────────────────────────────────────
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillStyle = COLORS.p1;
    ctx.textAlign = 'left';
    ctx.fillText('P1', p1.x + PAD_W + 6, 18);

    ctx.fillStyle = COLORS.p2;
    ctx.textAlign = 'right';
    ctx.fillText('P2', p2.x - 6, 18);

    // ── Serve indicator ───────────────────────────────────────────────────────
    if (gameState === 'scored') {
      const serveColor = servePlayer === 1 ? COLORS.p1 : COLORS.p2;
      const serveLabel = servePlayer === 1 ? '← SERVE' : 'SERVE →';
      const serveX = servePlayer === 1 ? W / 2 - 110 : W / 2 + 110;
      const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 280);
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = serveColor;
      ctx.font = 'bold 14px "Courier New", monospace';
      ctx.textAlign = servePlayer === 1 ? 'right' : 'left';
      ctx.fillText(serveLabel, serveX, 78);
      ctx.restore();
    } else {
      // subtle serve arrow near score
      const serveColor = servePlayer === 1 ? COLORS.p1 : COLORS.p2;
      ctx.fillStyle = serveColor + '80';
      ctx.font = '12px "Courier New", monospace';
      ctx.textAlign = servePlayer === 1 ? 'right' : 'left';
      ctx.fillText(
        servePlayer === 1 ? '← serve' : 'serve →',
        servePlayer === 1 ? W / 2 - 28 : W / 2 + 28,
        72
      );
    }

    // ── Ball speed ────────────────────────────────────────────────────────────
    const displaySpeed = getSpeed(ball).toFixed(1);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '12px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`BALL SPEED: ${displaySpeed}`, W / 2, H - 20);

    // ── Win condition note ────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('First to 11 (win by 2)', W / 2, H - 6);
  }

  function drawWinOverlay() {
    // Dim background
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, W, H);

    const color = winner === 1 ? COLORS.p1 : COLORS.p2;

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 30;
    ctx.fillStyle = color;
    ctx.font = 'bold 58px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`PLAYER ${winner} WINS! 🏓`, W / 2, H / 2 - 18);
    ctx.restore();

    // Final score
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '26px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${score.p1}  —  ${score.p2}`, W / 2, H / 2 + 32);

    // Restart prompt
    const pulse = 0.55 + 0.45 * Math.sin(Date.now() / 500);
    ctx.fillStyle = `rgba(255,255,255,${pulse})`;
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillText('PRESS  R  TO RESTART', W / 2, H / 2 + 80);
  }

  // ─── Utility ─────────────────────────────────────────────────────────────────
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function lerpColor(hex1, hex2, t) {
    const a = hexToRgb(hex1), b = hexToRgb(hex2);
    const r = Math.round(a[0] + (b[0] - a[0]) * t);
    const g = Math.round(a[1] + (b[1] - a[1]) * t);
    const bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return `rgb(${r},${g},${bl})`;
  }

  function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // ─── Game Loop ────────────────────────────────────────────────────────────────
  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  loop();
})();
