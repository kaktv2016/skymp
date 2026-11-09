# Acceptance matrix

Use NOT_STARTED, IN_PROGRESS, AUTO_VERIFIED, OWNER_PENDING, BLOCKED, DEFERRED, and ACCEPTED. Attach command receipts to automation and a dated scenario/build to owner evidence. Track source, native fixture, actual runtime, owner result, and production decision separately.

| Item | Automated or native evidence | Owner status |
|---|---|---|
| Workflow bootstrap | [Setup report](FROSTVEIL_AI_WORKFLOW_SETUP_REPORT.md) | Gameplay check out of scope |
| Multi-agent orchestration | Trusted project config, four named roles and three-way local turn overlap verified. Source review passed sequentially. Parallel source review BLOCKED at the standalone shell. See [verification](FROSTVEIL_MULTI_AGENT_VERIFICATION_REPORT.md). | Gameplay check out of scope |
| Blueprint Editor regression pilot | AUTO_VERIFIED in jsdom. Blueprint Gates B and C, a refresh-disabled negative control, and independent review. See the [pilot evidence index](PROJECT_STATE.md#blueprint-editor-regression-pilot). | Owner and native checks are outside the editor test scope |
| G2.4.6 existing NPCs | [Onboarding report](../../FROSTVEIL_G2_4_6_RUNTIME_ONBOARDING_REPORT.md), including identity and protected assignment checks | ACCEPTED for mapper, reconnect, E dialogue, Rename/Move/Rotate and passive protection only |
| New G2.4.6 runtime/render, separate streaming/restart | CK can validate supported scratch inputs and complete FaceGen packages | BLOCKED on asset for new rendering; separate streaming/restart OWNER_PENDING |
| Uneven terrain | [Terrain report](../../FROSTVEIL_G2_4_4_1_TERRAIN_ANCHOR_REPORT.md) records automated fixture results | DEFERRED after failed real retest |
| Native crash | Cause unresolved in the dated reports | BLOCKED |
| Multiplayer | Native fixture and single-client results have separate scope | DEFERRED |

For each new milestone add one row per scenario with goal/criterion, build and Git identity, gate or owner check, status, evidence path, and limitation. Add production readiness only after a separate authorized release decision.
