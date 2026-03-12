const { app, BrowserWindow, Menu, Notification, Tray, ipcMain, screen, globalShortcut } = require('electron');
const fs = require('fs');
const path = require('path');
const SystemMonitor = require('./system-monitor');

const BUILT_IN_LLM = {
  provider: 'deepseek',
  apiKey: 'sk-eece5712a74b4f94a100482b0c9943bb',
  model: 'deepseek-chat',
  baseUrl: 'https://api.deepseek.com/v1'
};

const DAILY_LIMIT = 100;

let store = null;

async function initStore() {
  if (store) {
    return store;
  }

  const module = await import('electron-store');
  const Store = module.default;
  store = new Store();
  return store;
}

let autoUpdater = null;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch (_error) {
  autoUpdater = null;
}

const systemMonitor = new SystemMonitor();
let mainWindow = null;
let tray = null;
let isQuitting = false;
let isWindowReady = false;
let windowCreatedAt = 0;
let isPetVisible = true;
let isPetHiding = false;

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});


function getWorkAreaBounds() {
  return screen.getPrimaryDisplay().workArea;
}

function sendContextAction(action) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send('context-menu-action', action);
}

function buildContextMenu() {
  const featureFlags = store.get('featureFlags') || {};
  const template = [
    {
      label: '喂食',
      click: () => sendContextAction('feed')
    },
    {
      label: '抚摸',
      click: () => sendContextAction('pet')
    },
    {
      label: '清洁',
      click: () => sendContextAction('clean')
    },
    { type: 'separator' },
    {
      label: '开始专注 (25分钟)',
      click: () => sendContextAction('pomodoro')
    },
    {
      label: '停止专注',
      click: () => sendContextAction('pomodoro-stop')
    }
  ];

  if (featureFlags.multiPet) {
    template.push(
      { type: 'separator' },
      {
        label: '添加宠物',
        click: () => sendContextAction('add-pet')
      },
      {
        label: '管理宠物',
        click: () => sendContextAction('manage-pets')
      }
    );
  }

  template.push(
    { type: 'separator' },
    {
      label: '成长日记',
      click: () => sendContextAction('growth-diary')
    },
    {
      type: 'separator'
    },
    {
      label: '设置',
      click: () => sendContextAction('settings')
    }
  );

  return Menu.buildFromTemplate(template);
}

function resolveAsset(...segments) {
  return path.join(__dirname, '../../assets', ...segments);
}

function sendWindowEvent(channel, payload = undefined) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents || mainWindow.webContents.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send(channel, payload);
}

function requestPetShow(options = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const withVoice = Boolean(options.withVoice);
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  mainWindow.focus();

  if (isPetVisible) {
    if (withVoice) {
      sendWindowEvent('pet:show-with-voice');
    }
    return;
  }

  isPetVisible = true;
  isPetHiding = false;
  sendWindowEvent(withVoice ? 'pet:show-with-voice' : 'pet:show');
}

function requestPetHide() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (windowCreatedAt && Date.now() - windowCreatedAt < 500) {
    return;
  }

  if (!isWindowReady) {
    mainWindow.hide();
    isPetVisible = false;
    isPetHiding = false;
    return;
  }

  if (!isPetVisible || isPetHiding) {
    return;
  }

  isPetHiding = true;
  sendWindowEvent('pet:hide');
}

function createTray() {
  if (tray) {
    return;
  }

  const trayIconPath = path.join(__dirname, '../../assets', process.platform === 'darwin' ? 'tray-iconTemplate.png' : 'tray-icon.png');
  tray = new Tray(trayIconPath);

  const trayMenu = Menu.buildFromTemplate([
    {
      label: '显示宠物',
      click: () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
          return;
        }

        requestPetShow();
      }
    },
    {
      label: '隐藏宠物',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          requestPetHide();
        }
      }
    },
    { type: 'separator' },
    {
      label: '设置',
      click: () => sendContextAction('settings')
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('AI桌面宠物');
  tray.setContextMenu(trayMenu);
  tray.on('click', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    requestPetShow();
  });
}

