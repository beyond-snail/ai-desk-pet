class IdleBehavior {
  constructor() {
    this.petController = null;
    this.chatBubble = null;
    this.careSystem = null;
    this.checkInterval = null;
    this.lastTriggeredAt = 0;
    this.reminderCount = 0;
    this.maxReminders = 3;
    this.thoughtPool = [
      '要不要一起做点小事？',
      '我在看着你呢。',
      '桌面今天很安静。',
      '我刚刚在想晚点要不要伸个懒腰。'
    ];
    this.reminderMessages = [
      '嘿，你在忙什么呢？',
      '我有点无聊了，来和我聊聊天吧！',
      '你已经很久没理我了，我要去休息了。'
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

    // 重置提醒计数如果有交互
    if (idleMs < 60000) {
      this.reminderCount = 0;
      return;
    }

    // 5分钟无交互：第一次提醒
    if (idleMs >= 5 * 60 * 1000 && this.reminderCount === 0) {
      this.lastTriggeredAt = now;
      this.reminderCount = 1;
      this.petController.setMood('normal', { silent: true });
      this.petController.playTemporaryAnimation('idle-look', 1200);
      this.chatBubble.show(this.reminderMessages[0], 4000);
      return;
    }

    // 10分钟无交互：第二次提醒
    if (idleMs >= 10 * 60 * 1000 && this.reminderCount === 1) {
      this.lastTriggeredAt = now;
      this.reminderCount = 2;
      this.petController.setMood('sad', { silent: true });
      this.petController.playTemporaryAnimation('sad', 1600);
      this.chatBubble.show(this.reminderMessages[1], 4500);
      return;
    }

    // 15分钟无交互：第三次提醒并自动隐藏
    if (idleMs >= 15 * 60 * 1000 && this.reminderCount === 2) {
      this.lastTriggeredAt = now;
      this.reminderCount = 3;
      this.petController.setMood('sad', { silent: true });
      this.petController.playTemporaryAnimation('sad', 2000);
      this.chatBubble.show(this.reminderMessages[2], 5000);
      
      // 5秒后自动隐藏
      setTimeout(() => {
        if (this.petController && this.petController.hide) {
          this.petController.hide();
        }
      }, 5000);
      return;
    }

    // 2分钟无交互：轻度提醒
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

    // 30秒无交互：随机思考
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
