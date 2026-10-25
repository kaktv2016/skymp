# Frostveil G2.4.1 — NPC template catalog foundation

Date: 2026-10-26. Baseline `6f3be1821f0a7fd1f4d9808ec699b368f5fbf0e0` (G2.4.0, atop owner-accepted Phase C `db212a92`). Development branch `dev/npc-template-catalog-g241`. Implemented backend and isolated development tooling; **asset/visual promotion is blocked**, not completed by mocks.

## Status

| Area | Result |
|---|---|
| Strict catalog schema, immutable snapshots, registry integration, fixtures | **VERIFIED_CODE** by focused and regression tests |
| Installed native legacy registry write/restart; source record facts | **VERIFIED_DATA** in a fresh disposable environment |
| Custom template native spawn / fixed gear / FaceGen rendering | **BLOCKED_MISSING_ASSETS**; no real plugin exists yet |
| Complete asset dependency closure | **BLOCKED_MISSING_ASSETS/tool integration**; required verifier has no unsafe default |
| One-client visual acceptance | Not performed; **BLOCKED_MISSING_ASSETS** |
| Multiplayer | **DEFERRED_MULTICLIENT_VISUAL**, owner explicitly postponed |
| Runtime compatibility | Existing runtime retained; no evidence requiring an upgrade |

## Baseline and tools

Read parent AGENTS/RTK, G2.4.0 reports/ADR, G2.1/G2.2 reports including final owner pose acceptance, and current Phase C report. Working tree was clean before creating the isolated branch. The live server remains on the existing immutable Phase C bundle, not this development build.

| Artifact | SHA-256 before work |
|---|---|
| Live `server-settings.json` | `b2eae9646213ce3be1df9c469ca7f56fbe324c335d811e38a6988d96a68ab868` |
| Native server addon | `a9e77780133b3c064a8abc9aa6f6971b1c73ff3c1b2d1539af404b3cbe389157` |
| Live server bundle | `b3942dd191d761d99205469d1d68367d0c6db9b1832427b1d281c5e7afa7825f` |
| Installed client JS | `67cec3774049606e635af3f4b6c84abe87a24ddc53d7392db9badb60a9fb69e6` |
| Installed SkyrimPlatformImpl.dll | `c91b5ed52adf1328877366c9497a668e2abaf1c5314b2b9ed422b762320f1a66` |

Skyrim 1.6.1170, SKSE 2.2.6, custom Platform 2.9.0 remain pinned; type declarations are 2.8.0. RaceMenu 0.4.20 stays optional, `bExternalHeads=0`; NPA remains absent. No runtime/native/client binary modifications or installed-player writes. Scoped checks found no CK/xEdit executable on PATH or checked Steam game/Creations folders; this is not a global claim about every folder. No GUI automation, plugin fabrication or fake FaceGen export.

Current server prefix is five masters followed by FrostveilCourierNavigation.esp. The disposable configuration preserves this prefix and can append a future approved test ESP, avoiding a client/server slot mismatch. All Form IDs are plugin-qualified; transient FF IDs identify only native instances. Light/FE plugin support remains rejected.

## Changed implementation

`rp-gamemode/src/modules/npc/template-catalog.ts` implements a strict, bounded schema: catalog ID/version/canonical content hash, asset revision, plugin SHA/master/order facts, template ID/display name/description, owned base identity, appearance category, fixed outfit items, optional concrete weapon and provenance. Unknown fields, duplicate IDs, malformed/noncanonical/transient/light identities, stale versions/hashes, wrong native types and unresolved dependencies fail closed. Catalogs are operator-allowlisted by revision hash; no game command accepts a path, arbitrary Form ID or executable content. Snapshots are validated once and cached for repeated lookups; returned metadata/assignments are cloned for future Studio use.

`catalog-loader.ts` reads confined regular files, rejects links/traversal, hashes plugin content with bounded streaming buffers, parses real TES4 flags/masters and compares both `getEspmLoadOrder()` names and `getServerSettings().loadOrder` paths. It inspects new-plugin record boundaries and rejects vanilla overrides/unrelated/deleted records. Native NPC_/OTFT/ARMO/RACE/HDPT/WEAP facts are resolved synchronously. NPC sex/race/headparts/unique flag, template inheritance, base inventory and fixed outfit slots must match. Scripted, packaged, faction/spell-bearing or aggressive fixture bases are rejected. Matching FaceGeom/FaceTint paths, sizes, hashes and headers are checked. **These checks alone are not complete NIF/ARMA/texture closure.**

