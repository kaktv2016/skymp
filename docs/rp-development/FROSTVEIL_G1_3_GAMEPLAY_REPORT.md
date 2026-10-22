# Frostveil G1.3 — Courier contracts, progression and Guild permits

Implementation: 2026-10-17; owner-approved deployment: 2026-10-18. One gameplay milestone on `develop`, HEAD `5397cd3bf4666c942f78193107881d8cf0ac2748`; pinned native SkyMP `2849e676fe008925384b26f34476e382a30bd877`. No commit/push, installed-game write, Launcher change or distribution operation performed. Implementation used disposable fixtures; the separately authorized localhost deployment/restart is recorded below.

## Status

| Classification | Actual evidence |
| --- | --- |
| IMPLEMENTED | Five configured contracts, default compatibility, route listing/selection/cancellation, Courier XP and five ranks, permanent Guild permits, frozen accepted-contract quotes, snapshot-aware owner navigation and safe schema-one migration. |
| AUTOMATED TESTED | Final `npm test`: **175/175 PASS**, no failures/skips. Both existing TypeScript checks and CommonJS build pass. Existing chat keyboard/focus/history/autocomplete, profile/dice, Courier, economy crash/lease and journal regressions are included. |
| DEV VERIFIED | Three real native server processes on a disposable copied world: 30 RP, Satchel 1, XP 90, regional permit and 16 total deliveries persisted/reloaded; stale native Courier mirror reconciled; duplicate completion refused; inventory/equipment/appearance unchanged. Real wrapper startup and authenticated metrics HTTP 200 passed on separate fixture ports; copied world unchanged. |
| DEV VERIFIED — world records | Four new destinations verified against exact game-authored landing references, exterior cells, containing NAVM triangles and actual five-master overrides. Enabled for owner development acceptance; **this does not certify traversability or gameplay**. |
| MANUAL ACCEPTANCE PENDING | Actual new routes, perceived travel/reward balance, native beacon at those destinations, permit loop and reconnect through a real Skyrim client. |
| NOT IMPLEMENTED | New GUI, native plugins/mods, additional currency/store, merchants, vanilla gold conversion, new Satchel mechanics, anti-cheat, daily caps, journal compaction, production/public deployment or two-player certification. No next milestone started. |

## Reused systems and compatibility

- Existing authenticated actor/profile/GUID binding, command registry, RP chat delivery, autocomplete catalogue and rate limits.
- Existing G1.1 RP wallet, Satchel prices **100/250/500 RP**, **+5 RP per Satchel level** on newly accepted jobs, balance ceiling and flushed/checksummed single-writer journal. No second wallet or transaction database.
- Existing native `private.rp.v1.courier` property remains schema 1 and keeps the same fields. Character, identity, inventory, equipment, appearance and position persistence are not replaced.
- Existing G1.2 owner-visible navigation metadata and client controller. No client UI/input/native-service changes. No new client-installation files are needed.
- Frozen original mesh/texture payloads match their existing hashes, including NIF `21d526ead62ca5425913f5f28cd9cac2a86a1c8f91abef101556a4bbaf21b7f2`. Geometry, brightness, materials, 12-second animation, `/beacon` command body and style catalogue are unchanged. Launcher **0.1.8**, modpack **pack-v1.0.4**, signing identities and distribution repositories are untouched.

## Actual routes and location evidence

Every route uses the existing pickup `[122694.9453125,-66909.78125,11639.1201171875]`, interaction radius **200**, reputation reward **1**, and world descriptor **`3c:Skyrim.esm`**. The descriptor is Tamriel worldspace, rather than each exterior CELL ID. Legacy pickup is in `RiftWatchtowerExterior01`, CELL `0x97B4`; it is west of Riften, not inside the Riften city worldspace.

