# Qt Sidecar (Bootstrap)

This directory is reserved for the system integration sidecar process.

## Scope

- Tray menu
- Global shortcuts
- Auto-launch settings
- Native notifications
- Platform-specific integration adapters

## Current stage

Stage B bootstrap implemented with executable Node entrypoint:

- `main.mjs`: sidecar process stub + IPC server
- `system-controller.mjs`: tray/hotkey/window state model

Stage D interaction foundation:

- `chat-service.mjs`: minimal chat streaming service stub
- `voice-service.mjs`: minimal local voice listen/tts service stub

Stage G2 persistence foundation:

- `persistence-store.mjs`: local settings/chat/memory/pets persistence store

## Local run

```bash
node runtime/qt-sidecar/main.mjs
```

This process listens on `127.0.0.1:47831` by default and accepts Godot bootstrap client.
