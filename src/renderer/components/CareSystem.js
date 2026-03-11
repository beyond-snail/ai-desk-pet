class CareSystem {
  constructor() {
    const now = Date.now();

    this.state = {
      hunger: 100,
      cleanliness: 100,
      affection: 0,
      lastFedAt: now,
      lastCleanedAt: now,
      lastUpdatedAt: now,
      hungerDepletedAt: null,
      cleanlinessDepletedAt: null
    };
    this.decayInterval = null;
    this.growthSystem = null;
    this.lastFlags = {
      hungerLow: false,
      cleanlinessLow: false,
      affectionLow: false
    };
    this.lastReminderAt = {
      hungerLow: 0,
      cleanlinessLow: 0,
      affectionLow: 0
    };
  }

  setGrowthSystem(growthSystem) {
    this.growthSystem = growthSystem;
  }

  async init() {
    const storedState = await this.loadState();
    if (storedState) {
      this.state = { ...this.state, ...storedState };
    }

    this.applyElapsedDecay(Date.now());
    this.persist();
    this.dispatchUpdate();
    this.startDecayLoop();
    return this.state;
  }

  async loadState() {
    if (!window.electronAPI || !window.electronAPI.storeGet) {
      const fallback = localStorage.getItem('careState');
      return fallback ? JSON.parse(fallback) : null;
    }

    return window.electronAPI.storeGet('careState');
  }

  persist() {
    const snapshot = { ...this.state };

    if (window.electronAPI && window.electronAPI.storeSet) {
      window.electronAPI.storeSet('careState', snapshot);
      return;
    }

    localStorage.setItem('careState', JSON.stringify(snapshot));
  }

  startDecayLoop() {
    if (this.decayInterval) {
      clearInterval(this.decayInterval);
    }

    this.decayInterval = setInterval(() => {
      this.applyElapsedDecay(Date.now());
      this.persist();
      this.dispatchUpdate();
    }, 60 * 1000);
  }

  applyElapsedDecay(now) {
    const lastUpdatedAt = this.state.lastUpdatedAt || now;
    const elapsedHours = Math.max(0, (now - lastUpdatedAt) / (60 * 60 * 1000));

    if (elapsedHours === 0) {
      return;
    }

    const previousHunger = this.state.hunger;
    const previousCleanliness = this.state.cleanliness;
    this.state.hunger = this.clamp(this.state.hunger - elapsedHours * 10, 0, 100);
    this.state.cleanliness = this.clamp(this.state.cleanliness - elapsedHours * 4, 0, 100);
    this.state.affection = this.clamp(this.state.affection - elapsedHours * 3.2, 0, 100);

    if (previousHunger > 0 && this.state.hunger === 0) {
      const hoursUntilEmpty = previousHunger / 10;
      this.state.hungerDepletedAt = lastUpdatedAt + hoursUntilEmpty * 60 * 60 * 1000;
    }

    if (previousCleanliness > 0 && this.state.cleanliness === 0) {
      const hoursUntilDirty = previousCleanliness / 4;
      this.state.cleanlinessDepletedAt = lastUpdatedAt + hoursUntilDirty * 60 * 60 * 1000;
    }

    if (this.state.hunger > 0) {
      this.state.hungerDepletedAt = null;
    }

    if (this.state.cleanliness > 0) {
      this.state.cleanlinessDepletedAt = null;
    }

    this.state.lastUpdatedAt = now;
  }

  getState() {
    return { ...this.state };
  }

  getDerivedMood() {
    if (this.state.hunger <= 0) {
      if (!this.state.hungerDepletedAt) {
        return 'hungry';
      }

      const elapsedHungryMs = Date.now() - this.state.hungerDepletedAt;
      return elapsedHungryMs >= 2 * 60 * 60 * 1000 ? 'sad' : 'hungry';
    }

    if (this.state.hunger < 30) {
      return 'hungry';
    }

    if (this.state.affection < 20) {
      return 'sad';
    }

    return null;
  }

  feed() {
    const now = Date.now();
    this.applyElapsedDecay(now);
    this.state.hunger = this.clamp(this.state.hunger + 20, 0, 100);
    this.state.lastFedAt = now;
    this.state.lastUpdatedAt = now;
    this.state.hungerDepletedAt = this.state.hunger > 0 ? null : this.state.hungerDepletedAt;
    this.persist();
    if (this.growthSystem) {
      this.growthSystem.addInteraction('feed');
    }
    this.dispatchUpdate('咔嚓咔嚓，吃饱啦。');
    return this.getState();
  }

  pet() {
    const now = Date.now();
    this.applyElapsedDecay(now);
    this.state.affection = this.clamp(this.state.affection + 5, 0, 100);
    this.state.lastUpdatedAt = now;
    this.persist();
    if (this.growthSystem) {
      this.growthSystem.addInteraction('pet');
    }
    this.dispatchUpdate('被轻轻摸了摸，心情变好了。');
    return this.getState();
  }

  clean() {
    const now = Date.now();
    this.applyElapsedDecay(now);
    this.state.cleanliness = 100;
    this.state.cleanlinessDepletedAt = null;
    this.state.affection = this.clamp(this.state.affection + 3, 0, 100);
    this.state.lastCleanedAt = now;
    this.state.lastUpdatedAt = now;
    this.persist();
    if (this.growthSystem) {
      this.growthSystem.addInteraction('clean');
    }
    this.dispatchUpdate('清理完成，今天也要闪闪发亮。');
    return this.getState();
  }

  dispatchUpdate(message = '') {
    const state = this.getState();
    const nextFlags = {
      hungerLow: state.hunger < 30,
      cleanlinessLow: state.cleanliness < 30,
      affectionLow: state.affection < 30
    };

    const changedFlags = {
      hungerLow: nextFlags.hungerLow !== this.lastFlags.hungerLow,
      cleanlinessLow: nextFlags.cleanlinessLow !== this.lastFlags.cleanlinessLow,
      affectionLow: nextFlags.affectionLow !== this.lastFlags.affectionLow
    };

    const now = Date.now();
    let autoMessage = '';
    if (!message) {
      if (nextFlags.hungerLow && changedFlags.hungerLow && now - this.lastReminderAt.hungerLow > 60 * 1000) {
        autoMessage = '我有点饿了，记得喂我一下。';
        this.lastReminderAt.hungerLow = now;
      } else if (nextFlags.cleanlinessLow && changedFlags.cleanlinessLow && now - this.lastReminderAt.cleanlinessLow > 60 * 1000) {
        autoMessage = '我身上有点灰，帮我清理一下吧。';
        this.lastReminderAt.cleanlinessLow = now;
      } else if (nextFlags.affectionLow && changedFlags.affectionLow && now - this.lastReminderAt.affectionLow > 60 * 1000) {
        autoMessage = '好久没互动了，摸摸我好吗？';
        this.lastReminderAt.affectionLow = now;
      }
    }

    const detail = {
      state,
      derivedMood: this.getDerivedMood(),
      message: message || autoMessage,
      statusFlags: nextFlags,
      changedFlags
    };

    if (this.growthSystem) {
      this.growthSystem.applyCareState(detail.state);
    }

    window.dispatchEvent(new CustomEvent('care:update', { detail }));
    this.lastFlags = nextFlags;
  }

  clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  destroy() {
    if (this.decayInterval) {
      clearInterval(this.decayInterval);
      this.decayInterval = null;
    }
  }
}
