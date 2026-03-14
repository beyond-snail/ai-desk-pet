#!/usr/bin/env bash
set -euo pipefail

node scripts/smoke-rainbow-3d-proxy.mjs
node scripts/smoke-all-roles-3d-proxy.mjs
node scripts/smoke-runtime3d-parity-domains.mjs
echo "[smoke-runtime3d] ok"
