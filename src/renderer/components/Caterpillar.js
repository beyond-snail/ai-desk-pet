class Caterpillar {
  constructor() {
    this.element = document.getElementById('caterpillar');
    this.position = { x: 100, y: 100 };
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.direction = { x: 1, y: 0 };
    this.isMoving = false;
    this.isCurrentlyMoving = false;
    this.segments = [];
    this.legs = [];
    this.headElement = null;
    this.bodyElement = null;
    this.movementInterval = null;
    this.animationFrameId = null;
    this.animationPhase = 0;
    this.lastAnimationFrameAt = 0;
    this.lastAnimationTickAt = 0;
    this.animationFpsCap = 60;
    this.animationFrameInterval = 1000 / this.animationFpsCap;
    this.activeMotion = null;
    this.velocity = { x: 0, y: 0 };
    this.screenSize = { width: window.innerWidth, height: window.innerHeight };
    this.currentScale = 1;
    this.currentFacing = 1;
    this.mouseEventsIgnored = true;
    this.lastIgnoreMouseUpdateAt = 0;
    this.interactiveSelectors = ['#caterpillar', '#input-panel', '#settings-panel', '#character-picker', '#pet-manager-panel', '#quick-actions'];
    this.currentPath = [];
    this.pathIndex = 0;
    this.mood = 'idle';
    this.lastInteractionAt = Date.now();
    this.tapHistory = [];
    this.moodInterval = null;
    this.careState = null;
    this.focusMode = false;
    this.enableInteraction = true;
    this.globalEventsBound = false;
    this.lifecycleEventsBound = false;
    this.petElementHandlers = null;
    this.inputPanelHandlers = null;
    this.documentHandlers = null;
    this.windowHandlers = null;
    this.visibilityHandler = null;
    this.lastPointerPosition = null;
    this.isHovered = false;
    this.pettingState = {
      lastX: null,
      direction: 0,
      flips: [],
      lastTriggeredAt: 0
    };
    this.temporaryAnimationTimer = null;
    this.moodTransitionTimer = null;
    this.moodTransitionClearTimer = null;
    this.pendingMood = null;
    this.currentSpeedRatio = 0;
    this.lastTurnAt = 0;
    this.turnHoldUntil = 0;
    this.isTurning = false;
    this.careBehaviorInterval = null;
    this.lastAffectionBehaviorAt = 0;
    this.stateEffectsLayer = null;
  }

  async init() {
    await this.loadScreenSize();

    if (!this.element) {
      this.setElement(document.getElementById('caterpillar'));
    }

    this.position = {
      x: Math.max(40, Math.round(this.screenSize.width * 0.25)),
      y: Math.max(40, Math.round(this.screenSize.height * 0.25))
    };

    this.setPosition(this.position.x, this.position.y);
    this.bindEvents();
    this.refreshMoveParts();
    this.startContinuousMovement();
    this.startBodyWaveAnimation();
    this.startMoodMonitoring();
    this.startCareBehaviorLoop();
    this.applyMoodVisuals();
    this.ensureStateEffectsLayer();
    this.renderStateEffects();
    this.updateIgnoreMouseEvents(true);
  }

  setElement(element) {
    if (this.element === element) {
      this.refreshMoveParts();
      return;
    }

    this.unbindPetElementEvents();
    this.element = element;
    this.activeMotion = null;
    this.isCurrentlyMoving = false;

    if (this.element) {
      this.refreshMoveParts();
      this.applyTransform();
      this.element.dataset.fpsCap = String(this.animationFpsCap);
      this.ensureStateEffectsLayer();
      this.renderStateEffects();

      if (this.enableInteraction && this.globalEventsBound) {
        this.bindPetElementEvents();
      }
    }
  }

  getElement() {
    return this.element;
  }

  setAnimationFpsCap(fps = 60) {
    const numericFps = Number(fps);
    const nextFps = Number.isFinite(numericFps) ? Math.max(12, Math.min(60, Math.round(numericFps))) : 60;
    if (this.animationFpsCap === nextFps) {
      return;
    }

    this.animationFpsCap = nextFps;
    this.animationFrameInterval = 1000 / nextFps;
    this.lastAnimationTickAt = 0;

    if (this.element) {
      this.element.dataset.fpsCap = String(nextFps);
    }
  }

  isPetTarget(target) {
    return Boolean(this.element && target instanceof Node && this.element.contains(target));
  }

  async loadScreenSize() {
    if (!window.electronAPI || !window.electronAPI.getScreenSize) {
      return;
    }

    const screenSize = await window.electronAPI.getScreenSize();
    if (screenSize && screenSize.width && screenSize.height) {
      this.screenSize = screenSize;
    }
  }

  setPosition(x, y) {
    if (!this.element) {
      return;
    }

    this.position.x = x;
    this.position.y = y;
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
    window.dispatchEvent(new CustomEvent('pet:move', {
      detail: {
        x,
        y,
        instanceId: this.instanceId || 'primary',
        facing: this.currentFacing,
        direction: { ...this.direction },
        speedRatio: this.currentSpeedRatio || 0,
        moving: this.isCurrentlyMoving
      }
    }));
  }

  applyTransform() {
    if (!this.element) {
      return;
    }

    this.element.style.setProperty('--pet-facing', String(this.currentFacing));
    this.element.style.setProperty('--pet-scale', String(this.currentScale));
  }

  updateIgnoreMouseEvents(ignore, options = {}) {
    const force = Boolean(options.force);

    if (!this.enableInteraction || !window.electronAPI) {
      return;
    }

    const now = Date.now();
    if (!force && now - this.lastIgnoreMouseUpdateAt < 50) {
      return;
    }

    if (!force && this.mouseEventsIgnored === ignore) {
      return;
    }

    this.lastIgnoreMouseUpdateAt = now;
    this.mouseEventsIgnored = ignore;
    window.electronAPI.setIgnoreMouseEvents(ignore, { forward: true });
  }

  isPointerOverInteractiveArea(clientX, clientY) {
    return this.interactiveSelectors.some((selector) => {
      const element = document.querySelector(selector);
      if (!element || element.classList.contains('hidden')) {
        return false;
      }

      const rect = element.getBoundingClientRect();
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    });
  }

  bindEvents() {
    if (!this.lifecycleEventsBound) {
      this.bindLifecycleEvents();
      this.lifecycleEventsBound = true;
    }

    if (!this.enableInteraction) {
      return;
    }

    if (!this.globalEventsBound) {
      this.bindDocumentEvents();
      this.bindInputPanelEvents();
      this.globalEventsBound = true;
    }

    this.bindPetElementEvents();
  }

  setInteractionEnabled(enabled) {
    const nextEnabled = Boolean(enabled);
    if (this.enableInteraction === nextEnabled) {
      return;
    }

    this.enableInteraction = nextEnabled;

    if (!nextEnabled) {
      this.isDragging = false;
      this.unbindPetElementEvents();
      this.updateIgnoreMouseEvents(true);
      return;
    }

    if (this.lifecycleEventsBound) {
      this.bindEvents();
    }
  }

  bindLifecycleEvents() {
    this.windowHandlers = {
      blur: () => {
        this.updateIgnoreMouseEvents(true);
      },
      resize: () => {
        this.screenSize = {
          width: window.innerWidth,
          height: window.innerHeight
        };
      }
    };

    this.visibilityHandler = () => {
      if (document.hidden) {
        this.pauseAnimations();
      } else {
        this.resumeAnimations();
      }
    };

    window.addEventListener('blur', this.windowHandlers.blur);
    window.addEventListener('resize', this.windowHandlers.resize);
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  bindDocumentEvents() {
    this.documentHandlers = {
      mousemove: (event) => {
        this.lastPointerPosition = { x: event.clientX, y: event.clientY };
        this.updateIgnoreMouseEvents(!this.isPointerOverInteractiveArea(event.clientX, event.clientY) && !this.isDragging);

        if (this.isDragging) {
          const nextX = event.clientX - this.dragStart.x;
          const nextY = event.clientY - this.dragStart.y;
          const clamped = this.clampPosition(nextX, nextY);
          this.setPosition(clamped.x, clamped.y);
          return;
        }

        this.lookAt(event.clientX);
      },
      mouseup: (event) => {
        const wasDragging = this.isDragging;
        this.isDragging = false;
        this.updateIgnoreMouseEvents(!this.isPointerOverInteractiveArea(event.clientX, event.clientY));

        if (wasDragging) {
          this.onDrop();
        }
      }
    };

    document.addEventListener('mousemove', this.documentHandlers.mousemove);
    document.addEventListener('mouseup', this.documentHandlers.mouseup);
  }

  bindInputPanelEvents() {
    const inputPanel = document.getElementById('input-panel');
    if (!inputPanel || this.inputPanelHandlers) {
      return;
    }

    this.inputPanelHandlers = {
      mouseenter: () => {
        this.updateIgnoreMouseEvents(false);
      },
      mouseleave: () => {
        this.updateIgnoreMouseEvents(true);
      }
    };

    inputPanel.addEventListener('mouseenter', this.inputPanelHandlers.mouseenter);
    inputPanel.addEventListener('mouseleave', this.inputPanelHandlers.mouseleave);
  }

  bindPetElementEvents() {
    if (!this.element || this.petElementHandlers) {
      return;
    }

    this.petElementHandlers = {
      mousedown: (event) => {
        event.preventDefault();
        this.isDragging = true;
        this.isCurrentlyMoving = false;
        this.activeMotion = null;
        this.currentPath = [];
        this.pathIndex = 0;
        this.velocity = { x: 0, y: 0 };
        this.dragStart.x = event.clientX - this.position.x;
        this.dragStart.y = event.clientY - this.position.y;
        this.updateIgnoreMouseEvents(false);
        this.dispatchHoverChange(true);
      },
      mouseenter: () => {
        this.currentScale = 1.08;
        this.isHovered = true;
        this.updateIgnoreMouseEvents(false);
        this.applyTransform();
        this.dispatchHoverChange(true);
      },
      mouseleave: () => {
        this.currentScale = 1;
        this.isHovered = false;
        this.applyTransform();
        this.resetPettingState();
        this.dispatchHoverChange(false);
      },
      mousemove: (event) => {
        this.handlePettingGesture(event);
      }
    };

    this.element.addEventListener('mousedown', this.petElementHandlers.mousedown);
    this.element.addEventListener('mouseenter', this.petElementHandlers.mouseenter);
    this.element.addEventListener('mouseleave', this.petElementHandlers.mouseleave);
    this.element.addEventListener('mousemove', this.petElementHandlers.mousemove);
  }

  unbindPetElementEvents() {
    if (!this.element || !this.petElementHandlers) {
      this.petElementHandlers = null;
      return;
    }

    this.element.removeEventListener('mousedown', this.petElementHandlers.mousedown);
    this.element.removeEventListener('mouseenter', this.petElementHandlers.mouseenter);
    this.element.removeEventListener('mouseleave', this.petElementHandlers.mouseleave);
    this.element.removeEventListener('mousemove', this.petElementHandlers.mousemove);
    this.petElementHandlers = null;
  }

  dispatchHoverChange(visible) {
    window.dispatchEvent(new CustomEvent('pet:hover-change', {
      detail: {
        visible,
        instanceId: this.instanceId || 'primary'
      }
    }));
  }

  ensureStateEffectsLayer() {
    if (!this.element) {
      this.stateEffectsLayer = null;
      return;
    }

    const existing = this.element.querySelector('.pet-state-effects');
    if (existing) {
      this.stateEffectsLayer = existing;
      return;
    }

    const layer = document.createElement('div');
    layer.className = 'pet-state-effects';
    this.element.appendChild(layer);
    this.stateEffectsLayer = layer;
  }

  renderStateEffects() {
    if (!this.stateEffectsLayer || !this.element) {
      return;
    }

    const isHungry = this.element.dataset.hungry === 'true';
    const isCleanLow = this.element.dataset.cleanLow === 'true';
    const isAffectionLow = this.element.dataset.affectionLow === 'true';
    const isFocused = this.focusMode;

    this.stateEffectsLayer.innerHTML = '';

    if (isHungry) {
      const hungry = document.createElement('span');
      hungry.className = 'state-tag state-hungry';
      hungry.textContent = '咕噜';
      this.stateEffectsLayer.appendChild(hungry);
    }

    if (isCleanLow) {
      const dust = document.createElement('span');
      dust.className = 'state-tag state-dust';
      dust.textContent = '· · ·';
      this.stateEffectsLayer.appendChild(dust);
    }

    if (isAffectionLow) {
      const distant = document.createElement('span');
      distant.className = 'state-tag state-distant';
      distant.textContent = '...';
      this.stateEffectsLayer.appendChild(distant);
    }

    if (isFocused) {
      const focus = document.createElement('span');
      focus.className = 'focus-glasses';
      focus.textContent = '⌐◨-◨';
      this.stateEffectsLayer.appendChild(focus);
    }
  }

  isUiBlocking() {
    const blockers = ['input-panel', 'settings-panel', 'character-picker', 'pet-manager-panel'];
    return blockers.some((id) => {
      const node = document.getElementById(id);
      return node && !node.classList.contains('hidden');
    });
  }

  getMovePartSelectors() {
    return {
      bodySelector: '.segment',
      limbSelector: '.leg',
      headSelector: '.head'
    };
  }

  getAnimationStrategy() {
    if (this.character && typeof this.character.getAnimationStrategy === 'function') {
      return this.character.getAnimationStrategy();
    }

    return 'caterpillar';
  }

  getMovementProfile() {
    return {
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

  refreshMoveParts() {
    if (!this.element) {
      this.segments = [];
      this.legs = [];
      this.headElement = null;
      this.bodyElement = null;
      return;
    }

    const selectors = this.getMovePartSelectors();
    this.segments = Array.from(this.element.querySelectorAll(selectors.bodySelector || '.segment'));
    this.legs = Array.from(this.element.querySelectorAll(selectors.limbSelector || '.leg'));
    this.headElement = selectors.headSelector ? this.element.querySelector(selectors.headSelector) : null;
    this.bodyElement = this.element.querySelector('.body, .pixel-body, .bot-shell') || this.segments[0] || null;
    this.ensureStateEffectsLayer();
  }

  initSegments() {
    this.refreshMoveParts();
  }

  initLegs() {
    this.refreshMoveParts();
  }

  startContinuousMovement() {
    if (this.focusMode) {
      return;
    }

    this.movementInterval = true;
  }

  generateRandomPath() {
    const movement = this.getMovementProfile();
    const padding = movement.roamPadding || 56;
    const minTravelDistance = movement.minTravelDistance || 140;
    let attempts = 0;
    let target = this.position;

    while (attempts < 6) {
      // 增加随机性，有时选择近处目标，有时选择远处目标
      const distanceFactor = Math.random() > 0.3 ? 1 : 0.5;
      target = {
        x: padding + Math.random() * Math.max(40, this.screenSize.width - (this.element ? this.element.offsetWidth : 80) - padding * 2),
        y: padding + Math.random() * Math.max(40, this.screenSize.height - (this.element ? this.element.offsetHeight : 40) - padding * 2)
      };

      const dx = target.x - this.position.x;
      const dy = target.y - this.position.y;
      if (Math.sqrt(dx ** 2 + dy ** 2) >= minTravelDistance * distanceFactor) {
        break;
      }
      attempts += 1;
    }

    const rawPath = PathfindingUtils.generateTargetPath(this.position, target, this.screenSize.width, this.screenSize.height);
    this.currentPath = PathfindingUtils.smoothPath(rawPath);
    this.pathIndex = Math.min(1, Math.max(this.currentPath.length - 1, 0));
    this.activeMotion = null;
  }

  moveToTarget(target) {
    const targetPath = PathfindingUtils.generateTargetPath(this.position, target, this.screenSize.width, this.screenSize.height);
    this.currentPath = PathfindingUtils.smoothPath(targetPath);
    this.pathIndex = Math.min(1, Math.max(this.currentPath.length - 1, 0));
    this.activeMotion = null;
  }

  moveToTargetAndWait(target, options = {}) {
    const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 1800;
    const arrivalThreshold = Number.isFinite(options.arrivalThreshold) ? options.arrivalThreshold : 14;

    this.moveToTarget(target);

    return new Promise((resolve) => {
      const startedAt = Date.now();
      const checkArrival = () => {
        if (!this.element) {
          resolve(false);
          return;
        }

        const dx = target.x - this.position.x;
        const dy = target.y - this.position.y;
        const distance = Math.sqrt(dx ** 2 + dy ** 2);
        const reachedPathEnd = this.pathIndex >= this.currentPath.length;

        if (distance <= arrivalThreshold && reachedPathEnd) {
          resolve(true);
          return;
        }

        if (Date.now() - startedAt > timeoutMs) {
          resolve(false);
          return;
        }

        requestAnimationFrame(checkArrival);
      };

      requestAnimationFrame(checkArrival);
    });
  }

  getMoodProfile() {
    const profiles = {
      happy: { speed: 2.6, amplitude: 2.8, legRotation: 18, frequency: 0.07 },
      idle: { speed: 2, amplitude: 2, legRotation: 15, frequency: 0.05 },
      sleepy: { speed: 0.5, amplitude: 0.5, legRotation: 0, frequency: 0.02 },
      hungry: { speed: 1.2, amplitude: 1.1, legRotation: 10, frequency: 0.04 },
      excited: { speed: 3.2, amplitude: 4, legRotation: 22, frequency: 0.09 },
      sad: { speed: 0.8, amplitude: 0.8, legRotation: 6, frequency: 0.03 }
    };

    return profiles[this.mood] || profiles.idle;
  }

  applyMoodVisuals() {
    if (!this.element) {
      return;
    }

    this.element.dataset.mood = this.mood;
    this.applyTransform();
  }

  setMood(nextMood, options = {}) {
    if (!nextMood) {
      return;
    }

    const immediate = Boolean(options.immediate);
    const previousMood = this.mood;
    if (!immediate && previousMood === nextMood) {
      return;
    }

    const applyMood = () => {
      this.mood = nextMood;
      this.pendingMood = null;
      this.applyMoodVisuals();

      if (options.silent) {
        return;
      }

      const moodMessages = {
        happy: '今天心情不错，想多陪你一会儿。',
        idle: '我就在这里慢慢陪着你。',
        sleepy: '有点困了，想慢一点爬。',
        hungry: '肚子空空的，想吃点东西。',
        excited: '好耶，今天超有精神。',
        sad: '饿太久了，心情有点低落。'
      };

      window.dispatchEvent(new CustomEvent('pet:mood-change', {
        detail: {
          mood: nextMood,
          previousMood,
          message: moodMessages[nextMood] || '',
          instanceId: this.instanceId || 'primary'
        }
      }));
    };

    if (this.moodTransitionTimer) {
      clearTimeout(this.moodTransitionTimer);
      this.moodTransitionTimer = null;
    }
    if (this.moodTransitionClearTimer) {
      clearTimeout(this.moodTransitionClearTimer);
      this.moodTransitionClearTimer = null;
    }

    if (immediate || !this.element) {
      applyMood();
      return;
    }

    this.pendingMood = nextMood;
    this.element.dataset.moodTransition = 'true';
    this.element.dataset.blink = 'true';

    this.moodTransitionTimer = window.setTimeout(() => {
      this.moodTransitionTimer = null;
      if (this.pendingMood === nextMood) {
        applyMood();
      }
    }, 110);

    this.moodTransitionClearTimer = window.setTimeout(() => {
      this.moodTransitionClearTimer = null;
      if (this.element) {
        delete this.element.dataset.blink;
        delete this.element.dataset.moodTransition;
      }
    }, 320);
  }

  startMoodMonitoring() {
    if (this.moodInterval) {
      clearInterval(this.moodInterval);
    }

    this.moodInterval = setInterval(() => {
      const careMood = this.getCareDrivenMood();
      if (careMood && careMood !== 'sad') {
        this.setMood(careMood);
        return;
      }

      const now = Date.now();
      if (now - this.lastInteractionAt > 2 * 60 * 1000) {
        this.setMood('idle');
        return;
      }

      if ((this.mood === 'happy' || this.mood === 'excited') && now - this.lastInteractionAt > 12 * 1000) {
        this.setMood('idle', { silent: true });
        return;
      }

      if (this.mood === 'sleepy' && now - this.lastInteractionAt <= 2 * 60 * 1000) {
        this.setMood('idle', { silent: true });
      }
    }, 30 * 1000);
  }

  recordInteraction() {
    const now = Date.now();
    this.lastInteractionAt = now;
    this.tapHistory = this.tapHistory.filter((timestamp) => now - timestamp < 2500);
    this.tapHistory.push(now);

    if (this.tapHistory.length >= 3) {
      this.setMood('excited');
      return;
    }

    this.setMood('happy');
  }

  getCareDrivenMood() {
    if (!this.careState) {
      return null;
    }

    if (this.careState.hunger <= 0 && this.careState.hungerDepletedAt) {
      return Date.now() - this.careState.hungerDepletedAt >= 2 * 60 * 60 * 1000 ? 'sad' : 'hungry';
    }

    if (this.careState.hunger < 30) {
      return 'hungry';
    }

    if (this.careState.affection < 20) {
      return 'sad';
    }

    return null;
  }

  applyCareState(careState) {
    this.careState = careState;
    if (!this.element) {
      return;
    }

    this.element.dataset.dirty = careState.cleanliness < 45 ? 'true' : 'false';
    this.element.dataset.hungry = careState.hunger < 30 ? 'true' : 'false';
    this.element.dataset.cleanLow = careState.cleanliness < 30 ? 'true' : 'false';
    this.element.dataset.affectionLow = careState.affection < 30 ? 'true' : 'false';
    this.element.dataset.affectionHigh = careState.affection >= 70 ? 'true' : 'false';

    if (this.character && typeof this.character.setDirty === 'function') {
      this.character.setDirty(careState.cleanliness < 45);
    }

    this.renderStateEffects();

    const careMood = this.getCareDrivenMood();
    if (careMood) {
      this.setMood(careMood, { silent: true });
    }
  }

  reactToCareAction(action) {
    this.lastInteractionAt = Date.now();

    if (!this.element) {
      return;
    }

    if (action === 'feed' || action === 'pet' || action === 'clean') {
      this.setMood('happy', { silent: true });
      this.playTemporaryAnimation(action === 'pet' ? 'celebrate' : 'idle-look', action === 'pet' ? 1000 : 900);
      AnimationUtils.tapAnimation(this.element).then(() => {
        this.currentScale = parseFloat(getComputedStyle(this.element).getPropertyValue('--pet-scale')) || 1;
        this.applyTransform();
      });
    }
  }

  startCareBehaviorLoop() {
    if (this.careBehaviorInterval) {
      clearInterval(this.careBehaviorInterval);
    }

    this.careBehaviorInterval = setInterval(() => {
      this.runCareBehavior();
    }, 12000);
  }

  runCareBehavior() {
    if (!this.element || !this.careState || this.isDragging || this.focusMode || document.hidden || this.isUiBlocking()) {
      return;
    }

    if (this.careState.cleanliness < 30 && Math.random() < 0.38) {
      this.playTemporaryAnimation('scratch', 900);
      return;
    }

    if (this.careState.hunger < 30 && Math.random() < 0.36) {
      this.playTemporaryAnimation('sniff', 900);
      const target = {
        x: Math.max(24, Math.round(this.screenSize.width * 0.18)),
        y: Math.max(24, Math.min(this.screenSize.height - 96, this.position.y + (Math.random() * 50 - 25)))
      };
      this.moveToTarget(target);
      return;
    }

    this.tryAffectionBehavior();
  }

  tryAffectionBehavior() {
    if (!this.careState || !this.lastPointerPosition) {
      return;
    }

    const now = Date.now();
    if (now - this.lastAffectionBehaviorAt < 14000) {
      return;
    }

    const pointer = this.lastPointerPosition;
    const centerX = this.position.x + (this.element ? this.element.offsetWidth / 2 : 40);
    const centerY = this.position.y + (this.element ? this.element.offsetHeight / 2 : 20);
    const dx = pointer.x - centerX;
    const dy = pointer.y - centerY;
    const distance = Math.sqrt(dx ** 2 + dy ** 2);

    if (this.careState.affection >= 70 && distance > 140) {
      this.lastAffectionBehaviorAt = now;
      const target = {
        x: pointer.x + (Math.random() > 0.5 ? -86 : 46),
        y: pointer.y + (Math.random() * 56 - 28)
      };
      this.moveToTarget(this.clampPosition(target.x, target.y));
      return;
    }

    if (this.careState.affection < 30 && distance < 150) {
      this.lastAffectionBehaviorAt = now;
      const unit = distance > 0.1 ? { x: dx / distance, y: dy / distance } : { x: 1, y: 0 };
      const target = this.clampPosition(
        this.position.x - unit.x * 130,
        this.position.y - unit.y * 90
      );
      this.moveToTarget(target);
    }
  }

  clampPosition(x, y) {
    const width = this.element ? this.element.offsetWidth || 80 : 80;
    const height = this.element ? this.element.offsetHeight || 40 : 40;

    return {
      x: Math.max(0, Math.min(this.screenSize.width - width, x)),
      y: Math.max(0, Math.min(this.screenSize.height - height, y))
    };
  }

  createMotionToTarget(target) {
    if (!this.element || !target) {
      return null;
    }

    const dx = target.x - this.position.x;
    const dy = target.y - this.position.y;
    const distance = Math.sqrt(dx ** 2 + dy ** 2);
    if (distance < 1) {
      return null;
    }

    return {
      target,
      direction: {
        x: dx / distance,
        y: dy / distance
      },
      distance
    };
  }

  move() {
    if (!this.element) {
      return;
    }

    const target = this.currentPath[this.pathIndex];
    if (!target) {
      this.generateRandomPath();
      return;
    }

    const motion = this.createMotionToTarget(target);
    if (!motion) {
      this.pathIndex += 1;
      this.isCurrentlyMoving = false;
      this.currentSpeedRatio = 0;
      return;
    }

    const profile = this.getMoodProfile();
    const movement = this.getMovementProfile();
    const baseSpeed = Math.max(0.5, profile.speed * (movement.maxSpeedMultiplier || 1));
    const distanceRatio = Math.min(1, motion.distance / Math.max(40, movement.decelerationDistance || 72));
    const currentSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
    const currentDirection = currentSpeed > 0.001
      ? { x: this.velocity.x / currentSpeed, y: this.velocity.y / currentSpeed }
      : motion.direction;
    const alignment = currentDirection.x * motion.direction.x + currentDirection.y * motion.direction.y;
    const turnPenalty = 1 - ((1 - Math.max(-1, alignment)) * (movement.turnSlowdown || 0.2) * 0.5);
    const desiredSpeed = baseSpeed * Math.max(0.2, distanceRatio) * Math.max(0.45, turnPenalty);
    const desiredVelocity = {
      x: motion.direction.x * desiredSpeed,
      y: motion.direction.y * desiredSpeed
    };

    const acceleration = movement.acceleration || 0.16;
    const responsiveness = movement.turnResponsiveness || 0.12;

    const now = performance.now();
    const turnSharp = alignment < 0.22 && currentSpeed > 0.28;
    if (turnSharp && now - this.lastTurnAt > 360) {
      this.lastTurnAt = now;
      this.turnHoldUntil = now + 120;
    }
    this.isTurning = now < this.turnHoldUntil;

    const response = this.isTurning ? Math.max(0.06, Math.min(acceleration, responsiveness) * 0.4) : Math.max(acceleration, responsiveness);
    this.velocity.x += (desiredVelocity.x - this.velocity.x) * response;
    this.velocity.y += (desiredVelocity.y - this.velocity.y) * response;

    if (motion.distance < (movement.decelerationDistance || 72)) {
      this.velocity.x *= 0.96;
      this.velocity.y *= 0.96;
    }

    if (this.isTurning) {
      this.velocity.x *= 0.82;
      this.velocity.y *= 0.82;
    }

    const velocityMagnitude = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
    this.currentSpeedRatio = Math.min(1.6, velocityMagnitude / Math.max(0.01, baseSpeed));
    if (velocityMagnitude > 0.001) {
      this.direction = {
        x: this.velocity.x / velocityMagnitude,
        y: this.velocity.y / velocityMagnitude
      };
      this.currentFacing = this.direction.x >= 0 ? 1 : -1;
      this.applyTransform();
    }

    const nextX = this.position.x + this.velocity.x;
    const nextY = this.position.y + this.velocity.y;
    const boundary = CollisionUtils.checkBoundaryCollision(
      {
        x: nextX,
        y: nextY,
        width: this.element.offsetWidth,
        height: this.element.offsetHeight
      },
      this.screenSize.width,
      this.screenSize.height
    );

    if (boundary.left || boundary.right || boundary.top || boundary.bottom) {
      this.velocity = { x: 0, y: 0 };
      this.isCurrentlyMoving = false;
      this.currentSpeedRatio = 0;
      this.generateRandomPath();
      return;
    }

    this.isCurrentlyMoving = velocityMagnitude > 0.12;
    this.element.dataset.motion = this.isCurrentlyMoving ? 'moving' : 'idle';
    this.setPosition(nextX, nextY);

    if (motion.distance <= (movement.arrivalRadius || 10) + Math.max(2, velocityMagnitude * 1.8)) {
      this.setPosition(target.x, target.y);
      this.pathIndex += 1;
      if (this.pathIndex >= this.currentPath.length) {
        this.velocity.x *= 0.2;
        this.velocity.y *= 0.2;
        this.isCurrentlyMoving = false;
        this.currentSpeedRatio = 0;
      }
    }
  }

  startBodyWaveAnimation() {

    if (this.animationFrameId || document.hidden) {
      return;
    }

    this.lastAnimationFrameAt = performance.now();
    this.lastAnimationTickAt = 0;

    const animate = (timestamp) => {
      if (!this.element) {
        this.animationFrameId = null;
        return;
      }

      if (this.lastAnimationTickAt > 0 && timestamp - this.lastAnimationTickAt < this.animationFrameInterval) {
        this.animationFrameId = requestAnimationFrame(animate);
        return;
      }
      this.lastAnimationTickAt = timestamp;

      if (!this.isDragging) {
        if (this.movementInterval && !this.isMoving && !this.focusMode) {
          if (this.currentPath.length === 0 || this.pathIndex >= this.currentPath.length) {
            this.generateRandomPath();
          }

          this.move();
        }

        const profile = this.getMoodProfile();
        const delta = Math.max(0.5, Math.min(2.5, (timestamp - this.lastAnimationFrameAt) / 16.67 || 1));
        this.lastAnimationFrameAt = timestamp;
        const speedBoost = this.isCurrentlyMoving ? (0.72 + this.currentSpeedRatio * 0.95) : 0.52;
        this.animationPhase += profile.frequency * delta * speedBoost;

        CharacterAnimator.apply(this.getAnimationStrategy(), {
          segments: this.segments,
          legs: this.legs,
          headElement: this.headElement,
          bodyElement: this.bodyElement,
          profile,
          phase: this.animationPhase,
          isMoving: this.isCurrentlyMoving,
          isTurning: this.isTurning,
          speedRatio: this.currentSpeedRatio,
          direction: this.direction,
          root: this.element
        });
      }

      this.animationFrameId = requestAnimationFrame(animate);
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  pauseAnimations() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
      this.lastAnimationTickAt = 0;
    }
  }

  resumeAnimations() {
    if (!this.animationFrameId) {
      this.startBodyWaveAnimation();
    }
  }

  playTemporaryAnimation(name, duration = 900) {
    if (!this.element) {
      return;
    }

    if (this.temporaryAnimationTimer) {
      clearTimeout(this.temporaryAnimationTimer);
      this.temporaryAnimationTimer = null;
    }

    this.element.dataset.animation = name;
    if (this.character && typeof this.character.playAnimation === 'function') {
      this.character.playAnimation(name);
    }

    this.temporaryAnimationTimer = window.setTimeout(() => {
      if (this.element && this.element.dataset.animation === name) {
        delete this.element.dataset.animation;
      }
      this.temporaryAnimationTimer = null;
    }, duration);
  }

  onTap() {
    if (!this.element) {
      return;
    }

    this.recordInteraction();
    this.playTemporaryAnimation('idle-look', 850);
    AnimationUtils.tapAnimation(this.element).then(() => {
      this.currentScale = parseFloat(getComputedStyle(this.element).getPropertyValue('--pet-scale')) || 1;
      this.applyTransform();
    });
  }

  onDoubleTap() {
    if (!this.element) {
      return;
    }

    this.recordInteraction();
    this.setMood('excited', { silent: true });
    this.playTemporaryAnimation('celebrate', 1200);
    this.generateRandomPath();

    window.dispatchEvent(new CustomEvent('pet:double-tap', {
      detail: { instanceId: this.instanceId || 'primary' }
    }));
  }

  onDrop() {
    this.lastInteractionAt = Date.now();
    this.playTemporaryAnimation('drop', 900);
    this.setMood('excited', { silent: true });
    this.activeMotion = null;
    this.currentPath = [];
    this.pathIndex = 0;
    this.velocity = { x: 0, y: 0 };
    window.setTimeout(() => {
      if (!this.isDragging && !this.focusMode) {
        this.generateRandomPath();
      }
    }, 180);
  }

  handlePettingGesture(event) {
    if (this.isDragging) {
      return;
    }

    const now = Date.now();
    const dx = this.pettingState.lastX === null ? 0 : event.clientX - this.pettingState.lastX;
    this.pettingState.lastX = event.clientX;

    if (Math.abs(dx) < 5) {
      return;
    }

    const nextDirection = dx > 0 ? 1 : -1;
    if (this.pettingState.direction && nextDirection !== this.pettingState.direction) {
      this.pettingState.flips.push(now);
      this.pettingState.flips = this.pettingState.flips.filter((timestamp) => now - timestamp <= 2000);
    }

    this.pettingState.direction = nextDirection;

    if (this.pettingState.flips.length >= 3 && now - this.pettingState.lastTriggeredAt > 2500) {
      this.pettingState.lastTriggeredAt = now;
      this.pettingState.flips = [];
      this.lastInteractionAt = now;
      this.setMood('happy', { silent: true });
      this.playTemporaryAnimation('celebrate', 1000);

      window.dispatchEvent(new CustomEvent('pet:petting-gesture', {
        detail: { instanceId: this.instanceId || 'primary' }
      }));
    }
  }

  resetPettingState() {
    this.pettingState.lastX = null;
    this.pettingState.direction = 0;
    this.pettingState.flips = [];
  }

  lookAt(x) {
    if (!this.element) {
      return;
    }

    const dx = x - (this.position.x + this.element.offsetWidth / 2);
    this.currentFacing = dx >= 0 ? 1 : -1;
    this.applyTransform();
  }

  stopMovement() {
    if (!this.movementInterval) {
      return;
    }

    this.movementInterval = null;
    this.isCurrentlyMoving = false;
    this.activeMotion = null;
    this.velocity = { x: 0, y: 0 };
    this.currentSpeedRatio = 0;
    this.isTurning = false;
    if (this.element) {
      this.element.dataset.motion = 'idle';
    }
  }

  setFocusMode(enabled) {
    this.focusMode = enabled;

    if (!this.element) {
      return;
    }

    if (enabled) {
      this.stopMovement();
      this.element.dataset.focus = 'true';
      this.setMood('sleepy', { silent: true, immediate: true });
      this.renderStateEffects();
      return;
    }

    this.element.dataset.focus = 'false';
    this.setMood('idle', { silent: true, immediate: true });
    this.renderStateEffects();

    if (!this.movementInterval) {
      this.startContinuousMovement();
    }
  }

  destroy() {
    this.stopMovement();
    this.pauseAnimations();
    this.dispatchHoverChange(false);

    if (this.moodInterval) {
      clearInterval(this.moodInterval);
      this.moodInterval = null;
    }

    if (this.careBehaviorInterval) {
      clearInterval(this.careBehaviorInterval);
      this.careBehaviorInterval = null;
    }

    if (this.temporaryAnimationTimer) {
      clearTimeout(this.temporaryAnimationTimer);
      this.temporaryAnimationTimer = null;
    }

    if (this.moodTransitionTimer) {
      clearTimeout(this.moodTransitionTimer);
      this.moodTransitionTimer = null;
    }

    if (this.moodTransitionClearTimer) {
      clearTimeout(this.moodTransitionClearTimer);
      this.moodTransitionClearTimer = null;
    }

    this.unbindPetElementEvents();

    if (this.documentHandlers) {
      document.removeEventListener('mousemove', this.documentHandlers.mousemove);
      document.removeEventListener('mouseup', this.documentHandlers.mouseup);
      this.documentHandlers = null;
    }

    if (this.windowHandlers) {
      window.removeEventListener('blur', this.windowHandlers.blur);
      window.removeEventListener('resize', this.windowHandlers.resize);
      this.windowHandlers = null;
    }

    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }

    const inputPanel = document.getElementById('input-panel');
    if (inputPanel && this.inputPanelHandlers) {
      inputPanel.removeEventListener('mouseenter', this.inputPanelHandlers.mouseenter);
      inputPanel.removeEventListener('mouseleave', this.inputPanelHandlers.mouseleave);
      this.inputPanelHandlers = null;
    }
  }
}
