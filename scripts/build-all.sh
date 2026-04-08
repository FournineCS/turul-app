#!/usr/bin/env bash
# Build Electron app for all 4 targets from macOS ARM64
# Outputs: .dmg (macOS), .deb (Linux)
# Requires: Node.js 22+, Docker (for Linux builds)
set -euo pipefail

export NODE_OPTIONS='--max-old-space-size=8192'
export CSC_IDENTITY_AUTO_DISCOVERY=false

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[build]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC}  $*"; }
fail() { echo -e "${RED}[error]${NC} $*"; exit 1; }

# Parse flags
TARGETS=("mac-arm64" "mac-x64" "linux-x64" "linux-arm64")
if [ $# -gt 0 ]; then
  TARGETS=("$@")
fi

# Check Docker is running (needed for Linux builds)
needs_docker=false
for t in "${TARGETS[@]}"; do
  [[ "$t" == linux-* ]] && needs_docker=true
done

if $needs_docker; then
  docker info &>/dev/null || fail "Docker is not running. Start Docker Desktop and retry."
fi

# Clean previous release artifacts
log "Cleaning release/ directory..."
rm -rf release/

# Step 1: Build Vite + Electron TypeScript once
log "Building (Vite + tsc)..."
npm run build

# Step 2: Package each target
for target in "${TARGETS[@]}"; do
  case "$target" in
    mac-arm64)
      log "Packaging macOS arm64 (.dmg)..."
      npx electron-builder --mac dmg --arm64 --publish never
      ;;
    mac-x64)
      log "Packaging macOS x64 (.dmg)..."
      npx electron-builder --mac dmg --x64 --publish never
      ;;
    linux-x64)
      log "Packaging Linux x64 (.deb)..."
      npx electron-builder --linux deb --x64 --publish never
      ;;
    linux-arm64)
      log "Packaging Linux arm64 (.deb)..."
      npx electron-builder --linux deb --arm64 --publish never
      ;;
    *)
      warn "Unknown target '$target' — skipping. Valid: mac-arm64 mac-x64 linux-x64 linux-arm64"
      ;;
  esac
done

# Summary
echo ""
log "Build complete. Artifacts:"
find release -maxdepth 2 \( -name "*.dmg" -o -name "*.deb" \) | sort | while read -r f; do
  size=$(du -sh "$f" | cut -f1)
  echo "  ${size}  $f"
done
