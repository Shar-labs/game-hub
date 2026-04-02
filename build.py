#!/usr/bin/env python3
"""
build.py — Game Hub build script
Validates HTML files, generates a file manifest (manifest.json),
and reports total asset sizes. Run with: python3 build.py
"""

import os
import json
import hashlib
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).parent

GAME_DIRS = [
    "games/boxing",
    "games/racing",
    "games/tictactoe",
    "games/pingpong",
    "games/connectfour",
    "games/battleship",
]

def file_hash(path: Path) -> str:
    h = hashlib.md5(path.read_bytes()).hexdigest()[:8]
    return h

def scan_assets() -> list[dict]:
    assets = []
    for pattern in ["**/*.html", "**/*.css", "**/*.js", "**/*.ts", "**/*.json"]:
        for f in ROOT.glob(pattern):
            if ".git" in f.parts:
                continue
            rel = f.relative_to(ROOT)
            size = f.stat().st_size
            assets.append({
                "path": str(rel),
                "size": size,
                "hash": file_hash(f),
            })
    return sorted(assets, key=lambda x: x["path"])

def validate_html(path: Path) -> list[str]:
    """Basic HTML validation — checks for required tags."""
    warnings = []
    text = path.read_text(encoding="utf-8")
    for tag in ["<!DOCTYPE html>", "<html", "<head>", "<body"]:
        if tag.lower() not in text.lower():
            warnings.append(f"Missing {tag}")
    if "<title>" not in text:
        warnings.append("Missing <title>")
    return warnings

def main():
    print("=" * 50)
    print("  GAME HUB BUILD SCRIPT")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)

    all_ok = True

    # Validate HTML files
    print("\n📋 HTML Validation:")
    for html_file in sorted(ROOT.glob("**/*.html")):
        if ".git" in html_file.parts:
            continue
        warns = validate_html(html_file)
        rel = html_file.relative_to(ROOT)
        if warns:
            print(f"  ⚠️  {rel}: {', '.join(warns)}")
            all_ok = False
        else:
            print(f"  ✅ {rel}")

    # Scan all assets
    assets = scan_assets()
    total_size = sum(a["size"] for a in assets)

    print(f"\n📦 Assets: {len(assets)} files  ({total_size / 1024:.1f} KB total)")

    # Write manifest
    manifest = {
        "built_at": datetime.now().isoformat(),
        "total_files": len(assets),
        "total_size_bytes": total_size,
        "games": GAME_DIRS,
        "assets": assets,
    }
    manifest_path = ROOT / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))
    print(f"\n✅ Manifest written → manifest.json")

    print(f"\n{'✅ Build OK' if all_ok else '⚠️  Build completed with warnings'}")
    print("=" * 50)

if __name__ == "__main__":
    main()
