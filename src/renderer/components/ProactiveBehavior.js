class ProactiveBehavior {
  constructor() {
    this.checkInterval = null;
    this.lastTriggeredAt = 0;
    this.cooldownMs = 2 * 60 * 1000;
    this.lowStateCooldownMs = 30 * 60 * 1000;
    this.weatherCooldownMs = 45 * 60 * 1000;
    this.mouseMovements = [];
    this.sessionStartedAt = Date.now();
    this.lastShutdownAt = null;
    this.lastWeatherCommentAt = 0;
    this.lastWorkReminderAt = 0;
    this.lastThoughtAt = 0;
    this.lastMousePosition = null;
    this.lastMouseActiveAt = Date.now();
    this.weatherPayload = null;
    this.suppressed = false;
    this.lowStateReminderAt = {
      hunger: 0,
      cleanliness: 0,
      affection: 0
    };
    this.timeGreetingMarks = {};
    this.mouseMoveHandler = null;
    this.beforeUnloadHandler = null;
    this.weatherUpdateHandler = null;
    this.thoughtPools = {
      idle: [
        '你专注的时候，我也会安静陪着。',
        '今天桌面节奏不错。',
        '如果累了，记得喝口水。',
        '我刚刚在想，要不要陪你做个小目标。',
        '有时候我会盯着屏幕发呆，你呢？',
        '你今天看起来很忙的样子。',
        '我在这里，随时可以聊。',
        '窗口开了好多，你在忙什么？',
        '偶尔休息一下眼睛，看看远处。',
        '我觉得你今天做得不错。'
      ],
      morning: [
        '早上好，今天也要好好的。',
        '新的一天，从这里开始。',
        '早安，昨晚睡得好吗？',
        '今天想先完成哪件事？'
      ],
      afternoon: [
        '下午了，要不要喝杯水？',
        '午后容易犯困，要不要活动一下？',
        '今天下午的进展怎么样？',
        '如果卡住了，先深呼吸一下。'
      ],
      evening: [
        '辛苦了一天，晚上放松一下吧。',
        '今天完成了什么，可以告诉我。',
        '晚上了，不用太拼，明天继续。',
        '要不要先把最重要的一件事收个尾？'
      ],
      idle_long: [
        '你好像很久没理我了，还在吗？',
        '我在这里等你，不着急。',
        '有什么想聊的吗？',
        '我一直在，回来时叫我一声就好。'
      ],
      focus_done: [
        '专注结束了，休息一下吧。',
        '你刚才很专注，我都不敢打扰你。',
        '完成了！要继续还是休息一会儿？',
        '这个节奏很棒，继续保持。'
      ]
    };
    // 兼容旧调用
    this.thoughtPool = this.thoughtPools.idle;
  }

  async init(dependencies) {
    this.caterpillar = dependencies.caterpillar;
    this.chatBubble = dependencies.chatBubble;
    this.careSystem = dependencies.careSystem;
    this.weatherService = dependencies.weatherService || null;
    if (this.weatherService && this.weatherService.currentWeather) {
      this.weatherPayload = {
        currentWeather: this.weatherService.currentWeather,
        dayPart: typeof this.weatherService.getDayPart === 'function' ? this.weatherService.getDayPart() : null
      };
    }

    await this.loadLastShutdown();
    await this.loadGreetingMarks();
    this.bindMouseTracking();
    this.bindWeatherTracking();
    this.checkGreeting();
    this.startScheduler();
    this.registerShutdownHook();
  }

  async loadLastShutdown() {
    if (!window.electronAPI || !window.electronAPI.storeGet) {
      const fallback = localStorage.getItem('lastShutdownAt');
      this.lastShutdownAt = fallback ? Number(fallback) : null;
      return;
    }

    this.lastShutdownAt = await window.electronAPI.storeGet('lastShutdownAt');
  }

  registerShutdownHook() {
    this.beforeUnloadHandler = () => {
      const timestamp = Date.now();

      if (window.electronAPI && window.electronAPI.storeSet) {
        window.electronAPI.storeSet('lastShutdownAt', timestamp);
        return;
      }

      localStorage.setItem('lastShutdownAt', String(timestamp));
    };

    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }

  async loadGreetingMarks() {
    if (window.electronAPI && window.electronAPI.storeGet) {
      const stored = await window.electronAPI.storeGet('proactiveTimeGreetings');
      if (stored && typeof stored === 'object') {
        this.timeGreetingMarks = stored;
      }
      return;
    }

    const stored = localStorage.getItem('proactiveTimeGreetings');
    if (!stored) {
      return;
    }

    try {
      this.timeGreetingMarks = JSON.parse(stored) || {};
    } catch (_error) {
      this.timeGreetingMarks = {};
    }
  }

  persistGreetingMarks() {
    if (window.electronAPI && window.electronAPI.storeSet) {
      window.electronAPI.storeSet('proactiveTimeGreetings', this.timeGreetingMarks);
      return;
    }

    localStorage.setItem('proactiveTimeGreetings', JSON.stringify(this.timeGreetingMarks));
  }

  bindMouseTracking() {
    this.mouseMoveHandler = (event) => {
      const now = Date.now();
      this.mouseMovements.push(now);
      this.mouseMovements = this.mouseMovements.filter((timestamp) => now - timestamp < 5000);
      this.lastMouseActiveAt = now;
      this.lastMousePosition = { x: event.clientX, y: event.clientY };
    };

    document.addEventListener('mousemove', this.mouseMoveHandler);
  }

  bindWeatherTracking() {
    this.weatherUpdateHandler = (event) => {
      this.weatherPayload = event.detail || null;
    };

    window.addEventListener('weather:updated', this.weatherUpdateHandler);
  }

  checkGreeting() {
    if (this.lastShutdownAt) {
      const awayMs = Date.now() - this.lastShutdownAt;
      const awayHours = awayMs / (1000 * 60 * 60);
      const returnKey = `returnGreeting_${new Date().toDateString()}`;

      if (awayHours >= 4 && !this.timeGreetingMarks[returnKey]) {
        this.timeGreetingMarks[returnKey] = true;
        this.persistGreetingMarks();

        let message;
        if (awayHours >= 24) {
          const days = Math.floor(awayHours / 24);
          message = days >= 2
            ? `你去哪了，${days}天没见到你了。`
            : '昨天你走了之后，我一直在等你回来。';
        } else {
          const hours = Math.floor(awayHours);
          message = `你离开了${hours}个小时，我有点想你。`;
        }

        window.setTimeout(() => {
          if (this.chatBubble && !this.suppressed) {
            this.chatBubble.show(message, 5000);
          }
        }, 1500);
        return;
      }
    }

    window.setTimeout(() => {
      this.checkTimeGreeting(true);
    }, 1200);
  }

  startScheduler() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.runChecks();
    }, 2 * 60 * 1000);
  }

  runChecks() {
    if (this.suppressed || this.isBlocked() || this.isCoolingDown()) {
      return;
    }

    if (this.checkLowStateReminder()) {
      return;
    }

    if (this.checkTimeGreeting()) {
      return;
    }

    if (this.checkWeatherComment()) {
      return;
    }

    if (this.checkWorkReminder()) {
      return;
    }

    if (this.checkAffectionBehavior()) {
      return;
    }

    this.checkRandomThought();
  }

  checkLowStateReminder() {
    const state = this.careSystem.getState();
    const now = Date.now();

    if (state.hunger < 20 && now - this.lowStateReminderAt.hunger >= this.lowStateCooldownMs) {
      this.lowStateReminderAt.hunger = now;
      this.recordTrigger(now);
      this.caterpillar.moveToTarget({
        x: Math.max(80, Math.round(window.innerWidth * 0.45)),
        y: Math.max(80, Math.round(window.innerHeight * 0.35))
      });
      this.chatBubble.show('肚子好饿...能喂我点东西吗？', 5200);
      return true;
    }

    if (state.cleanliness < 20 && now - this.lowStateReminderAt.cleanliness >= this.lowStateCooldownMs) {
      this.lowStateReminderAt.cleanliness = now;
      this.recordTrigger(now);
      this.chatBubble.show('我好像有点脏了...', 5000);
      return true;
    }

    if (state.affection < 20 && now - this.lowStateReminderAt.affection >= this.lowStateCooldownMs) {
      this.lowStateReminderAt.affection = now;
      this.recordTrigger(now);
      this.chatBubble.show('好久没有摸摸我了...', 5000);
      return true;
    }

    return false;
  }

  getActiveTimeSlot(now = new Date()) {
    const hour = now.getHours();
    const minute = now.getMinutes();
    const totalMinutes = hour * 60 + minute;

    if (totalMinutes >= 6 * 60 && totalMinutes < 10 * 60) {
      return 'morning';
    }
    if (totalMinutes >= 11 * 60 + 30 && totalMinutes < 13 * 60) {
      return 'lunch';
    }
    if (totalMinutes >= 18 * 60 && totalMinutes < 20 * 60) {
      return 'evening';
    }
    if (totalMinutes >= 23 * 60 || totalMinutes < 5 * 60) {
      return 'lateNight';
    }

    return null;
  }

  getDateKey(timestamp = Date.now()) {
    return new Date(timestamp).toISOString().slice(0, 10);
  }

  checkTimeGreeting(force = false) {
    const now = new Date();
    const slot = this.getActiveTimeSlot(now);
    if (!slot) {
      return false;
    }

    const nowTs = now.getTime();
    if (!force && this.isUserBusy()) {
      return false;
    }

    if (slot === 'morning' && this.isSameDay(this.lastShutdownAt, nowTs)) {
      return false;
    }

    const dateKey = this.getDateKey(nowTs);
    if (this.timeGreetingMarks[slot] === dateKey) {
      return false;
    }

    const messageMap = {
      morning: '早上好！今天也要加油哦～',
      lunch: '该吃午饭了，别忘了休息一下。',
      evening: '辛苦了一天，晚上放松一下吧。',
      lateNight: '这么晚了还在忙？注意休息呀。'
    };

    this.timeGreetingMarks[slot] = dateKey;
    this.persistGreetingMarks();
    this.recordTrigger(nowTs);
    if (slot === 'lateNight') {
      this.caterpillar.setMood('sleepy', { silent: true });
    }
    this.chatBubble.show(messageMap[slot], 5200);
    return true;
  }

  checkWeatherComment() {
    if (!this.weatherPayload || !this.weatherPayload.currentWeather) {
      return false;
    }

    const now = Date.now();
    if (now - this.lastWeatherCommentAt < this.weatherCooldownMs) {
      return false;
    }

    if (Math.random() > 0.45) {
      return false;
    }

    const weather = this.weatherPayload.currentWeather;
    const text = String(weather.text || '');
    const temp = Number(weather.temp);
    let message = '';

    if (text.includes('雨')) {
      message = '外面在下雨呢，出门记得带伞。';
    } else if (Number.isFinite(temp) && temp > 35) {
      message = '今天好热，多喝水。';
    } else if (Number.isFinite(temp) && temp < 5) {
      message = '好冷，注意保暖。';
    }

    if (!message) {
      return false;
    }

    this.lastWeatherCommentAt = now;
    this.recordTrigger(now);
    this.chatBubble.show(message, 4600);
    return true;
  }

  checkWorkReminder() {
    const now = Date.now();
    if (now - this.sessionStartedAt < 2 * 60 * 60 * 1000) {
      return false;
    }

    if (this.lastWorkReminderAt && now - this.lastWorkReminderAt < 2 * 60 * 60 * 1000) {
      return false;
    }

    if (this.isUserBusy()) {
      return false;
    }

    this.recordTrigger(now);
    this.lastWorkReminderAt = now;
    this.chatBubble.show('已经忙很久了，记得起来活动一下。', 5000);
    return true;
  }

  checkAffectionBehavior() {
    const state = this.careSystem.getState();
    if (state.affection < 40 || !this.lastMousePosition || this.isUserBusy()) {
      return false;
    }

    this.recordTrigger(Date.now());
    this.caterpillar.moveToTarget({
      x: Math.max(40, Math.min(window.innerWidth - 120, this.lastMousePosition.x - 100)),
      y: Math.max(40, Math.min(window.innerHeight - 80, this.lastMousePosition.y + 20))
    });
    this.chatBubble.show('我来你附近蹭一蹭。', 4200);
    return true;
  }

  checkRandomThought() {
    const now = Date.now();
    if (this.lastThoughtAt && now - this.lastThoughtAt < 10 * 60 * 1000) {
      return false;
    }

    if (Math.random() > 0.3) {
      return false;
    }

    this.recordTrigger(now);
    this.lastThoughtAt = now;
    this.caterpillar.playTemporaryAnimation('idle-look', 1100);

    const hour = new Date().getHours();
    let pool;
    if (hour >= 5 && hour < 11) {
      pool = this.thoughtPools.morning;
    } else if (hour >= 11 && hour < 17) {
      pool = this.thoughtPools.afternoon;
    } else if (hour >= 17 && hour < 23) {
      pool = this.thoughtPools.evening;
    } else {
      pool = this.thoughtPools.idle;
    }

    const inactiveLong = now - this.lastMouseActiveAt >= 20 * 60 * 1000;
    const combined = inactiveLong
      ? [...this.thoughtPools.idle_long, ...pool, ...this.thoughtPools.idle]
      : [...pool, ...this.thoughtPools.idle];
    this.chatBubble.show(combined[Math.floor(Math.random() * combined.length)], 4200);
    return true;
  }

  triggerFocusDone() {
    if (this.suppressed || !this.chatBubble) {
      return;
    }

    const pool = this.thoughtPools.focus_done;
    this.chatBubble.show(pool[Math.floor(Math.random() * pool.length)], 4500);
  }

  recordTrigger(timestamp) {
    this.lastTriggeredAt = timestamp;
  }

  isCoolingDown() {
    return Date.now() - this.lastTriggeredAt < this.cooldownMs;
  }

  isBlocked() {
    const inputPanel = document.getElementById('input-panel');
    const settingsPanel = document.getElementById('settings-panel');
    const characterPickerPanel = document.getElementById('character-picker');
    const petManagerPanel = document.getElementById('pet-manager-panel');
    const typingActive = document.activeElement && document.activeElement.id === 'user-input';
    const inputExpanded = Boolean(
      inputPanel &&
      !inputPanel.classList.contains('hidden') &&
      inputPanel.classList.contains('expanded')
    );
    return Boolean(
      document.hidden ||
      typingActive ||
      this.caterpillar.isDragging ||
      this.caterpillar.focusMode ||
      inputExpanded ||
      (settingsPanel && !settingsPanel.classList.contains('hidden')) ||
      (characterPickerPanel && !characterPickerPanel.classList.contains('hidden')) ||
      (petManagerPanel && !petManagerPanel.classList.contains('hidden'))
    );
  }

  isUserBusy() {
    const inputPanel = document.getElementById('input-panel');
    const typingActive = document.activeElement && document.activeElement.id === 'user-input';
    const inputExpanded = Boolean(
      inputPanel &&
      !inputPanel.classList.contains('hidden') &&
      inputPanel.classList.contains('expanded')
    );
    return this.mouseMovements.length > 22 || typingActive || inputExpanded;
  }

  isSameDay(firstTimestamp, secondTimestamp) {
    if (!firstTimestamp || !secondTimestamp) {
      return false;
    }

    const first = new Date(firstTimestamp);
    const second = new Date(secondTimestamp);

    return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate();
  }

  setSuppressed(suppressed) {
    this.suppressed = Boolean(suppressed);
  }

  destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.mouseMoveHandler) {
      document.removeEventListener('mousemove', this.mouseMoveHandler);
      this.mouseMoveHandler = null;
    }

    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }

    if (this.weatherUpdateHandler) {
      window.removeEventListener('weather:updated', this.weatherUpdateHandler);
      this.weatherUpdateHandler = null;
    }
  }
}
