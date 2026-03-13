import { spawnSync } from 'node:child_process';

const check = spawnSync(process.execPath, ['scripts/check-runtime3d.mjs'], {
  stdio: 'inherit'
});

if (check.status !== 0) {
  process.exit(check.status ?? 1);
}

console.log('runtime3d bootstrap ready');
console.log('runtime3d stage-b+c+d+e bootstrap ready (entrypoints + ipc + motion + interaction + migration)');
console.log('next steps: bind runtime logic to real Godot scene/resources and native Qt sidecar');
