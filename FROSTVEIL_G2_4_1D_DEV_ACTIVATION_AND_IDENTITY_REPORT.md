# Frostveil G2.4.1D — development activation and identity

**2026-10-28 evidence update:** Owner activation, real Skyrim identity/mapper arm, two-NPC rendering and retained NPCs after isolated restart are now observed/owner-confirmed. The original preparation-time statuses below are historical. See `FROSTVEIL_G2_4_2_SINGLE_CLIENT_VISUAL_REPORT.md` for current results, the safely recovered stale PID writer leases, and the unexplained prior native exit. Detailed visual, streaming and reconnect acceptance is not inferred from structural tests.

Date: 2026-10-27. **Implementation and isolated artifacts are prepared; actual activation and Skyrim proof remain owner actions.** No custom actor has been created in the real native test environment. This is not production or visual acceptance.

| Status | Result |
|---|---|
| PLUGIN_IDENTITY_MAPPING | VERIFIED_CODE — narrowly scoped, runtime acceptance pending |
| ACTUAL_CLIENT_IDENTITY | PENDING_OWNER |
| DEVELOPMENT_ASSET_PROFILE | PENDING_OWNER_ACTION |
| RESOURCE_INTEGRITY | PASS for the exact development fixture policy; full renderer certification is excluded |
| DEVELOPMENT_CATALOG | DISABLED pending deliberate profile activation and authorized runtime proof/mapper arm |
| ISOLATED_SERVER | NOT_STARTED — inactive-profile startup guard verified |
| SINGLE_CLIENT_VISUAL | NOT_READY until owner activation; then pending the real visual test |
| MULTICLIENT_VISUAL | DEFERRED |
| PRODUCTION_PROMOTION | NOT_AUTHORIZED |

## Baseline and actual identity gap

SkyMP baseline: `cad3067d78cc4aedfbb4696e81b10c9909e4ef44`, following the verified G2.4.1C report. Launcher baseline: `42b3a60b40b38de8900f6d8a307483a9bd7f5b40`, source version **0.1.26**. Installed Skyrim AE 1.6.1170, SKSE 2.2.6 and custom Platform 2.9.0 remain unchanged. No installed JS/DLL replacement or public Launcher/modpack release was required.

Installed activation metadata remains as recorded in C: Courier Navigation full index **9**; `FrostveilNPCTest.esp` is present but **inactive**. The prepared isolated native order is the five official masters, Navigation at **5**, NPC test at **6**. Neither the old metadata observation nor the planned appended plugin position is claimed as actual Skyrim `GetModName` proof.

| Reference path | Source / wire representation | Existing client behavior | Correction / boundary |
|---|---|---|---|
| Template → native NPC | Plugin-qualified `5901` / `5906:FrostveilNPCTest.esp` → native global ID | Catalog resolves against actual server plugin facts | Keep registry UUID/baseDesc and native catalog identity; no mutation of baseDesc |
| Native → CreateActor | `PartOne.cpp` sends `GetBaseId()` as numeric `baseId`; plugin qualification is lost here | RemoteServer copies it into FormModel; FormView calls `Game.getFormEx` | Versioned owner spec resolves only the two approved static NPC bases before WorldView |
| Dynamic actor identity | Native `0xFF` reference and network actor identity | Existing ID manager / WorldView mapping | Never convert or offset it |
| Fixed outfit | NPC's DOFT and OTFT references in the owned ESP | Skyrim resolves linked outfit records from the loaded defining plugin | Preserve fixed outfits; no equipment setter |
| Headparts, items and cells | Existing synchronized numeric static references | Existing client APIs | Require the five official master indices to match; no generalized remapping |
| Navigation | Existing plugin-qualified quest integration | Existing `getFormFromFile` navigation path | Probe Navigation filename/index/content, preserve working navigation behavior |
| Other plugin worlds/cells | Not covered by this extension | Could require wider protocol changes | Reject custom fixture create/move into non-official worlds/cells |

## Selected strategy and client mechanism

Selected **Strategy B**, scoped to the two approved NPC base identities. Strategy A would require reconciling Creation Club masters, USSEP and visual-plugin dependencies on the server or disturbing the owner's normal order. No unrelated plugin was copied to the server, disabled or reordered.

This implementation uses existing gamemode properties/event sources rather than changing installed client JS or the wire protocol globally. `GamemodeUpdateService` runs owner update functions on **every update**, before WorldView. Both repository source and the actual pinned installed bundle contain that ordering and the shared `storage.worldModel` transport. Installed JS SHA-256 remains `67cec3774049606e635af3f4b6c84abe87a24ddc53d7392db9badb60a9fb69e6`.

The client probes only declared plugin/local identities using installed `Game.getModByName`, `Game.getModName`, `Game.getFormFromFile`, `ActorBase.from`, `Form.getType/getFormID` and `getFileInfo`. Type declarations and native `FileInfoApi` source were inspected: file info accepts a basename and reads under Data, returning signed CRC32 and size. The diagnostic therefore collects plugin CRC/size; full SHA-256 is pinned by the local Launcher profile and server. It does not claim cryptographic attestation of a potentially modified client process. Reliable runtime EditorID access was not found; client output explicitly records `UNAVAILABLE_API`, while native record/catalog validation preserves the expected EditorIDs.

