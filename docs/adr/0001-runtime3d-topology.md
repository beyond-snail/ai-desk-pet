# ADR 0001: Runtime 3D Topology

- Status: Accepted
- Date: 2026-03-13

## Context

Current runtime is Electron-based and shows higher package size and runtime overhead than expected for long-lived desktop pet usage.

## Decision

Adopt `Godot main runtime + Qt sidecar` topology.

- Godot handles rendering, animation, roaming, and in-runtime gameplay interactions.
- Qt sidecar handles tray, global shortcuts, autostart, and native system integration.
- Cross-process communication is done via local IPC and versioned JSON protocol.

## Consequences

- Better path to lower package size and power usage than current Electron runtime.
- Added complexity of process orchestration and IPC contract governance.
- Requires migration compatibility layer for legacy user data.
