class PetController extends Caterpillar {
  constructor(options = 'caterpillar') {
    super();

    const resolvedOptions = typeof options === 'string' ? { characterId: options } : (options || {});
    this.characterId = resolvedOptions.characterId || 'caterpillar';
    this.registry = null;
    this.character = null;
    this.currentCharacterId = null;
    this.hostElement = resolvedOptions.hostElement || document.getElementById('pet-root');
    this.instanceId = resolvedOptions.instanceId || `pet-${Math.random().toString(16).slice(2, 8)}`;
    this.enableInteraction = resolvedOptions.interactive !== false;
    this.isPrimary = resolvedOptions.isPrimary !== false;
    this.growthSystem = null;
    this.weatherState = null;
    this.weatherEffects = null;
    this.systemMetrics = null;
    this.edgeBehaviorTimer = null;
    this.lowPowerMode = false;
  }

  async init(characterId) {
    this.registry = new CharacterRegistry();
    await this.registry.init();

    const resolvedCharacterId = characterId || await this.loadSavedCharacter() || this.characterId || this.registry.getDefaultId();
    await this.loadCharacter(resolvedCharacterId);
    await super.init();
  }

  async loadCharacter(characterId) {
    if (!this.hostElement) {
      throw new Error('Pet root container not found');
    }

    if (this.character) {
      this.character.destroy();
    }

    if (this.weatherEffects) {
      this.weatherEffects.destroy();
      this.weatherEffects = null;
    }

    const nextCharacterId = this.registry.has(characterId) ? characterId : this.registry.getDefaultId();
    this.character = await this.registry.load(nextCharacterId);
    const element = this.character.render(this.hostElement);

    if (!element) {
      throw new Error(`Character "${nextCharacterId}" rendered without a root element`);
    }

    this.setElement(element);
    this.applyCharacterDimensions();
    this.currentCharacterId = nextCharacterId;

    if (typeof WeatherEffects !== 'undefined') {
      this.weatherEffects = new WeatherEffects();
      this.weatherEffects.attachTo(this.element);
    }

    if (this.isPrimary) {
      this.saveCharacter(nextCharacterId);
    }

    this.syncCharacterState();
  }

  applyCharacterDimensions() {
    if (!this.element || !this.character) {
      return;
    }

    const dimensions = this.character.getDimensions();
    if (dimensions.width) {
      this.element.style.width = `${dimensions.width}px`;
    }

    if (dimensions.height) {
      this.element.style.height = `${dimensions.height}px`;
    }
  }

  syncCharacterState() {
    if (!this.element || !this.character) {
      return;
    }

    this.element.dataset.character = this.currentCharacterId;
    this.element.dataset.focus = this.focusMode ? 'true' : 'false';
    this.character.applyMood({ mood: this.mood, dirty: this.element.dataset.dirty === 'true' });
    this.character.setDirection(this.currentFacing);
    this.applyMoodVisuals();

    if (this.careState) {
      this.applyCareState(this.careState);
    }

    if (this.growthSystem) {
      this.applyGrowthState(this.growthSystem.getCharacterState(this.currentCharacterId));
    }

    if (this.weatherState) {
      this.applyWeatherState(this.weatherState);
    }

    if (this.systemMetrics) {
      this.applySystemMetrics(this.systemMetrics);
    }

    this.setPosition(this.position.x, this.position.y);
  }

  async switchCharacter(characterId) {
    if (!characterId || characterId === this.currentCharacterId) {
      return;
    }

    const previousElement = this.element;
    if (previousElement) {
      previousElement.style.transition = 'opacity 0.22s ease';
      previousElement.style.opacity = '0';
      await new Promise((resolve) => setTimeout(resolve, 220));
    }

    await this.loadCharacter(characterId);

    if (this.growthSystem) {
      await this.growthSystem.setCharacter(this.currentCharacterId, this.registry.get(this.currentCharacterId));
      this.applyGrowthState(this.growthSystem.getState());
    }

    this.refreshMoveParts();
    this.syncCharacterState();

    this.element.style.transition = 'opacity 0.24s ease';
    this.element.style.opacity = '0';
    this.applyTransform();

    requestAnimationFrame(() => {
      if (!this.element) {
        return;
      }

      this.element.style.opacity = '1';
      this.applyTransform();
    });

    window.dispatchEvent(new CustomEvent('pet:character-switched', {
      detail: {
        characterId: this.currentCharacterId,
        character: this.character ? this.character.getMeta() : null,
        instanceId: this.instanceId
      }
    }));
  }

