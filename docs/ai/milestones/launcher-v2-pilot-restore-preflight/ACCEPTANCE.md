# Launcher V2 Pilot — Restore preflight acceptance

Milestone: launcher-v2-pilot-restore-preflight
Revision: 1

## Machine criteria

| ID | Required evidence |
|---|---|
| RP-A1 | A synthetic direct Restore with space below the largest pending temporary copy on either destination root rejects with the specific shortfall error. All target files, backup files and authenticated journal bytes match their intake hashes. A probe failure on a required destination also stops before those writes. |
| RP-A2 | With sufficient injected space, Restore returns exact original fixture bytes and reaches `restored`. Already-restored entries and deletion-only entries add no copy requirement. An installation-only copy does not query the configuration root. |
| RP-A3 | After a synthetic interruption leaves a `restoring` journal, a shortfall on a pending destination preserves the current partially restored files and journal. With enough space restored, the normal recovery entry point resumes and verifies exact originals. Existing conflict, backup-integrity and Apply tests pass. |
| RP-A4 | Gates A–D have command receipts or independent review evidence. The original Launcher checkout has unchanged HEAD, index and working-file fingerprints. Workflow state and Context Manager record the scoped Launcher commit and fixture-only outcome. |

## Owner checks

Review the proposed revision before approval and review fixture evidence after execution. A live Restore, native compatibility, Play/join/reconnect and release approval belong to separately authorized work.

## Definition of Done

RP-A1 through RP-A4 have verified evidence, the implementation diff stays within scope and the checkpoint validates. Record an unresolved blocker as such. Record successful automation as fixture evidence in the existing Acceptance Matrix.

## Rollback

Revert the scoped Launcher code commit on the approved implementation branch if required. Keep old commits, fixture evidence and checkpoint history. Preserve authenticated journal format and stored preimages so the previous build can use the same recovery path. If test recovery fails, stop with evidence and contain it to the synthetic worktree and fixtures.
