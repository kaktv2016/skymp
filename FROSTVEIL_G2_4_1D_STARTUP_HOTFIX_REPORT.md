# Frostveil G2.4.1D — isolated startup hotfix

Date: 2026-10-27. Scope: existing development activation only. **No Skyrim launch, real profile activation, session grant or visual acceptance was performed.**

## Follow-up: owner launch failure at 17:32 on 2026-10-27 (Asia/Bangkok)

The owner retry reached active profile state but timed out with ECONNREFUSED. Its real evidence is `readiness-1793097167443-11656.json`: 118 failed HTTP attempts over 60,001 ms, with **no new supervisor startup directory**. This was a second failure at the **outer PowerShell process execution boundary**, before Node supervision or native engine initialization; the previous Temp import fix was not reached by this attempt.

On this machine, Node 24.11.1's `spawn(powershell, …, {detached:true, stdio:'ignore'})` produces a PowerShell 5.1 process that exits **0 without executing -File**. A harmless sentinel reproduces that behavior; switching only -NoExit to -NonInteractive does not fix it. The non-detached controls execute the sentinel, and Start-Process executes it with its intended exit code 7. Evidence: `outer-launch-matrix.json`, `outer-ignore-stdout.log`, `outer-files-stdout.log`, and the real Windows regression test.

The owner CLI now uses the established Windows **Start-Process -WindowStyle Normal** mechanism through a bounded, hidden non-detached helper. It returns the actual visible server PowerShell PID, preserves the same script/root/startup identity, and records helper stdout/stderr and creation diagnostics. The original three-level server ancestry and exclusive loopback ownership checks are unchanged. Readiness detects an exited/incorrect outer process immediately and includes the launch timestamp so an early server failure preceding the first HTTP attempt is still found. It does not accept PID creation alone as success.

The native diagnostic probe now calls **the same launcher function** as the owner CLI. Actual result: PowerShell **20320** → supervisor **9480** → engine **21056**, both 127.0.0.1:17777/17778 owned by that engine, real diagnostic HTTP response, zero custom actors, and clean owned-tree shutdown with both ports released. Its diagnostic health remains rejected for Play. See `outer-hotfix-server-probe.log` and `hotfix-server-probe.json`.

The **actual sealed owner startup script** was also exercised through that new launcher with the real receipt left reverted: it executed, retained its failure log and was correctly rejected at LOCAL_PROFILE_TRUST within seconds. Evidence: `outer-hotfix-negative-launch.json` and `outer-hotfix-negative-readiness.json`. No confirmation was simulated and no installed profile was activated.

Follow-up validation: RP **395/395**, real assets/startup **15/15**, client **58/58**, Launcher **161/161** (including the real outer-console and early-exit regressions); Launcher typecheck and script syntax passed. Independent read-only review found no actionable issue. Source-only recovery snapshot: `build/rp-audit/g241d/outer-hotfix-before-1793098361271`. Final integrity evidence: `outer-hotfix-integrity-final.json` verifies 145 production files, 7 owner source assets and 2 installed profile files unchanged, with all 12 runtime seals valid. The twelve deployed runtime artifacts, original supervisor/configuration seal and owned assets are unchanged; this patch changes the local launch helper and its diagnostic harness only. No installed client or public Launcher release is required.

Follow-up commits: Launcher `9ecb7ae58b3f5cb32af5077223e939297bb2d98e`; SkyMP diagnostic harness `f0528de231519903214c87f18b78edd91f90a229`. Pushed only to the same authorized owner development branches. This report follows in the SkyMP branch. Real owner activation/Skyrim launch/visual acceptance after this follow-up remains pending; use the same owner command below.

## Root cause and failed gate

The actual pinned server engine reproduces an unconditional **gate 2: runtime module loading** failure. SkyMP `requireTemp()` copies gamemode source to `%TEMP%/skymp5-server…/*.js`. The D bootstrap used `require('./g241d-runtime.cjs')`, which resolved beside that temporary copy instead of the verified isolated root. The process exits with code 1 before runtime boot completes or health is published. This is not evidence of a port conflict or insufficient startup timeout.

