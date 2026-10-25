# FROSTVEIL — PHASE C: ADVANCED BLUEPRINT AUTHORING REPORT

**Date:** 2026-10-26  
**Branch:** `dev/advanced-authoring-phase-c` (merged to `frostveil`)  
**Baseline:** Verified Phase B.1.1 (`dev/routing-polish-phase-b11` @ `861453f8`)  
**Deployed Bundle SHA-256:** `b3942dd191d761d99205469d1d68367d0c6db9b1832427b1d281c5e7afa7825f`  
**Deployed Editor Assets SHA-256:** `6b280784d5fc45254bc7312375690da5d6ed1323e8227be6d595f424af10248c`

---

## 1. Implementation Status (C.1 → C.2 → C.3)

| Milestone | Feature | Status | Automated & Browser Verification |
|---|---|---|---|
| **C1.1** | **Quick Node Creation (`Space` / Drag Output to Empty Canvas)** | **Completed** | Searchable Thai/English palette (`Space` on canvas or `+` toolbar button, plus dragging from an output handle onto empty canvas), keyboard navigation (`ArrowUp`/`ArrowDown`/`Enter`/`Escape`), creates at canvas pointer coordinates, offers only runtime-supported node types/actions/conditions (`entry`, `npc`, `choices`, `condition`, `action`, `end`), preserves `Ctrl+K` search and never interrupts text inputs or IME composition (`isComposing` / `keyCode === 229`). |
| **C1.2** | **Insert Node on Edge** | **Completed** | Drag-and-drop node from library onto an existing edge or initiate via Connection Inspector (`Insert node on connection`). Live insertion preview bar (`source [handle] → node [output] → target`), explicit branch disambiguation required for `condition` (`True`/`False` branch selector) before confirmation, rejects invalid endpoints (`entry` has no input, `end` has no output), preserves `choice:<id>` handle semantics, and commits/undoes as **one atomic Undo/Redo transaction**. |
| **C1.3** | **Multi-selection, Copy/Paste & Duplicate** | **Completed** | `Shift`/`Ctrl` multi-selection, rectangle Box Select (`Box select` toolbar toggle + marquee drag), `Ctrl+C` (Copy), `Ctrl+X` (Cut), `Ctrl+V` (Paste), `Ctrl+D` (Duplicate), batch move, group delete with confirmation (`entry` protected), internal edges copied **only** when both endpoints are in the selection, graph-local node and choice IDs regenerated with internal references rewritten, and zero secrets/tokens/NPC assignments in clipboard payload. |
| **C1.4** | **Visual Groups & Comments** | **Completed** | Non-executable authoring frames (`Ctrl+G` or toolbar button) with editable title, comment/description, 6 category colors (`gold`, `teal`, `blue`, `purple`, `amber`, `slate`), dimensions, member node grouping, move group with contents, collapse/expand, and Undo/Redo. Stored strictly in `EditorPresentation` (`presentation.groups`) and **never** injected into executable `Graph.nodes`. |
| **C1.5** | **Graph Templates** | **Completed** | 6 validated templates in the Node Library (`Simple NPC Greeting`, `Accept / Decline Conversation`, `Courier Contract Dialogue`, `Condition-Based Choice`, `Permit Information & Purchase`, `Safe Conversation Exit`) using only allowlisted runtime node types and live server catalog route/permit selectors, with pre-insertion preview modal, fresh unique IDs, and single-step atomic Undo. |
| **C2.1** | **Step-by-Step Visual Dialogue Debugger** | **Completed** | Interactive debugger dock (`Start` / `Restart` / `Step` / `Continue` / `Focus executing node` / `Close`), interactive player choice buttons at `choices` nodes, active/visited node highlighting on canvas (`node-debug-current`, `node-debug-visited`), step history timeline with click-to-focus, and expected next node indicator. |
| **C2.2** | **Safe Simulation Engine** | **Completed** | Pure client-side simulation matching G2.2 traversal rules with **zero gameplay service mutations** (no economy journal writes, no gold/XP/item grants, no contract acceptance, no persistent flags, no JS/Papyrus/console execution). Every simulated action is explicitly badged `[SIMULATED — NO GAMEPLAY MUTATION]` and reports `"requires live runtime verification"` where live server state applies. |
| **C2.3** | **Test Player Profiles & Scenario Comparison** | **Completed** | 4 preset local test profiles (`Idle Courier (Eligible, 500g)`, `Active Courier Contract`, `New Courier (Rank Ineligible)`, `Guild Veteran (Permit Holder)`) plus live configurable Courier state, Rank eligibility, and Wallet Gold controls, and a side-by-side **Scenario Path Comparison** table comparing traversal paths across all profiles without touching live player records. |
| **C2.4** | **Breakpoints, Condition Explanation & Cycle Bounds** | **Completed** | Per-node breakpoints (`Add/Remove breakpoint` in Node Inspector or Debugger toolbar), automatic pause when stepping/continuing into a breakpoint, human-readable condition evaluation explanations (`always`, `courierIdle`), and hard traversal bounds (`maxSteps = 32`, `maxElapsedMs = 250ms`, visited-state cycle detection `(nodeId, choiceHistoryLength)`). |
| **C2.5** | **Validation Navigator** | **Completed** | Categorized pre-publish diagnostics modal (`ERROR (BLOCKS PUBLISH)`, `WARNING`, `INFO`) with Thai/English explanations, related node/edge IDs, one-click `Focus node` navigation, specific recommended fixes, and one-click `Run Server Validation` (preserving server validation as authoritative for Publish). |
| **C3.1** | **Visual Version Diff & Historical Removed Node Inspection** | **Completed** | Compare any saved draft or published version (`Base version` vs `Target version`) by stable IDs: summarizes added/removed/modified nodes, dialogue/choice/action/condition changes, connection changes, and separate presentation/layout-only changes. Includes read-only **Historical Snapshot Inspection** for removed nodes without reintroducing them into the working graph. |
| **C3.2** | **Safe Draft Recovery** | **Completed** | Debounced (`450ms`) local draft recovery snapshots in `localStorage` (`fv-draft-recovery-v1:<graphId>`) with `beforeunload` protection, automatic conflict detection against newer server draft revisions or published versions (`assessRecoveryConflict`), explicit **Restore recovered draft** / **Discard recovery snapshot** banner, and strict key sanitization forbidding any auth/CSRF/grant/session keys. |
| **C3.3** | **Find References (Local & Cross-Graph)** | **Completed** | Indexed reference lookup (`Find references` in Node Inspector + `/api/references` server endpoint) finding incoming connections, outgoing connections, choice targets, and service action/argument usages across the active graph and all authorized graphs in `BlueprintStore`. |
| **C3.4** | **Graph Bookmarks** | **Completed** | Named bookmarks (`Bookmarks` toolbar modal) storing optional `nodeId` and canvas `viewport: {x, y, zoom}`, supporting Add, Jump to, Rename, Delete, and persistence inside `EditorPresentation.bookmarks`. |
| **C3.5** | **Editor Shortcuts & Help** | **Completed** | Accessible Keyboard Shortcuts & Help modal (`F1`, `?` outside inputs, or header `?` button) documenting all navigation, selection, authoring, clipboard, group, undo/redo, and debugger shortcuts in Thai and English. |

