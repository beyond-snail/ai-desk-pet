class IdleBehavior {
  constructor() {
    this.petController = null;
    this.chatBubble = null;
    this.careSystem = null;
    this.checkInterval = null;
    this.lastTriggeredAt = 0;
    this.thoughtPool = [
      '要不要一起做点小事？',
      '我在看着你呢。',
      '桌面今天很安静。',
      '我刚刚在想晚点要不要伸个懒腰。'
    ];
  }

  init(options = {}) {
    this.petController = options.petController || null;
    this.chatBubble = options.chatBubble || null;
    this.careSystem = options.careSystem || null;
    this.start();
  }

  start() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.runChecks();
    }, 18000 + Math.round(Math.random() * 12000));
  }

  runChecks() {
    if (!this.petController || !this.chatBubble || this.isBlocked()) {
      return;
    }

    const now = Date.now();
    if (now - this.lastTriggeredAt < 15000) {
      return;
    }

    const idleMs = now - (this.petController.lastInteractionAt || now);

    if (idleMs >= 5 * 60 * 1000) {
      this.lastTriggeredAt = now;
      this.petController.setMood('sleepy', { silent: true });
      this.petController.playTemporaryAnimation('doze', 2200);
      this.petController.moveToTarget(this.getEdgeRestTarget());
      this.chatBubble.show('我先去边边坐一下，等你叫我。', 4200);
      return;
    }

    if (idleMs >= 2 * 60 * 1000) {
      this.lastTriggeredAt = now;
      this.petController.setMood('sleepy', { silent: true });
      this.petController.playTemporaryAnimation('yawn', 1600);

      if (this.petController.lastPointerPosition) {
        this.petController.moveToTarget(this.getCursorDriftTarget(this.petController.lastPointerPosition));
        this.chatBubble.show('我活动一下，顺便看看你在做什么。', 3800);
      } else {
        this.petController.moveToTarget(this.getWanderTarget());
        this.chatBubble.show('我想换个地方观察一下桌面。', 3600);
      }
      return;
    }

    if (idleMs >= 30000) {
      this.lastTriggeredAt = now;
      this.petController.playTemporaryAnimation('idle-look', 1200);
      this.chatBubble.show(this.thoughtPool[Math.floor(Math.random() * this.thoughtPool.length)], 3200);
    }
  }

  getCursorDriftTarget(pointer) {
    const offsetX = pointer.x + (Math.random() > 0.5 ? -120 : 40);
    const offsetY = pointer.y + (Math.random() * 80 - 40);
    return {
      x: Math.max(24, Math.min(window.innerWidth - 180, offsetX)),
      y: Math.max(24, Math.min(window.innerHeight - 120, offsetY))
    };
  }

  getEdgeRestTarget() {
    const side = Math.random() > 0.5 ? 'right' : 'left';
    return {
      x: side === 'right' ? Math.max(12, window.innerWidth - 180) : 24,
      y: Math.max(18, window.innerHeight - 120)
    };
  }

  getWanderTarget() {
    return {
      x: Math.max(24, Math.min(window.innerWidth - 180, window.innerWidth * (0.18 + Math.random() * 0.64))),
      y: Math.max(24, Math.min(window.innerHeight - 120, window.innerHeight * (0.15 + Math.random() * 0.6)))
    };
  }

  isBlocked() {
    const inputPanel = document.getElementById('input-panel');
    const settingsPanel = document.getElementById('settings-panel');
    const characterPicker = document.getElementById('character-picker');
    const petManagerPanel = document.getElementById('pet-manager-panel');

    return Boolean(
      !this.petController.getElement() ||
      this.petController.isDragging ||
      this.petController.focusMode ||
      document.hidden ||
      (inputPanel && !inputPanel.classList.contains('hidden')) ||
      (settingsPanel && !settingsPanel.classList.contains('hidden')) ||
      (characterPicker && !characterPicker.classList.contains('hidden')) ||
      (petManagerPanel && !petManagerPanel.classList.contains('hidden'))
    );
  }

  destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}
