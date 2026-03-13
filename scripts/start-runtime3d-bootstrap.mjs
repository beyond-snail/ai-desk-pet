import { spawnSync } from 'node:child_process';

const check = spawnSync(process.execPath, ['scripts/check-runtime3d.mjs'], {
  stdio: 'inherit'
});

if (check.status !== 0) {
  process.exit(check.status ?? 1);
}

console.log('runtime3d bootstrap ready');
console.log('runtime3d stage-b+c bootstrap ready (entrypoints + ipc + motion logic)');
console.log('next steps: bind motion logic to real Godot scene and animation resources');
