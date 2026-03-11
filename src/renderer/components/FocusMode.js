class FocusMode {
  constructor() {
    this.storageKey = 'focusModeStats';
    this.sessions = [];
    this.activeSession = null;
    this.maxSessions = 400;
    this.retainMs = 120 * 24 * 60 * 60 * 1000;
  }

  async init() {
    const stored = await this.load();
    if (stored && Array.isArray(stored.sessions)) {
      this.sessions = stored.sessions;
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
      return { sessions: [] };
    }

    try {
      return JSON.parse(fallback);
    } catch (_error) {
      return { sessions: [] };
    }
  }

  persist() {
    const payload = {
      sessions: this.sessions.slice(-this.maxSessions)
    };

    if (window.electronAPI && window.electronAPI.storeSet) {
      window.electronAPI.storeSet(this.storageKey, payload);
      return;
    }

    localStorage.setItem(this.storageKey, JSON.stringify(payload));
  }

  prune(now) {
    this.sessions = this.sessions
      .filter((session) => session && Number.isFinite(session.at) && now - session.at <= this.retainMs)
      .slice(-this.maxSessions);
  }

  startSession(minutes = 25) {
    this.activeSession = {
      startedAt: Date.now(),
      plannedMinutes: minutes
    };
  }

  completeWorkSession(durationSeconds, completed = true) {
    const now = Date.now();
    const plannedMinutes = this.activeSession ? this.activeSession.plannedMinutes : 25;
    const session = {
      type: 'focus',
      at: now,
      durationSeconds: Math.max(0, Math.round(durationSeconds)),
      plannedMinutes: plannedMinutes || 25,
      completed: Boolean(completed)
    };

    this.sessions.push(session);
    this.prune(now);
    this.persist();
    this.activeSession = null;
    return {
      session,
      stats: this.getStats(now)
    };
  }

  cancelSession() {
    this.activeSession = null;
  }

  getStats(now = Date.now()) {
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(dayStart);
    const weekDay = weekStart.getDay() || 7;
    weekStart.setDate(weekStart.getDate() - weekDay + 1);

    const todayStartTs = dayStart.getTime();
    const weekStartTs = weekStart.getTime();
    let todaySeconds = 0;
    let weekSeconds = 0;
    let completedToday = 0;
    let completedWeek = 0;

    this.sessions.forEach((session) => {
      if (session.type !== 'focus') {
        return;
      }

      if (session.at >= todayStartTs) {
        todaySeconds += session.durationSeconds;
        if (session.completed) {
          completedToday += 1;
        }
      }

      if (session.at >= weekStartTs) {
        weekSeconds += session.durationSeconds;
        if (session.completed) {
          completedWeek += 1;
        }
      }
    });

    return {
      todayMinutes: Math.round(todaySeconds / 60),
      weekMinutes: Math.round(weekSeconds / 60),
      completedToday,
      completedWeek
    };
  }

  getCompletionReport(result) {
    const stats = result && result.stats ? result.stats : this.getStats();
    const session = result && result.session ? result.session : null;
    const sessionMinutes = session ? Math.max(1, Math.round(session.durationSeconds / 60)) : 0;
    return `本次专注 ${sessionMinutes} 分钟；今日累计 ${stats.todayMinutes} 分钟（${stats.completedToday} 次）；本周累计 ${stats.weekMinutes} 分钟。`;
  }
}
