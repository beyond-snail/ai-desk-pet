# Runtime3D Stage C Motion Foundation Report (2026-03-13)

## Scope

This report captures the Stage C logic foundation for the default robot:

- locomotion state machine
- natural movement curve
- offscreen roaming and edge return

## Delivered

1. Animation state machine:
- `runtime/godot/animation-state-machine.mjs`
- states: `idle`, `start_walk`, `walk`, `turn`, `stop`

2. Roaming controller:
- `runtime/godot/roaming-controller.mjs`
- acceleration/deceleration speed curve
- turn damping with angle normalization
- offscreen target selection and wait-then-return strategy

3. Robot composition controller:
- `runtime/godot/default-robot-controller.mjs`
- combines movement + animation output
- exposes motion snapshot for renderer integration

4. Motion smoke test:
- `scripts/runtime3d-robot-motion-smoke.mjs`
- integrated into `scripts/check-runtime3d.mjs`

## Validation rules

Motion smoke requires:

1. locomotion states all observed:
- `idle`, `start_walk`, `walk`, `turn`, `stop`
2. offscreen cycle observed:
- `offscreen_wait` and `returning`
3. turning body tilt observed:
- `bodyTilt > 0.12`

## Verification

- `npm run smoke:runtime3d:motion`: pass
- `npm run check`: pass

## Known limits

1. Current implementation is runtime logic only; no real 3D mesh/animation clips yet.
2. Movement output is not yet bound to Godot AnimationTree/StateMachine.
3. Visual polish (foot IK, blend transitions, root motion) remains in Stage C renderer work.
