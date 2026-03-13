function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

function normalizeAngle(angle) {
  let result = angle;
  while (result > Math.PI) {
    result -= Math.PI * 2;
  }
  while (result < -Math.PI) {
    result += Math.PI * 2;
  }
  return result;
}

export class RoamingController {
  constructor(options = {}) {
    this.width = options.width || 1440;
    this.height = options.height || 900;
    this.margin = options.margin || 60;
    this.offscreenDistance = options.offscreenDistance || 160;
    this.offscreenProbability = options.offscreenProbability ?? 0.35;
    this.minSpeed = options.minSpeed || 40;
    this.maxSpeed = options.maxSpeed || 220;
    this.acceleration = options.acceleration || 420;
    this.deceleration = options.deceleration || 540;
    this.turnSpeed = options.turnSpeed || 4.2;
    this.random = options.random || Math.random;

    this.position = {
      x: options.startX || this.width * 0.5,
      y: options.startY || this.height * 0.55
    };
    this.velocity = { x: 0, y: 0 };
    this.direction = 0;
    this.speed = 0;
    this.state = 'idle';
    this.target = null;
    this.offscreenWaitMs = 0;
  }

  pickInsideTarget() {
    return {
      x: this.margin + this.random() * (this.width - this.margin * 2),
      y: this.margin + this.random() * (this.height - this.margin * 2),
      kind: 'inside'
    };
  }

  pickOffscreenTarget() {
    const side = Math.floor(this.random() * 4);
    if (side === 0) {
      return {
        x: -this.offscreenDistance,
        y: this.margin + this.random() * (this.height - this.margin * 2),
        kind: 'offscreen'
      };
    }
    if (side === 1) {
      return {
        x: this.width + this.offscreenDistance,
        y: this.margin + this.random() * (this.height - this.margin * 2),
        kind: 'offscreen'
      };
    }
    if (side === 2) {
      return {
        x: this.margin + this.random() * (this.width - this.margin * 2),
        y: -this.offscreenDistance,
        kind: 'offscreen'
      };
    }
    return {
      x: this.margin + this.random() * (this.width - this.margin * 2),
      y: this.height + this.offscreenDistance,
      kind: 'offscreen'
    };
  }

  ensureTarget() {
    if (this.target) {
      return;
    }
    this.target = this.random() < this.offscreenProbability ? this.pickOffscreenTarget() : this.pickInsideTarget();
    this.state = 'moving';
  }

  update(deltaMs) {
    if (this.state === 'offscreen_wait') {
      this.offscreenWaitMs -= deltaMs;
      if (this.offscreenWaitMs <= 0) {
        this.target = this.pickInsideTarget();
        this.state = 'returning';
      }
      return this.snapshot(0, false);
    }

    this.ensureTarget();
    const toTarget = {
      x: this.target.x - this.position.x,
      y: this.target.y - this.position.y
    };
    const dist = Math.hypot(toTarget.x, toTarget.y);
    const targetDir = Math.atan2(toTarget.y, toTarget.x);
    const angleDelta = normalizeAngle(targetDir - this.direction);
    const turning = Math.abs(angleDelta) > 0.25;
    const turningStep = this.turnSpeed * (deltaMs / 1000);
    this.direction += clamp(angleDelta, -turningStep, turningStep);

    const brakingDistance = Math.max(10, (this.speed * this.speed) / (2 * this.deceleration));
    const shouldBrake = dist < brakingDistance + 20;
    if (shouldBrake) {
      this.speed = Math.max(0, this.speed - this.deceleration * (deltaMs / 1000));
    } else {
      this.speed = Math.min(this.maxSpeed, this.speed + this.acceleration * (deltaMs / 1000));
    }

    const targetSpeed = clamp(this.speed, this.minSpeed, this.maxSpeed);
    this.velocity.x = Math.cos(this.direction) * targetSpeed;
    this.velocity.y = Math.sin(this.direction) * targetSpeed;

    this.position.x += this.velocity.x * (deltaMs / 1000);
    this.position.y += this.velocity.y * (deltaMs / 1000);

    if (dist < 18) {
      if (this.target.kind === 'offscreen') {
        this.state = 'offscreen_wait';
        this.offscreenWaitMs = 900 + this.random() * 1800;
      } else {
        this.state = 'idle';
      }
      this.target = null;
      this.speed = 0;
    }

    return this.snapshot(angleDelta, turning);
  }

  snapshot(angleDelta, turning) {
    return {
      position: { ...this.position },
      speed: this.speed,
      speedNorm: this.maxSpeed === 0 ? 0 : clamp(this.speed / this.maxSpeed, 0, 1),
      angleDelta,
      turning,
      state: this.state
    };
  }
}
