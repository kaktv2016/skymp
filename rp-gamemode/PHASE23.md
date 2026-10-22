# Phase 2.3 — Profile commands and Character Sheet source handoff

## Latest result — solo acceptance PASSED by user

2026-10-14: user confirms **“1–5 ผ่าน”** for the five-item handoff checklist: (1) `/profile`, Thai name/biography editing and Save; (2) reopen saved values, Cancel and blank-name rejection; (3) Escape/F7 restores gameplay controls; (4) profile persistence after reconnect and manual server restart; (5) `/whoami`, `/me`, `/do` and existing character/items remain correct. These are real one-player results reported by the user, not agent-run tests. Phase 2.3 solo acceptance is complete for this scope. Automated test output/count was not provided. Direct `/setrpname`, `/setbio`, `--clear`, extended validation/throttle cases and live rollback were not separately reported; do not invent their manual results. Two-player testing remains deferred; no Phase 2.4 or commit.

The implementation/handoff statements below describe source-work history. Their earlier pending gameplay statuses are superseded only for the five confirmed checks above.

2026-10-14 (Asia/Bangkok). User confirms all six final Phase 2.2 solo checks passed. Phase 2.3 code and focused tests are written; builds/tests/deployments/gameplay/persistence have **not been run or verified** by the agent. No game files, DLLs, live world or auth settings were modified; no commit or Phase 2.4.

## Implementation

- Extend existing identity service/commands; persist the same schema1 `private.rp.v1.identity` on the same native actor. Native name/appearance/inventory/equipment/location setters are not added.
- `/profile` sends an owner-only readable System response and opens Character Sheet when its UI is ready; `/setrpname [name]`, `/setbio [description]`, `/setbio --clear` share identity validation with UI Save. `/whoami` remains its existing single handler. Normal chat and `/me` read the updated RP name.
- Defaults: name 2–40 Unicode code points, biography 0–240, update interval1000ms; configurable through `RuntimeOptions.profile`. NFC + whitespace normalization preserves Thai/combining marks; biography newlines/tabs become spaces. Unsupported controls, malformed surrogates, unknown patch fields and oversized raw text reject before a single metadata write.
- Existing schema1 name up to64/biography up to512 stays readable without migration; supplied edited fields must satisfy new limits. Existing unsupported schemas/unknown metadata fields are refused and left untouched, not silently rewritten.
- Reuse `_onRpChatV1` and `rpChatInboxV1` owner property, with strict profile-read/profile-save payloads. Profile DTO exposes only schema/name/biography/limits, no actor/profile/account/GUID. Each request resolves current native ownership; validation failures preserve existing metadata. Bounded chat dedup/throttle plus per-session profile update throttle remain active.
- Sheet is injected into the same working CEF page alongside chat. Save is explicit; Cancel/Close discards draft; errors retain edits; timeout permits recovery. Server metadata persists through native storage; drafts do not. A persisted old response cannot open UI without a matching current `/profile` request.
- Chat→Sheet and Sheet→F7-chat transfer the existing focus lease without native false→true focus changes that could hide Cursor Menu. Actual close/menu/disconnect restores controls; disconnect clears drafts. Source-only review found and corrected this focus issue; no runtime PASS is claimed.

## User commands

Exit Skyrim and stop your server with Ctrl+C before deploying. These commands require existing installed packages only; no CMake/native/client-webpack rebuild. `test:profile` already builds the bundle and runs profile + directly affected identity/command/chat tests, including strict/type-contract compilation. It does not launch native integration fixtures/server/game.

```powershell
cd C:\Users\basba\OneDrive\Desktop\skyrim-rp\skymp\rp-gamemode
npm run test:profile
```

Only after it passes:

```powershell
npm run deploy -- --label phase23
cd C:\Users\basba\OneDrive\Desktop\skyrim-rp\skymp\build\dist\server
node dist_back/skymp5-server.js
```

`phase23` record was absent during source inspection. If that label already contains a different deployment when you execute, preserve it and select a new unique label (`phase23-fix1`) consistently for deploy/rollback. Existing tools backup the latest world and select an immutable bundle; they never restore old world data by default.

HTML bootstrap is unchanged: no new UI installation is needed for the currently working Phase 2.2 client. Both panels' source is bundled/delivered by the server. For an installation missing the existing `Data/Platform/UI/rp-chat/index.html`, user-run `npm run install:ui` adds the existing page safely; different existing content is refused. No native DLL/game modification.

## One-player acceptance

1. Launch existing SKSE, connect same character, F7 chat → `/profile`. Confirm current name/biography from server and one sheet. If UI unavailable, the System chat response remains readable.
2. Edit both fields, including Thai, and click Save. Wait at least one second between updates. Reopen `/profile`: confirmed server values should return. Native Skyrim character name/appearance should stay unchanged.
3. Type edits then Cancel/Escape; reopen to confirm unsaved changes were discarded. F7 should switch Sheet back to chat; close restores walking/look. Inventory/console menus close panels; Cursor Menu alone must not close them.
4. Try blank name, name over40, biography over240; error should preserve prior saved values. Test `/setrpname Aldric Stormborn`, `/setbio A former soldier`, `/setbio --clear`, `/whoami`; wait one second between edits. Commands and UI must read the same profile.
5. Exit/reconnect; `/profile` retains values with no duplicate panel. After a successful save allow the native save cycle to run, exit game, manually Ctrl+C/restart this same server/config/world, reconnect and confirm `/profile`/`/whoami`. Do not reset or restore old world files.
6. Confirm normal chat, `/me`, `/do` still work with new RP name, and the same native character/items/equipment/position remain. No combat/crafting/container/NPC or two-player acceptance is required for this slice.

Rollback code selection, with game/server stopped and current progress preserved: `npm run rollback -- --label phase23` from rp-gamemode (use your actual label). Latest world and edited schema1 metadata remain; rollback does not undo profile edits. No new database/migration.

Main files: identity-service/module + new profile-validation; chat-service/contracts/bridge/UI; runtime; new profile-ui; profile/profile-client tests; package script and README. Five solo acceptance checks now pass by user confirmation as recorded above; automated result totals remain unavailable.
