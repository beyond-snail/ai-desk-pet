#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ "${OSTYPE:-}" != darwin* ]]; then
  echo "[perf-runtime3d] macOS only" >&2
  exit 1
fi

APP_NAME="AIDeskPet"
TARGET_DMG="${1:-}"
DURATION_SECONDS="${RUNTIME3D_PERF_DURATION_SECONDS:-1800}"
IDLE_SECONDS="${RUNTIME3D_PERF_IDLE_SECONDS:-600}"
ACTIVE_SECONDS="${RUNTIME3D_PERF_ACTIVE_SECONDS:-600}"
SAMPLE_SECONDS="${RUNTIME3D_PERF_SAMPLE_SECONDS:-5}"
STARTUP_STAGE="${RUNTIME3D_STARTUP_STAGE:-app-ready}"

THRESHOLD_PACKAGE_MB="${RUNTIME3D_THRESHOLD_PACKAGE_MB:-140}"
THRESHOLD_IDLE_CPU="${RUNTIME3D_THRESHOLD_IDLE_CPU:-6}"
THRESHOLD_ACTIVE_CPU="${RUNTIME3D_THRESHOLD_ACTIVE_CPU:-12}"
THRESHOLD_MEMORY_MB="${RUNTIME3D_THRESHOLD_MEMORY_MB:-160}"
THRESHOLD_MEMORY_GROWTH_MB="${RUNTIME3D_THRESHOLD_MEMORY_GROWTH_MB:-60}"
THRESHOLD_STARTUP_MS="${RUNTIME3D_THRESHOLD_STARTUP_MS:-4000}"

if [[ -z "$TARGET_DMG" ]]; then
  TARGET_DMG="$(find dist/runtime3d-release -maxdepth 3 -type f -name "${APP_NAME}-runtime3d-darwin-*.dmg" | sort | head -n 1)"
fi

if [[ -z "$TARGET_DMG" || ! -f "$TARGET_DMG" ]]; then
  echo "[perf-runtime3d] dmg not found" >&2
  exit 1
fi

NOW_TAG="$(date +%Y%m%d-%H%M%S)"
REPORT_DIR="dist/runtime3d-release/perf-report-${NOW_TAG}"
PERF_SIGNAL_FILE="$REPORT_DIR/perf-signals.jsonl"
SAMPLE_FILE="$REPORT_DIR/perf-samples.csv"
SUMMARY_FILE="$REPORT_DIR/perf-summary.json"
APP_STDOUT_FILE="$REPORT_DIR/perf-app.log"
MOUNT_POINT=""
APP_PID=""
LAUNCHER_PID=""
BASELINE_PIDS=""

mkdir -p "$REPORT_DIR"

