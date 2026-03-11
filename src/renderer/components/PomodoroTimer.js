class PomodoroTimer {
  constructor() {
    this.state = 'idle';
    this.remainingSeconds = 0;
    this.tickInterval = null;
    this.workDuration = 25 * 60;
    this.breakDuration = 5 * 60;
    this.timerDisplay = null;
    this.caterpillar = null;
    this.chatBubble = null;
    this.focusMode = null;
    this.proactiveBehavior = null;
    this.memoryManager = null;
    this.handlePetMove = null;
    this.handleCharacterSwitch = null;
    this.phaseStartedAt = 0;
    this.encourageInterval = null;
  }

  init(dependencies) {
    this.caterpillar = dependencies.caterpillar;
    this.chatBubble = dependencies.chatBubble;
    this.focusMode = dependencies.focusMode || null;
    this.proactiveBehavior = dependencies.proactiveBehavior || null;
    this.memoryManager = dependencies.memoryManager || null;
    this.createTimerDisplay();
  }

  createTimerDisplay() {
    this.timerDisplay = document.createElement('div');
    this.timerDisplay.id = 'pomodoro-timer';
    this.timerDisplay.className = 'hidden';
    this.timerDisplay.textContent = 'Focus 25:00';
    document.body.appendChild(this.timerDisplay);

    this.handlePetMove = () => {
      if (!this.timerDisplay.classList.contains('hidden')) {
        this.positionDisplay();
      }
    };

    this.handleCharacterSwitch = () => {
      if (!this.timerDisplay.classList.contains('hidden')) {
        this.positionDisplay();
      }
    };

    window.addEventListener('pet:move', this.handlePetMove);
    window.addEventListener('pet:character-switched', this.handleCharacterSwitch);
  }

  positionDisplay() {
    const petElement = this.caterpillar ? this.caterpillar.getElement() : document.getElementById('caterpillar');
    if (!petElement) {
      return;
    }

    const rect = petElement.getBoundingClientRect();
    this.timerDisplay.style.left = `${rect.left + rect.width / 2 - this.timerDisplay.offsetWidth / 2}px`;
    this.timerDisplay.style.top = `${rect.top - 30}px`;
  }

  start(minutes = 25) {
    if (this.state !== 'idle') {
      return '番茄钟正在进行中，输入“停止专注”可以取消。';
    }

    this.workDuration = minutes * 60;
    this.remainingSeconds = this.workDuration;
    this.state = 'working';
    this.phaseStartedAt = Date.now();
    this.caterpillar.setFocusMode(true);
    if (this.proactiveBehavior && typeof this.proactiveBehavior.setSuppressed === 'function') {
      this.proactiveBehavior.setSuppressed(true);
    }
    if (this.focusMode && typeof this.focusMode.startSession === 'function') {
      this.focusMode.startSession(minutes);
    }
    this.recordMemory('focus:start', { minutes });
    this.chatBubble.show(`开始专注 ${minutes} 分钟，加油。`, 3000);
    this.timerDisplay.classList.remove('hidden');
    this.updateDisplay();
    this.startTick();
    this.startEncouragementLoop();
    return `番茄钟已启动，${minutes} 分钟后提醒你休息。`;
  }

  stop() {
    if (this.state === 'idle') {
      return '当前没有进行中的番茄钟。';
    }

    if (this.focusMode && typeof this.focusMode.cancelSession === 'function') {
      this.focusMode.cancelSession();
    }
    this.recordMemory('focus:cancel');
    this.reset();
    this.chatBubble.show('番茄钟已取消。', 3000);
    return '番茄钟已取消。';
  }

  startTick() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }

    this.tickInterval = setInterval(() => {
      this.remainingSeconds -= 1;
      this.updateDisplay();

      if (this.remainingSeconds <= 0) {
        this.onPhaseComplete();
      }
    }, 1000);
  }

  startEncouragementLoop() {
    if (this.encourageInterval) {
      clearInterval(this.encourageInterval);
    }

    const lines = [
      '保持节奏，你做得很稳。',
      '继续专注，我在这里安静陪你。',
      '再坚持一下，很快就到休息时间。'
    ];

    this.encourageInterval = setInterval(() => {
      if (this.state !== 'working') {
        return;
      }

      if (document.hidden || this.caterpillar.isDragging) {
        return;
      }

      const line = lines[Math.floor(Math.random() * lines.length)];
      this.chatBubble.show(line, 2400);
    }, 5 * 60 * 1000);
  }

  stopEncouragementLoop() {
    if (this.encourageInterval) {
      clearInterval(this.encourageInterval);
      this.encourageInterval = null;
    }
  }

  updateDisplay() {
    const min = Math.floor(this.remainingSeconds / 60);
    const sec = this.remainingSeconds % 60;
    const phase = this.state === 'working' ? 'Focus' : 'Break';
    this.timerDisplay.textContent = `${phase} ${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    this.positionDisplay();
  }

  onPhaseComplete() {
    clearInterval(this.tickInterval);
    this.tickInterval = null;
    this.stopEncouragementLoop();

    if (this.state === 'working') {
      const workedSeconds = Math.max(0, Math.round((Date.now() - this.phaseStartedAt) / 1000));
      let focusResult = null;
      if (this.focusMode && typeof this.focusMode.completeWorkSession === 'function') {
        focusResult = this.focusMode.completeWorkSession(workedSeconds, true);
      }
      this.recordMemory('focus:complete', { durationSeconds: workedSeconds });

      if (window.growthSystem) {
        window.growthSystem.addInteraction('pomodoro');
      }

      this.state = 'break';
      this.remainingSeconds = this.breakDuration;
      this.phaseStartedAt = Date.now();
      this.caterpillar.setFocusMode(false);
      this.caterpillar.playTemporaryAnimation('celebrate', 1050);

      const center = {
        x: this.caterpillar.screenSize.width / 2 - 40,
        y: this.caterpillar.screenSize.height / 2 - 20
      };
      this.caterpillar.moveToTarget(center);
      const report = this.focusMode && focusResult
        ? this.focusMode.getCompletionReport(focusResult)
        : `本次专注 ${Math.max(1, Math.round(workedSeconds / 60))} 分钟，时间到，休息 5 分钟吧。`;
      this.chatBubble.show(`专注完成。${report}`, 6200);
      this.sendNotification('番茄钟', '专注时间结束，休息一下吧！');
      this.startTick();
      return;
    }

    this.reset();
    this.recordMemory('focus:break-finished');
    this.chatBubble.show('休息结束，准备好继续了吗？', 5000);
    this.sendNotification('番茄钟', '休息结束，可以继续工作了！');
  }

  sendNotification(title, body) {
    if (window.electronAPI && window.electronAPI.showNotification) {
      window.electronAPI.showNotification(title, body);
    }
  }

  reset() {
    clearInterval(this.tickInterval);
    this.tickInterval = null;
    this.stopEncouragementLoop();
    this.state = 'idle';
    this.remainingSeconds = 0;
    this.phaseStartedAt = 0;
    this.timerDisplay.classList.add('hidden');
    this.caterpillar.setFocusMode(false);
    if (this.proactiveBehavior && typeof this.proactiveBehavior.setSuppressed === 'function') {
      this.proactiveBehavior.setSuppressed(false);
    }
  }

  getStatus() {
    if (this.state === 'idle') {
      return null;
    }

    const min = Math.floor(this.remainingSeconds / 60);
    const sec = this.remainingSeconds % 60;
    const phase = this.state === 'working' ? '专注中' : '休息中';
    const stats = this.focusMode && typeof this.focusMode.getStats === 'function'
      ? this.focusMode.getStats()
      : null;
    const statText = stats ? `；今日 ${stats.todayMinutes} 分钟 / 本周 ${stats.weekMinutes} 分钟` : '';
    return `${phase}，剩余 ${min}:${String(sec).padStart(2, '0')}${statText}`;
  }

  getFocusStatsSummary() {
    if (!this.focusMode || typeof this.focusMode.getStats !== 'function') {
      return null;
    }

    const stats = this.focusMode.getStats();
    return `专注统计：今日 ${stats.todayMinutes} 分钟（${stats.completedToday} 次），本周 ${stats.weekMinutes} 分钟（${stats.completedWeek} 次）`;
  }

  recordMemory(type, payload = {}) {
    if (!this.memoryManager || typeof this.memoryManager.record !== 'function') {
      return;
    }

    this.memoryManager.record(type, payload);
  }

  destroy() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    this.stopEncouragementLoop();

    if (this.handlePetMove) {
      window.removeEventListener('pet:move', this.handlePetMove);
      this.handlePetMove = null;
    }

    if (this.handleCharacterSwitch) {
      window.removeEventListener('pet:character-switched', this.handleCharacterSwitch);
      this.handleCharacterSwitch = null;
    }

    if (this.timerDisplay) {
      this.timerDisplay.remove();
      this.timerDisplay = null;
    }
  }
}
