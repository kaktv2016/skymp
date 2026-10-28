# Frostveil G2.4.2 — Single-client NPC visual and equipment verification

Date: 2026-10-28 (Asia/Bangkok). This is an evidence and owner-acceptance milestone, using the existing G2.4.1C/D assets and runtime. No ESP, FaceGen, outfit, native code, Launcher or gameplay implementation was changed. Production was not started or modified.

## Acceptance status

| Status | Result | Evidence / scope |
|---|---|---|
| RUNTIME_IDENTITY | PASS | Real Skyrim probe and mapper acknowledgement at 15:21:11; current isolated process ancestry, ports and HTTP health verified |
| GUILD_CLERK_VISUAL | PASS — OWNER, overall | Owner: “Development identity verified for this authorized session ทดสอบผ่าน npc ทั้งสองตัว”; individual cosmetic details below were not separately itemized |
| WARRIOR_VISUAL | PASS — OWNER, overall | Same explicit two-NPC owner confirmation; not an automated rendering claim |
| OUTFIT_RENDERING | PENDING_OWNER — detailed confirmation | Both actors seen/tested by owner; exact named garments and mesh defects not separately reported |
| FACEGEN_RENDERING | PENDING_OWNER — detailed confirmation | Both actors seen/tested by owner; exact hair, eyes, tint and neck inspection not separately reported |
| STREAMING | PENDING_OWNER | No explicit out-of-range → return observation yet |
| RECONNECT | PENDING_OWNER | Repeated authorized sessions exist, but a controlled client-only reconnect visual/outfit comparison has not been explicitly confirmed |
| PERSISTENCE | PASS — registry / owner restart | Same two UUIDs, revision 1, positions and native identities retained; owner confirmed NPCs remain after restart and identity handshake. Restart outfit/FaceGen comparison remains pending |
| SINGLE_CLIENT_ACCEPTANCE | BLOCKED | Detailed acceptance incomplete; previous native server access violation remains unexplained |

Do not interpret the earlier D reports' historical “not activated / not started” headings as current state. Actual owner activation, rendering and restart evidence now exists. Overall visual confirmation is preserved without inventing per-field results or claiming full stability.

## Preflight, startup and current deployment

Baselines: SkyMP `1e8b94c1023e7d9973dd12e5b98ecef2a5e48112`, branch `dev/npc-activation-g241d`; Launcher `127cacdf5a9848977e8a0665fe687a301eed78a8`, branch `dev/npc-local-activation-g241d`. Previous startup fixes are included. Authorized destinations are the owner's `kaktv2016/skymp` and `kaktv2016/frostveil-launcher` repositories, never SkyMP upstream.

Existing isolated root: `build/rp-audit/g241/dev-7FNiLN`. Its world, NPC registry, dialogue registry and admin sessions are separate from production. The exact 12 sealed runtime artifacts were rehashed successfully. The real five-file resource policy passed against the staged and installed owned assets. No asset was rebuilt, copied into the player's installation, distributed or promoted to production.

Current verified engine PID **20468**: owned visible PowerShell → sealed Node supervisor → exact isolated `dist_back/skymp5-server.js`. Exclusive UDP **127.0.0.1:17777**, TCP **127.0.0.1:17778**, matching startup UUID/profile/catalog and HTTP `SAFE_WAITING` passed the existing checker. Evidence: `build/rp-audit/g242/current-readiness.json`. This check neither starts Skyrim nor changes the profile. A fresh owner grant was issued only to the unique observed actor/session for 30 minutes at the owner's explicit request; no tokens or private session nonces are included here.

Profile SHA-256: `634a433c9a6a9c5ce81a2324ab473c5c8a1594651cbdb8cb4349981670d4d1de`.
Catalog SHA-256: `1e2e2eca7cf0179650508b2790f11fd570c51d5042d1710a5cebaad9eb7ade77`.

### Earlier startup failures and actual recovery

The earlier Temp import and outer PowerShell execution hotfixes are documented in `FROSTVEIL_G2_4_1D_STARTUP_HOTFIX_REPORT.md`. They are corroborated by actual subsequent READY, client login, identity and mapper logs; those earlier fixes alone did not establish rendering success.

The 2026-10-28 14:51 attempt was a separate failure: startup actually reached `PLUGIN_IDENTITY`, then the registry reported `Economy journal writer already active`. The top-level checker subsequently reported `PROCESS_CREATION` because the outer process had already exited. Raw evidence: `build/rp-audit/g241d/startup-1793173903561-13992/{stdout.log,stages.jsonl,exit.json}`.

