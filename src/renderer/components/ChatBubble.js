class ChatBubble {
  constructor() {
    this.element = document.getElementById('chat-bubble');
    this.contentElement = this.element.querySelector('.content');
    this.hideTimer = null;
    this.streaming = false;
    this.petController = null;
    this.currentPosition = { x: null, y: null };
    this.targetPosition = { x: null, y: null };
    this.followRafId = null;
    this.lastPetDetail = null;
  }

  init(petController) {
    this.petController = petController;
  }

  getPetElement() {
    if (this.petController && this.petController.getElement()) {
      return this.petController.getElement();
    }

    return document.getElementById('caterpillar');
  }

  show(message, duration = 3000) {
    this.streaming = false;
    this.contentElement.textContent = message;
    this.positionNearPet(true);
    this.element.classList.remove('hidden');
    this.startFollowLoop();

    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
    }

    this.hideTimer = setTimeout(() => {
      this.hide();
    }, duration);
  }

  positionNearPet(force = false, eventDetail = null) {
    if (eventDetail) {
      this.lastPetDetail = eventDetail;
    }

    const petElement = this.getPetElement();
    if (!petElement) {
      return;
    }

    const rect = petElement.getBoundingClientRect();
    const bubbleWidth = this.element.offsetWidth || 220;
    const bubbleHeight = this.element.offsetHeight || 54;
    const margin = 12;
    const pointerMargin = 16;
    const facing = this.lastPetDetail && Number.isFinite(this.lastPetDetail.facing)
      ? this.lastPetDetail.facing
      : 1;

    const petCenterX = rect.left + rect.width / 2;
    const leadX = facing >= 0 ? rect.width * 0.16 : -rect.width * 0.16;
    const anchorX = petCenterX + leadX;
    const aboveY = rect.top - bubbleHeight - pointerMargin;
    const belowY = rect.bottom + pointerMargin;
    const preferAbove = aboveY >= margin;

    const unclampedLeft = anchorX - bubbleWidth / 2;
    const clampedLeft = this.clamp(unclampedLeft, margin, window.innerWidth - bubbleWidth - margin);
    const top = preferAbove
      ? aboveY
      : Math.min(window.innerHeight - bubbleHeight - margin, belowY);

    const nextX = this.clamp(clampedLeft, margin, window.innerWidth - bubbleWidth - margin);
    const nextY = this.clamp(top, margin, window.innerHeight - bubbleHeight - margin);
    this.targetPosition = { x: nextX, y: nextY };

    const tailX = this.clamp(anchorX - nextX, 18, bubbleWidth - 18);
    this.element.style.setProperty('--tail-x', `${tailX.toFixed(1)}px`);
    this.element.dataset.tail = preferAbove ? 'down' : 'up';

    if (force || this.currentPosition.x === null || this.currentPosition.y === null) {
      this.currentPosition = { ...this.targetPosition };
      this.applyPosition(this.currentPosition.x, this.currentPosition.y);
      return;
    }

    this.startFollowLoop();
  }

  clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  applyPosition(x, y) {
    this.element.style.left = `${x.toFixed(2)}px`;
    this.element.style.top = `${y.toFixed(2)}px`;
  }

  startFollowLoop() {
    if (this.followRafId || this.element.classList.contains('hidden')) {
      return;
    }

    const tick = () => {
      if (this.element.classList.contains('hidden')) {
        this.stopFollowLoop();
        return;
      }

      if (this.currentPosition.x === null || this.currentPosition.y === null) {
        this.currentPosition = { ...this.targetPosition };
      } else {
        const dx = this.targetPosition.x - this.currentPosition.x;
        const dy = this.targetPosition.y - this.currentPosition.y;
        this.currentPosition.x += dx * 0.28;
        this.currentPosition.y += dy * 0.28;

        if (Math.abs(dx) < 0.2) {
          this.currentPosition.x = this.targetPosition.x;
        }
        if (Math.abs(dy) < 0.2) {
          this.currentPosition.y = this.targetPosition.y;
        }
      }

      this.applyPosition(this.currentPosition.x, this.currentPosition.y);
      this.followRafId = requestAnimationFrame(tick);
    };

    this.followRafId = requestAnimationFrame(tick);
  }

  stopFollowLoop() {
    if (this.followRafId) {
      cancelAnimationFrame(this.followRafId);
      this.followRafId = null;
    }
  }

  hide() {
    this.element.classList.add('hidden');
    this.hideTimer = null;
    this.streaming = false;
    this.stopFollowLoop();
  }

  showLoading() {
    this.streaming = false;
    this.contentElement.textContent = '思考中...';
    this.positionNearPet(true);
    this.element.classList.remove('hidden');
    this.startFollowLoop();
  }

  startStream() {
    this.streaming = true;
    this.contentElement.textContent = '';
    this.positionNearPet(true);
    this.element.classList.remove('hidden');
    this.startFollowLoop();

    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  appendStream(chunk) {
    if (!this.streaming) {
      this.startStream();
    }

    this.contentElement.textContent += chunk;
    this.positionNearPet();
  }

  finishStream(duration = 5000) {
    this.streaming = false;

    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
    }

    this.hideTimer = setTimeout(() => {
      this.hide();
    }, duration);
  }

  async typeText(message, duration = 5000, interval = 18) {
    this.startStream();
    const speedMultiplier = this.resolveTypeSpeed(message);

    for (let index = 0; index < message.length; index += 1) {
      const char = message[index];
      this.appendStream(char);
      const pause = this.getTypePause(char, interval, speedMultiplier);
      if (pause > 0) {
        await this.sleep(pause);
      }
    }

    this.finishStream(duration);
  }

  resolveTypeSpeed(message) {
    if (/^(你好|嗨|早上好|晚上好|Hi|Hello)/iu.test(message.trim())) {
      return 0.82;
    }

    if (/(让我想想|我觉得|可能|因为|分析|总结|步骤)/u.test(message)) {
      return 1.24;
    }

    return 1;
  }

  getTypePause(char, baseInterval, speedMultiplier) {
    if (!char) {
      return baseInterval;
    }

    if (this.isEmoji(char)) {
      return 0;
    }

    if (/[。！？!?]/u.test(char)) {
      return Math.round(baseInterval * 6 * speedMultiplier);
    }

    if (/[，,；;：:]/u.test(char)) {
      return Math.round(baseInterval * 3.4 * speedMultiplier);
    }

    if (/\s/u.test(char)) {
      return Math.round(baseInterval * 0.5 * speedMultiplier);
    }

    return Math.round(baseInterval * speedMultiplier);
  }

  isEmoji(char) {
    try {
      return /\p{Extended_Pictographic}/u.test(char);
    } catch (_error) {
      const code = char.codePointAt(0) || 0;
      return code > 0x1f000;
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  showError(message) {
    this.streaming = false;
    this.contentElement.textContent = `错误: ${message}`;
    this.positionNearPet(true);
    this.element.classList.remove('hidden');
    this.startFollowLoop();

    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
    }

    this.hideTimer = setTimeout(() => {
      this.hide();
    }, 3000);
  }
}
