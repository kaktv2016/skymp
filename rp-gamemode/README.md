# Skyrim RP gamemode — Phase 2.1

Latest: [Phase 2.5 Courier](PHASE25.md), configured/deployed route and user-reported 41/41 tests. Screenshots verify accept/deliver, no repeated delivery reward, active-job/progress persistence after a real server restart and abandon without reward. Remaining focused solo checks are listed in the handoff; two-player remains UNVERIFIED. Prior Phase 2.4 solo PASS remains the baseline.

2026-10-14: [Phase 2.4 dice/actions](PHASE24.md): **full solo manual checklist PASSED, confirmed by user**. Screenshots show D20/D100/D6, Thai actions, RP name, success/failure and throttle feedback. Two-player remains UNVERIFIED. Automated results are not supplied; the agent ran no build/tests/deployment. No commit. Phase 2.3 manual checks1–5 were confirmed passed; see [PHASE23.md](PHASE23.md).

Latest source handoff: [Phase 2.3 profile commands and Character Sheet](PHASE23.md). Reuses schema1 identity and working CEF/chat; focused user command is `npm run test:profile` (build included), then labelled user deployment. No Phase 2.3 tests/build/deploy/gameplay were run by the agent. User confirms the six final Phase 2.2 solo checks passed.

Latest source handoff: [Phase 2.2 chat](PHASE22.md). Source adds owner-only chat/event UI and focused **unexecuted** tests; no Phase 2.2 build/deploy/game run was performed by the agent. Follow the labelled deployment commands there. The remaining sections preserve Phase 2.1 results (67 tests were previously passed; that is not a result for the modified Phase 2.2 source).

Original additive foundation for SkyMP engine `2849e676fe008925384b26f34476e382a30bd877`, baseline `5397cd3bf4666c942f78193107881d8cf0ac2748` on `develop`. The engine owns actor creation, login, appearance, inventory, equipment and location. This project writes only `private.rp.v1.identity` on an existing actor. No donor source was copied; project license follows the server's AGPL-3.0 license.

## Build and test

From this directory in PowerShell:

```powershell
npm run build
npm test
npm run test:native
npm run test:wrapper
```

Build uses existing inspected `../skymp5-server/node_modules` packages: TypeScript 5.4.5, esbuild 0.28.1, @types/node 22.10.2; previously executed with Node 24.11.1. It checks versions, compiles strict TS and negative type contracts, then bundles a single CommonJS `dist/rp-gamemode.cjs`. Phase 2.4 permits only built-in `node:crypto` as a runtime import; third-party imports remain rejected. The esbuild node16 target is a syntax target. The changed build has not been run by the agent. No dependency installation was performed.

`npm test` runs 67 Node tests. Native/wrapper checks additionally require the built `scam_native.node`, licensed installed masters, generated `data/` and the ignored audit pointer `../build/rp-audit/phase21/current-audit.txt`. They copy the backed-up world/config into unique fixture directories, use UDP 17777 / HTTP 17778, and preserve their evidence. Run the two integration commands sequentially; keep those ports free. They never run destructive upstream fixtures against the development world.

## Components and ownership

- `src/engine/ids.ts`, `mp-api.ts`, `adapter.ts`: distinct ActorId/UserId/ProfileId/FormDesc, checked native values and only eight needed native methods. Numeric slot 0 is a valid UserId; 65535 is rejected as the native disconnected sentinel.
- `src/core/module-registry.ts`: graph validation before initialization, dependency order, owned LIFO cleanup, reverse shutdown and partial failure rollback. Boot is one-shot.
- `src/core/command-registry.ts`: normalized names, duplicate detection, literal whitespace parsing, input limits and explicit handler outcomes. It has no chat/UI/network transport.
- `src/modules/identity/`: existing native profile/form mapping; schema-1 name and optional biography; idempotent creation and lookup. Unknown/corrupt metadata is preserved and reported.
- `src/runtime.ts`, `index.ts`: one owned 1-second observer of native online actors, an identity module and `/whoami` domain registration. Poll failures are isolated by actor; initial boot failure cleans resources and logs FAILED. No native hook is replaced.

Names initially use the native actor name (native fallback may be `Prisoner`); there is no RP name/bio editing interface in this phase. `private.` properties need no `makeProperty` registration in this exact engine, persist as native `dynamicFields`, and use no owner/neighbor replication. Schema is `{schemaVersion:1, displayName:string, biography?:string}`; names limit 64 code points, biography 512, and control characters are rejected.

