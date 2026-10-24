# Frostveil Studio — Arcane Workbench (Phase B)

Status: implementation and automated acceptance complete; local deployment details below. Owner visual acceptance is pending. The owner-accepted G2.3 workflow and Phase A graph semantics are the baseline.

## Before / after

The former shell mixed navigation, editing and delivery controls, used similar surfaces across the workspace, and emphasized every related edge in gold. Arcane Workbench separates context, workflow, library, graph navigation, properties and status. Charcoal/slate surfaces, restrained antique gold and six semantic node colors provide hierarchy without decorative animation or backgrounds.

- Header: original Frostveil mark, graph/version context, saved/modified state, local workspace and compact authenticated-session menu.
- Workflow toolbar: Edit, Navigate, Review and Deliver groups. Existing publish confirmation, revision checks, assignment and history rollback remain. Pending requests disable duplicate workflow actions; Ctrl+S saves and Ctrl+B toggles the library.
- Library: searchable categories, original SVG icons, descriptions, drag/add affordances and separate version history. Both side panels support pointer resizing, keyboard separators, range controls and collapse.
- Canvas: opening focus, Fit All, selected focus, previous view, minimap, Unicode search and all three trace modes remain. Default graph zoom is independent of normal UI text size.
- Inspector: property sections, readable dialogue editor, numbered choices, exact linked target summaries, focus actions and collapsible technical identities. Connections retain actual source/output/destination mapping, overlap cycling/list, endpoint focus and confirmed deletion.
- Status: counts, draft revision, published version, validation, request state and zoom. Nonblocking notifications report success/failure; Preview traps/restores focus, including when a response replaces a focused choice. Reduced-motion preferences are honored.

## Design system and implementation

Original components remain on React 19 / TypeScript / React Flow 12.12.0. No dependency or lockfile changes, remote fonts, copied community components or paid assets were introduced.

`src/style.css` defines surface/text/border, antique-gold selection, success/warning/error, spacing, radius, shadow, motion and focus tokens. `nodeInfo` / `nodeColors` retain the shared six-category vocabulary. Body/dialogue text is approximately 14px; forms/buttons are 13–14px and secondary metadata generally 12px, with smaller uppercase section captions. The local Segoe UI / Leelawadee UI / Tahoma stack supports Thai without font downloads; decorative serif is limited to branding.

`studio-ui.tsx` supplies original line icons, accessible panel separators and Preview's focus frame. `main.tsx` keeps the existing graph/API/history handlers and memoized render caches. `mapping.ts` supplies a 304px card width and deterministic wrapped output-row geometry shared by cards and offscreen handles. Stable node/choice IDs and executable links are unchanged. Long Thai, English, wide Unicode and emoji labels have bounded wrapping space; full NPC dialogue remains available in the inspector (cards show a compact excerpt).

### Reference evaluation

