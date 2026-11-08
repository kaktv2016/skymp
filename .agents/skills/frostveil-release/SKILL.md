---
name: frostveil-release
description: Verify and hand off a Frostveil isolated development deployment or an explicitly authorized signed client release.
---

# Frostveil release

**Inputs**

Clean integrated commit(s), approved environment and scope, Gate C receipts, trusted seals, backup and rollback procedure.

1. Read `docs/ai/DEVELOPMENT_SOP.md` and `FROSTVEIL_SERVER_START.md`. Select the matching reviewed runbook. For G244 inspect `rp-gamemode/research/g244/deployment.cjs`, `start-verified.mjs` and `verify-deployed.cjs`. For G246 use its onboarding report. For clients read the sibling Launcher's production gate and signing scripts.
2. Use `scripts/ai/verify-delivery.ps1` for each applicable regression and sealed artifact. Verify provenance/signatures through the runbook. Check actual target path, loopback binds, owned PID, active sessions, current identities and rollback before deployment.
3. Deploy only within the authorized verified scope. Capture startup and health evidence. On failure restore the paired known-good code/config and verify health, preserving all durable data.
4. Prepare the consolidated handoff with exactly what to launch, checklist, expected results, known limits and recovery.

**Outputs and blockers**

Scoped delivery and health receipts or blocker. Failed integrity, unknown target, missing backup, or absent release authorization stops delivery.
