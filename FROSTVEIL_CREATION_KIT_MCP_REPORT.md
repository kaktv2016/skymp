# Frostveil Creation Kit MCP — 2026-11-04

**Delivery: PARTIAL overall; functional headless authoring and Codex connection PASS.**
Native Creation Kit editing/export remains unavailable. No GUI control, screenshots,
OCR, input simulation, injected DLL, Skyrim launch, actor creation, catalog approval,
profile activation, production distribution or G2.4.6.1 acceptance occurred.

## 1. Environment and preserved baseline

Read root AGENTS/RTK and the G241, G241B/C/D, G242, G244, G245 and latest G246
reports and relevant source. Existing G245 resource/manifest/approval and G246
identity/runtime gates are retained. No runtime/Launcher source files changed.

Verified local file metadata: CreationKit.exe **1.7.99.0**; SkyrimSE.exe
**1.6.1170.0**; skse64 loader/DLL **2.2.6**. Node **24.11.1**; Codex CLI
**0.166.0-alpha.6**. The existing workspace .NET SDK **10.0.402** was reused
(machine `dotnet` has no SDK). Mutagen Skyrim **0.54.4**, matching the existing
courier writer. No game/editor update was installed. Skyrim Platform/SkyMP pins
were not upgraded or independently recertified by this tooling task.

Original five approved ESP/NIF/DDS assets were rehashed by the real-native
integration test and remain byte-identical. Original ESP SHA-256:
`ecb1f7f70aa15cab92d4dfde7773bf920f88d6558623224c5940454ba59439fc`.
Catalog approval remains `1e2e2eca7cf0179650508b2790f11fd570c51d5042d1710a5cebaad9eb7ade77`.

## 2. CKPE native feasibility

Inspected a local source clone at CKPE commit
**ecd3c2981f212556967386935e79177e1c3c52b2**. Primary evidence:

