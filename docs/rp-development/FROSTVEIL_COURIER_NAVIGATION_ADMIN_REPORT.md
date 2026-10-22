# Frostveil — Courier Navigation & Admin Movement

Date: 2026-10-18. Existing `develop` checkout. One implementation and delivery; no commit, push, publication, live-server restart or installed-game write.

**Status: implementation and local delivery candidates prepared; owner approval and Skyrim gameplay acceptance pending.** Native map/compass rendering and TCL operation are not certified by the automated tests. Automatic movement restoration across a full save/character reload remains limited as described below.

## Implemented behavior

- A regular, shared `FrostveilCourierNavigation.esp`: six reusable **Side Quest** records, objectives, reference aliases and six persistent invisible XMarkers. Five destinations match the current accepted Courier coordinates; the sixth is an administrator-only, no-reward Riften Bee and Barb fixture.
- Native journal titles, objective instructions and descriptions are English. Existing RP chat shows Thai destination details and frozen RP/XP quotes. Client failures are shown in the RP UI and console without stealing input focus.
- Native objectives are independent of the existing beacon's 8192-unit limit. Existing beacon controller, meshes, textures, brightness and animation are unchanged.
- The controller uses `Game.getFormFromFile`, `Quest`, `ReferenceAlias`, displayed objectives and active tracking. It retains numeric IDs/data rather than native wrappers across asynchronous calls. Cancellation, replacement, disconnect, expired source and reconnect invalidate obsolete work. Same-job door handoffs preserve manual untracking.
- The server's read-only navigation view uses accepted contract snapshots. It does not migrate, reconcile or flush money in ambient updates. Unknown coordinates do not get an obsolete native marker; existing contracts and server delivery checks remain authoritative.
- Native city/door routing is the default. `/admin navtest doors` switches the test target to verified entry references by current world/cell; `/admin navtest native` selects native routing again. Neither changes locks, doors, navmesh, real contracts, money or XP.
- No native DLL, new visible world object, Bethesda record override, currency, job route, reward change or player-data schema change was introduced. Child GRUPs refer to existing master world/cell records.

## Administrator commands and authority

| Command | Behavior |
| --- | --- |
| `/admin fly on` / `/admin fly off` | Request local native TCL flight/collision toggle, tracked to prevent repeated requests toggling twice. |
| `/admin speed 1..5` | Speed multiplier relative to the captured pre-admin SpeedMult; changes apply as owned deltas rather than cumulative multiplications. |
| `/admin speed reset` | Remove the owned speed delta. |
| `/admin reset` | Request flight off, original speed, and navigation test off. |
| `/admin status` | Server-requested state. This is not an acknowledgement that the native game applied it. |
| `/admin navtest on` / `off` | Show the no-reward Riften interior test, or restore the real accepted contract marker. |
| `/admin navtest native` / `doors` | Select native routing or explicit door handoff for the fixture. |

The current development server uses **offline login**, which accepts a client-selected profile ID. A profile/name/connection slot/GUID alone therefore never grants administrator access.

Administrator access defaults to denied. `FROSTVEIL_ADMIN_LOCAL=1` is permitted only for an explicitly offline server with both listeners on `127.0.0.1`. It enables an **OS-operator-approved session**, not authenticated master-account login. The allowlisted local operator name is `owner`. The operator must explicitly approve the current actor/profile/server nonce from the server machine; no player is automatically promoted.

Approval lasts 30 minutes and is invalidated by trusted native connect/disconnect events, stale observation, account/session changes or a new server boot. A RakNet GUID is not assumed to identify a new connection. Private inventory failures fail closed and cannot abort other login listeners. Commands and completion hints are owner-only; command payloads cannot supply actor IDs, privileges, native function names, rewards or arbitrary console strings. Public-server access remains denied without a separately supplied verified authentication provider.

After approved deployment and owner login, run from the `skymp` directory in a separate PowerShell:

```powershell
node .\rp-gamemode\scripts\admin-local.cjs .\build\dist\server\rp-admin list
node .\rp-gamemode\scripts\admin-local.cjs .\build\dist\server\rp-admin grant <actorHexFromList> owner
# Revoke explicitly:
node .\rp-gamemode\scripts\admin-local.cjs .\build\dist\server\rp-admin revoke <actorHexFromList>
```

The `rp-admin` directory must stay private to the server OS operator and outside served content. The disposable real-wrapper test confirmed unauthenticated HTTP cannot retrieve its session inventory.

## Native limitations — owner acceptance required

