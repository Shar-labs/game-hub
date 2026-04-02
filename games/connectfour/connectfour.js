/**
 * Connect Four — connectfour.js
 * 7 columns × 6 rows, DOM-based, best-of-5 match play
 */

(function () {
  'use strict';

  // ── Constants ────────────────────────────────────────────────────────────
  const COLS = 7;
  const ROWS = 6;
  const MATCH_WINS = 3;   // first to this many round wins takes the match

  const P1_COLOR = '#ff2d55';
  const P2_COLOR = '#ffd700';

  // ── State ────────────────────────────────────────────────────────────────
  let board = [];          // board[row][col]: 0 = empty, 1 = P1, 2 = P2
  let currentPlayer = 1;
  let gameOver = false;
  let animating = false;

  const score = { p1: 0, p2: 0, draws: 0 };
  const matchWins = { p1: 0, p2: 0 };  // wins within current match
  let matchOver = false;

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const boardEl       = document.getElementById('board');
  const hoverRow      = document.getElementById('hover-row');
  const playerDot     = document.getElementById('player-dot');
  const playerText    = document.getElementById('player-text');
  const statusMsg     = document.getElementById('status-message');
  const btnArea       = document.getElementById('btn-area');
  const scoreP1El     = document.getElementById('score-p1');
  const scoreP2El     = document.getElementById('score-p2');
  const scoreDrawEl   = document.getElementById('score-draw');
  const pipsP1        = document.getElementById('pips-p1');
  const pipsP2        = document.getElementById('pips-p2');

  // ── Init ─────────────────────────────────────────────────────────────────
  function init() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    currentPlayer = 1;
    gameOver = false;
    animating = false;
    statusMsg.textContent = '';
    statusMsg.className = '';
    btnArea.innerHTML = '';
    boardEl.classList.remove('disabled');
    buildBoardDOM();
    buildHoverRow();
    updatePlayerIndicator();
  }

  function buildBoardDOM() {
    boardEl.innerHTML = '';
    // Grid order: row 0 at top, row 5 at bottom
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = r;
        cell.dataset.col = c;

        const disc = document.createElement('div');
        disc.className = 'disc';
        cell.appendChild(disc);

        cell.addEventListener('click', () => handleClick(c));
        boardEl.appendChild(cell);
      }
    }
  }

  function buildHoverRow() {
    hoverRow.innerHTML = '';
    for (let c = 0; c < COLS; c++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'hover-cell';

      const disc = document.createElement('div');
      disc.className = 'hover-disc';
      disc.id = `hover-disc-${c}`;
      wrapper.appendChild(disc);

      // Column hover zones span entire column height
      wrapper.addEventListener('mouseenter', () => showHover(c));
      wrapper.addEventListener('mouseleave', () => hideHover(c));
      wrapper.addEventListener('click', () => handleClick(c));

      hoverRow.appendChild(wrapper);
    }

    // Also attach hover to board cells per column
    boardEl.addEventListener('mouseover', (e) => {
      const cell = e.target.closest('.cell');
      if (!cell) return;
      const col = parseInt(cell.dataset.col);
      showHover(col);
    });
    boardEl.addEventListener('mouseout', (e) => {
      const cell = e.target.closest('.cell');
      if (!cell) return;
      const col = parseInt(cell.dataset.col);
      hideHover(col);
    });
  }

  function showHover(col) {
    if (gameOver || animating) return;
    const disc = document.getElementById(`hover-disc-${col}`);
    if (!disc) return;
    disc.style.background = currentPlayer === 1 ? P1_COLOR : P2_COLOR;
    disc.style.opacity = '0.55';
  }

  function hideHover(col) {
    const disc = document.getElementById(`hover-disc-${col}`);
    if (disc) disc.style.opacity = '0';
  }

  function hideAllHovers() {
    for (let c = 0; c < COLS; c++) hideHover(c);
  }

  // ── Gameplay ─────────────────────────────────────────────────────────────
  function handleClick(col) {
    if (gameOver || animating) return;
    dropPiece(col);
  }

  function dropPiece(col) {
    // Find lowest empty row in column
    let targetRow = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r][col] === 0) { targetRow = r; break; }
    }
    if (targetRow === -1) return; // column full

    board[targetRow][col] = currentPlayer;
    animating = true;
    hideAllHovers();
    boardEl.classList.add('disabled');

    const cell = getCellEl(targetRow, col);
    const disc = cell.querySelector('.disc');

    // Calculate how far (in px) the disc falls from the top
    const cellH = cell.offsetHeight + 6; // 6 = gap
    const dropPx = -(targetRow * cellH + cellH * 0.5);
    disc.style.setProperty('--drop-start', `${dropPx}px`);

    // Set disc color
    disc.style.background = currentPlayer === 1 ? P1_COLOR : P2_COLOR;
    cell.classList.add(currentPlayer === 1 ? 'p1' : 'p2');
    cell.classList.add('dropping');

    disc.addEventListener('animationend', () => {
      cell.classList.remove('dropping');
      animating = false;
      boardEl.classList.remove('disabled');
      afterDrop(targetRow, col);
    }, { once: true });
  }

  function afterDrop(row, col) {
    const winner = checkWin(row, col);
    if (winner) {
      highlightWin(winner.cells);
      endRound(currentPlayer, false);
    } else if (isBoardFull()) {
      endRound(null, true);
    } else {
      currentPlayer = currentPlayer === 1 ? 2 : 1;
      updatePlayerIndicator();
    }
  }

  // ── Win detection ─────────────────────────────────────────────────────────
  function checkWin(row, col) {
    const player = board[row][col];
    const directions = [
      [0, 1],   // horizontal
      [1, 0],   // vertical
      [1, 1],   // diagonal ↘
      [1, -1],  // diagonal ↙
    ];

    for (const [dr, dc] of directions) {
      const line = collectLine(row, col, dr, dc, player);
      if (line.length >= 4) {
        return { cells: line.slice(0, 4) };
      }
    }
    return null;
  }

  function collectLine(row, col, dr, dc, player) {
    const cells = [[row, col]];
    // Forward
    for (let i = 1; i < 4; i++) {
      const r = row + dr * i, c = col + dc * i;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== player) break;
      cells.push([r, c]);
    }
    // Backward
    for (let i = 1; i < 4; i++) {
      const r = row - dr * i, c = col - dc * i;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== player) break;
      cells.unshift([r, c]);
    }
    return cells;
  }

  function isBoardFull() {
    return board[0].every(cell => cell !== 0);
  }

  function highlightWin(cells) {
    cells.forEach(([r, c]) => {
      getCellEl(r, c).classList.add('winner');
    });
  }

  // ── Round / Match management ──────────────────────────────────────────────
  function endRound(winnerPlayer, isDraw) {
    gameOver = true;
    boardEl.classList.add('disabled');

    if (isDraw) {
      score.draws++;
      scoreDrawEl.textContent = score.draws;
      statusMsg.textContent = "It's a draw!";
      showRoundButton('New Round');
    } else {
      if (winnerPlayer === 1) {
        score.p1++;
        scoreP1El.textContent = score.p1;
        matchWins.p1++;
        updatePips();
        if (matchWins.p1 >= MATCH_WINS) {
          endMatch(1);
          return;
        }
        statusMsg.textContent = '🔴 Player 1 wins the round!';
      } else {
        score.p2++;
        scoreP2El.textContent = score.p2;
        matchWins.p2++;
        updatePips();
        if (matchWins.p2 >= MATCH_WINS) {
          endMatch(2);
          return;
        }
        statusMsg.textContent = '🟡 Player 2 wins the round!';
      }
      showRoundButton('New Round');
    }
  }

  function endMatch(winner) {
    matchOver = true;
    statusMsg.textContent = `🏆 PLAYER ${winner} WINS THE MATCH!`;
    statusMsg.classList.add('match-won');
    showRoundButton('New Match');
  }

  function showRoundButton(label) {
    btnArea.innerHTML = '';
    const btn = document.createElement('button');
    btn.className = 'action-btn';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      if (label === 'New Match') {
        resetMatch();
      } else {
        init();
      }
    });
    btnArea.appendChild(btn);
  }

  function resetMatch() {
    matchWins.p1 = 0;
    matchWins.p2 = 0;
    matchOver = false;
    updatePips();
    init();
  }

  // ── UI helpers ────────────────────────────────────────────────────────────
  function getCellEl(row, col) {
    return boardEl.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  }

  function updatePlayerIndicator() {
    const color = currentPlayer === 1 ? P1_COLOR : P2_COLOR;
    playerDot.style.background = color;
    playerDot.style.boxShadow = `0 0 10px 3px ${color}88`;
    playerText.textContent = `Player ${currentPlayer}'s turn`;
  }

  function updatePips() {
    // P1 pips
    pipsP1.querySelectorAll('.pip').forEach((pip, i) => {
      pip.classList.toggle('filled', i < matchWins.p1);
    });
    // P2 pips
    pipsP2.querySelectorAll('.pip').forEach((pip, i) => {
      pip.classList.toggle('filled', i < matchWins.p2);
    });
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (gameOver || animating) return;
    const key = e.key;
    if (key >= '1' && key <= '7') {
      const col = parseInt(key) - 1;
      handleClick(col);
    }
  });

  // ── Start ─────────────────────────────────────────────────────────────────
  init();

})();
