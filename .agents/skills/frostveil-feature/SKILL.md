---
name: frostveil-feature
description: Plan and carry a Frostveil feature or engineering milestone from one owner goal through integration and a consolidated handoff.
---

# Frostveil feature

**Inputs**

Owner goal, intended repository and environment, known constraints.

1. Read `docs/ai/PROJECT_STATE.md`, `docs/ai/DEVELOPMENT_SOP.md`, and the relevant current source and dated reports.
2. Run `scripts/ai/preflight.ps1` and verify the runtime baseline when needed. Record scope, exclusions, dependencies, risks, preserved systems, machine and owner criteria, rollback, and Done.
3. Assign bounded tasks with disjoint writes. Run the three-repair QA loop and applicable gates. Require an independent review of significant changes.
4. Integrate, record receipts and update the acceptance matrix and state. Use frostveil-release for an authorized isolated deploy.

**Outputs and blockers**

Milestone plan, integrated diff and evidence, one owner handoff. Stop or mark blocked when authorization, dependencies, source identity, or validation needed for the goal is missing.
