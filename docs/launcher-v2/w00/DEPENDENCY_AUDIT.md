# Launcher V2 W00 dependency audit

## Reuse, harden or new

| Area | Disposition | Existing evidence and pilot boundary |
|---|---|---|
| Runtime and distribution trust | REUSE | Keep authenticated cohort, expiry and policy ledger. Distribution independently binds pack/channel, key, server profile and release asset size/hash/rights. [Policy and ledger](https://github.com/kaktv2016/frostveil-launcher/blob/29641f25666cf492614374770f5ae1808b90ca2c/src/main/runtime/service.ts#L35) · [Distribution policy](https://github.com/kaktv2016/frostveil-launcher/blob/29641f25666cf492614374770f5ae1808b90ca2c/src/main/distribution/policy.ts#L21) |
| Downloader | REUSE / HARDEN | Reuse the pinned helper, batch selection, size/hash checks, bounded QR and cancellation. Verify released-GUI batching and retry behavior on expired/disconnected authentication with the selected build. Steam Console has UNKNOWN evidence. [Helper acquisition](https://github.com/kaktv2016/frostveil-launcher/blob/29641f25666cf492614374770f5ae1808b90ca2c/src/main/runtime/depot.ts#L98) |
| Updater | REUSE / HARDEN | Preserve production Ed25519 trust, installed-NSIS/verified-download gating, running-game refusal and explicit install. The WIP NSIS gate still needs a valid release receipt. Manual recovery in source points to the verified NSIS installer. [Updater trust](https://github.com/kaktv2016/frostveil-launcher/blob/29641f25666cf492614374770f5ae1808b90ca2c/src/main/update-integrity.ts#L112) · [Explicit updater install](https://github.com/kaktv2016/frostveil-launcher/blob/29641f25666cf492614374770f5ae1808b90ca2c/src/main/launcher-update-service.ts#L114) |
| Apply, journal and Restore | REUSE / HARDEN | Reuse verified managed target, staging, preimages, recovery lease and conflict-checked Restore. Pin the profile's exact recoverable inputs and verify interruption and restored state on an isolated fixture. [Journal and preimages](https://github.com/kaktv2016/frostveil-launcher/blob/29641f25666cf492614374770f5ae1808b90ca2c/src/main/runtime/transaction.ts#L51) · [Restore](https://github.com/kaktv2016/frostveil-launcher/blob/29641f25666cf492614374770f5ae1808b90ca2c/src/main/runtime/transaction.ts#L171) · [Managed installer](https://github.com/kaktv2016/frostveil-launcher/blob/29641f25666cf492614374770f5ae1808b90ca2c/src/main/installer/engine.ts#L42) |
| Storage cleanup | REUSE / NEW | Reuse the narrow operation-owned redundant raw-copy check. A volume-aware inventory/recovery reconciliation is NEW audit evidence. Any broader policy requires an ownership and Restore decision before it can be proposed for implementation. [Operation-owned raw-copy guard](https://github.com/kaktv2016/frostveil-launcher/blob/29641f25666cf492614374770f5ae1808b90ca2c/src/main/runtime/transaction.ts#L90) |
| First profile release evidence | NEW | Bind Launcher installer, signed runtime, SKSE/bootstrap, complete SkyMP client/native and server identities to one profile and one acceptance receipt set. [Compatibility baseline](COMPATIBILITY_BASELINE.md) |

## Existing publisher obligations

**OBSERVED — dated report evidence.** Signed pack 1.0.9 expiry is reported as **12 November 2026 14:55:41 Bangkok** and runtime cohort expiry as **13 November 2026 01:24:55 Bangkok**. Renewal belongs to the existing signed publisher workflow. Live expiry state is UNKNOWN in W00. The WIP 0.1.31 distribution retry and its NSIS blocker belong to current release work. [Signed metadata deadlines](https://github.com/kaktv2016/frostveil-launcher/blob/29641f25666cf492614374770f5ae1808b90ca2c/FROSTVEIL_RUNTIME_NORMALIZATION_REPORT.md#L63) · [WIP evidence distinction](CURRENT_STATE_AUDIT.md#release-evidence)

## Decisions that block the proposed pilot

| Decision or evidence | Owner | Required result |
|---|---|---|
| ADR candidate — exact supported profile and matched artifacts | Launcher release owner with SkyMP maintainer | Approve one authenticated cohort, SKSE/bootstrap and native/client/server identity set and exclude unsupported profiles. |
| ADR candidate — Restore and space preflight | Launcher maintainer with QA | Demonstrate safe capacity checks and a recoverable preimage set for the chosen profile. The W00 inventory awaits approved roots separately. The proposed pilot excludes broader cleanup. |
| Provider acceptance evidence | Launcher QA and owner | Verify the released GUI cold batch, warm path and expired-session recovery with the existing provider. An alternate provider is outside the proposed pilot. |
| Release evidence | Release owner | Clear the applicable NSIS and signed metadata gates and bind the verified package before owner Play/join/reconnect/Restore. |

These are pending decisions and evidence requests. W00 changes workflow documentation and private audit evidence. [Approved scope](../../ai/milestones/launcher-v2-w00-baseline/SPEC.md)
