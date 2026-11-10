# Launcher V2 Pilot — Restore preflight

Milestone: launcher-v2-pilot-restore-preflight
Revision: 1

## Goals

Start the first Launcher V2 code increment by making Restore reject a known destination-space shortfall before it starts writing. Verify on synthetic fixtures for the single Windows x64 Steam Skyrim English 1.6.1170.0 pilot. This is a prerequisite for a later live Restore trial.

## Requirements

- R1. Reuse the authenticated journal, existing image comparisons, managed-root checks and recovery lease. In the common restoring path used by explicit Restore and resume of a `restoring` journal, check available bytes at each destination root with a pending replacement. Compare against the largest individual pending temporary copy at that root. Use the existing injectable `freeBytes` option and the existing filesystem free-space probe convention.
- R2. When a pending temporary copy exceeds current free bytes, or the needed destination measurement is unavailable, return a space-specific error before any Restore target or authenticated journal is changed by that attempt. Probe only roots that require a copy. Skip already-restored entries and deletion-only entries. Check current space without crediting future deletions or cleanup.
- R3. With enough space, use the existing restore and resume logic. Preserve existing conflict, running-process and backup-integrity checks. Keep the journal format and the Apply and modpack paths.

This is a preflight for individual scratch copies. Aggregate net growth, concurrent changes to disk space and other I/O failures remain subject to the existing transaction recovery path.

## Scope

Launcher `src/main/runtime/transaction.ts` and `tests/runtime-preparation.test.ts`. Read `src/main/runtime/service.ts` to verify how direct Restore reaches recovery and how it surfaces errors. SkyMP writes are limited to the existing workflow records and checkpoint for this milestone.

At the pinned baseline, Apply and the modpack snapshot have capacity checks. Restore calls `finish(j, true)`, which records `restoring` and replaces targets via temporary siblings. The missing check is before that transition and the first replacement, including retry from `recover()`.

## Exclusions

Live Skyrim or Steam operations, real Restore, release and deployment, new providers, signed metadata changes, changes to Apply budgets, and storage cleanup or migration. Keep the unresolved native/server and release pins in the [W00 compatibility baseline](../../../launcher-v2/w00/COMPATIBILITY_BASELINE.md) as separate release dependencies.

## Constraints

Run only on synthetic fixtures with injected capacity. Preserve the existing Launcher working copy, Steam installations, journals and backups. Do not fill a real disk to test the shortfall. The [W00 storage audit](../../../launcher-v2/w00/CURRENT_STATE_AUDIT.md#storage-and-restore) established zero confirmed reclaimable bytes for its surveyed scope. This milestone budgets no reclaimed space.

## Dependencies

- Launcher commit: 29641f25666cf492614374770f5ae1808b90ca2c
- Required tools: git, pwsh, node, npm.cmd

Verify a clean worktree at the exact Launcher pin for handoff. Use a dedicated writable branch and worktree for code. Use the repository lockfile and an approved dependency source for fixture tests. Obtain owner acceptance or deferral of W00 and approval of this specification revision before activating this milestone.