1. **Actual Skyrim behavior is pending.** Native server record loading is verified, but it cannot prove that the Skyrim client renders Map/compass targets, fills native aliases, finds a door route or performs flight. Missing APIs/plugin/failed native calls are diagnosed, not counted as success. No chat-only substitute is claimed.
2. **Use `/admin reset` BEFORE loading a full save or changing characters.** The installed platform sends `preLoadGame` as a tick event without the Papyrus VM needed for native movement calls. That event now only queues cleanup for a native-capable `update`; loading/main-menu updates also attempt cleanup. If loading overtakes cleanup, the controller does not subtract the old character's modifier or toggle remembered collision state against the new character. It disables admin movement, reports unknown state and requires a clean Skyrim restart. This prevents modifying the new character but does **not** guarantee the old global TCL state was restored during every load ordering.
3. TCL exposes no verified collision-state readback through the installed API. Do not mix controller flight with manual console TCL toggles. Actual native flight, speed perception and behavior around loading require the single owner test below. No new native plugin was added to bypass this limitation.
4. The city fixture uses north gate `00042284`, Bee and Barb exterior door `000430A6`, and an existing interior landing-marker coordinate in CELL `00016BDF`. Static records/teleport pairs were inspected; owner traversal, locks and multiplayer behavior are not certified. Existing locks and scripts are preserved.

## Automated evidence

| Validation | Result |
| --- | --- |
| Gamemode typechecks, build and regression suite | **193/193 PASS**, 0 failures/skips; `.local/navigation-admin/regression-final.log`. |
| Launcher typecheck and full suite | **444/444 PASS**, 0 failures/skips; Launcher `.local/navigation-admin-launcher-final.log`. |
| Actual ESP Play fixture | Downloads/activates the real ESP, puts the shared plugin before existing SkyUI, synchronizes the diagnostic order mirror and repairs later order drift without redownloading. |
| Native addon ESP fixtures | **PASS** at full-plugin indices **1 and 5**; real pinned addon resolves Quest/Alias/marker IDs and exact positions. Static markers are intentionally not replicated by SkyMP. `scripts/navigation-native.cjs`; latest successful fixture `native-vGzYJ5`. |
| Existing Courier native persistence | **PASS**, three separate native processes, copied world only; 30 RP, Satchel 1, XP 90, regional permit, 16 deliveries; stale mirror reconciled, duplicate payout rejected, inventory/equipment/appearance preserved. `.local/navigation-admin/courier-native.log`. |
| Real wrapper with shared ESP and local admin authority enabled | **PASS**, authenticated metrics HTTP 200, private admin inventory not publicly served, copied world unchanged. `.local/navigation-admin/wrapper.log`. |
| Packaged Launcher smoke | **PASS**, inert disposable fixture; no Skyrim/Steam/SKSE launched. Launcher `.local/navigation-admin-packaged-smoke.log`. |
| NSIS update regression | Full suite includes isolated 0.1.5 → signed test 0.1.6 update preserving fixture settings/ownership and the real installed executable. This is not a claim that public 0.1.8 → 0.1.9 GitHub publication has occurred. |
| Installed client guard | **VERIFIED**, client JS SHA256 remains `a0886557d2b8bb49ee3c45319f1a36466ce9908215144c527c6c77b69060c440`; real LocalAppData baseline, no shadow profile. |

One independent core review and a focused review of the necessary Launcher change were performed. Fixes cover nonce replay on reconnect, old-character modifier corruption, manual untracking through door handoff, and Side Quest type metadata. The native pre-load timing limitation is explicitly retained rather than hidden by a mock.

## Launcher and delivery

Launcher **0.1.9** is necessary: 0.1.8 appended a newly activated ESP behind existing SkyUI, conflicting with the shared full-plugin index. Play now reuses the existing activation planner, derives missing client-only activation metadata from signed, verified external plugin files, preserves unrelated plugin order, backs up configuration replacements and rechecks readiness. No trust gate was weakened and the installed client JS baseline was not repinned.

Prepared candidates:

- Server JS, ESP, operator helper and corresponding source: `rp-gamemode/.local/navigation-admin/delivery/`. `current.json` identifies the exact current bundle; older candidates in this ignored directory are not deployment inputs.
- Launcher installer: `skyrim-rp-launcher/release/SkyrimRPLauncher-0.1.9-x64-local.exe`, blockmap and `latest.yml`; corresponding source ZIP under `.local/production-candidates/`.
- Signed Launcher candidate: `.local/production-candidates/launcher-v0.1.9/`.
- Signed pack **1.0.5** candidate: `.local/production-candidates/modpack-pack-v1.0.5/`; seven first-party game payloads, including the unchanged six existing files and the new ESP. Minimum Launcher is 0.1.9. External Skyrim/SKSE/SkyMP/SkyUI requirements remain unchanged and are not redistributed.
- **Candidate signatures use placeholder GitHub asset IDs for offline verification only. They must not be published unchanged.** Approved publication must bind actual asset IDs and re-sign with the existing pinned production identities, then verify anonymous downloads.
- The installer remains Windows Authenticode **NotSigned**, matching the existing distribution model; its independent Ed25519 update candidate was signed and verified. No installed Launcher was replaced.

Exact file hashes and publication/deployment operations are recorded in deployment-plan.json. Its approval boundary covers publishing Launcher first, then immutable pack 1.0.5, and deploying only the selected server bundle/ESP/helper/config. Player files are installed exclusively through Launcher Play preparation.

