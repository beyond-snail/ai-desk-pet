import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveNativeEntry } from './runtime3d-native-utils.mjs';

function mustPass(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const runtimeName = 'AIDeskPet-runtime3d';
const appBundleName = 'AIDeskPet.app';
const appExecutableName = 'AIDeskPet';

mustPass(process.execPath, ['scripts/clean-runtime3d-dist.mjs']);
mustPass(process.execPath, ['scripts/build-runtime3d-native-binaries.mjs']);
mustPass(process.execPath, ['scripts/check-runtime3d-native.mjs']);
mustPass(process.execPath, ['scripts/runtime3d-ipc-smoke.mjs']);

const entry = resolveNativeEntry();
const entryDir = entry.manifest.platforms[entry.key].dir;
const releaseRootDir = resolve('dist/runtime3d-release');
const outputDir = resolve(releaseRootDir, entry.key);
const manifestName = `${runtimeName}-manifest-${entry.key}.json`;
const performanceName = `${runtimeName}-performance-${entry.key}.json`;
const performanceReportPath = resolve(outputDir, performanceName);
const dmgPath = resolve(outputDir, `${runtimeName}-${entry.key}.dmg`);
const pkgPath = resolve(outputDir, `${runtimeName}-${entry.key}.pkg`);

const legacyTargets = [
  resolve(releaseRootDir, '.DS_Store'),
  resolve(releaseRootDir, 'bundle'),
  resolve(releaseRootDir, 'release-manifest.json'),
  resolve(releaseRootDir, 'performance-report.json'),
  resolve(releaseRootDir, `${runtimeName}-${entry.key}.tar.gz`),
  resolve(releaseRootDir, `${runtimeName}-${entry.key}.dmg`),
  resolve(releaseRootDir, `${runtimeName}-${entry.key}.pkg`)
];
for (const legacyTarget of legacyTargets) {
  rmSync(legacyTarget, { recursive: true, force: true });
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

mustPass(process.execPath, ['scripts/runtime3d-performance-smoke.mjs', '--report', performanceReportPath]);

const appBuildRoot = resolve(outputDir, '.app-build');
const appRoot = resolve(appBuildRoot, appBundleName);
const appContents = resolve(appRoot, 'Contents');
const appMacOSDir = resolve(appContents, 'MacOS');
const appResourcesDir = resolve(appContents, 'Resources');
const bundledRuntimeDir = resolve(appResourcesDir, 'runtime/native', entryDir);

mkdirSync(appMacOSDir, { recursive: true });
mkdirSync(bundledRuntimeDir, { recursive: true });

cpSync(resolve(`runtime/native/${entryDir}/qt-sidecar`), resolve(bundledRuntimeDir, 'qt-sidecar'));
cpSync(resolve(`runtime/native/${entryDir}/godot-runtime`), resolve(bundledRuntimeDir, 'godot-runtime'));
chmodSync(resolve(bundledRuntimeDir, 'qt-sidecar'), 0o755);
chmodSync(resolve(bundledRuntimeDir, 'godot-runtime'), 0o755);

const launcherPath = resolve(appMacOSDir, appExecutableName);
writeFileSync(
  launcherPath,
  [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '',
    'APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"',
    `RUNTIME_DIR="$APP_ROOT/Resources/runtime/native/${entryDir}"`,
    '',
    'if [[ ! -x "$RUNTIME_DIR/qt-sidecar" || ! -x "$RUNTIME_DIR/godot-runtime" ]]; then',
    '  echo "runtime binaries missing in app bundle: $RUNTIME_DIR"',
    '  exit 1',
    'fi',
    '',
    'export RUNTIME3D_SCENARIO="${RUNTIME3D_SCENARIO:-daemon}"',
    '"$RUNTIME_DIR/qt-sidecar" &',
    'SIDECAR_PID=$!',
    'trap "kill $SIDECAR_PID >/dev/null 2>&1 || true" EXIT',
    'sleep 0.15',
    'exec "$RUNTIME_DIR/godot-runtime"',
    ''
  ].join('\n')
);
chmodSync(launcherPath, 0o755);

const plistPath = resolve(appContents, 'Info.plist');
writeFileSync(
  plistPath,
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    '  <key>CFBundleName</key>',
    '  <string>AIDeskPet</string>',
    '  <key>CFBundleDisplayName</key>',
    '  <string>AIDeskPet</string>',
    '  <key>CFBundleIdentifier</key>',
    '  <string>com.aideskpet.runtime3d</string>',
    '  <key>CFBundleVersion</key>',
    '  <string>1.0.0</string>',
    '  <key>CFBundleShortVersionString</key>',
    '  <string>1.0.0</string>',
    '  <key>CFBundleExecutable</key>',
    `  <string>${appExecutableName}</string>`,
    '  <key>CFBundlePackageType</key>',
    '  <string>APPL</string>',
    '  <key>CFBundleIconFile</key>',
    '  <string>icon.icns</string>',
    '  <key>LSMinimumSystemVersion</key>',
    '  <string>12.0</string>',
    '</dict>',
    '</plist>',
    ''
  ].join('\n')
);

const iconSource = resolve('assets/icon.icns');
cpSync(iconSource, resolve(appResourcesDir, 'icon.icns'));

const dmgStageDir = resolve(outputDir, '.dmg-stage');
rmSync(dmgStageDir, { recursive: true, force: true });
mkdirSync(dmgStageDir, { recursive: true });
cpSync(appRoot, resolve(dmgStageDir, appBundleName), { recursive: true });
symlinkSync('/Applications', resolve(dmgStageDir, 'Applications'));

const dmg = spawnSync(
  'hdiutil',
  ['create', '-volname', `${runtimeName}-${entry.key}`, '-srcfolder', dmgStageDir, '-ov', '-format', 'UDZO', dmgPath],
  {
    cwd: outputDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      LANG: 'C',
      LC_ALL: 'C'
    }
  }
);
if (dmg.status !== 0) {
  process.exit(dmg.status ?? 1);
}

