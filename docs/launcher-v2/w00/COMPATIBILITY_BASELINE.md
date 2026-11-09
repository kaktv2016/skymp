# Launcher V2 W00 compatibility baseline

## Proposed first-release profile

**PROPOSED** — One Windows x64 normal-player profile using licensed Steam Skyrim Special Edition in English and an authenticated `1.6.1170.0` cohort. Reuse the existing normal-player connection settings shape and port 7777. Keep the owner-approved endpoint identity and exact compatible server/client pair as a release prerequisite. [Runtime profile](https://github.com/kaktv2016/frostveil-launcher/blob/29641f25666cf492614374770f5ae1808b90ca2c/FROSTVEIL_RUNTIME_NORMALIZATION_REPORT.md#L7) · [Steam policy](https://github.com/kaktv2016/frostveil-launcher/blob/29641f25666cf492614374770f5ae1808b90ca2c/src/main/runtime/policy.ts#L8)

| Required pin | Status | Evidence or release prerequisite |
|---|---|---|
| Launcher | OBSERVED baseline | Source pin `29641f25666cf492614374770f5ae1808b90ca2c` declares 0.1.30. A candidate installer, updater envelope and exact release IDs/hashes still need release-gate receipts. [Version](https://github.com/kaktv2016/frostveil-launcher/blob/29641f25666cf492614374770f5ae1808b90ca2c/package.json#L3) |
| Skyrim and helper | OBSERVED baseline | Steam app `489830`, English, `1.6.1170.0`, three reviewed depot/manifest pairs in the dated receipt and DepotDownloader `3.4.0`. Before pilot, authenticate the fresh signed cohort and compare its manifests, helper and file digests. [Depot evidence](https://github.com/kaktv2016/frostveil-launcher/blob/29641f25666cf492614374770f5ae1808b90ca2c/FROSTVEIL_RUNTIME_NORMALIZATION_REPORT.md#L20) · [Cohort checks](https://github.com/kaktv2016/frostveil-launcher/blob/29641f25666cf492614374770f5ae1808b90ca2c/src/main/runtime/policy.ts#L29) |
| SKSE | OBSERVED historical version | SKSE64 `2.2.6` is reported in the Steam-only bootstrap, including its loader/runtime and scripts. Pin exact loader, runtime and script bytes to the selected verified bootstrap manifest before the pilot. [Bootstrap SKSE evidence](https://github.com/kaktv2016/frostveil-launcher/blob/29641f25666cf492614374770f5ae1808b90ca2c/FROSTVEIL_FRESH_INSTALL_AND_RELOCATION_REPORT.md#L12) |
| SkyMP client and Skyrim Platform | OBSERVED partial pin | Pinned source gives JS SHA-256 `67cec3774049606e635af3f4b6c84abe87a24ddc53d7392db9badb60a9fb69e6`. Native contract enumerates both SKSE plugins, platform implementation and version library. A dated 0.1.26 renderer DLL pin is historical. The exact complete signed native/browser bundle, ABI and compatible server identity for the pilot remain UNKNOWN until verified together. [JS pin](https://github.com/kaktv2016/frostveil-launcher/blob/29641f25666cf492614374770f5ae1808b90ca2c/src/main/client-repair-pin.ts#L2) · [Native target contract](https://github.com/kaktv2016/frostveil-launcher/blob/29641f25666cf492614374770f5ae1808b90ca2c/src/main/modpack/native-requirements.ts#L1) · [Historical DLL pin](https://github.com/kaktv2016/frostveil-launcher/blob/29641f25666cf492614374770f5ae1808b90ca2c/FROSTVEIL_0_1_26_NATIVE_CURSOR_REPORT.md#L4) |
| Signed player pack and load order | OBSERVED dated evidence | Pack `1.0.9` is the reported signed baseline. Pin fresh signed server profile, pack/payload hashes and ordered official/free inputs for the selected cohort. Paid/extra Creations remain preserved through the existing Restore contract. [Creation and transaction policy](https://github.com/kaktv2016/frostveil-launcher/blob/29641f25666cf492614374770f5ae1808b90ca2c/FROSTVEIL_RUNTIME_NORMALIZATION_REPORT.md#L10) · [Pack expiry](https://github.com/kaktv2016/frostveil-launcher/blob/29641f25666cf492614374770f5ae1808b90ca2c/FROSTVEIL_RUNTIME_NORMALIZATION_REPORT.md#L63) |

**Excluded profile scope** — GOG, Epic, Game Pass, non-English runtimes, other runtime versions, arbitrary loose/native mods, dev port 17777 and paid-AE gameplay certification. This profile is a proposal based on source and dated fixture evidence. [Dev profile refusal](https://github.com/kaktv2016/frostveil-launcher/blob/29641f25666cf492614374770f5ae1808b90ca2c/src/main/runtime/service.ts#L32) · [Owner acceptance limits](https://github.com/kaktv2016/frostveil-launcher/blob/29641f25666cf492614374770f5ae1808b90ca2c/FROSTVEIL_RUNTIME_NORMALIZATION_REPORT.md#L65)

## Committed bootstrap identities

**OBSERVED — pinned envelope contents.** The decoded payload of the bundled runtime envelope declares 7,390 managed entries. Envelope SHA-256 is `afa1797f61b7ca76189d15e6d55be10829076e41bedd139d220f999d70f94214`. The values below are declarations at the approved Git pin. A fresh authenticated candidate bundle, installed byte and ABI verification, and compatible server identity remain separate pilot gates. The local baseline declares Skyrim `1.6.1170.0` and SKSE FileVersion `0.2.2.6` under `public-profile-unconfigured`. [Bundled envelope](https://github.com/kaktv2016/frostveil-launcher/blob/29641f25666cf492614374770f5ae1808b90ca2c/assets/runtime-1170.json#L1) · [Unconfigured local baseline](https://github.com/kaktv2016/frostveil-launcher/blob/29641f25666cf492614374770f5ae1808b90ca2c/assets/local-baseline.json#L1)

| Payload path | Bytes | SHA-256 |
|---|---:|---|
| `Data/Platform/Distribution/RuntimeDependencies/SkyrimPlatformImpl.dll` | 15676928 | `c91b5ed52adf1328877366c9497a668e2abaf1c5314b2b9ed422b762320f1a66` |
| `Data/Platform/Plugins/skymp5-client.js` | 1451296 | `67cec3774049606e635af3f4b6c84abe87a24ddc53d7392db9badb60a9fb69e6` |
| `Data/SKSE/Plugins/MpClientPlugin.dll` | 1477632 | `777e539115ebb03c3202af7fcd357ebed4558f5f53fe6c610ca317b7da4d80a5` |
| `Data/SKSE/Plugins/SkyrimPlatform.dll` | 149504 | `7247563330f38ead8cb2d3284bc2f721552b74a118a4045509c437227348b765` |
| `Data/SKSE/Plugins/versionlib-1-6-1170-0-1.bin` | 795210 | `ac6d17e8a4bb4da2539e7a571113bcb28ae5adf4874cd977332f1a5215f65c07` |
| `Data/SKSE/Plugins/versionlib-1-6-1170-0.bin` | 795129 | `c4093c569a3c83b26587f4b9ea4c55de9ae6e73b84a2af9fb3fbd30e2fe0d452` |
| `skse64_1_6_1170.dll` | 1173504 | `c9a2c8a80df6bf2372c5f49468bb2e5ab67786157265b6f29ece9f4eac075d54` |
| `skse64_loader.exe` | 225792 | `730c2743f6871fbaeb8606c1d3b7a55feca045c3d74858a41b0c6d03cd989fbc` |


## Later gates

| Evidence owner | Scenario and pass condition |
|---|---|
| Automation in isolated fixtures | Cold missing depots reaches verified Ready. Warm cohort skips depot helper and game apply. Staged reuse proves exact hash/size; expiry, cancellation, wrong content and tampered links fail safely. Verify checks runtime/SKSE/SkyMP and signed pack identities. Interrupted Apply/Restore recovers exact preimages and preserves conflicts and user data. |
| Release and native reviewers | Match signed installer, manifests, payloads, runtime ABI and server/client bundle on the same candidate. Pass real isolated NSIS install/update/handoff/cleanup. |
| Owner, later authorized build | Verify a fresh released-GUI three-depot batch, then warm Prepare and Verify. Confirm Play, join, reconnect and Restore on the named profile, with observed in-game behavior and the intended server identity. Record actual Restore outcome separately from fixture evidence. |

W00 supplies no fresh fixture, native or owner gameplay result. [Existing fixture coverage](https://github.com/kaktv2016/frostveil-launcher/blob/29641f25666cf492614374770f5ae1808b90ca2c/tests/runtime-preparation.test.ts#L180) · [Approved W00 acceptance](../../ai/milestones/launcher-v2-w00-baseline/ACCEPTANCE.md)
