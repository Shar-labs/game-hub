/**
 * Tic Tac Toe – tictactoe.js
 * Polished 2-player game. DOM-based grid, SVG marks, animations, best-of-5.
 */

(function () {
  'use strict';

  // ─── State ─────────────────────────────────────────────────────────────────
  let board = Array(9).fill(null);   // null | 'X' | 'O'
  let currentPlayer = 'X';           // 'X' or 'O'
  let gameActive = true;
  let roundLocked = false;

  let scores = { X: 0, O: 0, draws: 0 };
  let roundNumber = 1;
  const WIN_TARGET = 3;  // first to 3 round wins

  const WIN_LINES = [
    [0,1,2],[3,4,5],[6,7,8],   // rows
    [0,3,6],[1,4,7],[2,5,8],   // cols
    [0,4,8],[2,4,6]            // diagonals
  ];

  // Keyboard map: numpad layout 7-8-9 / 4-5-6 / 1-2-3  → board indices 0-8
  const KEY_MAP = {
    '7':0,'8':1,'9':2,
    '4':3,'5':4,'6':5,
    '1':6,'2':7,'3':8,
    'Numpad7':0,'Numpad8':1,'Numpad9':2,
    'Numpad4':3,'Numpad5':4,'Numpad6':5,
    'Numpad1':6,'Numpad2':7,'Numpad3':8,
  };

  // ─── DOM refs ──────────────────────────────────────────────────────────────
  const boardEl      = document.getElementById('board');
  const turnEl       = document.getElementById('turn-indicator');
  const roundEl      = document.getElementById('round-info');
  const statusEl     = document.getElementById('status-msg');
  const scoreP1El    = document.getElementById('score-p1');
  const scoreDrawsEl = document.getElementById('score-draws');
  const scoreP2El    = document.getElementById('score-p2');
  const btnRound     = document.getElementById('btn-new-round');
  const btnMatch     = document.getElementById('btn-new-match');
  const confettiCanvas = document.getElementById('confetti-canvas');

  // ─── Init ──────────────────────────────────────────────────────────────────
  function init() {
    buildGrid();
    btnRound.addEventListener('click', newRound);
    btnMatch.addEventListener('click', newMatch);
    document.addEventListener('keydown', onKeyDown);
    updateUI();
  }

  // ─── Build grid ────────────────────────────────────────────────────────────
  function buildGrid() {
    boardEl.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.index = i;
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('tabindex', '0');
      cell.setAttribute('aria-label', `Cell ${i + 1}`);
      cell.addEventListener('click', () => handleMove(i));
      cell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') handleMove(i);
      });
      boardEl.appendChild(cell);
    }
  }

  function getCells() {
    return Array.from(boardEl.querySelectorAll('.cell'));
  }

  // ─── Handle move ───────────────────────────────────────────────────────────
  function handleMove(index) {
    if (!gameActive || roundLocked || board[index]) return;

    board[index] = currentPlayer;
    renderCell(index, currentPlayer);

    const cells = getCells();
    cells[index].classList.add('taken', 'bounce');
    cells[index].removeEventListener('click', () => handleMove(index));

    const winLine = checkWin(board, currentPlayer);
    if (winLine) {
      handleRoundWin(currentPlayer, winLine);
    } else if (board.every(Boolean)) {
      handleDraw();
    } else {
      currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
      updateTurnIndicator();
    }
  }

  // ─── Render cell SVG ───────────────────────────────────────────────────────
  function renderCell(index, player) {
    const cells = getCells();
    const cell = cells[index];
    if (player === 'X') {
      cell.innerHTML = `
        <svg class="mark-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <line class="x-line" x1="18" y1="18" x2="82" y2="82"/>
          <line class="x-line" x1="82" y1="18" x2="18" y2="82"/>
        </svg>`;
    } else {
      cell.innerHTML = `
        <svg class="mark-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <circle class="o-circle" cx="50" cy="50" r="35"/>
        </svg>`;
    }
  }

  // ─── Win detection ─────────────────────────────────────────────────────────
  function checkWin(b, player) {
    for (const line of WIN_LINES) {
      if (line.every(i => b[i] === player)) return line;
    }
    return null;
  }

  // ─── Round win ─────────────────────────────────────────────────────────────
  function handleRoundWin(player, winLine) {
    gameActive = false;
    roundLocked = true;
    scores[player]++;
    updateScoreDisplay(player);

    // Highlight winning cells
    const cells = getCells();
    const cls = player === 'X' ? 'win-x' : 'win-o';
    winLine.forEach(i => cells[i].classList.add(cls));

    const playerLabel = player === 'X' ? 'Player 1' : 'Player 2';

    // Check match winner
    if (scores[player] >= WIN_TARGET) {
      // Match over
      setTimeout(() => {
        setStatus(`🏆 ${playerLabel.toUpperCase()} WINS THE MATCH!`, 'match-msg');
        updateTurnIndicator('');
        launchConfetti(player);
      }, 300);
    } else {
      setStatus(`${playerLabel} wins the round!`, 'win-msg');
      roundNumber++;
      updateRoundDisplay();

      // Auto-advance after 2s
      setTimeout(() => {
        if (roundLocked) newRound();
      }, 2000);
    }
  }

  // ─── Draw ──────────────────────────────────────────────────────────────────
  function handleDraw() {
    gameActive = false;
    roundLocked = true;
    scores.draws++;
    updateScoreDisplay('draws');

    const cells = getCells();
    // Stagger shake
    cells.forEach((c, i) => {
      setTimeout(() => c.classList.add('shake'), i * 30);
    });

    setStatus('Draw — no winner!', 'draw-msg');
    roundNumber++;
    updateRoundDisplay();

    setTimeout(() => {
      if (roundLocked) newRound();
    }, 2000);
  }

  // ─── New round ─────────────────────────────────────────────────────────────
  function newRound() {
    // Check if match is already over
    if (scores.X >= WIN_TARGET || scores.O >= WIN_TARGET) {
      newMatch();
      return;
    }

    board = Array(9).fill(null);
    currentPlayer = 'X';
    gameActive = true;
    roundLocked = false;

    buildGrid();
    setStatus('');
    updateTurnIndicator();
    updateRoundDisplay();
  }

  // ─── New match ─────────────────────────────────────────────────────────────
  function newMatch() {
    scores = { X: 0, O: 0, draws: 0 };
    roundNumber = 1;
    board = Array(9).fill(null);
    currentPlayer = 'X';
    gameActive = true;
    roundLocked = false;

    buildGrid();
    setStatus('');
    updateScoreDisplay('all');
    updateTurnIndicator();
    updateRoundDisplay();
    stopConfetti();
  }

  // ─── UI updates ────────────────────────────────────────────────────────────
  function updateUI() {
    updateTurnIndicator();
    updateRoundDisplay();
    updateScoreDisplay('all');
  }

  function updateTurnIndicator(msg) {
    if (msg !== undefined) {
      turnEl.textContent = msg;
      turnEl.className = '';
      return;
    }
    if (currentPlayer === 'X') {
      turnEl.textContent = "Player 1's Turn (X)";
      turnEl.className = 'p1';
    } else {
      turnEl.textContent = "Player 2's Turn (O)";
      turnEl.className = 'p2';
    }
  }

  function updateRoundDisplay() {
    roundEl.textContent = `Round ${roundNumber} · Best of 5 (First to ${WIN_TARGET})`;
  }

  function updateScoreDisplay(who) {
    const bump = (el) => {
      el.classList.remove('bump');
      void el.offsetWidth; // reflow
      el.classList.add('bump');
    };
    if (who === 'X' || who === 'all') {
      scoreP1El.textContent = scores.X;
      if (who === 'X') bump(scoreP1El);
    }
    if (who === 'O' || who === 'all') {
      scoreP2El.textContent = scores.O;
      if (who === 'O') bump(scoreP2El);
    }
    if (who === 'draws' || who === 'all') {
      scoreDrawsEl.textContent = scores.draws;
      if (who === 'draws') bump(scoreDrawsEl);
    }
  }

  function setStatus(msg, cls) {
    statusEl.textContent = msg;
    statusEl.className = cls || '';
  }

  // ─── Keyboard ──────────────────────────────────────────────────────────────
  function onKeyDown(e) {
    const key = e.code.startsWith('Numpad') ? e.code : e.key;
    if (key in KEY_MAP) {
      e.preventDefault();
      handleMove(KEY_MAP[key]);
    }
  }

  // ─── Confetti ──────────────────────────────────────────────────────────────
  const ctx = confettiCanvas.getContext('2d');
  let confettiParticles = [];
  let confettiRunning = false;
  let confettiAnimId = null;

  function launchConfetti(player) {
    const color1 = player === 'X' ? '#ffd700' : '#00aaff';
    const color2 = player === 'X' ? '#ffaa00' : '#66ccff';
    const colors = [color1, color2, '#ffffff', '#ff66aa', '#88ff88'];

    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
    confettiParticles = [];

    for (let i = 0; i < 180; i++) {
      confettiParticles.push({
        x: Math.random() * confettiCanvas.width,
        y: -20 - Math.random() * 200,
        w: 6 + Math.random() * 8,
        h: 10 + Math.random() * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.15,
        vx: (Math.random() - 0.5) * 3,
        vy: 2 + Math.random() * 3,
        alpha: 1,
        decay: 0.004 + Math.random() * 0.004,
      });
    }

    confettiRunning = true;
    animateConfetti();
  }

  function animateConfetti() {
    if (!confettiRunning) return;
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

    confettiParticles = confettiParticles.filter(p => p.alpha > 0.01);

    for (const p of confettiParticles) {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.rotSpeed;
      p.alpha -= p.decay;
      p.vy += 0.04; // gravity

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    if (confettiParticles.length > 0) {
      confettiAnimId = requestAnimationFrame(animateConfetti);
    } else {
      stopConfetti();
    }
  }

  function stopConfetti() {
    confettiRunning = false;
    if (confettiAnimId) {
      cancelAnimationFrame(confettiAnimId);
      confettiAnimId = null;
    }
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiParticles = [];
  }

  window.addEventListener('resize', () => {
    if (confettiRunning) {
      confettiCanvas.width = window.innerWidth;
      confettiCanvas.height = window.innerHeight;
    }
  });

  // ─── Start ─────────────────────────────────────────────────────────────────
  init();

})();