- [PluginAPI header](https://github.com/Perchik71/Creation-Kit-Platform-Extended/blob/ecd3c2981f212556967386935e79177e1c3c52b2/CKPE.PluginAPI/Include/CKPE.PluginAPI.PluginAPI.h):
  plugin/runtime/library versions, handle and QueryInterface; declared interface
  is DialogManager. It does not expose an NPC authoring, loaded-project query,
  selected-NPC read API, task scheduler or safe FaceGen export contract.
- [TestPlugin](https://github.com/Perchik71/Creation-Kit-Platform-Extended/blob/ecd3c2981f212556967386935e79177e1c3c52b2/Plug-ins/TestPlugin/dllmain.cpp):
  version metadata, logging and dialog-manager query. Its example compatibility
  list names **1.5.73.0**, which does not certify the installed **1.7.99.0**.

Loading a plugin would at most establish loader/metadata compatibility; no such
load was attempted. Native bridge status **UNSUPPORTED / PENDING_OWNER** for
installation, rather than a simulated working integration. No DLL was built,
installed or injected, and there is no IPC listener or DLL-loading MCP tool.

If a future supported API becomes available, a separately authorized bridge must
pin editor binary/SDK identities, negotiate protocol/capabilities, use an
owner-restricted Windows named pipe with authenticated challenge/sequence checks,
bounded messages, worker-thread transport and an SDK-supported editor-thread
dispatcher. None of those unimplemented transport contracts are advertised here.

## 3. Exact FaceGen evidence

[Skyrim Facegen source](https://github.com/Perchik71/Creation-Kit-Platform-Extended/blob/ecd3c2981f212556967386935e79177e1c3c52b2/CKPE.SkyrimSE/Src/Patches/CKPE.SkyrimSE.Patch.Facegen.cpp)
hooks internal export flow through relocation ID **439682** into `Facegen::sub`.
That method confirms through private function **181472**, dereferences a window
handle from an undocumented object offset, enumerates selected ListView items,
retrieves data through **58196**, calls per-item function **39410**, reloads loose
paths through **199017**/global **43514**, then finishes through **293309**.
These IDs are source relocation identifiers, not public callable APIs.

The patch depends on Console and D3D11 Patch; GPU compression uses the editor's
ID3D11Device. DDS helper **557372**, NIF export **553557** and options to suppress
NIF/DDS/TGA output demonstrate separate asset operations, not a headless exporter.
Loaded editor NPC objects, lifecycle, renderer state, owning-plugin translation
and a supported dispatch mechanism remain unproven. UI-event context suggests
editor-thread affinity, but no public scheduling/thread-safety contract was found.

**FACEGEN_NATIVE_EXPORT = MANUAL_REQUIRED.** No ListView manipulation, Windows
messages, button presses, memory writes or hardcoded-address calls were used.
No verified CK command-line FaceGen interface was found or invented.

Existing real FaceGen files were structurally tested with the original validators.
The female 5901 known missing explicit tint path retains the exact-byte exception
documented in G241C; arbitrary new files cannot inherit it. This is **PARTIAL**
structural evidence, not export provenance, renderer or skin-weight certification.

## 4. Headless implementation and architecture

Package: `rp-gamemode/tooling/frostveil-creation-kit-mcp`.

Codex → official SDK stdio → strict schemas/service/planner → fixed C# subprocess
→ Mutagen → immutable staging → existing Frostveil independent binary validators.
The original TypeScript catalog validators are bundled at build time; they are
not reimplemented. G245's existing native-backed scanner is exercised in fresh
private test storage. No second asset library, runtime identity mapper or actor
registry was added.

Official [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
packages server/client **2.4.0**; Zod **4.6.7**, TypeScript **5.9.3**. npm and NuGet
lockfiles are committed; locked NuGet restore is required. An initially selected
older Zod was replaced after npm audit identified its collection-validation
advisory. Final npm audit reports **zero vulnerabilities**.

[Mutagen](https://github.com/Mutagen-Modding/Mutagen) is used for actual NPC/OTFT
serialization, not as evidence of CK control. Its Skyrim NPC source was inspected;
local real-record tests establish the implemented subset. [Synthesis](https://github.com/Mutagen-Modding/Synthesis)
is a patcher framework, unnecessary for this fixed adapter. [xEdit](https://github.com/TES5Edit/TES5Edit/releases)
remains an optional independent owner inspection tool; it was not installed or
claimed as a tested backend.

## 5. Tools and schemas

All objects reject unknown properties. Plugin inputs accept only the protected
`FrostveilNPCTest.esp` or `FrostveilMCP_<12 lowercase hex>.esp` artifacts produced
in this tool's work root. IDs/hashes/text/heights have explicit bounds.

| Tool | Input / result scope | Backend |
|---|---|---|
| ck_capabilities | no args; actual capability registry | MUTAGEN_HEADLESS |
| ck_inspect_installation | no args; file versions, no editor control | MUTAGEN_HEADLESS |
| ck_list_plugins | no args; protected source + tool staging only | MUTAGEN_HEADLESS |
| ck_list_npcs | plugin; actual records, including deleted metadata | MUTAGEN_HEADLESS |
| ck_get_npc | plugin, localId; actual NPC facts | MUTAGEN_HEADLESS |
| ck_list_outfits | plugin; owned outfit references | MUTAGEN_HEADLESS |
| ck_plan_npc_creation | editorId, displayName, height 0.8–1.2 | MUTAGEN_HEADLESS |
| ck_create_npc | planId, reviewHash, operationId, optional dryRun | MUTAGEN_HEADLESS |
| ck_update_npc | owned plugin, expectedSha256, displayName, optional height; replacement plan | MUTAGEN_HEADLESS |
| ck_validate_plugin | plugin; independent parser + Mutagen reopen | FROSTVEIL_VALIDATOR |
| ck_validate_facegen | plugin, localId; bounded real NIF/DDS inspection | FROSTVEIL_VALIDATOR |
| ck_export_facegen | plugin, localId; explicit manual result only | MANUAL_REQUIRED |
| ck_prepare_frostveil_import | plugin; validation, source root and existing pipeline instructions | FROSTVEIL_VALIDATOR |
| ck_get_operation_status | operationId; durable staging/interruption status | MUTAGEN_HEADLESS |

There are **14 tools** (the table combines no operations; count includes all listed
names). `src/schemas.ts` is the exact executable schema authority. SDK-level invalid
arguments return protocol validation errors before the backend runs. Successful
backend results name their backend; failures are structured and bounded.

## 6. Supported subset and identities

Only a **fresh unique female Nord** preset is currently supported. Owner-supplied
EditorID/display name/height; fixed weight 50; no inventory/weapons, spells,
factions, scripts, packages or template inheritance are copied. This authors
appearance/outfit data, not mage combat behavior or a new runtime template.

Reviewed vanilla references resolved by type and EditorID against the actual,
hash-approved Skyrim.esm baseline:

- NordRace `013746:Skyrim.esm`.
- HairFemaleNord12 `0510F9`, FemaleBrowsHuman08 `0E4DA2`,
  FemaleEyesHumanLightBlue `07291C`, MarksFemaleHumanoid00NoGash `0EC1B2`.
  Inspected headparts report Female flags and expected Hair/Eyebrows/Eyes/Scars types.
- ClothesWarlockRobes `0C5D11` (slot mask 4), ClothesWarlockBoots `0C5D12`
  (slot mask 128). These references reuse the original reviewed dependency envelope.

Owned records are NPC `800:<new plugin>` and OTFT `801:<new plugin>`; the full
ESP has Skyrim.esm as its sole master, no overrides and no ESL/master flags.
After serialization the existing independent parser validates ownership, links,
record count, unique/female/safe flags and outfit; Mutagen reopens and compares
names, height, race/headparts and all outfit references with the reviewed plan.
FormKeys and content SHA-256 accompany receipts.

Updates produce a newly reviewed plan/new plugin identity and preserve the old
artifact. They do not change existing assignments or approved bases. Arbitrary
race/sex/headpart/outfit editing, existing-mod roundtrip rewriting, arbitrary
plugins, weapon authoring, ESL conversion and live CK edits are **UNSUPPORTED**.
Inventory FormKeys/counts are inspectable; current fixtures have no authored weapons.

## 7. Transaction/security behavior

Work root is restricted to children of this repository's
`build/rp-audit/creation-kit-mcp`. Fixed game paths are read-only. Paths reject
links/junctions, hardlinked input files, traversal, unexpected names and oversize
files; reads check file identity/size/timestamps. No shell/file-write/DLL-loading
primitive is exposed. Only the pinned adapter executable/operation set runs.

Plans are content-addressed; reviewHash explicitly authorizes that scratch plan.
Creation re-resolves the approved preset/master and refuses forged references,
master changes and plan tampering. This is an operator-reviewed local stdio
workflow, not a remote authorization service or protection against an attacker
who controls the owner's OS account and executable files.

Exclusive operation directories serialize competing operation IDs; reuse with
another request conflicts. Completed retry verifies bytes and returns the original
receipt. Outputs first go to pending, are independently checked, copied with
create-new semantics and hashed again; the fsynced receipt is atomically published
without replacing an existing file. Incomplete/failed operations remain evidence
and are never discoverable as verified output. Original files are never overwritten.

Interrupted same-ID retries fail closed. Recovery uses a newly reviewed operation
ID while retaining interrupted evidence; no automatic lock deletion or destructive
rollback is provided. A test exercised this recovery and preserved the known-good
artifact. There is no world/character/economy rollback because none is touched.

Stdio messages are limited to 64 KiB, schema elements to 128, concurrent MCP work
to two, adapter requests to 32 KiB, adapter output to 2 MiB and subprocess execution
to 45 seconds. Plans and tools expose dry-run/status; SDK progress notifications
are emitted when requested. Cancellation is checked before mutation and commit.
Private per-call audits contain IDs, input hashes, timing/status and bounded errors.

## 8. Automated evidence and limits

Final evidence directory: `build/rp-audit/creation-kit-mcp` (ignored/private).

- Package build: **PASS**, TypeScript + bundled original validators + locked C#,
  zero C# warnings/errors.
- Three integrated Node tests: real initialize/discovery/all **14 tools**, actual
  original ESP, two scratch/revision ESPs, independent roundtrip, schemas, progress,
  review/dry-run/retry/status and protected-source rejection.
- Security: **PASS** for traversal/unknown keys, junctions, hardlinks, forged plans,
  concurrent writes, operation conflict, output tamper, interrupted writes,
  retained-evidence recovery and pre-cancelled mutation.
- Existing G245/catalog/loader suites: **28 PASS**, zero failures.
- Real native-backed G245 scan: **PASS** at refusing the new ESP without real
  FaceGen; zero accepted candidates/actors, original two templates unchanged,
  all five protected files unchanged. This is a blocking acceptance result, not
  an imported/rendered new NPC.
- Native bridge smoke/export: **MANUAL_REQUIRED / PENDING_OWNER**, not run.
- New NPC Skyrim/renderer/multiplayer acceptance: **PENDING_OWNER**, not run.

`final-build.log`, `final-tests.log`, `regression-tests.log`, `npm-audit.json`, test
directories' `protocol-proof.json`, `security-proof.json` and `g245-proof.json`
retain the exact results. The tests contain multiple checks within three
integrated test cases; this report does not count each assertion as a separate test.

## 9. Codex connection and installation proof

Used the supported [Codex MCP CLI configuration](https://learn.chatgpt.com/docs/extend/mcp)
and `codex mcp add`; absolute Node/entry paths, stdio server name
**frostveil_creation_kit**, enabled. Configuration was backed up under
`C:\Users\basba\.codex\backups\frostveil-creation-kit-*`.

Installation checks caught and corrected Windows returning two Node executables
and a comparison that treated JSON object ordering as configuration changes.
Codex's removed empty node_repl argv was restored from the original backup.
Final comparison found the original unrelated MCP tables unchanged and only the
new server added. No unrelated MCP was removed/disabled in persistent config.

`codex mcp list/get` alone was not treated as invocation proof. A real
`codex exec --ephemeral --json` session completed **seven MCP tool calls**:
capabilities, list/get original NPC, plan/create scratch NPC, validate and handoff.
`codex-proof.jsonl` records actual MCP call arguments/results; final response in
`codex-proof-final.json` matches the real staged plugin:

- **FrostveilMCP_858c6d76e584.esp**
- NPC `800:FrostveilMCP_858c6d76e584.esp`; outfit `801:` same plugin.
- SHA-256 **e6b0da6c61000d0caa2deb88cc6e06582f2528b78b6aae7db39d548366bc1d48**.
- Source root:
  `C:\Users\basba\OneDrive\Desktop\skyrim-rp\skymp\build\rp-audit\creation-kit-mcp\work\operations\codex-guild-mage-proof`.
- VERIFIED_STAGED, backend MUTAGEN_HEADLESS; validation true;
  FaceGen MANUAL_REQUIRED; spawnable false.

The separate pre-existing ruflo MCP emitted a startup warning during that CLI
session; Frostveil's seven calls succeeded. No screen-control tool was invoked.
Existing desktop chats may need a new chat/session to refresh the MCP tool list.

## 10. ขั้นตอนเจ้าของเครื่อง

ติดตั้งและทดสอบซ้ำ (ไฟล์ build/หลักฐานอยู่ใน repo เดิม; ไม่ต้องติดตั้ง DLL):

```powershell
Set-Location 'C:\Users\basba\OneDrive\Desktop\skyrim-rp\skymp\rp-gamemode\tooling\frostveil-creation-kit-mcp'
npm ci --ignore-scripts
npm run build
npm test
.\scripts\install.ps1
codex mcp list
```

ต้องมี SDK ที่ตรวจไว้ `skymp\.local\tools\dotnet-sdk-10\dotnet.exe`, project
esbuild 0.28.1 และ asset/catalog baseline เดิม เครื่องนี้มีครบและลงทะเบียนแล้ว
คำสั่งติดตั้งซ้ำตรวจว่า configuration ตรงกันก่อนยอมรับ ไม่มีการแทน server อื่น

เปิด Codex session ใหม่แล้วสั่งใช้ `ck_capabilities`,
`ck_get_npc({plugin:"FrostveilNPCTest.esp",localId:22785})` เพื่อทดสอบ read-only
จากนั้น `ck_plan_npc_creation({editorId:"FV_MyGuildMage",displayName:"Guild Mage",height:1})`.
ตรวจ plan/references แล้วส่ง planId/reviewHash ที่ได้ไป `ck_create_npc` พร้อม
operationId ใหม่ เช่น `my-guild-mage`; ใช้ dryRun:true ได้ก่อน
อย่านำค่า hash ของแผนอื่นมาใช้ และอย่าลบ operation evidence เพื่อข้าม conflict

FaceGen ยังต้องทำเองใน Creation Kit ของเจ้าของ: ใช้ **สำเนา authoring แยกจาก
artifact ที่ sealed แล้ว**, โหลด plugin/master, ตรวจ NPC/ชุดและ export FaceGen
ด้วย workflow ปกติของ CK เท่านั้น รักษา defining plugin และ local ID เดิม
ต้องได้ NIF `00000800.nif` และ DDS `00000800.dds` ใน FaceGeom/FaceTint ของชื่อ
plugin ที่ถูกต้อง ห้ามคัดลอกคู่ FaceGen จาก NPC อื่นมาถือว่าเป็น export สำเร็จ
ถ้า CK save แล้ว ESP เปลี่ยน ให้ถือเป็น source revision ใหม่ ไม่แก้ sealed receipt

เมื่อมีไฟล์จริงครบ ให้วาง source ที่ตรวจแล้วใน Data tree ของ authoring copy
และใช้ **G245 importer เดิม**:

```powershell
node 'C:\Users\basba\OneDrive\Desktop\skyrim-rp\skymp\rp-gamemode\scripts\npc-assets.cjs' register '<reviewed-source-containing-Data>' 'FrostveilMCP_858c6d76e584.esp' --review-local-source
```

เปลี่ยน source path และ plugin เป็นชุดที่ export จริง จากนั้น scan/stage/review/
approve ใน Asset Library เดิม Unknown dependencies หรือ FaceGen ไม่ครบต้องหยุด
G246 prepare/review/owner-identity/activation gates คงเดิม ต้องทดสอบ Skyrim
จริงก่อนอ้างภาพใบหน้า/ชุดสำเร็จ ไม่เริ่ม G2.4.6.1 ใหม่อัตโนมัติ

ถอดเฉพาะ MCP ใหม่นี้ได้ด้วย `codex mcp remove frostveil_creation_kit`.
เก็บ staging/evidence ไว้; ไม่ต้อง restore world, profiles หรือ approved assets
ถ้าจะ rollback โค้ดให้ revert เฉพาะ commit นี้ตามปกติ ห้ามใช้ force push

## 11. Capability matrix and deployment

| Capability | Classification | Result |
|---|---|---|
| Inspect protected/staged NPC/OTFT and metadata | HEADLESS_SUPPORTED | PASS |
| Female Nord preset/full owned ESP/owned fixed outfit | HEADLESS_SUPPORTED | PASS |
| Display name/height replacement revisions | HEADLESS_SUPPORTED | PASS; new identity |
| Read live CK loaded project/plugins/selection | UNSUPPORTED | No proven public SDK path |
| Native CK bridge | EXPERIMENTAL (future only) | PENDING_OWNER; no implementation exposed |
| Native FaceGen | MANUAL_REQUIRED | Not automated |
| NIF/DDS structural inspection | HEADLESS_SUPPORTED | PARTIAL; rendering unproven |
| G245 pre-import handoff | HEADLESS_SUPPORTED | PASS; incomplete assets blocked |
| Asset registration/approval/runtime activation | MANUAL_REQUIRED | Existing owner gates preserved |
| Arbitrary NPC/plugin rewrite/ESL/weapon authoring | UNSUPPORTED | Fail closed / no schema |

Only the local stdio tooling was installed. No SkyMP/Launcher deployment or restart
was required; no game/world/economy/player data was written. Known-good runtime,
assets, approvals and signed distribution are unchanged. This task does not
certify or resolve the prior native crash/terrain issues.

## 12. Git delivery

Authorized checkout/branch: `skymp`, **dev/npc-activation-g241d**;
destination **frostveil** (`kaktv2016/skymp`), never upstream origin.
Changes: this report, implementation plan, and the dedicated tooling package
(schemas/service/SDK entry, C# adapter, lockfiles, build/install helpers, tests).
Generated binaries, proprietary assets, private config backups and receipts are
excluded. Commit/push receipts are recorded after verification below.

Verified delivery: implementation commit
**00846df60f144a1ee576e2ba2b4da79ef70d09a6** pushed successfully to
`frostveil/dev/npc-activation-g241d`; `git ls-remote` matched that exact hash.
This receipt is added by a subsequent documentation commit. No upstream or
force push, signing override, runtime deployment or proprietary asset commit.
Final package tests: **3/3 PASS** (51.9 seconds); relevant existing suites:
**28/28 PASS**. npm and transitive NuGet vulnerability checks reported no known
vulnerabilities. In-session source/diff/security review completed; no independent
native bridge or in-game acceptance is implied.