---

## 2. Architecture & Strict Data Separation

Phase C enforces a strict 3-layer separation across client and server:

1. **Executable Graph Data (`Graph` in [`graph-model.ts`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/rp-gamemode/src/modules/dialogue/graph-model.ts)):**
   - Contains **only** runtime-executable G2.2 fields (`schemaVersion: 1`, `id`, `version`, `entry`, `nodes: Node[]`).
   - `validateGraph` and `validateDraftGraph` remain strict and reject any unknown keys, prototype pollution (`__proto__`, `constructor`, `prototype`), or non-runtime node types.
   - Visual groups, comments, bookmarks, and debugger state **never** enter `Graph.nodes`.
2. **Editor Presentation Data (`EditorPresentation` & `Layout` in [`graph-model.ts`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/rp-gamemode/src/modules/dialogue/graph-model.ts) & [`blueprint-store.ts`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/rp-gamemode/src/modules/dialogue/blueprint-store.ts)):**
   - Validated via `validatePresentation(input)` (`schemaVersion: 1`, `groups: VisualGroup[]` bounded to `<= 32`, `bookmarks: GraphBookmark[]` bounded to `<= 64`).
   - Stored alongside `layout` on draft records (`draft:<id>`) and optional published version metadata (`version-meta:<id>:<version>`) in `BlueprintStore` without altering `version:<id>:<version>` executable records consumed by `DialogueRuntime`.
