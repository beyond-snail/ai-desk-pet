# Runtime 3D Migration Baseline Report (2026-03-13)

## 1. Purpose

This baseline captures current package and runtime indicators before migrating from Electron runtime to Runtime3D architecture.

## 2. Package Size Snapshot

Observed on local macOS build artifacts:

- `dist/`: 386 MB
- `dist/AIDeskPet-1.0.0-x64.dmg`: 108 MB
- `dist/mac/AIDeskPet.app/Contents`: 274 MB
- `dist/mac/AIDeskPet.app/Contents/Frameworks`: 262 MB
- `Electron Framework`: 176 MB (`.../Electron Framework.framework/Versions/A/Electron Framework`)
- `app.asar`: 11 MB

Conclusion:

- Current package size is dominated by Electron framework runtime, not business assets.

## 3. Runtime Indicator Snapshot

From existing QA smoke report (`docs/qa-report-2026-03-11.md`):

- Short-run sample (about 12s -> 17s):
  - CPU: ~1.2% -> 1.1%
  - RSS: ~103,516 KB -> 103,488 KB
- Long-run user feedback indicates visible fan activity under sustained usage.

Conclusion:

- Short smoke usage is stable.
- Long-lived thermal/noise optimization is still required.

## 4. Migration KPI Targets (macOS first)

- package <= 140 MB (phase target)
- idle CPU <= 6%
- normal interaction CPU <= 12%
- memory <= 160 MB
- 30-minute memory growth <= 60 MB

## 5. Notes

This report is baseline-only and should be updated after each major Runtime3D milestone.