Final review caught that distinction. `verifyResourceClosure` is now mandatory before approval can return; no physical default or no-op is supplied by development bootstrap/staging. A verified external authoring/asset validator must be integrated before real custom catalogs can spawn. Pure tests provide an explicit inert callback to test backend behavior; that is not asset proof. An AUTHORING_REVIEW text or correct NIF header cannot bypass this gate. This remaining integration must be completed against real exports, not guessed or replaced with `()=>{}`.

`npc-service.ts` accepts optional approved catalogs; default production construction remains unchanged. Legacy clerk definitions retain the exact old shape, null profile fields and original base. New records add immutable `templateAssignment`, a mutable-state `revision`, and optional fixture ownership, preserving the UUID/tag/journal model. No legacy journal migration/write occurs on read. New actor creation uses the resolved approved base; baseDesc is never rewritten. Existing owner-authored NPC replacement/hot swap is absent. Stale template revisions and obsolete admin selections are rejected. Missing assets/recovery identity faults preserve data and fail closed, consistent with G2.1, rather than silently respawning or substituting a base. A registry containing an unavailable custom assignment conservatively becomes unavailable until restored; it is not automatically repaired.

Development-only `/npc fixture create|list|cleanup` uses this same registry, existing admin authority, an isolated-environment callback and two approved template IDs. Both templates/capacity are checked before reservations. Repeated requests reuse the stored fixture keys/UUIDs; cleanup soft-deletes only matching owned fixture entries. Fixture key/template inconsistency is rejected on load rather than silently missed during cleanup. The 64-definition limit including tombstones is unchanged. Native failure after durable reservation still halts for operator diagnosis; there is no dangerous automatic retry/rollback of native actors. A pair is idempotent per entry, not an atomic native two-actor transaction.

`runtime.ts` accepts trusted optional `npc.templateOptions`; `index.ts` exports the loader/hash for controlled integration. Dynamic completions reuse existing command registration and admin filtering. The production entry passes no catalog/development options and exposes none of the fixture completions by default. Pose/idle updater code, its owner/neighbor visibility flags, degrees/radians handling and display-name mechanism are unchanged. No raw appearance, inventory, equipment, shared base-name or unsafe form-ID mutation is used by the new feature.

## Disposable tooling and asset handoff

- `g241-dev.cjs prepare` creates a fresh audit-root environment, empty data/registry locations, separate config and compiled code/known engine snapshot. It copies no world/player/economy journals. Approval defaults to disabled; no actor auto-spawns. Test UDP/resource ports are 17777/17778, separate from production.
- `g241-bootstrap.cjs` rechecks offline loopback/private paths and uses the existing LocalAdminAuthority with zero granted sessions initially. It resolves imports from the isolated working directory because SkyMP evaluates gamemode source from a temporary module. Any absent asset/closure approval prevents readiness.
- `g241-dev.cjs probe` uses two actual addon processes for writer/reloader against separate probe storage. The probe creates a legacy actor only, never custom visual data; it proves missing-asset fixture creation is refused and records protected-data hashes.
- `g241-record-inspect.cjs` performs a bounded read of installed NPC headers and native dependency lookups. Verified source suggestions are SailorEris (`af522:Skyrim.esm`, Nord female) and dunCGImperialMageD01 (`f3e76:Skyrim.esm`, Imperial male). These are source records only, never template IDs to spawn. Exact headparts/outfits are in `research/g241/source-records.json` and the authoring guide.
- `g241-stage.cjs` requires actual authored files and review, never writes an ESP/NIF/DDS itself. It derives real local IDs/resources and keeps any valid structural draft **disabled/unsigned**. Until a verified closure adapter exists, it writes an explicit blocked handoff and exits nonzero. Nothing is installed, signed, published or uploaded. No production manifest is overwritten.

The generic modpack trust module audited has no approved remote key configured. That is a limitation of that path, not a claim that the separate existing pinned signed graphics-repair workflow never worked. Neither delivery path was changed. A real approved development Launcher target/signing flow must verify installation/activation and prefix order before owner gameplay; bypassing signature/hash checks or editing approval JSON is not an acceptance procedure.

## Verification and measurements

