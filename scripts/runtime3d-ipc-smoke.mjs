import { spawn } from 'node:child_process';

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
  const child = spawn(process.execPath, [commandPath], {
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  pipePrefixed(child.stdout, prefix, onLine);
  pipePrefixed(child.stderr, `${prefix}[err]`, onLine);
  return child;
}

async function main() {
  const env = {
    ...process.env,
    RUNTIME3D_IPC_HOST: host,
    RUNTIME3D_IPC_PORT: String(port)
  };

  let sidecarReady = false;
  let godotHandshake = false;
  let sidecarHandshake = false;

  const sidecar = createChild(
    'runtime/qt-sidecar/main.mjs',
    env,
    '[ipc-smoke][sidecar]',
    (line) => {
      if (line.includes('listening')) {
        sidecarReady = true;
      }
      if (line.includes('handshake ok')) {
        sidecarHandshake = true;
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
    'runtime/godot/main.mjs',
    env,
    '[ipc-smoke][godot]',
    (line) => {
      if (line.includes('handshake ok')) {
        godotHandshake = true;
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
    if (godotHandshake && sidecarHandshake) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  const [godotCode, sidecarCode] = await Promise.all([godotExit, sidecarExit]);
  if (godotCode !== 0 || sidecarCode !== 0) {
    throw new Error(`child process exited with non-zero code (godot=${godotCode}, sidecar=${sidecarCode})`);
  }

  console.log('[ipc-smoke] handshake stable');
}

main().catch((error) => {
  console.error(`[ipc-smoke] failed: ${error.message}`);
  process.exit(1);
});
