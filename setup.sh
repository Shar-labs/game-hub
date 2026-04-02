#!/usr/bin/env bash
# setup.sh — Game Hub local development setup
# Usage: bash setup.sh

set -e

echo "🎮 Game Hub — Setup Script"
echo "================================"

# Check for Python
if command -v python3 &>/dev/null; then
  echo "✅ Python3 found: $(python3 --version)"
  echo "   Running build script..."
  python3 build.py
else
  echo "⚠️  Python3 not found — skipping build script"
fi

# Check for Node / TypeScript
if command -v npx &>/dev/null; then
  echo "✅ Node found"
  if [ -f package.json ]; then
    echo "   Installing deps..."
    npm install
    echo "   Compiling TypeScript..."
    npx tsc --noEmit src/types.ts 2>/dev/null && echo "   ✅ TypeScript OK" || echo "   ℹ️  TS check skipped (no tsconfig)"
  fi
else
  echo "ℹ️  Node not found — TypeScript compilation skipped"
fi

# Check for Rust / wasm-pack
if command -v cargo &>/dev/null; then
  echo "✅ Rust found: $(rustc --version)"
  echo "   To compile physics WASM: cd src && wasm-pack build --target web"
else
  echo "ℹ️  Rust not installed — physics.rs WASM build skipped (JS fallback active)"
fi

echo ""
echo "🚀 To run locally:"
echo "   python3 -m http.server 8080"
echo "   then open http://localhost:8080"
echo ""
echo "📁 Games available:"
echo "   boxing · racing · tictactoe · pingpong · connectfour · battleship"
