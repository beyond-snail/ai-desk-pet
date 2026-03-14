# Runtime3D Release-Native Switch (2026-03-14)

## Decision

Runtime3D has switched from `bootstrap default` to `release-native default`.

Default commands now target native runtime launch and native release packaging:

- `npm start` -> `scripts/start-runtime3d-release.mjs`
- `npm run build` -> `scripts/build-runtime3d-release.mjs`

## Native artifact contract

Native artifact manifest is defined at:

- `runtime/native/manifest.json`

Current platform payloads:

- `runtime/native/darwin-arm64/*`
- `runtime/native/darwin-x64/*`

Each platform must expose:

1. `qt-sidecar`
2. `godot-runtime`

and support:

- `--healthcheck`

## Release gate

Release gate now requires:

1. `npm run check`
2. `npm run check:runtime3d:native`
3. `npm run build:runtime3d:release`

Output artifacts:

1. `dist/runtime3d-release/release-manifest.json`
2. `dist/runtime3d-release/performance-report.json`
3. `dist/runtime3d-release/AIDeskPet-runtime3d-<platform-arch>.tar.gz`

## Notes

Current repository includes shim executables for native contract validation.
For production launch, replace shim binaries with real Qt6/Godot native binaries while preserving contract names.
