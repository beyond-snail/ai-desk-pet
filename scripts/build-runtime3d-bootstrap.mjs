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

const perf = spawnSync(
  process.execPath,
  ['scripts/runtime3d-performance-smoke.mjs', '--report', 'dist/runtime3d-bootstrap/performance-report.json'],
  {
    stdio: 'inherit'
  }
);

if (perf.status !== 0) {
  process.exit(perf.status ?? 1);
}

writeFileSync(
  resolve(outputDir, 'manifest.json'),
  JSON.stringify(
    {
      runtime: 'runtime3d-bootstrap',
      schema_version: 'v1',
      generated_at: new Date().toISOString(),
      stage: 'G-foundation',
      includes: [
        'runtime/godot executable bootstrap',
        'runtime/qt-sidecar executable bootstrap',
        'ipc schema v1 smoke handshake',
        'default robot motion logic smoke',
        'interaction + chat + voice minimal loop smoke',
        'legacy->runtime3d migration smoke',
        'performance smoke report',
        'candidate package artifact'
      ],
      notes: 'Bootstrap artifact placeholder. Replace with real Godot + Qt sidecar package in stage F2.'
    },
    null,
    2
  )
);

const packaging = spawnSync(process.execPath, ['scripts/package-runtime3d-candidate.mjs'], {
  stdio: 'inherit'
});

if (packaging.status !== 0) {
  process.exit(packaging.status ?? 1);
}

console.log('runtime3d build bootstrap ready');
console.log('artifact: dist/runtime3d-bootstrap/manifest.json');
console.log(`artifact: dist/runtime3d-bootstrap/runtime3d-candidate-${process.platform}.tar.gz`);
console.log('next steps: replace Node bootstrap stubs with native Godot + Qt binaries');