| Stable route ID | Destination XYZ | Tier / unlock | Base RP / XP | Minimum elapsed / consecutive repeat wait |
| --- | --- | --- | --- | --- |
| `courier-route-1` | `[123342.421875,-65940.078125,11686.185546875]` | local / Novice, no permit | **25 / 10** | 8 s / 15 s |
| `sarethi-farm` | `[113230.2109375,-70612.046875,11489.9326171875]` | local / Novice, no permit | **35 / 15** | 30 s / 45 s |
| `heartwood-mill` | `[133492.171875,-95859.5546875,10712.95703125]` | regional / Apprentice + `regional` | **60 / 25** | 60 s / 60 s |
| `merryfair-farm` | `[166696.125,-88590.9765625,11069.578125]` | regional / Apprentice + `regional` | **65 / 30** | 75 s / 90 s |
| `shors-stone` | `[163113.09375,-62752.30078125,7487.85791015625]` | long-distance / Experienced + `long-distance` | **90 / 40** | 90 s / 120 s |

All five are enabled in the prepared development bundle. The beginner coordinates, radius, base payout and Satchel formula remain unchanged. New route prices are conservative initial quotes based on the intended farm/mill/village route tiers and likely travel effort; actual walking times and encounters have **not** been measured. They are not a claim of a measured rewards-per-minute balance. Extra Satchel payout applies to RP only, not XP. There are no arbitrary daily limits. Minimum elapsed time and repeat waits discourage immediate repeated short jobs; they do not establish that the player followed a road or defeat teleport/movement cheats.

| New destination | Game-authored landing REFR | Exterior CELL | Containing NAVM / triangle | Landing above mesh |
| --- | --- | --- | --- | --- |
| Sarethi Farm | `0xA05CE` | `0x97D5` | `0x6F3AE` / 595 | 17.60 units |
| Heartwood Mill | `0xA05D0` | `0xBCDA` | `0xDB482` / 403 | 30.73 units |
| Merryfair Farm | `0xA05CD` | `0xBC90` | `0xEEA5A` / 269 | 12.58 units |
| Shor’s Stone | `0xA05CC` | `0xBBCB` | `0x10822E` / 29 | 14.09 units |

Evidence and reproducible read-only inspectors are in `rp-gamemode/.local/g13/location-evidence.json`, `override-evidence.json`, `research-locations.cjs` and `research-overrides.cjs`. Installed `Skyrim.esm`: 249753412 bytes, SHA256 `2bbc77fdec35a70ef96b710f8c525e50a1db9e63e11a391a0eb9ee8f56d36107`. The inspector parsed 869688 records. NVNM offsets were checked against pinned `libespm/src/NAVM.cpp`, master/index mapping against `Combiner.cpp`/`Utils.cpp`.

Actual server order: Skyrim → Update → Dawnguard → HearthFires → Dragonborn. All four landing references and containing NAVM records remain unchanged Skyrim winners. Update overrides Heartwood/Merryfair CELLs; HearthFires overrides Shor’s CELL; Dragonborn overrides Tamriel. Exterior grids/flags remain valid and target coordinates do not change. Selected landing references have no enable-parent, lock, teleport, VMAD, deleted or initially-disabled flag. This establishes static eligibility, **not complete road connectivity, collision clearance, encounter safety or client plugin override compatibility**. Optional Ivarstead and an occupied horse marker at Riften stables were researched but not added. If a selected route fails owner traversal, disable its configuration for new accepts; preserve existing snapshots or explicitly cancel them without payout.

## Commands, rank and permits

All output uses existing owner-only RP chat; new commands and route/permit IDs appear in Tab completion. No new GUI or public chat channel.

| Command | Result |
| --- | --- |
| `/job list` | Contract names/IDs, tier, expected RP including current Satchel, XP and rank/permit/disabled requirements. |
| `/job accept` | Original default route and pickup validation. |
| `/job accept <routeId>` | Select an enabled, unlocked route at its configured pickup. |
| `/job status` | Current accepted destination, frozen reward/XP, completion/reputation, rank and Satchel; current server-based direction/distance in world units when available. |
| `/job deliver` | Existing authoritative same-world **3D** radius validation plus frozen minimum-time check; one joint payout/XP/completion transition. |
| `/job cancel` / `/job abandon` | Same cancellation; no payment or XP. |
| `/job rank` | Persistent XP, derived rank, next threshold and next locked route requirement. |
| `/job guild` | Free basic membership, permit prices/rank/prerequisite/ownership. |
| `/job guild buy regional` | Permanent regional permit. |
| `/job guild buy long-distance` | Permanent long-distance permit. |
| `/wallet`, `/job upgrades`, `/job upgrade satchel` | Existing wallet and Satchel behavior retained. |

