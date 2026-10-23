# FROSTVEIL G2.2 — NPC Interaction & Dialogue Runtime

Date: 2026-10-23 (Asia/Bangkok). Implemented/deployed; actual E interaction and real two-client gameplay remain owner acceptance pending.

## Architecture and installed API evidence

- `ActivationService.onActivate` converts local references to server identities, but streamed actors are blocked from vanilla activation in `movementApply`. Vanilla dialogue is therefore not assumed. The signed event source observes the configured Activate key (`Input.getMappedKey('Activate', 0)`, normally E), then resolves `Game.getCurrentCrosshairRef()` and `ctx.getFormIdInServerFormat()` in update context. Button callbacks retain only a key number, never a native wrapper. The server independently checks the registry identity, enabled/deleted status, actor session and 256-unit distance in the same cell/worldspace.
- Installed API declarations: `skyrim-platform/src/platform_se/codegen/convert-files/skyrimPlatform.ts`; installed event context: `gamemodeEventSourceService.ts`. No C++ changes or assumption that native dialogue menus work.
- `DialogueRuntime` binds each private conversation to the stable G2.1 NPC UUID and current account/character/session identity. Only the currently offered node/choice/token can transition. Tokens rotate before service execution. Timeouts, cell/range changes, disable/delete, reconnect and session changes invalidate the conversation. Open requests are bounded/rate-limited. Per-user connection hooks cancel only that user's conversations.
- `NpcService` adds one read-only lookup method. Owner-confirmed G2.1 pose/AI/rotation code is unchanged. RP chat adds one guard to avoid taking focus from dialogue.

## Declarative schema and storage

`Graph {schemaVersion:1,id,version,entry,nodes}` with stable node/choice IDs. Node types: entry, npc, choices, condition, action, end. Maximum 128 nodes, 16 choices per choice node; bounded text and payloads. Unknown fields, duplicate IDs, dangling edges, automatic cycles and unsupported node/actions/conditions are rejected. Graph updates must retain graph identity and strictly increase version; validated durable append precedes acknowledgement. Runtime uses an immutable graph snapshot until restart. No editor or live graph editing endpoint is exposed.

Explicit condition allowlist: always, courierIdle. Explicit service allowlist: contracts, rank, permits, accept (configured route ID), buyPermit (configured permit ID). No JS/Papyrus/console/reward execution. Text is rendered with textContent.

Definitions use the existing checksummed, fsynced journal architecture in the separate `rp-npcs-dialogues` directory (key `8` repeated 64 times). A validated default Courier Clerk graph is seeded once. Existing malformed definitions fail closed, never reset. This directory is distinct from NPC definitions, world/player saves and economy journals. Conversation state is memory-only and expires after 60 seconds of inactivity. Store schema/update API prepares for G2.3 without implementing it.

## Clerk UI and existing services

Aim at the existing registered Clerk and press Activate/E. Choices offer contracts, each configured route, rank, permit catalogue, each configured permit and Exit. The server calls the same EconomyService.execute used by `/job list`, `/job accept <route>`, `/job rank`, `/job guild`, `/job guild buy <permit>`; no new balance, reward, rank or quest code is introduced. Existing eligibility, pickup-distance validation, cooldowns, durable transactions and navigation remain authoritative. Accepting a contract still requires the original permitted pickup location; an arbitrarily placed Clerk does not bypass it. Locked/failed actions show the existing service's reason.

The CEF panel shares the existing RP browser infrastructure, with Thai/Unicode text, mouse buttons, Tab/Enter and Up/Down focus navigation, and ESC cancellation (including while waiting for a service response). It preserves prior browser visibility/focus, avoids stealing chat focus, and closes on loading/menu/session changes. Cancelled snapshots cannot reopen from a delayed owner update. No installed player files, Launcher or modpack files are edited; updated UI/client logic is transmitted through the installed native signed server-JS mechanism.

## Verification

