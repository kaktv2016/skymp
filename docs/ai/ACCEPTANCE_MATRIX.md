# Acceptance matrix

The approved criteria live in the milestone's `ACCEPTANCE.md` under the [handoff workflow](MILESTONE_HANDOFF.md). This matrix records observed results and evidence.

Use NOT_STARTED, IN_PROGRESS, AUTO_VERIFIED, OWNER_PENDING, BLOCKED, DEFERRED, and ACCEPTED. Attach command receipts to automation and a dated scenario/build to owner evidence. Track source, native fixture, actual runtime, owner result, and production decision separately.

| Item | Automated or native evidence | Owner status |
|---|---|---|
| Workflow bootstrap | [Setup report](FROSTVEIL_AI_WORKFLOW_SETUP_REPORT.md) | Gameplay check out of scope |
| Documentation handoff smoke | AUTO_VERIFIED through a fresh Codex receipt and matching Context Manager resume. See the [evidence](MILESTONE_HANDOFF.md#observed-documentation-example). | Owner and runtime checks out of scope |
| Multi-agent orchestration | Trusted project config, four named roles and three-way local turn overlap verified. Source review passed sequentially. Parallel source review BLOCKED at the standalone shell. See [verification](FROSTVEIL_MULTI_AGENT_VERIFICATION_REPORT.md). | Gameplay check out of scope |
| Blueprint Editor regression pilot | AUTO_VERIFIED in jsdom. Blueprint Gates B and C, a refresh-disabled negative control, and independent review. See the [pilot evidence index](PROJECT_STATE.md#blueprint-editor-regression-pilot). | Owner and native checks are outside the editor test scope |
| G2.4.6 existing NPCs | [Onboarding report](../../FROSTVEIL_G2_4_6_RUNTIME_ONBOARDING_REPORT.md), including identity and protected assignment checks | ACCEPTED for mapper, reconnect, E dialogue, Rename/Move/Rotate and passive protection only |
| New G2.4.6 runtime/render, separate streaming/restart | CK can validate supported scratch inputs and complete FaceGen packages | BLOCKED on asset for new rendering; separate streaming/restart OWNER_PENDING |
| Uneven terrain | [Terrain report](../../FROSTVEIL_G2_4_4_1_TERRAIN_ANCHOR_REPORT.md) records automated fixture results | DEFERRED after failed real retest |
| Native crash | Cause unresolved in the dated reports | BLOCKED |
| Multiplayer | Native fixture and single-client results have separate scope | DEFERRED |
| Launcher V2 W00-A1, pinned baseline and WIP preservation | AUTO_VERIFIED for Gate A and matching Launcher HEAD/index/status and dirty-file hashes. Release results retain their committed or WIP report provenance. [Current state](../launcher-v2/w00/CURRENT_STATE_AUDIT.md) | Actual installed build and 0.1.31 release/NSIS outcome remain separate. |
| Launcher V2 W00-A2, volume and reclaim inventory | BLOCKED on recursive approval for three discovered external roots. The selected Play installation and 1,243 unique Launcher data files are recorded, with per-volume partial totals and protected Restore references. Confirmed reclaimable bytes are zero so far. [Storage boundary](../launcher-v2/w00/CURRENT_STATE_AUDIT.md#storage-and-restore) | Owner approves specific game, acquisition and bootstrap fixture roots. Final reconciliation and independent review follow the complete inventory. |
| Launcher V2 W00-A3, Steam preparation journeys | AUTO_VERIFIED for pinned source references and trace coverage. [Runtime preparation](../launcher-v2/w00/CURRENT_STATE_AUDIT.md#runtime-preparation-and-steam-authentication) | Released-GUI cold batch and Steam Console remain UNKNOWN. |
| Launcher V2 W00-A4, one pilot profile | PROPOSED in the [compatibility baseline](../launcher-v2/w00/COMPATIBILITY_BASELINE.md). Exact release, native and compatible server pins remain open. | Future Play/join/reconnect/Restore evidence is separate. |
| Launcher V2 W00-A5, reuse and decisions | Source-supported [dependency audit](../launcher-v2/w00/DEPENDENCY_AUDIT.md) is available. Storage-dependent decisions remain open. | Owner and maintainers resolve only the listed pilot prerequisites. |
| Launcher V2 W00-A6, evidence and review | Audit checks and review indexed by Context Manager. [W00 audit summary](../launcher-v2/w00/README.md) | Baseline audit remains BLOCKED on W00-A2. Gameplay acceptance is outside W00. |

For each new milestone add one row per scenario with goal/criterion, build and Git identity, gate or owner check, status, evidence path, and limitation. Add production readiness only after a separate authorized release decision.
