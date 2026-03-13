import net from 'node:net';
import { createLineReader } from '../shared-ipc/line-codec.mjs';
import { createMessage, decodeLine, encodeMessage, validateMessage } from '../shared-ipc/protocol.mjs';
import { ChatService } from './chat-service.mjs';
import { PersistenceStore } from './persistence-store.mjs';
import { QtSystemController } from './system-controller.mjs';
import { VoiceService } from './voice-service.mjs';

const HOST = process.env.RUNTIME3D_IPC_HOST || '127.0.0.1';
const PORT = Number(process.env.RUNTIME3D_IPC_PORT || 47831);
const LOG_PREFIX = '[runtime3d:qt-sidecar]';

const systemController = new QtSystemController();
const chatService = new ChatService();
const persistenceStore = new PersistenceStore();
const voiceService = new VoiceService();
const requiredActions = ['chat', 'feed', 'pet', 'clean', 'celebrate', 'drop'];

systemController.setupTray();
systemController.registerHotkey();

const server = net.createServer();
let clientSocket = null;
let handshakeDone = false;
let appHideSent = false;
const actionSet = new Set();
const state = {
  chatRequestReceived: false,
  chatDone: false,
  voiceStopSent: false,
  voiceWakeupSent: false,
  ttsSpoken: false,
  appQuitReceived: false
};

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

function maybeSendAppHide() {
  const hasAllActions = requiredActions.every((action) => actionSet.has(action));
  const ready =
    hasAllActions &&
    state.chatRequestReceived &&
    state.chatDone &&
    state.voiceStopSent &&
    state.voiceWakeupSent &&
    state.ttsSpoken;
  if (ready && !appHideSent) {
    appHideSent = true;
    persistenceStore.setSetting('runtime3d.last_interaction_status', 'ready_to_hide');
    send('app.hide', { reason: 'interaction-chain-complete' });
  }
}

async function onChatRequest(message) {
  state.chatRequestReceived = true;
  const requestId = message.request_id;
  try {
    const userText = String(message.payload?.text || '');
    persistenceStore.appendChat({ role: 'user', text: userText, timestamp: Date.now() });
    for await (const chunk of chatService.streamReply(message.payload)) {
      send('chat.stream_chunk', { chunk }, requestId);
    }
    state.chatDone = true;
    persistenceStore.appendChat({
      role: 'assistant',
      text: 'stream_done',
      timestamp: Date.now()
    });
    persistenceStore.appendMemory(chatService.inferMemoryFact(message.payload));
    send('chat.done', { provider: 'runtime3d-local' }, requestId);
  } catch (error) {
    send(
      'chat.error',
      { code: error.code || 'CHAT_ERROR', message: error.message || 'chat processing failed' },
      requestId
    );
  }
  maybeSendAppHide();
}

function onMessage(message) {
  const validation = validateMessage(message);
  if (!validation.ok) {
    throw new Error(`invalid message: ${validation.reason}`);
  }

  console.log(`${LOG_PREFIX} received ${message.event}`);

  if (message.event === 'app.show') {
    systemController.showWindow();
    persistenceStore.setSetting('runtime3d.window.visible', true);
    send('settings.get', { key: 'runtime3d.window.interactive_regions' });
    return;
  }

  if (message.event === 'settings.set') {
    const key = String(message.payload?.key || '');
    if (key) {
      persistenceStore.setSetting(key, message.payload?.value);
    }
    return;
  }

  if (message.event === 'settings.get') {
    const key = String(message.payload?.key || '');
    send('settings.set', { key, value: persistenceStore.getSetting(key) });
    return;
  }

  if (message.event === 'pet.action') {
    const action = String(message.payload?.action || '');
    if (action) {
      actionSet.add(action);
    }
    maybeSendAppHide();
    return;
  }

  if (message.event === 'pet.focus_mode') {
    const enabled = Boolean(message.payload?.enabled);
    persistenceStore.setSetting('runtime3d.focus.enabled', enabled);
    return;
  }

  if (message.event === 'chat.request') {
    onChatRequest(message);
    return;
  }

  if (message.event === 'speech.listen.start') {
    voiceService.startListening();
    voiceService.stopListening();
    state.voiceStopSent = true;
    send('speech.listen.stop', { mode: 'local-keyword' });
    state.voiceWakeupSent = true;
    send('pet.voice_wakeup', { wakeword: '你好桌宠' });
    maybeSendAppHide();
    return;
  }

  if (message.event === 'speech.tts.speak') {
    const spoken = voiceService.speak(message.payload?.text);
    state.ttsSpoken = spoken.spoken;
    send('system.metrics.push', {
      source: 'qt-sidecar.tts',
      spokenLength: spoken.length,
      store: {
        chatCount: persistenceStore.getState().chatHistory.length
      }
    });
    maybeSendAppHide();
    return;
  }

  if (message.event === 'app.quit') {
    state.appQuitReceived = true;
    systemController.hideWindow();
    persistenceStore.setSetting('runtime3d.window.visible', false);
    const hasAllActions = requiredActions.every((action) => actionSet.has(action));
    const finalOk =
      hasAllActions &&
      state.chatDone &&
      state.voiceStopSent &&
      state.voiceWakeupSent &&
      state.ttsSpoken &&
      appHideSent;
    console.log(
      `${LOG_PREFIX} interaction_summary ${JSON.stringify({
        hasAllActions,
        chatDone: state.chatDone,
        voiceStopSent: state.voiceStopSent,
        voiceWakeupSent: state.voiceWakeupSent,
        ttsSpoken: state.ttsSpoken,
        appHideSent,
        persistedChatCount: persistenceStore.getState().chatHistory.length
      })}`
    );
    if (!finalOk) {
      console.error(`${LOG_PREFIX} interaction checks failed`);
      process.exitCode = 1;
    } else {
      handshakeDone = true;
    }
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
