# Frostveil G2.1 — NPC Foundation & Admin Management

Date: 2026-10-23. Implemented and deployed to the existing loopback test server. Gameplay acceptance remains pending owner testing.

## Audit and evidence

- Active server configuration retains `npcEnabled:false` and empty `npcSettings`.
- `WorldCleanerService.processOneActor()` samples actors within 8192 units and disables unprotected living actors. Registered streamed actors receive `modWcProtection(...,1)` in `FormView`. This confirms the mechanism that can make distant vanilla actors disappear when approached; no particular animal/NPC from an owner session was identified. The latest available Skyrim Platform log did not contain a per-actor cleanup trace. Its missing PluginsDev directory message explicitly says Skyrim Platform continues working.
- No vanilla records, cleanup policy, native code, client installation, Launcher or modpack were changed. Unverified Papyrus allocator work remains isolated on its pre-existing WIP branch; this feature is based on `develop`.
- Installed `scam_native.node` was exercised in a disposable instance without attaching real world storage. `lookupEspmRecordById` resolved Courier reference `39fb7` to base `39f83:Skyrim.esm`, verified as `NPC_`. `place`, private metadata, `setEnabled`, `locationalData`, `baseDesc` and `getAllForms(255)` were called successfully. Source signatures match installed runtime behavior.
- Installed Skyrim Platform declarations expose `ObjectReference.setDisplayName(string,boolean)`. Existing gamemode `updateNeighbor` executes against a currently resolved reference; the label handler uses it synchronously and retains no wrapper across asynchronous boundaries.

## Implementation

- Added `rp-gamemode/src/modules/npc/npc-service.ts`: UUID registry, validated clerk template, authored worldspace/cell and XYZ/rotation, display name, enabled/soft-deleted state and reserved null appearance/equipment/dialogue profile references.
- One native server actor and tagged identity per definition; all relevant neighbors use normal SkyMP streaming. No owner-local stand-in, client polling or per-player actor duplication.
- Registry uses the existing checksummed/fsynced journal implementation in a separate `rp-npcs` directory, never the economy directory. Exclusive writer lease, bounded entries (64 including tombstones), native identity validation and no append for unchanged definitions. The existing committed-prefix recovery handles incomplete append records.
- Creation first commits a provisioning reservation, then binds the native form ID. If provisioning is interrupted or an identity does not match, NPC management fails closed rather than automatically spawning duplicates. Existing unrelated modules continue running.
- Startup restores authored transforms, labels and enabled states on the same tagged native actor. Soft deletion disables the actor without deleting vanilla data or freeing/reusing another actor's identity. Tombstones intentionally count toward the limit.
- Added all requested `/npc` commands through the existing command registry, chat replies and autocomplete. Hints are restricted to authorized admins; every operation rechecks the existing account/session authority. Selection is session-bound, limited to registered actors within 256 units, favors the forward cone, and rejects ambiguous candidates. Hidden/deleted NPCs can be selected near their authored anchor for restore. Selection is pruned on loss of authority/session.
- `rotate` accepts absolute degrees, normalized to 0–360; `rename` accepts Unicode with length/control-character validation. No arbitrary template IDs, native calls, console execution, player mutations or economy transactions are exposed.
- Integrated only the NPC option/module in `runtime.ts`/`index.ts` and command transport handling/filtering in `chat-service.ts`.

## Verification

- RP build/typechecks and complete regression suite: **281/281 passed**, including seven NPC tests: CRUD transforms, authorization, malformed input, session isolation, cell/proximity selection, restart, interrupted provisioning, native identity mismatch and restore after soft deletion/restart.
- Existing client Spawn Recovery, spawn location, interior/remote resume and NPC retirement suites: **47/47 passed**.
- Disposable native storage test ran two separate processes against an isolated fixture: first created one actor; second loaded the same definition and native actor after restart. Dynamic form count remained **1**, with matching identity and enabled state. Diagnostic files are retained under ignored `.local/g21/`.
- Source diffs reviewed; whitespace check passed. No installed client change or distribution update was required. Name rendering, visual stability, cell streaming and simultaneous visibility still require real Skyrim clients; simulation/native storage tests alone do not establish gameplay acceptance.

## Deployment and rollback

- Bundle SHA-256: `4a65bf05a4c3faf2255d5d6c344b8d2036583f276d59744bc48f92ea22193092`.
- Local evidence/backup: `build/rp-audit/g21/deploy-1792688865334/`; contains prior config/bundle, protected-data copies/manifests, visible startup script and console log. Additional deployment metadata: `.local/g21/active-deployment.json`.
- Restarted the verified loopback Node server in visible PowerShell. UDP 7777 and resource listener 3000 are available; log reports `[rp-npc] ready definitions=0`. No test NPC was injected into the actual world automatically.
- All **60** protected world/economy files match pre-deployment hashes; backup copies also match. World/player/economy data were not reset or migrated.
- Rollback: stop this test server, restore `server-settings-before.json` as `server-settings.json`, and launch the previous visible startup script. Retain `rp-npcs` and any newly authored NPC data; do not overwrite world/economy data with backups merely to roll back code. The backup copies are for explicit recovery if needed.
- Source is committed on local `develop`. Configured upstream previously rejects writes for the current account (HTTP 403); no authorized fork is configured. Push is attempted without force; final response records its result.

## Exact owner gameplay acceptance