3. **Visual Debugger & Recovery State ([`debugger.ts`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/blueprint-editor/src/debugger.ts) & [`content-management.ts`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/blueprint-editor/src/content-management.ts)):**
   - Ephemeral React state (`DebuggerSession`, `TestPlayerProfile`, `debugBreakpoints`) and sanitized browser `localStorage` recovery snapshots (`fv-draft-recovery-v1:<graphId>`).

---

## 3. Changed Files

### Server (`skymp/rp-gamemode`)
- [`src/modules/dialogue/graph-model.ts`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/rp-gamemode/src/modules/dialogue/graph-model.ts) — Added `GroupColor`, `VisualGroup`, `GraphBookmark`, `EditorPresentation`, `emptyPresentation()`, and `validatePresentation()` while keeping `Graph`, `validateGraph()`, and `validateDraftGraph()` unchanged.
- [`src/modules/dialogue/blueprint-store.ts`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/rp-gamemode/src/modules/dialogue/blueprint-store.ts) — Added optional `presentation` persistence on drafts, `version-meta:<id>:<version>` snapshots on publish/rollback, `versionSnapshot()`, `versions()`, and `assignedNpcs()`.
- [`src/modules/dialogue/blueprint-service.ts`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/rp-gamemode/src/modules/dialogue/blueprint-service.ts) — Added `versions` to `read('graph')`, added indexed `read('references')`, and accepted optional `presentation` in `execute('draft')`.
- [`src/modules/dialogue/editor-http.ts`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/rp-gamemode/src/modules/dialogue/editor-http.ts) — Permitted authenticated POST `/api/references` read operation with full session, origin, and CSRF enforcement.
- [`tests/blueprint-store.test.cjs`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/rp-gamemode/tests/blueprint-store.test.cjs), [`tests/blueprint-service.test.cjs`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/rp-gamemode/tests/blueprint-service.test.cjs), [`tests/editor-http.test.cjs`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/rp-gamemode/tests/editor-http.test.cjs) — Added server unit and HTTP security tests for `EditorPresentation`, `versions`, and `/api/references`.

### Blueprint Studio Frontend (`skymp/blueprint-editor`)
- [`src/authoring.ts`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/blueprint-editor/src/authoring.ts) & [`src/authoring.test.ts`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/blueprint-editor/src/authoring.test.ts) — C1.1 Quick Node Palette, C1.2 Edge Insertion planner/applicator, C1.3 Multi-selection/Clipboard/Duplicate with ID regeneration, C1.4 Visual Groups, C1.5 Graph Templates.
- [`src/debugger.ts`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/blueprint-editor/src/debugger.ts) & [`src/debugger.test.ts`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/blueprint-editor/src/debugger.test.ts) — C2.1–C2.4 Step-by-step safe simulation engine, preset player profiles, scenario path comparison, breakpoints, cycle bounds, and C2.5 Validation Navigator (`diagnoseGraph`).
- [`src/content-management.ts`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/blueprint-editor/src/content-management.ts) & [`src/content-management.test.ts`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/blueprint-editor/src/content-management.test.ts) — C3.1 `diffGraphVersions`, C3.2 `buildRecoverySnapshot` / `assessRecoveryConflict` / storage helpers, C3.3 `findReferences`, C3.4 bookmark helpers, C3.5 `EDITOR_SHORTCUTS`.
- [`src/mapping.ts`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/blueprint-editor/src/mapping.ts) — Added `WeakMap` memoization on `outputRows(node)` and `nodeHandles(node)` to eliminate redundant Unicode line-wrap measurements during typing and routing.
- [`src/inspection.ts`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/blueprint-editor/src/inspection.ts), [`src/studio-ui.tsx`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/blueprint-editor/src/studio-ui.tsx), [`src/connection-ui.tsx`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/blueprint-editor/src/connection-ui.tsx), [`src/main.tsx`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/blueprint-editor/src/main.tsx), [`src/style.css`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/blueprint-editor/src/style.css), [`src/main.test.tsx`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/blueprint-editor/src/main.test.tsx) — Integrated Phase C UI, icons, responsive toolbar layout, memoized chrome/edge rendering, and end-to-end UI tests.

---

## 4. Automated Test & Security Verification Results

