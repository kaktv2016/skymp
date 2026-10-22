# Frostveil terrain spawn recovery — 2026-10-22

## Evidence and cause
At 20:09:46 Bangkok, the live client reported a 120-second restore timeout. Requested position was `[132715.3125,-94707.3203125,10846.70703125]`, observed `[132715.3125,-94707.3203125,10814.1904296875]`, same Tamriel worldspace and essentially identical yaw. The released client required a total XYZ distance <=8; terrain settling differed by 32.5166 Z units. The restore repeatedly requested relocation and retained its controls/output guard. This proves the controls failure; repeated scene transitions are the supported explanation for black-screen delay, pending gameplay verification.

## Changes
- Ship the existing separate horizontal 16 / vertical 64 tolerances and bounded relocation implementation. Wrong world/cell and distant positions remain rejected. Rotation is no longer a readiness condition or reason to relocate.
- Timeout recovery, the character callback, controls restoration and native operations execute in update context only. Current observation is collected before timeout evaluation; networking ticks cannot complete from stale coordinates.
- Completion runs once and restores only controls recorded as enabled before this service disabled them. Added elapsedMs, moveAttempts, actual/destination, scene-loaded and relocation diagnostics. Existing bounded recovery tolerance (32 horizontal /96 vertical), only for a fresh same-world/cell observation at failure, remains covered by tests.
- Launcher 0.1.21 authorizes reviewed client SHA-256 `67cec3774049606e635af3f4b6c84abe87a24ddc53d7392db9badb60a9fb69e6` and recipe 1.0.16. All other 648 recipe entries are unchanged. Existing exact prior hashes remain eligible for atomic repair; unknown clients remain refused.
- No server deployment/restart, world/economy writes, mod removal, native DLL change or direct installed-game writes are required. Client source includes previously approved NPC lifecycle safety work present in the workspace; its regression suite is included.

## Verification
- Client webpack / TypeScript: PASS; source regression suite: 50/50.
- Actual webpack artifact, using the real modules with mocked native boundary: 9/9, including the captured terrain position, wrong cell, reconnect/stale callback, timeout context and initially disabled controls.
- Launcher regression suite: 481/481. New recipe authentication test plus existing focused recipe tests: 4/4.
- Launcher TypeScript and NSIS build: PASS; packaged Electron fixture smoke: PASS.
- Disposable repair fixture: old and missing client repaired; running game refused; failed/corrupt download retained old bytes; second Play changed zero files; 649 recipe targets, 648 unchanged.
- Smoke revealed a test synchronization issue: rollback status text arrives before asynchronous receipt refresh. The assertion now polls the actual installedVersion rather than asserting prematurely; no production rollback logic changed.

## Delivery and rollback
Publication uses content-addressed R2 client, source ZIP and recipe, plus signed GitHub Launcher updater assets and corresponding Launcher/client source. Sealed hashes and anonymous verification are under `skyrim-rp-launcher/.local/spawn-terrain/delivery`. Existing immutable objects/releases are retained. Launcher repair verifies and backs up the prior client before atomic replacement. Any distribution rollback must be a newly signed forward release authorizing the reviewed prior identity; never manually overwrite the player installation.

## Gameplay acceptance — pending owner
Close Skyrim, update Launcher to 0.1.21, Play, enter the server, verify picture and movement. Exit/reconnect at the same exterior position, then repeat in an interior. Inspect spawnResume logs for scene-loaded -> restored/recovered, elapsedMs and bounded moveAttempts, without the prior 120-second timeout. Automated native mocks cannot certify real graphics/loading timing. No claim of final gameplay acceptance until this is observed.
