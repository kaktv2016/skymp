# G1.1 Courier economy implementation plan

> Execute inline using superpowers:executing-plans and test-driven-development. User's G1.1 specification authorizes server gameplay implementation; no additional design authorization is inferred for real-world deployment.

Goal: existing Courier earns persistent server RP currency and spends it on a persistent Satchel upgrade.

Spec: user attachment `7cd3d445-551a-414f-94e4-7566ab23f84b/pasted-text-1.txt`, all fourteen sections. No Launcher/modpack/game/native asset changes, commits or live deployment. Existing dirty develop checkout contains the working untracked gamemode; preserve it in place.

Architecture: retain CourierService transition/location validation and existing actor/profile/session binding. A server-owned append-only, flushed, checksummed per-character journal stores Courier state, stable active-job identity/quoted reward, balance and upgrade together. Native `private.rp.v1.courier` remains a backwards-compatible mirror; committed journal wins after a mirror failure/native async save rollback. Import legacy Courier only for the initial zero-balance record, never retro-pay completed deliveries. RP currency is not Gold001 or the separate, unavailable-in-offline-mode Master API balance.

Persistence contract: one process owns a journal-root lease; synchronous commands and a per-character guard serialize mutations. Complete flushed records advance sequence/hash chain; truncated final append recovers only to verified complete prefix. Corrupt complete records, unknown schemas, missing initialized logs, overflow and identity mismatches refuse service without resetting money. No rollback to a previous balance after a valid committed record. Existing native property setter has no fsync/ack, so economic acknowledgement requires journal commit first. File fsync does not prove power-loss durability of Windows directory entries; no universal exactly-once claim. Root/journal deletion, multi-host writers and offline restore of only half the data are unsupported and documented.

Defaults: zero balance, base25 RP, +5 RP/reward per Satchel level, costs100/250/500, max3, balance cap1e9. Reward quoted at accept (legacy-active quote at import); upgrades affect future accepts. Existing radius200 and coordinates unchanged. Existing chat750ms limiter retained; economic mutation interval750ms centrally configurable, no daily limit. No physical items/stat boosts.

- [x] Task1 RED/GREEN: journal/config/schema validation, exclusive writer lease, failure before/partial/after commit, reopen and child termination recovery. No game dependencies.
- [x] Task2 RED/GREEN: extend existing Courier via trusted transaction callback; wallet/upgrades commands, actor-bound identity, conservative arithmetic, durable instance identity, replay/spam/concurrency/session change, coherent native mirror recovery. Preserve old non-economic programmatic runtime behavior; auto-loaded server runtime enables persistent economy explicitly. Existing RP regression suite.
- [x] Task3 actual native separate-process save/reload + disposable wrapper boot/restart, old character/profile/inventory preserved in fixtures, new wallet/job/upgrade reload/replay checks. Inspect available process handles and loopback port before starting; never touch live7777/world or Launcher/game files.
- [x] Task4 independent fresh review, fix important findings with regressions, full verification and required FROSTVEIL_G1_1_COURIER_ECONOMY_REPORT.md/manual checklist. Live deployment requires separate explicit approval because the running named instance uses real rp-world.

Review focus: old engine world rolling back while journal is newer; ambiguous sync failures after append; stale/reused actor/profile slots; unknown persisted versions/config changes; spending during an active quoted contract. Test each against actual state, not only response text.

## Verification ledger (2026-10-17)

Completed: final full suite 130/130; actual native three-process save/reload and older mirror reconciliation; existing native identity regression; disposable server wrapper boot with authenticated metrics 200. Reviewed bundle SHA-256 acb85d7a69ecc0632330ee51141f6836b57bb5fe1c66508c5252dfb049ada71b. Evidence paths and all 16 acceptance scenarios are mapped in the required report.

Pending separate gate: owner approval to deploy this concrete bundle to current localhost development instance backed by real rp-world. No live deployment/restart or in-game acceptance performed. Keep existing active bundle and configuration unchanged until that approval. Manual testing remains pending; G1.2 not started.

## Approved development deployment

Owner approved deployment explicitly. 2026-10-17 07:19 +07: fresh 130/130 tests, reviewed hash unchanged; current world/config/old bundle backed up and verified (18 world files), no prior economy root. Existing deploy.cjs label g11-courier-economy1 changed only gamemodePath; world hashes unchanged. PID 28548 started on localhost UDP7777/HTTP3000, RP boot marker and authenticated metrics200 verified. No game launch or invented live player commands. Manual in-game acceptance remains pending; see required report for checklist and exact backup/evidence paths.

## Completion

2026-10-17: owner confirmed all tests passed. Solo acceptance closed using owner-reported real gameplay, existing RP regressions, on-disk wallet/upgrade evidence and actual three-process native restart/replay tests; do not claim an additional real-world restart. Report updated with exact evidence scopes and remaining nonblocking limitations. No commit or G1.2 work. Future server starts must use a visible PowerShell window per owner preference.
