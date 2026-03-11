class QuickActions {
  constructor() {
    this.element = null;
    this.petController = null;
    this.onAction = null;
    this.visible = false;
    this.state = 'hidden';

    this.petHovered = false;
    this.actionHovered = false;
    this.hoverTimer = null;
    this.hideTimer = null;

    this.hoverShowDelayMs = 420;
    this.hideDelayMs = 420;
    this.expandLockMs = 1800;
    this.lockUntil = 0;

    this.boundMoveHandler = null;
    this.boundVisibilityHandler = null;
    this.boundHoverHandler = null;
    this.boundKeyDownHandler = null;
  }

  init(options = {}) {
    this.petController = options.petController || null;
    this.onAction = options.onAction || (() => {});
    this.create();
    this.bindEvents();
  }

  create() {
    this.element = document.createElement('div');
    this.element.id = 'quick-actions';
    this.element.className = 'quick-actions hidden';
    this.element.dataset.visible = 'false';
    this.element.dataset.state = 'hidden';
    this.element.innerHTML = `
      <div class="quick-menu" role="menu" aria-label="互动动作">
        <button type="button" data-action="chat" aria-label="聊天"><span class="icon">💬</span><span class="label">聊天</span></button>
        <button type="button" data-action="feed" aria-label="喂食"><span class="icon">🍃</span><span class="label">喂食</span></button>
        <button type="button" data-action="pet" aria-label="抚摸"><span class="icon">✋</span><span class="label">抚摸</span></button>
        <button type="button" data-action="clean" aria-label="清洁"><span class="icon">✨</span><span class="label">清洁</span></button>
      </div>
    `;
    document.body.appendChild(this.element);
    this.hide(true);

    this.element.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      this.runAction(button.dataset.action);
    });

    this.element.addEventListener('mouseenter', () => {
      this.actionHovered = true;
      this.cancelHide();
      this.ensureInteractiveWindow();
    });

    this.element.addEventListener('mouseleave', () => {
      this.actionHovered = false;
      this.scheduleHide(this.hideDelayMs);
    });
  }

  bindEvents() {
    this.boundMoveHandler = (event) => {
      if (!event.detail || event.detail.instanceId !== (this.petController.instanceId || 'primary')) {
        return;
      }

      if (this.visible) {
        this.positionNearPet();
      }
    };

    this.boundVisibilityHandler = () => {
      this.hide(true);
    };

    this.boundHoverHandler = (event) => {
      if (!event.detail || event.detail.instanceId !== (this.petController.instanceId || 'primary')) {
        return;
      }

      if (event.detail.visible) {
        this.petHovered = true;
        this.cancelHide();

        if (this.visible) {
          this.ensureInteractiveWindow();
          return;
        }

        this.cancelHoverTimer();
        this.hoverTimer = window.setTimeout(() => {
          this.hoverTimer = null;
          if (this.petHovered) {
            this.showMenu('hover');
          }
        }, this.hoverShowDelayMs);
        return;
      }

      this.petHovered = false;
      this.cancelHoverTimer();
      this.scheduleHide(this.hideDelayMs);
    };

    this.boundKeyDownHandler = (event) => {
      if (!this.visible || this.state !== 'expanded') {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        this.hide(true);
        return;
      }

      const keyMap = {
        '1': 'chat',
        '2': 'feed',
        '3': 'pet',
        '4': 'clean'
      };
      const action = keyMap[event.key];
      if (!action) {
        return;
      }

      event.preventDefault();
      this.runAction(action);
    };

    window.addEventListener('pet:move', this.boundMoveHandler);
    window.addEventListener('settings:visibility', this.boundVisibilityHandler);
    window.addEventListener('character-picker:visibility', this.boundVisibilityHandler);
    window.addEventListener('pet-manager:visibility', this.boundVisibilityHandler);
    window.addEventListener('pet:hover-change', this.boundHoverHandler);
    document.addEventListener('keydown', this.boundKeyDownHandler);
  }

  clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  positionNearPet() {
    const petElement = this.petController && this.petController.getElement ? this.petController.getElement() : null;
    if (!petElement || !this.element) {
      return false;
    }

    const rect = petElement.getBoundingClientRect();
    const radius = 94;
    const edgePadding = 10;
    const petGap = 16;

    const preferRightCenterX = rect.right + radius + petGap;
    const preferLeftCenterX = rect.left - radius - petGap;
    const fitsRight = preferRightCenterX + radius <= window.innerWidth - edgePadding;
    const rawCenterX = fitsRight ? preferRightCenterX : preferLeftCenterX;

    const centerX = this.clamp(rawCenterX, radius + edgePadding, window.innerWidth - radius - edgePadding);
    const centerY = rect.top + rect.height * 0.5;
    const y = this.clamp(centerY, radius + edgePadding, window.innerHeight - radius - edgePadding);

    this.element.style.left = `${(centerX - radius).toFixed(1)}px`;
    this.element.style.top = `${(y - radius).toFixed(1)}px`;
    return true;
  }

  showMenu(_reason = 'manual') {
    if (!this.element) {
      return;
    }

    this.cancelHide();
    this.ensureInteractiveWindow();
    const positioned = this.positionNearPet();
    if (!positioned) {
      this.hide(true);
      return;
    }

    this.visible = true;
    this.state = 'expanded';
    this.lockUntil = Date.now() + this.expandLockMs;
    this.element.classList.remove('hidden');
    this.element.dataset.visible = 'true';
    this.element.dataset.state = 'expanded';
  }

  runAction(action) {
    if (!action) {
      return;
    }

    this.ensureInteractiveWindow();
    this.onAction(action);
    this.hide(true);
  }

  showForPet() {
    this.showMenu('tap');
    this.scheduleHide(3200);
  }

  hide(immediate = true) {
    if (!this.element) {
      return;
    }

    if (!immediate && (this.petHovered || this.actionHovered)) {
      return;
    }

    this.cancelHoverTimer();
    this.cancelHide();
    this.petHovered = false;
    this.actionHovered = false;
    this.lockUntil = 0;
    this.visible = false;
    this.state = 'hidden';
    this.element.classList.add('hidden');
    this.element.dataset.visible = 'false';
    this.element.dataset.state = 'hidden';
  }

  scheduleHide(delay = 220) {
    if (!this.visible) {
      return;
    }

    this.cancelHide();
    let waitMs = delay;
    if (this.state === 'expanded' && Date.now() < this.lockUntil) {
      waitMs = Math.max(waitMs, this.lockUntil - Date.now() + 40);
    }

    this.hideTimer = window.setTimeout(() => {
      this.hideTimer = null;
      if (this.petHovered || this.actionHovered) {
        return;
      }

      this.hide(false);
    }, waitMs);
  }

  cancelHide() {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  cancelHoverTimer() {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
  }

  contains(target) {
    return Boolean(this.element && target instanceof Node && this.element.contains(target));
  }

  ensureInteractiveWindow() {
    if (this.petController && typeof this.petController.updateIgnoreMouseEvents === 'function') {
      this.petController.updateIgnoreMouseEvents(false, { force: true });
      return;
    }

    if (window.electronAPI && typeof window.electronAPI.setIgnoreMouseEvents === 'function') {
      window.electronAPI.setIgnoreMouseEvents(false, { forward: true });
    }
  }

  destroy() {
    if (this.boundMoveHandler) {
      window.removeEventListener('pet:move', this.boundMoveHandler);
      this.boundMoveHandler = null;
    }

    if (this.boundVisibilityHandler) {
      window.removeEventListener('settings:visibility', this.boundVisibilityHandler);
      window.removeEventListener('character-picker:visibility', this.boundVisibilityHandler);
      window.removeEventListener('pet-manager:visibility', this.boundVisibilityHandler);
      this.boundVisibilityHandler = null;
    }

    if (this.boundHoverHandler) {
      window.removeEventListener('pet:hover-change', this.boundHoverHandler);
      this.boundHoverHandler = null;
    }

    if (this.boundKeyDownHandler) {
      document.removeEventListener('keydown', this.boundKeyDownHandler);
      this.boundKeyDownHandler = null;
    }

    this.cancelHoverTimer();
    this.cancelHide();

    if (this.element) {
      this.element.remove();
      this.element = null;
    }
  }
}
