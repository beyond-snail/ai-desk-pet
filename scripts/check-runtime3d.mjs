import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const requiredDirs = [
  'runtime/godot',
  'runtime/qt-sidecar',
  'runtime/shared-ipc',
  'runtime/migration',
  'docs/adr'
];

const requiredFiles = [
  'runtime/godot/README.md',
  'runtime/qt-sidecar/README.md',
  'runtime/shared-ipc/README.md',
  'runtime/shared-ipc/schema-v1.json',
  'runtime/shared-ipc/protocol.mjs',
  'runtime/shared-ipc/line-codec.mjs',
  'runtime/godot/main.mjs',
  'runtime/godot/window-controller.mjs',
  'runtime/qt-sidecar/main.mjs',
  'runtime/qt-sidecar/system-controller.mjs',
  'runtime/migration/README.md',
  'runtime/migration/keys-map.json',
  'scripts/runtime3d-ipc-smoke.mjs',
  'docs/adr/0001-runtime3d-topology.md',
  'docs/adr/0002-ipc-versioning.md',
  'docs/adr/0003-data-migration-strategy.md',
  'docs/3d-runtime-baseline-2026-03-13.md',
  'docs/runtime3d-stage-b-report-2026-03-13.md'
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
  const smoke = spawnSync(process.execPath, ['scripts/runtime3d-ipc-smoke.mjs'], {
    stdio: 'inherit'
  });
  if (smoke.status !== 0) {
    hasError = true;
    console.error('runtime3d ipc smoke failed');
  }
}

if (hasError) {
  process.exit(1);
}

console.log('runtime3d scaffold + ipc smoke ok');
