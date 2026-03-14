import { spawnSync } from 'node:child_process';
import { validateNativeEntry } from './runtime3d-native-utils.mjs';

const validation = validateNativeEntry();
if (!validation.ok) {
  for (const error of validation.errors) {
    console.error(error);
  }
  process.exit(1);
}

const healthTargets = [
  { name: 'qt-sidecar', path: validation.entry.sidecarPath },
  { name: 'godot-runtime', path: validation.entry.godotPath }
];

for (const target of healthTargets) {
  const result = spawnSync(target.path, ['--healthcheck'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      RUNTIME3D_SCENARIO: 'healthcheck'
    }
  });
  if (result.status !== 0) {
    console.error(`native healthcheck failed: ${target.name}`);
    process.exit(result.status ?? 1);
  }
}

console.log(`runtime3d native check ok (${validation.entry.key})`);
