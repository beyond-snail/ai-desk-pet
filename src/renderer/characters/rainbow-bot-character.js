class RainbowBotCharacter extends BaseCharacter {
  constructor(config) {
    super(config);
    this._assetBasePath = '';
    this._imageEl = null;
    this._imageBackEl = null;
    this._imageFrontEl = null;
    this._observer = null;
    this._frameTimerId = null;
    this._lastFrameAt = 0;
    this._frameIndex = 0;
    this._activeSequenceKey = '';
    this._currentSrc = '';
    this._renderedSequenceKey = '';
    this._renderedFrameIndex = -1;
    this._currentMood = 'idle';
    this._isLowPower = false;
    this._fpsCap = 60;

    this._moodToSequence = {
      idle: 'idle',
      hungry: 'idle',
      happy: 'happy',
      excited: 'happy',
      confused: 'confused',
      sleepy: 'sleepy',
      talking: 'talking',
      dizzy: 'dizzy',
      sad: 'sad'
    };

    this._frameSequences = {
      idle: ['idle-1.svg', 'idle-1.svg', 'idle-1.svg', 'idle-2.svg'],
      walk: ['walk-1.svg', 'walk-2.svg'],
      happy: ['happy-1.svg', 'happy-2.svg'],
      talking: ['talking-1.svg', 'talking-2.svg'],
      sleepy: ['sleepy-1.svg'],
      confused: ['confused-1.svg'],
      dizzy: ['dizzy-1.svg'],
      sad: ['sad-1.svg']
    };

    this._baseFps = {
      idle: 1.8,
      walk: 5.8,
      happy: 4.1,
      talking: 4.8,
      sleepy: 1.4,
      confused: 2.2,
      dizzy: 4.2,
      sad: 1.2
    };
  }

  async load(basePath) {
    this._assetBasePath = basePath;
    await super.load(basePath);
    this._preloadFrames();
  }

  render(container) {
    const root = super.render(container);
    this._imageEl = root ? root.querySelector('.rb-body-image-main') : null;
    this._imageBackEl = root ? root.querySelector('.rb-body-image-back') : null;
    this._imageFrontEl = root ? root.querySelector('.rb-body-image-front') : null;
    this._readRuntimeFlags();
    this._startObserver();
    this._syncState({ resetFrame: true, forceRender: true });
    this._startFrameLoop();
    return root;
  }

  applyMood(payload) {
    super.applyMood(payload);
    this._currentMood = this._resolveMood(payload);
    this._syncState({ resetFrame: true, forceRender: true });
  }

  destroy() {
    if (this._frameTimerId) {
      clearTimeout(this._frameTimerId);
      this._frameTimerId = null;
    }
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    this._imageEl = null;
    this._imageBackEl = null;
    this._imageFrontEl = null;
    this._activeSequenceKey = '';
    this._currentSrc = '';
    this._renderedSequenceKey = '';
    this._renderedFrameIndex = -1;
    super.destroy();
  }

  _resolveMood(payload) {
    if (typeof payload === 'object' && payload !== null) {
      return payload.mood || 'idle';
    }
    return payload || 'idle';
  }

  _assetPath(fileName) {
    return `${this._assetBasePath}/assets/${fileName}`;
  }

  _preloadFrames() {
    const files = new Set();
    Object.values(this._frameSequences).forEach((sequence) => {
      sequence.forEach((fileName) => files.add(fileName));
    });
    files.forEach((fileName) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = this._assetPath(fileName);
    });
  }

  _readRuntimeFlags() {
    if (!this.rootElement) {
      return;
    }
    this._isLowPower = this.rootElement.dataset.lowPower === 'true';
    const fpsCap = Number.parseInt(this.rootElement.dataset.fpsCap || '60', 10);
    this._fpsCap = Number.isFinite(fpsCap) ? Math.max(12, Math.min(60, fpsCap)) : 60;
  }

  _startObserver() {
    if (!this.rootElement || this._observer) {
      return;
    }
    this._observer = new MutationObserver(() => {
      this._readRuntimeFlags();
      this._syncState({ resetFrame: false, forceRender: false });
    });
    this._observer.observe(this.rootElement, {
      attributes: true,
      attributeFilter: ['data-animation', 'data-mood', 'data-low-power', 'data-fps-cap', 'data-direction']
    });
  }

  _resolveSequenceKey() {
    if (!this.rootElement) {
      return this._moodToSequence[this._currentMood] || 'idle';
    }

    if ((this.rootElement.dataset.animation || '') === 'walk') {
      return 'walk';
    }

    const mood = this.rootElement.dataset.mood || this._currentMood || 'idle';
    return this._moodToSequence[mood] || 'idle';
  }

  _getSequenceFrames(sequenceKey) {
    return this._frameSequences[sequenceKey] || this._frameSequences.idle;
  }

  _getFrameInterval(sequenceKey) {
    const baseFps = this._baseFps[sequenceKey] || 2;
    const fpsCap = Math.max(1, this._fpsCap);
    let effectiveFps = Math.min(baseFps, Math.max(1, fpsCap - 1));

    if (this._isLowPower) {
      effectiveFps *= sequenceKey === 'walk' ? 0.58 : 0.4;
      if (fpsCap <= 24 && sequenceKey !== 'walk') {
        effectiveFps = Math.min(effectiveFps, 0.9);
      }
    }

    effectiveFps = Math.max(0.6, effectiveFps);
    return 1000 / effectiveFps;
  }

  _applyCurrentFrame(sequenceKey, forceRender = false) {
    if (!this._imageEl) {
      return;
    }
    const frames = this._getSequenceFrames(sequenceKey);
    if (frames.length === 0) {
      return;
    }

    const safeIndex = ((this._frameIndex % frames.length) + frames.length) % frames.length;
    const fileName = frames[safeIndex];
    const nextSrc = this._assetPath(fileName);

    if (forceRender || this._currentSrc !== nextSrc) {
      this._imageEl.src = nextSrc;
      if (this._imageBackEl) {
        this._imageBackEl.src = nextSrc;
      }
      if (this._imageFrontEl) {
        this._imageFrontEl.src = nextSrc;
      }
      this._currentSrc = nextSrc;
    }

    if (this.rootElement) {
      const frameText = String(safeIndex);
      if (this.rootElement.dataset.spriteState !== sequenceKey) {
        this.rootElement.dataset.spriteState = sequenceKey;
      }
      if (this.rootElement.dataset.spriteFrame !== frameText) {
        this.rootElement.dataset.spriteFrame = frameText;
      }
    }
    this._renderedSequenceKey = sequenceKey;
    this._renderedFrameIndex = safeIndex;
  }

  _syncState({ resetFrame = false, forceRender = false } = {}) {
    const nextKey = this._resolveSequenceKey();
    const changed = this._activeSequenceKey !== nextKey;

    if (changed || resetFrame) {
      this._frameIndex = 0;
      this._lastFrameAt = 0;
    }

    this._activeSequenceKey = nextKey;
    this._applyCurrentFrame(nextKey, forceRender || changed || resetFrame);
    this._syncProxy3D(nextKey);
  }

  _syncProxy3D(sequenceKey) {
    if (!this.rootElement) {
      return;
    }

    const mood = this.rootElement.dataset.mood || this._currentMood || 'idle';
    const direction = this.rootElement.dataset.direction || 'right';
    const moving = sequenceKey === 'walk';

    const lowVisualMode = this._isLowPower || this._fpsCap <= 30;
    const rotateY = lowVisualMode
      ? 0
      : (moving ? (direction === 'left' ? -4 : 4) : (direction === 'left' ? -2 : 2));
    const walkPitch = 0;
    const moodDepth = lowVisualMode
      ? 0
      : (
        mood === 'excited' || mood === 'happy'
          ? 5
          : mood === 'sleepy' || mood === 'sad'
            ? 2
            : 3
      );
    const frontGlow = lowVisualMode
      ? 0
      : (
        mood === 'talking'
          ? 0.12
          : mood === 'happy'
            ? 0.1
            : 0.08
      );
    const backGlow = lowVisualMode ? 0 : (moving ? 0.06 : 0.05);

    this.rootElement.style.setProperty('--rb-proxy-rotate-y', `${rotateY}deg`);
    this.rootElement.style.setProperty('--rb-proxy-rotate-x', `${walkPitch}deg`);
    this.rootElement.style.setProperty('--rb-depth-main', `${moodDepth}px`);
    this.rootElement.style.setProperty('--rb-front-glow', String(frontGlow));
    this.rootElement.style.setProperty('--rb-back-glow', String(backGlow));
  }

  _scheduleFrameTick(delayMs = 120) {
    if (this._frameTimerId) {
      clearTimeout(this._frameTimerId);
    }
    this._frameTimerId = window.setTimeout(() => {
      this._frameTimerId = null;
      this._runFrameTick();
    }, delayMs);
  }

  _runFrameTick() {
    if (!this.rootElement || !this._imageEl) {
      this._frameTimerId = null;
      return;
    }

    if (document.hidden) {
      this._scheduleFrameTick(420);
      return;
    }

    const sequenceKey = this._activeSequenceKey || this._resolveSequenceKey();
    const frames = this._getSequenceFrames(sequenceKey);
    const interval = this._getFrameInterval(sequenceKey);
    const now = performance.now();

    if (frames.length > 1) {
      if (!this._lastFrameAt || now - this._lastFrameAt >= interval) {
        this._lastFrameAt = now;
        this._frameIndex = (this._frameIndex + 1) % frames.length;
        this._applyCurrentFrame(sequenceKey, false);
      }
    } else if (this._renderedSequenceKey !== sequenceKey || this._renderedFrameIndex !== 0) {
      this._frameIndex = 0;
      this._applyCurrentFrame(sequenceKey, false);
    }

    const nextDelay = frames.length > 1
      ? Math.max(70, Math.min(320, interval * 0.92))
      : 360;
    this._scheduleFrameTick(nextDelay);
  }

  _startFrameLoop() {
    if (this._frameTimerId) {
      return;
    }
    this._runFrameTick();
  }
}
