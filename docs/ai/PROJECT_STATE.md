# Frostveil project state

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
