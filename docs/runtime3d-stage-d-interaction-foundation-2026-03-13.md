# Runtime3D Stage D Interaction Foundation Report (2026-03-13)

## Scope

This report records Stage D minimal interaction loop delivery:

- D1 quick actions and gesture semantics
- D2 minimal chat request/stream/done chain
- D3 local-first voice start/stop and TTS chain

## Delivered

1. Godot interaction model:
- `runtime/godot/interaction-controller.mjs`
- supports:
  - single-click -> quick menu open
  - quick menu actions -> `chat/feed/pet/clean`
  - double-click -> `celebrate`
  - drag-drop -> `drop`

2. Sidecar chat and voice stubs:
- `runtime/qt-sidecar/chat-service.mjs`
- `runtime/qt-sidecar/voice-service.mjs`

3. End-to-end event chain integrated into runtime processes:
- `runtime/godot/main.mjs`
- `runtime/qt-sidecar/main.mjs`

## Event chain (D smoke)

1. `godot -> qt-sidecar`: `pet.action` (`menu.open`, `chat`, `feed`, `pet`, `clean`)
2. `godot -> qt-sidecar`: `chat.request`
3. `qt-sidecar -> godot`: `chat.stream_chunk` (multi chunk)
4. `qt-sidecar -> godot`: `chat.done` (or `chat.error` fallback)
5. `godot -> qt-sidecar`: `speech.listen.start`
6. `qt-sidecar -> godot`: `speech.listen.stop`
7. `qt-sidecar -> godot`: `pet.voice_wakeup`
8. `godot -> qt-sidecar`: `pet.action` (`celebrate`, `drop`)
9. `godot -> qt-sidecar`: `speech.tts.speak`
10. `qt-sidecar -> godot`: `app.hide`
11. `godot -> qt-sidecar`: `app.quit`

## Acceptance checks in code

Sidecar validates before marking handshake success:

- all required actions observed: `chat/feed/pet/clean/celebrate/drop`
- chat done
- voice stop sent
- wakeup sent
- tts spoken
- app.hide sent

If any check is missing, process exits non-zero.

## Verification

- `npm run smoke:runtime3d:ipc`: pass
- `npm run check`: pass
- `npm start`: pass

## Known limits

1. Current interaction loop is simulation-grade and runs in Node stubs.
2. Real UI event binding and Godot scene-level interaction are still pending.
3. Chat provider and voice engine are local mock implementations in this stage.
