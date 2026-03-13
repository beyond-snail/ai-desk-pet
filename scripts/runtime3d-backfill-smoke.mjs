import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { GameplaySystem } from '../runtime/godot/gameplay-system.mjs';
import { PersistenceStore } from '../runtime/qt-sidecar/persistence-store.mjs';

const gameplay = new GameplaySystem();
gameplay.applyAction('feed');
gameplay.applyAction('pet');
gameplay.applyAction('clean');
gameplay.setFocusActive(true);
for (let i = 0; i < 120; i += 1) {
  gameplay.tick(1000);
}
gameplay.setFocusActive(false);
gameplay.updateEnvironment({ weather: 'rain', systemLoad: 'high' });
gameplay.addMemoryFact('用户喜欢下雨天听轻音乐');
gameplay.appendChat({ role: 'user', text: '今晚想早点睡' });
const gameplaySnapshot = gameplay.snapshot();

if (gameplaySnapshot.focus.todayMinutes <= 1) {
  throw new Error('focus minutes did not increase');
}
if (gameplaySnapshot.environment.weather !== 'rain') {
  throw new Error('weather state not updated');
}
if (gameplaySnapshot.memory.facts.length === 0 || gameplaySnapshot.memory.recentChats.length === 0) {
  throw new Error('memory/chat backfill state missing');
}

const storePath = resolve('.runtime3d/backfill-smoke-state.json');
rmSync(storePath, { force: true });

const storeA = new PersistenceStore(storePath);
storeA.setSetting('runtime3d.focus.enabled', true);
storeA.appendMemory('用户偏好：深色主题');
storeA.appendChat({ role: 'assistant', text: '收到，我会记住。', timestamp: Date.now() });
storeA.setPets([
  { id: 'default-robot', enabled: true },
  { id: 'helper-pet', enabled: false }
]);

const storeB = new PersistenceStore(storePath);
const persisted = storeB.getState();

if (persisted.settings['runtime3d.focus.enabled'] !== true) {
  throw new Error('persistence setting reload failed');
}
if (!Array.isArray(persisted.memories) || persisted.memories.length === 0) {
  throw new Error('persistence memories reload failed');
}
if (!Array.isArray(persisted.chatHistory) || persisted.chatHistory.length === 0) {
  throw new Error('persistence chat reload failed');
}
if (!Array.isArray(persisted.pets) || persisted.pets.length < 2) {
  throw new Error('persistence pets reload failed');
}

console.log('runtime3d backfill smoke ok');
console.log(
  JSON.stringify(
    {
      focusMinutes: Number(gameplaySnapshot.focus.todayMinutes.toFixed(2)),
      memoryCount: gameplaySnapshot.memory.facts.length,
      persistedChatCount: persisted.chatHistory.length
    },
    null,
    2
  )
);