  getMoodProfile() {
    const profile = this.character ? this.character.getAnimationParams(this.mood) : super.getMoodProfile();
    if (this.growthSystem && this.growthSystem.hasAbility('faster_move', this.currentCharacterId)) {
      return {
        ...profile,
        speed: profile.speed * 1.2
      };
    }
    return profile;
  }

  getMovePartSelectors() {
    if (this.character) {
      return this.character.getMoveParts();
    }

    return super.getMovePartSelectors();
  }

  getAnimationStrategy() {
    if (this.character && typeof this.character.getAnimationStrategy === 'function') {
      return this.character.getAnimationStrategy();
    }

    return super.getAnimationStrategy();
  }

  getMovementProfile() {
    const baseProfile = this.character && typeof this.character.getMovementProfile === 'function'
      ? this.character.getMovementProfile()
      : super.getMovementProfile();

    if (this.careState && this.careState.affection < 30) {
      return {
        ...baseProfile,
        maxSpeedMultiplier: baseProfile.maxSpeedMultiplier * 0.76,
        acceleration: Math.max(0.08, baseProfile.acceleration * 0.82)
      };
    }

    return baseProfile;
  }

  applyMoodVisuals() {
    super.applyMoodVisuals();

    if (this.character) {
      this.character.applyMood({ mood: this.mood, dirty: this.element.dataset.dirty === 'true' });
      this.character.setDirection(this.currentFacing);
    }
  }

  attachGrowthSystem(growthSystem, characterId = null) {
    this.growthSystem = growthSystem;
    const targetCharacterId = characterId || this.currentCharacterId;
    if (this.growthSystem && targetCharacterId) {
      this.applyGrowthState(this.growthSystem.getCharacterState(targetCharacterId));
    }
  }

  applyGrowthState(state) {
    if (!this.element || !state) {
      return;
    }

    this.element.dataset.level = String(state.level);
    this.element.dataset.growthStage = String(state.stage);
    this.element.dataset.growthLabel = state.stageLabel;
    this.element.style.setProperty('--pet-growth-scale', String(1 + state.stage * 0.04));

    if (this.character) {
      this.character.applyGrowthStage(state.stage);
    }
  }

  async evolveToCurrentStage() {
    if (!this.character || !this.growthSystem) {
      return;
    }

    this.character.playAnimation('evolve');
    this.element.classList.add('pet-evolving');
    await new Promise((resolve) => setTimeout(resolve, 700));
    this.element.classList.remove('pet-evolving');
    this.applyGrowthState(this.growthSystem.getCharacterState(this.currentCharacterId));
  }

  applyWeatherState(payload) {
    this.weatherState = payload;
    if (!this.element || !payload) {
      return;
    }

    this.element.dataset.weather = payload.visualEffect || '';
    this.element.dataset.daypart = payload.dayPart || 'day';

    if (this.character) {
      this.character.applyWeather(payload.visualEffect, payload.dayPart);
    }

    if (this.weatherEffects) {
      this.weatherEffects.setEffect(payload.visualEffect);
    }

    if (payload.moodEffect && this.growthSystem && this.growthSystem.hasAbility('weather_sense', this.currentCharacterId)) {
      this.setMood(payload.moodEffect.mood, { silent: true });
    }
  }

  applySystemMetrics(metrics) {
    this.systemMetrics = metrics;
    if (!this.element || !metrics) {
      return;
    }

    const cpuHigh = metrics.cpuUsage >= 80;
    const memoryHigh = metrics.memoryUsage >= 90;
    const shouldEnableLowPower = metrics.cpuUsage >= 65 || metrics.memoryUsage >= 82;
    const targetFpsCap = (metrics.cpuUsage >= 85 || metrics.memoryUsage >= 92)
      ? 20
      : (shouldEnableLowPower ? 30 : 60);

    this.element.dataset.systemStress = cpuHigh ? 'high' : (metrics.cpuUsage >= 60 ? 'medium' : 'low');
    this.element.dataset.memoryPressure = memoryHigh ? 'high' : (metrics.memoryUsage >= 75 ? 'medium' : 'low');
    this.element.style.setProperty('--pet-system-scale', memoryHigh ? '1.08' : '1');
    this.setAnimationFpsCap(targetFpsCap);

    if (this.lowPowerMode !== shouldEnableLowPower) {
      this.lowPowerMode = shouldEnableLowPower;
      this.element.dataset.lowPower = shouldEnableLowPower ? 'true' : 'false';
      if (this.weatherEffects && typeof this.weatherEffects.setLowPower === 'function') {
        this.weatherEffects.setLowPower(shouldEnableLowPower);
      }
    }

    if (cpuHigh) {
      this.setMood('excited', { silent: true });
      return;
    }

    if (metrics.cpuUsage <= 20 && !this.focusMode) {
      this.setMood('idle', { silent: true });
    }
  }

