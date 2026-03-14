import { spawn } from 'node:child_process';
import { spawnSync } from 'node:child_process';
import { resolveNativeEntry, validateNativeEntry } from './runtime3d-native-utils.mjs';

const SIDECAR_READY_TIMEOUT_MS = Number(process.env.RUNTIME3D_SIDECAR_READY_TIMEOUT_MS || 8000);
const SIDECAR_READY_MARKERS = [
  'listening 127.0.0.1:',
  'listening 0.0.0.0:',
  'listening localhost:',
  'listening:'
];

function runPrecheck() {
  if (process.env.RUNTIME3D_STRICT_PRECHECK === '1') {
    const check = spawnSync(process.execPath, ['scripts/check-runtime3d.mjs'], {
      stdio: 'inherit'
    });
    if (check.status !== 0) {
      process.exit(check.status ?? 1);
    }
  }

  const native = spawnSync(process.execPath, ['scripts/check-runtime3d-native.mjs'], {
    stdio: 'inherit'
  });
  if (native.status !== 0) {
    process.exit(native.status ?? 1);
  }
}

function hasReadyMarker(line) {
  const normalized = line.toLowerCase();
  return SIDECAR_READY_MARKERS.some((marker) => normalized.includes(marker));
}

function waitForSidecarReady(sidecar, timeoutMs) {
  return new Promise((resolve, reject) => {
    let resolved = false;

    const cleanup = (removeOutputListeners = false) => {
      clearTimeout(timer);
      if (removeOutputListeners) {
        sidecar.stdout?.off('data', onStdout);
        sidecar.stderr?.off('data', onStderr);
      }
      sidecar.off('exit', onExit);
      sidecar.off('error', onError);
    };

    const succeed = () => {
      if (resolved) {
        return;
      }
      resolved = true;
      cleanup(false);
      resolve();
    };

    const fail = (error) => {
      if (resolved) {
        return;
      }
      resolved = true;
      cleanup(true);
      reject(error);
    };

    const onStdout = (chunk) => {
      const text = String(chunk);
      process.stdout.write(text);
      if (hasReadyMarker(text)) {
        succeed();
      }
    };

    const onStderr = (chunk) => {
      const text = String(chunk);
      process.stderr.write(text);
      if (hasReadyMarker(text)) {
        succeed();
      }
    };

    const onExit = (code) => {
      fail(new Error(`qt sidecar exited before ready with code: ${code}`));
    };

    const onError = (error) => {
      fail(error);
    };

    const timer = setTimeout(() => {
      fail(new Error(`qt sidecar ready timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    sidecar.stdout?.on('data', onStdout);
    sidecar.stderr?.on('data', onStderr);
    sidecar.on('exit', onExit);
    sidecar.on('error', onError);
  });
}

async function start() {
  const validation = validateNativeEntry();
  if (!validation.ok) {
    for (const error of validation.errors) {
      console.error(error);
    }
    process.exit(1);
  }
  const entry = resolveNativeEntry();
  const env = {
    ...process.env,
    RUNTIME3D_SCENARIO: process.env.RUNTIME3D_SCENARIO || 'daemon'
  };

  const sidecar = spawn(entry.sidecarPath, [], {
    stdio: ['inherit', 'pipe', 'pipe'],
    env
  });

  sidecar.stdout?.setEncoding('utf8');
  sidecar.stderr?.setEncoding('utf8');

  try {
    await waitForSidecarReady(sidecar, SIDECAR_READY_TIMEOUT_MS);
  } catch (error) {
    console.error(`runtime3d release start failed: ${error.message}`);
    if (!sidecar.killed) {
      sidecar.kill('SIGTERM');
    }
    process.exit(1);
  }

  const godot = spawn(entry.godotPath, [], {
    stdio: 'inherit',
    env
  });

  const shutdown = (signal = 'SIGTERM') => {
    if (!sidecar.killed) {
      sidecar.kill(signal);
    }
    if (!godot.killed) {
      godot.kill(signal);
    }
  };

  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });

  sidecar.on('exit', (code) => {
    if (code !== 0) {
      console.error(`qt sidecar exited with code: ${code}`);
      shutdown('SIGTERM');
      process.exit(code ?? 1);
    }
  });
  godot.on('exit', (code) => {
    if (code !== 0) {
      console.error(`godot runtime exited with code: ${code}`);
      shutdown('SIGTERM');
      process.exit(code ?? 1);
    }
  });
}

runPrecheck();
console.log('runtime3d release start: launching native sidecar + godot runtime');
start();