Final command evidence and exact counts are retained in `build/rp-audit/g241/` and the sanitized research evidence file. RP suite covers legacy/new registry, pose, dialogue, Phase C backend, Courier/economy, discovery, persistence and startup. Editor and installed-client source regressions remain separate suites. No mock test is called visual proof.

Final results: **369/369 RP**, **80/80 editor**, **58/58 client/source capability**, and **84 native ESM cases / 475,410 assertions** passed. The focused NPC/catalog/development subset is 33 tests (already included in RP). RP builds/typechecks, editor production build/typecheck and client `tsc --noEmit` pass. Editor build retains the pre-existing >500 kB chunk warning. `git diff --check` passed. The complete diagnostics, including initial failed harness attempts and red tests, are retained locally rather than suppressed.

Native diagnostic discoveries were handled inside the fixture: installed `getEspmLoadOrder()` returns basenames, so source paths are independently bound via the actual settings API. Restarting NpcService twice in one native process correctly triggers duplicate-property protection, so restart verification uses separate processes. With no observers, native tick can unload resident forms; logical registry UUID/tag persistence, disk state and recovery are checked separately from resident-cache count. These were harness assumptions, not production bugs or engine changes.

Final native probe measured legacy creation **25.98 ms**, recovery **13.31 ms**, catalog/file setup **800–822 ms**. Native RSS was approximately **558–586 MB** including loaded game masters, **not** a per-NPC or 100-player estimate. Custom template creation/stream/render latency cannot be measured before assets pass. No 50–100-player scale claim, per-frame asset scan, preset polling or unnecessary actor replacement.

## Deployment, rollback and Git

Only safe disabled components are staged in new `build/rp-audit/g241/dev-*` roots. There is **no appearance-enabled/listening G241 server deployment**, no production restart and no client/R2/Launcher release, because asset/closure/delivery gates are unmet. The existing verified local server remains untouched. Native probe protected manifest SHA-256 was `5edaa20a730ce79b34675b06224bd2a47ebfb4b116cef5af15296f10677d6616` before/after.

Final disabled snapshot: `build/rp-audit/g241/dev-7FNiLN/`; its `probe-world`/probe registry contain only disposable diagnostic state, and its future visual `world`/main registry remain absent. Development bundle SHA-256: `d3d2f311aade731e83316f6c20a162ea34321b98c908e366fc5c8357e6177c95` (not deployed to production). Editor assets remain `6b280784d5fc45254bc7312375690da5d6ed1323e8227be6d595f424af10248c`. Final audit confirms all three baseline server files and all nine audited installed game/runtime files unchanged. Launcher repository has no changes. Existing backups were not deleted.

Known-good Phase C bundle/config and G2.4.0 commit remain available; no rollback overwrites are needed. To stop a future isolated test, Ctrl+C only its visible PowerShell, retain its logs/registry/world for review, keep approval disabled and continue using the unchanged production startup. Do not delete or overwrite live saves, snapshots or economy journals. Source rollback can use a normal reviewed revert on this development branch; no force-push or history reset.

Implementation commit `3b97eaddc6c138cc4e58075edc8a80f5c8c07b21` was pushed successfully to `frostveil/dev/npc-template-catalog-g241`; remote SHA was independently checked. These reports follow in a separate documentation commit on the same branch. No SkyMP upstream push or unrelated WIP is included.

## Owner next steps and remaining limits

1. Install/use CK manually in a separate authoring environment; follow the exact source worksheet and create two owned NPC_ + two fixed OTFT records and real matching FaceGen.
2. Integrate and independently verify full resource-closure tooling with those real assets. Current loader deliberately blocks promotion without it. Weapon/ammo beyond one concrete WEAP remains out of scope.
3. Complete signed development Launcher delivery/installation checks, then execute the one-client guide. No `VERIFIED_SINGLE_CLIENT_VISUAL` claim until owner confirmation.
4. Keep the separate two-client plan deferred; it does not block the above backend work. Existing-NPC hot swapping, dynamic outfits, RaceMenu runtime application, NPA, full customization UI and scale testing remain future work.

Deliverables: this report, `FROSTVEIL_G2_4_1_ASSET_AUTHORING_GUIDE.md`, `FROSTVEIL_G2_4_1_SINGLE_CLIENT_TEST.md`, `FROSTVEIL_G2_4_1_MULTICLIENT_TEST_LATER.md`, source/tests and sanitized local evidence. No fabricated game assets are included.
