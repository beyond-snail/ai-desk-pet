# ADR 0003: Legacy Data Migration Strategy

- Status: Accepted
- Date: 2026-03-13

## Context

The new runtime must preserve existing user progression and settings under a hard-cutover strategy without legacy runtime fallback.

## Decision

Use idempotent migration with snapshot-first policy.

- Read from legacy keys and map into `runtime3d.*` namespace.
- Keep legacy keys readable for one-way import and repair scripts.
- Create migration snapshot before writes.
- Migration operation must be safe to rerun.

## Consequences

- Safer cutover with recoverable data path.
- Slightly larger storage footprint during migration window.
