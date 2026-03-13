export class QtSystemController {
  constructor() {
    this.trayReady = false;
    this.hotkeyRegistered = false;
    this.windowVisible = false;
    this.lastAction = 'none';
  }

  setupTray() {
    this.trayReady = true;
    this.lastAction = 'tray_ready';
  }

  registerHotkey() {
    this.hotkeyRegistered = true;
    this.lastAction = 'hotkey_ready';
  }

  showWindow() {
    this.windowVisible = true;
    this.lastAction = 'show_window';
  }

  hideWindow() {
    this.windowVisible = false;
    this.lastAction = 'hide_window';
  }

  snapshot() {
    return {
      trayReady: this.trayReady,
      hotkeyRegistered: this.hotkeyRegistered,
      windowVisible: this.windowVisible,
      lastAction: this.lastAction
    };
  }
}
