#!/usr/bin/env bash
set -euo pipefail

echo "[check-runtime3d] syntax"
node scripts/check-syntax.mjs

echo "[check-runtime3d] character config"
node scripts/verify-character-configs.mjs

echo "[check-runtime3d] smoke"
./scripts/smoke-runtime3d.sh

echo "[check-runtime3d] ok"
