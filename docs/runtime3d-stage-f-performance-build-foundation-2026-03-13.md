# Runtime3D Stage F Performance & Build Foundation Report (2026-03-13)

## Scope

This report records Stage F foundation delivery:

- F1 performance smoke baseline
- F2 candidate package build pipeline

## Delivered

1. Performance smoke:
- `scripts/runtime3d-performance-smoke.mjs`
- simulation targets:
  - default robot motion loop
  - gameplay tick loop
- output metrics:
  - `elapsedMs`
  - `frameMs`
  - `simulatedFps`
  - `rssDeltaMb`

2. Candidate package pipeline:
- `scripts/package-runtime3d-candidate.mjs`
- `scripts/build-runtime3d-bootstrap.mjs` now produces:
  - `dist/runtime3d-bootstrap/manifest.json`
  - `dist/runtime3d-bootstrap/performance-report.json`
  - `dist/runtime3d-bootstrap/runtime3d-candidate-<platform>.tar.gz`

3. Check integration:
- `scripts/check-runtime3d.mjs` executes performance smoke

## Verification

- `npm run smoke:runtime3d:performance`: pass
- `npm run build`: pass (candidate archive generated)
- `npm run check`: pass

## Known limits

1. Performance smoke is synthetic simulation, not native Godot binary profiling.
2. Candidate archive is a bootstrap candidate, not final installer package.
3. Native packaging and signing remain for full Stage F2 completion.
