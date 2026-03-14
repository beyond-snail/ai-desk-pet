import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const base = resolve('src/renderer/characters/rainbow-bot/assets');
const required = [
  'idle-1.svg',
  'idle-2.svg',
  'walk-1.svg',
  'walk-2.svg',
  'happy-1.svg',
  'happy-2.svg',
  'talking-1.svg',
  'talking-2.svg',
  'sleepy-1.svg',
  'confused-1.svg',
  'dizzy-1.svg',
  'sad-1.svg'
];

for (const file of required) {
  const full = resolve(base, file);
  if (!existsSync(full)) {
    throw new Error(`missing rainbow-bot svg asset: ${file}`);
  }
  const text = readFileSync(full, 'utf8');
  if (!text.includes('<svg')) {
    throw new Error(`invalid svg content: ${file}`);
  }
}

console.log('rainbow-bot 3d proxy assets smoke ok');
