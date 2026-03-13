# ADR 0002: IPC Versioning and Contract Rules

- Status: Accepted
- Date: 2026-03-13

## Context

Runtime behavior is split between Godot and Qt processes. Contract drift would cause unstable behavior and hard-to-debug production issues.

## Decision

Use versioned IPC schema with strict required fields.

- Current baseline: `runtime/shared-ipc/schema-v1.json`.
- Every message must include: `request_id`, `schema_version`, `timestamp`, `source`, `target`.
- Breaking changes require schema version bump.
- Additive fields/events are allowed in the same major schema only if backward compatible.

## Consequences

- Stable interop and safer incremental rollout.
- Additional implementation overhead for protocol checks and compatibility tests.
