import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(filePath) {
  return readFileSync(resolve(filePath), 'utf8');
}

function assertPatterns({ id, filePath, patterns }) {
  const content = read(filePath);
  for (const pattern of patterns) {
    if (!content.includes(pattern)) {
      throw new Error(`[runtime3d-parity] ${id} missing "${pattern}" in ${filePath}`);
    }
  }
}

const checks = [
  {
    id: 'bootstrap-loader',
    filePath: 'src/renderer/index.html',
    patterns: [
      'runtime3d/runtime3d-bootstrap.js',
      'components/QuickActions.js',
      'components/PetManager.js'
    ]
  },
  {
    id: 'runtime3d-namespace',
    filePath: 'src/renderer/runtime3d/runtime3d-bootstrap.js',
    patterns: [
      "const PREFIX = 'runtime3d'",
      'runtime3d.feature.flags',
      'runtime3d.multi_pet.state',
      'runtime3d.focus.stats',
      'patchElectronStoreAPI',
      'patchLocalStorageFallback'
    ]
  },
  {
    id: 'role-switching',
    filePath: 'src/renderer/components/PetController.js',
    patterns: [
      'async switchCharacter(characterId)',
      'pet:character-switched',
      'getCharacterOptions()'
    ]
  },
  {
    id: 'role-picker',
    filePath: 'src/renderer/components/CharacterPicker.js',
    patterns: [
      'this.petController.switchCharacter(id)',
      "this.mode = 'switch'"
    ]
  },
  {
    id: 'quick-actions',
    filePath: 'src/renderer/components/QuickActions.js',
    patterns: [
      'data-action="chat"',
      'data-action="feed"',
      'data-action="pet"',
      'data-action="clean"'
    ]
  },
  {
    id: 'chat-domain',
    filePath: 'src/renderer/ai/chat.js',
    patterns: [
      'class ChatManager',
      'processInput(',
      'processInputStream(',
      "storeSet('chatHistory'"
    ]
  },
  {
    id: 'care-domain',
    filePath: 'src/renderer/components/CareSystem.js',
    patterns: [
      'class CareSystem',
      'feed()',
      'pet()',
      'clean()',
      "CustomEvent('care:update'"
    ]
  },
  {
    id: 'growth-domain',
    filePath: 'src/renderer/components/GrowthSystem.js',
    patterns: [
      'class GrowthSystem',
      'addInteraction(type = \'interaction\')',
      'syncFeatureFlags()',
      "storeSet('growthState'"
    ]
  },
  {
    id: 'focus-domain',
    filePath: 'src/renderer/components/FocusMode.js',
    patterns: [
      'class FocusMode',
      'startSession(minutes = 25)',
      'completeWorkSession(durationSeconds, completed = true)',
      "this.storageKey = 'focusModeStats'"
    ]
  },
  {
    id: 'proactive-domain',
    filePath: 'src/renderer/components/ProactiveBehavior.js',
    patterns: [
      'class ProactiveBehavior',
      'startScheduler()',
      'checkLowStateReminder()',
      "storeSet('proactiveTimeGreetings'"
    ]
  },
  {
    id: 'weather-domain',
    filePath: 'src/renderer/services/WeatherService.js',
    patterns: [
      'class WeatherService',
      'getWeatherMoodEffect',
      'getWeatherVisualEffect',
      "CustomEvent('weather:updated'"
    ]
  },
  {
    id: 'multi-pet-domain',
    filePath: 'src/renderer/components/PetManager.js',
    patterns: [
      'class PetManager',
      'canUseMultiPet()',
      'async addPet(characterId',
      'async removePet(instanceId)',
      "storeSet('petManagerState'"
    ]
  }
];

for (const check of checks) {
  assertPatterns(check);
}

console.log('runtime3d parity domains smoke ok');
