class CharacterAnimator {
  static rainbowBotState = new WeakMap();

  static quantize(value, step = 2) {
    return Math.round(value / step) * step;
  }

  static clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  static ensureRainbowBotState(root) {
    if (!root) {
      return {
        walking: false,
        holdUntil: 0,
        lastFacing: 1,
        lean: 0
      };
    }

    let state = this.rainbowBotState.get(root);
    if (!state) {
      state = {
        walking: false,
        holdUntil: 0,
        lastFacing: 1,
        lean: 0
      };
      this.rainbowBotState.set(root, state);
    }
    return state;
  }

  static apply(strategy, context) {
    const nextStrategy = strategy || 'caterpillar';
    if (nextStrategy === 'rainbow-bot') {
      this.applyRainbowBot(context);
      return;
    }

    if (nextStrategy === 'cyber-bot') {
      this.applyCyberBot(context);
      return;
    }

    if (nextStrategy === 'pixel-pet') {
      this.applyPixelPet(context);
      return;
    }

    this.applyCaterpillar(context);
  }

  static applyRainbowBot(context) {
    const {
      root,
      isMoving,
      segments,
      speedRatio,
      direction,
      phase
    } = context;

    const body = segments[0] || null;

    if (body) {
      body.style.transform = '';
    }

    if (!root) {
      return;
    }

    const state = this.ensureRainbowBotState(root);
    const now = performance.now();
    const normalizedSpeed = this.clamp(Number(speedRatio) || 0, 0, 1.6);
    const directionX = Number.isFinite(direction?.x) ? direction.x : 0;
    const movingEnough = Boolean(isMoving) && normalizedSpeed > 0.08;

    if (movingEnough) {
      state.walking = true;
      state.holdUntil = now + 260;
    } else if (state.walking && now >= state.holdUntil) {
      state.walking = false;
    }

    const currentAnimation = root.dataset.animation || '';
    if (state.walking) {
      if (!currentAnimation || currentAnimation === 'walk') {
        root.dataset.animation = 'walk';
      }
    } else if (currentAnimation === 'walk') {
      delete root.dataset.animation;
    }

    const facingIntent = directionX >= 0 ? 1 : -1;
    if (state.walking) {
      state.lastFacing = facingIntent;
    }

    const cadence = state.walking
      ? 0.74 + normalizedSpeed * 0.42
      : 0.58 + normalizedSpeed * 0.16;
    const idleDrift = Math.sin((phase || 0) * 0.42) * 0.8;
    const shiftX = this.clamp(directionX * (state.walking ? 2.6 : 0.7) + idleDrift, -3.6, 3.6);
    const bobScale = state.walking
      ? Math.min(1.14, 0.86 + normalizedSpeed * 0.2)
      : 0.76 + Math.abs(Math.sin((phase || 0) * 0.26)) * 0.08;
    const squash = state.walking
      ? 1 - Math.min(0.05, normalizedSpeed * 0.028)
      : 0.988 + Math.sin((phase || 0) * 0.34) * 0.012;

    root.style.setProperty('--pet-walk-speed', String(cadence.toFixed(3)));
    root.style.setProperty('--rb-lean', '0deg');
    root.style.setProperty('--rb-shift-x', `${shiftX.toFixed(2)}px`);
    root.style.setProperty('--rb-bob-scale', String(bobScale.toFixed(3)));
    root.style.setProperty('--rb-shell-squash', String(squash.toFixed(3)));
  }

  static applyCaterpillar(context) {
    const {
      segments,
      legs,
      headElement,
      bodyElement,
      profile,
      phase,
      isMoving,
      isTurning,
      speedRatio,
      direction,
      root
    } = context;

    const moveFactor = isMoving ? 1 : 0.45;
    const amplitude = profile.amplitude * moveFactor;
    const stretchAmount = isMoving ? 0.06 : 0.02;
    const cadence = 0.85 + (speedRatio || 0) * 0.65;

    segments.forEach((segment, index) => {
      const localPhase = phase - index * 0.6;
      const offsetY = Math.sin(localPhase) * amplitude;
      const stretch = 1 + Math.sin(localPhase + 0.8) * stretchAmount;
      const squash = 1 - Math.sin(localPhase + 0.8) * stretchAmount * 0.65;
      segment.style.transform = `translate3d(0, ${offsetY.toFixed(2)}px, 0) scaleX(${stretch.toFixed(3)}) scaleY(${squash.toFixed(3)})`;
    });

    legs.forEach((leg, index) => {
      const sidePhase = index % 2 === 0 ? 0 : Math.PI;
      const swing = profile.legRotation === 0 ? 0 : Math.sin(phase * 1.25 * cadence + sidePhase) * profile.legRotation;
      const lift = isMoving ? Math.max(0, Math.sin(phase * 1.2 + sidePhase)) * -1.8 : 0;
      leg.style.transform = `translate3d(0, ${lift.toFixed(2)}px, 0) rotate(${swing.toFixed(2)}deg)`;
    });

    if (headElement) {
      const nod = Math.sin(phase * 0.75) * (isMoving ? 1.8 : 0.8);
      const turnTilt = isTurning ? direction.x * 3 : 0;
      const tilt = this.clamp(direction.x * 7 + turnTilt, -9, 9);
      headElement.style.transform = `translate3d(0, calc(-50% + ${nod.toFixed(2)}px), 0) rotate(${tilt.toFixed(2)}deg)`;
    }

    if (bodyElement) {
      const crawlShift = isMoving ? Math.sin(phase * 0.9) * 1.5 : 0;
      bodyElement.style.transform = `translate3d(${crawlShift.toFixed(2)}px, 0, 0)`;
    }

    if (root) {
      root.style.setProperty('--pet-motion-intensity', isMoving ? '1' : '0.65');
      root.style.setProperty('--pet-walk-speed', String(cadence.toFixed(3)));
    }
  }

