# G2.4.5 — NPC asset intake and development catalog pipeline

2026-10-30. Implementation ledger; not a production release or rendering certificate.

Plan: extend existing ESP/native adapters; reuse NIF/DDS/resource validation; canonical immutable manifests and confined staging; isolated revisioned EconomyJournal; authenticated Asset Library in the existing NPC UI. Preserve playable catalog/mapper/actors. Test real exports, negative fixtures, relevant suites/browser; back up/seal/deploy only to the existing idle isolated environment; verify protected data and push authorized branches.

No new dependency, plugin writer, CK/Skyrim GUI automation, automatic activation, production signer or public distribution. Unsupported light/master/override inputs fail closed. Development intake approval never implies spawn/render proof. Terrain jitter remains deferred and native0xC0000005 unresolved.

## Architecture audit and compatibility research

Baseline SkyMP **fb3bfd69**, branch `dev/npc-activation-g241d`; Launcher source0.1.26 on `dev/npc-local-activation-g241d`. G2.4.1B/C, D, G2.4.2, protection, G2.4.4 appendices and latest terrain report were read. Existing parser/catalog, approved five-file source policy, native qualified record adapter, resource evidence, authenticated loopback React listener and journal storage are reused. No second actor database or replacement editor was introduced.

Installed CreationKit.exe reports **1.7.99.0** by read-only file metadata. It was not launched, updated or certified against newly exported files. Existing owner-authored exports are the real compatibility fixture: SSE20.2.0.7/BS100 NIF, RGBA8 FaceTint DDS and full ESP with compressed NPC records. The importer now handles those compressed fields with Node's bounded zlib decoder; no plugin writer is included. Keep the owner's known authoring environment until an export has passed inspection; a newer tool release is not automatically compatible.

