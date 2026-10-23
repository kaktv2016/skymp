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
