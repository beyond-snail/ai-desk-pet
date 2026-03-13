import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const check = spawnSync(process.execPath, ['scripts/check-runtime3d.mjs'], {
  stdio: 'inherit'
});

if (check.status !== 0) {
  process.exit(check.status ?? 1);
}

const outputDir = resolve('dist/runtime3d-bootstrap');
mkdirSync(outputDir, { recursive: true });
writeFileSync(
  resolve(outputDir, 'manifest.json'),
  JSON.stringify(
    {
      runtime: 'runtime3d-bootstrap',
      schema_version: 'v1',
      generated_at: new Date().toISOString(),
      stage: 'E-foundation',
      includes: [
        'runtime/godot executable bootstrap',
        'runtime/qt-sidecar executable bootstrap',
        'ipc schema v1 smoke handshake',
        'default robot motion logic smoke',
        'interaction + chat + voice minimal loop smoke',
        'legacy->runtime3d migration smoke'
      ],
      notes: 'Bootstrap artifact placeholder. Replace with real Godot + Qt sidecar package in stage F2.'
    },
    null,
    2
  )
);

console.log('runtime3d build bootstrap ready');
console.log('artifact: dist/runtime3d-bootstrap/manifest.json');
console.log('next steps: replace bootstrap artifact with installable runtime3d package in stage F2');