| Reference | Evaluation / decision |
| --- | --- |
| [React Flow UI](https://reactflow.dev/ui) | Its installed BaseEdge, Controls, handles and viewport APIs fit the project. Reused these existing primitives; no registry replacement. Core is [MIT licensed](https://github.com/xyflow/xyflow/blob/main/LICENSE). |
| [shadcn/ui](https://ui.shadcn.com) | Accessible form/grouping patterns were useful references. The [MIT source](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md) could be reused, but adding its styling/registry dependencies was unnecessary. Controls here are original native React/HTML components. |
| [21st](https://21st.dev) | Community component/demo references only; no code or media copied. Its [terms](https://21st.dev/terms) distinguish authors' licenses and marketplace assets. |
| [Uiverse](https://uiverse.io) | Evaluated restrained controls; no individual component selected or copied, so no component license/dependency was imported. |
| [React Bits](https://reactbits.dev) | Animation-focused components did not improve this editor. Its current [MIT + Commons Clause source license](https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md) was inspected. No code, Pro assets, animation library or shaders used. |

## Connections, correctness and performance

Selecting a node gives related connections subdued semantic colors rather than a canvas of yellow lines. Pointer hover and keyboard focus are independent channels. An exact stable output handle resolves its real edge in O(1); one path and destination receive the strongest emphasis. Selection, tracing, graph indexes and serialized data remain separate. Inspector selection clears transient emphasis; leaving a hovered choice preserves its keyboard focus.

Ordinary node/edge paint ordering retains Phase A's baseline. Only a precisely hovered destination and the inspected connection's endpoints are raised above their path. This prevents the active line covering endpoint content without raising every card. Contextual labels, dashed return paths, 26-unit click strokes and overlap disambiguation remain.

A real stress regression was caught before deployment: raising every card above one shared edge stack produced repeated 250ms GPU raster/command-buffer tasks and approximately 360ms drag p95. Script and layout durations stayed near baseline. A controlled browser stacking A/B reduced drag p95 to about 35ms; the final endpoint-only policy measured about 40ms. Blanket clipping, opacity and compositor experiments were not shipped. The existing memoized components, semantic adjacency, stable decorated references, viewport culling and transform hint remain.

Save feedback is protected by an edit generation: edits made after a request's snapshot stay dirty when that older snapshot is acknowledged. Variable row geometry refreshes React Flow's native handle cache even when choice count stays unchanged. Regression tests reproduced these issues before the fixes. Preview-step replacement and keyboard/pointer focus transitions also have regression coverage.

Measured on this machine in Chromium with the same isolated fixtures; Windows memory pressure was detected during diagnosis and the owner closed Skyrim before the final controlled comparison. These measurements are not a universal FPS guarantee.

| Fixture / metric | Phase A reference | Final Phase B |
| --- | --- | --- |
| Clerk (14 nodes), pan/zoom p95 | 5.1ms | 5.1ms |
| Clerk, node drag p95 | 5.1ms | 5.1ms |
| Stress: 128 nodes / 2,017 edges, pan/zoom p95 | 5.2ms in final controlled reference; earlier run 9.9ms | 10.1ms |
| Stress, node drag p95 | 30ms | 39.9ms |
| Stress, selection round trip average | 41.3ms | 38.6ms |
| Stress, precise choice hover/focus (two-frame measurement) | New interaction | p50 42.7ms / p95 64.3ms |

Stress culling rendered 8 cards / 462 intersecting edges in both builds while all 128 nodes / 2,017 edges stayed available to search and navigation. Occasional long stress frames remain (final drag max ~349ms; reference max ~290ms). Pan/zoom remains around Phase A's documented 10ms p95; stress dragging has a small measured increase, far below the rejected layering regression. Dense overview is still an overview, not a promise that every label is legible at Fit All zoom.

## Automated verification

- Editor production TypeScript/Vite build: passed. Existing upstream `use client` bundler advisory remains.
- Editor: **32/32 tests passed**. Covers Unicode mapping, preserved layouts/IDs/payloads, wrapped ports, exact path stacking, keyboard/hover, handle-cache refresh, pending-save edits, duplicate-request rejection, failure feedback, preview focus, undo/redo, tracing/search, validation, publishing, assignment and history rollback.
- RP regression suite: **339/339 passed**, no skips. Runtime, persistence, Spawn Recovery, Map Discovery, Courier, economy, chat, admin, NPC/dialogue, authentication/CSRF and deployment coverage remain intact. Final RP build/typechecks passed.
- Actual browser fixtures: 1366×768, 1920×1080, 2560×1440, 3440×1440 and a 900px smaller desktop viewport. No document overflow or clipped toolbar controls; independent inspector scroll and panel resize/collapse verified.
- Clerk Save Draft → Validate → Preview → Publish/Assign → History/Rollback passed through intercepted, isolated APIs. Undo/redo, reduced motion, search, focus, source/target navigation and dirty text preservation passed. Serialized Save payload changed only the intended text.
- Dense 16-choice / 15-return fixture: all choices resolved correctly at three main viewports (15 direct physical SVG hits and one overlap-list selection per viewport). Zero inspection/navigation writes and zero page errors.
- Real mounted geometry: port centers align with their rows, and edge starts align with the outer source-handle anchor after growing and redistributing choice text. Long Thai/English/wide Unicode/emoji rows do not overflow. No owner-authored graph was published or assigned by QA.

## Evidence

All screenshots and complete success/failure diagnostics are local, ignored artifacts in `build/rp-audit/phase-b/`:

- `before-full.png`, `before-npc.png`, `before-choices.png`, `before-choice-hover.png`, `before-edge.png`, `before-search-validation.png`, `before-compact.png`, `before-performance-128.png`.
- Corresponding `after-*.png`, plus `after-preview.png`, `after-viewport-1920.png`, `after-viewport-2560.png`, `after-viewport-3440.png`, `after-viewport-900.png`, `after-overview.png`, `dense-*.png`, `long-labels.png` and `after-performance-128.png`.
- `release-studio-qa.log`, `release-dense-qa.log`, `long-ready-fixed.log`, `release-mounted-edit-qa.log`, `deployed-qa.log`, `deployed-stress.log`, `health.json`, `ui-final.log`, `rp-final.log`, `build-final.log`, `rp-build-final.log`, benchmark and GPU diagnostic logs. Fixture scripts are retained beside them.
- Before screenshots use immutable Phase A assets. Screenshots use a canonical Clerk fixture, not an authenticated live graph read. Actual deployment delivery is separately verified below.

## Deployment / rollback

Deployed on 2026-10-24 to the verified loopback test server. The server was already stopped; startup succeeded in visible PowerShell (PID 23828, Node PID 5520). UDP 7777 and HTTP 3000/3210 bind only to 127.0.0.1. Editor HTML returns 200; unauthenticated catalog requests return 403.

- Backup/rollback record: `build/rp-audit/g23/deploy-1792847337160/deployment.json`.
- Startup: `build/rp-audit/g23/deploy-1792847337160/start-visible.ps1`.
- Bundle SHA-256: `bb74e06bde1c31f0296c7422f9e0e4fe117dc5b51f72453c144699624d042366`.
- Companion assets SHA-256: `2b29abe212fb869aee000ad7b5b8923050302d34aae33c06b30f609718111636`.
- Served CSS `/assets/index-BqmX41VQ.css`: `ae9bc4285b863679a5d2eb548e4d56f869f46d7ddd5c6b6cf1419fdea4484b4b`.
- Served JS `/assets/index-CQsLauOr.js`: `6ab7f41064d4086424d15d591813893d37643ae2f66495982e38729a01c3dde0`.
- All served HTML/JS/CSS bytes match the immutable deployment manifest. The full browser workflow also passed against the actual served assets using intercepted fixture APIs at all five viewports; no live graph content was published or assigned.
- Before/after deployment protected manifest: `9644bdda4afcffe5721c892ba5b8705dccbd76f848f3755b676473eb457d9bbb` (identical).
- Post-start verification inspected 123 files. Startup legitimately replaces three process writer leases, adds three stale-writer recovery claims, and re-applies the existing registered Clerk to native `rp-world/changeForms/5.json`. The Clerk identity/name/world/pose match the unchanged registry; source `NpcService.start/apply` and `EconomyJournal.open` confirm this existing behavior. Character, economy, NPC definition, dialogue and Blueprint records remain byte-identical. No data was manually overwritten or restored. `health.json` and `startup-data-diff.json` document the distinction between deployment integrity and normal startup writes.
- Rollback: stop the verified local server, run `node rp-gamemode/scripts/rollback-blueprint.cjs --record build/rp-audit/g23/deploy-1792847337160/deployment.json` from the repository, then use the previous startup script. This restores code/config selection only. Prior immutable Phase A artifacts remain available; never restore world/player/economy files as part of this rollback.

No client, Launcher, CEF, cursor, Input Bridge, native, Skyrim installation, graph schema or gameplay service source changed. Delivery uses the existing immutable local server bundle plus companion asset workflow. Server executable bytes (excluding the asset-hash banner) must match the prior known-good build exactly. Protected world/player/economy/NPC/dialogue/Blueprint data is hashed around deployment and is never restored as part of code rollback.

## Git

Isolated branch `dev/arcane-workbench-phase-b` starts at verified Phase A `af3c2eb1`. Push target is authorized fork `frostveil` (`kaktv2016/skymp`); no upstream push, unrelated WIP merge or force push.

Implementation commit `344a75601120812127a1c7eed5f95c56870af087` (`feat(editor): redesign studio as Arcane Workbench`) was pushed successfully to `frostveil/dev/arcane-workbench-phase-b`. This report and the completed implementation plan are delivered in the following documentation commit on the same branch. Generated builds, browser fixtures, logs, screenshots and local deployment backups remain ignored; the dedicated test browser and preview servers have been closed.

## Owner acceptance / limits

1. Join the local server. Refresh the normal local owner session approval if it expired, run `/editor` and sign in with its fresh one-time grant. Use Ctrl+F5 to refresh editor assets.
2. Open your existing Clerk graph. Inspect one NPC node, then Choices. Hover one choice and use keyboard focus; confirm only the intended path dominates and text remains readable.
3. Click a connection (including an overlapping/return path), check its endpoints, Focus Source/Target, trace modes, Ctrl+K and previous view.
4. Resize/collapse both panels. Try your normal Save Draft → Validate → Preview workflow. Publish/Assign only content you intend to publish, then confirm it appears in a new Skyrim conversation.

Exact overlaps still need the hit list/cycling. Very long labels create tall cards; full dialogue editing belongs in the inspector. Saved/manual positions are intentionally retained, so an older tightly packed layout may benefit from the explicit undoable Arrange action. Smaller desktop panels overlay the canvas and can be collapsed. UI session expiry and owner approvals follow existing server rules. Owner visual acceptance and real gameplay acceptance of this redesign remain pending; no Phase C work has begun.
