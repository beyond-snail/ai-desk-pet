import net from 'node:net';
import { createLineReader } from '../shared-ipc/line-codec.mjs';
import { createMessage, decodeLine, encodeMessage, validateMessage } from '../shared-ipc/protocol.mjs';
import { GodotWindowController } from './window-controller.mjs';

const SIDE_CAR_HOST = process.env.RUNTIME3D_IPC_HOST || '127.0.0.1';
const SIDE_CAR_PORT = Number(process.env.RUNTIME3D_IPC_PORT || 47831);
const LOG_PREFIX = '[runtime3d:godot]';
const windowController = new GodotWindowController();

let socket = null;
let handshakeDone = false;
let appQuitSent = false;

function send(event, payload = {}, requestId) {
  const message = createMessage({
    event,
    source: 'godot',
    target: 'qt-sidecar',
    payload,
    requestId
  });
  socket.write(encodeMessage(message));
  console.log(`${LOG_PREFIX} sent ${event}`);
}

function onMessage(message) {
  const validation = validateMessage(message);
  if (!validation.ok) {
    throw new Error(`invalid message: ${validation.reason}`);
  }

  console.log(`${LOG_PREFIX} received ${message.event}`);

  if (message.event === 'app.show') {
    windowController.show();
    return;
  }

  if (message.event === 'settings.get') {
    windowController.setInteractiveRegions([
      { x: 120, y: 88, width: 220, height: 220 },
      { x: 96, y: 312, width: 310, height: 126 }
    ]);
    send('settings.set', {
      key: 'runtime3d.window.interactive_regions',
      value: windowController.snapshot().interactiveRegions
    });
    return;
  }

  if (message.event === 'pet.action') {
    send('pet.voice_wakeup', { wakeword: '你好桌宠' });
    return;
  }

  if (message.event === 'app.hide') {
    windowController.hide();
    send('app.quit', { reason: 'smoke-sequence-complete' });
    appQuitSent = true;
    return;
  }
}

function bootstrap() {
  socket = net.createConnection({ host: SIDE_CAR_HOST, port: SIDE_CAR_PORT }, () => {
    console.log(`${LOG_PREFIX} connected ${SIDE_CAR_HOST}:${SIDE_CAR_PORT}`);
    send('app.show', { reason: 'runtime3d-bootstrap-smoke' });
  });

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
    if (appQuitSent) {
      handshakeDone = true;
      const snapshot = windowController.snapshot();
      console.log(`${LOG_PREFIX} window_state ${JSON.stringify(snapshot)}`);
      console.log(`${LOG_PREFIX} handshake ok`);
      return;
    }
    console.error(`${LOG_PREFIX} closed before handshake completed`);
    process.exitCode = 1;
  });
}

bootstrap();
