# Frostveil development SOP

Start a fresh Codex session in SkyMP. Use [project state](PROJECT_STATE.md), [architecture](ARCHITECTURE.md), [roadmap](ROADMAP.md), [acceptance](ACCEPTANCE_MATRIX.md), and [decisions](DECISIONS.md). Keep historical reports as the primary evidence for past releases. Read current source and runtime receipts before relying on them.

## Milestone flow

| Stage | Exit evidence |
|---|---|
| INTAKE | One owner goal with named repositories, intended environment, and authorization boundaries. |
| BASELINE_AUDIT | Gate A plus Git root, branch, commit, dirty files, authorized remotes, relevant running process, settings, build, source/runtime identity, and fixture availability. Record inapplicable checks. |
| REQUIREMENTS | Scope and exclusions, dependencies, existing systems to preserve, compatibility, technical and data risks. |
| ACCEPTANCE_CRITERIA | Machine-testable checks and separate owner-only checks with evidence, rollback, and Definition of Done. |
| TASK_DECOMPOSITION | Tasks with inputs, write scope, dependencies, test commands, and expected evidence. Main owns the dependency graph and integration. |
| IMPLEMENTATION | Small reviewed diffs in isolated worktrees or disjoint write sets. |
| AUTOMATED_VALIDATION | Gate B, Gate C and applicable Gate E with failure output retained. |
| INDEPENDENT_REVIEW | Gate D with independent read of the relevant diff and regression evidence. |
| REPAIR_LOOP | Findings resolved or blocked with evidence. Rerun the affected checks and independent review as needed. |
| INTEGRATION | Inspect the combined diff and run all applicable regressions against the integrated commit. |
| SAFE_DEV_DEPLOYMENT | Gate F, backup, target and startup/health receipts for the verified local test environment if applicable. |
| OWNER_ACCEPTANCE | One integrated Gate G session where required. Record the exact owner-confirmed behaviors and the build tested. |
| CLOSEOUT | Update state, acceptance, roadmap, and decisions as applicable. Record commits, remote outcome, evidence paths, remaining gaps, and recovery. |

At intake record **goal**, **scope and exclusions**, **dependencies**, **systems to preserve**, **risks**, **machine criteria**, **owner criteria**, **rollback**, **Definition of Done**, and **evidence requirements**. Define a rollback that restores code/config by exact identity while leaving player, world, registry, and economy data intact. Done means applicable automated gates, independent review, authorized integration, and deployment evidence are recorded. Owner-gated milestones remain OWNER_PENDING until that evidence arrives. A build may be AUTO_VERIFIED with native, owner, or release checks still pending. Production readiness has a separate decision and authorization.

## Main and subagents

Main chooses project skills, confirms prerequisites, hands out bounded tasks, and owns the final patch and handoff. Use `frostveil_researcher` for source/requirements, `frostveil_engineer` for a bounded implementation, `frostveil_qa` for fixtures and receipts, and `frostveil_reviewer` for independent review. Give each task a baseline, allowed paths, required reading, success conditions and expected outputs. Keep raw logs in private evidence storage. Request assigned task, files inspected/changed, verified observations, test evidence, risks, blockers, and next action from each agent.

Use up to three concurrent subagents, subject to the host cap. Prefer one agent for a single coherent investigation. Use disjoint write sets or linked Git worktrees from known commits if writes can conflict. Avoid copying game installations or duplicating repositories. Main assigns worktrees, verifies diffs, resolves conflicts and handles push, merge, or deployment. Child roles share the parent's effective permissions. Read-only role guidance is a task boundary. Select normal workspace permissions in the parent and confirm the actual mode before delegating. A trusted project loads the repository's Codex settings. If the host lacks custom role selection, pass the same role instructions explicitly to the generic agent and record the fallback. Keep children from recursively spawning further agents by default.

## Bounded QA loop

For each task run PLAN → IMPLEMENT → FOCUSED_TEST → REVIEW → REPAIR → RETEST. Record the first failing command and reproduce the failure with a bounded fixture where possible. For each repair, state a changed hypothesis or new evidence, apply a focused change, rerun the affected checks, and check regressions. Default to three focused repair attempts per task. After the third, Main reassesses scope, baseline and evidence and either chooses a materially different bounded approach or records BLOCKED with a precise next action. Test weakening, unexplained timeout increases, and unchanged retries invalidate a gate.

