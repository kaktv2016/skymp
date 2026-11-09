# Documentation-only handoff smoke acceptance

Milestone: handoff-docs-smoke
Revision: 1

## Machine criteria

- `DOCS-HANDOFF-RECEIVE` — A fresh session reads the committed pointer and returns the exact ID, revision, Git pin and first task without receiving the document contents in the owner prompt.
- A changed or unapproved specification fails validation, and a matching checkpoint resumes without reinitializing completed work.

## Owner checks

No in-game or manual acceptance applies to the isolated documentation example.

## Definition of Done

Record the fresh session result, preserve the approved Git revision, and validate the matching closeout checkpoint.

## Rollback

If the smoke fails, leave the reviewed documents in Git. Revert or defer the active pointer through a scoped commit and record the failure. No runtime restoration is required.