Configuration: `src/config/courier-progression.ts`, `src/config/courier.ts`, existing `src/config/economy.ts`. No client-selected amount, rank, price, actor, coordinate or XP is accepted.

| Rank index / name | Total XP |
| --- | ---: |
| 0 — Novice Courier | 0 |
| 1 — Apprentice Courier | 30 |
| 2 — Experienced Courier | 90 |
| 3 — Senior Courier | 180 |
| 4 — Master Courier | 300 |

Rank is derived from XP. Senior/Master currently confer prestige, not additional unimplemented contract tiers. Basic membership is implicit/free. `regional` costs **100 RP**, requires Apprentice. `long-distance` costs **250 RP**, requires Experienced and existing `regional`. Prices/requirements are centralized and validated. For example, four default deliveries give 40 XP and 100 base RP, sufficient for regional access before optional Satchel spending. Purchases do not alter existing Satchel levels or previously accepted quotes.

The existing G1.2 controller renders a beacon only inside its **8192-unit** range/loading/world gates. This limit is unchanged. Long routes are initially guided by destination name and `/job status` direction/distance; the real world-space beacon appears on approach. No chat-only replacement was substituted for the effect. Development preview remains explicitly opt-in on loopback; production source flags remain false.

## Persistence, migration and recovery

Schema **2** extends the same per-character joint economy snapshot, not a separate store:

```text
existing identity/revision/balance/satchelLevel/courier/lastMutationAt/lastTransaction
progression: { xp, permits[], lastDelivery: null | {routeId, at} }
activeJob: null | {id, reward, xpReward, acceptedAt, contract: frozen CourierRoute | null}
```

The journal still uses its existing append, checksum chain, fsync-before-response, torn-tail recovery and exclusive writer lease. Native Courier state remains a compatibility mirror. Delivery clears the exact active instance and commits wallet, XP, completion and repeat timestamp together. Permit deduction and ownership share one record. No separately acknowledged reward or XP grant exists.

- New characters initialize XP 0, no purchased permits, no retroactive money or XP.
- Existing schema-one G1.1 records are validated before a schema-two migration append. Wallet, Satchel, completion/reputation, last mutation time, active instance ID and quoted payout are preserved. Historical deliveries are not retro-paid or converted into XP.
- A known legacy active route is frozen from the current trusted definition at migration; the original system did not store its historical coordinates. Its prior quoted money is preserved; the configured XP quote is frozen then. This is the deterministic legacy rule.
- A valid unknown legacy route keeps its instance/money/progress with a null location snapshot. Wallet access remains possible, delivery is refused, and `/job cancel` explicitly cancels without reward. Restoring a trusted route definition allows a persisted snapshot to be resolved on the next economic command. Corrupt/future records are refused, never silently reset.
- Schema-two accepted destination, radius, reward, XP and timing parameters survive subsequent route changes, disable/removal, reconnect and restart. New accepts use current availability; existing accepted contracts use their stored snapshots.
- Ambient chat/beacon refresh uses a bounded per-session cache and a checksum-validated **read-only** journal peek. It does not create a store, claim a writer, truncate a torn suffix, migrate, reconcile or fsync financial state. This peek is a visual hint only; actual commands use normal flushed journal recovery. Pending/failed commits invalidate navigation cache; completed/cancelled state produces no destination.
- Invalid/overflowing money or XP, duplicate permits, unsupported fields or unsafe file paths fail closed. Saved unknown permit IDs are retained if validly shaped; no automatic ownership deletion occurs when configuration changes.

Existing limitations remain: checksums are not protection against a privileged local editor; per-character journal is bounded at 16 MiB, records at 64 KiB; no compaction or multi-host writer protocol. Larger snapshots consume that existing capacity faster. No universal exactly-once guarantee for hardware loss or arbitrary filesystem rollback is claimed.

## Authority and tests

