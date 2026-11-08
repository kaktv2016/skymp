# Frostveil AI workflow setup report

2026-11-09, Asia/Bangkok. Scope was workflow infrastructure for the existing SkyMP and Launcher repositories. No gameplay milestone, server deployment, game/plugin activation, client publication, or production change was performed.

## Installed in SkyMP

| Files | Purpose |
|---|---|
| `AGENTS.md` and [SOP](DEVELOPMENT_SOP.md) | Fresh-session entry point, main-agent ownership, milestone flow, three-attempt repair limit, gates A–G and consolidated owner handoff. |
| `.codex/config.toml` and `.codex/agents/` | Project-only settings and researcher, engineer, QA, and reviewer roles. |
| `.agents/skills/frostveil-*/SKILL.md` | Feature, debug, native, assets and release workflows, each with inputs, steps, outputs, blocking conditions and existing runbook links. |
| `scripts/ai/` | PowerShell preflight, focused test, regression, delivery-integrity and fixture-test entry points with a shared helper. |
| [Project state](PROJECT_STATE.md), [architecture](ARCHITECTURE.md), [roadmap](ROADMAP.md), [acceptance matrix](ACCEPTANCE_MATRIX.md), [decisions](DECISIONS.md) | Durable baseline, resumption, owner acceptance and decision history. |

SkyMP is the shared workflow hub. Launcher retains separate Git and release authority. The audited Launcher staged and unstaged changes were preserved. Its combined working diff hash stayed `692b09dfd65eec7612987a9cdfceb21621f5c4f4`. No Launcher workflow files or commits were necessary.

## Codex, configuration and permissions

- Windows desktop package `26.1103.4239.0`, bundled `codex-cli 0.167.0-alpha.3.2`, Git `2.54.0.windows.1`, RTK `1.0.1`, PowerShell `7.6.9`, Node `24.11.1`. RTK was exercised on Git status. The parent directory and global AGENTS guidance point to the existing RTK rules. In a fresh run at the SkyMP root, `codex debug prompt-input` included the new SkyMP AGENTS.md. Nested AGENTS instructions are checked at task intake.
- Strict CLI validation accepted the project keys. A disposable trusted Codex profile with no copied credentials loaded the actual project layer through `config/read`. It returned `workspace-write`, `on-request`, three concurrent children, and depth one. All four role TOMLs parsed with the documented name, description and instruction fields.
- The existing user configuration did not mark this SkyMP directory trusted. A normal app-server read showed the project layer disabled and the existing global cap of one. The owner can trust the reviewed SkyMP workspace in Codex to load project defaults. Effective permissions come from the parent turn and managed host policy. This setup chat reported unrestricted filesystem and approvals disabled. The bootstrap used bounded commands and left host controls intact. Read-only roles are instructions, not independent sandboxes.
- Built-in desktop dispatch ran an independent read-only reviewer on the gate scripts and config. The review flagged Node 24 count parsing and delivery-evidence boundaries. A follow-up checked build/test routing against actual receipts, and snapshot comparison now rejects changed Git status. Gate F requires clean start/end snapshots and the same commit. Dirty receipts are diagnostic. A same-file edit during a dirty run can escape the status comparison, so use an isolated clean worktree for delivery.
- CLI attempts to select `frostveil_researcher` reported a spawn schema with no named-role selector. Named-role discovery at runtime and dispatch are unverified in this host. Where the spawn selector is absent, Main can pass the applicable role instructions to a generic child with bounded scope. Neither the configured cap nor role files expand the host's available slots or permissions.
- A restricted CLI shell probe failed with `registered Core launch requires an installed app`. The app-server protocol still listed all five skills and accepted each as explicit typed input. Its completed read-only invocation returned the corresponding first steps and blockers from all five bodies. This checks invocation, not every domain workflow. The skill-authoring validator also passed for all five.
- Git created and removed a disposable detached linked worktree at the baseline commit. Use disjoint file scopes or linked worktrees for real parallel writes. Main alone integrates and pushes.
- Existing `PreToolUse` hook, global config and MCP registrations were retained. Global config and hooks SHA-256 matched before and after the audit. No project hook was installed. Registered MCP names were Roblox_Studio, blender, codex_app (disabled in CLI listing), cua_repl, frostveil_creation_kit, node_repl and ruflo. Registration establishes presence, not health. The app-server probe saw a Ruflo handshake failure and a separate CLI probe saw a marketplace refresh timeout. Their configurations were left as found.
- CK MCP `ck_capabilities` and `ck_inspect_installation` responded. Receipts `e3909531-7179-4ab2-8f29-ebfd0bcf1b2d` and `ed6271ca-4d1a-48f1-b2ab-b04faba34133`. The installed master matched the approved baseline. Headless Mutagen is available. Native bridge, real rendering/runtime certification and native FaceGen export are unavailable through that MCP.