Both isolated registry writer leases retained old engine PID **12484**, created on October 27 at 18:41:48. Windows had reused that PID for `msedge.exe`, created October 28 at 14:02. The journal's PID-only liveness check mistook that unrelated process for the original writer. With test ports and server stopped, the two exact stale lease files were moved into a hashed recovery backup: `build/rp-audit/g241d/stale-writer-locks-1793174289690/recovery-manifest.json`. No journal records, UUIDs, world or player data were removed. This was a targeted stopped-server lease recovery, not a redesign of persistence. The existing PID-only journal mechanism can encounter PID reuse again after an unclean shutdown; do not blindly remove live writer locks.

Successful owner retry: `startup-1793174630929-21636`, READY at 15:03:55, registry definitions=2, real identity verified and mapper armed at 15:07:43. The current later owner retry again reached READY at 15:18:41 and real identity/mapper arm at 15:21:11. No additional runtime deployment or restart was needed for this report; the owner started the current server through the existing confirmed flow.

## Actual identities and persistent fixtures

The real Skyrim probe resolves the plugin by filename/content and local ID. Observed client full indices: official masters 0–4, Navigation **9**, NPC test **17**. Isolated native order: Navigation **5**, NPC test **6**. These indices are recorded observations, not fixed offset assumptions in the mapper. ActorBase type is **43** for both; runtime EditorID API remains unavailable and is explicitly reported as such. Authored EditorIDs are validated from the existing plugin/catalog rather than invented runtime proof.

| Fixture | Authored base | Actual client base | Persistent UUID | Dynamic actor |
|---|---|---|---|---|
| Female Nord Clerk | `FV_GuildClerk_Test`, `5901:FrostveilNPCTest.esp` | `0x11005901` (285235457) | `c7ee4c2b-81bf-4e2a-86e3-c1aa5b599421` | `0xFF000001` |
| Male Imperial Warrior | `FV_Warrior_Test`, `5906:FrostveilNPCTest.esp` | `0x11005906` (285235462) | `c780497d-41e1-451c-82f7-a96093c13988` | `0xFF000002` |

Registry snapshot: four checksum/chain-validated records, exactly two enabled non-deleted fixtures, revision 1 each. Both remain in `3c:Skyrim.esm`, Z `11778.4072265625`, yaw `87.98870849609375`; Clerk XY `[123583.15625,-65543.71875]`, Warrior XY `[123839.15625,-65543.71875]`. Their UUIDs match the owner's original creation results. Dynamic actor IDs are not remapped. Production Clerk is outside this fixture gate and was not edited.

Snapshots and hashes: `build/rp-audit/g242/preflight.json`. Identity logs: the current `startup-*` stdout under `build/rp-audit/g241d`; search `authorized runtime identity verified` and `mapper armed`. Gates intentionally reset across disconnect/restart. Restored fixtures remain parked until authorized identity and mapper acknowledgement; their temporary invisibility before `/npc identity` is not evidence of lost definitions.

## Per-NPC visual checklist

The owner screenshot from October 27 showed two rendered bodies/outfits; the October 28 owner explicitly reported both NPC tests passed after identity verification. That is actual single-client evidence, but does not individually attest every cosmetic criterion below. Automated asset parsing is not substituted for visual proof.

| Inspect in Skyrim | Clerk | Warrior |
|---|---|---|
| Overall actor renders | PASS_OWNER | PASS_OWNER |
| Race/sex matches female Nord / male Imperial | PENDING_OWNER_DETAIL | PENDING_OWNER_DETAIL |
| Correct head, face, hair and eyes | PENDING_OWNER_DETAIL | PENDING_OWNER_DETAIL |
| Skin/tint, no gray face or missing head | PENDING_OWNER_DETAIL | PENDING_OWNER_DETAIL |
| Neck seam acceptable, body/proportions correct | PENDING_OWNER_DETAIL | PENDING_OWNER_DETAIL |
| Warlock Robes + Boots / Imperial Light Cuirass + Boots | PENDING_OWNER_DETAIL | PENDING_OWNER_DETAIL |
| No missing clothing/armor mesh or naked/default fallback | PENDING_OWNER_DETAIL | PENDING_OWNER_DETAIL |
| Correct idle/pose animation | PENDING_OWNER_DETAIL | PENDING_OWNER_DETAIL |
| Position retained after restart | PASS_OWNER | PASS_OWNER |
| Rotation correct in view; no unintended duplicate | PENDING_OWNER_DETAIL | PENDING_OWNER_DETAIL |

FaceGen static findings from C remain unchanged: female slot 6 empty with engine fallback unverified; male tint path includes `Data/Textures`. Neither establishes a rendering defect. Existing five-file hashes, NIF structure, DDS payload and resource dependencies pass the development policy. No NIF/DDS rewrite or FaceGen export was justified.

## Native exit blocker and failure classification

The earlier successful engine **19524** exited at **15:07:45** with decimal **3221225477**, hexadecimal **0xC0000005**, after READY/identity/mapper arm and two `Hoster changed from 0 to 0` messages. `exit.json` records `lastStage: READY/PASS`; stderr contains only a nonfatal punycode deprecation warning. No matching Application error record or Node crash dump was found in the checked local CrashDumps/isolated-root locations. This is a confirmed abnormal native process exit, not proof that FaceGen, equipment or the mapper caused it. Temporal proximity alone is insufficient for such a conclusion.

