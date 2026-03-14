import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    ...options
  });
}

function parseArg(flag) {
  const argv = process.argv.slice(2);
  const index = argv.indexOf(flag);
  if (index >= 0 && argv[index + 1]) {
    return argv[index + 1];
  }
  return null;
}

const pkgArg = parseArg('--pkg');
if (!pkgArg) {
  console.error('missing --pkg <path>');
  process.exit(1);
}

const pkgPath = resolve(pkgArg);
if (!existsSync(pkgPath)) {
  console.error(`pkg not found: ${pkgPath}`);
  process.exit(1);
}

const payload = run('pkgutil', ['--payload-files', pkgPath], {
  maxBuffer: 1024 * 1024 * 8
});
if (payload.status !== 0) {
  process.stderr.write(payload.stderr || '');
  process.exit(payload.status ?? 1);
}

const output = String(payload.stdout || '');
const requiredEntries = [
  './Applications/AIDeskPet.app',
  './Applications/AIDeskPet.app/Contents/MacOS/AIDeskPet',
  './Applications/AIDeskPet.app/Contents/Resources/runtime'
];

for (const entry of requiredEntries) {
  if (!output.includes(entry)) {
    console.error(`pkg smoke failed: missing payload entry: ${entry}`);
    process.exit(1);
  }
}

console.log('runtime3d release pkg smoke ok');
