/* ============================================================
   BATTLESHIP — Complete Pass-and-Play Implementation
   ============================================================ */

(function () {
  'use strict';

  // ── Constants ────────────────────────────────────────────
  const ROWS = 10, COLS = 10;
  const COL_LABELS = ['A','B','C','D','E','F','G','H','I','J'];
  const ROW_LABELS = ['1','2','3','4','5','6','7','8','9','10'];

  const SHIPS_DEF = [
    { name: 'Carrier',    len: 5, id: 'carrier'    },
    { name: 'Battleship', len: 4, id: 'battleship' },
    { name: 'Cruiser',    len: 3, id: 'cruiser'    },
    { name: 'Submarine',  len: 3, id: 'submarine'  },
    { name: 'Destroyer',  len: 2, id: 'destroyer'  },
  ];

  // ── State ─────────────────────────────────────────────────
  const state = {
    phase: 'setup',      // 'setup' | 'battle' | 'over'
    currentPlayer: 1,    // 1 or 2
    setupStep: 1,        // which player is placing ships (1 or 2)

    players: {
      1: createPlayerState(),
      2: createPlayerState(),
    },

    // Setup interaction
    selectedShipId: null,
    orientation: 'H',    // 'H' | 'V'
    hoverCell: null,     // {r, c}
  };

  function createPlayerState() {
    return {
      board: emptyBoard(),      // what ships are placed (null or shipId)
      shots: emptyBoard(),      // null | 'hit' | 'miss'
      ships: {},                // { shipId: { cells:[{r,c}], sunk:false } }
      placedShipIds: [],
    };
  }

  function emptyBoard() {
    const b = [];
    for (let r = 0; r < ROWS; r++) {
      b[r] = [];
      for (let c = 0; c < COLS; c++) b[r][c] = null;
    }
    return b;
  }

  // ── DOM refs ──────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const ownGrid       = $('own-grid');
  const enemyGrid     = $('enemy-grid');
  const phaseIndicator= $('phase-indicator');
  const statusMsg     = $('status-msg');
  const setupPanel    = $('setup-panel');
  const shipList      = $('ship-list');
  const readyBtn      = $('ready-btn');
  const coverScreen   = $('cover-screen');
  const coverTitle    = $('cover-title');
  const coverBtn      = $('cover-btn');
  const winOverlay    = $('win-overlay');
  const winTitle      = $('win-title');
  const winRestart    = $('win-restart');
  const ownLabel      = $('own-label');
  const enemyLabel    = $('enemy-label');

  // ── Initialise ───────────────────────────────────────────
  function init() {
    buildGridLabels('own-col-labels', 'own-row-labels');
    buildGridLabels('enemy-col-labels', 'enemy-row-labels');
    buildOwnGrid();
    buildEnemyGrid();
    buildShipList();
    updatePhaseUI();

    readyBtn.addEventListener('click', onReady);
    coverBtn.addEventListener('click', onCoverContinue);
    winRestart.addEventListener('click', onRestart);
    document.addEventListener('keydown', onKeyDown);
  }

  // ── Grid label builders ──────────────────────────────────
  function buildGridLabels(colId, rowId) {
    const colEl = $(colId);
    const rowEl = $(rowId);
    colEl.innerHTML = '';
    rowEl.innerHTML = '';
    for (let c = 0; c < COLS; c++) {
      const d = document.createElement('div');
      d.className = 'label-cell';
      d.textContent = COL_LABELS[c];
      colEl.appendChild(d);
    }
    for (let r = 0; r < ROWS; r++) {
      const d = document.createElement('div');
      d.className = 'row-label-cell';
      d.textContent = ROW_LABELS[r];
      rowEl.appendChild(d);
    }
  }

  // ── Grid cell builders ────────────────────────────────────
  function buildOwnGrid() {
    ownGrid.innerHTML = '';
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.addEventListener('mouseenter', onOwnHover);
        cell.addEventListener('mouseleave', onOwnLeave);
        cell.addEventListener('click', onOwnClick);
        ownGrid.appendChild(cell);
      }
    }
  }

  function buildEnemyGrid() {
    enemyGrid.innerHTML = '';
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.addEventListener('click', onEnemyClick);
        enemyGrid.appendChild(cell);
      }
    }
  }

  function getOwnCell(r, c) {
    return ownGrid.querySelector(`[data-r="${r}"][data-c="${c}"]`);
  }
  function getEnemyCell(r, c) {
    return enemyGrid.querySelector(`[data-r="${r}"][data-c="${c}"]`);
  }

  // ── Ship list panel ───────────────────────────────────────
  function buildShipList() {
    shipList.innerHTML = '';
    SHIPS_DEF.forEach(ship => {
      const player = state.players[state.setupStep];
      const placed = player.placedShipIds.includes(ship.id);

      const row = document.createElement('div');
      row.className = 'ship-option' + (placed ? ' placed' : '');
      row.dataset.shipId = ship.id;

      const cells = document.createElement('div');
      cells.className = 'ship-cells';
      for (let i = 0; i < ship.len; i++) {
        const sc = document.createElement('div');
        sc.className = 'ship-cell-icon';
        cells.appendChild(sc);
      }

      const name = document.createElement('span');
      name.className = 'ship-option-name';
      name.textContent = ship.name;

      const len = document.createElement('span');
      len.className = 'ship-option-len';
      len.textContent = `×${ship.len}`;

      row.appendChild(cells);
      row.appendChild(name);
      row.appendChild(len);
      row.addEventListener('click', () => selectShip(ship.id));
      shipList.appendChild(row);
    });
  }

  function selectShip(shipId) {
    const player = state.players[state.setupStep];
    if (player.placedShipIds.includes(shipId)) return;
    state.selectedShipId = shipId;
    document.querySelectorAll('.ship-option').forEach(el => {
      el.classList.toggle('selected', el.dataset.shipId === shipId);
    });
    const ship = SHIPS_DEF.find(s => s.id === shipId);
    setStatus(`Placing ${ship.name} (${ship.len} cells) — Press R to rotate [${state.orientation}]`);
  }

  // ── Placement helpers ────────────────────────────────────
  function getShipCells(r, c, len, orientation) {
    const cells = [];
    for (let i = 0; i < len; i++) {
      if (orientation === 'H') cells.push({ r, c: c + i });
      else                      cells.push({ r: r + i, c });
    }
    return cells;
  }

  function isValidPlacement(cells, board) {
    for (const { r, c } of cells) {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
      if (board[r][c] !== null) return false;
    }
    return true;
  }

  // ── Own grid events (setup) ───────────────────────────────
  function onOwnHover(e) {
    if (state.phase !== 'setup' || !state.selectedShipId) return;
    const r = +e.target.dataset.r;
    const c = +e.target.dataset.c;
    state.hoverCell = { r, c };
    renderPreview();
  }
  function onOwnLeave() {
    state.hoverCell = null;
    clearPreview();
  }
  function onOwnClick(e) {
    if (state.phase !== 'setup' || !state.selectedShipId) return;
    const r = +e.target.dataset.r;
    const c = +e.target.dataset.c;
    placeShip(r, c);
  }

  function renderPreview() {
    clearPreview();
    if (!state.hoverCell || !state.selectedShipId) return;
    const ship = SHIPS_DEF.find(s => s.id === state.selectedShipId);
    const cells = getShipCells(state.hoverCell.r, state.hoverCell.c, ship.len, state.orientation);
    const player = state.players[state.setupStep];
    const valid = isValidPlacement(cells, player.board);
    cells.forEach(({ r, c }) => {
      const el = getOwnCell(r, c);
      if (el) el.classList.add(valid ? 'preview-valid' : 'preview-invalid');
    });
  }

  function clearPreview() {
    ownGrid.querySelectorAll('.preview-valid, .preview-invalid').forEach(el => {
      el.classList.remove('preview-valid', 'preview-invalid');
    });
  }

  function placeShip(r, c) {
    const shipDef = SHIPS_DEF.find(s => s.id === state.selectedShipId);
    const cells = getShipCells(r, c, shipDef.len, state.orientation);
    const player = state.players[state.setupStep];

    if (!isValidPlacement(cells, player.board)) {
      setStatus('⚠ Invalid placement — ship must fit on grid and not overlap.');
      return;
    }

    // Mark board
    cells.forEach(({ r: cr, c: cc }) => {
      player.board[cr][cc] = state.selectedShipId;
    });
    player.ships[state.selectedShipId] = { cells, sunk: false };
    player.placedShipIds.push(state.selectedShipId);

    // Draw ship overlay
    drawShipOverlay(cells, ownGrid);

    // Update ship list
    buildShipList();
    state.selectedShipId = null;

    // Check if all placed
    const allPlaced = SHIPS_DEF.every(s => player.placedShipIds.includes(s.id));
    if (allPlaced) {
      readyBtn.classList.add('active');
      setStatus('All ships placed! Click READY to continue.');
    } else {
      setStatus('Ship placed. Select the next ship.');
    }
  }

  function drawShipOverlay(cells, gridEl) {
    const cell = cells[0];
    const isH = cells.length === 1 || (cells[1] && cells[1].r === cell.r);
    const cellSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell-size'));

    const overlay = document.createElement('div');
    overlay.className = 'ship-overlay';

    if (isH) {
      overlay.style.top  = (cell.r * cellSize) + 'px';
      overlay.style.left = (cell.c * cellSize) + 'px';
      overlay.style.width  = (cells.length * cellSize - 2) + 'px';
      overlay.style.height = (cellSize - 2) + 'px';
    } else {
      overlay.style.top  = (cell.r * cellSize) + 'px';
      overlay.style.left = (cell.c * cellSize) + 'px';
      overlay.style.width  = (cellSize - 2) + 'px';
      overlay.style.height = (cells.length * cellSize - 2) + 'px';
    }
    gridEl.appendChild(overlay);
  }

  // ── Ready button ─────────────────────────────────────────
  function onReady() {
    if (state.setupStep === 1) {
      // Done with P1 setup — show pass screen for P2
      readyBtn.classList.remove('active');
      clearPreview();
      state.selectedShipId = null;
      showCover('PASS THE DEVICE TO PLAYER 2', () => {
        state.setupStep = 2;
        // Reset own grid for P2
        ownGrid.innerHTML = '';
        // Remove ship overlays
        ownGrid.querySelectorAll('.ship-overlay').forEach(el => el.remove());
        buildOwnGrid();
        buildShipList();
        updatePhaseUI();
        setStatus('Player 2: Select a ship and click your grid to place it.');
      });
    } else {
      // Done with P2 setup — start battle
      readyBtn.classList.remove('active');
      clearPreview();
      state.selectedShipId = null;
      setupPanel.classList.remove('active');
      state.phase = 'battle';
      state.currentPlayer = 1;
      // Show pass screen so P1 can start
      showCover('PASS THE DEVICE TO PLAYER 1', () => {
        renderBattleView();
        updatePhaseUI();
        setStatus('Player 1: Click a cell on ENEMY WATERS to fire!');
      });
    }
  }

  // ── Cover screen ─────────────────────────────────────────
  let _coverCallback = null;
  function showCover(message, callback) {
    coverTitle.textContent = message;
    _coverCallback = callback;
    coverScreen.classList.add('active');
  }
  function onCoverContinue() {
    coverScreen.classList.remove('active');
    if (_coverCallback) {
      const cb = _coverCallback;
      _coverCallback = null;
      cb();
    }
  }

  // ── Battle view rendering ─────────────────────────────────
  function renderBattleView() {
    const p = state.currentPlayer;
    const opp = p === 1 ? 2 : 1;

    // Rebuild own grid showing current player's ships
    ownGrid.innerHTML = '';
    buildOwnGrid();
    const ownPlayer = state.players[p];
    // Draw ship overlays
    Object.values(ownPlayer.ships).forEach(ship => {
      drawShipOverlay(ship.cells, ownGrid);
    });
    // Show hits received on own board
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const shot = state.players[opp].shots[r][c]; // what opp has fired at 'p'
        if (shot === 'hit') {
          const el = getOwnCell(r, c);
          if (el) { el.classList.add('hit'); el.innerHTML = '<span class="hit-mark">✕</span>'; }
        } else if (shot === 'miss') {
          const el = getOwnCell(r, c);
          if (el) { el.classList.add('miss'); el.innerHTML = '<span class="miss-mark">·</span>'; }
        }
      }
    }
    // Show sunk ships on own board
    Object.entries(ownPlayer.ships).forEach(([sid, ship]) => {
      if (ship.sunk) {
        ship.cells.forEach(({ r, c }) => {
          const el = getOwnCell(r, c);
          if (el) { el.classList.remove('hit'); el.classList.add('sunk'); el.innerHTML = '<span class="hit-mark">✕</span>'; }
        });
      }
    });

    // Rebuild enemy grid showing current player's shots at opponent
    enemyGrid.innerHTML = '';
    buildEnemyGrid();
    const oppPlayer = state.players[opp];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const shot = ownPlayer.shots[r][c];
        const el = getEnemyCell(r, c);
        if (shot === 'hit') {
          el.classList.add('hit'); el.innerHTML = '<span class="hit-mark">✕</span>';
        } else if (shot === 'miss') {
          el.classList.add('miss'); el.innerHTML = '<span class="miss-mark">·</span>';
        } else {
          el.classList.add('enemy-clickable');
        }
      }
    }
    // Show sunk ships on enemy grid
    Object.entries(oppPlayer.ships).forEach(([sid, ship]) => {
      if (ship.sunk) {
        ship.cells.forEach(({ r, c }) => {
          const el = getEnemyCell(r, c);
          if (el) {
            el.classList.remove('hit', 'enemy-clickable');
            el.classList.add('sunk');
            el.innerHTML = '<span class="hit-mark">✕</span>';
          }
        });
      }
    });

    ownLabel.textContent = `P${p} — YOUR FLEET`;
    enemyLabel.textContent = `P${p} — ENEMY WATERS`;
  }

  // ── Enemy grid click (firing) ─────────────────────────────
  function onEnemyClick(e) {
    if (state.phase !== 'battle') return;
    const r = +e.target.dataset.r;
    const c = +e.target.dataset.c;

    const p   = state.currentPlayer;
    const opp = p === 1 ? 2 : 1;
    const ownPlayer = state.players[p];
    const oppPlayer = state.players[opp];

    // Already fired here?
    if (ownPlayer.shots[r][c] !== null) return;

    const cellEl = getEnemyCell(r, c);

    if (oppPlayer.board[r][c] !== null) {
      // HIT
      ownPlayer.shots[r][c] = 'hit';
      const shipId = oppPlayer.board[r][c];
      cellEl.classList.remove('enemy-clickable');
      cellEl.classList.add('hit');
      cellEl.innerHTML = '<span class="hit-mark hit-anim">✕</span>';

      // Check if ship is sunk
      const ship = oppPlayer.ships[shipId];
      const isSunk = ship.cells.every(({ r: sr, c: sc }) => ownPlayer.shots[sr][sc] === 'hit');
      if (isSunk) {
        ship.sunk = true;
        const shipName = SHIPS_DEF.find(s => s.id === shipId).name;
        // Flash all sunk cells
        ship.cells.forEach(({ r: sr, c: sc }) => {
          const el = getEnemyCell(sr, sc);
          if (el) {
            el.classList.remove('hit', 'enemy-clickable');
            el.classList.add('sunk', 'sunk-flash');
            el.innerHTML = '<span class="hit-mark">✕</span>';
            setTimeout(() => el.classList.remove('sunk-flash'), 1500);
          }
        });
        setStatus(`💥 SUNK! P${p} destroyed the enemy ${shipName}!`);

        // Check win
        const allSunk = Object.values(oppPlayer.ships).every(s => s.sunk);
        if (allSunk) {
          setTimeout(() => showWin(p), 800);
          return;
        }
      } else {
        setStatus(`🔥 HIT! P${p} strikes at ${COL_LABELS[c]}${ROW_LABELS[r]}!`);
      }
    } else {
      // MISS
      ownPlayer.shots[r][c] = 'miss';
      cellEl.classList.remove('enemy-clickable');
      cellEl.classList.add('miss', 'miss-anim');
      cellEl.innerHTML = '<span class="miss-mark">·</span>';
      setTimeout(() => cellEl.classList.remove('miss-anim'), 700);
      setStatus(`💧 MISS — P${p} fires at ${COL_LABELS[c]}${ROW_LABELS[r]}.`);
    }

    // Pass turn after short delay
    setTimeout(() => passTurn(), 900);
  }

  function passTurn() {
    const p   = state.currentPlayer;
    const opp = p === 1 ? 2 : 1;
    showCover(`PASS THE DEVICE TO PLAYER ${opp}`, () => {
      state.currentPlayer = opp;
      updatePhaseUI();
      renderBattleView();
      setStatus(`Player ${opp}: Click a cell on ENEMY WATERS to fire!`);
    });
  }

  // ── Win ───────────────────────────────────────────────────
  function showWin(player) {
    state.phase = 'over';
    winTitle.textContent = `PLAYER ${player} WINS! ⚓`;
    winOverlay.classList.add('active');
  }

  // ── Restart ───────────────────────────────────────────────
  function onRestart() {
    winOverlay.classList.remove('active');
    // Reset state
    state.phase = 'setup';
    state.currentPlayer = 1;
    state.setupStep = 1;
    state.players[1] = createPlayerState();
    state.players[2] = createPlayerState();
    state.selectedShipId = null;
    state.orientation = 'H';
    state.hoverCell = null;

    // Rebuild UI
    ownGrid.innerHTML = '';
    buildOwnGrid();
    buildShipList();
    setupPanel.classList.add('active');
    readyBtn.classList.remove('active');
    ownLabel.textContent = 'YOUR FLEET';
    enemyLabel.textContent = 'ENEMY WATERS';
    updatePhaseUI();
    setStatus('Select a ship and click on your grid to place it.');
  }

  // ── Phase UI ──────────────────────────────────────────────
  function updatePhaseUI() {
    if (state.phase === 'setup') {
      phaseIndicator.textContent = `SETUP PHASE — P${state.setupStep} PLACING SHIPS`;
    } else if (state.phase === 'battle') {
      phaseIndicator.textContent = `BATTLE PHASE — PLAYER ${state.currentPlayer}'S TURN`;
    } else {
      phaseIndicator.textContent = 'GAME OVER';
    }
  }

  function setStatus(msg) {
    statusMsg.textContent = msg;
  }

  // ── Keyboard ──────────────────────────────────────────────
  function onKeyDown(e) {
    if (e.key === 'r' || e.key === 'R') {
      if (state.phase === 'setup' && state.selectedShipId) {
        state.orientation = state.orientation === 'H' ? 'V' : 'H';
        const ship = SHIPS_DEF.find(s => s.id === state.selectedShipId);
        setStatus(`Placing ${ship.name} (${ship.len} cells) — Press R to rotate [${state.orientation}]`);
        renderPreview();
      }
    }
  }

  // ── Boot ─────────────────────────────────────────────────
  init();

})();