async function resolveWeatherLocation() {
  const cached = store.get('locationCache');
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  if (cached && cached.timestamp && (now - cached.timestamp) < oneDayMs) {
    return cached;
  }

  try {
    const response = await fetch('http://ip-api.com/json/?fields=status,message,lat,lon,city,country');
    const payload = await response.json();

    if (!response.ok || payload.status !== 'success') {
      return null;
    }

    if (!Number.isFinite(payload.lat) || !Number.isFinite(payload.lon)) {
      return null;
    }

    const nextLocation = {
      lat: payload.lat,
      lon: payload.lon,
      city: payload.city || '',
      country: payload.country || '',
      timestamp: now
    };
    store.set('locationCache', nextLocation);
    return nextLocation;
  } catch (_error) {
    return cached || null;
  }
}

function checkDailyLimit() {
  const today = new Date().toISOString().slice(0, 10);
  const record = store.get('dailyUsage') || { date: '', count: 0 };

  if (record.date !== today) {
    store.set('dailyUsage', { date: today, count: 0 });
    return { allowed: true, remaining: DAILY_LIMIT };
  }

  if (record.count >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: DAILY_LIMIT - record.count };
}

function incrementDailyUsage() {
  const today = new Date().toISOString().slice(0, 10);
  const record = store.get('dailyUsage') || { date: '', count: 0 };

  if (record.date !== today) {
    store.set('dailyUsage', { date: today, count: 1 });
  } else {
    store.set('dailyUsage', { date: today, count: record.count + 1 });
  }
}

function getLlmRuntimeConfig() {
  const userApiKey = store.get('llmApiKey');
  const isBuiltIn = !userApiKey;
  return {
    isBuiltIn,
    apiKey: userApiKey || BUILT_IN_LLM.apiKey,
    provider: isBuiltIn ? BUILT_IN_LLM.provider : (store.get('llmProvider') || 'deepseek'),
    model: isBuiltIn ? BUILT_IN_LLM.model : (store.get('llmModel') || 'deepseek-chat'),
    baseUrl: isBuiltIn ? BUILT_IN_LLM.baseUrl : (store.get('llmBaseUrl') || 'https://api.deepseek.com/v1')
  };
}

function createWindow() {
  const workArea = getWorkAreaBounds();
  isWindowReady = false;
  windowCreatedAt = Date.now();

  mainWindow = new BrowserWindow({
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: workArea.height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media' || permission === 'microphone' || permission === 'audioCapture') {
      callback(true);
    } else {
      callback(false);
    }
  });

  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.webContents.on('context-menu', () => {
    const contextMenu = buildContextMenu();
    contextMenu.popup({ window: mainWindow });
  });

  mainWindow.on('close', (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    if (isWindowReady) {
      requestPetHide();
    } else {
      mainWindow.hide();
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    isWindowReady = true;
    isPetVisible = true;
    isPetHiding = false;
    const snapshot = systemMonitor.getSnapshot();
    if (snapshot && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send('system:metrics', snapshot);
    }
  });

  mainWindow.on('closed', () => {
    isWindowReady = false;
    windowCreatedAt = 0;
    isPetVisible = false;
    isPetHiding = false;
  });
}

async function handleLlmChat(messages, options = {}) {
  const { isBuiltIn, apiKey, provider, model, baseUrl } = getLlmRuntimeConfig();

  if (isBuiltIn) {
    const limit = checkDailyLimit();
    if (!limit.allowed) {
      return { error: 'daily_limit', message: '今天的免费对话次数用完了，明天再来聊，或者在设置中配置自己的 API Key。' };
    }
    incrementDailyUsage();
  }

  try {
    if (provider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: 300,
          system: options.systemPrompt || '',
          messages
        })
      });

      const data = await response.json();
      if (!response.ok) {
        return { error: 'api_error', message: data?.error?.message || 'Anthropic 请求失败' };
      }

      return { content: data.content?.[0]?.text || '今天先安静陪着你。' };
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        messages: [
          { role: 'system', content: options.systemPrompt || '' },
          ...messages
        ]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return { error: 'api_error', message: data?.error?.message || 'LLM 请求失败' };
    }

    return { content: data.choices?.[0]?.message?.content || '我现在有点安静，等会再聊。' };
  } catch (error) {
    return { error: 'network_error', message: error.message || '网络连接失败，请检查网络' };
  }
}

async function streamOpenAiCompatible(response, sendChunk) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) {
        continue;
      }

      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') {
        continue;
      }

      try {
        const payload = JSON.parse(data);
        const chunk = payload.choices?.[0]?.delta?.content || payload.choices?.[0]?.message?.content || '';
        if (chunk) {
          sendChunk(chunk);
        }
      } catch (_error) {
      }
    }
  }
}