mustPass(process.execPath, ['scripts/runtime3d-release-app-smoke.mjs', '--dmg', dmgPath]);

const pkgStageDir = resolve(outputDir, '.pkg-stage');
const pkgApplicationsDir = resolve(pkgStageDir, 'Applications');
rmSync(pkgStageDir, { recursive: true, force: true });
mkdirSync(pkgApplicationsDir, { recursive: true });
cpSync(appRoot, resolve(pkgApplicationsDir, appBundleName), { recursive: true });

mustPass('pkgbuild', [
  '--root',
  pkgStageDir,
  '--identifier',
  'com.aideskpet.runtime3d',
  '--version',
  '1.0.0',
  '--install-location',
  '/',
  pkgPath
]);

mustPass(process.execPath, ['scripts/runtime3d-release-pkg-smoke.mjs', '--pkg', pkgPath]);

writeFileSync(
  resolve(outputDir, manifestName),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      appName: 'AIDeskPet',
      runtimeName,
      platform: entry.key,
      runtime: 'runtime3d-native',
      packageType: 'release-candidate',
      outputDir: `dist/runtime3d-release/${entry.key}`,
      dmgFile: `${runtimeName}-${entry.key}.dmg`,
      pkgFile: `${runtimeName}-${entry.key}.pkg`,
      appBundle: appBundleName,
      launcher: `${appBundleName}/Contents/MacOS/${appExecutableName}`,
      performanceReport: performanceName,
      bundledRuntimeDir: entryDir
    },
    null,
    2
  )
);

rmSync(appBuildRoot, { recursive: true, force: true });
rmSync(dmgStageDir, { recursive: true, force: true });
rmSync(pkgStageDir, { recursive: true, force: true });

console.log(`runtime3d release bundle created: ${dmgPath}`);
console.log(`runtime3d release installer created: ${pkgPath}`);
console.log(`runtime3d release output dir: ${outputDir}`);
