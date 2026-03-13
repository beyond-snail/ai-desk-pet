export class InteractionController {
  constructor() {
    this.quickMenuVisible = false;
    this.triggered = [];
  }

  onSingleClick() {
    this.quickMenuVisible = true;
    this.triggered.push({ action: 'menu.open', trigger: 'single_click' });
  }

  onMenuAction(action) {
    if (!this.quickMenuVisible) {
      this.quickMenuVisible = true;
    }
    this.triggered.push({ action, trigger: 'menu' });
    return { action, trigger: 'menu' };
  }

  onDoubleClick() {
    this.triggered.push({ action: 'celebrate', trigger: 'double_click' });
    return { action: 'celebrate', trigger: 'double_click' };
  }

  onDragDrop() {
    this.triggered.push({ action: 'drop', trigger: 'drag_drop' });
    return { action: 'drop', trigger: 'drag_drop' };
  }

  snapshot() {
    return {
      quickMenuVisible: this.quickMenuVisible,
      triggered: [...this.triggered]
    };
  }
}
