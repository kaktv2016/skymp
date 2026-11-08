# Frostveil architecture map

| Area | Entry points and contracts |
|---|---|
| SkyMP native | Root CMake, `unit/`, `libespm/`, `skymp5-server/`, `skymp5-client/`, `skyrim-platform/`. Pin native artifacts and ABI before changing runtime. See [build tips](../../CLAUDE.md). |
| RP runtime | `rp-gamemode/src/index.ts` and `src/modules/`. Existing server authority owns G1 gameplay/economy/persistence and G2 NPC Registry/Dialogue. Reuse the existing command/session boundaries. |
| Blueprint Studio | `blueprint-editor/` React/TypeScript authoring and management UI; RP server owns permissions and persisted mutations. Its build identity is paired with the RP bundle for deployment. See [G2.3](../../FROSTVEIL_G2_3_BLUEPRINT_REPORT.md). |
| NPC assets/runtime | [G2.4.5](../../FROSTVEIL_G2_4_5_NPC_ASSET_PIPELINE_REPORT.md) stages and validates sources and immutable candidate snapshots. [G2.4.6](../../FROSTVEIL_G2_4_6_RUNTIME_ONBOARDING_REPORT.md) gates catalog/profile activation on reviewed identity, restart, and v2 mapper proof. Preserve assignments, UUIDs, anchor and passive protection. |
| Creation Kit tooling | `rp-gamemode/tooling/frostveil-creation-kit-mcp/` uses the headless Mutagen adapter and the existing validators. It authorizes scratch outputs within a narrow reviewed preset. [MCP report](../../FROSTVEIL_CREATION_KIT_MCP_REPORT.md). |
| Launcher | Sibling `skyrim-rp-launcher`, Electron main/preload/React renderer. `src/main/distribution/` owns signed distribution and transactional install/recovery. Relevant entry points include `scripts/tests.mjs`, `scripts/npc-runtime-seal.mjs`, `scripts/production-gate.mjs`, and `scripts/sign-launcher-release.mjs`. Read its checked-in README and release reports before a release. |
| Dev runtime | [Local server entry](../../FROSTVEIL_SERVER_START.md) checks paired code/editor artifact hashes and local settings. Exact runtime identity comes from fresh receipts and read-only inspection. |