| Frozen candidate | SHA-256 |
| --- | --- |
| Current server bundle | `af3b8eb1926abb382f1cdbdcfa80e8f1799cd873178bd1f656127fe13474aacc` |
| ESP, 3400 bytes | `391567b0eabc46b2ecd557c69eeef0bf8fbb8775589ba7f5594e7ce0f6b60a10` |
| Launcher 0.1.9 NSIS, 112356634 bytes | `961f861cf446de1b0fb4dc816986c522f99eb46c6a506baec45d12255310a641` |
| Combined deployment plan | `1a206beca04ece8dfd61527e38397688232796d4c67245335ba2cf5f6d280f56` |

No world backup is planned, respecting the earlier owner preference. Back up program/config files only; do not reset or restore world/economy data. A server-code rollback preserves the current journals. Immutable releases and the version ledger require a forward corrective client release, not an overwritten tag or forced downgrade. The server must return in a visible PowerShell window. Source snapshots accompany releases; no source commit/push is included.

## One owner gameplay checklist

1. Update Launcher to 0.1.9, then press Play: required pack files and plugin order must be prepared automatically, without manually downloading/copying an ESP.
2. Resume the existing active Courier job: verify its distant Map marker, compass marker, English journal and Thai RP details; approach the unchanged beacon. Deliver or cancel once and confirm the marker clears; reconnect with an active job and confirm restoration.
3. Explicitly approve the owner session in PowerShell. Run `/admin navtest on`; enter Riften and the Bee and Barb. If native routing fails, compare `/admin navtest doors`. Untrack the quest and cross a doorway to confirm it stays untracked. `/admin navtest off` restores the real job, with no test payout.
4. Test `/admin fly on`, repeat it once, `/admin fly off`, `/admin speed 2`, `/admin speed 3`, `/admin speed reset`, and `/admin reset`. **Reset before full-save loading/character changes.** Revoke/reconnect and confirm special movement and completion hints are gone.


## 2026-10-19: native Quest start failure corrective candidate

Owner gameplay and installed Data/Platform/Logs/rpQuest-logs.txt confirm that native Quest.start returns false before journal stage or objective display. The installed ESP is the original 3400-byte release, not a missing-plugin error. Installed SP declares start(): Promise<boolean>.

The original alias flags 0x208 omitted Optional (0x2), while the controller binds destinations after starting the quest. Reference aliases also omitted the VTCK=NULL field present in the inspected vanilla Skyrim.esm forced-reference aliases. Corrective ESP uses 0x20a and emits VTCK=NULL. This removes a startup dependency on an already filled alias. The controller now verifies the bound native reference ID before reporting a displayed objective and includes target/running/stopped state on start failure. These are identified defects and a tested corrective candidate; Skyrim execution must still establish whether they fully explain the observed failure.

Tests: gamemode typechecks/build and 195/195 regression tests passed (two new regressions were observed failing before changes); real server-addon mapping at load indices 1 and 5 passed. Neither establishes native client Quest startup or rendering. No installed player files, running server or published immutable releases were modified by this corrective work.

Candidate ESP: 3460 bytes, SHA256 600b551ea9d25eef622d360f2036704d6934f4a2f0aa5519b65a8783c3b90d15. Candidate server bundle: 27e8e41c47eaebb66d413f68cccba3101f31501a31bf762f1ff32f5397884b90. Files: rp-gamemode/.local/navigation-admin/quest-start-fix/current.json. Signed offline pack 1.0.6 candidate: skyrim-rp-launcher/.local/production-candidates/modpack-pack-v1.0.6; placeholder IDs require actual asset rebinding before publication. Launcher remains 0.1.9; existing graphics R2 configuration is untouched. RP signed distribution still uses its current GitHub provider; this patch does not claim it has migrated to R2.

Next owner check after approved distribution/deploy: exit Skyrim, receive corrected ESP through Launcher Play, reconnect with the existing active job, verify no Quest-start notice, then inspect Map and compass. Do not abandon or reset the existing job merely to retry navigation.

## 2026-10-21: runtime correction and colored map delivery

**LOCAL CANDIDATE READY; NOT PUBLISHED OR DEPLOYED. Native Skyrim acceptance remains pending.** This section supersedes older version/candidate references above. No installed game, live server, world, economic rate or player schema was changed during preparation.

### Fixes and delivery

