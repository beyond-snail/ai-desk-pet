import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const baseDir = 'src/renderer/characters';
const characterDirs = readdirSync(baseDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(baseDir, entry.name));

for (const dir of characterDirs) {
  const config = JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8'));
  if (!config.id || !config.name) {
    throw new Error(`Invalid character config in ${dir}`);
  }
  if (!config.dimensions || !config.animations || !config.moveParts) {
    throw new Error(`Missing required fields in ${dir}/config.json`);
  }
}

console.log('character configs ok');
