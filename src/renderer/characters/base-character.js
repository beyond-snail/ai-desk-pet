class BaseCharacter {
  constructor(config = {}) {
    this.config = config;
    this.container = null;
    this.rootElement = null;
    this.styleElement = null;
    this.templateHTML = '';
    this.styleCSS = '';
  }

  async load(basePath) {
    const [templateResp, styleResp] = await Promise.all([
      fetch(`${basePath}/template.html`),
      fetch(`${basePath}/style.css`)
    ]);

    if (!templateResp.ok) {
      throw new Error(`Failed to load character template: ${basePath}/template.html`);
    }

    if (!styleResp.ok) {
      throw new Error(`Failed to load character style: ${basePath}/style.css`);
    }

    this.templateHTML = await templateResp.text();
    this.styleCSS = await styleResp.text();
  }

  render(container) {
    this.container = container;
    const fragment = document.createRange().createContextualFragment(this.templateHTML);
    container.innerHTML = '';
    container.appendChild(fragment);
    this.rootElement = container.querySelector('[data-character]') || container.firstElementChild;
    this.loadCSS();
    return this.rootElement;
  }

  loadCSS() {
    this.unloadCSS();
    this.styleElement = document.createElement('style');
    this.styleElement.dataset.characterStyle = this.config.id || 'unknown';
    this.styleElement.textContent = this.styleCSS;
    document.head.appendChild(this.styleElement);
  }

  unloadCSS() {
    if (!this.styleElement) {
      return;
    }

    this.styleElement.remove();
    this.styleElement = null;
  }

  applyMood(payload) {
    if (!this.rootElement) {
      return;
    }

    if (typeof payload === 'object' && payload !== null) {
      if (payload.mood) {
        this.rootElement.dataset.mood = payload.mood;
      }
      if (typeof payload.dirty !== 'undefined') {
        this.rootElement.dataset.dirty = payload.dirty ? 'true' : 'false';
      }
      return;
    }

    this.rootElement.dataset.mood = payload;
  }

  setDirty(isDirty) {
    if (this.rootElement) {
      this.rootElement.dataset.dirty = isDirty ? 'true' : 'false';
    }
  }

  applyGrowthStage(stage) {
    if (this.rootElement) {
      this.rootElement.dataset.growthStage = String(stage);
    }
  }

  applyWeather(effect, dayPart) {
    if (!this.rootElement) {
      return;
    }

    this.rootElement.dataset.weather = effect || '';
    this.rootElement.dataset.daypart = dayPart || 'day';
  }

  playAnimation(name) {
    if (!this.rootElement) {
      return;
    }

    const durationMap = {
      listening: 1800,
      celebrate: 1200,
      drop: 900,
      doze: 2200,
      yawn: 1600,
      'idle-look': 1200,
      evolve: 700
    };

    this.rootElement.dataset.animation = name;
    window.setTimeout(() => {
      if (this.rootElement && this.rootElement.dataset.animation === name) {
        delete this.rootElement.dataset.animation;
      }
    }, durationMap[name] || 900);
  }

  setDirection(dx) {
    if (!this.rootElement) {
      return;
    }

    this.rootElement.dataset.direction = dx >= 0 ? 'right' : 'left';
  }

  getHitBox() {
    if (!this.rootElement) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const rect = this.rootElement.getBoundingClientRect();
    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    };
  }

  getAnimationParams(mood) {
    const animations = this.config.animations || {};
    return animations[mood] || animations.idle || { speed: 2, amplitude: 2, legRotation: 15, frequency: 0.05 };
  }

  getMoveParts() {
    return this.config.moveParts || {
      bodySelector: '.segment',
      limbSelector: '.leg',
      headSelector: '.head'
    };
  }

  getAnimationStrategy() {
    return this.config.animationStrategy || this.config.id || 'caterpillar';
  }

  getMovementProfile() {
    return this.config.movement || {
      maxSpeedMultiplier: 1,
      acceleration: 0.16,
      turnResponsiveness: 0.12,
      turnSlowdown: 0.2,
      decelerationDistance: 72,
      arrivalRadius: 10,
      minTravelDistance: 140,
      roamPadding: 56
    };
  }

  getGrowthConfig() {
    return this.config.growth || {
      stages: ['base', 'growth', 'mature', 'evolved', 'final'],
      stageLabels: ['初始', '成长', '成熟', '进化', '终形']
    };
  }

  getDimensions() {
    return this.config.dimensions || { width: 80, height: 40 };
  }

  getMeta() {
    return {
      id: this.config.id,
      name: this.config.name,
      description: this.config.description || ''
    };
  }

  destroy() {
    this.unloadCSS();
    this.rootElement = null;

    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}
