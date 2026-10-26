# Frostveil G2.4.1C — FaceGen and isolated test readiness

Date: 2026-10-26. Baseline: `29ca47767d71ad8bbbf4d6cc36bef3a65e7237c5`.

**The custom NPC fixture is NOT READY for Skyrim.** This milestone adds real FaceGen comparison, bounded scene/skin-reference checks, resource evidence and fail-closed development readiness inspection. It does not establish a rendering defect in either authored NPC. No reauthoring or CK re-export is requested on this evidence.

| Required status | Result |
|---|---|
| FACEGEN_COMPATIBILITY | BLOCKED — overall certification pending; female material fallback and actual renderer behavior unverified |
| RESOURCE_VALIDATION | PARTIAL |
| PLUGIN_IDENTITY | BLOCKED |
| DEVELOPMENT_DELIVERY | BLOCKED |
| CATALOG_APPROVAL | DISABLED |
| ISOLATED_SERVER | NOT_STARTED |
| SINGLE_CLIENT_VISUAL | NOT_READY |
| MULTICLIENT_VISUAL | DEFERRED |

## FaceGen findings

The selected-member `rsm-bsa 4.1.0` helper extracted only vanilla Lydia's `meshes/actors/character/FaceGenData/FaceGeom/Skyrim.esm/000A2C8E.nif` from `Skyrim - Meshes0.bsa`. Reference SHA-256: `cbcd6c760a440d814fa71ff5d81f78dc24ad096b2cf7a7c99f29a09a782bbaa0`. No archive-wide extraction was performed. The helper bounds decompressed size to 32 MiB, restricts output to the audit tree, uses exclusive creation, preserves differing existing output and rejects redirected/hardlinked output.

