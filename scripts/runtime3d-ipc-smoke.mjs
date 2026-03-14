import { spawn } from 'node:child_process';
import { validateNativeEntry } from './runtime3d-native-utils.mjs';

const host = process.env.RUNTIME3D_IPC_HOST || '127.0.0.1';
const port = Number(process.env.RUNTIME3D_IPC_PORT || 47000 + Math.floor(Math.random() * 1000));
const timeoutMs = Number(process.env.RUNTIME3D_IPC_SMOKE_TIMEOUT_MS || 10000);

function pipePrefixed(stream, prefix, onLine) {
  let buffer = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buffer += chunk;
    while (true) {
      const index = buffer.indexOf('\n');
      if (index < 0) {
        break;
      }
      const line = buffer.slice(0, index).trimEnd();
      buffer = buffer.slice(index + 1);
      if (line.length > 0) {
        console.log(`${prefix} ${line}`);
        onLine(line);
      }
    }
  });
}

function createChild(commandPath, env, prefix, onLine) {
  const child = spawn(commandPath, [], {
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  pipePrefixed(child.stdout, prefix, onLine);
  pipePrefixed(child.stderr, `${prefix}[err]`, onLine);
  return child;
}

async function main() {
  const validation = validateNativeEntry();
  if (!validation.ok) {
    for (const error of validation.errors) {
      console.error(`[ipc-smoke] ${error}`);
    }
    process.exit(1);
  }

  const env = {
    ...process.env,
    RUNTIME3D_IPC_HOST: host,
    RUNTIME3D_IPC_PORT: String(port),
    RUNTIME3D_SCENARIO: 'interaction-smoke'
  };

  let sidecarReady = false;
  let godotHandshake = false;
  let sidecarHandshake = false;
  let godotSummary = false;
  let sidecarSummary = false;

  const sidecar = createChild(
    validation.entry.sidecarPath,
    env,
    '[ipc-smoke][sidecar]',
    (line) => {
      if (line.includes('listening')) {
        sidecarReady = true;
      }
      if (line.includes('handshake ok')) {
        sidecarHandshake = true;
      }
      if (line.includes('interaction_summary')) {
        sidecarSummary = true;
      }
    }
  );

  const sidecarExit = new Promise((resolve) => {
    sidecar.on('exit', (code) => resolve(code ?? 1));
  });

  const waitReadyStarted = Date.now();
  while (!sidecarReady) {
    if (Date.now() - waitReadyStarted > 3000) {
      sidecar.kill('SIGTERM');
      throw new Error('sidecar did not enter listening state in time');
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  const godot = createChild(
    validation.entry.godotPath,
    env,
    '[ipc-smoke][godot]',
    (line) => {
      if (line.includes('handshake ok')) {
        godotHandshake = true;
      }
      if (line.includes('interaction_summary')) {
        godotSummary = true;
      }
    }
  );

  const godotExit = new Promise((resolve) => {
    godot.on('exit', (code) => resolve(code ?? 1));
  });

  const startedAt = Date.now();
  while (true) {
    const elapsed = Date.now() - startedAt;
    if (elapsed > timeoutMs) {
      godot.kill('SIGTERM');
      sidecar.kill('SIGTERM');
      throw new Error(`ipc smoke timed out after ${timeoutMs}ms`);
    }
    if (godotHandshake && sidecarHandshake && godotSummary && sidecarSummary) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  const [godotCode, sidecarCode] = await Promise.all([godotExit, sidecarExit]);
  if (godotCode !== 0 || sidecarCode !== 0) {
    throw new Error(`child process exited with non-zero code (godot=${godotCode}, sidecar=${sidecarCode})`);
  }

  console.log('[ipc-smoke] interaction handshake stable');
}

main().catch((error) => {
  console.error(`[ipc-smoke] failed: ${error.message}`);
  process.exit(1);
});