`/whoami` requires an already trusted actor context, verifies the current native connection/profile mapping and only reads existing metadata. No verified input/output transport exists in this baseline: **do not type `/whoami` into a claimed in-game chat or treat it as a console command**. Tests dispatch it directly. No new client scripts, events or UI were deployed.

## Deployment and rollback

Exit Skyrim and stop the existing server with Ctrl+C in its owning terminal. Verify its process and UDP 7777 / TCP 3000 listeners exited; take a fresh separate backup of the world and configuration. Never delete/reset `rp-world`.

```powershell
npm run build
npm run deploy
```

The deploy command refuses occupied loopback server ports and writes a hash-named immutable bundle under `rp-gamemode/deployed/`. It backs up config/old gamemode and writes a rollback record **before** atomically switching only `gamemodePath`. It never edits world files. Backup location comes from the current ignored audit pointer. Same-config repeated deployment is a no-op; a new deployment after rollback or a different bundle requires an explicitly prepared new audit/backup directory. An interrupted deploy with an original config and an existing record should be inspected and rolled back before preparing a new deployment.

Start the unchanged server from `../build/dist/server`:

```powershell
node dist_back/skymp5-server.js 2>&1 | Tee-Object -FilePath logs/phase21-startup.log
```

Check `[rp] Phase 2.1 foundation ready`, absence of `[rp] foundation boot FAILED`, existing player count, both loopback listeners and authenticated metrics 200. HTTP/native startup alone does not prove the RP module booted: the upstream loader catches errors. Credentials remain in ignored server configuration and must not be copied into reports. Keep the deployed bundle unchanged; the upstream watcher can clear native gamemode registrations on edits, and RP hot reload is unsupported. Restart explicitly for changes. Generated `gamemode.js` remains untouched: `BUILD_GAMEMODE=OFF` engine builds regenerate it as empty, which is why config uses the separate absolute bundle path. After a native rebuild inspect configuration and verify the selected bundle again.

To roll back, exit Skyrim, stop the server and preserve the latest world/config first, then run:

```powershell
npm run rollback
```

It validates config and backup hashes, restores the previous config/gamemode selection and retains the **current** world, including newer inventory/progress and RP metadata. Unrelated config changes or a changed previous gamemode trigger a refusal for review. It does not restore an old world or overwrite native artifacts. Start the server normally and verify readiness. No live rollback was executed; automated isolated rollback tests passed.

## One-client acceptance — user operated

1. Use the existing Skyrim 1.6.1170 / SKSE 2.2.6 installation and launch `skse64_loader.exe`; retain localhost:7777 / offline profile 1. Do not create a new profile or character.
2. Check the existing character, item counts, worn equipment, appearance and spawn position against your known baseline. Walk briefly; report any missing/reset state or new error.
3. Stay connected at least 5 seconds. Server log should show `[rp] identity associated actor=ff000000 profile=1 schema=1`. The actor ID must match the native login log. The private identity is intentionally not displayed in the client.
4. Exit Skyrim normally, wait 5 seconds, relaunch the same loader/profile and compare character/items/equipment/position. Observe repeated association to the same actor and no second profile-1 actor in native storage. Log alone is not enough; inspect the actual saved `dynamicFields["private.rp.v1.identity"]` record.
5. Exit Skyrim and report reconnect results. Ask for the Phase 2.1 metadata restart check. Before restart, capture the saved metadata and native actor/profile plus a fresh world backup; wait until the new metadata is observed on disk. Ctrl+C is not assumed to flush unsaved state.
6. Restart the same server/world, relaunch the same client, compare all native state and the saved metadata, and confirm no duplicate actor. Compare metadata before/after from the real development save, not only an isolated fixture.

Manual tests and live RP metadata restart remain NOT TESTED until confirmed. Real addon save/reload in two separate fixture processes passed; it does not replace this game acceptance gate. No two-player requirement or 50–100-player capacity claim is made here. See [Phase 2.1 report](../docs/rp-development/PHASE21_BUILD_REPORT.md) and [manual checklist](../docs/rp-development/MULTIPLAYER_TEST_CHECKLIST.md). Phase 2.2 is not started.
