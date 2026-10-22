# Third-party license review — source reuse intake

Audit date: 2026-10-13. Research only; no third-party code, asset, native library or dependency has been integrated. Exact revisions are listed below. Public GitHub visibility is not a license grant for deployment. GitHub metadata is a discovery hint; actual license files, package declarations and file provenance control the intake decision.

## Per-repository review

| Repository / exact revision | Inspected license evidence | Reuse decision and required notices |
| --- | --- | --- |
| `vinicius3232/skymp-heavy-rp` `f686977343156a2b188dc1271cabe9b2ae197e6a` | Root `LICENSE`: AGPL v3 text; `skymp/gamemode/package.json`: `AGPL-3.0-or-later`. Some helpers carry explicit Red House GPL provenance comments | Conditionally reusable after retaining license/copyright and recording changes. Treat copied gamemode derivatives as AGPL; settle the precise version declaration at intake and preserve inherited file notices |
| `alekcey0211/red-house-public` `65c66bb3e1b9f5765ed5fc036d69d75e3afbb53d` | Root `LICENSE`: GPL v3 text; client points to LICENSE; several workspace/server/modules package.json files instead say ISC; functions-lib package has no explicit license field | Do not claim permissive ISC for all modules. Use GPL intake requirements conservatively; clarify author/file-specific grants before selecting a different license. No code copied now |
| `skymp-team/skymp-gamemode` `bb77d388a4e5f45f2fffd91d418917344d6ddc8a` | `LICENSE.md`: MIT; copyright 2019 Leonid Pospelov; package declares MIT | Code copying can retain MIT notice; technical architecture is obsolete and mostly reference-only |
| `alekcey0211/skymp5-scripts` `fdd20ccbc95134d38a6deb92b4cefa08f85c107e` | No tracked LICENSE/COPYING or package license grant located; GitHub license null | **REJECT copied/translated code pending permission or compatible grant**. Reading and public fork for research do not imply deployment rights. Do not silently inherit GPL from another unrelated repository |
| `1kxzy/skyrp` `8d3059f8347e5c9041b34119e0b72e33ff67f226` | Root `TERMS.md` and per-project licenses; server AGPL v3, client/front/platform/scripts/savefile GPL v3, functions-lib/libespm/papyrus-vm/viet MIT. `skymp5-backend/LICENSE` MIT, copyright 2026 TheYIMIR; `skymp5-launcher/LICENSE` MIT, copyright 2026 Tecca; server-manager package MIT without its own tracked LICENSE in the inspected inventory | No whole-fork permissive grant. Separate intake by exact file/subproject. Backend/launcher scope is deferred; verify bundled resources/credits and manager grant before any future copy |
| `skyrim-roleplay/skymp` `456190b4780863e5277c33f2384976143cbe65a1` | Root TERMS and per-project licenses comparable to current engine; GitHub `NOASSERTION` | NOASSERTION means API cannot provide a single classification, not public domain or automatically unlicensed. Preserve every applicable subproject/third-party notice. Entire fork integration rejected technically |

