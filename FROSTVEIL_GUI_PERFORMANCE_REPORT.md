# Frostveil GUI performance investigation — 2026-10-23

Status: **profiling stage deployed; optimization and owner acceptance pending**.
No claim that the stutter is fixed. No measured before/after Skyrim numbers yet.

## First live capture

Owner clarified that the background game remains smooth while GUI/cursor stutter.
Actual CEF viewport: 3440x1440 (about 19.8 MB per full BGRA paint), devicePixelRatio=1.

| Scenario | rAF samples | Average interval | Maximum window P99 | Long tasks |
|---|---:|---:|---:|---:|
| Closed baseline | 8704 | 16.674 ms | 16.666 ms | 0 |
| Dialogue | 3491 | 16.862 ms | 49.998 ms | 3, mean 78 ms |

These are actual browser callback intervals, **not displayed game/UI FPS**. A separate ten-second closed-UI sample had 600 callbacks at 16.666 ms and no longtasks. JS scheduling mostly keeps up, which does not establish paint, upload or input throughput. The initial mouse proxy incorrectly compared rAF's frame timestamp with event performance.now(), producing negative values. It is corrected to sample performance.now() inside rAF; discard the initial mouse series. No useful click-response samples were captured. Raw evidence is preserved in `.local/gui-performance/browser-captured.json` locally.

## Evidence and boundaries

### Owner profiling pass 2

Captured the owner's completed test from `fvGuiProfile-logs.txt`; preserved an immutable copy of the captured rows in `.local/gui-performance/owner-pass-2.json` (local diagnostics only). This log is a new process/session capture, not an extension of the first table above.

| Scenario | Callback samples | Mean rAF interval | Largest window P95 | Largest window P99 |
|---|---:|---:|---:|---:|
| Baseline (48 aggregate windows) | 13081 | 16.670 ms | 16.666 ms | 16.666 ms |
| Dialogue (15 aggregate windows) | 3963 | 16.737 ms | 33.332 ms | 33.332 ms |

Dialogue mouse-event-to-rAF proxy: 204 events, weighted mean 2.432 ms, largest window P95 13.900 ms and P99 20.200 ms. These are corrected, non-negative measurements; they exclude native input delivery and presentation. No longtask entries were captured. One click-to-next-dialogue-response sample took 313.4 ms: insufficient samples and instrumentation boundaries to attribute that delay to networking, server work, CEF dispatch, or presentation.

Source tracing confirms `ctx.sendEvent` emits a reliable CustomEvent directly, and DialogueRuntime validates and publishes the owner property synchronously. No deliberate 300 ms dialogue delay was found in these functions. Do not remove server validation or acknowledge service success before the server response to mask the delay.

Conclusion from this pass: browser callback scheduling is usually near 60 Hz; the owner's observed stutter is still unresolved. These metrics do not measure actual native paint/display rate. Native profiler delivery, native paint/input measurements, and a static-surface comparison remain necessary before a renderer optimization can be verified. No additional manual repetition of this same browser-only pass is requested.

- Owner reports about 30 game FPS with Dialogue open, with much worse perceived cursor responsiveness. These are owner observations, not instrumented FPS or latency results.
- Installed SkyrimPlatformImpl.dll SHA256 is `18b530ef76a5b84d6da090b5e9c87f7e93b436e02104b48aa1602a8b26d6e30a`, matching the last signed cursor release.
- Current corresponding DX11RenderHandler copies `width * height * 4` bytes on every paint using WRITE_DISCARD under m_textureLock. It ignores dirtyRects and RowPitch. Render acquires that mutex and finishes/executes command lists even without a paint-generation check. These are source observations; their contribution to the reported delay is not yet measured.
- MyChromiumApp already requests a 60 Hz windowless CEF browser. Raising a nominal frame cap is therefore not a justified fix.
- The gold cursor currently changes CSS left/top on mousemove and uses a drop-shadow filter. It follows CEF paint delivery, whereas the former DirectX cursor was drawn independently. This is a plausible latency contributor, not a proven root cause.
- Dialogue deduplicates unchanged snapshots and acquires its native cursor lease once. It does not recreate the entire UI every game frame.
- Browser visibility is a renderer draw flag; a hidden Frostveil overlay does not itself prove that CEF stopped rendering.

## Instrumentation implemented

Developer-only `FROSTVEIL_GUI_PROFILE=1`, disabled by default:

- Native GuiPerformance.h: bounded 4096-sample rings per metric, aggregate output every five seconds. Render intervals and CPU render, paint, texture wait, Map/copy/Unmap and command submission durations; average, recent-window P95/P99, frequency, and >100 ms counts. No native references or Skyrim wrappers retained. No new GPU hooks, resource ownership changes, or renderer optimization.
- Browser gui-performance.ts: bounded 2048-sample rings, rAF intervals, mouse-event-to-next-rAF proxy, click-to-next-dialogue-response, and longtask durations where supported. Installs once, removes listeners/observer/timer on disposal. The mouse metric excludes time before browser dispatch and GPU/display latency. It must not be described as input-to-display latency.
- Dialogue bridge logs bounded summaries through existing client writeLogs at most once per four seconds in developer mode; never forwards them as gameplay actions. Production generated source excludes the profiler implementation unless opted in.

Native percentiles describe at most the latest 4096 samples; counts/means describe the aggregate reporting window. Native command durations measure CPU submission, not GPU completion. Native frame intervals measure render-hook intervals, not independent presented-frame telemetry. GPU utilization and true input-to-display latency are not instrumented.

## Verification and deployment

- Native Release `skyrim_platform` target: PASS, including the new header and instrumented renderer. Complete log: `build/rp-audit/gui-performance-build.log`.
- RP typechecks/build and regressions: **313/313 PASS**, zero skipped. Includes new profiler lifecycle/bounded-output/default-off tests and existing Spawn Recovery, Map Discovery, Courier, Economy, Chat, NPC and Dialogue suites. Complete log: `rp-gamemode/.local/gui-performance-tests.log`.
- git diff whitespace check: PASS.
- Server-only diagnostic source deployed with the established local backup workflow. Immutable bundle SHA256: `50fb7dc200ee7c604804eda5cf1c0dee9a427cfc7af1d4ec1e9d492355898fb7`.
- Backup/rollback metadata: `build/rp-audit/g22/dialogue-1792742442730`; 86 protected files hashed and unchanged during deployment. Visible PowerShell startup binds verified loopback UDP 7777, resources port 3000, and logs NPC/dialogue startup success.
- Installed game files unchanged. Existing Launcher 0.1.23 works for the server-delivered browser diagnostics.
- The native profiling DLL is a **local build candidate only**, not installed or published. Signed R2/Launcher delivery and its update/install gates have not run for this candidate. Installed clients therefore cannot yet produce the new native timing series. No optimization release has been approved by performance evidence, and no signing or update checks were bypassed.

## Manual profiling procedure

Initial owner pass with Launcher 0.1.23, after reconnecting to the restarted server:

1. Stay at the same position, resolution, graphics settings and camera direction. Keep background workloads constant.
2. A: leave Dialogue closed for 30 seconds. C: open Guild Clerk and leave it still for 30 seconds.
3. D: move the mouse rapidly over choices for 30 seconds, then select harmless rank/contracts views; never repeatedly purchase permits for a benchmark.
4. E: close/open Dialogue ten times, then test ESC, F7 chat, Thai/IME input, reconnect and a loading transition. Record whether game FPS and cursor response recover after close.
5. Inform the developer when finished so client fvGuiProfile logs can be collected. Logs contain scenario labels, metrics and no dialogue text/account IDs.

B static comparison (developer via the existing CEF debugger on localhost:9000): after opening Dialogue, save `window.__fvGuiStaticRoot=document.getElementById('fv-dialogue')`, call `window.__fvGuiStaticRoot.remove()`, and `window.__fvGuiProfile.scenario('static')`. This leaves the same focused visible CEF surface without the Dialogue DOM/cursor. After 30 seconds append the saved element to document.body and restore scenario('dialogue'), or close/reopen. It is an isolated visual profiling manipulation, not a quest/economy action. Do not expose a new remote console.

After the native candidate passes the established signed release workflow, launch Launcher from a PowerShell with `$env:FROSTVEIL_GUI_PROFILE='1'` so the game inherits the flag. Repeat A–E and collect `[FV-GUI-PROFILE]` entries from existing native logs. Restart without the flag after profiling. Do not manually copy the candidate into Skyrim.

## Remaining gates

Need actual browser and native timings before selecting a renderer/DOM optimization, followed by measured before/after comparison and owner acceptance. Profiling overhead must be compared with diagnostics off. No full-frame-copy, dirty-rectangle, row-pitch, command-list, cursor rendering, GPU-sharing, or Scaleform replacement change has been shipped. A measured Scaleform prototype is also pending; there is no evidence yet justifying a GUI rewrite.

Current work is a recoverable diagnostic foundation, not completion of the requested performance fix.

Diagnostic source commit: `30b5cba`, branch `wip/gui-performance-profiling`. Native candidate SHA256: `8549f8be88fefec1341399a64293b3798c8ea5f20c34a60204d0088759d4025b`. Final server revision includes the corrected mouse proxy; reconnect is needed to load its owner-only scripts.