The protocol is version 1 and binds a nonce to the actual server actor/session, server-confirmed principal, catalog and profile hash. Wrong sender/session/nonce, replay, changed plugin observations, wrong type/local ID, missing plugin and FE/light indices fail. Pending requests coalesce and new probes are rate limited. The server verifies the report, then waits for a separate client **mapper armed** acknowledgement before allowing fixture creation/visibility. Disconnect/reconnect, revocation and stop clear readiness. Restored custom actors are parked synchronously before asynchronous module boot can yield to login ticks; the legacy Clerk remains outside that visibility gate.

The mapper changes only the two exact server bases declared by the authoritative spec and validates catalog tags whenever present. Native `place()` can subscribe at its initial origin before publishing custom properties, so the initial untagged packet for either declared base is handled too. No fixed server-to-client offset is used. Invalid fixture models are removed before rendering, never sent through a fallback ActorBase. Late streaming is tested with an unchanged owner property. A faulted nonce cannot re-arm from a repeated verified value. Native public-property transport requires **both** visibility flags; the new NPC tag follows that engine contract.

## Local development asset profile

Implemented in the existing Launcher repository as a dedicated owner CLI and configuration-only local reference operation. It is **not a general unsigned installer**, remote download feature or public release path. It reuses Launcher plugin planning/header checks, fixed hashes, registered root identities, authenticated MetadataStore, single-writer leases, durable writes, process checks and GameLauncher/SKSE startup.

- References the existing five owned runtime files; installs/copies none of them.
- Pins those five SHA-256/size values, the C catalog revision and nine known installed runtime files.
- Preserves existing plugin precedence, masters and unrelated lines; activates only the test ESP.
- Changes exactly `plugins.txt` and the selected client's `skymp5-client-settings.txt` endpoint to localhost:17777. Existing credentials are never silently erased.
- Requires a real terminal and explicit `CONFIRM`; there is no `--yes`, renderer IPC or remote activation endpoint.
- Keeps original two-file bytes in authenticated private metadata. Revert checks for later owner edits, skips untouched files and restores exact bytes. Closed-game partial failures roll back; if the game starts or a conflict prevents recovery, the bounded journal is retained and writes stop.
- Does not modify production trust, updater keys, public manifests, installed Launcher binaries, native DLLs or the client JS pin.

Profile hash: `634a433c9a6a9c5ce81a2324ab473c5c8a1594651cbdb8cb4349981670d4d1de`. Source catalog hash: `1e2e2eca7cf0179650508b2790f11fd570c51d5042d1710a5cebaad9eb7ade77`. The original five asset hashes are unchanged from C. The local route avoids pretending an updater key authorizes a new asset release; it creates no new distribution signer. Private HMAC metadata remains under the Launcher's ignored `.local/npc-development` directory, not Git or HTTP resources.

Actual `prepare` ran successfully on the selected installation without changing either installed configuration target. The module's fixture tests cover activation/revert/idempotency, declined authorization, changed assets, tampered plans/metadata, later owner edits, running-process races and partial-write recovery.

## Development resource policy and isolated delivery

Production validation remains strict. The separate D policy applies only to the exact C five-file revision/catalog in the verified isolated root. It rechecks asset hashes and supported NIF scene/skin/shader references, DDS payload format, required paths and loose overrides. The real native dependency graph remains **85 records**, without dependency errors. All **109** inspected resource paths were available; **11** archive content hashes matched the reviewed C evidence. Changed archive identity/stamps require preparation again.

Remaining FaceTint fallback, seams and unparsed renderer/vertex-weight behavior are explicitly deferred for this one controlled visual test; no demonstrated integrity failure is waived. Missing headparts/armor/FaceGen, hard resource errors, stale catalog/hash and non-isolated use remain fatal. Neither original NIF was rewritten. No TGA or placeholder was installed.

Existing root reused: `build/rp-audit/g241/dev-7FNiLN`; stage reused: `staging-7RaVpv`, **2,570,478 bytes**. It has separate world, registry, admin and dialogue state. D limits the actual server to **one client**. A small code/config backup is retained at `build/rp-audit/g241d/code-before`; no full game/world copy was made.

Prepared code/config is deployed only into this disabled isolated environment. Twelve runtime/resource artifacts, including the native addon and actual server entry, and the startup/configuration handoff are sealed. Ports are checked before preparing/sealing/starting. After owner activation, `activate-and-play` starts visible PowerShell, waits for private-profile validation plus `/g241d-health.json`, verifies the owned node process ancestry and UDP17777/TCP17778 ownership, then uses the existing SKSE launcher. Startup failures stop only that newly created process tree and revert configuration when the game is closed. Fatal D startup errors exit rather than leaving an appearance-enabled partial runtime.