Escalate an unsupported required API, unexplained native crash, incompatible identity, missing essential dependency, irreversible action requiring authorization, or correctness that needs manual/native evidence. Use isolated fixtures and private bounded storage. Leave production, game installation and plugin activation alone unless a later milestone explicitly authorizes the operation. Never force-close Skyrim.

## Gates and receipts

Run scripts from the SkyMP root with PowerShell 7. Use separate clean worktrees for deployable evidence and set `-LauncherRoot` to the verified Launcher worktree when applicable.

| Gate | Entry and scope |
|---|---|
| A | `pwsh -NoProfile -File scripts/ai/preflight.ps1` records Git state and tool versions. Supply `-LauncherRoot <path>` for both repos and `-RequireClean` for delivery. Record current runtime identity separately. |
| B | `pwsh -NoProfile -File scripts/ai/test-focused.ps1 -Suite <suite>`. Gamemode uses `npm run test:profile`; Blueprint uses the NPC runtime React test; CreationKit runs its existing pretest/build and tests; Launcher runs typecheck and tests. Add focused domain checks if this selection does not exercise the change. |
| C | `pwsh -NoProfile -File scripts/ai/test-regression.ps1 -Suite <suite>`. Gamemode and CreationKit build via their test lifecycle; Blueprint builds and runs all Vitest tests; Launcher typechecks, builds and runs its unit/integration tests. Run once per affected suite. |
| D | Fresh reviewer checks correctness, security, replay/races, persistence, compatibility and rollback where relevant. Record findings and disposition. |
| E | Pin the native build/ABI and identify each installed input afresh. Use the native and asset skills. Record which contracts were exercised by a fixture, the actual runtime, or the owner. |
| F | From a clean commit, run `verify-delivery.ps1 -Suite <suite> -RegressionReceipt <receipt.json> -Artifact <file> -Sha256 <trusted hash>`. Repeat per affected suite and sealed artifact as applicable. Follow the milestone's existing release runbook to verify target, provenance, signatures, paired backup, health and rollback. |
| G | Owner tests the actual named build when Skyrim or manual CK is necessary. Capture the scenario, observed result, timestamp, and environment. |

Suite names are `Gamemode`, `Blueprint`, `CreationKit`, and `Launcher`. Install pinned dependencies with the relevant repository's existing procedure before testing. Wrappers write logs and JSON receipts to unique directories under TEMP or the supplied private `-EvidenceRoot` outside the repo. A/B/C record source state, commands, exit codes and counts where applicable. F checks the current clean source identity, expected regression command receipts, log hashes, and artifact bytes against a trusted hash. Use the existing release seal to bind artifacts to their sources and check trust. Receipts are local diagnostics and can be rewritten by anyone with filesystem access. They are not signatures or release authorization. Retain full logs privately, record artifact/seal/build identities and limitations, and cite concise receipts in the handoff. Any failed applicable hard gate blocks delivery.

## Safe delivery

Verify fetch/push destinations and branch before any push. SkyMP uses `frostveil` → `kaktv2016/skymp`. Launcher uses `origin` → `kaktv2016/frostveil-launcher`. Preserve staged and unstaged work, honor signing and hooks, and use scoped commits and normal fast-forward pushes. Exclude secrets, auth, crash dumps, player/runtime data, generated logs, and proprietary assets.

For an authorized local deploy confirm exact target path, loopback binds/ports, process tree, active clients, settings, startup receipt and prior paired code/config seal. Check backup and rollback before changing runtime files. If startup or relevant health fails, stop only the verified test process and restore the paired code/config backup through the runbook. Revalidate startup and health. Require task-specific authorization and the reviewed signed Launcher distribution pipeline for client publication.

One owner handoff lists the ready scope and build, exact launch command/profile, short test checklist with expected results, limitations and recovery. If a manual CK action blocks progress, state the exact asset and export/action needed. Batch owner checks when safe. A docs/tooling-only milestone has no gameplay acceptance step.
