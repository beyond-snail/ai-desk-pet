import { AnimationStateMachine } from './animation-state-machine.mjs';
import { RoamingController } from './roaming-controller.mjs';

export class DefaultRobotController {
  constructor(options = {}) {
    this.animation = new AnimationStateMachine();
    this.roaming = new RoamingController(options);
    this.lastFrame = null;
    this.eventCount = {
      offscreen: 0,
      returning: 0
    };
  }

  triggerInteraction(action) {
    this.animation.triggerInteraction(action);
  }

  setEmotion(emotion) {
    this.animation.setEmotion(emotion);
  }

  update(deltaMs) {
    const movement = this.roaming.update(deltaMs);
    if (movement.state === 'offscreen_wait') {
      this.eventCount.offscreen += 1;
    }
    if (movement.state === 'returning') {
      this.eventCount.returning += 1;
    }

    const moving = movement.speed > 1;
    const frame = this.animation.update({
      moving,
      turning: movement.turning,
      speedNorm: movement.speedNorm,
      deltaMs
    });

    this.lastFrame = {
      locomotion: frame.locomotion,
      emotion: frame.emotion,
      interaction: frame.interaction,
      bodyTilt: frame.bodyTilt,
      footCompression: frame.footCompression,
      movement
    };
    return this.lastFrame;
  }

  snapshot() {
    return {
      ...this.lastFrame,
      eventCount: { ...this.eventCount }
    };
  }
}
