function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class GameplaySystem {
  constructor() {
    this.state = {
      care: {
        hunger: 72,
        cleanliness: 76,
        bond: 68
      },
      growth: {
        xp: 12,
        level: 1,
        stage: 'seed'
      },
      focus: {
        active: false,
        todayMinutes: 0,
        sessions: 0
      },
      proactive: {
        lowStateAlerts: 0,
        greetings: 0
      },
      environment: {
        weather: 'clear',
        systemLoad: 'normal'
      },
      memory: {
        facts: [],
        recentChats: []
      }
    };
  }

  applyAction(action) {
    if (action === 'feed') {
      this.state.care.hunger = clamp(this.state.care.hunger + 16, 0, 100);
      this.addXp(2);
      return;
    }
    if (action === 'clean') {
      this.state.care.cleanliness = clamp(this.state.care.cleanliness + 14, 0, 100);
      this.addXp(2);
      return;
    }
    if (action === 'pet') {
      this.state.care.bond = clamp(this.state.care.bond + 10, 0, 100);
      this.addXp(3);
      return;
    }
    if (action === 'celebrate') {
      this.state.care.bond = clamp(this.state.care.bond + 4, 0, 100);
      this.addXp(1);
      return;
    }
    if (action === 'drop') {
      this.state.care.cleanliness = clamp(this.state.care.cleanliness - 1, 0, 100);
    }
  }

  setFocusActive(active) {
    const next = Boolean(active);
    if (next && !this.state.focus.active) {
      this.state.focus.sessions += 1;
    }
    this.state.focus.active = next;
  }

  updateEnvironment({ weather, systemLoad }) {
    if (weather) {
      this.state.environment.weather = weather;
    }
    if (systemLoad) {
      this.state.environment.systemLoad = systemLoad;
    }
  }

  addMemoryFact(fact) {
    if (!fact) {
      return;
    }
    this.state.memory.facts.unshift(String(fact));
    this.state.memory.facts = this.state.memory.facts.slice(0, 30);
  }

  appendChat(chat) {
    if (!chat) {
      return;
    }
    this.state.memory.recentChats.push(chat);
    this.state.memory.recentChats = this.state.memory.recentChats.slice(-20);
  }

  tick(deltaMs) {
    const minutes = deltaMs / 60000;
    this.state.care.hunger = clamp(this.state.care.hunger - minutes * 0.36, 0, 100);
    this.state.care.cleanliness = clamp(this.state.care.cleanliness - minutes * 0.28, 0, 100);
    this.state.care.bond = clamp(this.state.care.bond - minutes * 0.18, 0, 100);

    if (this.state.focus.active) {
      this.state.focus.todayMinutes += minutes;
    }

    if (this.state.care.hunger < 25 || this.state.care.cleanliness < 25 || this.state.care.bond < 20) {
      this.state.proactive.lowStateAlerts += 1;
    }
  }

  addXp(xp) {
    this.state.growth.xp += xp;
    while (this.state.growth.xp >= this.state.growth.level * 20) {
      this.state.growth.xp -= this.state.growth.level * 20;
      this.state.growth.level += 1;
      if (this.state.growth.level >= 12) {
        this.state.growth.stage = 'mature';
      } else if (this.state.growth.level >= 5) {
        this.state.growth.stage = 'juvenile';
      }
    }
  }

  snapshot() {
    return JSON.parse(JSON.stringify(this.state));
  }
}