The server is **not currently running**: the inactive-profile guard was exercised and rejected startup before creating a process. This is the deliberate boundary requested in D4: "Require deliberate activation" and do not assume consent to alter the installed profile. There is no signing-configuration research blocker left for the selected local route. The owner command below performs that concrete one-time operation; runtime proof is captured only after the client connects, avoiding a proof-before-connect deadlock.

## Verification and protected state

| Check | Result |
|---|---|
| RP build/typecheck/full regression | **395/395** |
| Real asset/resource policy tests | **13/13** |
| Blueprint Studio tests, typecheck and build | **80/80**, passed |
| Client/source regressions and typecheck | **58/58**, passed |
| Native ESM parser/runtime suite | **84/84**, 475,228 assertions; seed 1292818940 |
| Launcher activation/trust/schema/installer/local-profile tests | **154/154**, typecheck passed |
| Actual pinned addon RP/NPC/Dialogue module boot and stop | Passed; unauthorized creation rejected; **0 custom actors created** |
| Actual local profile preparation / inactive startup rejection | Passed; no installed profile change |

The native module probe intentionally denies authorization; it is not an actual owner activation or Skyrim proof. One Editor timeout under parallel load passed in isolation and then the complete unchanged 80-test suite passed. Native `Activate torch` hit the existing short reloot timing race under parallel load; focused and full suites passed with the **same seed** when run alone. No timeout was increased, engine code patched or final suite skipped. Complete diagnostics are retained under `build/rp-audit/g241d`, including the failed runs.

The independent review's late-stream concern was resolved against actual owner-update semantics and a regression that inserts a fixture after arm without changing the owner property. Its fault/re-arm concern was reproduced and fixed. Root cause found during the transport audit—initial `place()` subscription and owner visibility filtering—has separate regression coverage. The runtime proof is explicitly described as an authorized local diagnostic, not anti-cheat attestation.

Protected live configuration/world/economy/NPC/dialogue/Blueprint manifest before/after SHA-256: `5edaa20a730ce79b34675b06224bd2a47ebfb4b116cef5af15296f10677d6616`. All **7** owner source files including TGAs and all **9** pinned installed runtime files remain unchanged. The normal client endpoint is still **7777**, and the test ESP is still inactive. Production 7777/3000 were not restarted or modified. No actual game GUI was operated.

## Git and owner acceptance

Code pushed to authorized development repositories:

- SkyMP: `e20138f12ae712ea68176de76dead98607428f89` → `frostveil/dev/npc-activation-g241d`.
- Launcher: `968caaddc381aaacd701eebbc50f22b5dc51a997`, recovery fix `f0226d8164c1de7e2cd24239d53eec0fec1064ba` and runtime seal `d977de552ac1e91b0c5514be812daa03a3f6f1d4` → owner repository `origin/dev/npc-local-activation-g241d`.

This report and final deployed-runtime hash pinning follow on the same branch. No force-push, upstream SkyMP push, production release or unrelated WIP merge was performed.

With Skyrim closed, run in your own terminal:

```powershell
$npcDev='C:\Users\basba\OneDrive\Desktop\skyrim-rp\skyrim-rp-launcher\scripts\npc-development.mjs'
node $npcDev activate-and-play
```

Read the exact two-file plan and type `CONFIRM`. The tool activates the local profile, starts only the isolated server in visible PowerShell, checks it, then opens SKSE. Connect to localhost:17777. Normal public Launcher Play is not the development profile entry.

Once connected, in that same terminal run `node $npcDev grant`, inspect the single observed actor/session and type `GRANT`. This calls the existing local admin tool with a reviewed boot/session-nonce precondition; it does not infer privilege from a character name, connection number or profile ID. If no session is observed yet, use `/npc help` once and retry. Then in Skyrim:

```text
/npc identity
/npc identity status
/npc templates
/npc fixture create
/npc fixture list
```

Wait for the verified/armed message before fixture create. Capture the actual plugin indices, resolved type/IDs and names from the server log. Expected NPCs: female Nord clerk in Warlock robes/boots, male Imperial warrior in Imperial Light armor. Inspect faces/tints/seams, hair/eyes/body, outfit, missing meshes and idle. Walk away/return and reconnect; obtain a fresh isolated grant/proof after reconnect. Record the two UUIDs, restart **only** the isolated server, then recheck appearance/UUIDs/no duplicates. Close Skyrim before changing/reverting profiles; the prepared `start-g241d-visible.ps1` reopens the same isolated server, never production.

Finish with `/npc fixture cleanup`. After closing Skyrim and stopping the isolated server, run `node $npcDev revert` and confirm exact restoration before returning to normal Launcher Play. Revert preserves owner-authored assets and refuses unrelated later edits. If pinned runtime files have changed due to another update, stop and revalidate the local workflow rather than manually overwriting configuration.

Actual client API results, single-client rendering and the complete real launch/restart flow remain owner acceptance. Two-client validation is deferred. No G2.4.2, RaceMenu, public asset distribution or production promotion was begun.
