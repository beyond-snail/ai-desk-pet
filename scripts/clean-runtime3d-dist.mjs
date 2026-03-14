import { existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const distRoot = resolve('dist');
const releaseRoot = resolve(distRoot, 'runtime3d-release');

const staleDistEntries = [
  '.DS_Store',
  'AIDeskPet-1.0.0-x64.dmg',
  'AIDeskPet-1.0.0-x64.dmg.blockmap',
  'latest-mac.yml',
  'builder-debug.yml',
  'builder-effective-config.yaml',
  'mac',
  'runtime3d-bootstrap'
];

if (!existsSync(distRoot)) {
  console.log('dist cleanup skipped: dist directory not found');
  process.exit(0);
}

for (const entry of staleDistEntries) {
  rmSync(resolve(distRoot, entry), { recursive: true, force: true });
}

if (existsSync(releaseRoot)) {
  for (const entry of readdirSync(releaseRoot)) {
    if (entry === '.DS_Store' || entry === 'bundle') {
      rmSync(resolve(releaseRoot, entry), { recursive: true, force: true });
    }
  }
}

console.log('dist cleanup completed: stale release artifacts removed');