Evidence retained under `build/rp-audit/g241d`:

- `hotfix-engine-original.log`: real Node 24.11.1 / pinned native engine, PID 24320, `MODULE_NOT_FOUND`, temporary gamemode require stack, exit 1.
- `hotfix-red.log`: temporary-loader regression reproduces the same failure before the patch.
- `hotfix-engine-fixed-inactive.log`: the same real engine now resolves the runtime and reaches `LOCAL_PROFILE_TRUST`; correctly rejects the owner's reverted receipt, without `MODULE_NOT_FOUND`.

An additional proven diagnostics defect hid the failure: Windows PowerShell 5.1 with `$ErrorActionPreference='Stop'` and native `2>&1 | Tee-Object` terminates the pipeline on the first native stderr record. `hotfix-original-script-repro.log` reproduces `NativeCommandError`; the advertised `isolated-server.log` was never created. Node's nonfatal `punycode` warning is also written to stderr. The original owner's full startup output therefore was not recoverable; the exact chronological first failure in that original terminal is not claimed. Both executable startup defects are repaired, rather than interpreting the generic checker exception as a cause.

## Changes

SkyMP repository:

- `rp-gamemode/scripts/g241-bootstrap.cjs`: validate/resolve the isolated cwd, use an absolute runtime import, pass the existing isolation guard explicitly.
- `rp-gamemode/scripts/g241d-runtime.cjs`: remove its bootstrap back-import to avoid recursive initialization; preserve profile/catalog/plugin/proof gates; report named startup stages and the per-launch health identity.
- `rp-gamemode/scripts/g241d-dev.cjs`: Node supervisor captures complete separate stdout/stderr before forwarding to the console; records process exit and last runtime stage. PowerShell no longer merges stderr through a terminating pipeline. Seal regeneration includes the generated startup script and enforces its isolated location.
- `rp-gamemode/research/g241b/tests/g241d-startup.test.cjs`: real temporary-loader, wrong-environment rejection, raw stream/exit preservation and stage regressions.
- `rp-gamemode/scripts/g241d-startup-probe.cjs`: reproducible diagnostic-only native server test, with fresh storage, real resources/catalog/runtime, denied authorization and denied appearance proof. It never activates a client profile.

Launcher development repository:

- `scripts/npc-startup.mjs`: bounded readiness checks, explicit failed stage/expected/observed/PID/port diagnostics, retained readiness history and server-log locations. Verifies the PowerShell → sealed Node supervisor → exact Node engine ancestry and exclusive loopback port ownership. A fresh startup UUID rejects stale health files. Diagnostic-only health is rejected.
- `scripts/npc-development.mjs`: reuse that checker; handle process creation errors; include startup preflight failures in the existing exact configuration rollback; recheck active profile immediately before launch.
- `tests/npc-startup.test.mjs`: health/profile/catalog/startup mismatch, parent spoofing, wrong/shared port owners, transient readiness, bounded timeout and retained native-stage diagnostics.

There is no installed client JS/DLL change, public Launcher release, asset installation or R2 publication. The existing local development CLI remains the delivery mechanism. Launcher source version remains 0.1.26; the fixed profile hash remains `634a433c9a6a9c5ce81a2324ab473c5c8a1594651cbdb8cb4349981670d4d1de`.

## Verification

| Check | Result |
|---|---|
| RP build/typecheck and full regression | 395/395 |
| Real resource/catalog and startup regressions | 15/15 |
| Client/source regressions, including Spawn Recovery | 58/58; client typecheck passed |
| Launcher activation/trust/schema/installer/readiness | 159/159; Launcher typecheck passed |
| Script syntax and diff whitespace | Passed |
| Independent read-only code review | No actionable findings |
| Native engine + real catalog + full module boot, fresh diagnostic storage | Passed |
| Real process ancestry, UDP 17777 and TCP 17778 | Passed; one verified engine, both loopback |
| HTTP `/g241d-health.json` | Real diagnostic response received; correctly rejected for Play |
| Diagnostic shutdown | Owned tree stopped; both ports released |
| Inactive real profile | Remains reverted; real startup correctly denied before engine creation |
| Code/config rollback and forward restore | Three isolated files + handoff restored and hash-verified; fixed counterparts restored and verified |