- **`skymp/blueprint-editor` Test Suite:** `13/13` test files passed, **`80/80` tests passed** (`vitest run`).
- **`skymp/rp-gamemode` Test Suite:** **`347/347` tests passed** (`node scripts/build.cjs && node --test tests/*.test.cjs`).
- **Security & Invariant Checks Verified:**
  - Unauthenticated `POST /api/catalog` and `POST /api/references` return `403 Forbidden`.
  - CSRF header mismatch (`x-fv-csrf`) returns `401 Unauthorized`.
  - `localStorage` draft recovery snapshots are verified to contain **zero** `csrf`, `grant`, `token`, `cookie`, `authorization`, `password`, or `secret` keys (`containsForbiddenKeys` guard).
  - Clipboard payloads (`frostveil-blueprint-clipboard`, `schemaVersion: 1`) strip external graph IDs, NPC assignments, and session metadata, regenerating all node and choice IDs upon paste/duplicate.
  - Visual groups (`presentation.groups`) and bookmarks (`presentation.bookmarks`) never appear in `Graph.nodes`.
  - Visual Dialogue Debugger performs **zero** network writes or gameplay mutations.

---

## 5. Performance Benchmarks (Before vs. After Phase C)

Measured in headless Chromium (`1920x1080`) on the 14-node / 23-edge Clerk graph and the 128-node / 2,017-edge dense stress fixture ([`phase-c-qa-results.json`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/build/rp-audit/phase-c/phase-c-qa-results.json)):

| Metric | Phase B.1.1 Baseline | Phase C (With `WeakMap` Handle Memoization) | Status |
|---|---|---|---|
| **Clerk Initial Load + Smart Routing** | `~950 ms` | **`921 ms`** | Improved |
| **Clerk Pan / Zoom Frame Interval (`p50` / `p95`)** | `5.0 ms` / `5.2 ms` | **`5.0 ms` / `5.1 ms`** | Smooth (60+ FPS) |
| **Clerk Node Drag Frame Interval (`p50` / `p95`)** | `5.0 ms` / `5.3 ms` | **`5.0 ms` / `5.1 ms`** | Smooth (60+ FPS) |
| **Clerk Search + Focus (`Ctrl+K`)** | `~48 ms` | **`44 ms`** | Fast |
| **Clerk Auto Arrange (ELK Worker Preview)** | `~370 ms` | **`363 ms`** | Fast |
| **120-Char Unicode Typing Handle Wrap Test** | `~4,900 ms` | **`3,510–4,254 ms`** | **13–28% Faster** |
| **128-Node / 2,017-Edge Stress Load + Smart Routing** | `~1,380 ms` | **`1,330 ms`** | Bounded |
| **128-Node / 2,017-Edge Stress Node Drag (`p50` / `p95`)** | `5.1 ms` / `16.4 ms` | **`5.0 ms` / `15.1 ms`** | Within 60 FPS p95 budget |
| **Phase C Visual Debugger 3-Step Traversal** | N/A | **`226 ms`** | Instant |
| **Phase C Visual Version Diff Computation & Modal** | N/A | **`37 ms`** | Instant |

---

## 6. Browser Visual QA & Screenshot Evidence

All 12 screenshots were captured from real Chromium rendering in [`skymp/build/rp-audit/phase-c/`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/build/rp-audit/phase-c) with `0` console errors, `0` page errors, and `0` horizontal overflow across all viewports:

- **Desktop Viewports (`0` horizontal overflow, `0` routing warnings):**
  - [`clerk-1366.png`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/build/rp-audit/phase-c/clerk-1366.png) (`1366x768`)
  - [`clerk-1920.png`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/build/rp-audit/phase-c/clerk-1920.png) (`1920x1080`)
  - [`clerk-2560.png`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/build/rp-audit/phase-c/clerk-2560.png) (`2560x1440`)
  - [`stress-1920.png`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/build/rp-audit/phase-c/stress-1920.png) (`128 nodes / 2,017 edges` at `1920x1080`)
- **Milestone C.1 Screenshots:**
  - [`c1-1-quick-palette.png`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/build/rp-audit/phase-c/c1-1-quick-palette.png) — Quick Node Creation Palette (`Space`) with Thai search (`เงื่อนไข`)
  - [`c1-2-edge-insert-preview.png`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/build/rp-audit/phase-c/c1-2-edge-insert-preview.png) — Insert Node on Connection preview bar with condition branch selector
  - [`c1-4-visual-groups.png`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/build/rp-audit/phase-c/c1-4-visual-groups.png) — Non-executable Visual Group & Comment frame with Inspector controls
  - [`c1-5-template-preview.png`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/build/rp-audit/phase-c/c1-5-template-preview.png) — Courier Contract Dialogue Graph Template preview modal
