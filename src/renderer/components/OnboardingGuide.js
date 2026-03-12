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

      await this.delay(800);
      const petName = await this.askForName();
      if (petName) {
        await this.setValue('petName', petName);
        localStorage.setItem('petName', petName);
        this.chatBubble.show(`${petName}，好名字！我很喜欢。`, 3200);
      } else {
        this.chatBubble.show('没关系，你随时可以在设置里给我起名字。', 3200);
      }
      await this.delay(2200);

      if (this.quickActions && typeof this.quickActions.showForPet === 'function') {
        this.quickActions.showForPet();
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

  askForName() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'pet-name-overlay';
      overlay.style.cssText = `
        position: fixed;
        bottom: 120px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 255, 255, 0.95);
        border-radius: 16px;
        padding: 14px 18px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        display: flex;
        gap: 8px;
        align-items: center;
        z-index: 9999;
        font-family: inherit;
      `;

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = '给我起个名字吧…';
      input.maxLength = 12;
      input.style.cssText = `
        border: none;
        outline: none;
        background: transparent;
        font-size: 14px;
        width: 160px;
        color: #333;
      `;

      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = '好';
      button.style.cssText = `
        border: none;
        background: #6c8ef5;
        color: #fff;
        border-radius: 8px;
        padding: 4px 12px;
        cursor: pointer;
        font-size: 13px;
      `;

      overlay.appendChild(input);
      overlay.appendChild(button);
      document.body.appendChild(overlay);
      input.focus();

      const finish = () => {
        const name = input.value.trim();
        overlay.remove();
        resolve(name || null);
      };

      button.addEventListener('click', finish);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          finish();
          return;
        }

        if (event.key === 'Escape') {
          overlay.remove();
          resolve(null);
        }
      });

      window.setTimeout(() => {
        if (document.body.contains(overlay)) {
          overlay.remove();
          resolve(null);
        }
      }, 10000);
    });
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
