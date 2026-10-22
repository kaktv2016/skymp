# Phase 2.1 RP foundation implementation plan

> Execution: inline using `superpowers:executing-plans`; independent registry units may use focused parallel agents. No automatic commits. The user's Phase 2.1 specification authorizes this implementation; the earlier audit remains the source of constraints.

**Goal:** Add a small original TypeScript gamemode without replacing the validated native character/world state.

**Architecture:** A single CommonJS bundle uses an injected, minimal native API facade. An owned module scope manages commands and resources; one identity module observes native online actor IDs and writes only a private versioned RP metadata property. `/whoami` is a read-only domain handler; no unverified in-game transport is added.

**Tech stack:** Existing Node 24.11.1, TypeScript 5.4.5 and esbuild 0.28.1 already installed under `skymp5-server/node_modules`; Node built-in test runner. No download/install, SQL or donor code copy.

**Spec:** User attachment `<LOCAL_PATH>`; [architecture](PHASE2_RECOMMENDED_ARCHITECTURE.md).

## Constraints and review focus

- Preserve `develop`/baseline source and all native actor, profile, inventory, equipment, appearance and location ownership.
- Back up existing world/config/empty gamemode and artifact fingerprints before deployment. No world reset or game/client writes.
- Verify private property behavior and save/reload with the real addon in a disposable copied world, never upstream destructive CTest against `rp-world`.
- Reject invalid/stale ID mapping, unknown metadata schema and corrupt records without overwrite.
- Clean commands/timers and other owned resources on partial module failure and controlled shutdown; repeated boot cannot create duplicate resources.
- Tests must cover user slot 0, large profile IDs, malformed native responses, immutable native fields, command parser/error outcomes, dependency cycles and cleanup errors.
- No claim of manual success, two-player capacity or Phase 2.2 readiness without evidence; 50–100 players is a future measured target.

## Task 1 — baseline and source contracts

- [x] Inspect `ScampServer.cpp`, native property bindings, loader/build effects and current live configuration.
- [x] Back up current development world/config/gamemode and relevant binaries in ignored `build/rp-audit/phase21/`.
- [x] Create source-grounded tests before the adapter implementation.

## Task 2 — build and minimal registries

Files: `rp-gamemode/package.json`, `tsconfig.json`, `.gitignore`, `scripts/build.cjs`, `src/core/command-registry.ts`, `module-registry.ts`, and paired `tests/*.test.cjs`.

- [x] Write and observe failing command tests, then implement normalized registration/duplicate detection, parsing and explicit outcomes.
- [x] Write and observe failing lifecycle tests, then implement dependency ordering, cycle/missing dependency rejection, owned cleanup and reverse shutdown.
- [x] Build with existing inspected tools; tests require `.test-build/` CommonJS modules. Runtime bundle must have no bare dependency imports.

## Task 3 — adapter and identity module

Files: `src/engine/ids.ts`, `mp-api.ts`, `adapter.ts`, `src/modules/identity/identity-service.ts`, `identity-module.ts`, `src/runtime.ts`, `src/index.ts`.

Interfaces: separate nominal numeric ActorId/UserId/ProfileId and FormDesc; verified `get(0,'onlinePlayers')`, actor profile mapping, actor/user/GUID mapping, actor name/descriptor and private property get/set. Identity property: `private.rp.v1.identity`, schemaVersion 1, displayName and optional biography. No native state setters are exposed.

- [x] Write failing ID/API and identity tests, including malformed records and no-overwrite native invariants.
- [x] Implement original minimal adapter and idempotent identity creation/lookup. No second actor, SQL mirror or native writes beyond the RP namespace.
- [x] Register `/whoami` with a trusted actor context; lookup only, never identity creation. Keep transport separate.
- [x] Own one online-actor observation timer; no monkey-patched login/spawn/native hooks or speculative client interface.

## Task 4 — real native integration and deployment

Files: `scripts/native-integration.cjs`, `scripts/deploy.cjs`, `scripts/rollback.cjs` (or equivalent explicit verified procedures), `README.md`.

- [x] Build/run all domain/source-contract tests.
- [x] Instantiate the existing addon on a disposable copy of the saved world, write RP metadata to the existing actor, drive ticks until saved, terminate and reload in a new process. Compare RP metadata and native physical state.
- [x] Check actual Node wrapper/temp loader can load the self-contained bundle on a disposable runtime.
- [x] Deploy a hash-named immutable bundle at an approved absolute path outside generated engine output; switch only gamemodePath after preserved backup and controlled server stop. Do not modify world during deployment.
- [x] Verify startup, listener/metrics health and unchanged native artifacts. Leave the server ready for the user's client test.
- [x] Rollback restores previous gamemode configuration while retaining current world; never restore an old world over current player progress automatically.

## Task 5 — documentation/manual gate

- [x] Update BUILD_REPORT, architecture/progress and MULTIPLAYER_TEST_CHECKLIST with exact results/known errors and deployment/rollback paths.
- [x] User confirmed existing actor/items/equipment/appearance/location and reconnect with RP bundle; actual logs/save confirm same actor/profile, schema1 RP metadata and one player record.
- [x] Back up latest 13-file world/config; restart actual development server; verify ready/listeners/metrics, unchanged configuration/world/metadata on disk.
- [ ] User checks post-restart game state; inspect new native/RP association and saved metadata against the captured snapshot. `/whoami` in-game is NOT EXPOSED while transport remains unverified.
- [x] Stop at the manual test instructions. Do not auto-commit or start Phase 2.2.