Pinned license sources: [Heavy RP LICENSE](https://github.com/vinicius3232/skymp-heavy-rp/blob/f686977343156a2b188dc1271cabe9b2ae197e6a/LICENSE), [Heavy RP manifest](https://github.com/vinicius3232/skymp-heavy-rp/blob/f686977343156a2b188dc1271cabe9b2ae197e6a/skymp/gamemode/package.json), [Red House LICENSE](https://github.com/alekcey0211/red-house-public/blob/65c66bb3e1b9f5765ed5fc036d69d75e3afbb53d/LICENSE), [legacy gamemode MIT](https://github.com/skymp-team/skymp-gamemode/blob/bb77d388a4e5f45f2fffd91d418917344d6ddc8a/LICENSE.md), [SkyRP TERMS](https://github.com/1kxzy/skyrp/blob/8d3059f8347e5c9041b34119e0b72e33ff67f226/TERMS.md), [roleplay fork TERMS](https://github.com/skyrim-roleplay/skymp/blob/456190b4780863e5277c33f2384976143cbe65a1/TERMS.md).

## Current project license boundary

Current engine `2849e676fe008925384b26f34476e382a30bd877` also uses a mixed license layout. `skymp5-server/LICENSE` and its package declare AGPL v3; `skymp5-client/LICENSE` and `skyrim-platform/LICENSE` contain GPL v3; `skymp5-functions-lib/LICENSE` is MIT. `TERMS.md` summarizes them but is not a replacement for their text. Adding an external gamemode does not make these native/client obligations disappear.

Do not promise that putting a copied module in another folder, a dynamically required file or a separate process automatically avoids copyleft. The combined-work boundary depends on the actual integration. Recommend an openly licensed RP gamemode with a clear source offer and reproducible build instructions; preserve the identity of MIT/GPL/AGPL components and rights-holder notices rather than relabeling every donor file.

## Obligations relevant to intended adaptation

- MIT: preserve copyright and permission notice with copied software/substantial portions; record exact donor file/revision and your modifications. [MIT text](https://opensource.org/license/mit)
- GPL v3: preserve notices and license; identify modifications. When conveying covered binaries/modified source, provide the required Corresponding Source and license rights. Source delivery includes the applicable build/install material, not just a link to unchanged upstream when local changes exist. [GPL v3 text](https://choosealicense.com/licenses/gpl-3.0/)
- AGPL v3: preserve the same categories of notices/source obligations; for a modified covered program interacting remotely with users, section 13 requires an offered means to obtain its Corresponding Source. Determine the exact combined-work scope before deploying a copied RP stack. A GitHub repo that omits modifications/build materials is not automatically sufficient. [AGPL v3 text](https://choosealicense.com/licenses/agpl-3.0/)
- GPL v3 and AGPL v3 section 13 permit specified combinations while maintaining the relevant terms for respective parts. This is not permission to discard GPL notices or assume that unrelated proprietary resources become licensed. Check actual license/version grants for every selected file.
- Missing license: do not copy implementation, mechanically translate it to TypeScript or deploy modified source until an explicit grant is obtained. Independent implementation of functional requirements must not transplant protected expression. [GitHub guidance on missing licenses](https://choosealicense.com/no-permission/)

These are intake constraints for planning; no conclusion about all future combined works or asset rights is being asserted. A release review should evaluate the exact approved implementation and distribution/network deployment model.

## Dependency and asset provenance

Package manifests specify dependency ranges, not audited licenses for their full resolved trees. Clones retain existing lockfiles but no install/lockfile change was performed. Before importing code with a dependency, inspect its exact resolved package license, transitive dependencies, bundled binaries/resources and notices. Inventory captured at external research `dependency-inventory.json`; no complete production SBOM or vulnerability certification was performed in this audit.

| Donor area | Material to review before copying | Present conclusion |
| --- | --- | --- |
| Heavy gamemode | AGPL source; dotenv `^17.4.2`, mysql2 `^3.22.6`, ws `^8.21.0`; TS dev toolchain; GPL-origin helpers | Pure registry candidates avoid adopting this whole runtime dependency stack. Any copied helper retains its own provenance |
| Heavy frontend/launcher | Electron/UI packages, artwork/fonts, voice binaries and any bundled mod assets | Research-only; not approved or recommended for initial integration |
| Heavy `docs/legal/ASSET_LICENSE_REGISTRY.md` | Registry includes example/blank asset rows, not proof every proposed mod asset is cleared | Treat plugin meshes/textures/sounds permissions as unverified; do not package them |
| Red House frontend/data | Vue-era UI/font/localization and plugins/Papyrus assets, bundled legacy server-build artifacts | Root GPL does not establish rights to third-party game/mod resources. Reuse design descriptions first |
| SkyRP backend/launcher/manager | Separate MIT component notices, Electron/7zip/archives/store dependencies and fetched client/modpack resources | Excluded from Phase 2.0 integration; package/license words alone do not clear downloaded modpack assets |
| Both engine forks | `THIRD_PARTY_LICENSES`, every native port/import and per-project license | Replacing our engine would expand the review and regression surface unnecessarily |
| Skyrim master/BSA/Creation Club assets | Bethesda/mod-author grants independent of code licenses | Remain local owned game assets; never copy into this documentation/source repository |

Heavy `core/espm.js`, `core/hit-events.js` and `core/safe-zones.js` explicitly attribute Red House and say they adapted a technique without copying code. Preserve their provenance if reused, but do not treat those comments as independent verification of an entire repository's rights. Check chosen source line history/ownership when selecting code.

Additional checked-in constraints: Heavy gamemode package-lock root metadata still says ISC, unlike its package/root license; treat it as stale/conflicting metadata, not a permissive override. Fork `THIRD_PARTY_LICENSES` includes Tilted UI notices, installed vcpkg notices and font-specific terms, including Tavern Light's noncommercial limitation. K's bundled `skymp5-launcher/assets/7zip/License.txt` lists LGPL/BSD/unRAR terms. Retain and review these individually before shipping any such resource; do not assume an MIT launcher or GPL client clears every bundled font/binary/media file.

## Required attribution record for future approved copies

For each component maintain a manifest with upstream repository, full commit, original path, destination path, license/notice path, copyright holders, copied versus independently rewritten parts, modification date/summary and added dependencies. Include retained third-party notices in the source/bundle release and a source-offer route/document where applicable. Do not edit donor author claims to imply official SkyMP/Bethesda endorsement.

No attribution file for incorporated code is created now because no code is incorporated. This review records provenance for candidates only. All six research clones remain outside production source tree at `<LOCAL_PATH>`; public metadata snapshots and license inventory are retained there.

## License gate before implementation

1. Approve exact selected files and the intended RP gamemode license/source publication policy.
2. Resolve Red House ISC/GPL ambiguity if selecting its implementation; otherwise use conservative GPL conditions or independent functional design.
3. Obtain a grant for `alekcey0211/skymp5-scripts` before any code reuse.
4. Review actual dependency/resource notices for the selected closure and prepare the attribution manifest.
5. Validate the exact release/network source-offer process before public deployment. No external messages or permission requests to maintainers were sent by this audit.


### G1.2 original amber beacon artwork
PyNifly V29.1.0 (https://github.com/BadDogSkyrim/PyNifly, GPL-3.0) used only as a local authoring tool; no library/DLL/code redistributed or placed in Skyrim. New mesh and textures are generated from original mathematical geometry/gradients in mod-work/frostveil-courier-amber/src/generate_amber.py with no game asset input. Public pack-v1.0.2 ships only first-party assets/configs; Bethesda/SKSE/SkyMP and existing SkyUI remain external-only. No newly asserted permission to mirror SkyUI. Original Tel Mithryn asset remains in the owned Steam installation and is not uploaded.
