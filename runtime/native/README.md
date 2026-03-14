# Runtime3D Native Artifacts

This directory defines release-native runtime payloads for `Qt sidecar + Godot runtime`.

Current repository bundles native binaries (Go implementation of runtime contract) for:

- `darwin-arm64`
- `darwin-x64`

Build source:

- `runtime/native-src/cmd/qt-sidecar`
- `runtime/native-src/cmd/godot-runtime`

Build command:

```bash
npm run build:runtime3d:native-binaries
```

Runtime contract:

1. Keep binary names stable:
   - `qt-sidecar`
   - `godot-runtime`
2. Update `runtime/native/manifest.json` version and platform entries when adding platforms.

Healthcheck command required for each binary:

```bash
./qt-sidecar --healthcheck
./godot-runtime --healthcheck
```