cleanup() {
  if [[ -n "$LAUNCHER_PID" ]]; then
    stop_process "$LAUNCHER_PID"
  fi

  if [[ -n "$APP_PID" ]]; then
    stop_process "$APP_PID"
  fi
  kill_new_app_processes

  if [[ -n "$MOUNT_POINT" ]]; then
    canonical="$MOUNT_POINT"
    if [[ -d "$MOUNT_POINT" ]]; then
      canonical="$(cd "$MOUNT_POINT" && pwd -P)"
    fi
    hdiutil detach "$MOUNT_POINT" >/dev/null 2>&1 || true
    hdiutil detach "$canonical" >/dev/null 2>&1 || true
    hdiutil detach -force "$MOUNT_POINT" >/dev/null 2>&1 || true
    hdiutil detach -force "$canonical" >/dev/null 2>&1 || true
    rm -rf "$MOUNT_POINT" "$canonical" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

PACKAGE_MB="$(du -m "$TARGET_DMG" | awk '{print $1}')"
echo "[perf-runtime3d] target dmg: $TARGET_DMG (${PACKAGE_MB}MB)"
echo "[perf-runtime3d] report dir: $REPORT_DIR"

MOUNT_POINT="$(mktemp -d /tmp/aideskpet-runtime3d-perf-mount.XXXXXX)"
hdiutil attach "$TARGET_DMG" -nobrowse -quiet -mountpoint "$MOUNT_POINT"
APP_PATH="$(find "$MOUNT_POINT" -maxdepth 2 -type d -name '*.app' | head -n 1)"
if [[ -z "$APP_PATH" ]]; then
  echo "[perf-runtime3d] app bundle not found in dmg" >&2
  exit 1
fi

APP_EXEC="$APP_PATH/Contents/MacOS/$APP_NAME"
if [[ ! -x "$APP_EXEC" ]]; then
  echo "[perf-runtime3d] app executable missing: $APP_EXEC" >&2
  exit 1
fi

resolve_app_pid() {
  local pid
  while IFS= read -r pid; do
    if [[ -n "$pid" && " $BASELINE_PIDS " != *" $pid "* ]]; then
      echo "$pid"
    fi
  done < <(pgrep -x "$APP_NAME" || true)
  return 0
}

kill_new_app_processes() {
  local pid
  while IFS= read -r pid; do
    if [[ -n "$pid" && " $BASELINE_PIDS " != *" $pid "* ]]; then
      kill "$pid" >/dev/null 2>&1 || true
      sleep 0.2
      if kill -0 "$pid" >/dev/null 2>&1; then
        kill -9 "$pid" >/dev/null 2>&1 || true
      fi
    fi
  done < <(pgrep -x "$APP_NAME" || true)
}

stop_process() {
  local pid="$1"
  if [[ -z "$pid" ]]; then
    return
  fi

  if kill -0 "$pid" >/dev/null 2>&1; then
    kill "$pid" >/dev/null 2>&1 || true
  fi

  local i
  for i in $(seq 1 25); do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      return
    fi
    sleep 0.2
  done

  kill -9 "$pid" >/dev/null 2>&1 || true
}

BASELINE_PIDS=" $( (pgrep -x "$APP_NAME" 2>/dev/null || true) | tr '\n' ' ' ) "
LAUNCH_AT_MS="$(node -e 'console.log(Date.now())')"
env -u ELECTRON_RUN_AS_NODE -u ELECTRON_FORCE_IS_PACKAGED \
  AIDESKPET_RUNTIME3D_SMOKE=1 \
  AIDESKPET_RUNTIME3D_PERF=1 \
  AIDESKPET_RUNTIME3D_PERF_REPORT="$PERF_SIGNAL_FILE" \
  "$APP_EXEC" >"$APP_STDOUT_FILE" 2>&1 &
LAUNCHER_PID=$!

READY_FOUND=0
for _ in $(seq 1 200); do
  if [[ -f "$PERF_SIGNAL_FILE" ]] && grep -q '"stage":"interactive-ready"' "$PERF_SIGNAL_FILE"; then
    READY_FOUND=1
    break
  fi
  sleep 0.2
done

if [[ "$READY_FOUND" -ne 1 ]]; then
  echo "[perf-runtime3d] interactive-ready signal timeout" >&2
  tail -n 80 "$APP_STDOUT_FILE" >&2 || true
  exit 1
fi

STARTUP_SIGNAL_AT_MS="$(node -e "
const fs = require('fs');
const file = process.argv[1];
const stage = process.argv[2];
const lines = fs.readFileSync(file, 'utf8').split(/\n+/).filter(Boolean);
for (const line of lines) {
  try {
    const row = JSON.parse(line);
    if (row.stage === stage && Number.isFinite(row.at)) {
      console.log(row.at);
      process.exit(0);
    }
  } catch {}
}
process.exit(1);
" "$PERF_SIGNAL_FILE" "$STARTUP_STAGE" || true)"

if [[ -z "$STARTUP_SIGNAL_AT_MS" ]]; then
  STARTUP_STAGE="interactive-ready"
  STARTUP_SIGNAL_AT_MS="$(node -e "
const fs = require('fs');
const file = process.argv[1];
const lines = fs.readFileSync(file, 'utf8').split(/\\n+/).filter(Boolean);
for (const line of lines) {
  try {
    const row = JSON.parse(line);
    if (row.stage === 'interactive-ready' && Number.isFinite(row.at)) {
      console.log(row.at);
      process.exit(0);
    }
  } catch {}
}
process.exit(1);
" "$PERF_SIGNAL_FILE")"
fi

STARTUP_MS="$((STARTUP_SIGNAL_AT_MS - LAUNCH_AT_MS))"
echo "[perf-runtime3d] startup (${STARTUP_STAGE}): ${STARTUP_MS}ms"

APP_PID="$(resolve_app_pid)"
if [[ -z "$APP_PID" ]]; then
  echo "[perf-runtime3d] unable to resolve app pid after startup" >&2
  tail -n 80 "$APP_STDOUT_FILE" >&2 || true
  exit 1
fi

echo "elapsed_s,cpu_percent,rss_mb" >"$SAMPLE_FILE"
elapsed=0
while (( elapsed <= DURATION_SECONDS )); do
  current_pid="$(resolve_app_pid)"
  if [[ -z "$current_pid" ]]; then
    echo "[perf-runtime3d] app exited during sampling at ${elapsed}s" >&2
    tail -n 80 "$APP_STDOUT_FILE" >&2 || true
    exit 1
  fi
  if [[ "$current_pid" != "$APP_PID" ]]; then
    APP_PID="$current_pid"
    echo "[perf-runtime3d] switched app pid: $APP_PID"
  fi

  metrics="$(ps -p "$APP_PID" -o %cpu=,rss= | awk 'NR==1 {gsub(/^ +| +$/, "", $1); gsub(/^ +| +$/, "", $2); print $1","$2}')"
  cpu="$(echo "$metrics" | cut -d',' -f1)"
  rss_kb="$(echo "$metrics" | cut -d',' -f2)"
  rss_mb="$(awk -v kb="$rss_kb" 'BEGIN { printf "%.2f", (kb + 0) / 1024 }')"
  echo "${elapsed},${cpu},${rss_mb}" >>"$SAMPLE_FILE"

  if (( elapsed % 60 == 0 )); then
    echo "[perf-runtime3d] t=${elapsed}s cpu=${cpu}% rss=${rss_mb}MB"
  fi

  if (( elapsed == DURATION_SECONDS )); then
    break
  fi
  sleep "$SAMPLE_SECONDS"
  elapsed=$((elapsed + SAMPLE_SECONDS))
done

stop_process "$APP_PID"
APP_PID=""

node -e "
const fs = require('fs');
const csv = fs.readFileSync(process.argv[1], 'utf8').trim().split(/\n+/).slice(1);
const startupMs = Number(process.argv[2]);
const packageMb = Number(process.argv[3]);
const idleCut = Number(process.argv[4]);
const activeCut = Number(process.argv[5]);
const startupStage = String(process.argv[13] || 'unknown');
const thresholdPackage = Number(process.argv[6]);
const thresholdIdleCpu = Number(process.argv[7]);
const thresholdActiveCpu = Number(process.argv[8]);
const thresholdMemory = Number(process.argv[9]);
const thresholdGrowth = Number(process.argv[10]);
const thresholdStartup = Number(process.argv[11]);

const rows = csv.map((line) => {
  const [elapsed, cpu, rss] = line.split(',');
  return { elapsed: Number(elapsed), cpu: Number(cpu), rss: Number(rss) };
}).filter((row) => Number.isFinite(row.elapsed) && Number.isFinite(row.cpu) && Number.isFinite(row.rss));

if (rows.length < 2) {
  throw new Error('not enough perf samples');
}

const idleRows = rows.filter((row) => row.elapsed < idleCut);
const activeRows = rows.filter((row) => row.elapsed >= idleCut && row.elapsed < activeCut);

const avg = (arr, key) => arr.length ? arr.reduce((sum, row) => sum + row[key], 0) / arr.length : 0;
const rssValues = rows.map((row) => row.rss);
const memoryMax = Math.max(...rssValues);
const memoryGrowth = rows[rows.length - 1].rss - rows[0].rss;
const idleCpuAvg = avg(idleRows, 'cpu');
const activeCpuAvg = avg(activeRows, 'cpu');

const checks = {
  packageMb: packageMb <= thresholdPackage,
  startupMs: startupMs <= thresholdStartup,
  idleCpuAvg: idleCpuAvg <= thresholdIdleCpu,
  activeCpuAvg: activeCpuAvg <= thresholdActiveCpu,
  memoryMax: memoryMax <= thresholdMemory,
  memoryGrowth: memoryGrowth <= thresholdGrowth
};
const passed = Object.values(checks).every(Boolean);

const summary = {
  passed,
  metrics: {
    packageMb,
    startupStage,
    startupMs,
    idleCpuAvg: Number(idleCpuAvg.toFixed(2)),
    activeCpuAvg: Number(activeCpuAvg.toFixed(2)),
    memoryMaxMb: Number(memoryMax.toFixed(2)),
    memoryGrowthMb: Number(memoryGrowth.toFixed(2))
  },
  thresholds: {
    packageMb: thresholdPackage,
    startupMs: thresholdStartup,
    idleCpuAvg: thresholdIdleCpu,
    activeCpuAvg: thresholdActiveCpu,
    memoryMaxMb: thresholdMemory,
    memoryGrowthMb: thresholdGrowth
  },
  checks
};

fs.writeFileSync(process.argv[12], JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
process.exit(passed ? 0 : 1);
" "$SAMPLE_FILE" "$STARTUP_MS" "$PACKAGE_MB" "$IDLE_SECONDS" "$((IDLE_SECONDS + ACTIVE_SECONDS))" \
  "$THRESHOLD_PACKAGE_MB" "$THRESHOLD_IDLE_CPU" "$THRESHOLD_ACTIVE_CPU" "$THRESHOLD_MEMORY_MB" \
  "$THRESHOLD_MEMORY_GROWTH_MB" "$THRESHOLD_STARTUP_MS" "$SUMMARY_FILE" "$STARTUP_STAGE"

echo "[perf-runtime3d] summary: $SUMMARY_FILE"
