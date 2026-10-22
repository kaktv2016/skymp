# Frostveil G1.1 — Courier economy foundation

Date: 2026-10-17. Branch `develop`, base `5397cd3bf4666c942f78193107881d8cf0ac2748`; upstream engine baseline `2849e676fe008925384b26f34476e382a30bd877`. No commit, Launcher/Modpack/release changes, game launch or game-asset/native-engine edits performed for G1.1. Owner-approved localhost development deployment completed below.

## Status

| Label | Evidence / scope |
| --- | --- |
| IMPLEMENTED | Server RP wallet, existing Courier payouts, Satchel spending, versioned joint journal and native Courier reconciliation; compiled candidate below. |
| AUTOMATED TESTED | `npm test`: **130/130 PASS**, zero failed/skipped, including existing RP regressions, real filesystem faults and subprocess contention/termination. |
| DEV SERVER VERIFIED | Disposable native persistence fixture: three native server processes, real location reads/teleports, wallet/upgrade reload and replay refusal. Separate actual server wrapper smoke booted, authenticated metrics HTTP 200, stopped; copied world unchanged. |
| MANUAL ACCEPTANCE PASSED | Owner confirmed “ทดสอบผ่านทั้งหมด” on 2026-10-17 after the five reward/Satchel checks. Real solo gameplay accepted; restart persistence proven by three-process native fixture and on-disk state. No claim of a new real-character restart or two-client certification. |
| NOT IMPLEMENTED | Skyrim Gold conversion, inventory items/stat bonuses, GUI/shop, trading/banking, other professions, daily caps, NPC enabling, journal compaction/multi-host writers, G1.2. |

## Targeted audit and reused systems

