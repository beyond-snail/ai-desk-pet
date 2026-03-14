# Runtime3D Release-Native Switch (2026-03-14)

## Decision

Runtime3D has switched from `bootstrap default` to `release-native default`.

Default commands now target native runtime launch and native release packaging:

- `npm start` -> `scripts/start-runtime3d-release.mjs`
- `npm run build` -> `scripts/build-runtime3d-release.mjs`

Runtime gameplay path is now provided by native binaries in `runtime/native/*` (no Node gameplay runtime on the main execution path).

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

1. `dist/runtime3d-release/<platform-arch>/AIDeskPet-runtime3d-manifest-<platform-arch>.json`
2. `dist/runtime3d-release/<platform-arch>/AIDeskPet-runtime3d-performance-<platform-arch>.json`
3. `dist/runtime3d-release/<platform-arch>/AIDeskPet-runtime3d-<platform-arch>.dmg`
4. `/Volumes/AIDeskPet-runtime3d-<platform-arch>/AIDeskPet-runtime3d-launcher-<platform-arch>.sh`

## Notes

Current repository includes native runtime binaries generated from `runtime/native-src` and packaged in `runtime/native/*`.
For production launch, continue replacing them with platform-certified Qt6/Godot builds while preserving contract names.
