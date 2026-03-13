import { migrateLegacyToRuntime3d } from '../runtime/migration/migrator.mjs';

const samples = [
  {
    name: 'empty',
    legacyState: {}
  },
  {
    name: 'normal',
    legacyState: {
      characterId: 'rainbow-bot',
      selectedCharacter: 'rainbow-bot',
      chatHistory: [{ role: 'user', text: '你好' }],
      interactionMemory: [{ action: 'feed', value: 1 }],
      longTermMemory: [{ fact: '喜欢早睡' }],
      dailyUsage: { used: 2, limit: 20 },
      featureFlags: { localVoice: true },
      autoLaunch: true
    }
  },
  {
    name: 'heavy',
    legacyState: {
      characterId: 'rainbow-bot',
      selectedCharacter: 'rainbow-bot',
      chatHistory: Array.from({ length: 60 }, (_, i) => ({ role: i % 2 ? 'user' : 'assistant', text: `msg-${i}` })),
      interactionMemory: Array.from({ length: 30 }, (_, i) => ({ action: 'pet', score: i })),
      longTermMemory: Array.from({ length: 80 }, (_, i) => ({ fact: `fact-${i}` })),
      dailyUsage: { used: 12, limit: 20 },
      featureFlags: { localVoice: true, experimental: false },
      autoLaunch: false
    }
  }
];

function requirePath(obj, path, sampleName) {
  const value = path.split('.').reduce((acc, key) => (acc && key in acc ? acc[key] : undefined), obj);
  if (value === undefined) {
    throw new Error(`[${sampleName}] missing migrated path: ${path}`);
  }
}

for (const sample of samples) {
  const first = migrateLegacyToRuntime3d({
    legacyState: sample.legacyState,
    runtime3dState: {}
  });
  const second = migrateLegacyToRuntime3d({
    legacyState: sample.legacyState,
    runtime3dState: first.runtime3dState
  });

  if (!first.runtime3dState.runtime3d?.migration?.completed) {
    throw new Error(`[${sample.name}] migration metadata missing completed flag`);
  }
  if (JSON.stringify(first.runtime3dState) !== JSON.stringify(second.runtime3dState)) {
    throw new Error(`[${sample.name}] migration is not idempotent`);
  }
  if (!first.snapshot || !Array.isArray(first.snapshot.migratedKeys)) {
    throw new Error(`[${sample.name}] snapshot format invalid`);
  }

  if (sample.name !== 'empty') {
    requirePath(first.runtime3dState, 'runtime3d.character.id', sample.name);
    requirePath(first.runtime3dState, 'runtime3d.chat.history', sample.name);
    requirePath(first.runtime3dState, 'runtime3d.memory.long_term', sample.name);
  }
}

console.log('runtime3d migration smoke ok');
