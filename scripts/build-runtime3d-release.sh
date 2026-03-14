#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ "${OSTYPE:-}" != darwin* ]]; then
  echo "runtime3d release build currently supports macOS only" >&2
  exit 1
fi

if [[ ! -x "./node_modules/.bin/electron-builder" ]]; then
  echo "missing local electron-builder, run dependency install first" >&2
  exit 1
fi

APP_NAME="AIDeskPet"
VERSION="$(node -p "require('./package.json').version")"
TMP_BASE="dist/runtime3d-tmp"
OUT_BASE="dist/runtime3d-release"
ELECTRON_DIST="$ROOT_DIR/node_modules/electron/dist"
HOST_ARCH="$(uname -m)"
if [[ -n "${RUNTIME3D_ARCHES:-}" ]]; then
  read -r -a ARCHES <<<"${RUNTIME3D_ARCHES}"
elif [[ "$HOST_ARCH" == "arm64" ]]; then
  ARCHES=("arm64")
else
  ARCHES=("x64")
fi

if [[ ! -d "$ELECTRON_DIST" ]]; then
  echo "missing electron distribution under $ELECTRON_DIST" >&2
  exit 1
fi

./scripts/check-runtime3d.sh

echo "[build-runtime3d-release] clean output"
rm -rf "$TMP_BASE" "$OUT_BASE"
mkdir -p "$OUT_BASE"
echo "[build-runtime3d-release] arches: ${ARCHES[*]}"

for arch in "${ARCHES[@]}"; do
  if [[ "$arch" != "x64" && "$arch" != "arm64" ]]; then
    echo "unsupported arch in RUNTIME3D_ARCHES: $arch" >&2
    exit 1
  fi

  TMP_DIR="$TMP_BASE/$arch"
  mkdir -p "$TMP_DIR"

  echo "[build-runtime3d-release] building mac dmg for $arch"
  ./node_modules/.bin/electron-builder --mac dmg "--$arch" "-c.directories.output=$TMP_DIR" "-c.electronDist=$ELECTRON_DIST"

  DMG_PATH="$(find "$TMP_DIR" -maxdepth 2 -type f -name '*.dmg' | head -n 1)"
  if [[ -z "$DMG_PATH" ]]; then
    echo "build failed: no dmg found for $arch" >&2
    exit 1
  fi

  TARGET_DIR="$OUT_BASE/darwin-$arch"
  TARGET_NAME="${APP_NAME}-runtime3d-darwin-${arch}-v${VERSION}.dmg"
  mkdir -p "$TARGET_DIR"
  mv "$DMG_PATH" "$TARGET_DIR/$TARGET_NAME"
done

rm -rf "$TMP_BASE"

echo "[build-runtime3d-release] run dmg smoke"
./scripts/smoke-runtime3d-dmg.sh "$OUT_BASE"

echo "[build-runtime3d-release] done"
find "$OUT_BASE" -maxdepth 3 -type f -name '*.dmg' -print