OpenAI documentation for schema and precedence. [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference), [subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents), [skills](https://learn.chatgpt.com/docs/build-skills), [hooks](https://learn.chatgpt.com/docs/hooks).

## Actual validation

Primary evidence root on this workstation is `%TEMP%/frostveil-ai-bootstrap-20261109`. Gate receipts name each exact command and full log. Product test paths were unchanged from the source baseline. The initial smoke ran while workflow files were uncommitted, so those receipts are diagnostic.

| Check | Actual result and evidence |
|---|---|
| PowerShell syntax | All six scripts parsed with PowerShell's parser. |
| Gate A for both repos | Exit 0 in diagnostic mode, including the Launcher dirty status. See `frostveil-A-3f043299-a8d0-4696-9289-f4faa3bb81c0/receipt.json`. |
| Gamemode focused | `npm run test:profile` exit 0, 74 tests. `frostveil-B-8f261bc5-f400-479a-bdd8-399663be08d8/receipt.json`. |
| Gamemode regression | `npm test` exit 0, 469 tests including the existing build lifecycle. `frostveil-C-270e9848-75ec-42f0-af4b-46c650751572/receipt.json`. |
| Blueprint regression | `npm run build` exit 0. `npm test` exit 1, 89 passed of 90. The handle-bounds/text-wrap case at `blueprint-editor/src/main.test.tsx:89` hit the 5-second timeout and reproduced when isolated. See `frostveil-C-2c760a10-776d-4419-a4d3-1312e0f62cf1/` and `blueprint-timeout-repro.log`. No Blueprint code, tests, or timeouts were changed. |
| Launcher typecheck | `npm run typecheck` exit 0 on the owner's existing checkout. `launcher-typecheck.log`. Full Launcher and CreationKit wrapper suites were outside the bounded smoke. |
| Gate failure contract | `pwsh -NoProfile -File scripts/ai/test-workflow.ps1` exit 0. Synthetic positive A/B/C/F receipts, plus expected failures for dirty source, wrong artifact hash, tampered log, stale commit and a failing Node test. The failure retained its full diagnostic. See `%TEMP%/frostveil-ai-contract-3c85dada-5b74-4d5e-877c-06d6b7468250`. |
| Runtime file audit | `server.cmd --check` exit 0, verified the existing paired deployment files in read-only mode. This was a file/config check. No startup, live health, native execution, visual rendering or owner gameplay acceptance was performed. |
| Skills, trust and custom role probes | `app-server-skill-events.jsonl`, `trusted-config-probe.log`, and `codex-custom-role.jsonl`. The Windows CLI shell blocker is in `codex-exec.jsonl`. |

Gates A/B/C capture source, commands, exit and counts where applicable. Gate F checks one trusted artifact digest and applicable regression receipt at a time. Review, native identity, release provenance, signatures, backup, startup and owner acceptance retain separate evidence. A failed applicable gate blocks runtime delivery. The reproduced Blueprint timeout remains open for a separate authorized milestone.

## Git and owner use

SkyMP base was `583e35c9cea3c94415a088282e5b1bde02c9072c`. The workflow commit is the commit introducing this report. Resolve its ID with `git log -1 --diff-filter=A --format=%H -- docs/ai/FROSTVEIL_AI_WORKFLOW_SETUP_REPORT.md`. Authorized delivery is a normal fast-forward push to `frostveil` at `kaktv2016/skymp`, branch `dev/npc-activation-g241d`. The final local and remote ref check is recorded in `git-delivery.log` under the primary evidence root. The Launcher authorized remote is `origin` at `kaktv2016/frostveil-launcher`. No Launcher push is part of this bootstrap.

Open a new Codex session in the SkyMP repository, review the project config and select normal workspace permissions. Use Codex's project trust control if you want the reviewed project settings enabled. Send one goal, for example, “Use `$frostveil-feature` for milestone <goal>. Keep existing NPC identities and player data. Deliver only to the verified local test server if needed.” The lead audits, delegates independent work, integrates, and follows the three-repair loop. It asks for owner involvement when required authority or evidence is missing, or when the integrated milestone needs real Skyrim or a manual CK action. No owner gameplay test is required for this setup.