- Typechecks and server bundle build pass. Full regression suite: **308/308**.
- New tests: capture deferral to update context, isolated source execution, Unicode DOM rendering, mouse/keyboard/ESC/focus, stale snapshot suppression, loading/disconnect/character cleanup, per-player isolation, token replay/spoofed choices, remote activation, wrong cell/range, disable/delete, expiry, graph validation/versioning and durable restart recovery.
- Economy integration test uses the actual EconomyService/journal: accept creates the normal durable job, replay cannot accept twice, ineligible permit purchase preserves balance/permits and gives no reward. Existing economy, spawn, Courier, discovery, admin, chat and NPC pose regressions pass.
- Disposable installed native runtime probe starts the full module/transport stack successfully. Real local server startup logs `[rp-npc] ready definitions=1` and `[rp-dialogue] clerk graph v1 ready`; UDP 7777 and TCP 3000 confirmed.
- Review covered all changed/new source, tests and this report. No native WIP is reused. Automated client/DOM fixtures are not proof of E availability or real multiplayer behavior.

## Deployment / rollback

Bundle SHA-256: `78ec2464c0afb00129f773612bcca289e585789646a6be9627db0415f890a11e`.

Reversible backup/record: `build/rp-audit/g22/dialogue-1792695160056/`. Seventy protected world/economy/NPC files were copied and hashed; all originals matched their pre-deployment hashes before startup. Existing server configuration and bundle are preserved. Server restarted in visible PowerShell. Local deployment metadata: `.local/g22/active-deployment.json`. No Launcher release or manual client installation is required.

Rollback: stop this verified test server; use `rollbackDeployment` with its `deployment.json`, then launch the previous visible script. Retain live world/economy/NPC data and the new dialogue directory; do not restore stale player data merely to roll back code. Existing startup scripts still read the current server-settings.json.

Source branch is develop; push target is authorized fork `frostveil` (`kaktv2016/skymp`). No push to SkyMP upstream and no force push.

## One owner acceptance sequence

1. Reconnect using the existing Launcher. Aim at the existing registered Clerk within 256 units and press E (or the configured Activate key). Verify private Thai text and choice panel; NPC still idles normally.
2. Use mouse and Up/Down/Enter/Tab. View contracts, rank and permit catalogue. At the original pickup area, accept an eligible route; confirm existing map/compass/amber navigation and normal `/job status`.
3. Attempt a locked contract and ineligible/owned permit; verify the normal rejection and unchanged wallet. For an eligible permit, verify exactly one purchase, then retry to confirm no duplicate charge.
4. ESC while idle and while awaiting a response; confirm normal movement, F7 chat, Thai typing and ESC/F7 reopen remain correct. Reopen dialogue, walk away/change cell/reconnect, verify cancellation and no stale panel/choice.
5. With admin disable/delete the Clerk during conversation, verify close; restore it and reopen. With two real clients, verify one player's choices/focus/purchases never affect the other's conversation. Restart the server and verify Clerk/graph/world/economy persistence.

No in-game E or real two-client success claimed. No G2.3, RaceMenu, dialogue editor, new quests or appearance/equipment features started.

## Dialogue cursor follow-up

Owner requested a smaller custom cursor because the native Skyrim cursor appears scaled and clicks can target unexpected controls. Installed TPInputService forwards window-client mouse coordinates to CEF. The dialogue now draws an original 28x36 gold SVG at CEF mouse clientX/clientY, with the visible tip anchored to the actual pointer and pointer-events:none. Scoped cursor:none prevents the browser cursor from overlapping. Gold hover/focus highlighting exposes the actual button hit target. No synthetic clicks or independent coordinate conversion is introduced.

Native cursor rendering is hidden only while dialogue owns focus: installed Ui.getBool/setBool target Cursor Menu `_root._visible`; drawing is enabled only after false readback. The prior root visibility is restored in update context before releasing focus. If the root/API cannot be hidden, the native cursor remains the fallback. No global CursorMenu asset, native code, installed player file or Launcher change. Actual GFx root path behavior, DPI/resolution alignment and appearance require owner gameplay confirmation.

Build/typechecks and 309/309 regressions pass, including owned-root hide/restore, deferred focus release, no repeated per-frame CEF redraw, and existing keyboard/ESC/Unicode/cancellation tests. Deployed bundle `4b91eff0e1210793b348b581520c2b8b169ea5e1fe095b82018207b174d9c9ab`; reversible backup `build/rp-audit/g22/dialogue-1792730667446/`, 74 protected files unchanged before startup. Server restarted in visible PowerShell. Owner retest: reconnect, E on Clerk, move over each choice and confirm tip/hover/click alignment, ESC restores Skyrim cursor; verify F7 and map/inventory cursor afterward. Repeat at the owner's current resolution/window mode; no in-game cursor success claimed yet.

