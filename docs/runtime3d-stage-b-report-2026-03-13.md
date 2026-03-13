# Runtime3D Stage B Report (2026-03-13)

## Scope

This report records Stage B bootstrap completion for:

- B1: runtime executable entrypoints
- B2: Qt <-> Godot IPC bridge handshake

## Delivered

1. Runtime entrypoints:
- `runtime/godot/main.mjs`
- `runtime/qt-sidecar/main.mjs`

2. State controller stubs:
- `runtime/godot/window-controller.mjs`
- `runtime/qt-sidecar/system-controller.mjs`

3. Shared IPC helpers:
- `runtime/shared-ipc/protocol.mjs`
- `runtime/shared-ipc/line-codec.mjs`

4. IPC smoke pipeline:
- `scripts/runtime3d-ipc-smoke.mjs`
- integrated into `scripts/check-runtime3d.mjs`

## Handshake sequence (v1 smoke)

1. `godot -> qt-sidecar`: `app.show`
2. `qt-sidecar -> godot`: `settings.get`
3. `godot -> qt-sidecar`: `settings.set`
4. `qt-sidecar -> godot`: `pet.action`
5. `godot -> qt-sidecar`: `pet.voice_wakeup`
6. `qt-sidecar -> godot`: `app.hide`
7. `godot -> qt-sidecar`: `app.quit`

All messages are validated against:
- required fields: `request_id`, `schema_version`, `timestamp`, `source`, `target`
- event list in `runtime/shared-ipc/schema-v1.json`

## Verification

- `npm run check`: pass
- `npm start`: pass
- `npm run build`: pass

## Gaps / next

1. Current Godot/Qt implementations are Node stubs, not native runtime binaries yet.
2. Stage C should replace movement/animation placeholders with 3D robot controller.
3. Stage D should attach chat, menu and voice flows onto the same IPC contract.
