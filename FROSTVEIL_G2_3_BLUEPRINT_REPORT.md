# Frostveil G2.3 Blueprint Editor — implementation record

Status: IN PROGRESS. No G2.3 deployment or gameplay acceptance yet.

## Inspected integration
Existing runtime: rp-gamemode/src/modules/dialogue/dialogue-runtime.ts; NPC lifecycle/pose: modules/npc/npc-service.ts; authentication: modules/admin/local-authority.ts; persistence primitive: modules/economy/journal.ts. G2.1/G2.2 reports reside in docs/rp-development/. Current authorized development branch is wip/gui-performance-profiling; preserve native cursor implementation without further changes.

## Design and required delivery
- Desktop React + TypeScript + @xyflow/react editor with palette, inspector, selectors, accessible Unicode editing, undo/redo and full graph workflows.
- Share the actual schema/validator between browser and runtime. Existing choice-mediated return-to-menu paths are legitimate Clerk behavior; automatic cycles remain forbidden. Unsupported Quest/Event/Flag/shop/reputation extensions must be explicitly unavailable.
- Separate authoring journal with bounded drafts, layout metadata, graph history, stable NPC assignment and optimistic revisions. Reuse fsync/checksummed storage without writing economy or NPC journals for editor state. Account for existing journal record limits rather than allowing oversized histories in a single record.
- Loopback-only dedicated authenticated HTTP service, not public resource listener. Reuse verified local-operator authority via short-lived, single-use exchange grants, expiring server-side sessions, CSRF/origin checks, size/rate limits and revocation checks on each request. No client-provided identity/role authority.
- Published graphs selected by stable registered NPC ID, defaulting to existing Clerk. Running conversations pin immutable graph snapshots; new sessions receive latest validated publication. Preview uses the same runtime traversal with read-only/mock adapters and service descriptions, never EconomyService.
- Publish/rollback optimistic revisions and history durable before acknowledgement. Rollback creates a new higher version. UI must report errors and conflicts without losing drafts.
- Required tests: mapping, graph validation, drafts/restart, read-only preview, authorization/replay/CSRF, concurrent publishing, history/rollback, NPC assignment/fallback, running conversation isolation, UI and E2E workflow, existing gameplay regressions.
- Build/review/backup/deploy only verified local test environment; hash protected data, retain code rollback, verify endpoint/startup; commit/push authorized development branch. Final owner checklist must demonstrate actual Skyrim dialogue update before claiming gameplay success.

## Progress
Shared pure graph types and validation extracted to graph-model.ts with compatibility re-exports from dialogue-runtime.ts. This enables browser/server validation reuse without importing filesystem persistence or implementing a second validator. No runtime semantics changed in this extraction.

## Pending acceptance
All editor, authoring persistence, authenticated API, runtime publication integration, UI/E2E verification and deployment requirements remain pending implementation. This document records the full scope, not a reduced completion target.

### Runtime and validation foundation (2026-10-24)
- DialogueRuntime now accepts an optional server-owned graph resolver keyed by stable NPC ID. Each open copies its selected graph into the conversation; later publication or edits cannot alter active choices/version. Existing callers retain Clerk fallback.
- Added a two-player snapshot regression proving new sessions see a new version while old sessions retain their original choices. Graph mutation outside the runtime cannot mutate either conversation snapshot.
- Shared graph validation now rejects fields incompatible with node type, missing NPC text and coerced IDs; automatic-cycle detection uses indexed visiting/done sets to avoid exponential traversal of branching DAGs. Legitimate explicit-choice menu loops remain supported.
- Build/typechecks and full RP suite: 321/321 passed, no skips. Evidence: .local/g23-validation-tests.log. No G2.3 deployment yet.

### Authoring persistence and preview (in progress)
- Added BlueprintStore with a separate checksummed journal root, optimistic draft revisions and published versions, immutable-addressed graph content followed by catalog commit, version history, rollback-as-new-version and NPC assignments. No runtime integration yet. Store limits currently cap graph payload at 48 KB, graphs at 64 and history at 100 versions per graph; capacity failures are explicit. Further catalog recovery validation and discoverability of unpublished drafts are still required before API exposure.
- Added previewDialogue using DialogueRuntime with inert private adapters and a descriptive service stub. No live native/player/economy handles can be supplied. Tested service-path previews, courierIdle, exit, forged choices and traversal bounds.
- Prototype property names are rejected for stored IDs and invalid version numbers are rejected. API authorization and eligible NPC checks are still required at the service boundary.

### Storage recovery follow-up
Unpublished drafts now have a durable catalog index and remain discoverable after restart. Catalog recovery checks schema, history ordering, referenced graph identity/version, rollback references and assignment targets; startup rejects semantic corruption even when journal checksums are valid. Constructor errors release the private writer lease. Focused storage tests cover restart, optimistic conflicts, rollback, assignment, invalid drafts, prototype names, malformed versions, draft discovery/layout and corrupt catalog references. This is not yet exposed over HTTP or deployed.

### Local editor transport foundation
Added in-memory EditorAuthority: 60-second one-use login grants, 15-minute sessions, hashed tokens, CSRF secrets, authority/identity revalidation, expiry, logout and request bounds. Added dedicated loopback EditorHttpServer with exact Host/Origin checks, HttpOnly SameSite=Strict cookie, CSRF on all API operations, payload limit, request/socket timeouts, bounded connections, CSP and safe static asset allowlist. Tests exercised a real disposable loopback listener, unauthorized requests, forged CSRF, wrong Origin/Host, oversized body and revoked authority. No listener has been enabled in the deployed server yet. Native game session resolver and login grant command still need runtime integration.
BlueprintService routes only typed authoring operations and checks eligible NPC assignment. UI and HTTP workflow integration remain pending.

### Editor workspace started
Created blueprint-editor as an isolated React/TypeScript/@xyflow/react workspace in the SkyMP repository; no Launcher changes. Added typed graph-to-canvas and canvas-to-graph mapping preserving runtime node/choice metadata and Unicode, with connection-handle validation, output replacement and explicit dangling links after deletion. Three mapping tests and TypeScript check passed. Initial dev-tool audit found Vitest mocker advisories; upgraded the pinned test runner to the patched 4.1.12 before proceeding. UI construction and browser acceptance remain pending.