Auth/profile/GUID checks, character guard, command rate limit and one root writer lease are retained. Enabled/rank/permit checks precede accepts; concurrent conflicting accepts/purchases cannot create two commits. Client reward/price/position fields are not used. Native location, cell/world descriptor, radius and minimum time govern delivery; the beacon never pays money. Repeating a completed instance or sending a delivery after cancellation cannot award that instance again. Text commands act on the actor's current active contract; this milestone does not introduce a client protocol that proves historical user intent across a subsequently accepted different contract.

`tests/g13-courier.test.cjs` adds 11 meaningful scenarios over real temporary journals: route/default selection, locks and catalogue, owner navigation, cancellation, one-time RP+XP, Satchel preservation, permit chain through long-distance acceptance, concurrent purchases, price/route argument forgery, insufficient funds, minimum travel/repetition, changed/removed routes, legacy schema-one money/quote migration, torn/failed/flushed transaction recovery, no ambient fsync, XP overflow and corrupt progression. Existing G1.1 tests cover reentrancy, changed identity during validation, mirror failures, process/lease contention and replay across reloads. Existing chat tests exercise Unicode/IME, F7/ESC/focus, Tab and history without UI changes.

Evidence:

- `.local/g13/tests-final.log`: **175 PASS**, 0 fail/cancel/skip; build includes `tsconfig.json` and `tsconfig.type-tests.json`.
- `scripts/courier-native.cjs` / `.local/g13/native-final.log` / `build/rp-audit/g13/native-latest.json`: **PASS**, three real native processes, XP **90**, balance **30 RP**, Satchel **1**, permit `regional`, completed **16** (7 historical + 9 new). Deliberately stale copied native state is reconciled after process restart; physical state remains unchanged. Connection bindings and fixture route coordinates are synthetic; this is not a client connection or new-route traversal test.
- `.local/g13/wrapper-final.log`: **PASS**, real `skymp5-server.js` wrapper, isolated port 17777 / metrics 17778, HTTP **200**, copied world unchanged. Only the harness-owned child was stopped.
- Independent code review: no critical/important issue. An economy-free compatibility embedding now also refuses rank/permit-gated accepts rather than silently bypassing requirements. Production autoload already supplies the economy service.

## Changed files

```text
rp-gamemode/src/config/courier.ts
rp-gamemode/src/config/courier-progression.ts                 (new)
rp-gamemode/src/modules/courier/contracts.ts
rp-gamemode/src/modules/courier/courier-service.ts
rp-gamemode/src/modules/courier/courier-module.ts
rp-gamemode/src/modules/economy/state.ts
rp-gamemode/src/modules/economy/economy-service.ts
rp-gamemode/src/modules/economy/journal.ts
rp-gamemode/src/runtime.ts
rp-gamemode/tests/g13-courier.test.cjs                        (new)
rp-gamemode/scripts/courier-native.cjs                        (new)
docs/rp-development/FROSTVEIL_G1_3_GAMEPLAY_REPORT.md           (new)
```

Ignored `.local/g13` contains research/evidence/logs. `dist` and `.test-build` contain generated candidates/check outputs. Other dirty/untracked project files predate this task and were preserved. No engine, installed client, Launcher or asset-source file was changed for G1.3.

## Deployment readiness and backup plan

**DEPLOYED to localhost development server on 2026-10-18; owner gameplay acceptance pending.** Only server gamemode JS was deployed; no client JS installation, modpack release or Launcher rebuild/update. The original backup proposal below was superseded by the explicit owner waiver recorded in the deployment section.

Candidate: `rp-gamemode/dist/g13/rp-gamemode-7e2d31a78c5388f5484ec32d4f797389754bbf1e1e23de19b2d593728debf6d1.cjs`.

SHA256: `7e2d31a78c5388f5484ec32d4f797389754bbf1e1e23de19b2d593728debf6d1`.

Reviewable operation plan: `rp-gamemode/dist/g13/deployment-plan.json`.