  checkEdgeInteraction() {
    if (!this.element || this.edgeBehaviorTimer) {
      return;
    }

    const dimensions = this.character ? this.character.getDimensions() : { width: 80, height: 40 };
    const margin = 6;
    const edges = {
      atLeft: this.position.x <= margin,
      atRight: this.position.x >= this.screenSize.width - dimensions.width - margin,
      atTop: this.position.y <= margin,
      atBottom: this.position.y >= this.screenSize.height - dimensions.height - margin
    };

    if (edges.atLeft || edges.atRight || edges.atTop || edges.atBottom) {
      this.handleEdgeReaction(edges);
    }
  }

  handleEdgeReaction(edges) {
    if (!this.element) {
      return;
    }

    if (edges.atBottom) {
      this.element.dataset.edge = 'bottom';
      this.triggerEdgeBehavior();
    } else if (edges.atLeft || edges.atRight) {
      this.element.dataset.edge = edges.atLeft ? 'left' : 'right';
      this.triggerEdgeBehavior();
    } else if (edges.atTop) {
      this.element.dataset.edge = 'top';
      this.triggerEdgeBehavior();
    }
  }

  triggerEdgeBehavior() {
    if (this.edgeBehaviorTimer) {
      return;
    }

    this.isMoving = true;
    const duration = 3000 + Math.random() * 2500;
    this.edgeBehaviorTimer = setTimeout(() => {
      if (this.element) {
        delete this.element.dataset.edge;
      }

      this.edgeBehaviorTimer = null;
      this.isMoving = false;
      this.setNewRandomTarget();
    }, duration);
  }

  setNewRandomTarget() {
    const dimensions = this.character ? this.character.getDimensions() : { width: 80, height: 40 };
    const padding = 60;
    this.moveToTarget({
      x: padding + Math.random() * Math.max(40, this.screenSize.width - dimensions.width - padding * 2),
      y: padding + Math.random() * Math.max(40, this.screenSize.height - dimensions.height - padding * 2)
    });
  }

  move() {
    if (this.edgeBehaviorTimer) {
      return;
    }

    super.move();
    this.checkEdgeInteraction();
  }

  getStatusSummary() {
    const summary = [];
    if (this.growthSystem) {
      const growth = this.growthSystem.getCharacterState(this.currentCharacterId);
      summary.push(`等级 ${growth.level} · ${growth.stageLabel}`);
    }
    if (this.weatherState && this.weatherState.currentWeather) {
      summary.push(`${this.weatherState.currentWeather.text} ${this.weatherState.currentWeather.temp}°C`);
    }
    if (this.systemMetrics) {
      summary.push(`CPU ${this.systemMetrics.cpuUsage}% / 内存 ${this.systemMetrics.memoryUsage}%`);
    }
    return summary.join(' · ');
  }

  async loadSavedCharacter() {
    if (!this.isPrimary) {
      return this.characterId;
    }

    if (window.electronAPI && window.electronAPI.storeGet) {
      const current = await window.electronAPI.storeGet('characterId');
      if (current) {
        return current;
      }
      return window.electronAPI.storeGet('selectedCharacter');
    }

    return localStorage.getItem('characterId') || localStorage.getItem('selectedCharacter');
  }

  saveCharacter(id) {
    if (!this.isPrimary) {
      return;
    }

    if (window.electronAPI && window.electronAPI.storeSet) {
      window.electronAPI.storeSet('characterId', id);
      window.electronAPI.storeSet('selectedCharacter', id);
      return;
    }

    localStorage.setItem('characterId', id);
    localStorage.setItem('selectedCharacter', id);
  }

  getCharacterOptions() {
    return this.registry ? this.registry.getAll() : CharacterRegistry.list();
  }

  destroy() {
    super.destroy();

    if (this.edgeBehaviorTimer) {
      clearTimeout(this.edgeBehaviorTimer);
      this.edgeBehaviorTimer = null;
    }

    if (this.weatherEffects) {
      this.weatherEffects.destroy();
      this.weatherEffects = null;
    }

    if (this.character) {
      this.character.destroy();
      this.character = null;
    }
  }
}