- The currently installed 3400-byte navigation ESP is the original release. Corrected regular ESP is 3460 bytes, optional alias flags 0x20a with VTCK=NULL; real server-addon record mapping passed at full indices 1 and 5. Native start/bind/stage/objective operations now execute only on update VM callbacks. Promise continuations carry primitive results; stale callbacks cannot resurrect cancelled jobs. Manual untracking survives refresh and door routing changes.
- Map tint is an additive 4591-byte AVM1/SWF8 helper loaded through the installed Ui API. It does not replace Map/HUD/SkyUI/font files. Only quest icons with Courier:/Frostveil: labels are selected: gold while tracked, green within 200 units in the destination world/cell. This is a visual hint; delivery/rank/payment remain server-authoritative. Each pass restores recycled clips before selecting owned icons. Native compass icons retain their original colors because HUD compass data lacks an unambiguous quest ID; unrelated quests are not recolored.
- Administrator speed uses a reversible InventoryWeight refresh across frames to invalidate cached movement speed. Observed-delta readback handles native calls that write then throw, including restoration, and tolerates native float32 rounding. Disposal/disconnect cleanup stays subscribed until owned changes are restored. TCL remains Debug.toggleCollisions behind explicit idempotent state. Native TCL/physical movement are not yet certified; external console TCL changes and full save transitions remain limitations described above.
- Private OS-operator session approval is still required. Current local account allowlist is owner; no current game session was available during this preparation. Offline profile/name/connection IDs never automatically grant rights. Owner approval must bind the current session, expire after 30 minutes, and be renewed after reconnect/server restart. No public administrator authentication is claimed.
- Launcher **0.1.18** is necessary to authorize exactly the corrected ESP and additive SWF in the hash-pinned R2 recipe, and prevent the legacy graphics integrity patch from restoring the old ESP. Existing client JS **0.1.17** is retained. Recipe **1.0.13** has **649 files**, with all prior **647 entries byte-for-byte unchanged**. No graphics/beam color, brightness or animation changed.
- Signed modpack **pack-v1.0.6** candidate was independently authenticated against LOCAL placeholder release IDs. Actual GitHub asset IDs must be rebound and signed again during the approved publication; this is not a public release. ESP/SWF bytes are acquired through R2 before signed-pack verification, which adopts matching bytes and activates the plugin without downloading them again from GitHub.

### Validation and review

- Gamemode typechecks/build and **221/221 regression tests PASS**. Includes strict native-VM context, late start/stage callbacks, cancellation/reconnect/loading, explicit door handoff/manual tracking, permission forgery/revocation, duplicate movement packets, speed cleanup and tint isolation/recycled clips.
- Launcher typecheck/build and **477/477 tests PASS**. One existing security fixture used today's hardcoded key expiry; its environment-mismatch case now uses a future fixture date, while expiry-refusal tests and all production key pins remain unchanged.
- Final packaged Electron fixture smoke PASS; no Skyrim/Steam/SKSE launch. Actual candidate fixture verifies 649/647 parity, ESP/SWF hashes, original ESP backup, interrupted-apply rollback, running-game refusal, second Play zero writes, and no legacy ESP reintroduction. Signed-pack integration verifies plugin activation and zero duplicate GitHub payload acquisitions after R2 repair.
- One independent read-only review found two map tint defects (unrelated quests/recycled clips) and InventoryWeight exception accounting. All reproduced before correction and now have passing regressions. These tests establish code/asset behavior, not real Skyrim UI rendering or flight.

### Artifacts and hashes

| Artifact | SHA-256 |
| --- | --- |
| Corrected FrostveilCourierNavigation.esp | 600b551ea9d25eef622d360f2036704d6934f4a2f0aa5519b65a8783c3b90d15 |
| CourierQuestTint.swf | 2e28bf17722e9f0c8dd5cc18b8e0c001d2c9f32e1040c250443abcbe00a6a5eb |
| Server gamemode bundle | 533664c1d244769ed477d6c17f379b78c6d70636ba0470b964d9e59edaed67b2 |
| R2 recipe 1.0.13 | 95a950de3b9e8b487219b88c9f33c0894e8666eb19432c8eb812a30d1e3a9fed |
| Launcher 0.1.18 installer | b1dc32ef62a58ac60242e66adfe241fbc237e47cca48bc3a96c7f9dde431c0c8 |

Concrete delivery directory: <LOCAL_PATH> deployment-plan.json and SHA256SUMS contain final installer, payload/archive, corresponding source snapshots and rollback identities. No source commit/push. Production signing roots are unchanged and valid until 2027-10-16; private keys are not included.

After the single publication/deployment approval: publish content-addressed R2 payload/recipe; bind actual GitHub modpack asset IDs and sign immutable pack-v1.0.6; publish signed Launcher 0.1.18 plus corresponding source; replace only server gamemode JS and navigation ESP, preserving the six-entry order and existing session-stability wrapper. Restart verified localhost server in a visible PowerShell. Back up code/config only, no world snapshot/reset/migration. Update/repair clients through Launcher Play only. Keep old immutable objects/releases. Server rollback restores previous bundle/config/ESP together while retaining current world/economy; client repair retains atomic originals, and version-ledger-compatible corrections use a new forward release.

### One owner gameplay checklist

1. Exit Skyrim, update Launcher to 0.1.18, press Play and let it repair automatically. Reopen once to confirm Play remains ready without another download.
2. Keep the current distant Courier contract: inspect journal, Map and compass. Confirm the native marker, gold Map icon, green near arrival, and unchanged beam. Untrack manually, refresh/reconnect as appropriate, and verify no duplicate markers. Deliver/cancel clears only Frostveil state.
3. After explicit operator approval of this owner session: /admin navtest on. Enter Riften then Bee and Barb; verify door routing. Compare /admin navtest doors only if needed. /admin navtest off restores the real job; no test reward.
4. /admin fly on -> fly through a wall -> repeat on (no reversal) -> fly off (normal collision). /admin speed 2 -> speed 3 -> speed reset -> /admin reset. Confirm original speed/collision, and no grant to another character.

