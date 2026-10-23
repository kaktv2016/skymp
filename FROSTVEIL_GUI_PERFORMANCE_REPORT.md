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

Native diagnostic delivery published as Launcher 0.1.24 / recipe 1.0.18: https://github.com/kaktv2016/frostveil-launcher/releases/tag/v0.1.24 . Full serial Launcher regressions 483/483 and isolated NSIS/repair/smoke pass. Signed public update envelope and all R2/GitHub asset hashes verified. Native profiling and optimization remain pending in-game measurements after Launcher Play installs the candidate; no manual player-file writes.

## Native baseline and verified optimization candidate

Owner ran signed 0.1.24 with profiling enabled. Installed hash matched 8549f8be. Native 5-second windows showed paint/upload CPU means about 20–22 ms, upload P99 about 28–30 ms, paint frequency about 38–42 Hz; render CPU 4–6 ms with texture-wait P99 up to 13 ms. Command submission averaged about 0.1 ms. These measurements identify the existing Map/copy/Unmap phase under the shared texture mutex as a bottleneck; they do not isolate GPU Map stalls from write-combined memory copy cost.

Controlled DOM cursor A/B: hidden from 08:54:51.758Z to 08:55:16.762Z and automatically restored, no persistent game-file modification. Owner confirms menu remained equally sluggish. Paint/upload remained costly while hidden (roughly 19–21 ms); do not attribute all latency to the gold cursor. Data preserved locally: cursor-ab.json and native-baseline-full.log.

Candidate DLL 52b7572f75f5b09fe8db8bf6f04931522c11d6573181bf88ac5039042e09338d:
- OnPaint performs CPU-only dirty-rectangle copies into a bounded backing store. Untouched pixels survive and multiple pending paints accumulate safely; stale dimensions cannot upload into a differently sized texture.
- Render snapshots the dirty bounding region under the mutex, releases it, then uploads into a DEFAULT texture via UpdateSubresource with explicit compact source row pitch. No Map/WRITE_DISCARD, deferred FinishCommandList or ExecuteCommandList remains on the paint/render path. GPU operations occur on the existing render thread; no shared-texture extensions or new hooks.
- Fresh/resize/reset textures require a full backing-store upload before drawing. No uninitialized texture is displayed. GPU resource ownership stays with the renderer; only CPU pixels cross the CEF callback boundary.
- Standalone native GuiSurface regressions pass: first-paint initialization, dirty accumulation/preservation, clipped/out-of-bounds rectangles, no-change suppression, dimension mismatch, forced full recovery, resize and invalid sizes. Source/CMake test project: skyrim-platform/tests/gui-surface.
- Native Release build passes; existing RP build/typechecks/regressions 313/313 pass. Renderer resource failure and visual/frametime acceptance remain real-game checks.

No after-optimization in-game numbers exist yet. Signed client distribution and owner comparison must finish before calling the performance problem fixed.

Optimization candidate delivered through verified signed Launcher 0.1.25 / recipe 1.0.19: https://github.com/kaktv2016/frostveil-launcher/releases/tag/v0.1.25 . Launcher regressions 486/486 PASS, native surface regressions/native Release build PASS, RP regressions 313/313 PASS; public payload hashes and signed update envelope verified. Native source commit 1dd5a6ff, candidate hash 52b7572f75f5b09fe8db8bf6f04931522c11d6573181bf88ac5039042e09338d. No server restart or direct installed-player-file write. Await owner Play installation and measured after-fix result; retain prior native baseline/archive for rollback.

## Native cursor follow-up — 2026-10-23

Owner confirms v0.1.25 removed perceived input delay, but fast cursor movement still stutters / appears separated.

Evidence: installed DLL SHA-256 matched 52b7572f75f5b09fe8db8bf6f04931522c11d6573181bf88ac5039042e09338d. Windows reports the active 3440x1440 display at 200 Hz; CEF is explicitly configured to 60 Hz. Live dialogue sample: 1498 rAF frames, mean 16.680 ms, P95/P99 16.666 ms; 1074 mouse intervals, mean 23.262 ms, P95 34 ms, P99 67.1 ms. One DOM cursor was present. These measure browser events, not GPU presentation or physical input latency; they do not establish the cause of every perceived ghost image.

A reversible live CSS transform comparison was rejected: baseline 502 layouts / 10 s, layout CPU 28.597 ms, task CPU 953.536 ms; transform added only one layout but task CPU increased to 1340.458 ms / 10 s. Original styles/listener were restored automatically. Raw captures remain in ignored `.local/gui-performance/`.

Implemented a scoped native gold cursor using the existing DirectX SpriteBatch and existing cursor coordinates. It draws on each game render independently of CEF paints, uses the SVG's 28x36 size and 1px hotspot, and does not interpolate or change click coordinates. Existing Skyrim-style CEF cursor remains the default outside dialogue. Optional boolean APIs select the gold sprite; old clients retain the tested DOM fallback. Dialogue restores both prior style and visibility on close, disconnect, loading, character change and disposal. No new input hooks or gameplay native calls.

Native Release build passed; gamemode validation and signed delivery results follow below. In-game smoothness and duplicate-cursor acceptance remain PENDING OWNER TEST. Actual game render/input cadence and display response still limit achievable smoothness; 200 FPS is not promised.

Native cursor delivery validation: gamemode 318/318; Launcher 486/486 (no skips); native Release build and isolated repair fixtures passed. Server bundle `c4c840d49ec430ff3abe639cba9d6b263fe909a18ba002ea73d9350d51929b10` deployed using the established local script, 89 protected files hash-verified unchanged. UDP bound only to 127.0.0.1:7777, resource listener 3000 and NPC/dialogue startup ready. Backup/start script: `build/rp-audit/g22/dialogue-1792750632992/start-visible.ps1`. Source committed/pushed as `3b277846` to authorized `frostveil/wip/gui-performance-profiling`.

Published and independently downloaded/verified: https://github.com/kaktv2016/frostveil-launcher/releases/tag/v0.1.26. Production Ed25519 updater authentication and all five public asset SHA-256 checks passed. Native R2 bytes and recipe also verified. Launcher implementation commit 17917eb pushed to the authorized development branch. Owner gameplay acceptance remains pending.