Research sources: [xEdit primary release notes](https://github.com/TES5Edit/TES5Edit/releases) distinguish current/experimental releases and game-specific namespace changes; xEdit is optional audited inspection, not installed/invoked here. [BodySlide/Outfit Studio primary wiki](https://github.com/ousnius/BodySlide-and-Outfit-Studio/wiki) describes mesh/outfit editing, not a replacement for NPC_ records/FaceGen; it is optional and was not installed. [FaceGen export workflow from its mod author](https://www.nexusmods.com/skyrimspecialedition/articles/1647) documents selecting actors and Ctrl+F4. The CK community wiki request returned403, so no inaccessible content is claimed verified. The actual installed CK workflow/new export remains owner-operated acceptance.

Creation Kit is still needed for artistic face authoring, creating the unique NPC_ and owned OTFT, assigning outfit/inventory and exporting FaceGen. RaceMenu presets may be artistic inputs through the owner's authoring workflow; they are not imported as runtime NPC records. No RaceMenu/BodySlide/CBBE/3BA dependency was added to the current two vanilla-based templates.

## Importer, discovery and resource envelope

`rp-gamemode/scripts/g245-assets.cjs` implements the reusable intake service. `scripts/npc-assets.cjs` registers a reviewed local project root; optional `--choose-folder` opens a Windows folder picker **only when the owner invokes it**. The picker was not opened by automation. The browser selects registered source IDs, never paths/URLs/uploads. Default source is the existing verified staged FrostveilNPCTest package, so no new assets are needed to test.

Supported first subset: newly owned NPC_/OTFT records in non-master full plugins, using the current reviewed vanilla head/body/outfit dependency envelope. TES4 flags, masters, defining record namespace, duplicate IDs, compression, field bounds, scripts/inheritance/factions/spells/AI and tombstones are checked. Full/light status comes from flags, not extension; master/light, ambiguous case aliases and unsupported format/overrides are blocked, not remapped. The pinned catalog's qualified identity grammar supports full ESP/ESM names; ESL/light intake is not approved. Exact old reviewed empty NPC tombstones remain classified warnings; unreviewed/deceptive deletions fail. Current reviewed tombstone provenance comes from the hash-approved g241 catalog, not a browser assertion.

NPC metadata automatically includes EditorID/FULL, plugin-local identity, masters, race/sex/unique flag/height, headparts, fixed outfit/armor slots, authored inventory and WEAP entries separately. IDs for new intake templates derive from the qualified form identity, not a global load-order index. Existing identities reuse their approved template IDs. New owned OTFT IDs may share the already reviewed external armor-item footprint; no server template implementation is needed to describe that new authored configuration. Actual unprovided new assets are not invented or added to the live catalog.

FaceGeom/FaceTint paths derive automatically from defining plugin plus zero-padded local ID. Existing NIF structure and DDS validators are reused. FaceGeom scene/skin reference bounds, shader texture paths, source hashes/sizes, complete current FaceTint RGBA8 payload and known resource evidence are checked. Native FTST/WNAM references are resolved and must match a reviewed existing dependency, otherwise blocked. Unknown skin/hair/body/armor/weapon closure is **BLOCKED_DEPENDENCY**, not PASS. The narrow NIF parser does not prove skin weights, arbitrary block inheritance, archived NIF semantics or engine FaceTint fallbacks. Existing renderer uncertainties remain RENDER_TEST_REQUIRED.

Outfit ownership must match the defining plugin for current catalog compatibility; actual ARMO entries/slot masks are resolved, overlaps/missing slots fail. Authored weapons/inventory are inspected but do not permit dynamic equipment assignment. Additional unreviewed armor, weapon or third-party resource footprints need independent complete closure evidence. Required shader references are discovered automatically; unknown resources do not become approved merely because an installed mod supplies them. Explicit reviewed local supplemental resources are allowed only through confined source configuration and supported validators, never arbitrary browser paths.

Optional owner PNG at `previews/owner.png` is discovered during local registration and can be staged as metadata. Its bounded RGB8/RGBA8, non-interlaced chunk CRC/order and inflated scanline stream are validated using the actually checked Node24.11.1 zlib API. It is not displayed as a fake NPC thumbnail or rendering certificate. Other preview formats are unsupported; without a proven preview the UI says Preview unavailable.

## Deterministic manifests and immutable packages

Canonical serialization sorts object keys and resource/graph identities without locale-dependent ordering. Audit timestamps and private root paths are outside the portable manifest. Metadata contains schema/catalog compatibility, content-based package revision, plugin/master hashes, qualified NPCs, FaceGen pairs, outfit/weapons, dependency graph, source provenance, required runtime versions, validation and pending-render/trust state. `catalogDraft` uses the existing catalog schema/hash convention; it is a **proposal**, not an approved spawning catalog or substitute resource verifier.

Snapshots contain `manifest.json`, `catalog.json` and only allowlisted referenced source files; official/third-party installed dependencies remain references. Included source files link to the source permission ledger; external plugin records are classified official versus third-party references with NOT_INCLUDED rights. SOURCE means the explicitly reviewed source snapshot, not a claim that arbitrary installed assets are Frostveil-owned. Unknown/forbidden redistribution never becomes public permission. Local operator acceptance is explicitly limited to local development.

Paths reject traversal/absolute paths/drive streams/scripts/executables. Source and destination ancestors reject symlinks/junctions, files reject hardlinks, reads are allocated/bounded and checked for mutation, and each staged directory/file is rechecked before writing. Exclusive writes, fsync, revalidation and final directory rename preserve old snapshots. Existing conflicting snapshot bytes fail rather than overwrite. Interrupted `.pending-*` directories are retained for recovery; at four pending attempts further staging blocks for local review. No source ESP/NIF/DDS is rewritten.

Bounds include16MiB source plugin,1MiB inflated record,64 owned records,512 fields/record,32MiB resource,128 source resources/128MiB snapshot,16 candidate revisions,32 approval records and64 retained audit entries. The existing journal's capacity/record limits also apply. Repeated scans/stages reuse content-addressed output and unchanged stages do not append again. A64-entry parsed-asset cache is keyed by re-read SHA256, not timestamps alone. These are development-tool bounds, not a50–100-player performance certification.

## Approval, versioning, provenance and runtime boundary

Intake records use the existing checksummed/fsynced EconomyJournal in **npc-asset-library/journal**, isolated from registry/player/economy journals. Immutable manifests/snapshots are separate from the compact journal's pointers/history. A single writer lease and optimistic revision check protect concurrent sessions/restart recovery. Old revisions are never silently overwritten or deleted.

Lifecycle: discovery/validation -> REVIEW_REQUIRED (or BLOCKED_IDENTITY/BLOCKED_DEPENDENCY) -> STAGED -> short-lived review -> APPROVED_DEV with RENDER_PENDING. REJECTED and INVALIDATED remain explicit. Review tokens last60s, bind to actual server-verified actor/principal/game session and exact journal revision, and are consumed before approval. Source/dependency/hash or provenance changes invalidate affected rows and clear the active intake pointer. Explicit revalidation can recover an identical restored revision to REVIEW_REQUIRED; it never silently reactivates approval. Rejected/invalidated/blocked revisions cannot be revived through rollback. Approval rollback only restores a previously approved, freshly revalidated immutable **intake pointer**, not live actors/catalogs.

Authentication, authority revocation, session binding, CSRF, Host/Origin and rate limits reuse EditorAuthority/EditorHttpServer. The live runtime also rechecks current authority/session before persistence and snapshot promotion, including after scanning. Audit history contains only operator fingerprints, not LocalAdminAuthority's private nonce-bearing principals. Review credentials are in memory only, never portable manifests/journals/logs. The metadata-only provenance operation cannot change source roots; it records author/source/version/permission/attribution and UNKNOWN/FORBIDDEN/ALLOWED distribution classification, then requires revalidation. No public distribution gate is unlocked by that classification.

The active `NpcTemplateCatalog`, its two entries, exact identity spec and registry assignments remain unchanged. Import/approval invokes **no place/enable/replace actor or equipment setter**. The two existing bases remain selectable as before. A new qualified base can be catalog-intake approved but stays BLOCKED_NEW_IDENTITY/NOT_HOT_LOADED until a separately reviewed client/server profile and mapper proof support it. The current two-base mapper was not generalized, and no new actor/profile was fabricated to pretend the proof passed.

Future delivery must consume reviewed selected templates/source hashes and the existing signed modpack/remoteTrust/Launcher mechanism after rights, profile and render checks. This phase prepares file/hash metadata only: no updater key reused, no new production signer/key generated, no signing bypass, R2 upload, GitHub Release or installed modpack replacement. Production rights and trust remain a separate authorization boundary; `publicPackage()` always rejects.

## Admin Asset Library

The existing authenticated `/npcs` view has an expandable **Asset Library**; `/npc-assets` opens that section directly using the same login. It provides source selection, search, individual/batch NPC selection, metadata/FaceGen/outfit/weapon/resource feedback, provenance editing, immutable staging, explicit Review/Approve/Reject, version history and intake-pointer rollback. Selection is included in the approval identity; changing it requires restaging. New availability and failures are shown accurately; no generic portrait or full3D editor was added. Existing NPC Management and Blueprint workflows remain intact.

Browser QA used the real compiled assets and a private synthetic authority over a copy of the actual validated snapshot, not the owner's live grant. It exercised Clerk-only selection, Stage, Review and Approve, preserving RENDER_PENDING/NOT_HOT_LOADED. Desktop and390px mobile screenshots are under `build/rp-audit/g245/asset-library-{desktop,review,mobile}.png`; no horizontal overflow. An initial selector expected a nonexistent '[TEST]' display suffix; it was corrected against the actual DOM. A favicon404 was the only browser resource error; initial CLI sandbox filesystem attempts were abandoned, not used to bypass owner authorization. Later provenance/PNG/commit-guard changes are covered by automated suites; do not infer a real owner approval from this synthetic browser run.

## Verification and review

| Gate | Result | Evidence under build/rp-audit/g245 |
|---|---|---|
| RP build/typecheck/full regression | PASS445/445, serial file workers, no skips | rp-regressions.log; 121376ms |
| Editor build/full UI regression | PASS87/87,15 files | ui-build.log, ui-regressions.log |
| Client/recovery/resource regression | PASS64/64 | client-assets.log; some resource cases overlap RP |
| Native unchanged full suite | PASS256/256,477180 assertions | native-regressions.log; seed2353133241, fresh private cwd |
| Launcher development trust/start/rejoin | PASS20/20, freshly rebuilt affected TS test | launcher-regressions.log |
| Actual source/addon integration | PASS2 NPCs, five files,13 negative cases, restart and zero auto-spawns | integration.log and integration-RnW4y6/result.json |
| Final intake/CLI/deployment regressions | PASS19/19, no skips | final-tooling-focused.log; includes the final CLI-only registration lock added after the full RP run |

Actual integration resolves the real compressed ESP and four NIF/DDS exports through the actual addon, enumerates both existing NPCs, stages five source files, verifies deterministic content, selected approval/replay/conflict/session checks, journal restart, provenance invalidation, unchanged catalog and **zero actors** in fresh private native test storage. Thirteen negative cases cover missing FaceGen, malformed NIF/truncated DDS, full/light/master mismatch, missing master, unreviewed tombstones, changed approved plugin, hardlinks, compressed-size bomb, duplicate record, case alias and missing resource closure. Unit tests additionally cover canonical hostile values, traversal/scripts, junctions, PNG integrity/stream bounds, staged-manifest tampering, journal writer conflict, stale/expired/foreign-session approvals, rejection/rollback, metadata-only provenance and authority withdrawal before commit with nonce redaction. Gameplay, dialogue/economy, actor registry and terrain tests remain in the RP suite.

Complete failure diagnostics were retained for the early scanner's unsupported compressed-record assumption and overbroad FTST rejection. The fix added bounded decoding and actual reviewed native-reference matching, not a blanket validator bypass. Review found nested staging path and invalidated rollback weaknesses; both were fixed with regressions. Restored identical revisions now require explicit revalidation. No release gate was skipped or timeout enlarged. Native tests do not execute Skyrim rendering/terrain; no real multiplayer success is claimed.

## Owner workflow

**A — existing source, no additional authoring required:**

1. Use the existing development CLI `play`, then `grant` and in-game `/npc identity` / `/npc manage` as before.
2. Open **http://127.0.0.1:13210/npc-assets**, enter the fresh one-time chat grant. Select **existing NPC test** and click **ค้นหาและตรวจสอบ NPC**.
3. Confirm Clerk `5901:FrostveilNPCTest.esp` and Warrior `5906:FrostveilNPCTest.esp`, FaceGen pairs, fixed outfits and UNCHANGED_EXISTING. Select one/both; inspect validation and source provenance.
4. Stage snapshot. Acknowledge local ownership/use and pending render proof -> Review -> Approve development. Confirm APPROVED_DEV / RENDER_PENDING / no hot reload. Inspect version history. No duplicate templates or actors should appear in the existing management catalog.
5. Check Clerk/Warrior/HomHom remain as before: names, identity, outfit, Move/Rotate, passive protection and E. This phase does not retest/repair the deferred slope bug.

**B — future newly authored asset (PENDING_OWNER_ASSET):**

Create a new uniquely authored NPC and owned fixed OTFT in CK, assign the intended compatible vanilla race/headparts/items, keep the unique flag and avoid unsupported scripts/templates/factions/spells/hostile AI. Export FaceGen for the selected actor using the owner's compatible CK workflow, preserving the defining plugin/local-ID file pair. Keep the existing NPC test ESP and exports unchanged. Finished face design/export is an artistic/manual task; the importer cannot manufacture it.

Place the authored source in a reviewed project folder containing `Data/<plugin>` and corresponding Data meshes/textures. Optional preview is `previews/owner.png`. Register once from PowerShell, without hashes or FormID typing:

```powershell
node "C:\Users\basba\OneDrive\Desktop\skyrim-rp\skymp\rp-gamemode\scripts\npc-assets.cjs" register --choose-folder --review-local-source
```

Select the reviewed source folder. For multiple plugins, rerun with the displayed plugin filename before the review flag. A reviewed root path may be supplied instead of `--choose-folder`; the dialog is owner-operated and cancellation writes nothing. Registration does not approve, activate or install anything. In Asset Library select the new source, record provenance, scan, inspect, stage and explicitly approve. New identities remain not spawn-enabled until deliberate client/server plugin activation, exact master/file hashes, qualified FormID/mapper and rendering proofs pass. Do not add a dummy NPC merely to test the importer. After those separate gates permit creation, use the unchanged NPC Management creation workflow and test appearance/equipment, streaming, reconnect and restart.

**C — existing preservation:** all three registry records/UUIDs/dialogue/protection must remain. No import auto-spawn is allowed. Real owner acceptance is pending; automated fixture actors are not multiplayer evidence.

## Status and remaining limitations

| Area | Status | Scope |
|---|---|---|
| ASSET_IMPORTER | PASS | implemented local reviewed-source intake; supported pinned subset |
| NPC_RECORD_DISCOVERY | PASS | actual two authored NPCs; generic qualified full-record discovery |
| FACEGEN_VALIDATION | PARTIAL | structural/integrity checks pass; renderer/skin semantics remain pending |
| OUTFIT_VALIDATION | PARTIAL | owned OTFT/native armor slots and reviewed dependency envelope; arbitrary new closure blocked |
| WEAPON_METADATA | PARTIAL | authored inventory/WEAP separation implemented; current two have none, new loadout resources unverified |
| DEPENDENCY_CLOSURE | PARTIAL | exact reviewed development envelope reused; unknown/third-party footprint blocked |
| MANIFEST_GENERATION | PASS | canonical content identities, portable catalog draft and no secrets/absolute authoring roots |
| DETERMINISTIC_STAGING | PASS | immutable snapshot and tamper/conflict bounds tested |
| LICENSE_PROVENANCE | PARTIAL | authenticated operator ledger/local attestation; public rights/trust not established |
| CATALOG_APPROVAL | PASS | immutable development intake only, not spawning-catalog promotion |
| ADMIN_ASSET_UI | PASS | automated/browser fixture; real owner session acceptance pending |
| NEW_TEMPLATE_RUNTIME_IDENTITY | BLOCKED | current two-base proof unchanged; no new owner asset/profile proof |
| NEW_TEMPLATE_RENDERING | PENDING_OWNER_ASSET | no new authored asset provided or invented |
| EXISTING_NPC_PRESERVATION | PARTIAL | protected registry/dialogue hashes and three UUIDs preserved; owner post-deploy game acceptance pending |
| ANCHOR_AND_COMBAT | PARTIAL | untouched protection/dialogue baseline; slope bug explicitly DEFERRED |
| ISOLATED_DEPLOYMENT | PASS | verified existing isolated server,30 seals, health and actual served UI bytes; no production/client change |
| NATIVE_CRASH | BLOCKED | old0xC0000005 cause unresolved; diagnostics retained |
| SINGLE_CLIENT_ACCEPTANCE | PENDING_OWNER | no automated owner/Skyrim acceptance claimed |
| MULTIPLAYER_ACCEPTANCE | DEFERRED | no G2.4.3 or capacity certification |

No G2.4.6, dynamic Base/outfit switching or production promotion.

## Deployment, diagnostics and rollback evidence

Deployed only to the existing `build/rp-audit/g241/dev-7FNiLN` target after the established idle/client/session guards. No Skyrim process was launched or terminated. No previous server was running at preflight. The existing visible PowerShell startup is PID13468, engine PID26524, startup ID `bd36adfe-8a3a-42ee-a081-30f3daf19339`. Readiness passed in32413ms with verified process ancestry and loopback UDP17777/TCP17778 ownership. Authenticated management remains loopback13210. Production7777 was not controlled.

Receipts: `build/rp-audit/g245/{deployment,startup-verification,deployed-verification,final-integrity}.json`. Final verification rehashed all30 sealed artifacts and compared actual HTTP UI response bytes to the sealed files. Health is SAFE_WAITING with zero custom auto-spawns. Anonymous snapshot returned401; cross-origin mutation403; `/npc-assets` returned200. Runtime log explicitly says development intake only/no catalog hot reload. The final CLI registration-lock change does not enter the sealed runtime and required no further restart.

Backup `build/rp-audit/g244/deploy-TBqSwK` retains82 code/config files and seven protected hashes; prior backups remain. Production configuration/data, isolated player data and NPC/dialogue journals were unchanged. Existing native startup legitimately parked the three registered NPC ChangeForms pending `/npc identity`; those three world files changed, so full world byte equality is **not** claimed. Preserved UUIDs: Clerk `c7ee4c2b-81bf-4e2a-86e3-c1aa5b599421`, Warrior `c780497d-41e1-451c-82f7-a96093c13988`, HomHom `dd84d54e-5231-42f1-9162-3ed4f623d28c`.

An initial deployment finalizer incorrectly required the old hashed Vite filename after atomic UI replacement and failed ENOENT before server startup. The fix records complete before/deployed UI inventories separately from ordinary code rollback. Focused tests retain an additional valid old JS asset and prove full restoration, no stale served files, interrupted restore recovery, later-edit refusal and idempotency. Review also identified a failed second directory rename leaving the old UI displaced; the installer now restores that verified old tree and retains the new staging directory. The regression first reproduced ENOENT, then passed. All previous staged/backed-up trees remain recoverable.

One concurrent RP/startup attempt hit Windows process timeouts: the existing journal termination test exceeded its unchanged5s child deadline (444/445 passed), and the separate PowerShell inventory hit its unchanged15s guard before any server creation. Complete diagnostics remain in `rp-regressions-parallel-timeout.log`. The unchanged focused journal test passed; the complete RP suite then passed445/445 with serial workers; startup separately passed. No economy behavior changed, no test was skipped, and no timeout was enlarged. The exact OS-level contention cause is not asserted.

Code/UI rollback preflight passed against the backup; actual live rollback was not executed. With Skyrim closed, verify and stop only the exact isolated process tree through the established procedure, then run from the SkyMP repository:

```powershell
node rp-gamemode/research/g244/deployment.cjs rollback-check
node rp-gamemode/research/g244/deployment.cjs rollback
node rp-gamemode/research/g244/start-verified.mjs
```

Rollback touches only verified code/config/UI, preserves displaced UI trees and refuses unknown later edits. It never restores/deletes player, world, economy, NPC registry or asset-intake journal data. The old serve-script backup matches its old handoff seal. Production/client rollback or owner profile activation is outside this operation.

| Artifact | SHA256 |
|---|---|
| sealed g241d-runtime.cjs | `94786fc074cd68d7363c85896d242a3d2b6f3d6eea3d1da481e0cf085f7ddf51` |
| sealed runtime/runtime.js | `015dca3bb2942e4efeca0c70d9e6a49dd9dce9b693bd7002429b78702891fc23` |
| sealed catalog-loader.js | `5fcb4f1400f2f3048655434fb9c772c41b37430df56711ac4700509a1c3e9a6c` |
| UI index.html | `e495da62a1332e9ce8fc0680db3d928dd1849abe42bb413f6d394544c6b69365` |
| unchanged profile | `634a433c9a6a9c5ce81a2324ab473c5c8a1594651cbdb8cb4349981670d4d1de` |
| unchanged playable catalog | `1e2e2eca7cf0179650508b2790f11fd570c51d5042d1710a5cebaad9eb7ade77` |
| real integration manifest | `a2ccd6341a218d5542abe30f579aaa7c51f7b8cd5f1131ee91bdb158a251ee6e` |

## Changed files and Git delivery

Importer/CLI: `scripts/g245-assets.cjs`, `scripts/npc-assets.cjs`; bounded record adapter: `src/modules/npc/catalog-loader.ts`; authenticated integration: `scripts/g241d-{dev,runtime}.cjs`, `src/runtime.ts`, `src/modules/dialogue/editor-http.ts`; UI: `blueprint-editor/src/npc-assets.{tsx,css}`, `entry.tsx`, `npc-management.tsx`. Focused tests and actual native/browser research fixtures accompany these changes. Deployment fixes are confined to `scripts/npc-ui-{deployment,rollback}.cjs`, `research/g244/deployment.cjs` and their tests. Paths without a prefix in this paragraph are under `rp-gamemode`.

Delivery branch is `dev/npc-activation-g241d`, authorized remote `frostveil` (`kaktv2016/skymp`); upstream `origin` must not be pushed. Launcher repository remains clean and unchanged. Binary assets, private snapshots, source-root configuration, journals, grants and deployment logs remain outside tracked delivery. Implementation commit: `7b3f3444` (`feat(npc): add validated development asset intake and approval library`); deployment recovery commit: `f55f9f7f` (`fix(deploy): preserve complete hashed UI trees for safe rollback`). This report is committed separately; final delivery verifies the authorized remote tip after pushing all three commits.
