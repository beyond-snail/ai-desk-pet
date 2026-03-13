# Runtime 3D Data Migration

This directory stores migration assets from legacy Electron runtime state into runtime3d state.

## Rules

- Migration must be idempotent.
- Legacy data remains readable for one-way import and repair only.
- Snapshot must be created before migration writes.
