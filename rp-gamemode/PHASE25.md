# Phase 2.5 — Courier source handoff

2026-10-14: **Courier core solo loop, native server-restart persistence and abandon verified by user screenshots.** Accepted contract became active; delivery gave exactly 1 completed delivery / 1 reputation; repeated delivery returned no active contract. A newly accepted contract remained active after the requested server restart, with counters still 1/1. Abandon then cleared it to idle/null with counters unchanged. User previously supplied **41/41 automated tests passed**. Agent performed authorized builds/deployments and restarts; no automated tests rerun by the agent. Wrong-location rejection, duplicate accept, rapid input and existing-command regression checks still require explicit in-game confirmation for full solo checklist acceptance. Two-player remains UNVERIFIED. No commit or Phase 2.6 work.

`/job` help, `/job status`, `/job accept`, `/job deliver`, `/job abandon` use the existing registry/chat. Accept requires pickup proximity; delivery requires an active matching contract and destination proximity. Checks use the native actor/session and adapter `locationalData` getter, equal normalized cell/world descriptors and 3D distance. No teleport, client coordinates or completion flags are accepted. Job feedback is private to the requesting actor through the existing bounded System chat renderer. Thai route labels are supported.

`private.rp.v1.courier` holds schema1, active contract ID/null, idle/active lifecycle, completed count and reputation. Missing data is read as zero progress; help/status do not create metadata. Each transition writes one complete property and checks readback; completing clears the contract and increments both counters together. Abandon grants nothing. Corrupt/future fields and unknown active route IDs refuse mutation. Counts are bounded at 1,000,000,000; rewards are positive integer points (max 1,000,000). RP identity, items, gold, equipment and world positions are unchanged.

Current configured route (user devpos screenshot, first point interpreted as pickup and second as delivery): `courier-route-1`, cell `3c:Skyrim.esm`, pickup `[122694.9453125,-66909.78125,11639.1201171875]`, delivery `[123342.421875,-65940.078125,11686.185546875]`, radius200, reward1. Both development/devpos flags disabled again. Agent build succeeded and deployed `phase25-courier-route1`, bundle SHA256 `6b6cb195c2587f4f046652ae185fe30cbb1dc3db2db681a2ac9d87f41cd317d2`. Subsequent user-requested restart stopped PID7356 via Ctrl+C and selected the same bundle on PID20804, with listeners7777/3000 verified. Log: `build/dist/server/logs/phase25-restart-20261014-030109-stdout.log`. Route-capture instructions below remain available for future reconfiguration; no need to capture these points again.

The native `CustomPropertyBinding.cpp` private branch stores the full JSON in dynamic fields with `SetPropertyValueDump`; `LocationalDataBinding.cpp::Get` supplies cell/pos/rot. This reuses native save behavior, **not a crash-safe database transaction guarantee**. If persistence or feedback fails, check `/job status` before retrying; a native write may already have applied. Automated tests simulate property reload/failures; separate user screenshots now verify a real Ctrl+C server restart, not a forced-crash scenario.

## Configure a real route

Edit `src/config/courier.ts` only. Configuration is bundled: rebuild, deploy and restart after each change.

1. Set `development:true`, `devpos:true`, keep `route:null`. Build/test, then deploy with label **phase25-courier-devpos** using the commands below (substitute that label). Start server/client manually.
2. Visit the intended pickup and run `/job devpos`; record its exact `cell` and three `pos` numbers. Visit a distinct destination and repeat. The helper prints only the caller's authoritative position, writes no job/world state, and accepts no actor argument. It is disabled by default, is not production admin authorization, and does not trust offline profile1 as an administrator.
3. Stop game/server. Replace `route:null` with the commented template, replacing **all** placeholder cells/null coordinates with those recorded values. Configure stable `id`, display name, pickup/delivery labels, radius (positive, ≤10000 game units), and reputation reward. Same-cell spheres must be separated by more than twice the radius. Different cells cannot share an interaction zone. Validation checks descriptor shape/finite coordinates; manually recorded positions establish actual Skyrim validity.
4. Set `development:false`, `devpos:false`; test/build and deploy **phase25-courier**. Do not change an outstanding contract's route ID/endpoints/reward. Finish or abandon first; if an active ID is missing, restore its original route to resume. Do not edit saved metadata to recover it.

No guessed Skyrim coordinates are included. Synthetic test coordinates are fixtures only.

## User commands

Exit Skyrim and stop the server before deployment. Existing labelled deployment backs up the current world/config; preserve them and never reset `rp-world`.

```powershell
Set-Location 'C:\Users\basba\OneDrive\Desktop\skyrim-rp\skymp\rp-gamemode'
npm run test:courier
# Build is included above; deploy only if it succeeds:
npm run deploy -- --label phase25-courier
Set-Location 'C:\Users\basba\OneDrive\Desktop\skyrim-rp\skymp\build\dist\server'
node dist_back/skymp5-server.js
```

Use a fresh unique label if a previous record exists for a different deployment. Launch existing SKSE/client manually. No UI install, client webpack, CMake, DLL rebuild or dependency installation is needed. Rollback uses the existing `npm run rollback` workflow after stopping server/game; it preserves current world data.

## Solo acceptance

1. Run focused tests, configure the confirmed route, deploy and connect manually. Near pickup: `/job status`, `/job accept`; duplicate accept must not create a second job.
2. Deliver early or in a different cell: reject. Travel to destination, `/job status`, `/job deliver`: count +1, reputation +configured reward, active contract cleared.
3. Repeat `/job deliver`: no further reward. Return to pickup, accept again, disconnect/reconnect: same active contract and progress.
4. Restart server manually with an active job; verify status persists. Complete it, then restart and confirm completed count/reputation persist. Native saving is asynchronous; verify state has reached disk before shutdown rather than assuming Ctrl+C flushes it.
5. Accept/abandon another job: active cleared, progress unchanged. Check disabled route, invalid subcommands and rapid submissions return feedback.
6. Confirm normal chat, `/me`, `/do`, `/whoami`, `/profile` editing, `/roll` and `/try` still function.

Real solo/restart acceptance requires the user's confirmation. Two-player concurrency and future gold/item rewards remain unverified/out of scope.

Files: `src/modules/courier/{contracts,state,courier-service,courier-module}.ts`, `src/config/courier.ts`, `src/engine/adapter.ts`, `src/runtime.ts`, `src/modules/chat/chat-service.ts`, `tests/courier.test.cjs`, `package.json`, README and this handoff.
