const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getScreenSize: () => ipcRenderer.invoke('screen:get-size'),
  storeGet: (key) => ipcRenderer.invoke('store:get', key),
  storeSet: (key, value) => ipcRenderer.send('store:set', key, value),
  llmChat: (messages, options) => ipcRenderer.invoke('llm:chat', messages, options),
  startLlmStream: (requestId, messages, options) => ipcRenderer.send('llm:chat-stream', requestId, messages, options),
  onLlmStreamEvent: (callback) => ipcRenderer.on('llm:stream-event', (_event, payload) => callback(payload)),
  showNotification: (title, body) => ipcRenderer.send('notification:show', title, body),
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('window:set-ignore-mouse-events', ignore, options),
  onContextMenuAction: (callback) => ipcRenderer.on('context-menu-action', (_event, action) => callback(action)),
  setAutoLaunch: (enabled) => ipcRenderer.send('app:set-auto-launch', enabled),
  getAutoLaunch: () => ipcRenderer.invoke('app:get-auto-launch'),
  getSystemSnapshot: () => ipcRenderer.invoke('system:get-snapshot'),
  onSystemMetrics: (callback) => ipcRenderer.on('system:metrics', (_event, payload) => callback(payload)),
  onPetShow: (callback) => ipcRenderer.on('pet:show', () => callback()),
  onPetHide: (callback) => ipcRenderer.on('pet:hide', () => callback()),
  onPetShowWithVoice: (callback) => ipcRenderer.on('pet:show-with-voice', () => callback()),
  notifyHideDone: () => ipcRenderer.send('pet:hide-done'),
  getWeatherLocation: () => ipcRenderer.invoke('weather:get-location')
});
