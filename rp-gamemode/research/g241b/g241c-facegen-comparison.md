# G2.4.1C FaceGen comparison evidence

This narrow comparison addresses only the FaceTint material question. It does not certify rendering, skin bindings, scene hierarchy, geometry, outfit closure, or catalog approval.

## Method and reference

Read-only source was the installed Skyrim SE `Data` directory. A new bounded C++ helper uses the already installed `rsm-bsa 4.1.0` library to read and decompress one explicitly named BSA member (32 MiB maximum), writing only the caller-selected audit output. No archive-wide extraction or archive modification occurs. Reference: `Skyrim - Meshes0.bsa`, `meshes/actors/character/FaceGenData/FaceGeom/Skyrim.esm/000A2C8E.nif` (Lydia). Its extracted SHA-256 is `cbcd6c760a440d814fa71ff5d81f78dc24ad096b2cf7a7c99f29a09a782bbaa0`; the actual file is ignored under `build/rp-audit/g241b/tools/vanilla-lydia.nif`.

Comparison uses existing bounded `g241b-nif-structure.cjs` decoding: SSE 20.2.0.7 / BS100 header, block table, type-4 `BSLightingShaderProperty`, leading flags and referenced `BSShaderTextureSet` slot strings. It is a semantic material comparison for the narrow fields it decodes, not a full NIF parser.

## Findings

| Asset | SHA-256 | Face shader flags (1 / 2) | Slot 3 detail | Slot 6 tint | Static result |
|---|---|---|---|---|---|
| Vanilla Lydia reference | `cbcd6c760a440d814fa71ff5d81f78dc24ad096b2cf7a7c99f29a09a782bbaa0` | `2185238275 / 33587233` | `Actors\Character\Male\BlankDetailmap.dds` | `data\Textures\Actors\Character\FaceGenData\FaceTint\Skyrim.esm\000A2C8E.dds` | Matching material reference |
| Female `00005901.nif` | `e0e44eb8112c9b10bc9e6b547bf8a671152b2cd8714629ae7b9383c0d19d2aa3` | `2185238275 / 33587233` | `Actors\Character\Female\FemaleHeadDetail_Rough.dds` | Empty | `PENDING_GAME_RENDER` |
| Male `00005906.nif` | `6a2ba2bb0139999d8b88aaeda389479dc11bdc1620edd6ab559325527a678458` | `2185238275 / 33587233` | `Actors\Character\Male\MaleHeadDetail_Age40.dds` | `Data\Textures\actors\Character\FaceGenData\FaceTint\FrostveilNPCTest.esp\00005906.dds` | `PASS_STATIC` for path form and expected identity |

The comparison demonstrates that a populated slot 6 and `Data\Textures` path form occur in a known-good vanilla SSE NIF with exactly matching shader flags. The male prefix is therefore not a static incompatibility and must not be normalized based only on its spelling. The female tint DDS exists at the expected owner path, but the NIF texture set does not point to it; this comparison gives no evidence that the engine supplies that absent material link through another mechanism. No repair or staged NIF rewrite was made. This does not establish a requirement to re-export in Creation Kit. Treat the empty slot as a declared visual uncertainty in a narrowly authorized isolated test after hard resource, identity and delivery gates pass.

The prior Creation Kit warning cannot be tied to these exported files by this byte comparison. No renderer or in-game result is claimed. Both faces remain `PENDING_GAME_RENDER`; the female has a concrete static material-link discrepancy.

## Reproduction and API

Build the selected-member reader using the existing VS/vcpkg command in `research/g241b/README.md`, substituting `bsa-member-read.cpp`, output name `bsa-member-read.exe`, and `bsa-member-read.obj`. Example arguments:

```powershell
& build\rp-audit\g241b\tools\bsa-member-read.exe `
  'C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition\Data\Skyrim - Meshes0.bsa' `
  'meshes\actors\character\FaceGenData\FaceGeom\Skyrim.esm\000A2C8E.nif' `
  'build\rp-audit\g241b\tools\vanilla-lydia.nif'
```

Run `node --test rp-gamemode/research/g241b/tests/g241c-facegen.test.cjs`. The reusable API is `compareFacegen({ vanillaBytes, authoredBytes, expectedTintPath })` from `rp-gamemode/scripts/g241c-facegen.cjs`; `compareFiles(vanillaPath, authoredPath, expectedTintPath)` is a file wrapper. Machine-readable output was written to ignored `build/rp-audit/g241b/tools/g241c-facegen-comparison.json`.
