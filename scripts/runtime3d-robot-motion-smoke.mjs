import { DefaultRobotController } from '../runtime/godot/default-robot-controller.mjs';

function createSeededRandom(seed = 12345) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

const random = createSeededRandom(20260313);
const controller = new DefaultRobotController({
  width: 1280,
  height: 820,
  offscreenProbability: 0.5,
  random
});

const observedLocomotion = new Set();
let hasOffscreenWait = false;
let hasReturning = false;
let hasTilt = false;

for (let tick = 0; tick < 2800; tick += 1) {
  if (tick % 800 === 0) {
    controller.triggerInteraction('listen');
  }
  if (tick % 600 === 0) {
    controller.setEmotion(tick % 1200 === 0 ? 'happy' : 'focused');
  }

  const frame = controller.update(16);
  observedLocomotion.add(frame.locomotion);

  if (frame.movement.state === 'offscreen_wait') {
    hasOffscreenWait = true;
  }
  if (frame.movement.state === 'returning') {
    hasReturning = true;
  }
  if (frame.bodyTilt > 0.12) {
    hasTilt = true;
  }
}

const requiredLocomotion = ['idle', 'start_walk', 'walk', 'turn', 'stop'];
const missingLocomotion = requiredLocomotion.filter((state) => !observedLocomotion.has(state));

if (missingLocomotion.length > 0) {
  console.error(`missing locomotion states: ${missingLocomotion.join(',')}`);
  process.exit(1);
}

if (!hasOffscreenWait || !hasReturning) {
  console.error('offscreen/returning cycle was not observed');
  process.exit(1);
}

if (!hasTilt) {
  console.error('turning body tilt was not observed');
  process.exit(1);
}

const snapshot = controller.snapshot();
console.log('runtime3d robot motion smoke ok');
console.log(
  JSON.stringify(
    {
      locomotion: Array.from(observedLocomotion).sort(),
      eventCount: snapshot.eventCount
    },
    null,
    2
  )
);
