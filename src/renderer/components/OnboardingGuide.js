class OnboardingGuide {
  constructor(options = {}) {
    this.chatBubble = options.chatBubble || null;
    this.petController = options.petController || null;
    this.quickActions = options.quickActions || null;
    this.running = false;
  }

  async shouldRun() {
    const hasLaunched = await this.getValue('hasLaunched', false);
    return !hasLaunched;
  }

  async start(options = {}) {
    if (this.running || !this.chatBubble || !this.petController) {
      return false;
    }

    this.running = true;
    const runEntrance = typeof options.runEntrance === 'function' ? options.runEntrance : null;
    const onWaitForClick = typeof options.onWaitForClick === 'function' ? options.onWaitForClick : null;
    const onFinished = typeof options.onFinished === 'function' ? options.onFinished : null;

    try {
      if (runEntrance) {
        await runEntrance();
      }

      await this.delay(700);
      this.chatBubble.show('你好呀！我是你的桌面伙伴。', 3200);

      await this.delay(2200);
      this.chatBubble.show('点我一下试试？', 3200);
      if (onWaitForClick) {
        onWaitForClick();
      }
      await this.waitForPetClick();

      if (this.quickActions) {
        this.quickActions.show();
      }
      this.chatBubble.show('你可以和我聊天、喂我吃东西、或者摸摸我。', 4400);

      await this.delay(3000);
      this.chatBubble.show('右键点我还有更多选项。', 3600);

      await this.delay(2300);
      await this.markLaunched();

      if (onFinished) {
        onFinished();
      }

      return true;
    } finally {
      this.running = false;
    }
  }

  waitForPetClick() {
    return new Promise((resolve) => {
      const handler = () => {
        window.removeEventListener('pet:clicked', handler);
        resolve();
      };

      window.addEventListener('pet:clicked', handler, { once: true });
    });
  }

  delay(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  async markLaunched() {
    await this.setValue('hasLaunched', true);
  }

  async getValue(key, fallback) {
    if (window.electronAPI && window.electronAPI.storeGet) {
      const value = await window.electronAPI.storeGet(key);
      return value === undefined || value === null ? fallback : value;
    }

    const value = localStorage.getItem(key);
    if (value === null) {
      return fallback;
    }
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
    return value;
  }

  async setValue(key, value) {
    if (window.electronAPI && window.electronAPI.storeSet) {
      window.electronAPI.storeSet(key, value);
      return;
    }

    localStorage.setItem(key, String(value));
  }
}
