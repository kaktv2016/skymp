# Phase 2.4 — RP dice and actions

2026-10-14: **SOLO MANUAL ACCEPTANCE PASSED — user confirmed all remaining checklist checks passed.** Screenshots show D20/D100, current RP name, Thai `/try` failure (3/5/6) and success (15), and D6 results 6/2 with throttle feedback. User separately confirmed invalid inputs for both commands, then confirmed the full solo checklist, including existing chat/commands/profile/focus and unchanged inventory/equipment/attributes/world. Focused automated tests were not run by the agent; user automated output/count and build/deployment output are not supplied. Two-player visibility/proximity remains **UNVERIFIED**. No commit or Phase 2.5 work.

`/roll` defaults to D20; `/roll 6`, `/roll 20`, `/roll 100` accept one integer die with 2–100 sides. `/try สะเดาะกุญแจหีบ` rolls D20: 11–20 succeeds, 1–10 fails. Results use `[ROLL]`/`[TRY]` prefixes in the existing DO chat renderer (`textContent`, no HTML interpolation). These are RP information only, without world, inventory, equipment, stat or quest changes.

`src/modules/dice/dice-service.ts` uses server Node `crypto.randomInt(1, sides+1)` and accepts an injected RNG for deterministic tests. `dice-module.ts` registers owned commands after `rp-chat`, reads the current native session and RP name, validates input before RNG, and releases registrations on shutdown. Runtime server options `dice: {tryDc:11, actionMaxLength:240}` can override DC (integer 1–20) and action length; actions must fit `chat.maxLength - 5`, counting Unicode code points after NFC normalization. Very small chat limits disable actions. Client requests cannot set these settings or supply results.

Existing `_onRpChatV1` transport, 750ms default throttle, bounded 64-request deduplication, session GUID checks and same-cell/range routing are reused. Sender gets self-echo; missing native location returns an error without global fallback. Rolls have no persistent character fields; their messages use the existing bounded chat inbox/history (40/100 defaults). No new timer, protocol, UI, database or dependencies. The bundle guard now permits only Node's `node:crypto` external import and records it in the build manifest.

## User-run build, tests and deployment

Exit Skyrim and stop the server in its owning terminal before deployment. Preserve the current world/config using the existing labelled deployment backup workflow; do not reset `rp-world`. Run:

```powershell
Set-Location 'C:\Users\basba\OneDrive\Desktop\skyrim-rp\skymp\rp-gamemode'
npm run test:dice
# Only after build/tests succeed:
npm run deploy -- --label phase24-dice
Set-Location 'C:\Users\basba\OneDrive\Desktop\skyrim-rp\skymp\build\dist\server'
node dist_back/skymp5-server.js
```

`test:dice` includes the existing build and focused dice/chat/command/profile suites; separate `npm run build` is unnecessary. Existing installed TypeScript/esbuild/Node types are reused. No CMake, native DLL rebuild, client webpack or UI installation is needed. Launch the existing Skyrim 1.6.1170 / SKSE 2.2.6 client manually with its existing localhost connection.

## Solo checklist

1. Connect and open RP Chat using the working key. Send `/roll`, `/roll 6`, `/roll 20`, `/roll 100`; verify one result per request within the die range.
2. Send `/try สะเดาะกุญแจหีบ` and several attempts (at least 750ms apart). Observe success/failure text with D20 result. Random outcomes may require more attempts.
3. Confirm the displayed RP name matches `/profile`; edit the name and verify the next roll uses it. Try Thai/emoji actions.
4. Reject `/try`, `/roll 1`, `/roll 101`, `/roll 2.5`, `/roll 6 fake-name` and an oversized action with readable feedback and no roll result.
5. Check normal/Thai chat, `/me`, `/do`, `/whoami`, `/profile`, profile Save/Cancel, F7/Escape and reconnect still work.
6. Compare inventory, equipment, attributes and nearby world objects before/after; rolls must change none of them.

Automated tests cover deterministic bounds, invalid input, DC thresholds, authoritative name, self-echo/local routing, forged fields, duplicate/throttled requests and reconnect. They use mocks and remain unexecuted. Real multiplayer routing requires a later two-client test; no multiplayer or gameplay PASS is claimed here.