1. After specific approval, owner closes Skyrim; stop only the existing development server and confirm its configured listeners are free.
2. While stopped, back up **world + rp-economy together**, server settings, current gamemode loader and referenced bundle under a fresh `build/rp-audit/g13/deploy-<timestamp>` directory; verify hashes. Existing generic deployment helper's world-only backup is insufficient by itself.
3. Deploy the hash-pinned server bundle under a new label, preserving auth/load order/ports and client baseline. Restart in a **visible PowerShell window**. Preserve existing localhost-only preview opt-in if present; do not enable it on a public server.
4. Verify boot and perform the short gameplay checks below. First economic command lazily writes schema 2; the live migration has not happened during this implementation.

**Rollback boundary:** G1.2 cannot read schema-two journals. Before any migration write, the old bundle can be restored. After migration/new gameplay, preserve new data and prefer a forward fix; never run the old economic code against upgraded records or restore only one store. Restoring the joint stopped-world/economy backup requires separate approval because it discards post-backup progress. There is no automatic destructive rollback or journal deletion.

## Short owner acceptance

1. `/job list`, Tab-complete `/job accept`, and try a locked regional contract: it should show the requirement and refuse it. New route IDs should appear without replacing chat UI.
2. Complete one beginner contract: verify existing beacon, one RP+XP reward and `/job rank`. A repeat `/job deliver` must grant nothing.
3. Earn at least 30 XP and 100 available RP; `/job guild buy regional` should deduct once, remain owned and unlock a regional contract. Check `/job guild` for long-distance requirements; no free-money/test unlock commands were added.
4. Select a new route, follow the named location/status direction until the unchanged beacon is in range, and verify completion at its actual landing point. First traversal/collision acceptance is still required separately for each of the four new destinations; untested destinations remain explicitly unverified.
5. Reconnect with an active contract, verify destination/quote/XP/permit/wallet persist, then cancel once and confirm beacon removal. Existing Satchel remains intact. Native three-process persistence already passed; no redundant live restart test is requested unless owner observes a discrepancy.

Remaining blockers are actual Skyrim route/gameplay acceptance. Two real clients, cross-player privacy/synchronization under network load, road/encounter balance and production-scale performance remain **unverified**. Do not start the next milestone automatically.


## Owner-approved deployment — 2026-10-18

Owner instruction: “deploy หรือรีเซิร์ฟเลยไม่ต้องสำรองโลก” — proceed now and explicitly skip the world backup. This supersedes the proposed joint backup step for this deployment; no further approval was requested.

- Stopped only the verified previous server PID **20484**, owner of localhost UDP 7777 and HTTP 3000.
- Backed up only economy files, server configuration and previous gamemode bundle. **No world backup was created.** Read-only before/after hashes confirmed world/economy/client files were unchanged by deployment before startup.
- Installed the approved hash-pinned G1.3 server bundle `7e2d31a78c5388f5484ec32d4f797389754bbf1e1e23de19b2d593728debf6d1`; server settings changed only `gamemodePath`. Bind/auth/load order remain intact.
- Started a new PowerShell window (`-NoExit`, `WindowStyle Normal`) titled **Frostveil G1.3 - Courier Contracts & Guild**, PowerShell PID **2040**, node PID **3960**. Existing explicit development beacon preview opt-in was preserved only on verified loopback settings.
- Verified foundation-ready log, exact active bundle SHA256, localhost UDP **7777**, HTTP **3000**, and authenticated metrics HTTP **200**. The console log is UTF-16 from Windows PowerShell Tee-Object; readiness verification decoded that encoding.
- Economic journal bytes remained unchanged at the startup observation. No player command was issued, no test funds/XP granted and no installed game/client file changed. Schema-two migration remains lazy on the owner's next economic command.

Deployment evidence and config/economy-only backups: `<LOCAL_PATH>`. Record: `g13-deployment.json`; startup log: `server-console.log`. The current deployment plan is `rp-gamemode/dist/g13/deployment-plan.json`.

**No joint world restore point exists for this deployment.** Economy-only backup is evidence/recovery material, not permission to rewind economy independently. After schema-two migration, do not run the old G1.2 economic bundle against the upgraded journal; preserve progress and use a forward fix. No automatic data rollback is scheduled. Actual new-route traversal and multiplayer behavior remain manual acceptance pending.
