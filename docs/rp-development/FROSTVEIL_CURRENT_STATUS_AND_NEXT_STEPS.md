# Frostveil RP: current status and next steps

Updated: 2026-10-22 (Asia/Bangkok)

## Current status

Owner reports that the recent black-screen/controls issue is resolved after the terrain-aware spawn recovery release. Compass navigation and administrator commands are also reported to work normally. Launcher 0.1.21 is published; it delivers the reviewed client JS through Play and the signed updater. The fix accepts normal terrain settling within the same world/cell, avoids repeated relocation for facing differences, and records elapsed time and relocation attempts.

The owner’s in-game confirmation is the acceptance evidence for spawn recovery, compass and admin controls. Automated results recorded for the release: client 50/50, built client artifact 9/9, Launcher 481/481, packaged fixture smoke PASS, typecheck and NSIS build PASS; R2/GitHub anonymous hash checks PASS. See [terrain spawn recovery report](FROSTVEIL_TERRAIN_SPAWN_RECOVERY_REPORT.md).

The Courier feature set contains five live contracts, rank/permit progression, amber delivery effects, and native quest navigation records. Earlier implementation reports document automated and native-wrapper evidence, but do not prove every current online gameplay transition. The navigation/admin report predates the latest launcher and describes the initial authorization model; use it as implementation history, not as current play-test sign-off.

## Recommended next work

1. **Close the gameplay acceptance gaps in one session.** On the current client/server, accept a long Courier contract; verify objective in journal, compass and world map; approach a city and enter the destination building; confirm amber effect at the handoff/delivery point; deliver and verify the objective and effect clear. Reconnect once while the job is active and once while inside a building. Check spawn and navigation logs after each transition.
2. **Verify persistence that matters to players.** Discover a new map location, reconnect and confirm its icon remains. Confirm the active contract, RP balance, XP, permits, rank and discovered location survive a server restart using existing database/journal reads. Do not reset or migrate world data.
3. **Run a second-player isolation check.** With two accounts, confirm each player gets only their own Courier objective/beacon and that admin movement/test commands remain owner-only. Use a disposable Courier test for wrong-destination, completion, clear and reconnect cases; compare persistent economy records before/after to prove zero test rewards.
4. **Use a short stability soak before adding features.** Connect, enter/leave an interior, reconnect, and play for 20–30 minutes. Record disconnects, black-screen duration, controls state and any CrashLogger entry. Treat any renewed >30-second black screen, Not Responding state, or loss of movement as a regression with logs attached.

## Scope and release decision

Prioritize gameplay acceptance and persistence evidence before adding more commands, routes or launcher features. No server restart or modpack change is needed for these checks. If a gap requires code, implement only that gap, run the focused regression and packaged launcher checks when client delivery changes, then publish through the established R2/Launcher path. Keep the world/economy data and player-installed mods intact.

## Acceptance record

| Area | Current evidence | Next check |
|---|---|---|
| Spawn after reconnect | Owner reports resolved; automated terrain-offset regression passes | Reconnect outside and inside; inspect `restored`/`recovered` timing |
| Compass/admin | Owner reports normal operation | Exercise navigation and authorized admin actions in the same session |
| Courier route/amber | Implemented and tested in code; latest complete owner gameplay sequence not recorded here | Long route → city/building → amber handoff → deliver/clear |
| Discovered map locations | Persistence was previously reported missing; no subsequent pass evidence found in the reports reviewed | Discover, reconnect, confirm icon persists |
| Multiplayer separation | Server-side owner-only design documented | Two-account isolation and denied-admin check |
| RP progression persistence | G1.3 journal and native-wrapper tests documented | Compare the current player's record before/after reconnect/restart |
