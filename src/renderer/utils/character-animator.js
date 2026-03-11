class CharacterAnimator {
  static quantize(value, step = 2) {
    return Math.round(value / step) * step;
  }

  static clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
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
      speedRatio
    } = context;

    const body = segments[0] || null;

    if (body) {
      body.style.transform = '';
    }

    if (!root) {
      return;
    }

    const currentAnimation = root.dataset.animation || '';
    if (isMoving) {
      if (!currentAnimation || currentAnimation === 'walk') {
        root.dataset.animation = 'walk';
      }
      root.style.setProperty('--pet-walk-speed', String((0.78 + (speedRatio || 0) * 0.44).toFixed(3)));
    } else if (currentAnimation === 'walk') {
      delete root.dataset.animation;
    }
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