async function streamAnthropic(response, sendChunk) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) {
        continue;
      }

      const data = line.slice(5).trim();
      if (!data) {
        continue;
      }

      try {
        const payload = JSON.parse(data);
        const chunk = payload.delta?.text || '';
        if (chunk) {
          sendChunk(chunk);
        }
      } catch (_error) {
      }
    }
  }
}

async function handleLlmChatStream(webContents, requestId, messages, options = {}) {
  const { isBuiltIn, apiKey, provider, model, baseUrl } = getLlmRuntimeConfig();
  const sendEvent = (payload) => {
    if (!webContents.isDestroyed()) {
      webContents.send('llm:stream-event', { requestId, ...payload });
    }
  };

  if (isBuiltIn) {
    const limit = checkDailyLimit();
    if (!limit.allowed) {
      sendEvent({ type: 'error', error: 'daily_limit', message: '今天的免费对话次数用完了，明天再来聊，或者在设置中配置自己的 API Key。' });
      return;
    }
    incrementDailyUsage();
  }

  try {
    sendEvent({ type: 'start' });

    if (provider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: 300,
          stream: true,
          system: options.systemPrompt || '',
          messages
        })
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        sendEvent({ type: 'error', error: 'api_error', message: data?.error?.message || 'Anthropic 流式请求失败' });
        return;
      }

      await streamAnthropic(response, (chunk) => sendEvent({ type: 'chunk', chunk }));
      sendEvent({ type: 'done' });
      return;
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        stream: true,
        max_tokens: 300,
        messages: [
          { role: 'system', content: options.systemPrompt || '' },
          ...messages
        ]
      })
    });

    if (!response.ok || !response.body) {
      const data = await response.json().catch(() => ({}));
      sendEvent({ type: 'error', error: 'api_error', message: data?.error?.message || '流式请求失败' });
      return;
    }

    await streamOpenAiCompatible(response, (chunk) => sendEvent({ type: 'chunk', chunk }));
    sendEvent({ type: 'done' });
  } catch (error) {
    sendEvent({ type: 'error', error: 'network_error', message: error.message || '网络连接失败，请检查网络' });
  }
}

function registerIpc() {
  ipcMain.handle('screen:get-size', () => {
    const workArea = getWorkAreaBounds();
    return {
      width: workArea.width,
      height: workArea.height
    };
  });

  ipcMain.handle('store:get', (_event, key) => {
    return store.get(key);
  });

  ipcMain.on('store:set', (_event, key, value) => {
    store.set(key, value);
  });

  ipcMain.handle('llm:chat', (_event, messages, options = {}) => {
    return handleLlmChat(messages, options);
  });

  ipcMain.on('notification:show', (_event, title, body) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  });

  ipcMain.on('llm:chat-stream', (event, requestId, messages, options = {}) => {
    handleLlmChatStream(event.sender, requestId, messages, options);
  });

  ipcMain.on('window:set-ignore-mouse-events', (_event, ignore, options = { forward: true }) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    mainWindow.setIgnoreMouseEvents(Boolean(ignore), options);
  });

  ipcMain.on('app:set-auto-launch', (_event, enabled) => {
    app.setLoginItemSettings({
      openAtLogin: Boolean(enabled),
      openAsHidden: true
    });
    store.set('autoLaunch', Boolean(enabled));
  });

  ipcMain.handle('app:get-auto-launch', () => {
    return store.get('autoLaunch', false);
  });

  ipcMain.handle('system:get-snapshot', () => {
    return systemMonitor.getSnapshot();
  });

  ipcMain.on('pet:hide-done', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
    }
    isPetVisible = false;
    isPetHiding = false;
  });

  ipcMain.handle('weather:get-location', async () => {
    return resolveWeatherLocation();
  });
}

app.whenReady().then(async () => {
  await initStore();
  registerIpc();
  createWindow();
  createTray();
  try {
    globalShortcut.register('CommandOrControl+Shift+P', () => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        return;
      }
      requestPetShow({ withVoice: true });
    });
  } catch (_error) {
  }

  systemMonitor.start((snapshot) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system:metrics', snapshot);
    }
  });

  const updateConfigPath = path.join(process.resourcesPath, 'app-update.yml');
  if (autoUpdater && app.isPackaged && fs.existsSync(updateConfigPath)) {
    autoUpdater.checkForUpdatesAndNotify();
    autoUpdater.on('update-available', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-available');
      }
    });
    autoUpdater.on('update-downloaded', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-downloaded');
      }
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      return;
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      requestPetShow();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  systemMonitor.stop();
});
