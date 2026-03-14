import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

export function platformKey(platform = process.platform, arch = process.arch) {
  return `${platform}-${arch}`;
}

export function nativeManifestPath() {
  return resolve('runtime/native/manifest.json');
}

export function loadNativeManifest() {
  return JSON.parse(readFileSync(nativeManifestPath(), 'utf8'));
}

export function resolveNativeEntry(key = platformKey()) {
  const manifest = loadNativeManifest();
  const entry = manifest.platforms?.[key];
  if (!entry) {
    throw new Error(`native manifest missing platform entry: ${key}`);
  }
  const baseDir = resolve('runtime/native', entry.dir);
  return {
    key,
    manifest,
    baseDir,
    sidecarPath: resolve(baseDir, entry.qt_sidecar),
    godotPath: resolve(baseDir, entry.godot_runtime)
  };
}

export function isExecutable(path) {
  if (!existsSync(path)) {
    return false;
  }
  if (process.platform === 'win32') {
    return true;
  }
  const mode = statSync(path).mode;
  return (mode & 0o111) !== 0;
}

export function validateNativeEntry(key = platformKey()) {
  const entry = resolveNativeEntry(key);
  const errors = [];
  if (!existsSync(entry.sidecarPath)) {
    errors.push(`missing qt sidecar binary: ${entry.sidecarPath}`);
  } else if (!isExecutable(entry.sidecarPath)) {
    errors.push(`qt sidecar not executable: ${entry.sidecarPath}`);
  }
  if (!existsSync(entry.godotPath)) {
    errors.push(`missing godot runtime binary: ${entry.godotPath}`);
  } else if (!isExecutable(entry.godotPath)) {
    errors.push(`godot runtime not executable: ${entry.godotPath}`);
  }
  return {
    ok: errors.length === 0,
    entry,
    errors
  };
}
