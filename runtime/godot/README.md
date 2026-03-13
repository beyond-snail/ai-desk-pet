# Godot Runtime (Bootstrap)

This directory is reserved for the new 3D runtime implementation.

## Scope

- Transparent floating pet window rendering
- 3D character animation state machine
- Roaming and off-screen return behaviors
- In-runtime interaction UI and gameplay logic

## Current stage

Stage B bootstrap implemented with executable Node entrypoint:

- `main.mjs`: Godot runtime process stub
- `window-controller.mjs`: window visibility + click-through region state model

Stage C motion foundation:

- `animation-state-machine.mjs`: locomotion state transitions
- `roaming-controller.mjs`: acceleration/turning/offscreen-return path logic
- `default-robot-controller.mjs`: robot movement + animation composition

Stage D interaction foundation:

- `interaction-controller.mjs`: click/double-click/drag and quick action semantics
- `main.mjs`: end-to-end interaction smoke orchestration (chat + voice + tts path)

## Local run

```bash
node runtime/godot/main.mjs
```

This process expects Qt sidecar bootstrap server on `127.0.0.1:47831` by default.

Motion logic smoke:

```bash
node scripts/runtime3d-robot-motion-smoke.mjs
```
