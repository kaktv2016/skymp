# Launcher V2 Pilot — Restore preflight execution plan

Milestone: launcher-v2-pilot-restore-preflight
Revision: 1

## Strategy

Load the approved handoff from SkyMP and resume or initialize the matching Context Manager checkpoint. Confirm the original Launcher checkout's preservation snapshot and do all implementation in an isolated clean Launcher worktree. Add synthetic regression coverage first, then modify the existing restore transaction. Keep the approval, runtime evidence and fixture evidence distinct.

## Tasks

1. Verify Gate A and the exact Launcher pin. Read `RuntimeTransaction.restore`, `recover`, `finish` and `replace`, along with the fixture helpers in `tests/runtime-preparation.test.ts`. Trace the direct user path through `RuntimePreparation.restore`.
2. Extend the existing fixture with a committed runtime state and two destinations, installation and configuration. Use the existing `freeBytes` injection to model a shortfall on one root and sufficient space on the other. Assert the targeted error and equality of the authenticated journal and target file fingerprints before and after. Confirm the regression fails on the baseline for the expected reason. Reuse checkpoint interruption injection to cover an existing `restoring` journal and successful retry.
3. Add the check to the shared restoring path under the existing lease, before it writes journal state or touches targets. Derive the destination root using the same installation/configuration routing as `replace`. Use journal image sizes and current image comparisons to omit already-restored and deletion-only entries. Retain the existing replacement and integrity checks. Verify enough space proceeds to exact Restore and the service still reports the error through its existing path.
4. Run B/C and independent review. Record results and preservation fingerprints in existing workflow records, save the checkpoint and report fixture evidence and any blockers to the owner.

## Skills

Use `frostveil-feature` and `frostveil-context-manager` for workflow and checkpoints, plus test-driven development for the fixture regression. Use the project's review workflow before integration.

## Subagent assignments

Main owns Git and checkpoint state, task allocation, integration and the owner handoff. If delegated, Engineer owns only the two scoped Launcher files. QA and Reviewer are read-only and check fixture coverage and the shared restore/retry path after the diff exists. Use the documented generic fallback if named dispatch is unavailable. Children do not approve, push or deploy.

## Quality gates

- A. Verify handoff and dependency, isolated Launcher branch, locked dependency install, and evidence snapshot of the owner's Launcher checkout.
- B. Run `npm.cmd run typecheck` and `npm.cmd run build` in the isolated Launcher checkout. Run `git diff --check` on the change.
- C. Run `npm.cmd test` in the isolated Launcher checkout. Retain the focused baseline-failure and final passing receipts, full suite exit status and any fixture blockers. The existing test runner builds `.test-build/runtime-preparation.test.cjs`, which can be rerun with `node --test .test-build/runtime-preparation.test.cjs`.
- D. Review space calculation, path routing, state preservation, retry and absence of new write permissions. Compare the original Launcher checkout fingerprint to intake.
- E/F/G. Native, deployment and gameplay checks are outside the approved fixture scope.
