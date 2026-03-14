#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

TARGET_ROOT="${1:-dist/runtime3d-release}"
APP_NAME="AIDeskPet"
MOUNT_POINT_BASE="/tmp/aideskpet-runtime3d-dmg"
EXIT_CODE=0

if [[ "${OSTYPE:-}" != darwin* ]]; then
  echo "[smoke-runtime3d-dmg] skip: macOS only"
  exit 0
fi

DMGS=()
while IFS= read -r line; do
  DMGS+=("$line")
done < <(find "$TARGET_ROOT" -maxdepth 3 -type f -name '*.dmg' | sort)

if [[ "${#DMGS[@]}" -eq 0 ]]; then
  echo "[smoke-runtime3d-dmg] no dmg found under $TARGET_ROOT" >&2
  exit 1
fi

cleanup_mount() {
  local mount_point="$1"
  local canonical_mount="$mount_point"
  if [[ -d "$mount_point" ]]; then
    canonical_mount="$(cd "$mount_point" && pwd -P)"
  fi

  hdiutil detach "$mount_point" >/dev/null 2>&1 || true
  hdiutil detach "$canonical_mount" >/dev/null 2>&1 || true
  hdiutil detach -force "$mount_point" >/dev/null 2>&1 || true
  hdiutil detach -force "$canonical_mount" >/dev/null 2>&1 || true
  rm -rf "$mount_point" "$canonical_mount" >/dev/null 2>&1 || true
}

for dmg in "${DMGS[@]}"; do
  mount_point="$(mktemp -d "${MOUNT_POINT_BASE}.XXXXXX")"
  echo "[smoke-runtime3d-dmg] attach: $dmg"
  if ! hdiutil attach "$dmg" -nobrowse -quiet -mountpoint "$mount_point"; then
    echo "[smoke-runtime3d-dmg] attach failed: $dmg" >&2
    cleanup_mount "$mount_point"
    EXIT_CODE=1
    continue
  fi

  app_path="$(find "$mount_point" -maxdepth 2 -type d -name '*.app' | head -n 1)"
  if [[ -z "$app_path" ]]; then
    echo "[smoke-runtime3d-dmg] app bundle not found in mounted dmg: $dmg" >&2
    cleanup_mount "$mount_point"
    EXIT_CODE=1
    continue
  fi

  app_exec="$app_path/Contents/MacOS/$APP_NAME"
  if [[ ! -x "$app_exec" ]]; then
    echo "[smoke-runtime3d-dmg] missing executable: $app_exec" >&2
    cleanup_mount "$mount_point"
    EXIT_CODE=1
    continue
  fi

  log_file="$(mktemp "/tmp/aideskpet-runtime3d-smoke-log.XXXXXX")"
  echo "[smoke-runtime3d-dmg] launch: $app_exec"
  env -u ELECTRON_RUN_AS_NODE -u ELECTRON_FORCE_IS_PACKAGED \
    AIDESKPET_RUNTIME3D_SMOKE=1 "$app_exec" >"$log_file" 2>&1 &
  app_pid=$!
  sleep 6

  if ! kill -0 "$app_pid" >/dev/null 2>&1; then
    echo "[smoke-runtime3d-dmg] process exited too early: $APP_NAME" >&2
    tail -n 80 "$log_file" >&2 || true
    rm -f "$log_file"
    cleanup_mount "$mount_point"
    EXIT_CODE=1
    continue
  fi

  kill "$app_pid" >/dev/null 2>&1 || true
  wait "$app_pid" >/dev/null 2>&1 || true
  rm -f "$log_file"

  cleanup_mount "$mount_point"
  echo "[smoke-runtime3d-dmg] ok: $dmg"
done

if [[ "$EXIT_CODE" -ne 0 ]]; then
  echo "[smoke-runtime3d-dmg] failed" >&2
  exit "$EXIT_CODE"
fi

echo "[smoke-runtime3d-dmg] all dmg passed"
