#!/usr/bin/env bash
set -euo pipefail

if [[ ! -x "./node_modules/.bin/electron-builder" ]]; then
  echo "missing local electron-builder, run dependency install first" >&2
  exit 1
fi

./scripts/check-runtime3d.sh

echo "[build-runtime3d-release] building mac dmg (x64 + arm64)"
./node_modules/.bin/electron-builder --mac dmg --x64 --arm64

echo "[build-runtime3d-release] done"
