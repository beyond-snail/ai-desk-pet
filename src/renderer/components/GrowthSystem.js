class GrowthSystem {
  constructor() {
    this.currentCharacterId = 'caterpillar';
    this.currentCharacterConfig = null;
    this.statesByCharacter = {};
    this.maxLevel = 10;
    this.levelThresholds = [0, 100, 250, 500, 800, 1200, 1800, 2500, 3500, 5000];
    this.stageThresholds = [0, 100, 500, 1500, 3000];
    this.onLevelUp = null;
    this.onStageChange = null;
    this.onStateChange = null;
    this.usageInterval = null;
    this.lastOpenedOn = null;
  }

  async init(options = {}) {
    this.currentCharacterId = options.characterId || this.currentCharacterId;
    this.currentCharacterConfig = options.characterConfig || null;
    await this.loadState();
    this.ensureCharacterState(this.currentCharacterId, this.currentCharacterConfig);
    await this.recordDailyOpen();
    this.startUsageTracking();
    this.syncFeatureFlags();
    this.dispatchStateChange();
  }

  async setCharacter(characterId, characterConfig = null) {
    this.currentCharacterId = characterId || this.currentCharacterId;
    this.currentCharacterConfig = characterConfig || this.currentCharacterConfig;
    this.ensureCharacterState(this.currentCharacterId, this.currentCharacterConfig);
    this.syncFeatureFlags();
    this.dispatchStateChange();
  }

  ensureCharacterState(characterId, characterConfig = null) {
    if (!this.statesByCharacter[characterId]) {
      this.statesByCharacter[characterId] = this.createDefaultState(characterId, characterConfig);
    }

    const state = this.statesByCharacter[characterId];
    if (characterConfig && characterConfig.growth) {
      state.stageLabels = characterConfig.growth.stageLabels || state.stageLabels;
      state.stageNames = characterConfig.growth.stages || state.stageNames;
    }

    state.characterId = characterId;
    return state;
  }

  createDefaultState(characterId, characterConfig = null) {
    const growth = characterConfig && characterConfig.growth ? characterConfig.growth : {};
    return {
      characterId,
      level: 1,
      exp: 0,
      totalExp: 0,
      growthPoints: 0,
      stage: 0,
      totalMinutes: 0,
      totalInteractions: 0,
      totalFeedings: 0,
      totalChats: 0,
      totalPomodoros: 0,
      unlockedAbilities: [],
      evolvedAt: null,
      stageLabels: growth.stageLabels || ['初始', '成长', '成熟', '进化', '终形'],
      stageNames: growth.stages || ['base', 'growth', 'mature', 'evolved', 'final'],
      lastHungerPenaltyAt: null,
      lastCleanPenaltyAt: null
    };
  }

  getCurrentState() {
    return this.ensureCharacterState(this.currentCharacterId, this.currentCharacterConfig);
  }

  getState() {
    return this.decorateState(this.getCurrentState());
  }

  getCharacterState(characterId) {
    const state = this.ensureCharacterState(characterId, characterId === this.currentCharacterId ? this.currentCharacterConfig : null);
    return this.decorateState(state);
  }

  decorateState(state) {
    const expToNext = this.getExpToNext(state.level);
    return {
      ...state,
      progress: this.getProgress(state.level, state.exp),
      expToNext,
      stageLabel: state.stageLabels[state.stage] || state.stageLabels[state.stageLabels.length - 1] || `阶段 ${state.stage + 1}`
    };
  }

  getExpToNext(level = this.getCurrentState().level) {
    if (level >= this.maxLevel) {
      return Infinity;
    }

    return this.levelThresholds[level] - (level > 1 ? this.levelThresholds[level - 1] : 0);
  }

  getProgress(level = this.getCurrentState().level, exp = this.getCurrentState().exp) {
    if (level >= this.maxLevel) {
      return 1;
    }

    const needed = this.getExpToNext(level);
    return needed > 0 ? Math.min(1, exp / needed) : 0;
  }

  addExp(amount, source = 'unknown') {
    const state = this.getCurrentState();
    if (state.level >= this.maxLevel) {
      return state;
    }

    state.exp += amount;
    state.totalExp += amount;

    while (state.level < this.maxLevel && state.exp >= this.getExpToNext(state.level)) {
      state.exp -= this.getExpToNext(state.level);
      state.level += 1;
      this.handleLevelUp(state, source);
    }

    this.persist();
    this.dispatchStateChange();
    return this.decorateState(state);
  }

  addGrowthPoints(amount, source = 'unknown') {
    const state = this.getCurrentState();
    state.growthPoints = Math.max(0, state.growthPoints + amount);

    const nextStage = this.resolveStage(state.growthPoints);
    if (nextStage !== state.stage) {
      const previousStage = state.stage;
      state.stage = nextStage;
      state.evolvedAt = Date.now();
      if (this.onStageChange) {
        this.onStageChange({
          characterId: state.characterId,
          stage: state.stage,
          previousStage,
          stageLabel: state.stageLabels[state.stage] || ''
        });
      }
    }

    this.persist();
    this.dispatchStateChange();
    return this.decorateState(state);
  }

  addInteraction(type = 'interaction') {
    const rewards = {
      feed: { exp: 10, growth: 10, counter: 'totalFeedings' },
      pet: { exp: 5, growth: 3, counter: 'totalInteractions' },
      clean: { exp: 8, growth: 5, counter: 'totalInteractions' },
      chat: { exp: 3, growth: 5, counter: 'totalChats' },
      pomodoro: { exp: 25, growth: 25, counter: 'totalPomodoros' },
      open: { exp: 15, growth: 10, counter: null }
    };

    const reward = rewards[type] || { exp: 2, growth: 2, counter: 'totalInteractions' };
    const state = this.getCurrentState();

    if (reward.counter) {
      state[reward.counter] = (state[reward.counter] || 0) + 1;
    }

    if (type === 'feed') {
      state.totalInteractions += 1;
    }

    this.addExp(reward.exp, type);
    this.addGrowthPoints(reward.growth, type);
    return this.decorateState(state);
  }

  addUsageMinutes(minutes = 1) {
    if (minutes <= 0) {
      return this.getState();
    }

    const state = this.getCurrentState();
    state.totalMinutes += minutes;
    this.addExp(minutes, 'usage');
    this.addGrowthPoints(minutes, 'usage');
    return this.decorateState(state);
  }

  resolveStage(growthPoints) {
    let stage = 0;
    for (let index = 0; index < this.stageThresholds.length; index += 1) {
      if (growthPoints >= this.stageThresholds[index]) {
        stage = index;
      }
    }

    return Math.min(stage, this.stageThresholds.length - 1);
  }

  handleLevelUp(state, source) {
    const abilities = this.getAbilitiesForLevel(state.level).filter((ability) => {
      return !state.unlockedAbilities.some((item) => item.id === ability.id);
    });

    state.unlockedAbilities.push(...abilities);

    if (this.onLevelUp) {
      this.onLevelUp({
        characterId: state.characterId,
        level: state.level,
        abilities,
        totalExp: state.totalExp,
        source
      });
    }

    this.syncFeatureFlags();
  }

  getAbilitiesForLevel(level) {
    const abilityMap = {
      2: [{ id: 'faster_move', name: '加速移动', description: '移动速度+20%' }],
      3: [{ id: 'longer_chat', name: '话多了', description: '对话回复字数上限提升' }],
      4: [{ id: 'weather_sense', name: '天气感知', description: '根据天气变化情绪' }],
      5: [{ id: 'night_mode', name: '夜间模式', description: '晚上自动变安静' }],
      6: [{ id: 'dance', name: '跳舞', description: '解锁跳舞动作' }],
      7: [{ id: 'mini_games', name: '小游戏', description: '解锁互动小游戏' }],
      8: [{ id: 'custom_color', name: '自定义颜色', description: '可以改变宠物颜色' }],
      9: [{ id: 'multi_pet', name: '多宠物', description: '可以同时养多只宠物' }],
      10: [{ id: 'evolution', name: '终极进化', description: '宠物外观进化' }]
    };
    return abilityMap[level] || [];
  }

  hasAbility(abilityId, characterId = this.currentCharacterId) {
    return this.ensureCharacterState(characterId).unlockedAbilities.some((ability) => ability.id === abilityId);
  }

  async recordDailyOpen() {
    const today = new Date().toISOString().slice(0, 10);
    if (this.lastOpenedOn === today) {
      return;
    }

    this.lastOpenedOn = today;
    this.addInteraction('open');
    await this.persist();
  }

  startUsageTracking() {
    if (this.usageInterval) {
      clearInterval(this.usageInterval);
    }

    this.usageInterval = setInterval(() => {
      if (document.hidden) {
        return;
      }

      this.addUsageMinutes(1);
    }, 60 * 1000);
  }

  applyCareState(careState) {
    const state = this.getCurrentState();
    const now = Date.now();

    if (careState.hunger <= 0 && careState.hungerDepletedAt) {
      const penaltyAnchor = careState.hungerDepletedAt + 4 * 60 * 60 * 1000;
      if (now >= penaltyAnchor && (!state.lastHungerPenaltyAt || state.lastHungerPenaltyAt < penaltyAnchor)) {
        state.lastHungerPenaltyAt = penaltyAnchor;
        this.addGrowthPoints(-50, 'hunger-penalty');
      }
    }

    if (careState.cleanliness <= 0) {
      const cleanDepletedAt = careState.cleanlinessDepletedAt || careState.lastUpdatedAt || now;
      const penaltyAnchor = cleanDepletedAt + 8 * 60 * 60 * 1000;
      if (now >= penaltyAnchor && (!state.lastCleanPenaltyAt || state.lastCleanPenaltyAt < penaltyAnchor)) {
        state.lastCleanPenaltyAt = penaltyAnchor;
        this.addGrowthPoints(-30, 'clean-penalty');
      }
    }

    this.persist();
    this.dispatchStateChange();
  }

  async persist() {
    const snapshot = {
      currentCharacterId: this.currentCharacterId,
      lastOpenedOn: this.lastOpenedOn,
      statesByCharacter: this.statesByCharacter
    };

    if (window.electronAPI && window.electronAPI.storeSet) {
      window.electronAPI.storeSet('growthState', snapshot);
      return;
    }

    localStorage.setItem('growthState', JSON.stringify(snapshot));
  }

  async loadState() {
    let state = null;

    if (window.electronAPI && window.electronAPI.storeGet) {
      state = await window.electronAPI.storeGet('growthState');
    } else {
      const saved = localStorage.getItem('growthState');
      state = saved ? JSON.parse(saved) : null;
    }

    if (!state) {
      return;
    }

    this.currentCharacterId = state.currentCharacterId || this.currentCharacterId;
    this.lastOpenedOn = state.lastOpenedOn || null;
    this.statesByCharacter = state.statesByCharacter || {};
  }

  dispatchStateChange() {
    const state = this.getState();

    if (this.onStateChange) {
      this.onStateChange(state);
    }

    window.dispatchEvent(new CustomEvent('growth:state', {
      detail: state
    }));
  }

  syncFeatureFlags() {
    const flags = {
      multiPet: this.hasAbility('multi_pet')
    };

    if (window.electronAPI && window.electronAPI.storeSet) {
      window.electronAPI.storeSet('featureFlags', flags);
      return;
    }

    localStorage.setItem('featureFlags', JSON.stringify(flags));
  }

  destroy() {
    if (this.usageInterval) {
      clearInterval(this.usageInterval);
      this.usageInterval = null;
    }
  }
}
