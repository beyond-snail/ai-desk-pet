import net from 'node:net';
import { createLineReader } from '../shared-ipc/line-codec.mjs';
import { createMessage, decodeLine, encodeMessage, validateMessage } from '../shared-ipc/protocol.mjs';
import { QtSystemController } from './system-controller.mjs';

const HOST = process.env.RUNTIME3D_IPC_HOST || '127.0.0.1';
const PORT = Number(process.env.RUNTIME3D_IPC_PORT || 47831);
const LOG_PREFIX = '[runtime3d:qt-sidecar]';

const systemController = new QtSystemController();
systemController.setupTray();
systemController.registerHotkey();

const server = net.createServer();
let clientSocket = null;
let handshakeDone = false;

function send(event, payload = {}, requestId) {
  const message = createMessage({
    event,
    source: 'qt-sidecar',
    target: 'godot',
    payload,
    requestId
  });
  clientSocket.write(encodeMessage(message));
  console.log(`${LOG_PREFIX} sent ${event}`);
}

function onMessage(message) {
  const validation = validateMessage(message);
  if (!validation.ok) {
    throw new Error(`invalid message: ${validation.reason}`);
  }

  console.log(`${LOG_PREFIX} received ${message.event}`);

  if (message.event === 'app.show') {
    systemController.showWindow();
    send('settings.get', { key: 'runtime3d.window.interactive_regions' });
    return;
  }

  if (message.event === 'settings.set') {
    send('pet.action', { action: 'listen' });
    return;
  }

  if (message.event === 'pet.voice_wakeup') {
    send('app.hide', { reason: 'smoke-sequence' });
    return;
  }

  if (message.event === 'app.quit') {
    systemController.hideWindow();
    handshakeDone = true;
    const snapshot = systemController.snapshot();
    console.log(`${LOG_PREFIX} system_state ${JSON.stringify(snapshot)}`);
    clientSocket.end();
    server.close();
  }
}

function startServer() {
  server.on('connection', (socket) => {
    clientSocket = socket;
    console.log(`${LOG_PREFIX} client connected`);

    const lineReader = createLineReader((line) => {
      const message = decodeLine(line);
      onMessage(message);
    });

    socket.setEncoding('utf8');
    socket.on('data', lineReader);
    socket.on('error', (error) => {
      console.error(`${LOG_PREFIX} socket error: ${error.message}`);
      process.exitCode = 1;
    });
    socket.on('close', () => {
      if (handshakeDone) {
        console.log(`${LOG_PREFIX} handshake ok`);
        return;
      }
      console.error(`${LOG_PREFIX} closed before handshake completed`);
      process.exitCode = 1;
    });
  });

  server.on('error', (error) => {
    console.error(`${LOG_PREFIX} server error: ${error.message}`);
    process.exitCode = 1;
  });

  server.listen(PORT, HOST, () => {
    console.log(`${LOG_PREFIX} listening ${HOST}:${PORT}`);
  });
}

startServer();
