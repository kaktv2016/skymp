# Frostveil Phase B.1 — Smart Graph Routing

Status: implemented and deployed to the verified local test server. Automated verification passed; owner browser acceptance remains pending. Scope is Editor view/layout only. Phase C was not started.

## Architecture and behavior

- `routing-types.ts` and `routing-geometry.ts` keep geometry separate from executable dialogue data. Exact card dimensions and actual `nodeHandles` offsets define globally namespaced ports. Attachments use the exterior edges of the handles. Choice order comes from actual rows, including variable-height Unicode text.
- `elk-layout.ts` uses pinned ELKjs **0.12.0**, Layered/RIGHT/ORTHOGONAL, fixed-position ports and deterministic ordering/seed. Entry/End constraints and BFS forward-edge priorities keep service branches oriented sensibly. Computed positions and **actual returned ELK sections** become visible nodes and SVG polylines. Installed-engine tests demonstrate that Layered relocates nodes; it is not used for fixed-position manual routing.
- `orthogonal-router.ts` uses short orthogonal corridor candidates, obstacle channels, clearance, deterministic output offsets/return lanes and bend-cost search. Returns prefer shorter local envelopes, with global escape lanes available for normal graphs. Search is bounded for pathological dense drafts. Unroutable paths are explicitly marked `fallback`, with warnings and inspector reasons; they are never reported as clean.
- Geometry/topology revisions, a six-entry cache and incremental reuse isolate routing from pointer movement. During drag, cheap temporary endpoint-attached paths replace stale routes. No full layout/router runs on every pointer move; no continuous animations were added.
- `routing-client.ts`, `manual-routing.worker.ts` and `elk-browser.ts` provide worker computation, cancellation, timeout and stale-response IDs. The real ELK worker uses its installed native message protocol. Using `elk.bundled` inside another worker failed in the browser despite passing Node tests and was replaced. Dense fallback routing also runs off the UI thread. Failed/timed-out workers terminate; subsequent requests use a fresh instance.
- `use-graph-routing.ts`, `main.tsx` and `connection-ui.tsx` integrate Smart/Legacy, progress, warnings, return dashes, inspector quality and actual routed SVG paths. Existing edge IDs, 26px interaction strokes, overlap cycling, tracing, endpoint focus, search and highlight priorities remain.

Auto Arrange calculates asynchronously, previews positions/routes, and offers Apply/Cancel. Apply is **one undo transaction**. Cancel restores the previous canvas and viewport. Edits or graph changes cancel/invalidate old results. Preview disables mutation controls. Nothing is automatically saved, published or assigned. Accepted positions persist only through explicit Save Draft. Saved positions are preserved on load; no ELK computation is triggered by loading. Graphs without saved positions retain Phase B's existing initial placement.

## Dense ELK limitation and fallback

The original 128-node/2,017-edge strongly connected fixture exhausted the full Layered worker's 20-second budget. A direct Node diagnostic also showed excessive memory growth. Timeout left the UI interactive and applied nothing.

For **more than 512 edges**, Auto Arrange gives ELK a deterministic spanning forest of the same nodes, then routes every remaining link at the resulting positions with Smart Routing. This changes layout input only, never the executable graph. The stress fixture produces **127 real ELK sections plus 1,890 additional links**, retaining every edge ID. Preview explicitly identifies the decomposition. Browser completion was about **1.05 seconds**, including 950ms reported computation. This is a documented bounded fallback, not a claim that all dense paths came from ELK.

## Quantitative routing evidence

Legacy and manual Smart use identical frozen Phase B positions. ELK uses the same input graphs but deliberately changes positions, so its result is a layout comparison. Raw measurements, fixture hash and screenshot hashes: [measurements.json](docs/evidence/phase-b1/measurements.json).

Crossings count proper segment intersections, not unique edge pairs. Node hits count segment/open-card-interior intersections, including unintended traversal of endpoint cards. Significant overlap means an axis-aligned collinear overlap of at least 24px. Legacy curves are sampled at 16 subdivisions per curved segment; straight segments remain exact. Counts are comparative diagnostics, not proof of globally optimal routing. Detour is absolute excess over Euclidean endpoint distance, in graph pixels.

