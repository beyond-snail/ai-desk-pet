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
    stdio: 'pipe',
    encoding: 'utf8',
    env: {
      ...process.env,
      RUNTIME3D_SCENARIO: 'healthcheck'
    }
  });
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    console.error(`native healthcheck failed: ${target.name}`);
    process.exit(result.status ?? 1);
  }
  if (!String(result.stdout || '').toLowerCase().includes('native')) {
    console.error(`native binary contract failed: ${target.name} did not report native healthcheck`);
    process.exit(1);
  }
}

console.log(`runtime3d native check ok (${validation.entry.key})`);
