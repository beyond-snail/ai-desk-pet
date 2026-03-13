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
      notes: 'Bootstrap artifact placeholder. Replace with real Godot + Qt sidecar package in stage F2.'
    },
    null,
    2
  )
);

console.log('runtime3d build bootstrap ready');
console.log('artifact: dist/runtime3d-bootstrap/manifest.json');
console.log('next steps: replace this bootstrap with real godot + qt-sidecar build pipeline');
