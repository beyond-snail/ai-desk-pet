# Runtime IPC Contract

This directory stores the cross-process contract between Godot runtime and Qt sidecar.

## Versioning

- `schema-v1.json` is the initial protocol baseline.
- Any future change must be additive or version-bumped.

## Bootstrap modules

- `protocol.mjs`: message creation, encoding and schema validation helpers
- `line-codec.mjs`: newline-delimited message framing

## Smoke test

```bash
node scripts/runtime3d-ipc-smoke.mjs
```

This script boots sidecar + godot stubs and verifies bidirectional handshake stability.
