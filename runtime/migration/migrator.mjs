import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MAP_PATH = resolve('runtime/migration/keys-map.json');

function getByPath(obj, path) {
  if (!path) {
    return undefined;
  }
  return path.split('.').reduce((acc, key) => (acc && key in acc ? acc[key] : undefined), obj);
}

function setByPath(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (i === keys.length - 1) {
      current[key] = value;
      return;
    }
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function loadKeyMap() {
  const raw = readFileSync(MAP_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  return parsed.legacy_to_runtime3d || {};
}

export function createMigrationSnapshot(legacyState, runtime3dState, migratedKeys) {
  return {
    createdAt: new Date().toISOString(),
    migratedKeys: [...migratedKeys],
    legacyPreview: deepClone(legacyState),
    runtime3dPreview: deepClone(runtime3dState)
  };
}

export function migrateLegacyToRuntime3d({ legacyState = {}, runtime3dState = {} } = {}) {
  const keyMap = loadKeyMap();
  const nextRuntime3dState = deepClone(runtime3dState);
  const migrated = [];
  const skipped = [];

  for (const [legacyKey, runtime3dPath] of Object.entries(keyMap)) {
    const sourceValue = getByPath(legacyState, legacyKey);
    if (sourceValue === undefined) {
      skipped.push({ legacyKey, reason: 'missing_source' });
      continue;
    }

    const targetValue = getByPath(nextRuntime3dState, runtime3dPath);
    if (targetValue !== undefined) {
      skipped.push({ legacyKey, reason: 'already_migrated' });
      continue;
    }

    setByPath(nextRuntime3dState, runtime3dPath, deepClone(sourceValue));
    migrated.push({ legacyKey, runtime3dPath });
  }

  const migrationMeta = getByPath(nextRuntime3dState, 'runtime3d.migration') || {};
  const nextMigrationMeta =
    migrationMeta.completed && migrated.length === 0
      ? migrationMeta
      : {
          ...migrationMeta,
          schemaVersion: 'v1',
          source: 'legacy-electron',
          completed: true,
          lastMigratedAt: new Date().toISOString(),
          migratedCount: migrated.length
        };
  setByPath(nextRuntime3dState, 'runtime3d.migration', nextMigrationMeta);

  const snapshot = createMigrationSnapshot(legacyState, nextRuntime3dState, migrated.map((item) => item.legacyKey));
  return {
    runtime3dState: nextRuntime3dState,
    snapshot,
    report: {
      migrated,
      skipped
    }
  };
}