1. Enter through the existing Launcher. Obtain the normal session-bound owner grant (restart clears old grants). Server operator uses `node rp-gamemode/scripts/admin-local.cjs build/dist/server/rp-admin list`, then `grant <verified-actor-hex> owner` with the same directory argument. Never grant an unverified session.
2. `/npc help` → `/npc create clerk`; step away, face the clerk, `/npc select` → `/npc info` → `/npc rename Guild Clerk` → `/npc rotate 90`.
3. Move a few steps, `/npc move here`; step aside and verify position/name/rotation. `/npc disable` → `/npc enable` → `/npc delete` → `/npc restore`. Confirm only one actor appears.
4. Leave/reenter the cell, reconnect, regrant admin, `/npc select` → `/npc info`. Restart the test server, reconnect/regrant and repeat; verify the same registry ID and exactly one actor. For hidden NPC restore, stand near its saved anchor before selecting.
5. With a second actual client nearby, verify both see the same actor and changes. Verify a non-admin cannot mutate/select and has no NPC autocomplete. Repeat in an interior, then verify normal spawn, Courier/compass, discoveries and wallet remain intact.

## Remaining limits

No dialogue, guild quests, advanced AI, equipment editor, RaceMenu or GUI. Clerk uses the existing Courier base as a foundation; in-game behavior/appearance and collision remain owner verification items. Registry corruption, missing native actors or interrupted provisioning intentionally require operator diagnosis, with no automatic respawn that might duplicate an actor. Journal capacity is bounded by the existing 16 MiB storage limit and fails closed when exhausted. No real two-client gameplay test was available during implementation. G2.2 was not started.

## Owner feedback: pose correction (2026-10-23)

Owner confirmed checks 1 and 3 passed, but rename caused spinning, rotate returned to the original yaw, and move returned toward the old anchor until delete/restore.

Evidence: `NpcService.apply` unconditionally teleported on every mutation, including rename and visibility. The clerk inherited the Courier NPC's native AI, while `FormView.applyAll`/`movementApply` retained old movement and `keepOffsetFromActor` steering. The registry itself saved the new anchor correctly, as confirmed by the owner's delete/restore result. Player camera pitch was also copied into NPC rotation.

Correction: metadata/visibility edits no longer teleport. Create/move normalize actor pitch and roll. An owner-independent neighbor property publishes the registry anchor to every streamed copy, disables AI only for registered stationary clerks, clears stale offset steering, synchronizes the existing movement model to Standing at the saved pose, and corrects actual pose drift in update context using installed `TESModPlatform.moveRefrToPosition`. It resolves references on each update and skips unloaded/deleted/wrong-cell actors. No asynchronous native wrappers or generic NPC cleanup changes. This intentionally establishes a stationary clerk; roaming AI remains outside G2.1.

Verification: failing tests reproduced unwanted rename teleports and copied pitch before the fix. Build/typechecks and all 284 regression tests pass afterward (including 10 NPC tests). Neighbor fixture exercises stale movement, yaw correction, unloaded/wrong-cell guards, reference replacement and no repeated relocation at a stable pose. Installed native fixture restart reports one existing actor and registry ready; no duplicate is created. Actual multi-client/gameplay correction remains owner verification pending.

Deployed bundle SHA-256: `3b001a313fe7f33a9ecd4bfeee8693ebe9380e4ca9fb3b136de0d6e7f4e2bf9c`. Backup and rollback record: `build/rp-audit/g21/pose-fix-1792691879011/`. All 63 world/economy/NPC files match their pre-deployment hashes before startup. Server restarted in visible PowerShell, UDP 7777/resource port 3000 confirmed, `[rp-npc] ready definitions=1`. No installed player, Launcher or modpack files changed. Session admin grants expire on this restart as designed.

Owner retest: reconnect, obtain a fresh owner grant, `/npc select`, rename, rotate 90 then 180, move to B and step away for 15 seconds. Verify no spinning/return to A. Disable/enable and delete/restore; reconnect and verify one NPC at B. Repeat with a second client when available.

### Follow-up: SkyMP neighbor visibility gate

Owner retest still returned to create-position and ignored rotate. Previous correction was not sufficient: `PartOne.cpp` lines 524–534 and 832–840 require `isVisibleByOwner && isVisibleByNeighbors` for neighbor sources and payloads. Setting owner=false prevented BOTH NPC name and pose properties from reaching any neighbor; the former tests called the updater directly and missed the engine's delivery filter. This is the confirmed delivery gap, rather than evidence that the saved registry anchor was lost.

Set both flags true for NPC name/pose, keeping owner updater empty. These are only attached to registered NPCs and contain public name/pose, not player/account data. Regression first failed on the old flags, then all 285 tests and typechecks/build passed. Installed native fixture restart still restores exactly one NPC. Diff reviewed; no client binary/Launcher update is required because native server signs and transmits gamemode source using the established mechanism.

Deployed SHA-256 `65d26356737f17f09f986d97b3725b42b4a71abdcff76b419acf72c7ccbe4c21`; reversible backup `build/rp-audit/g21/pose-fix-1792692854896/`. All 65 protected world/economy/registry files unchanged by deployment before startup. Visible PowerShell restarted; NPC registry ready with one definition and resource port 3000. Owner must reconnect to receive neighbor sources, regrant admin, select existing NPC, rotate 80/180, move to B and wait, then reconnect and confirm B/yaw. Gameplay success remains pending owner confirmation; previous owner results explicitly invalidate the prior claim of functional pose correction.
