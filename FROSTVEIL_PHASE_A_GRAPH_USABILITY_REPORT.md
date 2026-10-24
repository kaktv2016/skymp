# Frostveil Phase A — Graph Usability Report

Status: implemented and deployed to the verified loopback test server on 2026-10-24 (Asia/Bangkok). Automated browser acceptance passed. Owner acceptance of Phase A is pending; the owner-confirmed G2.3 Clerk publish workflow remains the baseline.

## Features and interaction

- One discriminated node/edge selection controls inspection and highlights. Nodes show Node Inspector; edges show Connection Inspector. Blank canvas, Reset trace and Escape clear inspection. Pan/zoom and endpoint navigation preserve edge inspection. Deletion clears absent references; undo/redo retain valid selection snapshots, including multiple redo operations.
- Connection Inspector resolves the actual source/target IDs and source handle from the graph mapping. It shows node titles/types, choice number/text, input handle, meaning, configured service/condition, and missing/dangling endpoint errors. Focus Source/Target, Highlight Connection, Clear Selection and confirmed deletion are available.
- SVG edges use installed React Flow 12.12.0 APIs: onEdgeClick, focusable edges, ARIA names, SVG titles, BaseEdge with a 26-unit invisible hit stroke, contextual EdgeLabelRenderer labels and per-port routing lanes. Forward routes use rounded steps; return routes use dashed curves. Labels do not intercept pointer input.
- Exact overlaps can be selected through the overlapping-hit list or by clicking the same spot again to cycle candidates. Hit testing runs only on click. Related-connection lists also expose offscreen or dangling edges. Tab/focus and Enter remain supported by React Flow; Escape clears inspection.
- Direct, upstream and downstream tracing uses memoized adjacency and visited sets. It highlights related nodes/edges without deleting/hiding graph data or changing runtime links. Traversal terminates on cyclic, malformed and disconnected drafts.
- Ctrl+K opens live Unicode node search across title/type, dialogue, choices, action/condition labels, target labels and stable IDs. Arrow keys/Enter navigate results. Focus Selected, Opening, Fit All and Back View change only the viewport. Opening follows real entry links (bounded to eight introductory nodes), rather than node array order.
- Inspector width is keyboard-adjustable from 300–480px; existing panel collapse controls remain. Titles and choice labels are larger. Fixed card/port geometry is shared with React Flow so unmounted offscreen nodes can be focused/routed accurately. Saved positions, including overlaps, are preserved on load; arrange remains explicit and undoable.

## Performance

- Memoized node/edge components, stable decorated object references and cached semantic adjacency avoid rebuilding the graph on pointer motion, inspector resize or unrelated UI edits. Selection-only change events do not write graph state. Text edits preserve untouched runtime node references.
- React Flow's onlyRenderVisibleElements renders the viewport while maintaining all node/edge identities in memory. Declared sizes/handles and includeHiddenNodes for bounds permit navigation to unmounted endpoints. No animation loop or continuous edge animation was introduced. Compositor hints/paint containment reduce pan redraw work.
- Chrome automated stress fixture: 128 nodes (126 sixteen-choice cards), 2,017 edges. Latest measured load-to-ready including an 800ms stabilization wait: 1,146ms; focused viewport rendered 8 cards / 462 intersecting edges. Pan/zoom frame intervals: median 5ms, p95 10ms, maximum 215ms. Selection round trips including automation: average 33ms, maximum 52ms. One 79ms long task was observed during selection. These are measurements on this machine, not a universal FPS guarantee.
- The 14-node Clerk fixture measured pan/zoom p95 9.9ms. Pure traversal coverage additionally exercises 128 nodes / 2,048 edges over repeated cyclic traversals. Worst-case all-graph overview can still be dense; focus/search is the practical editing view.

## Verification

