# Frostveil Context Manager

The Context Manager extends the [milestone SOP](DEVELOPMENT_SOP.md). The checkpoint is the saved state of a workflow boundary. Main completes the boundary by running the save command and checking its exit code. The same command validates the input and publishes a new revision. It runs as part of the agent's workflow, including handoff and stop states. No separate owner command or global hook is needed.

## Save a milestone boundary

From the SkyMP root, write the current state to a small private JSON file, for example under TEMP. Use an existing milestone ID on subsequent saves. Preserve completed and pending task IDs and move only newly completed work out of pending. If the owner replaces the milestone scope, record the deferral or replacement in project state, preserve the old checkpoint, and use a new milestone ID for the replacement. Include scope and exclusions, the next actionable step, and specific reasons for waiting. Keep raw logs, credentials, and protected runtime data out of this file.

```json
{
  "milestone": "example-tooling",
  "goal": "Verify the isolated workflow fixture",
  "scope": "Workflow tooling and fixtures only",
  "stage": "AUTOMATED_VALIDATION",
  "status": "AUTO_VERIFIED",
  "completed": ["baseline-audit", "fixture-regression"],
  "pending": ["independent-review"],
  "evidencePaths": ["C:/path/to/existing/fixture-receipt.json"],
  "nextAction": "Review the verified fixture changes",
  "notes": "Native runtime and owner gameplay are outside this scope"
}
```

Use a real absolute local path for each evidence file. Keep evidence to small receipts or summaries and retain the referenced files. The command records SHA-256 and Git root, branch, HEAD, and working status. Supply `-LauncherRoot` with the verified Launcher checkout only for a milestone involving Launcher. Set stage `OWNER_ACCEPTANCE` and include `ownerAction` for `OWNER_PENDING`. Include `blocker` for `BLOCKED`. Set `CLOSEOUT` and clear in-scope pending tasks for `ACCEPTED`.

```powershell
pwsh -NoProfile -File scripts/ai/complete-milestone-boundary.ps1 -StateFile <state.json>
pwsh -NoProfile -File scripts/ai/complete-milestone-boundary.ps1 -StateFile <state.json> -ExpectedRevision <last-revision>
```

The first save expects revision zero. Each later save requires the last revision to avoid stale writes. A local lock serializes writers and a same-directory rename publishes the validated file. Revisions stay under the current SkyMP checkout's ignored `.local/ai/checkpoints/`. The command reports the new revision, path, and digest. If it fails, the prior checkpoint remains available. Reconcile any mismatch or validation failure before reporting a successful handoff. Keep the same checkout for resumption, including if it is a linked worktree.

## Validate or resume

```powershell
pwsh -NoProfile -File scripts/ai/resume-milestone.ps1 -Milestone <id> -ValidateOnly
pwsh -NoProfile -File scripts/ai/resume-milestone.ps1 -Milestone <id>
```

The validator checks the latest checkpoint's format and identity, current Git snapshots, and retained evidence hashes. For a recorded Launcher checkout other than the default sibling directory, supply that verified path with `-LauncherRoot`. The resume command returns the saved tasks and next action as data. It runs no saved commands and starts no agent, deployment, or game. Local checkpoints are workflow state and are editable by anyone with write access.

| Disposition | Handling |
|---|---|
| `CONTINUE` | Review the current request and continue only pending work. |
| `WAIT_FOR_OWNER`, `WAIT_FOR_UNBLOCK`, `WAIT_FOR_SCOPE`, `CLOSED` | Preserve the recorded wait or closeout. A valid checkpoint can have one of these states. |
| `RECONCILE_DIRTY_WORKTREE` | Review staged and unstaged work before continuing. Matching status paths do not prove matching dirty bytes. |
| `RECONCILE_CHECKPOINT` | Exit 1 with drift or missing-evidence diagnostics. Reconcile changes before saving a new boundary. |

A corrupt checkpoint fails closed. Prior revisions are retained for explicit inspection. A copied or older checkpoint cannot substitute for verification in the current worktree. Keep live evidence outside temporary directories if it must survive cleanup.

## Compact or switch chats

Save and validate the checkpoint before requesting compaction. The installed app-server protocol exposes `thread/compact/start` for a thread loaded in that client. Require a completed `contextCompaction` item and completed turn on the same thread ID. An RPC acknowledgement by itself only confirms the request was accepted. This repo does not attach to existing desktop threads or run compaction in a hook.

When the current tool surface offers no compaction action, type `/compact` and press Enter in the same interactive Codex CLI chat. Wait for completion, then send `Use $frostveil-context-manager to resume milestone <id>`. In a client that does not offer compaction, open a new chat at the same SkyMP checkout and send that same resume message. [OpenAI App Server](https://learn.chatgpt.com/docs/app-server), [Codex CLI chat guidance](https://learn.chatgpt.com/guides/best-practices).

## Validation scope

Run `pwsh -NoProfile -File scripts/ai/test-context-manager.ps1` for the Context Manager Gate B/C contract. It exercises checkpoints in a disposable repository and retains diagnostics in TEMP. Use the existing workflow contract and a fresh or genuinely compacted Codex resume smoke for changes to boundary integration. Apply product gates to the code actually changed. The existing Blueprint Editor handle-wrap timeout from the [setup report](FROSTVEIL_AI_WORKFLOW_SETUP_REPORT.md) remains relevant to Blueprint milestones. Context Manager touches workflow scripts and docs and uses a separate fixture gate.

The effective trust state, supported compaction, generic-agent fallback, and observed smoke results are recorded with this implementation's evidence. Do not use compaction or checkpoints to change trust, approvals, or deployment authority.
