# Runtime3D Native Artifacts

This directory defines release-native runtime payloads for `Qt sidecar + Godot runtime`.

Current repository bundles shim executables for:

- `darwin-arm64`
- `darwin-x64`

Production rollout expectation:

1. Replace shim executables with real native binaries built from Qt6 and Godot.
2. Keep binary names stable:
   - `qt-sidecar`
   - `godot-runtime`
3. Update `runtime/native/manifest.json` version and platform entries.

Healthcheck command required for each binary:

```bash
./qt-sidecar --healthcheck
./godot-runtime --healthcheck
```
