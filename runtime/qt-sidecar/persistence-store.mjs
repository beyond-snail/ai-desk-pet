import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const DEFAULT_PATH = resolve('.runtime3d/runtime3d-state.json');

function ensureDir(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function defaultState() {
  return {
    settings: {},
    memories: [],
    chatHistory: [],
    pets: [
      {
        id: 'default-robot',
        enabled: true
      }
    ]
  };
}

export class PersistenceStore {
  constructor(path = DEFAULT_PATH) {
    this.path = path;
    this.state = defaultState();
    this.load();
  }

  load() {
    if (!existsSync(this.path)) {
      this.save();
      return;
    }
    try {
      const parsed = JSON.parse(readFileSync(this.path, 'utf8'));
      this.state = {
        ...defaultState(),
        ...parsed
      };
    } catch {
      this.state = defaultState();
      this.save();
    }
  }

  save() {
    ensureDir(this.path);
    writeFileSync(this.path, JSON.stringify(this.state, null, 2));
  }

  getSetting(key) {
    return this.state.settings[key];
  }

  setSetting(key, value) {
    this.state.settings[key] = value;
    this.save();
  }

  appendMemory(fact) {
    if (!fact) {
      return;
    }
    this.state.memories.unshift(String(fact));
    this.state.memories = this.state.memories.slice(0, 40);
    this.save();
  }

  appendChat(entry) {
    if (!entry) {
      return;
    }
    this.state.chatHistory.push(entry);
    this.state.chatHistory = this.state.chatHistory.slice(-60);
    this.save();
  }

  setPets(pets) {
    this.state.pets = Array.isArray(pets) ? pets : this.state.pets;
    this.save();
  }

  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }
}
