const START_WALK_MS = 240;
const TURN_MS = 220;
const STOP_MS = 180;

export class AnimationStateMachine {
  constructor() {
    this.locomotion = 'idle';
    this.emotion = 'neutral';
    this.interaction = null;
    this.phaseMs = 0;
  }

  setEmotion(emotion) {
    this.emotion = emotion || 'neutral';
  }

  triggerInteraction(interaction) {
    this.interaction = interaction || null;
  }

  update({ moving, turning, speedNorm, deltaMs }) {
    this.phaseMs += deltaMs;

    if (!moving) {
      if (this.locomotion === 'walk') {
        this.locomotion = 'stop';
        this.phaseMs = 0;
      } else if (this.locomotion === 'stop' && this.phaseMs >= STOP_MS) {
        this.locomotion = 'idle';
        this.phaseMs = 0;
      } else if (this.locomotion !== 'stop' && this.locomotion !== 'idle') {
        this.locomotion = 'idle';
        this.phaseMs = 0;
      }
    } else if (this.locomotion === 'idle') {
      this.locomotion = 'start_walk';
      this.phaseMs = 0;
    } else if (this.locomotion === 'start_walk' && this.phaseMs >= START_WALK_MS) {
      this.locomotion = 'walk';
      this.phaseMs = 0;
    }

    if (turning && this.locomotion === 'walk') {
      this.locomotion = 'turn';
      this.phaseMs = 0;
    }

    if (this.locomotion === 'turn' && this.phaseMs >= TURN_MS) {
      this.locomotion = moving ? 'walk' : 'stop';
      this.phaseMs = 0;
    }

    const footCompression = Math.min(1, Math.max(0, speedNorm));
    const bodyTilt = turning ? 0.22 : 0.08 * speedNorm;

    return {
      locomotion: this.locomotion,
      emotion: this.emotion,
      interaction: this.interaction,
      bodyTilt,
      footCompression
    };
  }
}
