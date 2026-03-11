class InteractionMemory {
  constructor() {
    this.storageKey = 'interactionMemory';
    this.events = [];
    this.maxEvents = 120;
    this.decayWindowMs = 14 * 24 * 60 * 60 * 1000;
  }

  async init() {
    const stored = await this.load();
    if (Array.isArray(stored)) {
      this.events = stored;
    }
    this.prune(Date.now());
    this.persist();
  }

  async load() {
    if (window.electronAPI && window.electronAPI.storeGet) {
      return window.electronAPI.storeGet(this.storageKey);
    }

    const fallback = localStorage.getItem(this.storageKey);
    if (!fallback) {
      return [];
    }

    try {
      return JSON.parse(fallback);
    } catch (_error) {
      return [];
    }
  }

  persist() {
    const snapshot = this.events.slice(-this.maxEvents);
    if (window.electronAPI && window.electronAPI.storeSet) {
      window.electronAPI.storeSet(this.storageKey, snapshot);
      return;
    }

    localStorage.setItem(this.storageKey, JSON.stringify(snapshot));
  }

  prune(now) {
    this.events = this.events
      .filter((event) => event && Number.isFinite(event.at) && now - event.at <= this.decayWindowMs)
      .slice(-this.maxEvents);
  }

  record(type, payload = {}) {
    if (!type) {
      return;
    }

    const now = Date.now();
    this.prune(now);
    this.events.push({
      type,
      payload,
      at: now
    });
    this.persist();
  }

  getRecent(limit = 10) {
    return this.events.slice(-Math.max(1, limit));
  }

  countByType(windowMs = 24 * 60 * 60 * 1000) {
    const now = Date.now();
    const counters = {};
    this.events.forEach((event) => {
      if (now - event.at > windowMs) {
        return;
      }

      counters[event.type] = (counters[event.type] || 0) + 1;
    });
    return counters;
  }

  getPromptContext() {
    const recent = this.getRecent(10);
    if (recent.length === 0) {
      return '最近还没有互动记忆。';
    }

    const counters = this.countByType();
    const summaryParts = [];
    if (counters['care:feed']) {
      summaryParts.push(`最近24小时喂食 ${counters['care:feed']} 次`);
    }
    if (counters['care:pet']) {
      summaryParts.push(`抚摸 ${counters['care:pet']} 次`);
    }
    if (counters['care:clean']) {
      summaryParts.push(`清洁 ${counters['care:clean']} 次`);
    }
    if (counters['focus:complete']) {
      summaryParts.push(`完成专注 ${counters['focus:complete']} 次`);
    }

    const latestText = recent
      .map((event) => {
        const time = new Date(event.at).toLocaleString();
        return `${time} ${event.type}`;
      })
      .join('；');

    return `互动摘要：${summaryParts.join('，') || '互动较少'}。最近10条：${latestText}`;
  }
}
