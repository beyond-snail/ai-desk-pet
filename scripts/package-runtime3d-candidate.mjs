import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const outputDir = resolve('dist/runtime3d-bootstrap');
const stageDir = resolve(outputDir, 'runtime3d-candidate');
const archiveName = `runtime3d-candidate-${process.platform}.tar.gz`;
const archivePath = resolve(outputDir, archiveName);

rmSync(stageDir, { recursive: true, force: true });
mkdirSync(stageDir, { recursive: true });

const includeFiles = [
  'README.md',
  'package.json',
  'runtime',
  'scripts',
  'docs/3d-runtime-migration-spec.md',
  'docs/3d-runtime-migration-tasks-for-codex.md',
  'docs/runtime3d-stage-b-report-2026-03-13.md',
  'docs/runtime3d-stage-c-motion-foundation-2026-03-13.md',
  'docs/runtime3d-stage-d-interaction-foundation-2026-03-13.md',
  'docs/runtime3d-stage-e-migration-foundation-2026-03-13.md',
  'docs/runtime3d-stage-f-performance-build-foundation-2026-03-13.md',
  'docs/runtime3d-stage-g-backfill-foundation-2026-03-13.md',
  'docs/runtime3d-final-dod-status-2026-03-13.md',
  'dist/runtime3d-bootstrap/manifest.json',
  'dist/runtime3d-bootstrap/performance-report.json'
];

for (const entry of includeFiles) {
  if (!existsSync(entry)) {
    continue;
  }
  const target = resolve(stageDir, entry);
  mkdirSync(resolve(target, '..'), { recursive: true });
  cpSync(resolve(entry), target, { recursive: true });
}

writeFileSync(
  resolve(stageDir, 'candidate-metadata.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      platform: process.platform,
      branch: process.env.GITHUB_REF_NAME || 'local',
      includes: includeFiles
    },
    null,
    2
  )
);

const tar = spawnSync('tar', ['-czf', archivePath, 'runtime3d-candidate'], {
  cwd: outputDir,
  stdio: 'inherit'
});

if (tar.status !== 0) {
  process.exit(tar.status ?? 1);
}

console.log(`runtime3d candidate package created: ${archivePath}`);
