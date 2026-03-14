import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveNativeEntry } from './runtime3d-native-utils.mjs';

function mustPass(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

mustPass(process.execPath, ['scripts/build-runtime3d-native-binaries.mjs']);
mustPass(process.execPath, ['scripts/check-runtime3d-native.mjs']);
mustPass(process.execPath, ['scripts/runtime3d-ipc-smoke.mjs']);
mustPass(process.execPath, [
  'scripts/runtime3d-performance-smoke.mjs',
  '--report',
  'dist/runtime3d-release/performance-report.json'
]);

const entry = resolveNativeEntry();
const outputDir = resolve('dist/runtime3d-release');
const stageDir = resolve(outputDir, 'bundle');
rmSync(stageDir, { recursive: true, force: true });
mkdirSync(stageDir, { recursive: true });

const copyTargets = [
  'README.md',
  'docs/3d-runtime-migration-spec.md',
  'docs/3d-runtime-migration-tasks-for-codex.md',
  'docs/runtime3d-final-dod-status-2026-03-13.md',
  'docs/runtime3d-release-native-switch-2026-03-14.md',
  'runtime/shared-ipc/schema-v1.json',
  'runtime/migration/keys-map.json',
  'runtime/native/manifest.json',
  'runtime/native/README.md',
  `runtime/native/${entry.manifest.platforms[entry.key].dir}`
];

for (const target of copyTargets) {
  const from = resolve(target);
  const to = resolve(stageDir, target);
  mkdirSync(resolve(to, '..'), { recursive: true });
  cpSync(from, to, { recursive: true });
}

const runScriptPath = resolve(stageDir, 'run-runtime3d.sh');
writeFileSync(
  runScriptPath,
  [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '',
    'ROOT_DIR=\"$(cd \"$(dirname \"$0\")\" && pwd)\"',
    'OS_NAME=\"$(uname -s)\"',
    'ARCH_NAME=\"$(uname -m)\"',
    'if [[ \"$OS_NAME\" != \"Darwin\" ]]; then',
    '  echo \"unsupported os: $OS_NAME\"',
    '  exit 1',
    'fi',
    'if [[ \"$ARCH_NAME\" == \"x86_64\" ]]; then',
    '  ENTRY_DIR=\"darwin-x64\"',
    'elif [[ \"$ARCH_NAME\" == \"arm64\" ]]; then',
    '  ENTRY_DIR=\"darwin-arm64\"',
    'else',
    '  echo \"unsupported arch: $ARCH_NAME\"',
    '  exit 1',
    'fi',
    '',
    'export RUNTIME3D_SCENARIO=\"${RUNTIME3D_SCENARIO:-daemon}\"',
    '\"$ROOT_DIR/runtime/native/$ENTRY_DIR/qt-sidecar\" &',
    'SIDECAR_PID=$!',
    'trap \"kill $SIDECAR_PID >/dev/null 2>&1 || true\" EXIT',
    'sleep 0.15',
    'exec \"$ROOT_DIR/runtime/native/$ENTRY_DIR/godot-runtime\"',
    ''
  ].join('\n')
);
chmodSync(runScriptPath, 0o755);

writeFileSync(
  resolve(outputDir, 'release-manifest.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      platform: entry.key,
      runtime: 'runtime3d-native',
      packageType: 'release-candidate',
      includes: copyTargets
    },
    null,
    2
  )
);

const archivePath = resolve(outputDir, `AIDeskPet-runtime3d-${entry.key}.tar.gz`);
const tar = spawnSync('tar', ['-czf', archivePath, 'bundle'], {
  cwd: outputDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    LANG: 'C',
    LC_ALL: 'C'
  }
});
if (tar.status !== 0) {
  process.exit(tar.status ?? 1);
}

console.log(`runtime3d release bundle created: ${archivePath}`);
