import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const sourceRoot = resolve('runtime/native-src');

const targets = [
  {
    platform: 'darwin-x64',
    goos: 'darwin',
    goarch: 'amd64'
  },
  {
    platform: 'darwin-arm64',
    goos: 'darwin',
    goarch: 'arm64'
  }
];

const binaries = [
  { name: 'qt-sidecar', pkg: './cmd/qt-sidecar' },
  { name: 'godot-runtime', pkg: './cmd/godot-runtime' }
];

function runBuild(target, binary) {
  const output = resolve('runtime/native', target.platform, binary.name);
  mkdirSync(resolve(output, '..'), { recursive: true });

  const result = spawnSync(
    'go',
    ['build', '-trimpath', '-ldflags', '-s -w', '-o', output, binary.pkg],
    {
      cwd: sourceRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        GOOS: target.goos,
        GOARCH: target.goarch,
        CGO_ENABLED: '0'
      }
    }
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

for (const target of targets) {
  for (const binary of binaries) {
    runBuild(target, binary);
  }
}

console.log('runtime3d native binaries built for darwin-x64 and darwin-arm64');
