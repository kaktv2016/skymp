# Frostveil project state

Use the [active milestone pointer](ACTIVE_MILESTONE.md) for approval and routing. Keep execution progress, evidence and project-wide context here.

The [documentation handoff smoke](MILESTONE_HANDOFF.md#observed-documentation-example) verified fresh receipt and checkpoint resume. The example is closed and remains available in Git history.

Baseline checked on 2026-11-09 (Asia/Bangkok). Check HEAD, remote, worktrees and runtime again at intake. These values are an audit record.

| Repository | Audited baseline |
|---|---|
| SkyMP | `583e35c9cea3c94415a088282e5b1bde02c9072c` on `dev/npc-activation-g241d`, clean at intake and matched the Frostveil fork. |
| Launcher | `29641f2` on `dev/steam-runtime-normalization`. Staged package and distribution-network edits, plus an unstaged normalization report. Keep these owner edits out of other milestones. |

- G1 gameplay/economy/persistence, G2 NPC Registry/Dialogue, Blueprint Studio, NPC Asset Pipeline, Runtime Identity v2, NPC Anchor, Passive Combat Protection and existing UUIDs are preservation constraints. See [architecture](ARCHITECTURE.md).
- Existing-NPC single-client G2.4.6 is ACCEPTED within the scope of the [dated owner record](../../FROSTVEIL_G2_4_6_RUNTIME_ONBOARDING_REPORT.md). New-base rendering, distinct streaming and a separate server-restart case have separate evidence requirements.
- Uneven-terrain stationary behavior is DEFERRED at owner request. The [last retest](../../FROSTVEIL_G2_4_4_1_TERRAIN_ANCHOR_REPORT.md) still saw the symptom. The historical native `0xC0000005` remains BLOCKED on a verified cause. Real multiplayer is DEFERRED.
- The registered CK MCP reported Skyrim `1.6.1170.0`, Creation Kit `1.7.99.0`, and installed/approved master SHA-256 `2bbc77fdec35a70ef96b710f8c525e50a1db9e63e11a391a0eb9ee8f56d36107`. Receipt `ed6271ca-4d1a-48f1-b2ab-b04faba34133`. This checks the installed master for headless authoring. Runtime compatibility remains `NOT_CERTIFIED`; native FaceGen export requires manual CK.
- Bootstrap evidence and delivery are in the [setup report](FROSTVEIL_AI_WORKFLOW_SETUP_REPORT.md). No gameplay milestone is active under this bootstrap.
- The [orchestration verification](FROSTVEIL_MULTI_AGENT_VERIFICATION_REPORT.md) records current SkyMP trust, project model defaults, and the difference between local concurrency and the active chat's runtime limit.

## Blueprint Editor regression pilot

The [bootstrap run](FROSTVEIL_AI_WORKFLOW_SETUP_REPORT.md) built successfully and passed 89 of 90 Blueprint tests. The handle refresh case exceeded its 5-second timeout both in the suite and when isolated. At pilot intake, the clean `3ab4048c` baseline passed 90 of 90 and the isolated case took 4.11 seconds.

A controlled jsdom probe appended the same 120 characters by typing and by pasting. Typing took 2,766 ms across 120 input events. Pasting took 57 ms in one event. Both grew the first choice row from 44 to 198 px, kept two choices, and refreshed the menu handles. The [regression case](../../blueprint-editor/src/main.test.tsx) now pastes once and checks the final text, row growth, choice count, and refresh. The 5-second timeout still applies. With the geometry-triggered refresh disabled in a disposable fixture, the case failed at the refresh assertion.

The pilot uses automated editor evidence. The Context Manager checkpoint `blueprint-editor-regression-pilot` indexes local timing, negative-control, review, and gate receipts. Use the same checkout to validate or recover the checkpoint.

## Launcher V2 W00 revision 1

The [W00 audit](../launcher-v2/w00/README.md) records the pinned Launcher baseline, release and WIP evidence, and the existing Steam preparation and Restore paths. The proposed first profile is Windows x64 with Steam Skyrim English `1.6.1170.0` and the normal-player flow. The complete signed client/native and compatible server pin, released-GUI cold batch, and owner Play/join/reconnect/Restore checks remain future pilot evidence.

W00 revision 1 is **ACCEPTED** for the read-only baseline audit by the owner on 2026-11-10 (Asia/Bangkok). The selected Play installation matches the Steam manifest. The owner-approved storage inventory reconciles 34,527 unique file IDs on two volumes and zero confirmed reclaimable bytes. The private discovery, inventory digest, audit and review receipts, and original Launcher preservation fingerprints are indexed by Context Manager checkpoint `handoff-1862f2ad67923410e1ba9b7cd773d068334d357c`. The [acceptance matrix](ACCEPTANCE_MATRIX.md) keeps the verified audit separate from future profile, Restore and release evidence.