  static applyCyberBot(context) {
    const {
      segments,
      legs,
      headElement,
      profile,
      phase,
      isMoving,
      speedRatio,
      direction,
      root
    } = context;

    const shell = headElement || segments[0] || null;
    const cadence = 0.86 + (speedRatio || 0) * 0.58;
    const bob = Math.sin(phase * 1.1 * cadence) * (isMoving ? 1.8 : 0.7);
    const tilt = this.clamp(direction.x * (isMoving ? 9 : 4), -10, 10);

    if (shell) {
      shell.style.transform = `translate3d(0, ${bob.toFixed(2)}px, 0) rotate(${tilt.toFixed(2)}deg)`;
    }

    legs.forEach((leg, index) => {
      const offset = isMoving ? Math.sin(phase * 2 * cadence + index * Math.PI) * 4 : Math.sin(phase * 0.8 + index) * 1.5;
      leg.style.transform = `translate3d(${offset.toFixed(2)}px, 0, 0)`;
    });

    if (root) {
      const facing = direction.x >= 0 ? 1 : -1;
      const depth = this.clamp(12 + (speedRatio || 0) * 8, 10, 20);
      const rotateY = this.clamp(facing * (10 + (speedRatio || 0) * 6), -18, 18);
      root.style.setProperty('--cb-rotate-y', `${rotateY.toFixed(2)}deg`);
      root.style.setProperty('--cb-depth', `${depth.toFixed(2)}px`);

      const antenna = root.querySelector('.bot-antenna');
      if (antenna) {
        const swing = Math.sin(phase * 0.9 * cadence) * (isMoving ? 8 : 3);
        antenna.style.transform = `translateX(-50%) rotate(${swing.toFixed(2)}deg)`;
      }
      root.style.setProperty('--pet-walk-speed', String(cadence.toFixed(3)));
    }
  }

  static applyPixelPet(context) {
    const {
      segments,
      legs,
      root,
      profile,
      phase,
      isMoving,
      speedRatio,
      direction
    } = context;

    const body = segments[0] || null;
    const cadence = 0.88 + (speedRatio || 0) * 0.6;
    const stepPhase = Math.sin(phase * (isMoving ? 1.7 * cadence : 0.7));
    const bounce = this.quantize(stepPhase * (isMoving ? 3 : 1), 1);

    if (body) {
      const shiftX = this.quantize(direction.x * (isMoving ? 1 : 0), 1);
      body.style.transform = `translate3d(${shiftX}px, ${bounce}px, 0)`;
    }

    legs.forEach((leg, index) => {
      const legPhase = index % 2 === 0 ? stepPhase : -stepPhase;
      const lift = this.quantize(Math.max(0, legPhase) * (isMoving ? 2 : 1), 1);
      leg.style.transform = `translate3d(0, ${lift}px, 0)`;
    });

    if (root) {
      const facing = direction.x >= 0 ? 1 : -1;
      const depth = this.clamp(9 + (speedRatio || 0) * 7, 8, 16);
      const rotateY = this.clamp(facing * (8 + (speedRatio || 0) * 5), -14, 14);
      root.style.setProperty('--pp-rotate-y', `${rotateY.toFixed(2)}deg`);
      root.style.setProperty('--pp-depth', `${depth.toFixed(2)}px`);

      const ears = root.querySelectorAll('.pixel-ear');
      ears.forEach((ear, index) => {
        const sign = index === 0 ? -1 : 1;
        const angle = this.quantize(Math.sin(phase * 0.8 + index) * sign * (isMoving ? 6 : 3), 1);
        ear.style.transform = `rotate(${angle}deg)`;
      });
      root.style.setProperty('--pet-walk-speed', String(cadence.toFixed(3)));
    }
  }
}