- Existing actor/profile mapping and authentication in `rp-gamemode/src/engine/adapter.ts`: actor → current native user slot, reverse actor binding, connected status, GUID and native `profileId`. Wallet key is SHA-256 of native profile ID plus canonical native actor descriptor; no client-selected account/player/key/amount is accepted.
- Existing `CourierService`, `courierState`, `inZone`, command/module registries and RP chat. Courier still uses same-cell **3D** distance and the existing route/radius. The trusted transaction callback extends the old transition flow; legacy programmatic runtimes without an economy option retain their existing behavior/tests.
- Production auto-load in `src/index.ts` enables the persistent economy explicitly. Test/programmatic `createRuntime` must supply `economy:{storageRoot:...}` to enable it; omission does not create a hidden second balance or filesystem store.
- Current source AND active immutable bundle `6b6cb195c2587f4f046652ae185fe30cbb1dc3db2db681a2ac9d87f41cd317d2` use `courier-route-1`, radius **200**, pickup `[122694.9453125,-66909.78125,11639.1201171875]`, delivery `[123342.421875,-65940.078125,11686.185546875]`, cell `3c:Skyrim.esm`, reputation reward 1. These values and development/devpos flags (`false/false`) were not changed.
- No existing local persistent Courier economy was found. `skymp5-server/ts/systems/masterApiBalanceSystem.ts` is an external Master API account purchase balance, returns zero/refuses purchases in offline mode, and is not the local RP earnings ledger. It is not replaced or duplicated as a local mirror.
- Official pinned [properties documentation](https://github.com/skyrim-multiplayer/skymp/blob/2849e676fe008925384b26f34476e382a30bd877/docs/docs_properties_system.md) and [scripting reference](https://github.com/skyrim-multiplayer/skymp/blob/2849e676fe008925384b26f34476e382a30bd877/docs/docs_serverside_scripting_reference.md) were checked alongside local source. `InventoryBinding.cpp` exposes inventory get/set, but that does not prove an atomic secure Gold001 payment plus job-state transaction. **RP currency is explicitly separate from vanilla Skyrim gold**; no inventory/gold setters were added.

## Persistence and migration

Native `private.rp.v1.courier` remains schema 1, unchanged in shape. Identity, inventory, equipment, appearance, position and unrelated dynamic fields are not migrated/replaced. The first economic read imports existing Courier progress with **zero RP** and zero Satchel; completed historical jobs are not retro-paid. An existing active job receives one persisted instance identity and base reward quote at import. Corrupt/future native Courier records are refused rather than reset.

`rp-economy/` relative to the server working directory is the production journal root, outside the HTTP-served `data/` folder (`skymp5-server/ts/ui.ts`). Programmatic fixtures use explicit independent temporary roots. Per-character `<hashed-identity>/journal.jsonl` contains a SHA-256 chained sequence of full joint snapshots:

```
schemaVersion: 1
identity: hashed native profile/actor identity
revision: bounded monotonically increasing integer
balance: integer 0..1,000,000,000
satchelLevel: integer within configured maximum
courier: existing schema-1 Courier state
activeJob: null OR { id: revision:UUID, reward: server-quoted integer }
lastMutationAt: server timestamp
lastTransaction: { id: revision:UUID, kind, jobId }
```

Each complete record commits Courier completion, the balance change and progression together. Commit uses append + `fsyncSync` **before** native mirror and success response. Native `CustomPropertyBinding.cpp`/`MpObjectReference.cpp` updates in-memory dynamic fields and requests asynchronous saving; `WorldState.cpp` retries failed saves, and `FileDatabase.cpp` writes temp/renames. The JavaScript `mp.set` return is not a durable-save acknowledgement. Therefore the flushed joint journal is authoritative for economy and Courier after migration; native Courier is a compatibility mirror. A newer journal repairs a coherent but older native Courier save before commands can act, including after restart. A corrupt/future native mirror fails closed for review.

Native inventory/physical fields are not placed in this journal. Preserve **both world and economy root together** when backing up/restoring a stopped server. Do not restore only an older journal, reuse it with a reset/different world, run old non-economic job code against an initialized economy, or delete player journals to "repair" balances. These are unsupported operator changes, not automatic migration paths.

## Transaction/idempotency contract and limits

- Authenticated per-character guard and synchronous read/validate/commit serialize economic commands. Reentrant rejection cannot release the outer guard; separate processes contend for a root writer lease.
- Acceptance records a stable UUID instance and quoted payout. Delivery reuses existing active-job and native location checks, then clears that exact instance and increments balance/progress in the same journal record. Repeat/reconnect/restart delivery sees idle state and cannot pay that instance again. Failed/ambiguous native mirroring never issues a separate payout.
- A torn final append is truncated only to an intact, checksummed complete prefix. Complete corrupt/unknown records and missing initialized logs refuse service, never fall back to zero/older money. A complete record whose original flush failed is not exposed until recovery **successfully flushes** it; continuing flush failures remain unavailable.
- Writer lease recovery only follows a confirmed dead PID and an exclusive immutable claim for that stale token, then rechecks file identity before replacement. Competing recovery processes cannot both write. If the takeover itself is interrupted, its claim is retained and service intentionally requires stopped-server operator recovery rather than guessing. PID reuse may also require operator review.
- Testing proves single-instance payout/idempotency for the exercised command/crash/reload boundaries, **not universal exactly-once delivery under arbitrary power loss or storage failure**. Windows directory-entry durability is not established by file fsync alone. Root deletion, disk/hardware loss, manual history rollback, malicious same-OS-user file editing and multi-host/shared-filesystem writers are outside the guarantee.
- Journals currently have a 16 MiB per-character bounded-read limit and 64 KiB record limit. Capacity exhaustion refuses further writes without resetting balances; compaction/maintenance tooling is NOT IMPLEMENTED. Checksums detect damage, not privileged-operator forgery. Synchronous filesystem operations suit this small development milestone; large-player performance is unverified.

## Balance and commands

Central source: `rp-gamemode/src/config/economy.ts`; settings validated at runtime creation.

| Setting | Development default |
| --- | ---: |
| Initial balance / Satchel | 0 RP / level 0 |
| Base delivery payout | 25 RP |
| Additional payout per Satchel level | 5 RP |
| Satchel purchase costs, next level | 100 / 250 / 500 RP |
| Maximum Satchel level | 3 (cost-array length) |
| Balance cap | 1,000,000,000 RP |
| Mutation interval | 750 ms; existing chat interval remains 750 ms |

At base level four successful deliveries fund level 1. Rates are provisional until the owner measures real route travel time. There is no daily cap or additional farming timer. Upgrade bonuses apply only to jobs accepted afterwards; existing job quotes do not increase after a purchase. Invalid/negative/unsafe prices, reward arithmetic and balance overflow refuse mutation and preserve the contract.

| Command | Behavior |
| --- | --- |
| `/wallet` | Current server RP balance, explicitly distinct from Skyrim gold. |
| `/job`, `/job status` | Existing status plus Satchel and current expected payout. |
| `/job accept` | Existing pickup validation; creates a durable quoted instance. |
| `/job deliver` | Existing destination validation; commits payout once. |
| `/job abandon` | Existing abandon, no payment. |
| `/job upgrades` | Level, next cost and future-job bonus. |
| `/job upgrade satchel` | Server price deduction + level increment in one record. No physical item/stat change. |

Replies use existing RP chat; new wallet/progression/error text includes Thai. Arguments cannot specify player IDs, amounts, prices or levels. Existing `/profile`, `/roll`, `/try`, `/me`, `/do`, `/whoami` remain registered and tested. Successful financial commits log only operation kind, revision and delta, not secrets/client payloads.

## Automated evidence

`rp-gamemode/.local/` logs and `build/rp-audit/` fixture artifacts are private/ignored, not production state.

| Required scenario | Evidence |
| --- | --- |
| New wallet, legacy migration without money backfill | `tests/economy.test.cjs`, legacy-active and native migration checks. |
| Valid payout once, invalid location, duplicates, reconnect | Same tests plus real native location fixture. |
| Concurrent/reentrant completion and purchase | Promise burst and meaningful synchronous reentrant guard regressions. |
| Identity/actor-slot reuse and connection mapping | Native session checks retained; changed profile during validation aborts, distinct profile cannot inherit wallet; existing engine-identity tests. |
| Native save/reload, no restart replay, upgrade reload | `scripts/economy-native.cjs`: three actual native processes on copied world, balance 30, level 1, completed 12 from initial 7. Native save deliberately rewound to 7 in fixture, reconciled/re-persisted to 12, third reload confirms. |
| Insufficient funds, max level, price input, active quote, overflow | Economy command/config regressions. |
| Persistence failure before/partial/after commit, mirror failure | Real-file faults, actual failed `fsyncSync`, and mirror-before/after tests. |
| Process death and competing writers | `tests/economy-journal.test.cjs` + `economy-worker.cjs`: terminated subprocess after partial/committed append; two-process stale-lease contention. Prior unsafe lock logic produced two writers in a deterministic red reproduction; fixed version permits one. |
| Corrupt/future complete economy state | Refused without resetting/rewriting the stored journal. |
| Existing RP command/client regressions | Full 130-test suite; no client source/UI changes for G1.1. |

Commands run: `npm test` (130/130); `node scripts/economy-native.cjs` (PASS); `node scripts/native-integration.cjs` (existing identity native regression PASS); `node scripts/wrapper-smoke.cjs` (PASS). Build includes TypeScript type/type-test checks with existing pinned tools and no new dependencies. Additional runtime externals are only Node built-ins `fs`/`path` alongside existing `crypto`.

Latest G1.1 native fixture: `build/rp-audit/g11/native-hwbUDx/summary.json`; wrapper fixture: `build/rp-audit/phase21/20261013-131609/wrapper-zObQvK/`; old identity native regression: `.../native-JmVYHE/`. Native location and persistence are real; connection/session bindings in the direct native command fixture are explicitly synthetic, so this is not real network authentication/client gameplay proof.

Independent review found two journal issues (failed flush recovery and stale-lock takeover race), both corrected with regressions and re-reviewed; the reentrant ownership issue was likewise fixed. No remaining release blocker was identified in that read-only review.

## Source and artifacts

New: `src/config/economy.ts`; `src/modules/economy/{journal,state,economy-service}.ts`; `tests/{economy.test,economy-journal.test,economy-worker}.cjs`; `scripts/economy-native.cjs` (all under `rp-gamemode/`).

Extended existing `src/modules/courier/{courier-service,courier-module}.ts`, `src/modules/chat/chat-service.ts`, `src/runtime.ts`, `src/index.ts`, `scripts/build.cjs`, `.gitignore`. Added the G1.1 plan and this report. Pre-existing unrelated changes in the dirty develop checkout were preserved.

Reviewable built bundle SHA-256: **`acb85d7a69ecc0632330ee51141f6836b57bb5fe1c66508c5252dfb049ada71b`**, sealed as `build/rp-audit/g11/reviewable/<SHA>.cjs`. It replaced the previous `6b6cb195...` bundle after explicit owner approval. Current development server PID **28548**, started 2026-10-17 07:19:13 +07, listens at `127.0.0.1:7777` (UDP) and `127.0.0.1:3000` (HTTP). The previous PID 1060 had already exited before deployment; no process needed termination. No Skyrim/SKSE process was running at preflight. Disposable test servers have exited.

## Deployment gate and manual checklist

G1.1 specification section 11 requires approval before deploying to a named development instance connected to real player/world files. Owner explicitly approved: “อนุมัติ deploy G1.1”. Deployment and owner solo acceptance are complete; see final acceptance record below.

- Rebuilt/retested immediately before deployment: **130/130 PASS**, zero failed/skipped, log `rp-gamemode/.local/g11-approved-deploy-tests.log`. Reviewed candidate hash unchanged.
- Stopped-state backup: `build/rp-audit/g11/approved-1792196336543/`. All **18 world files** copied and SHA-256 compared, plus configuration and previous active bundle. No existing `rp-economy` directory was present. Preserve this backup privately; configuration contains credentials.
- Existing workflow: `node scripts/deploy.cjs --label g11-courier-economy1`. Its additional rollback record is `build/rp-audit/phase21/20261013-131609/deployments/g11-courier-economy1/deployment.json`.
- Verified world hashes unchanged by deployment; config changed only `gamemodePath`. No world reset, character modification or game-file installation performed.
- Started the existing server entry point `node dist_back/skymp5-server.js` from `build/dist/server`, hidden background process PID **28548**. Logs: backup folder `server-stdout.log` / `server-stderr.log`. RP foundation ready, authenticated metrics **HTTP 200**, UDP/HTTP listener ownership verified. Startup evidence: `startup-verification.json` in backup folder.
- Economy journal is enabled through the deployed auto-load entry point and is initialized on authenticated character access. No fake player/command or live-data migration was injected for the smoke check.
- Back up world and economy together once gameplay initializes the journal. Do not restore old gameplay code over initialized economic data without an explicit migration/reconciliation plan. Further restart/manual gameplay remains owner-driven; no two-client claim.


Owner in-game checklist (initially **MANUAL ACCEPTANCE PENDING**, now closed by owner acceptance and existing automated/native evidence as recorded below):

1. Existing character logs in; inventory/equipment/position/profile and prior Courier totals/active job remain correct. `/wallet` is initially 0 RP, not the Skyrim gold count. Existing active contract may be completed once at base quote; completed history grants no backpay.
2. `/job status`, `/job upgrades`; retain exact current route. Accept at pickup, attempt deliver outside radius (0 payment), travel and deliver in range (+25 RP at level 0).
3. Repeat `/job deliver`, rapid submit and reconnect: no second payment. `/wallet` matches one payout.
4. Attempt an unaffordable `/job upgrade satchel`; balance and level unchanged. Earn four base deliveries total (100 RP), buy Satchel once: 0 RP, level 1.
5. Accept/deliver a new job: +30 RP. A job accepted before upgrading retains its original quote. Confirm Satchel is progression only, no inventory item/carry-weight/speed change.
6. Exit/reconnect and compare job/quote/balance/level. With separate approved development restart, repeat comparison and attempt old completed delivery again (no payout).
7. Check `/profile`, `/whoami`, `/roll`, `/try`, `/me`, `/do` and ordinary chat; verify no private wallet information is broadcast to neighbours. Two-client validation remains pending until two real clients test it.

G1.1 implementation, deployment and owner solo acceptance are complete. Follow-up limitations: optional later two-client checks and operator restore/recovery rehearsal. Stopped-server backup and approved development deployment are complete. Recommended G1.2: use measured Courier timings and real multiplayer results to tune these central rates and prioritize economy backup/maintenance tooling before adding professions or trading. G1.2 has not started.

## Owner evidence — first wallet check

2026-10-17: owner screenshot `codex-clipboard-17a7ba53-7278-4d49-9109-ab8d811fb705.png` shows the real in-game RP chat response: balance **0 RP**, explicitly distinguished from Skyrim gold. **Initial wallet display: MANUAL VERIFIED**. This proves command response/display for the connected character, not delivery payment, upgrade purchase, reconnect/restart persistence or multiplayer. The screenshot also shows an empty-chat validation message; it is not a wallet persistence error. At that observation, all other manual acceptance items were pending; superseded by the final acceptance record below.

## Owner evidence — reward and Satchel checks

2026-10-17: screenshot `codex-clipboard-90aaedac-0606-4eec-b804-ce12e88db18b.png` confirms successful delivery, existing completion count 1 → 2 and wallet 25 RP. Owner then explicitly reported all five follow-up checks passed: repeated delivery grants no extra payment; unaffordable upgrade leaves 25 RP unchanged; three more deliveries bring balance to 100 RP; Satchel purchase deducts 100 RP leaving 0 RP / level 1; a newly accepted delivery earns 30 RP. These five cases are **MANUAL VERIFIED (owner-reported)**.

Read-only journal observation at recording time: `[{"revision":12,"balance":30,"satchelLevel":1,"completedDeliveries":6,"courierLifecycle":"idle","lastTransaction":"deliver"}]`. This is supporting persisted-state evidence, not a substitute for the owner report. At that observation, reconnect, development restart, old-command regression and invalid-location acceptance were not yet confirmed; see final acceptance record below. No restart performed during recording.

## Final acceptance — 2026-10-17

**G1.1 COMPLETE — owner solo acceptance confirmed.** Owner explicitly stated “ทดสอบผ่านทั้งหมด” after confirming the five reward/purchase cases. The owner also requested avoiding redundant tests: existing RP command tests are reused, and the restart criterion uses actual native three-process save/reload/replay evidence plus the real character journal, rather than requiring another real-character restart. No new live-world restart is claimed.

Evidence coverage: initial zero wallet and preserved legacy progress (screenshots + native migration); valid payout, duplicate refusal, insufficient funds, 100 RP purchase and future 30 RP payout (owner five-case report + journal); invalid location and reconnect accepted by owner final confirmation, with automated coverage; malformed/spam/concurrency/overflow/max/schema/failure recovery (130-test suite); restart persistence/replay and preserved physical state (real native three-process fixture); old RP commands (prior owner validation + current regression suite). New per-case telemetry is not invented from the broad owner confirmation.

All G1.1 required code/config/commands/tests/deployment/report items are delivered. Optional two-client certification, arbitrary hardware power-loss guarantees, journal compaction and operator restore rehearsal remain outside this completed solo milestone. No G1.2 work or Git commit was started.

Operational preference: for future server starts, open a visible PowerShell/command window with logs so the owner can stop it using Ctrl+C. Do not restart the currently running instance merely to change window visibility. The recorded hidden start predates this preference.
