class RainbowBotCharacter extends BaseCharacter {
  constructor(config) {
    super(config);
    this._assetBasePath = '';
    this._imageEl = null;
    this._observer = null;
    this._frameRafId = null;
    this._lastFrameAt = 0;
    this._frameIndex = 0;
    this._activeSequenceKey = '';
    this._currentSrc = '';
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
      idle: 2.2,
      walk: 8,
      happy: 5.2,
      talking: 7,
      sleepy: 1.4,
      confused: 2.6,
      dizzy: 6,
      sad: 1.3
    };
  }

  async load(basePath) {
    this._assetBasePath = basePath;
    await super.load(basePath);
    this._preloadFrames();
  }

  render(container) {
    const root = super.render(container);
    this._imageEl = root ? root.querySelector('.rb-body-image') : null;
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
    if (this._frameRafId) {
      cancelAnimationFrame(this._frameRafId);
      this._frameRafId = null;
    }
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    this._imageEl = null;
    this._activeSequenceKey = '';
    this._currentSrc = '';
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
      attributeFilter: ['data-animation', 'data-mood', 'data-low-power', 'data-fps-cap']
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
      effectiveFps *= sequenceKey === 'walk' ? 0.72 : 0.52;
      if (fpsCap <= 24 && sequenceKey !== 'walk') {
        effectiveFps = Math.min(effectiveFps, 1.0);
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
      this._currentSrc = nextSrc;
    }

    if (this.rootElement) {
      this.rootElement.dataset.spriteState = sequenceKey;
      this.rootElement.dataset.spriteFrame = String(safeIndex);
    }
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
  }

  _startFrameLoop() {
    if (this._frameRafId) {
      return;
    }

    const tick = (timestamp) => {
      if (!this.rootElement || !this._imageEl) {
        this._frameRafId = null;
        return;
      }

      const sequenceKey = this._activeSequenceKey || this._resolveSequenceKey();
      const frames = this._getSequenceFrames(sequenceKey);
      if (frames.length > 1) {
        const interval = this._getFrameInterval(sequenceKey);
        if (!this._lastFrameAt || timestamp - this._lastFrameAt >= interval) {
          this._lastFrameAt = timestamp;
          this._frameIndex = (this._frameIndex + 1) % frames.length;
          this._applyCurrentFrame(sequenceKey, false);
        }
      } else {
        this._frameIndex = 0;
        this._applyCurrentFrame(sequenceKey, false);
      }

      this._frameRafId = requestAnimationFrame(tick);
    };

    this._frameRafId = requestAnimationFrame(tick);
  }
}
