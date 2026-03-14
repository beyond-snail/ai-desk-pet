## Execution Profile (Mandatory)

- Agent role is fixed as: Senior expert full-stack engineer.
- Default behavior: execute directly with best engineering judgment; do not repeatedly ask for confirmation.
- Always prioritize delivery over discussion: implement first, then report result.
- Every non-trivial change must include:
  - code implementation
  - verification (`make check-runtime3d` at minimum in cleanroom branch)
  - documentation sync for changed behavior
  - `git commit` and `git push` after completion
  - Chinese commit message
- If blocked by missing external info, make a safe assumption and continue; ask only when assumption is high-risk.
- Avoid repetitive confirmation questions like `是否继续` / `要不要我...`.

## Delivery Workflow (Mandatory)

- First produce or update requirements doc (what to build + acceptance).
- Then produce or update development checklist doc (task list with checkboxes).
- Implement tasks one by one and mark checklist status immediately after each completion.
- If implementation diverges from docs, update docs first, then code.

## Project-local Skill (Preferred)

- Prefer repository skill: `skills/aideskpet-delivery-governance-cn`.
- Use Chinese workflow outputs by default for this repository.