- Editor TypeScript check and Vite production build: passed. Existing dependency pins retained. Vite emits the existing upstream use-client directive advisory.
- Editor tests: 22/22 passed. Coverage includes source/target and choice identity, overlaps/cycling, offscreen endpoint focus requests, selection switching, Unicode search, branches/cycles, exact payload preservation, explicit layout and manual positions, deletion/undo/redo, validation, preview, history rollback and NPC assignment.
- Required RP build/typechecks and regression suite: 339/339 passed, no skips. Runtime, persistence, Courier, economy, chat, navigation, admin, NPC/dialogue, auth/CSRF and deployment coverage remain intact.
- Actual Chromium browser geometry/interactions passed at 1366×768, 1920×1080 and 2560×1440. Tested physical SVG hits, source/target focusing, pan/zoom selection preservation, keyboard edge selection, search, unsaved text, panel resizing and unchanged serialization. No browser page errors were observed.
- Dense fixture at each viewport: all 16 choice connections selected correctly (14 direct pointer hits and 2 through overlap disambiguation), plus 15 return edges. No draft/publish/assign requests were made by inspection/tracing/navigation. A separately captured Save payload contained only the intended text edit.
- Card geometry verification found no card overflow and no mismatch between rendered port centers and declared offscreen handle geometry.
- All browser fixtures intercept their own API calls; they do not publish, assign or alter the live Clerk. Exact executable server bundle content matches the prior known-good runtime after removing the companion-assets hash comment. No runtime/schema, dependency, native, CEF, Launcher or player-installation source changed.

## Evidence

All local evidence is in `build/rp-audit/phase-a/`:

- `before-1366.png`, `before-1920.png`, `before-2560.png` capture baseline c6aaef4d.
- `after-*.png`, `dense-*.png`, `deployed-after-*.png` capture the revised UI and deployed assets at all three viewports.
- `browser-final.log`, `dense-final.log`, `deployed-qa.log`, `geometry.log`, `performance-final.log`, `clerk-performance.log`, `ui-final.log`, `rp-tests.log`, `rp-build-final.log`, `health.json` retain checks and measurements.
- Browser fixture scripts remain with the evidence. These checks are automated acceptance, not owner confirmation.

## Deployment, safety and rollback

- Verified local server: 127.0.0.1 UDP 7777, resources HTTP 3000, editor HTTP 3210. Visible PowerShell startup succeeded. The server was stopped before this deployment; no unrelated process was stopped.
- Deployment/backup record: `build/rp-audit/g23/deploy-1792837145505/deployment.json`.
- Startup: `build/rp-audit/g23/deploy-1792837145505/start-visible.ps1`.
- Bundle SHA-256: `8d16f069837c2a3214cac4d1ada51505db3864cbe810f10fdef21b0effb2e1ee`.
- Companion assets SHA-256: `da52895f47ff10c34fa9f95d164d6fdb967513118c62e2b19a9a06fcd7693722`. The content-addressed path changed; prior artifacts remain immutable.
- Served HTML/JS/CSS hashes match the deployment manifest; unauthenticated catalog API returns 403. Existing loopback/auth/CSRF, revisions and audit infrastructure is unchanged.
- Protected world/player/economy/NPC/dialogue/Blueprint manifests match immediately before/after deployment: `dde3b83be2a050045734ba835d0add2807cc12e6b0045ef5c285b39a88e4e8d9`. Owner-published Clerk data was not replaced.
- Rollback: stop the verified local server, then run `node rp-gamemode/scripts/rollback-blueprint.cjs --record build/rp-audit/g23/deploy-1792837145505/deployment.json`. Restart the prior startup script. Rollback restores code/config selection, never world/player data.

## Git

Isolated branch `dev/graph-usability-phase-a` starts at owner-accepted G2.3 baseline `c6aaef4d`. Source/report are delivered to authorized remote `frostveil` (kaktv2016/skymp); no upstream push, force push, unrelated WIP merge or history replacement is used.

## Owner acceptance checklist and limits

1. Join the server, obtain the normal local owner session approval, run /editor and sign in with its fresh one-time grant.
2. Open the existing Clerk graph. Click a choice connection and verify its number/label and endpoints. Try an overlapping/return route; use the hit list or repeat-click cycling as needed.
3. Focus Source/Target, pan/zoom, and switch to a node. Try Direct / Upstream / Downstream and Reset trace.
4. Ctrl+K: search Thai text or an ID, select a distant node, use Opening / Fit All / Back View, and resize/collapse the inspector.
5. Edit text, navigate away/back, verify the unsaved text remains, then use the normal Draft → Validate → Preview flow. Publish only if the content is intended; the deployment has not published test content.

Phase B/C remain out of scope. Exact geometric overlaps require disambiguation. Dense graph overview necessarily reduces text size; Focus Selected and the inspector provide readable detail. Stress profiles still show occasional long frames; owner hardware/browser experience remains manual acceptance. Real two-client gameplay is not claimed by these editor tests.
