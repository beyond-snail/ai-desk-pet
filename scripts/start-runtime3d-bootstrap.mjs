import { spawnSync } from 'node:child_process';

const check = spawnSync(process.execPath, ['scripts/check-runtime3d.mjs'], {
  stdio: 'inherit'
});

if (check.status !== 0) {
  process.exit(check.status ?? 1);
}

console.log('runtime3d bootstrap ready');
console.log('runtime3d stage-b bootstrap ready (entrypoints + ipc handshake)');
console.log('next steps: implement real Godot/Qt runtime features for stage C/D');
