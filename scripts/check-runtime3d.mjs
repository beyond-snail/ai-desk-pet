import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const requiredDirs = [
  'runtime/godot',
  'runtime/qt-sidecar',
  'runtime/shared-ipc',
  'runtime/migration',
  'runtime/native-src',
  'docs/adr'
];

const requiredFiles = [
  'runtime/godot/README.md',
  'runtime/qt-sidecar/README.md',
  'runtime/shared-ipc/README.md',
  'runtime/shared-ipc/schema-v1.json',
  'runtime/shared-ipc/protocol.mjs',
  'runtime/shared-ipc/line-codec.mjs',
  'runtime/native/README.md',
  'runtime/native/manifest.json',
  'runtime/native/darwin-arm64/qt-sidecar',
  'runtime/native/darwin-arm64/godot-runtime',
  'runtime/native/darwin-x64/qt-sidecar',
  'runtime/native/darwin-x64/godot-runtime',
  'runtime/native-src/go.mod',
  'runtime/native-src/internal/ipc/ipc.go',
  'runtime/native-src/cmd/qt-sidecar/main.go',
  'runtime/native-src/cmd/godot-runtime/main.go',
  'runtime/godot/main.mjs',
  'runtime/godot/window-controller.mjs',
  'runtime/godot/interaction-controller.mjs',
  'runtime/godot/animation-state-machine.mjs',
  'runtime/godot/roaming-controller.mjs',
  'runtime/godot/default-robot-controller.mjs',
  'runtime/godot/gameplay-system.mjs',
  'runtime/qt-sidecar/main.mjs',
  'runtime/qt-sidecar/system-controller.mjs',
  'runtime/qt-sidecar/chat-service.mjs',
  'runtime/qt-sidecar/voice-service.mjs',
  'runtime/qt-sidecar/persistence-store.mjs',
  'runtime/migration/README.md',
  'runtime/migration/keys-map.json',
  'runtime/migration/migrator.mjs',
  'scripts/runtime3d-ipc-smoke.mjs',
  'scripts/runtime3d-robot-motion-smoke.mjs',
  'scripts/runtime3d-migration-smoke.mjs',
  'scripts/runtime3d-backfill-smoke.mjs',
  'scripts/runtime3d-performance-smoke.mjs',
  'scripts/runtime3d-release-app-smoke.mjs',
  'scripts/runtime3d-native-utils.mjs',
  'scripts/check-runtime3d-native.mjs',
  'scripts/build-runtime3d-native-binaries.mjs',
  'scripts/start-runtime3d-release.mjs',
  'scripts/build-runtime3d-release.mjs',
  'docs/adr/0001-runtime3d-topology.md',
  'docs/adr/0002-ipc-versioning.md',
  'docs/adr/0003-data-migration-strategy.md',
  'docs/3d-runtime-baseline-2026-03-13.md',
  'docs/runtime3d-stage-b-report-2026-03-13.md',
  'docs/runtime3d-stage-c-motion-foundation-2026-03-13.md',
  'docs/runtime3d-stage-d-interaction-foundation-2026-03-13.md',
  'docs/runtime3d-stage-e-migration-foundation-2026-03-13.md',
  'docs/runtime3d-stage-f-performance-build-foundation-2026-03-13.md',
  'docs/runtime3d-stage-g-backfill-foundation-2026-03-13.md',
  'docs/runtime3d-final-dod-status-2026-03-13.md',
  'docs/runtime3d-release-native-switch-2026-03-14.md',
  'docs/runtime3d-platform-installation.md'
];

const requiredEvents = [
  'app.show',
  'app.hide',
  'app.quit',
  'pet.action',
  'pet.voice_wakeup',
  'pet.focus_mode',
  'settings.get',
  'settings.set',
  'chat.request',
  'chat.stream_chunk',
  'chat.done',
  'chat.error',
  'speech.listen.start',
  'speech.listen.stop',
  'speech.tts.speak',
  'system.metrics.push'
];

const requiredMessageFields = ['request_id', 'schema_version', 'timestamp', 'source', 'target'];

let hasError = false;

for (const dir of requiredDirs) {
  if (!existsSync(dir)) {
    hasError = true;
    console.error(`missing required directory: ${dir}`);
  }
}

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    hasError = true;
    console.error(`missing required file: ${file}`);
  }
}

if (!hasError) {
  try {
    const schema = JSON.parse(readFileSync('runtime/shared-ipc/schema-v1.json', 'utf8'));
    const events = Array.isArray(schema.events) ? schema.events : [];
    const requiredFields = Array.isArray(schema.required_fields) ? schema.required_fields : [];
    for (const event of requiredEvents) {
      if (!events.includes(event)) {
        hasError = true;
        console.error(`schema-v1 missing event: ${event}`);
      }
    }
    for (const field of requiredMessageFields) {
      if (!requiredFields.includes(field)) {
        hasError = true;
        console.error(`schema-v1 missing required field: ${field}`);
      }
    }
  } catch (error) {
    hasError = true;
    console.error('invalid runtime/shared-ipc/schema-v1.json');
    console.error(error.message);
  }
}

if (!hasError) {
  const nativeSmoke = spawnSync(process.execPath, ['scripts/check-runtime3d-native.mjs'], {
    stdio: 'inherit'
  });
  if (nativeSmoke.status !== 0) {
    hasError = true;
    console.error('runtime3d native check failed');
  }
}

if (!hasError) {
  const smoke = spawnSync(process.execPath, ['scripts/runtime3d-ipc-smoke.mjs'], {
    stdio: 'inherit'
  });
  if (smoke.status !== 0) {
    hasError = true;
    console.error('runtime3d ipc smoke failed');
  }
}

if (!hasError) {
  const motionSmoke = spawnSync(process.execPath, ['scripts/runtime3d-robot-motion-smoke.mjs'], {
    stdio: 'inherit'
  });
  if (motionSmoke.status !== 0) {
    hasError = true;
    console.error('runtime3d robot motion smoke failed');
  }
}

if (!hasError) {
  const migrationSmoke = spawnSync(process.execPath, ['scripts/runtime3d-migration-smoke.mjs'], {
    stdio: 'inherit'
  });
  if (migrationSmoke.status !== 0) {
    hasError = true;
    console.error('runtime3d migration smoke failed');
  }
}

if (!hasError) {
  const backfillSmoke = spawnSync(process.execPath, ['scripts/runtime3d-backfill-smoke.mjs'], {
    stdio: 'inherit'
  });
  if (backfillSmoke.status !== 0) {
    hasError = true;
    console.error('runtime3d backfill smoke failed');
  }
}

if (!hasError) {
  const perfSmoke = spawnSync(process.execPath, ['scripts/runtime3d-performance-smoke.mjs'], {
    stdio: 'inherit'
  });
  if (perfSmoke.status !== 0) {
    hasError = true;
    console.error('runtime3d performance smoke failed');
  }
}

if (hasError) {
  process.exit(1);
}

console.log('runtime3d scaffold + interaction/motion/migration/backfill/performance smoke ok');
