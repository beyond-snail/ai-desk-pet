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

const dmgArg = parseArg('--dmg');
if (!dmgArg) {
  console.error('missing --dmg <path>');
  process.exit(1);
}

const dmgPath = resolve(dmgArg);
if (!existsSync(dmgPath)) {
  console.error(`dmg not found: ${dmgPath}`);
  process.exit(1);
}

const attach = run('hdiutil', ['attach', '-nobrowse', dmgPath]);
if (attach.status !== 0) {
  process.stderr.write(attach.stderr || '');
  process.exit(attach.status ?? 1);
}

const lines = String(attach.stdout || '').split('\n');
const mountLine = lines.find((line) => line.includes('/Volumes/'));
if (!mountLine) {
  console.error('failed to parse mounted dmg info');
  process.exit(1);
}

const mountPoint = mountLine.split('\t').pop().trim().replace(/\s+\d+$/, '');
const appExec = `${mountPoint}/AIDeskPet.app/Contents/MacOS/AIDeskPet`;

const smoke = run(appExec, [], {
  env: {
    ...process.env,
    RUNTIME3D_SCENARIO: 'interaction-smoke'
  },
  timeout: 20000,
  maxBuffer: 1024 * 1024 * 8
});

const detach = run('hdiutil', ['detach', mountPoint]);
if (detach.status !== 0) {
  process.stderr.write(detach.stderr || '');
}

const stdout = String(smoke.stdout || '');
const stderr = String(smoke.stderr || '');
if (stdout) {
  process.stdout.write(stdout);
}
if (stderr) {
  process.stderr.write(stderr);
}

if (smoke.status !== 0) {
  console.error(`release app smoke failed: exit=${smoke.status}`);
  process.exit(smoke.status ?? 1);
}

const required = ['[runtime3d:qt-sidecar] handshake ok', '[runtime3d:godot] handshake ok'];
for (const marker of required) {
  if (!stdout.includes(marker)) {
    console.error(`release app smoke failed: missing marker: ${marker}`);
    process.exit(1);
  }
}

console.log('runtime3d release app smoke ok');
