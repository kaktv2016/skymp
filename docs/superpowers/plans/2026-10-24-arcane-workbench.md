# Arcane Workbench Implementation Plan

> Execute inline using the existing React/TypeScript editor. Owner explicitly authorizes autonomous design, implementation, verification and local deployment; visual acceptance remains pending.

**Goal:** Deliver Phase B's professional desktop shell, readable nodes and precise active-path emphasis while preserving G2.3 and Phase A behavior.

**Architecture:** Keep the executable graph, API, persistence and graph indexes intact. Add a small local SVG icon/component vocabulary, CSS tokens and presentation-only choice focus. Reuse React Flow's installed controls and accessible native form elements. No new dependencies, copied third-party source, fonts fetched at runtime or animations are required.

**Spec:** Owner attachment `471b0395-3a78-47d8-9f92-786162c59d2b/Pasted text.txt`.

## Design decisions

Use a restrained charcoal/slate shell and antique gold for publish/selection. Distinguish six node categories by color and line icons. Separate a compact context header, grouped workflow toolbar, resizable library, graph navigation, inspector and status bar. Preserve saved layouts. Hover/focus of a choice uses its exact stable output handle and highlights one edge and destination; selecting a node alone gives related paths subdued semantic colors. Selected edge remains the persistent inspection state. CSS supplies all restrained transitions, including reduced-motion overrides.

React Flow UI/shadcn are useful accessibility/spacing references but importing their registry components would add styling/dependency churn. Community 21st/Uiverse/React Bits components add no needed behavior. Build original components on the installed stack and record reference/license review in the report.

## Global constraints

- No schema, IDs, services, runtime, CEF, native, cursor, Launcher or protected data changes.
- Preserve memoized references, adjacency indexes, viewport culling and declared port geometry.
- API fixtures only for publish/assign/rollback tests; never alter owner content.
- Local test deployment only, with immutable hashes and reversible code/config backup.

## Review focus

- Dense 16-choice hover must isolate exactly one stable handle without graph writes.
- Long Thai/English text must fit declared card/port geometry and be fully editable in inspector.
- Narrow desktop panels/toolbar must remain reachable without canvas data changes.
- Pending/error/expired sessions must retain explicit feedback and never duplicate publish writes.
- Hover, keyboard focus and persistent selection must clear independently and remain cheap.

## Tasks

- [x] 1. Capture Phase A browser/geometry/performance baseline; add meaningful failing tests for choice focus, no mutation, inspector target summaries and feedback.
- [x] 2. Implement local presentation components/tokens, full shell, node/connection inspector and cheap exact-choice emphasis. Preserve editing/history/auth handlers and render caches.
- [x] 3. Build/test editor and RP suite. Browser QA all requested states at 1366/1920/2560/ultrawide plus dense stress; compare geometry/performance and fix regressions.
- [x] 4. Review diff, backup and deploy local immutable server companion assets; verify data manifests, startup/auth/asset hashes. Report, commit and push authorized branch.

Verification: 32/32 editor tests, 339/339 RP regressions, production builds and browser acceptance passed. Deployment record: build/rp-audit/g23/deploy-1792847337160/deployment.json. Source commit 344a7560 pushed to the authorized frostveil development branch. Owner visual acceptance remains pending.
