import { existsSync, readFileSync } from 'node:fs';

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
  'runtime/migration/README.md',
  'runtime/migration/keys-map.json',
  'docs/adr/0001-runtime3d-topology.md',
  'docs/adr/0002-ipc-versioning.md',
  'docs/adr/0003-data-migration-strategy.md',
  'docs/3d-runtime-baseline-2026-03-13.md'
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
    for (const event of requiredEvents) {
      if (!events.includes(event)) {
        hasError = true;
        console.error(`schema-v1 missing event: ${event}`);
      }
    }
  } catch (error) {
    hasError = true;
    console.error('invalid runtime/shared-ipc/schema-v1.json');
    console.error(error.message);
  }
}

if (hasError) {
  process.exit(1);
}

console.log('runtime3d scaffold ok');
