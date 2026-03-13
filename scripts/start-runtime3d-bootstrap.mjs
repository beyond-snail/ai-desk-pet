import { spawnSync } from 'node:child_process';

const check = spawnSync(process.execPath, ['scripts/check-runtime3d.mjs'], {
  stdio: 'inherit'
});

if (check.status !== 0) {
  process.exit(check.status ?? 1);
}

console.log('runtime3d bootstrap ready');
console.log('next steps: implement runtime/godot and runtime/qt-sidecar executable entrypoints');
