# 🎮 GAME HUB

A collection of **6 two-player browser games** built with a ridiculous number of programming languages — for funsies.

## 🕹️ Games

| Game | Players | Controls |
|------|---------|----------|
| 🥊 Boxing | 2 | P1: WASD + G/H &nbsp; P2: Arrows + K/L |
| 🏎️ Racing | 2 | P1: WASD &nbsp; P2: Arrow keys |
| ⚔️ Tic Tac Toe | 2 | Click / Numpad 1-9 |
| 🏓 Ping Pong | 2 | P1: W/S &nbsp; P2: ↑/↓ |
| 🔴 Connect Four | 2 | Click or 1-7 keys |
| ⚓ Battleship | 2 | Click (pass-and-play) |
| 🎡 Mystery Spin | 2 | Spin the wheel → Connect Four or Battleship |

## 🌐 Play Online

Visit the live site: **https://YOUR-USERNAME.github.io/game-hub/**

## 💻 Run Locally

```bash
# Clone the repo
git clone https://github.com/Sharjeel-labs/game-hub.git
cd game-hub

# Run the setup script (checks tools, runs build script)
bash setup.sh

# Start local server
python3 -m http.server 8080
# Open http://localhost:8080
```

## 🧪 Build Script

```bash
python3 build.py
```
Validates all HTML files and generates `manifest.json` with asset inventory.

## 🗂️ Languages Used

| Language | File(s) | Purpose |
|----------|---------|---------|
| **HTML** | `index.html`, `games/*/index.html` | Structure & markup |
| **CSS** | `styles/hub.css` | Hub styling |
| **SCSS** | `src/hub.scss` | CSS source (compiled to hub.css) |
| **JavaScript** | `scripts/wheel.js`, `games/*/game.js` | Game logic & interactivity |
| **TypeScript** | `src/types.ts` | Shared type definitions & utilities |
| **Python** | `build.py` | Build script, HTML validation, manifest generation |
| **Rust** | `src/physics.rs` | Racing physics engine (WASM-ready) |
| **Java** | `src/ScoreManager.java` | Score management utility class |
| **Bash** | `setup.sh` | Dev environment setup script |
| **JSON** | `package.json`, `manifest.json` | Config & asset manifest |
| **SVG** | Inline in HTML/CSS | Icons and decorative elements |
| **Markdown** | `README.md` | This file! |

## 🏗️ Structure

```
game-hub/
├── index.html              ← Hub landing page
├── styles/
│   └── hub.css             ← Compiled styles
├── scripts/
│   └── wheel.js            ← Mystery spin wheel
├── games/
│   ├── boxing/
│   ├── racing/
│   ├── tictactoe/
│   ├── pingpong/
│   ├── connectfour/
│   └── battleship/
├── src/
│   ├── hub.scss            ← SCSS source
│   ├── types.ts            ← TypeScript types
│   ├── physics.rs          ← Rust physics module
│   └── ScoreManager.java   ← Java utility
├── build.py                ← Python build script
├── setup.sh                ← Bash setup script
└── package.json            ← Node config
```

## 📄 License

MIT — play freely, remix wildly.