Both authored faces and this vanilla reference have Face Tint shader type **4**, flags1 **2185238275**, flags2 **33587233**. The [NifTools schema](https://github.com/niftools/nifxml/blob/develop/nif.xml) supplies the explicitly decoded field layouts. This is a matching material example, not proof of all engine fallback semantics.

- **Female 5901:** texture-set block 18, face shader block 17, empty slot 6; slot 3 is `Actors\Character\Female\FemaleHeadDetail_Rough.dds`. Its DDS exists and passes complete single-mip RGBA8 payload validation. The vanilla comparison has a populated slot 6. That difference alone does not demonstrate corruption, rule out engine-supplied tint, or connect prior CK warnings to this export. Classification: **PENDING_GAME_RENDER**. No supported repair was justified or applied.
- **Male 5906:** texture-set block 16, face shader block 15; slot 6 is `Data\Textures\actors\Character\FaceGenData\FaceTint\FrostveilNPCTest.esp\00005906.dds`; slot 3 is the age-40 male detail texture. Vanilla Lydia also uses `data\Textures`. Classification: **PASS_STATIC for matching flags and expected path form only**; runtime path acceptance remains **PENDING_GAME_RENDER**. No normalization rewrite was made.

The comparison API exposes this narrow static scope explicitly. The shared staging/runtime closure adapter no longer treats these material observations as proof that the owner must repair assets. It still delegates to the strict production resource verifier and fails closed when complete approved resource evidence is missing.

## Practical resource validation and package

Extended `g241b-nif-structure.cjs` rather than replacing the validator with unconditional evidence. It validates named references in SSE nodes, shapes, skin instances and lighting shaders, including bounds and expected target block types. The female file has 46 blocks, 6 scene nodes, 6 shapes, 6 skin instances and 88 inspected named references. The male has 45 blocks, 4 nodes, 6 shapes, 6 skin instances and 80 inspected references. Corrupted child references and truncated input fail.

`g241b-resources.cjs` adds lookup-only shader path normalization and exact supported FaceTint pixel-format/payload checks. It does not rewrite paths in NIFs or weaken `createResourceVerifier`. The narrow scene parser remains explicitly incomplete: detailed skin weights/partitions, vertex/index payloads and unsupported block internals are not certified.

The existing 85-record native dependency evidence was reused against the unchanged ESP hash. The resource audit queries **109 distinct paths**, including actual shader references, against **11 named vanilla BSAs**. Every queried path was available; no unreviewed loose override was found among these paths. Archive SHA-256 values and member provenance are retained in `rp-gamemode/research/g241b/g241c-evidence.json`. These are observed local consistency hashes, not an authenticated Bethesda provenance baseline. Availability is not proof of complete archived mesh/material closure. The record candidate graph includes sex/race alternatives; complete body-slot/race/sex/archived geometry compatibility remains an explicit unresolved check.

Evidence levels remain separate:

- STRUCTURAL_VALIDATION: **PARTIAL**, with the verified scope above.
- RESOURCE_VALIDATION: **PARTIAL**, no missing path in the inspected candidate set.
- RUNTIME_VISUAL_VALIDATION: **PENDING_GAME_RENDER**.

The prior five-file stage was reused: `build/rp-audit/g241/dev-7FNiLN/staging-7RaVpv`, **2,570,478 bytes**. Catalog hash is unchanged: `1e2e2eca7cf0179650508b2790f11fd570c51d5042d1710a5cebaad9eb7ade77`. TGA intermediates are excluded. Both NPC/local IDs, fixed vanilla outfits, exact reviewed empty tombstones 5900/5903/5904 and safe base-record policy remain enforced by the existing catalog loader. No source ESP/NIF/DDS was rewritten and no repaired candidate hash exists.

| Runtime asset | SHA-256 |
|---|---|
| FrostveilNPCTest.esp | `ecb1f7f70aa15cab92d4dfde7773bf920f88d6558623224c5940454ba59439fc` |
| Female 00005901.nif | `e0e44eb8112c9b10bc9e6b547bf8a671152b2cd8714629ae7b9383c0d19d2aa3` |
| Female 00005901.dds | `2bf59a37d76e13644b205f1778fbdfdf874c987b772a5e8375240b4d04e2e14c` |
| Male 00005906.nif | `6a2ba2bb0139999d8b88aaeda389479dc11bdc1620edd6ab559325527a678458` |
| Male 00005906.dds | `1e5dacdb9bfa2cf51a74fed55030d26bc3b52d0e2f14f827c883f71eed7c1fd8` |

## Actual activation metadata and identity boundary

The read-only inspector bundles the existing Launcher's `readOrderInputs`, `readPluginHeader` and `planActivation` into the ignored audit directory. It invokes no installer or write transaction. It distinguishes a plan from installed evidence: manager ambiguity, planner failure or proposed configuration writes prevents treating that result as installed order. Native SSE asterisk activation behavior is also documented in [libloadorder](https://github.com/Ortham/libloadorder/blob/master/src/game_settings.rs).

Observed client full-plugin order from installed metadata:

```text
0 Skyrim.esm
1 Update.esm
2 Dawnguard.esm
3 HearthFires.esm
4 Dragonborn.esm
5 ccBGSSSE001-Fish.esm
6 ccBGSSSE025-AdvDSGS.esm
7 unofficial skyrim special edition patch.esp
8 Natural Waterfalls.esp
9 FrostveilCourierNavigation.esp
10 SMIM-SE-Merged-All.esp
11 BlendedRoads.esp
12 Freak's Floral Meadows.esp
13 Ulvenwald.esp
14 Embers XD.esp
15 Lux.esp
16 RaceMenu.esp
```

`FrostveilNPCTest.esp` is **present but inactive**. Light plugins are excluded from this full-index list; no ESL/FE network support is asserted. The exact isolated native server `getEspmLoadOrder()` reports official five + Courier at **5** + staged NPC test plugin at **6**. Thus the earlier static candidate estimate of Courier index 7 is superseded by current installed metadata: **9 versus 5**. This is not a Skyrim `GetModName` runtime capture.

Installed `remoteServer.ts` accepts network `baseId` directly, and `FormView` resolves it with `Game.getFormEx(model.baseId)`; no verified plugin-qualified NPC base mapping exists on that path. No offset was added. Matching file hashes do not cure an inactive plugin or wrong full index.

The readiness assessment now additionally requires content equality for every shared server plugin and loaded-client/native-server proofs for exact bases `5901:FrostveilNPCTest.esp`, `5906:FrostveilNPCTest.esp`, their expected EditorIDs and ActorBase types, plus the existing `39f83:Skyrim.esm` Clerk base. Missing, unrelated or misindexed bases fail. Actual client base proofs remain absent and are never synthesized from metadata. The assessor is **report-only**: even a synthetic passing test does not create an approval, install files or enable fixtures.

## Development delivery, isolation and promotion

The Launcher has a `LOCAL DEVELOPMENT ONLY` scan profile and per-file hashing, but this does not grant a managed installation/activation transaction. Its authenticated release path supplies trust, reviewed transactional activation and rollback. The generic modpack `remoteTrust` is currently `null`; the updater signer does not authorize NPC packages. No supported authorized local handoff to activate these inactive assets with a matching isolated profile was established. No unsigned payload was called authenticated and no new signing key/trust bypass was introduced.

The code distinguishes narrowly declared visual uncertainties from hard missing-resource, wrong-identity, changed-hash, stale-catalog, isolation and authorization failures. It allows evaluating a future explicitly authorized local-reference candidate without requiring impossible renderer guarantees. **It does not replace the production callback or activate the current package.** The current stage revalidation exits **2**, with `NIF_SEMANTIC_VERIFIER_UNAVAILABLE`, rather than the former material-corruption assertion.

Existing disabled development helpers were refreshed inside the existing isolated directory; the existing small code backup and parent Git revision provide recovery. No gameplay server was started. Approval remains `{schemaVersion:1, enabled:false, catalogs:[]}`. UDP17777/HTTP17778 remain unused by this fixture. Production 7777/3000 were not restarted or changed. Native record inspection does not bind a gameplay listener.

The isolated legacy registry recovery probe found exactly one registered/resident actor, preserved its UUID/base and created no custom actor. Recovery took about **55 ms**; empty-catalog inspection about **1,040 ms**. The comprehensive read-only archive/hash/resource audit took **32,539 ms**, outside gameplay/streaming. No per-frame appearance mutation, retained native wrappers or 50–100-player performance claim is introduced.

## Automated verification and integrity

| Check | Result |
|---|---|
| RP build/typecheck and full regression | **384/384** |
| Explicit real asset / NIF / comparison tests | **11/11** |
| Blueprint Studio tests and production build/typecheck | **80/80**, build passed |
| Client + G2.4 source regressions, client typecheck | **58/58**, typecheck passed |
| Native `[espm]` tests | **84/84**, 474,604 assertions; seed 85385145 |
| Launcher activation, schema, service, trust and installer tests | **148/148**, freshly bundled from source |
| Legacy isolated native registry reload | Passed; one existing actor, no duplicates |
| Git diff whitespace check and independent source review | Passed; review findings addressed |

No NSIS release or new Launcher build was needed because Launcher source and releases were unchanged. The real-asset comparison initially failed when run from the gamemode directory because its vanilla fixture path depended on CWD. That test was fixed to resolve from `__dirname`, then all 11 passed from that directory. Full failure diagnostics remain under `build/rp-audit/g241c/asset-tests-cwd-failure.log`; successful logs and read-only reports are in the same audit directory. No failing gate was skipped to permit deployment.

All seven owner source files (including authoring TGAs) were hash-preserved. All nine pinned installed runtime files still match the G2.4 baseline. Protected live configuration/world/economy/NPC/dialogue/Blueprint manifest SHA-256 before and after is identical: `5edaa20a730ce79b34675b06224bd2a47ebfb4b116cef5af15296f10677d6616`. Installed plugin/loadorder text hashes also match before/after. Native addon hash remains `a9e77780133b3c064a8abc9aa6f6971b1c73ff3c1b2d1539af404b3cbe389157`. No game directory, save tree or redundant staging archive was copied.

## Commit, next action and eventual owner acceptance

Implementation/evidence commit: **`e4e60536ce313d93d9025c3f5a0aed586b2b66a0`**, pushed successfully to authorized **`frostveil/dev/npc-local-readiness-g241c`**. This report is a separate documentation commit on that branch. No upstream push or force-push was attempted.

**Smallest concrete prerequisite:** configure the authorized DEVELOPMENT asset trust/source and its supported transactional activation/profile handoff. That profile must preserve approved client plugins while establishing matching network plugin identities/order; merely adding `*FrostveilNPCTest.esp` manually is insufficient. Remaining exact resource/archived mesh compatibility checks and loaded-base proofs must then pass before enabling fixture approval. No owner CK recreation/re-export, NPA, second client, manual Form ID edit or direct game-file overwrite is requested.

Do not run the fixture yet. After the above gates are resolved, the single-client checklist is:

1. Select the verified development profile and isolated `127.0.0.1:17777` server; verify active assets/hashes/base identities and obtain a development-only admin session.
2. Run `/npc templates`, then `/npc fixture create` and `/npc fixture list`. Confirm the female Nord clerk with Warlock robes/boots and male Imperial warrior with Imperial Light armor.
3. Inspect face/skin/head color, hair/eyes/body, missing meshes, fixed outfits and idle. Record screenshots; preserve the existing Clerk.
4. Walk out of streaming range and return, reconnect, then restart **only the isolated server**. Recheck both appearances, stable UUIDs and absence of duplicates.
5. Run `/npc fixture cleanup`; confirm only the disposable owned pair was cleaned.

Until that actual owner run, no rendering/gameplay success is claimed. Once technical readiness is achieved the visual status becomes `PENDING_OWNER_SINGLE_CLIENT_VISUAL`; two-client acceptance remains `DEFERRED_MULTICLIENT_VISUAL`.