**Unproven and required before completion:** actual native Quest start; Map/compass icons and Map labels; city/building door routing; helper injection and native gold/green appearance; actual TCL flight/off, physical speed/reset, and cleanup under real disconnect/load. No current Skyrim process or live owner session existed for those checks. The active goal remains incomplete until this evidence is obtained.

## Owner-approved publication and deployment — 2026-10-21

Owner explicitly approved sealed plan 4a3bd3bce682643cf56302959e0b647f4fd7841bfe94e3640c3d7b41a62cfda5. Published Launcher 0.1.18: https://github.com/kaktv2016/frostveil-launcher/releases/tag/v0.1.18; modpack 1.0.6: https://github.com/kaktv2016/frostveil-distribution/releases/tag/pack-v1.0.6. All 15 GitHub assets and 2 R2 objects downloaded anonymously and hash-verified; both independent Ed25519 authentications passed. Distribution release is immutable. Launcher repository retains the existing 0.1.17 policy (GitHub immutable=false); updater signatures/asset IDs/hashes remain enforced and published assets were never overwritten.

Server JS and corrected ESP deployed; six-entry load order and session-stability wrapper unchanged. Visible PowerShell PID 20868, Node PID 10868, localhost UDP7777, RP foundation-ready log and authenticated metrics HTTP200 verified. Code/config/previous ESP backups only, no world backup/reset/migration. Backup directory: <SKYMP_REPO>\build\rp-audit\navigation-runtime\deploy-1792583577422. Receipt: skyrim-rp-launcher/.local/navigation-runtime-fix/delivery/active-deployment.json. Player installation remains untouched by tools; installed ESP still matches original 391567b0eabc46b2ecd557c69eeef0bf8fbb8775589ba7f5594e7ce0f6b60a10 pending Launcher Play. No active owner session was available to grant; no automatic privilege assignment.

Owner now needs Launcher update/Play and the single gameplay checklist above. Native Map/compass/door markers, colored Map rendering, TCL flight/off and physical speed/reset remain unverified. This deployment is not goal completion. Corresponding source ZIPs retain their sealed pre-publication report snapshot; this local report append records the subsequent authorized rollout.

## 2026-10-21: owner gameplay and native API correction

This section supersedes the preceding pending-player-installation status. After Launcher 0.1.18 Play, read-only inspection confirmed the installed corrected ESP (600b551e…), additive SWF (2e28bf17…), and unchanged client JS 0.1.17 (01264ed1…). The owner explicitly confirmed administrator flight, speed and reset work in real gameplay after being asked to test both activation and restoration. Those native administrator checks are accepted; they need not be repeated merely for this correction.