Classification: **UNKNOWN_RENDER_FAILURE — investigation pending**, with rendering causality explicitly unproven. No PLUGIN_IDENTITY_FAILURE or BASE_FORM_RESOLUTION_FAILURE is demonstrated in either successful session. No FACEGEN_RENDER_FAILURE, OUTFIT_RENDER_FAILURE, ACTOR_SPAWN_FAILURE, STREAMING_FAILURE or PERSISTENCE_FAILURE is established by present evidence. Owner's later two-NPC success does not establish the cause or permanent resolution of the earlier native exit. Keep complete stdout/stderr/exit metadata; if it recurs, obtain a native stack/dump and exact owner action before applying a fix. Do not weaken visibility or authentication to force a PASS.

## Automated verification and changes

Fresh checks for this milestone:

- RP build/typecheck and regression: **395/395 PASS**. Log `build/rp-audit/g241d/g242-rp-tests.log`.
- Client lifecycle/Spawn Recovery/identity regressions: **58/58 PASS**. Log `g242-client-tests.log` in the same audit directory.
- Real authored assets, resource policy, FaceGen structure and startup regressions: **15/15 PASS**. Log `g242-assets-tests.log`.
- Current actual server ancestry, exclusive loopback ownership and production health contract: **PASS**.
- Twelve deployed runtime seals and persisted registry checksum chain: **PASS**.

No executable changes were warranted by a proven rendering defect. Consequently no client delivery, runtime redeployment, public release or production restart was performed. The RP build updates ignored build output only; it does not replace the isolated sealed runtime. No unrelated native/Launcher/editor rebuild is claimed or required. Changed tracked files are this report and a short current-evidence note in the D report. The documentation commit is pushed to `frostveil/dev/npc-activation-g241d`; its SHA is available with `git log -1 --oneline -- FROSTVEIL_G2_4_2_SINGLE_CLIENT_VISUAL_REPORT.md`.

## Exact owner acceptance sequence

1. While the existing test server console remains open, rejoin with:
   `node "C:\Users\basba\OneDrive\Desktop\skyrim-rp\skyrim-rp-launcher\scripts\npc-development.mjs" play`
   If the test server is stopped, with Skyrim closed use `activate-and-play` instead and review/type `CONFIRM`. Normal Launcher Play selects the primary profile; do not use it for this isolated test.
2. After entering the test server, obtain a fresh session grant when required:
   `node "C:\Users\basba\OneDrive\Desktop\skyrim-rp\skyrim-rp-launcher\scripts\npc-development.mjs" grant`
   Review the unique observed session and type `GRANT`. In game: `/npc identity`, then `/npc identity status`. Wait for verified/armed.
3. `/npc fixture list`: expect the two UUIDs above. Existing fixtures already exist; do not recreate or replace them for this test. `/npc fixture create` is the existing idempotent provisioning command only if the list is genuinely empty after authorized verification.
4. Inspect both separately in good light, front/back/profile, checking each row above. Report Clerk and Warrior results separately, especially hair/tint/neck and the exact expected outfit.
5. Record the UUIDs, walk outside streaming range until both unload, return, and compare identity, outfit, pose, location and duplicate count.
6. Exit Skyrim, keep the test server console open, use `play`, grant the new session, repeat identity handshake and visual/list checks. Report this specifically as client reconnect.
7. Owner restart confirmation is already recorded. For a full repeated check, close Skyrim, stop only the isolated server console, use `activate-and-play`, grant/verify, compare the same UUIDs, positions, outfits and appearance. Report any server console disappearance or game disconnect with time and the action being performed.

Still needed: per-field visual/outfit confirmation, controlled streaming and client-only reconnect outcomes, and native-exit investigation. No real two-client success is claimed; it remains outside this single-client milestone.

## Safe cleanup and rollback

Preserve the existing fixtures until acceptance finishes. Afterwards, owner may use `/npc fixture cleanup` in the authorized isolated session; it targets development fixture records only. Do not manually delete registry journals, world ChangeForms, player inventories or production Clerk data.

To leave the development profile: close Skyrim, stop only its isolated server console, then run:
`node "C:\Users\basba\OneDrive\Desktop\skyrim-rp\skyrim-rp-launcher\scripts\npc-development.mjs" revert`
Review/type `CONFIRM`. The authenticated existing workflow restores the two configuration targets and preserves conflicting later edits. Source assets remain owned and unchanged. Stale lease backups must only be restored by a stopped-server operator if no successor writer lease exists; never overwrite a live lease or journal. No code deployment was made in G2.4.2, so no executable rollback is necessary.
