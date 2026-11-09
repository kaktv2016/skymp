# Launcher V2 W00 — Acceptance

Milestone: launcher-v2-w00-baseline
Revision: 1

## Machine criteria

| ID | Required evidence |
|---|---|
| W00-A1 | Report contains full SkyMP and Launcher commit IDs, worktree status and release evidence references. It distinguishes the reported public build, existing WIP and any still-open NSIS or owner acceptance blocker. HEAD, staged and unstaged Launcher snapshots compare equal to intake. |
| W00-A2 | `STORAGE_INVENTORY.json` parses. Rows identify volume, path class, active/ownership/recovery status, logical size and allocated size or an explicit UNKNOWN reason. Per-volume confirmed reclaimable totals reconcile to eligible rows without double-counting hardlinks. Active, user-owned, recovery-dependent and unknown rows contribute no confirmed reclaimable bytes. |
| W00-A3 | The audit covers compatible warm, staged reuse, cold missing depots, session expiry and fallback with a source or receipt per supported claim. Released-GUI three-depot batching and alternative provider behavior have distinct statuses and the evidence needed to change them. |
| W00-A4 | Compatibility baseline names one proposed profile and gives each required pin a value with evidence or an unresolved blocker. It separates fixture scenarios from later owner Play/join/reconnect/Restore and lists unsupported profile scope. |
| W00-A5 | Dependency audit maps existing trust, downloader, updater, transaction, Restore and cleanup to reuse, harden or new. It distinguishes current release and expiry work from V2 and lists only decisions blocking the proposed pilot, with evidence or a named follow-up. |
| W00-A6 | Receipts contain actual commands, exit results, evidence references and claim labels. Review confirms scoped audit actions, private/redacted evidence handling and preservation of Launcher WIP. The checkpoint and acceptance matrix distinguish verified audit output from pending implementation or owner evidence. |

## Owner checks

Confirm the local roots that W00 may inventory if the scope is not already explicit. Review the proposed first profile and any owner decisions after the audit. No in-game acceptance applies to W00. The proposal does not select a production provider, authorize cleanup, or certify the pilot.

## Definition of Done

All six criteria have evidence or an explicit blocker. Keep a blocked criterion open. For a completed audit, record the proposed first profile, unresolved risks, review disposition and next decision in the existing project state and acceptance matrix. Validate the matching Context Manager closeout before handoff. This closes the baseline audit only.

## Rollback

W00 has no game, runtime, release or Launcher configuration mutation. If the audit produces incorrect documentation, correct it in a scoped SkyMP commit and keep its history. If a read crosses the approved scope or the preserved Launcher snapshot differs, stop and record the discrepancy. Keep existing journals, checkpoints and user files available. Any restoration outside audit-owned documentation requires a separate decision.