| Fixture / mode | Crossings | Node hits | Overlaps >=24px | Length px | Detour p95 px | Detour max px | Compute ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| Clerk / Legacy | 70 | 117 | 2 | 18,257 | 255 | 293 | — |
| Clerk / Smart | 63 | 0 | 28 | 24,189 | 914 | 2,305 | 4.1 |
| Clerk / ELK | 13 | 0 | 117 | 35,424 | 2,272 | 2,393 | 173.0 |
| Stress / Legacy | 304,067 | 42,300 | 24,515 | 9,462,093 | 501 | 2,638 | — |
| Stress / Smart | 202,508 | 5,466 | 8,717 | 9,424,052 | 1,427 | 4,361 | 922.3 |
| Stress / ELK + Smart | 190,771 | 3,933 | 22,036 | 10,287,153 | 1,527 | 5,275 | 971.2 |

Clerk has no fallback paths and zero node-interior hits in Smart and ELK. Smart avoids card content with about 33% more total length. ELK substantially reduces crossings but shares corridors, increasing overlap counts and length. It is not an improvement on every metric.

The dense stress fixture retains **765 manual Smart fallbacks**, and **505 fallbacks after the ELK spanning layout**. These paths can still intersect cards. Manual Smart reduces crossings and long overlaps while keeping aggregate length close to Legacy. There is no zero-crossing/zero-overlap guarantee for arbitrary graphs. Warnings and per-edge inspection expose these limitations.

## Browser and performance verification

Real Chromium on Windows; identical frozen geometry and 1920x1080 viewport for before/after interaction measurements. Existing viewport culling remains enabled: 6/8 nodes and 23/462 edges were mounted in the focused Clerk/stress benchmark views. Full-graph screenshots mounted all 14/128 nodes and 23/2,017 paths.

| Fixture / build | Pan/zoom p95 ms | Drag p95 ms | Selection p95 ms | Pan max ms | Drag max ms |
|---|---:|---:|---:|---:|---:|
| Clerk / before | 5.1 | 5.1 | 26 | 9.9 | 5.1 |
| Clerk / after | 5.1 | 5.1 | 54 | 9.9 | 9.5 |
| Stress / before | 10.1 | 40.1 | 57 | 55.0 | 300.1 |
| Stress / after | 10.0 | 35.2 | 54 | 162.9 | 210.0 |

These are one local run per case, using rAF intervals and Playwright-to-inspector wall time, not in-game CEF measurements. Normal selection had a worse p95 in this run; dense pan/drag still has occasional long frames. No universal latency improvement is claimed. Pan/zoom p95 is effectively unchanged and dense drag p95 is lower. Expensive computation does not run during pan or each drag event.

Browser QA passed at **1366x768, 1920x1080 and 2560x1440**:

- 12 before/after fixture/viewport cases plus 6 cases served by deployed `127.0.0.1:3210` assets; no horizontal page overflow or page errors.
- Preview/Apply/Cancel/Undo/Redo, exact restored positions and unchanged executable graph payloads.
- All 23 Clerk preview paths identified as ELK in the DOM. All **2,017** stress SVG endpoints matched exact source/target anchors.
- Search, selected connection inspector, Focus Target/Back View, and explicit Save Draft → Validate → Preview → Publish → Assign flows.
- Mutation requests were intercepted by isolated fixtures. **QA did not save/publish an owner graph or change NPC assignments.** Production API denial was checked separately.

Selected evidence, with identical geometry for before/manual Smart:

- [Clerk before](docs/evidence/phase-b1/before-clerk-focused.png), [Smart after](docs/evidence/phase-b1/after-clerk-focused.png), [ELK applied](docs/evidence/phase-b1/elk-clerk-focused.png).
- [Stress before](docs/evidence/phase-b1/before-stress-1920.png), [deployed Smart after](docs/evidence/phase-b1/deployed-after-stress-1920.png).
- All viewport screenshots, scripts and full diagnostic logs remain in ignored local evidence under `build/rp-audit/phase-b1/`.

## Tests and dependency review