### Owner cursor retest: duplicate Skyrim cursor
Owner screenshot shows the gold pointer and native Skyrim pointer together, invalidating the earlier root-visibility approach despite readback success. Inspected `FridaHooks.cpp::OnRenderCursorMenuEnter`: installed source targets `_root.mc_Cursor._alpha` for the actual native cursor. Changed owned visibility lease to `_root.mc_Cursor._visible` (including restoration), instead of `_root._visible`. This targets the identified cursor clip without competing with the render hook's alpha updates. The fixture now checks the exact native clip path, failed against the previous implementation, then passed with the correction. Build/typechecks and 309/309 tests pass. Actual native clip rendering remains owner verification pending.

Deployed `188b0e295f287d25e8b8e870855cb5301ad3223566bcc1ceabcfc4586e2d330e`; rollback backup `build/rp-audit/g22/dialogue-1792731588866/`; 76 protected files unchanged before startup. Visible server restarted; no Launcher/client installation edits. Reconnect and verify one gold cursor in dialogue, correct hover/click alignment and restored Skyrim cursor after ESC/map/inventory.

## Cursor investigation: confirmed second renderer (2026-10-23)

Owner confirms both GFx visibility attempts failed. Source evidence: `skyrim-platform/src/tilted/ui/DX11RenderHandler.cpp` Render draws `m_pCursorTexture` whenever Visible and ChromeFocus, at (cursorX-24,cursorY-25) with width/1920 scaling. Create loads the embedded assets/cursor.png unconditionally after external texture loading. This is independent of the Cursor Menu hidden by FridaHooks. Thus GFx false readback was not proof of hiding the displayed pointer. Installed Browser interface exposes no renderer cursor visibility control.

Removed the ineffective GFx visibility lease and automatic gold-pointer activation; hover/focus styling remains. Gold SVG is dormant, preserving the design for a future explicit renderer API. Regression reproduces legacy Ui get/set availability and asserts no GFx writes or duplicate custom-pointer activation. This is a duplicate-cursor mitigation, NOT completion of the requested custom cursor or DPI alignment. Full custom support needs a scoped native browser visibility API and verified signed native client delivery; G2.2 explicitly excludes Native C++ changes. No installed player files edited. In-game confirmation pending.

## Authorized native cursor integration (2026-10-23)

Owner explicitly authorized the narrow Native C++ exception. Added optional Tilted browser setCursorVisible/isCursorVisible methods, backed by atomic bool read in DX11RenderHandler::Render. Default true preserves existing clients; other browser backends do not advertise these methods. Dialogue feature-detects both methods, confirms false readback, enables the original gold SVG, and restores prior visibility in update context under an owned lease before releasing browser focus. Existing GFx cursor hiding is supplied by the native render hook. No cursor texture replacement, game input rescaling, or arbitrary native memory patch.

Release build of skyrim_platform succeeded. DLL SHA256 18b530ef76a5b84d6da090b5e9c87f7e93b436e02104b48aa1602a8b26d6e30a (15668224 bytes); PE dependencies libcef/libnode match the distributed runtime. RP build/typechecks and 311 tests pass, including older-client fallback and restoring an already hidden cursor through loading/disposal. Launcher 0.1.22 pins recipe 1.0.17, changing only SkyrimPlatformImpl.dll and preserving 648 entries. Synthetic Play fixtures verify old/missing/corrupt DLL backup/repair, repeat Play idempotence, and running-game refusal. R2 immutable objects are downloaded anonymously and hashes verified. Installed player files are never manually written.

Owner acceptance pending: close Skyrim, update Launcher to 0.1.22, Play, approach Clerk and press E. Verify only gold pointer, hover/click alignment, multiple choices, ESC restores normal game and inventory cursor; reopen dialogue and repeat after reconnect. Check 1080p/current ultrawide resolution. Native loading and real rendering cannot be certified by automated fixtures alone.