The owner confirmed Courier Map/compass markers still fail and discovered locations disappear on reconnect. Native client logs identify `ReferenceAlias unavailable` and `Invalid _skyrimPlatform_indexInPool: 0` in the tint loader. These are distinct from a missing installed plugin. Installed SP3 resolves returned objects through TESForm types, so non-Form quest aliases become null; upstream reports the same defect ([SkyMP issue 2489](https://github.com/skyrim-multiplayer/skymp/issues/2489)). The corrected controller uses the signed ESP's persistent forced-reference alias when the runtime cannot return it, requiring exactly one alias and matching destination references. It still rejects an unsupported explicit door rebind instead of displaying the wrong destination. Native default door routing remains to be observed.

SP3 also interprets a JavaScript array passed to a native API as a pooled native object. The tint loader now builds the Scaleform callback through installed SKSE UICallback scalar Create/PushString/PushInt/Send calls, followed by scalar Ui.invokeString. Both enqueue on the same FIFO UI queue. Unsent handles are released, including Send returning false before consuming the handle ([official SKSE source](https://raw.githubusercontent.com/ianpatt/skse64/master/skse64/PapyrusUICallback.cpp)). The existing ESP/SWF, Launcher 0.1.18 and core client JS remain sufficient for these server-delivered source corrections. No game files or running server were modified during preparation.

The fresh client bootstrap used on reconnect does not preserve native discovered-map flags, and no per-character map-discovery persistence existed in the inspected custom client/server code. Previously lost discoveries cannot be reconstructed from absent records.

### Discovery persistence and corrective delivery

The corrective server bundle adds the registered owner-only `rpMapDiscoveryStateV1` property, separate owner-only handshake/inbox, and independent client event source. This is additive character metadata, not a reset/migration of existing world/economy data. State is saved by native actor storage; no second database or local-cache-only substitute is introduced. Dotted private keys cannot be registered by this engine, and unregistered fields lack reliable snapshot visibility filtering, so the new state uses the supported registered property name from its first deployment. No existing identity/Courier records are changed.

The server catalogue contains 435 winning map-marker references from the five installed masters, each with stable plugin-relative IDs and validated positions/types. Native `locationDiscovery` supplies a numeric world ID (despite the inaccurate generated string declaration); the scalar client path normalizes it. Server-verified actor/session, nonce, rate bounds, world/type/flags and authoritative proximity resolve discoveries. Localized FULL string IDs are never decoded as names. Duplicate discoveries/upgrades are idempotent, and a malformed/future stored state is preserved rather than reset. Reconnect restores only the owner's recorded native markers using `addToMap`, reads flags back, retries failures three times, and logs diagnostics to `rpMapDiscovery`. Global fast-travel restrictions and keyboard/controls are untouched.

Warm reconnect of the same actor is supported. Source replacement retains the actor/load identity guard. Changing character without a clean native load pauses restoration and visibly requests restarting Skyrim, because the installed API cannot hide old native discovered-map flags. A previously consumed load cannot authorize a later warm character switch. Four catalogue markers have same-type neighbors within 4096 units, and 12 pairs have overlapping acceptance regions; an event matching multiple references is intentionally refused. Thus complete discovery coverage is not claimed for ambiguous locations or map markers added by other plugins. Ordinary uniquely resolved base-game/DLC discoveries are covered; actual gameplay remains to be checked.

Typechecks/build and **246/246 regression tests PASS**, zero failures/skips. Final log: `rp-gamemode/.local/navigation-admin/discovery-regression-final.log`. This includes native two-process persistence on new synthetic characters, isolation of the second character, unchanged inventory/equipment/appearance/location, and all 435 positions/types compared with the real pinned addon. No live world was copied or written. Other focused checks include broken alias-return fallback, scalar tint callbacks/handle cleanup, stale packets, warm reconnect, character/load guards, bounded retry/readback, Unicode/chat and all existing economy/admin regressions. A real hidden synthetic PowerShell/Node process-tree test verifies timeout cleanup before rollback even when no UDP port exists; it never starts the real server.

Independent review covered the API corrections, native queue/VM context, new map state/transport and deployment failure paths. Findings about callback cleanup, transient restore retries, warm reconnect, consumed-load identity guards and timeout process ownership were corrected with regressions before sealing. Only server JS requires deployment; Launcher **0.1.18**, core client JS **0.1.17**, installed ESP/SWF, signed pack **1.0.6**, R2 recipe **1.0.13**, fonts/SkyUI and beam assets stay at their already verified versions. There is no new Launcher release, client game-file installation, DLL or mod dependency for this corrective bundle.

Concrete candidate, hashes, source snapshot and code/config rollback identities are under `rp-gamemode/.local/navigation-admin/runtime-discovery/`. `scripts/deploy-navigation-discovery.ps1` defaults to read-only preflight; Apply requires the exact owner-approved plan hash. It refuses a changed active bundle/load order/ESP/wrapper, backs up code/config only, restarts the recognized localhost server in visible PowerShell, and verifies both foundation/map-module readiness. On failed startup it terminates the owned candidate process tree before restoring the previous code/config and starting rollback. It never restores world/economy data, edits player game files, or grants an admin session automatically. The new candidate is not deployed while this approval is pending.

One remaining owner check after the authorized restart: reconnect with the existing far Courier contract and inspect journal/Map/compass plus gold/green appearance; use the existing no-reward Riften/Bee and Barb test for door routing when the operator grants that session; discover one new base-game location, quit/reconnect and confirm its marker remains. There is no need to repeat the already passed administrator movement checklist.

Native acceptance still outstanding: visible Courier Map/compass icons, journal target and city/building door routing; actual gold/green map appearance; discovery restoration across reconnect. Automated/native-addon persistence checks alone cannot certify rendered Skyrim UI.

### Owner-approved corrective deployment — 2026-10-21 20:01 ICT

The owner approved plan SHA-256 `553e16f43f095db21a60bd2f3d293da8de584a46f7dc66cc50637181dd0bfdaa`. Deployed server bundle **fc6113721fbf1c827d52cf392ace85b51b2053ba5673ea6b554dfb1f44841f08** (275492 bytes). Visible PowerShell PID **10100**, server Node PID **23732**, localhost UDP7777, authenticated metrics **HTTP 200**, foundation ready and map-discovery module ready all verified. ESP, wrapper and six-entry load order hashes are unchanged. Launcher remains 0.1.18; no new client release, player file writes, world backup/reset/migration or economy changes.

First attempt was invoked through Windows PowerShell 5, whose `Set-Content -Encoding utf8` emitted a BOM into settings JSON. The server rejected it before readiness. The tested rollback terminated the candidate process tree and restored/restarted the old code/config successfully. Retrying the identical approved artifacts/script through the installed **PowerShell 7.6.5** wrote UTF-8 without a BOM and succeeded. Future invocation of this sealed deployment operation must use PowerShell 7, not `powershell.exe` 5.1. This is an execution-runtime requirement; the approved plan, source snapshot and bundle were not overwritten.

Backups of code/config only: `skymp/build/rp-audit/navigation-discovery/deploy-1792587685964/`. Deployment receipt and independently checked runtime evidence: `rp-gamemode/.local/navigation-admin/runtime-discovery/active-deployment.json` and `deployment-verification.json`. Corresponding source snapshot retains the pre-deployment report; this append records the authorized outcome. New discoveries will be saved when the client reports a validated event. No current owner session is automatically granted administrator rights after restart.

Owner has been asked to reconnect using existing Launcher Play, inspect the existing Courier Map/compass marker, then discover one new location and check it remains after reconnect. Native UI acceptance and door/color proof remain pending; this deployment alone does not complete the navigation goal.

### Native trial and complete container correction candidate

Actual Launcher 0.1.18 gameplay after the server correction proved scalar SKSE injection: `rpQuestTint` logs **SWF loaded HUD Menu** and **SWF loaded MapMenu**. The game responded normally. Navigation progressed past the broken alias-return bridge but stopped at **Persistent destination unavailable**. No native objective/Map/compass success is claimed. The map owner handshake is active; the observed current character had zero recorded discoveries, so real newly discovered-location persistence has not yet been confirmed.

The old ESP contained nested reference groups without their owning WRLD/CELL records. Mutagen **0.54.4** actually rejects that file while reading WRLD 00003C. Primary writer structure and xEdit container rules agree: [Mutagen Worldspace](https://github.com/Mutagen-Modding/Mutagen/blob/dev/Mutagen.Bethesda.Skyrim/Records/Major%20Records/Worldspace.cs), [Mutagen Cell](https://github.com/Mutagen-Modding/Mutagen/blob/dev/Mutagen.Bethesda.Skyrim/Records/Major%20Records/Cell.cs), [xEdit changelog](https://github.com/TES5Edit/TES5Edit/blob/dev-4.1.6/whatsnew.md). Missing native reference lookup is consistent with these orphan groups; only a client trial can establish the complete causal fix.

Corrected candidate ESP **49789 bytes / 9a4a546f9fae714251dde91955b27a3b01cb79cabcbe4e1ab80fff9bcd549930** adds exactly three container overrides: Tamriel WRLD:3C, persistent CELL:D74 and Bee and Barb CELL:16BDF. Mutagen copies the winning official parents, resolves English localized names and writes/remaps typed fields. Semantic comparison preserves every gameplay parent field, excluding only child collections, RNAM/OFST file bookkeeping and group metadata. No foreign placed references, landscape or navmeshes are copied. All six quest/reference flags and subrecord fields remain byte-identical, including IDs, forced aliases and coordinates; only Skyrim.esm remains a master. This does not claim multilingual parent localization preservation beyond the installed English setup.

An independent byte parser validates included parents, group order/types and the exact 25 record/group header count. Mutagen reads the final file successfully. Real pinned server-addon fixtures resolve all six pairs at indices **1 and 5**, with the markers intentionally not replicated. Native client GetFormFromFile/ObjectReference lookup and rendered routing remain pending. The original sealed 600b… payload stays unchanged. Reproducible tooling source and NuGet lock are included; .NET SDK **10.0.402** is workspace-only development tooling and no .NET/DLL dependency is added to player installation.

Native tracing also exposed that SkyMP calls owner property updaters every frame. Identical map snapshots could restart the restore batch and starve entries after the first 16. Stable-object fast paths and canonical snapshot deduplication now preserve queue progress, including equivalent cloned snapshots, token/state upgrades and new sessions. Tests restore 33 entries exactly once without log spam. Native event queue and server accepted-discovery diagnostics support the next gameplay check.

Launcher **0.1.19** is required because the current 0.1.18 executable pins the earlier ESP recipe hash. New R2 recipe **1.0.14** changes only that ESP, preserving **648 other entries exactly**, including core client JS 0.1.17, tint SWF and all graphics/beam assets. Signed offline pack **1.0.7** is authenticated with clearly marked placeholder GitHub IDs; approved publication must bind actual IDs and re-sign. Recovery permits only the explicitly pinned previous ESP identity (3460/600b…) alongside the existing client recovery support, allowing an interrupted 1.0.13 transaction to recover before applying 1.0.14. Arbitrary prior files or other ESP targets remain refused.

Validation: gamemode typechecks/build and **251/251** regression tests pass; Launcher typecheck and **480/480** pass; NSIS build and packaged Electron inert fixture smoke pass. A review found that the first new recovery test rolled back immediately; the corrected fixture leaves a genuine pending journal while simulating a running game, then verifies next-Play recovery (**24/24 focused source-repair tests pass**). The full test harness isolates the process provider only for the inert modpack-delivery entry, so the owner's running real Skyrim cannot block synthetic fixtures. Other process-guard security tests and production builds keep the real provider. Five candidate workflow/publisher tests and actual ESP repair/backup/interruption/idempotence fixtures pass; second Play writes zero files. Independent final review accepted the scoped implementation after this recovery-test correction.

Only new delivery artifacts are staged under `skyrim-rp-launcher/.local/navigation-containers-fix/delivery/`; no new R2/GitHub publication or live deployment has occurred. The combined approval plan contains Launcher 0.1.19, immutable pack 1.0.7, recipe/archive, corrected server ESP and server JS with snapshot deduplication, source ZIPs, hashes and rollback identities. `deploy-navigation-containers.ps1` writes config explicitly as UTF-8 without BOM under both PowerShell 5 and 7; its real synthetic process-tree cleanup and BOM regression pass. Deploy backs up code/config/ESP only, preserves world/economy and reopens the server in visible PowerShell. Player installation remains Launcher-only.

The remaining owner check is one sequence after approved publication/deploy: update Launcher and Play; inspect the existing far contract on Map/compass/journal and gold/green appearance; test Riften/city/building door routing without rewards; discover one new ordinary location and reconnect to confirm its icon remains. Administrator movement has already passed and need not be repeated. Ambiguous nearby markers, non-catalogue plugin locations, old lost discoveries and warm character-switch limits remain as documented above.

### Owner-approved container correction publication and deployment — 2026-10-21 21:23 ICT

The owner approved final plan SHA-256 `124249971dbf3851a8a6813e46172ba53f560afbb579012011ee6516ad66ddb3` after closing Skyrim. The content-addressed ESP archive and recipe were uploaded to Cloudflare R2; both objects passed anonymous download/hash verification. GitHub publication rebound the real asset IDs and re-signed the metadata before making the releases public. Launcher [v0.1.19](https://github.com/kaktv2016/frostveil-launcher/releases/tag/v0.1.19) contains five assets. Immutable distribution [pack-v1.0.7](https://github.com/kaktv2016/frostveil-distribution/releases/tag/pack-v1.0.7) contains ten assets. The publisher anonymously verified all 15 assets. Both releases are public, final and non-draft; the distribution release is immutable.

Server bundle `081c856ef62490cb1512e697b33a534e72ce001a6fc2afbc953cb74666b135b5` and corrected ESP `9a4a546f9fae714251dde91955b27a3b01cb79cabcbe4e1ab80fff9bcd549930` were deployed. The session-stability wrapper remains `1e8511088812e379e2237216ef294c7b94877057c1a13f3a18fb655456c1be95`; the six-entry load order remains intact and the navigation ESP remains at global index 5. UDP 7777, authenticated metrics HTTP 200, RP foundation readiness and map-discovery readiness were verified after restart. Visible host window title is `Frostveil Courier Navigation + Map Discovery`; PowerShell PID 26988 and Node PID 26856 were active at verification. Code/config/previous ESP backup: `skymp/build/rp-audit/navigation-containers/deploy-1792592587610/`.

The rollout wrote no installed-game files, created no world backup and performed no world/economy migration. Player repair remains exclusively Launcher Play. Administrator movement retains the owner's prior native gameplay PASS and no privilege was automatically granted after restart. Native acceptance remains pending until the owner updates to Launcher 0.1.19, presses Play, and verifies the actual Courier Map/compass/journal marker, gold/green Map rendering, city/building door routing, then discovers one ordinary base-game/DLC location and confirms its marker survives reconnect. This authorized rollout is complete; the overall navigation goal is not certified complete until that gameplay evidence is received.

### Navigation polish candidate — 2026-10-22

Owner gameplay confirmed the native Courier objective now appears on both Map and compass and administrator movement works. Two gaps remained: the map icon stayed grey, and a newly discovered ordinary location did not survive reconnect. The owner also confirmed the amber effect asset itself works, but real Courier contracts still selected the legacy beam unless a preview command overrode it.

The candidate makes amber the real-job default while keeping `/beacon` as a session-only development override. Delivery, abandonment, invalidation and reconnect continue to use the existing owner-only waypoint lifecycle; economy, rewards and delivery validation are unchanged.

Map discovery keeps the native `locationDiscovery` event as its primary path. The server now also issues at most 16 catalogue probes within 8192 world units of the authoritative actor position. The client only reports a probe after the installed native reference returns `canFastTravelToMarker() === true`; it never calls `addToMap` for a probe. The server requires the exact current-session token and issued reference, rechecks world/type/flags and authoritative distance, then writes the existing `rpMapDiscoveryStateV1` state. Unissued, stale, remote and duplicate reports are rejected. An unchanged probe snapshot is not republished each second, and a probe that leaves then re-enters range can be checked again.

The additive SWF now accepts the exact active Frostveil objective label (`Deliver to … (/job deliver)` or the no-reward test objective) in addition to the existing safe Frostveil prefixes. It still requires a quest/door marker type and does not tint the generic compass quest holder because installed SP3 exposes no unambiguous quest identity there. The controller sends the expected label through scalar `Ui.setString`, reads the SWF's actual painted count and records `SWF painted MapMenu markers=N` diagnostics. Map target color is gold and changes green only inside the verified arrival radius; native compass color remains unchanged.

Validation: gamemode build and **256/256** tests pass. Launcher 0.1.20 typecheck and **481/481** tests pass. The new recipe **1.0.15** changes only `Data/Interface/Frostveil/CourierQuestTint.swf`; the other **648/649** repair targets and ESP/client/mod bytes remain unchanged. A dedicated fixture verifies running-game refusal, exact previous-SWF recovery, backup, atomic repair and zero writes on the second Play. NSIS build and packaged Electron inert smoke pass. No installed game, live server, world/economy data, R2 object or GitHub release was changed during preparation.

Native gameplay acceptance remains required after an approved rollout: confirm a real accepted job shows the amber effect, the Map marker is visibly gold (and green near arrival), and one newly discovered base-game/DLC location remains after quit/reconnect. The compass marker is intentionally left at Skyrim's native color.