- Editor: **54/54 tests across 9 files**; TypeScript and production Vite build passed.
- RP: **345/345**; current spawn recovery, discovery, Courier, admin, dialogue/economy, storage/auth and deployment/startup regressions remain passing. Both RP TypeScript configurations and server build passed.
- Fixtures A–H are covered: canonical Clerk/browser, 16 real ports, crossing branches, multiple returns, disconnected components, cycles/malformed links, actual 128-node/2,017-edge stress, and intervening obstacles. Additional checks cover stale callbacks, timeout/recovery, port order, unchanged manual positions, new obstacles, rendered polyline attachments and metric counterexamples.
- ELKjs is the only new production dependency and is pinned by lockfile. Its license is EPL-2.0 OR GPL-3.0-or-later; the EPL option is used. Dependency source is unmodified. Full license/notice is distributed and HTTP hash-verified in `assets/elkjs-LICENSE.css`, a comment-only asset not injected into styling. Original worker license headers remain. Installed-engine tests verify availability of the adapter's exact options.
- Source/async/preview paths and deployed assets were reviewed. No graph schema, native/CEF, Launcher, installed game files or runtime service source was changed.

## Deployment and rollback

- Verified target: `build/dist/server`, offline loopback UDP 7777; Editor `127.0.0.1:3210`.
- Bundle SHA-256: `3b5e75af99425b35e7d1704b49c38fdfcac0f110c3f322708e50f921b6941a3b`.
- Immutable asset aggregate SHA-256: `f0eb597765fb66407803a238aab14ed9873c2945bbb3cd287f3a472f976ce011`, 2,140,350 bytes. Existing 3MiB deployment gate was retained.
- Artifact: `rp-gamemode/deployed/3b5e75af99425b35e7d1704b49c38fdfcac0f110c3f322708e50f921b6941a3b.cjs` and matching `.assets` directory.
- **Server executable body is byte-identical to known-good Phase B**, removing only the asset-hash banner. An initial comparison failed because building from the wrong cwd changed esbuild's source-path comments. Rebuilding from the established `rp-gamemode` cwd passed the strict comparison; the check was not bypassed.
- Initial health found license files outside the existing HTTP asset allowlist. Packaging was corrected to the comment-only CSS asset and redeployed. All **6 files** now return HTTP 200 with exact hashes, including both workers and license. Unauthenticated catalog returns **403**.
- Established deployment backed up code/config and verified equal protected world/economy/NPC/dialogue/blueprint hashes immediately before/after deployment. No protected content was overwritten. Local manifests retain the complete file hashes.
- Final rollback record: `build/rp-audit/g23/deploy-1792915460407/deployment.json`. It preserves the immediately preceding B1 package. The initial B1 deployment record, named in `build/rp-audit/phase-b1/deployment-initial.json`, preserves known-good Phase B (`bb74e06bde1c31f0296c7422f9e0e4fe117dc5b51f72453c144699624d042366.cjs` and its assets).
- Server opened in visible PowerShell. At continuation time it was no longer running; the same deployed bundle was verified and started again. Fresh startup baseline/health found only three writer-lease replacements and three recovery-lock claims, no removed files and no NPC bootstrap record changes.
- Records: `build/rp-audit/phase-b1/health.json`, `deployment-output.json`, `startup-baseline.json`, `gates.json`, `deployed-qa.log`.

Rollback uses the established `rollback-blueprint.cjs --record <deployment.json>` after stopping only the verified local server, then the unchanged **`.\server`** command. Choose the initial B1 record to return to Phase B. Rollback restores code/config only; never copy world/economy data. Immutable known-good artifacts remain available.

## Git and owner acceptance

Implementation commit: **39ccdd7b**, branch `dev/smart-routing-phase-b1`. The following documentation commit records this report, evidence and whitespace-only cleanup. Push target is the authorized `frostveil` fork, never SkyMP upstream; no force push/history rewrite. Final commit/push verification is recorded in the delivery response and local audit log.

Owner acceptance remains pending:

1. Use `/editor`, open `http://127.0.0.1:3210/`, log in with the normal one-use grant and open the existing Clerk graph.
2. Follow several Choices outputs in Smart, inspect a return route and try Focus Source/Target and tracing. Toggle Legacy for comparison.
3. Auto Arrange → inspect → Cancel. Repeat → Apply → Undo → Redo. Save Draft only if you want to retain the layout.
4. Move a node between connected endpoints and release it. Inspect rerouted paths and any fallback warning. Use an isolated draft for stress tests; do not publish test content.
5. Confirm readability at your usual viewport. This report does not claim in-game or owner browser acceptance.