Final native diagnostic evidence: `hotfix-server-probe.json` / `hotfix-server-probe-final.log`. PowerShell PID **6416** → supervisor **22196** → engine **8352** owned both diagnostic ports. Health explicitly reports `DIAGNOSTIC_ONLY_PROFILE_INACTIVE`, zero custom actors; no real profile receipt was synthesized. The structural ownership check is separate from profile acceptance. Failed diagnostic harness attempts and their complete native logs are retained, including the test harness's initial missing `data/scripts` directory and cleanup query typo; both corrected before the successful final run.

The isolated owner deployment is updated and resealed in `build/rp-audit/g241/dev-7FNiLN`. Twelve runtime artifacts, the supervisor, startup script and normalized configuration digest validate. Backup: `build/rp-audit/g241d/hotfix-before-1793040680983`; fixed counterpart and recovery manifest: `hotfix-fixed-code` / `hotfix-rollback-verification.json`. Rollback contains code/config metadata only, never world/character/economy data. The rollback exercise verified those three files and handoff, not a successful boot of the deliberately broken previous D revision; source history preserves both repository versions. The fixed recovery snapshot also contains the current supervisor and Launcher startup sources, plus their hashes. No server is left running by the test.

Protected production manifest: **145 files unchanged**, SHA-256 `5edaa20a730ce79b34675b06224bd2a47ebfb4b116cef5af15296f10677d6616`. Both installed profile files and all seven owner source assets are byte-identical; the existing CLI also verifies nine installed runtime pins. See `hotfix-protected-before.json` and `hotfix-integrity-final.json`. Production 7777 was only inspected, never started/stopped/modified. Existing NPC persistence was not replaced; diagnostic storage is separate.

## Security and remaining acceptance

Deliberate terminal `CONFIRM`, authenticated local metadata, immutable resource/runtime seals, exact client/server identity mapping, owner authority, nonce/session/generation checks and mapper-arm requirements remain enforced. No health-check removal, reveal-all, arbitrary console/native interface, production change or G2.4.2 work is included. Diagnostic metadata contains public hashes/process facts, not keys, receipt contents or authorization tokens. Raw stdout/stderr stays in the private audit tree, outside HTTP data.

The readiness envelope is explicitly bounded to 60 seconds (the old 40 × 1-second HTTP timeout + 500-ms sleep envelope); process queries now respect the remaining deadline. This is not a timeout increase used to conceal the module failure. A retained fatal startup stage can terminate waiting early.

Actual owner activation → production-contract `SAFE_WAITING` → Skyrim launch → session grant → visual NPC proof is **pending owner execution**. The diagnostic server deliberately cannot satisfy that contract. No claim of a successful complete owner flow or multiplayer rendering is made.

## Git and next owner command

Code commits: SkyMP `f9cdb0a31321bdcda1f2887784f933fa8a16119c`; Launcher `dd6a00ceed776f84a7f8613250e279864198e97c`. Both pushed to the owner development repositories; this report follows on the SkyMP branch. Authorized branches only: SkyMP `frostveil/dev/npc-activation-g241d`; Launcher `origin/dev/npc-local-activation-g241d`. No force push or upstream push.

With Skyrim closed, run the same command in your own terminal and type `CONFIRM` after reviewing the plan:

```powershell
$npcDev='C:\Users\basba\OneDrive\Desktop\skyrim-rp\skyrim-rp-launcher\scripts\npc-development.mjs'
node $npcDev activate-and-play
```

Expected next result: the verified isolated server passes its real health/ownership gates before SKSE opens. If it fails, no game should launch; the error identifies the failed stage and exact diagnostics paths, and closed-game configuration rollback remains enforced. After connecting to 17777, use the existing `node $npcDev grant` owner confirmation and `/npc identity` workflow from the D report. Owner rendering/appearance/reconnect acceptance remains pending.
