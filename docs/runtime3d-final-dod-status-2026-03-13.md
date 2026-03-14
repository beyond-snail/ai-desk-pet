# Runtime3D Final DoD Status (2026-03-13)

## Summary

Runtime3D migration tasks A-G are completed at bootstrap-foundation level on branch:

- `feat/3d-runtime-switch-a-bootstrap`

This status means:

1. Mainline hard-cutover is completed.
2. All stage acceptance checks are represented by executable smoke checks.
3. Build pipeline produces a runtime3d candidate archive artifact.

Update:
- On 2026-03-14, default command path switched to release-native mode.
- See `docs/runtime3d-release-native-switch-2026-03-14.md`.

## Stage checklist

1. A: repo skeleton + ADR + baseline: done
2. B: executable entrypoints + IPC v1 bridge: done
3. C: default robot motion logic foundation: done
4. D: interaction/chat/voice minimum loop: done
5. E: migration engine + snapshot + idempotency smoke: done
6. F: performance smoke + candidate build packaging: done
7. G: gameplay/persistence backfill foundation: done

## Final DoD verification commands

```bash
npm run check
npm start
npm run build
```

Expected artifacts:

1. `dist/runtime3d-release/<platform-arch>/AIDeskPet-runtime3d-manifest-<platform-arch>.json`
2. `dist/runtime3d-release/<platform-arch>/AIDeskPet-runtime3d-performance-<platform-arch>.json`
3. `dist/runtime3d-release/<platform-arch>/AIDeskPet-runtime3d-<platform-arch>.dmg`
4. `dist/runtime3d-release/<platform-arch>/AIDeskPet-runtime3d-<platform-arch>.pkg`
5. `/Volumes/AIDeskPet-runtime3d-<platform-arch>/AIDeskPet.app`
6. `/Volumes/AIDeskPet-runtime3d-<platform-arch>/Applications`

## Remaining work category

Bootstrap foundation is complete, but native-runtime productionization is still required:

1. Replace Node stubs with native Godot runtime + Qt sidecar binaries.
2. Bind logic controllers to real Godot scenes/AnimationTree/UI.
3. Replace local mock chat/voice with production providers.