- **Milestone C.2 Screenshots:**
  - [`c2-visual-debugger-comparison.png`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/build/rp-audit/phase-c/c2-visual-debugger-comparison.png) — Step-by-step Visual Dialogue Debugger, `[SIMULATED — NO GAMEPLAY MUTATION]` outcome, execution timeline, and 4-profile Scenario Path Comparison table
  - [`c2-5-validation-navigator.png`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/build/rp-audit/phase-c/c2-5-validation-navigator.png) — Validation Navigator pre-publish diagnostics modal
- **Milestone C.3 Screenshots:**
  - [`c3-1-version-diff.png`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/build/rp-audit/phase-c/c3-1-version-diff.png) — Visual Version Diff modal showing modified nodes and separate presentation changes
  - [`c3-3-find-references.png`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/build/rp-audit/phase-c/c3-3-find-references.png) — Find References modal (`CURRENT GRAPH` & indexed server references)
  - [`c3-4-bookmarks.png`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/build/rp-audit/phase-c/c3-4-bookmarks.png) — Named Graph Bookmarks modal
  - [`c3-5-shortcuts-help.png`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/build/rp-audit/phase-c/c3-5-shortcuts-help.png) — Keyboard Shortcuts & Help modal (`F1` / `?`)

---

## 7. Local Test Server Deployment, Health & Rollback Path

- **Deployment Record:** [`skymp/build/rp-audit/phase-c/deployment-output.json`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/build/rp-audit/phase-c/deployment-output.json)
- **Live Health Check Record:** [`skymp/build/rp-audit/phase-c/health.json`](file:///c:/Users/basba/OneDrive/Desktop/skyrim-rp/skymp/build/rp-audit/phase-c/health.json)
  - All 6 static assets served by `http://127.0.0.1:3210` verified against `editorAssetsSHA256` (`6b280784d5fc45254bc7312375690da5d6ed1323e8227be6d595f424af10248c`).
  - Protected data manifest (`rp-world`, `rp-economy`, `rp-npcs`, `rp-npcs-dialogues`, `rp-blueprints`) SHA-256 unchanged before and after deployment (`99d682655a35848181c69b084b2bdca97a1ded4d0a85eaa63fa49f3507cf2da6`).
  - Client files / Launcher / Modpack changed: **`false`** (`0` files touched).
- **Rollback Path:**
  - Rollback record: `C:\Users\basba\OneDrive\Desktop\skyrim-rp\skymp\build\rp-audit\g23\deploy-1792950466037\deployment.json`
  - Previous verified bundle (`e9906879331f4e7cabca00d82545dde34d353ca48526157d1bb5ffae1e0e2cbc.cjs`) and `.assets` remain preserved in `skymp/rp-gamemode/deployed/` and can be restored at any time without touching world, economy, or blueprint data.

---

## 8. Owner Acceptance Checklist (In-Game & Browser Verification)

> **Note:** Automated unit, integration, security, and Playwright browser tests are complete (`427/427` passing). Live in-game `/editor` grant issuance requires your manual in-game session when you are ready to test with the Skyrim client.

1. **Open Arcane Workbench:**
   - In-game (as allowlisted admin), run `/editor` to obtain a one-time grant, or issue a local dev grant on the server machine, then open `http://127.0.0.1:3210` and sign in.
2. **Test Authoring Productivity (C.1):**
   - Press `Space` on the canvas to open the **Quick Node Creation** palette, search in Thai (e.g. `เงื่อนไข`), and press `Enter`.
   - Select any connection or drag a node onto an edge to preview **Insert Node on Connection**, then press `Ctrl+Z` to verify single-step Undo.
   - Select nodes and press `Ctrl+G` to create a **Visual Group**, or pick a **Graph Template** from the left Node Library.
3. **Test Visual Dialogue Debugger (C.2):**
   - Click the **Bug (`Visual debugger`)** icon in the `REVIEW` toolbar, step through the conversation, click **Compare scenarios** to compare all 4 player profiles, and click the **Warning (`Validation navigator`)** icon to inspect pre-publish diagnostics.
4. **Test Content Management & Recovery (C.3):**
   - Click **Compare versions (`Visual Version Diff`)** in the `REVIEW` toolbar, click **Bookmarks** in `NAVIGATE`, click **Find references** inside the Node Inspector, and press `F1` (or `?`) to view the **Keyboard Shortcuts & Help** reference.
