# Frostveil Control and Milestone Execution

Use the SkyMP checkout as the workflow hub. [Roadmap](ROADMAP.md) lists candidate work. [Active milestone](ACTIVE_MILESTONE.md) routes an execution session to one approved revision. The three [example documents](milestones/handoff-docs-smoke/) show the contract. [Project state](PROJECT_STATE.md) retains progress and evidence links. [Acceptance matrix](ACCEPTANCE_MATRIX.md) records observed outcomes. The [development SOP](DEVELOPMENT_SOP.md) governs how work runs.

## Frostveil Control

1. The owner opens a chat at the SkyMP root and says **Frostveil Control. Prepare milestone <id> for <goal>.** Read the roadmap, project state and acceptance matrix. Prepare the three Markdown files under `docs/ai/milestones/<id>/`. Use a lowercase ID with digits and hyphens as needed. Put consecutive `Milestone: <id>` and `Revision: <number>` lines before the sections in every file. Start at revision 1 and increment all three files when revising. Keep the example headings, fill each with concrete content, and explicitly record inapplicable items.
2. Run the draft validation below. Review scope, exclusions, dependencies, gate coverage, task order, owner checks and rollback across the three documents. The validator checks required sections, ID/revision agreement and dependency declarations. Control checks whether the actual requirements, tasks and acceptance criteria agree.
3. Commit the specification files. Present that commit and revision for explicit owner approval if the owner has yet to approve them. After approval, run `Approve` below. Commit `ACTIVE_MILESTONE.md` separately. The two commits give the approval record a stable Git pin. Verify `Load` from the intended checkout. If the owner authorized sharing the handoff, publish those scoped commits through the existing SOP. Stop after handoff.
4. To change approved scope or criteria, prepare the next revision of all three files, retain the old commits, and repeat the approval process. Use ordinary commits. The script checks prior approvals in first-parent Git history and rejects revision reuse. Use a checkout with enough history to reach the approval record and pinned specification. Close or defer a different active milestone before switching the pointer.

```powershell
pwsh -NoProfile -File scripts/ai/milestone-handoff.ps1 -Action ValidateDraft -Milestone <id> -Revision <number>
pwsh -NoProfile -File scripts/ai/milestone-handoff.ps1 -Action Approve -Milestone <id> -Revision <number> -SpecificationCommit <full-commit>
```

The `Dependencies` section in `SPEC.md` includes exactly one `- Launcher commit: none` line or a full Launcher baseline commit, and exactly one `- Required tools: git, pwsh` line or a comma-space-separated list of tool names. Use `none` if there are no additional tools. The script checks tool availability without executing them. It checks the clean pinned Launcher baseline at approval and new execution, and verifies ancestry and checkpoint snapshots on resume. Use `-LauncherRoot <path>` for an alternate verified Launcher checkout. Record other prerequisites such as tool versions, fixtures, credentials or native readiness in prose and verify the applicable items in Gate A. Keep secrets out of the documents. Approval records intent and scope. Deployment and production authorization still follow the SOP.

## Milestone Execution

1. The owner opens a fresh chat at the same SkyMP checkout and says **Milestone Execution. Read ACTIVE_MILESTONE.md and start or resume its approved milestone.** Pull or switch to the owner-approved branch using the existing Git rules if the handoff is not present.
2. Run the loader below. It reads the tracked pointer and the approved Git objects. It checks committed approval, Git ancestry, working and staged file identity, structure, and declared dependencies. The result includes the approved revision, specification and approval commits, current HEAD, all three document bodies, and a checkpoint ID bound to the milestone, revision and specification commit.
3. For `INITIALIZE`, run Gate A, confirm remaining dependencies and permissions, and save the first boundary using the returned `checkpointId` as the Context Manager milestone ID. Then follow the approved plan and existing SOP. For an existing checkpoint, honor the disposition and continue only its pending work. For mismatched evidence, changed documents, Git drift, or missing in-progress checkpoints, reconcile the blocker. Keep prior checkpoints for history. If the pointer has no active approval or shows a closed/deferred milestone, report that state.
4. At a status handoff, retain the ID, revision and specification commit in the pointer and change only its status. Commit the status with the scoped state and acceptance updates before saving the final checkpoint against that HEAD. Keep evidence and completed task IDs in the existing Context Manager. The tracked milestone documents remain at their approved revision. Do not reinitialize an in-progress milestone when its checkpoint is missing. Approval pins identify approved content and rely on the owner review and Git trust established by the SOP.

```powershell
pwsh -NoProfile -File scripts/ai/milestone-handoff.ps1 -Action Load
```

Valid pointer statuses are `NONE`, `APPROVED`, `IN_PROGRESS`, `AUTO_VERIFIED`, `OWNER_PENDING`, `BLOCKED`, `DEFERRED`, and `ACCEPTED`. `NONE` uses only the schema and status fields. Other states keep the approval pin and prior approval history. A wait or closeout pointer cannot authorize continuing work.

Run `pwsh -NoProfile -File scripts/ai/test-milestone-handoff.ps1` for the handoff contract. The tests use disposable Git repositories and the existing Context Manager scripts. Product gates apply to affected product code.

## Observed documentation example

On 2026-11-09 (Asia/Bangkok), Control pinned `handoff-docs-smoke` revision 1 to `d160d549b4a49dad51b05e590f14d82324f9e110` and recorded approval in `4effb9ed8251f8d8ddd0bbc83cde58c7b0e41d27`. Fresh Codex thread `01a1c00b-69e9-7560-acfe-ad93857374d0` used one fixed read-only App Server adapter call to the actual loader. The receiving prompt carried no specification or pin. The receiver returned the exact revision, pin, first task `receive-pinned-handoff`, gate `DOCS-HANDOFF-RECEIVE` and `INITIALIZE`, with zero unexpected tool calls. The first probe reached the test adapter's 15-second deadline. The successful retry allowed more time for the unchanged loader.

The handoff fixture passed 27 checks. The existing Context Manager contract passed 31 checks and the workflow contract passed. After the smoke, loading the same approval returned `CONTINUE` from checkpoint revision 1 with the receive task completed and only the evidence task pending. The example ends at `ACCEPTED` and its closeout checkpoint records both tasks. Evidence is retained in the local Context Manager directory for `handoff-d5ea25cf5b3bb8738ac504e7fc8a8db77295a0af`. No gameplay or runtime check applies.
