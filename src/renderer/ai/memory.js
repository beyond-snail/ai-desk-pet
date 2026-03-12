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
    const now = Date.now();
    const parts = [];

    const firstEvent = this.events[0];
    if (firstEvent) {
      const daysSinceFirst = Math.floor((now - firstEvent.at) / (24 * 60 * 60 * 1000));
      if (daysSinceFirst === 0) {
        parts.push('今天是你们第一次见面。');
      } else {
        parts.push(`你们已经相处了 ${daysSinceFirst} 天。`);
      }
    }

    const recentChats = this.events
      .filter((event) => event.type === 'chat:user' && event.payload && event.payload.text)
      .slice(-3)
      .map((event) => event.payload.text);
    if (recentChats.length > 0) {
      parts.push(`用户最近说过："${recentChats.join('"、"')}"`);
    }

    const counters = this.countByType();
    const behaviorParts = [];
    if (counters['care:feed']) {
      behaviorParts.push(`喂食${counters['care:feed']}次`);
    }
    if (counters['care:pet']) {
      behaviorParts.push(`抚摸${counters['care:pet']}次`);
    }
    if (counters['focus:complete']) {
      behaviorParts.push(`完成专注${counters['focus:complete']}次`);
    }
    if (behaviorParts.length > 0) {
      parts.push(`今天互动：${behaviorParts.join('、')}。`);
    }

    return parts.length > 0 ? parts.join('') : '';
  }

  async loadLongTermMemory() {
    try {
      if (window.electronAPI && window.electronAPI.storeGet) {
        return (await window.electronAPI.storeGet('longTermMemory')) || [];
      }

      const raw = localStorage.getItem('longTermMemory');
      return raw ? JSON.parse(raw) : [];
    } catch (_error) {
      return [];
    }
  }

  async saveLongTermMemory(memories) {
    const snapshot = Array.isArray(memories) ? memories.slice(-30) : [];
    if (window.electronAPI && window.electronAPI.storeSet) {
      window.electronAPI.storeSet('longTermMemory', snapshot);
      return;
    }

    localStorage.setItem('longTermMemory', JSON.stringify(snapshot));
  }

  async appendLongTermMemory(fact) {
    if (!fact || fact.trim().length < 3) {
      return;
    }

    const normalized = fact.trim();
    const memories = await this.loadLongTermMemory();
    const latest = memories[memories.length - 1];
    if (latest && latest.text === normalized) {
      return;
    }

    memories.push({ text: normalized, at: Date.now() });
    await this.saveLongTermMemory(memories);
  }

  async getLongTermContext() {
    const memories = await this.loadLongTermMemory();
    if (memories.length === 0) {
      return '';
    }

    const facts = memories.slice(-15).map((memory) => memory.text).join('；');
    return `关于用户你知道：${facts}。`;
  }
}
