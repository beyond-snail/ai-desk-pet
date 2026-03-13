import net from 'node:net';
import { createLineReader } from '../shared-ipc/line-codec.mjs';
import { createMessage, decodeLine, encodeMessage, validateMessage } from '../shared-ipc/protocol.mjs';
import { DefaultRobotController } from './default-robot-controller.mjs';
import { GameplaySystem } from './gameplay-system.mjs';
import { InteractionController } from './interaction-controller.mjs';
import { GodotWindowController } from './window-controller.mjs';

const SIDE_CAR_HOST = process.env.RUNTIME3D_IPC_HOST || '127.0.0.1';
const SIDE_CAR_PORT = Number(process.env.RUNTIME3D_IPC_PORT || 47831);
const SCENARIO = process.env.RUNTIME3D_SCENARIO || 'interaction-smoke';
const LOG_PREFIX = '[runtime3d:godot]';

const windowController = new GodotWindowController();
const interactionController = new InteractionController();
const robotController = new DefaultRobotController({ offscreenProbability: 0.45 });
const gameplaySystem = new GameplaySystem();

let socket = null;
let appQuitSent = false;
let loopTimer = null;
let loopTicks = 0;
let chatReply = '';
let ttsRequested = false;
let voiceWakeupReceived = false;
let interactionTriggered = false;

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

function startMainLoop() {
  if (loopTimer) {
    return;
  }
  loopTimer = setInterval(() => {
    const frame = robotController.update(16);
    gameplaySystem.tick(16);
    loopTicks += 1;
    if (loopTicks % 120 === 0) {
      send('system.metrics.push', {
        source: 'godot.main_loop',
        loopTicks,
        locomotion: frame.locomotion,
        roamingState: frame.movement.state,
        gameplay: gameplaySystem.snapshot()
      });
    }
  }, 16);
}

function stopMainLoop() {
  if (!loopTimer) {
    return;
  }
  clearInterval(loopTimer);
  loopTimer = null;
}

function triggerInteractionScenario() {
  if (interactionTriggered || !SCENARIO.includes('interaction')) {
    return;
  }
  interactionTriggered = true;

  interactionController.onSingleClick();
  send('pet.action', { action: 'menu.open', trigger: 'single_click' });

  for (const action of ['chat', 'feed', 'pet', 'clean']) {
    const payload = interactionController.onMenuAction(action);
    gameplaySystem.applyAction(action);
    send('pet.action', payload);
  }

  send('chat.request', {
    text: '今天的专注安排是什么？',
    provider: 'runtime3d-local',
    limit_mode: 'daily'
  });

  send('speech.listen.start', {
    mode: 'local-keyword',
    keywords: ['你好桌宠', '过来', '走开', '喂食']
  });
  send('pet.focus_mode', { enabled: true, source: 'voice_start' });
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
    triggerInteractionScenario();
    return;
  }

  if (message.event === 'chat.stream_chunk') {
    chatReply += String(message.payload?.chunk || '');
    return;
  }

  if (message.event === 'chat.done') {
    gameplaySystem.appendChat({
      role: 'assistant',
      text: chatReply
    });
    gameplaySystem.addMemoryFact(`最近回复长度:${chatReply.length}`);
    if (!ttsRequested) {
      send('speech.tts.speak', {
        text: chatReply,
        voice: 'local-default'
      });
      ttsRequested = true;
    }
    return;
  }

  if (message.event === 'chat.error') {
    if (!ttsRequested) {
      send('speech.tts.speak', {
        text: '网络暂时拥挤，我先陪你休息一下。',
        voice: 'local-default'
      });
      ttsRequested = true;
    }
    return;
  }

  if (message.event === 'pet.voice_wakeup') {
    voiceWakeupReceived = true;
    gameplaySystem.setFocusActive(true);
    send('pet.action', interactionController.onDoubleClick());
    gameplaySystem.applyAction('celebrate');
    send('pet.action', interactionController.onDragDrop());
    gameplaySystem.applyAction('drop');
    return;
  }

  if (message.event === 'speech.listen.stop') {
    gameplaySystem.setFocusActive(false);
    send('pet.focus_mode', { enabled: false, source: 'voice_stop' });
    return;
  }

  if (message.event === 'system.metrics.push') {
    const spokenLength = Number(message.payload?.spokenLength || 0);
    const systemLoad = spokenLength > 30 ? 'high' : 'normal';
    gameplaySystem.updateEnvironment({
      weather: 'clear',
      systemLoad
    });
    return;
  }

  if (message.event === 'app.hide') {
    windowController.hide();
    stopMainLoop();
    send('app.quit', {
      reason: 'interaction-smoke-complete',
      loopTicks,
      voiceWakeupReceived,
      ttsRequested,
      interaction: interactionController.snapshot(),
      robotSnapshot: robotController.snapshot(),
      gameplay: gameplaySystem.snapshot()
    });
    appQuitSent = true;
  }
}

function bootstrap() {
  socket = net.createConnection({ host: SIDE_CAR_HOST, port: SIDE_CAR_PORT }, () => {
    console.log(`${LOG_PREFIX} connected ${SIDE_CAR_HOST}:${SIDE_CAR_PORT}`);
    startMainLoop();
    send('app.show', { reason: SCENARIO });
  });

  const lineReader = createLineReader((line) => {
    const message = decodeLine(line);
    onMessage(message);
  });

  socket.setEncoding('utf8');
  socket.on('data', lineReader);

  socket.on('error', (error) => {
    stopMainLoop();
    console.error(`${LOG_PREFIX} socket error: ${error.message}`);
    process.exitCode = 1;
  });

  socket.on('close', () => {
    stopMainLoop();
    if (appQuitSent) {
      console.log(
        `${LOG_PREFIX} interaction_summary ${JSON.stringify({
          loopTicks,
          chatReplyLength: chatReply.length,
          voiceWakeupReceived
        })}`
      );
      console.log(`${LOG_PREFIX} handshake ok`);
      return;
    }
    console.error(`${LOG_PREFIX} closed before handshake completed`);
    process.exitCode = 1;
  });
}

bootstrap();
