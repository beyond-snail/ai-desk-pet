(() => {
  const PREFIX = 'runtime3d';

  const KEY_MAP = {
    characterId: 'runtime3d.character.id',
    selectedCharacter: 'runtime3d.character.selected',
    petManagerState: 'runtime3d.multi_pet.state',
    growthState: 'runtime3d.growth.state',
    careState: 'runtime3d.care.state',
    chatHistory: 'runtime3d.chat.history',
    longTermMemory: 'runtime3d.memory.long_term',
    featureFlags: 'runtime3d.feature.flags',
    focusModeStats: 'runtime3d.focus.stats',
    proactiveTimeGreetings: 'runtime3d.proactive.time_greetings',
    lastShutdownAt: 'runtime3d.system.last_shutdown_at',
    growthDiary: 'runtime3d.growth.diary',
    weatherApiKey: 'runtime3d.weather.api_key',
    weatherCity: 'runtime3d.weather.city',
    llmApiKey: 'runtime3d.llm.api_key',
    llmProvider: 'runtime3d.llm.provider',
    llmModel: 'runtime3d.llm.model',
    llmBaseUrl: 'runtime3d.llm.base_url'
  };
  const LEGACY_BY_RUNTIME3D = Object.fromEntries(
    Object.entries(KEY_MAP).map(([legacyKey, runtime3dKey]) => [runtime3dKey, legacyKey])
  );

  function resolveRuntime3dKey(input) {
    const key = String(input || '').trim();
    if (!key) {
      return `${PREFIX}.unknown`;
    }

    if (KEY_MAP[key]) {
      return KEY_MAP[key];
    }

    if (key.startsWith(`${PREFIX}.`)) {
      return key;
    }

    if (key.includes('.')) {
      return `${PREFIX}.${key}`;
    }

    return `${PREFIX}.${key}`;
  }

  function patchElectronStoreAPI() {
    if (!window.electronAPI) {
      return;
    }

    const api = window.electronAPI;

    if (typeof api.storeGet === 'function') {
      const originalGet = api.storeGet.bind(api);
      api.storeGet = async (key) => {
        const runtime3dKey = resolveRuntime3dKey(key);
        const namespacedValue = await originalGet(runtime3dKey);
        if (namespacedValue !== undefined) {
          return namespacedValue;
        }

        const legacyKey = LEGACY_BY_RUNTIME3D[runtime3dKey] || String(key || '').trim();
        if (legacyKey && legacyKey !== runtime3dKey) {
          return originalGet(legacyKey);
        }

        return namespacedValue;
      };
    }

    if (typeof api.storeSet === 'function') {
      const originalSet = api.storeSet.bind(api);
      api.storeSet = (key, value) => originalSet(resolveRuntime3dKey(key), value);
    }
  }

  function patchLocalStorageFallback() {
    const originalGetItem = window.localStorage.getItem.bind(window.localStorage);
    const originalSetItem = window.localStorage.setItem.bind(window.localStorage);

    window.localStorage.getItem = (key) => {
      const runtime3dKey = resolveRuntime3dKey(key);
      const namespacedValue = originalGetItem(runtime3dKey);
      if (namespacedValue !== null) {
        return namespacedValue;
      }

      const legacyKey = LEGACY_BY_RUNTIME3D[runtime3dKey] || String(key || '').trim();
      if (legacyKey && legacyKey !== runtime3dKey) {
        return originalGetItem(legacyKey);
      }

      return namespacedValue;
    };
    window.localStorage.setItem = (key, value) => originalSetItem(resolveRuntime3dKey(key), value);
  }

  window.runtime3d = {
    version: 'cleanroom-v1',
    resolveKey: resolveRuntime3dKey
  };

  patchElectronStoreAPI();
  patchLocalStorageFallback();
})();
