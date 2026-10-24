# Frostveil G2.3 Blueprint Editor Report

**Status:** deployed to the verified local test server; in-game owner acceptance remains pending.

## Delivered

- Added a React/TypeScript `@xyflow/react` authoring UI with graph/node editing, searchable palette, inspector, Thai/Unicode text, action and condition selectors, duplicate/delete, undo/redo, layout, dirty-state warnings, validation, read-only preview, publish/history/rollback and NPC assignment.
- Reuses the dialogue runtime graph schema and strict validation. Drafts allow incomplete links/text while publishing requires valid graph structure and allowlisted actions. Preview describes service calls without invoking economy or changing player state.
- Added isolated, checksummed BlueprintStore persistence, optimistic revisions and version history. Published graph assignment is keyed by stable registered NPC ID; existing sessions keep their graph snapshot and new sessions use the latest assigned graph.
- Added the loopback-only editor service with one-time admin grant (`/editor`, valid 60 seconds), expiring session, per-request authority checks, CSRF/origin/host checks, bounded payloads, request limits and safe static asset delivery.
- Added immutable server bundle deployment with a content-addressed UI asset directory and hash verification. Server-only deployment does not require a matching client pin because it changes no client or Launcher files.

## Verification

- RP gamemode build and regression suite: **338/338 passed**, no skips.
- Blueprint editor TypeScript production build and UI tests: **5/5 passed**.
- Deployment tests: **8/8 passed**; deployment script syntax checked; `git diff --check` passed.
- Browser health check: `http://127.0.0.1:3210/` returned **200** and title `Frostveil · Blueprint Studio`; unauthenticated `/api/catalog` returned **403**.
- Server is listening on loopback UDP **7777** and editor HTTP **3210**. Its configured gamemode is `f648f3808952749ba49b906b5d04a897ee2c0ba94628f137d25d6c8924a5c9d8.cjs`; bundle SHA-256 is `f648f3808952749ba49b906b5d04a897ee2c0ba94628f137d25d6c8924a5c9d8`. UI assets SHA-256: `6bb93cc141ad51743502464e62e76e7cece71caa5ceaea48fa778e40289de5a7`.
- Protected world, economy, NPC and dialogue data manifest SHA-256 was identical before and after deployment: `33ca308b8a54eac3ba6a2026de43e0690746859e2b6e38c50f5e7d7b0a56fc51`. No player installation or Launcher file changed.

## Manual Skyrim acceptance

1. Join the local server as the authorized administrator and run `/editor`.
2. Open the returned `http://127.0.0.1:3210/` URL and use the one-time grant from the private chat message within 60 seconds.
3. Edit the existing Courier Guild Clerk graph, enter Thai text, save a draft, validate and preview it, then publish and assign it to the registered Clerk.
4. Open a new Clerk conversation and verify the published text/actions. Confirm an already-open conversation retains its original snapshot, then reconnect and verify the published graph remains assigned.
5. Confirm non-admin access fails and that invalid/replayed actions do not alter Courier rewards or economy.

## Deployment and rollback

- Deployment record: `build/rp-audit/g23/deploy-1792817046763/deployment.json`.
- Visible PowerShell start script: `build/rp-audit/g23/deploy-1792817046763/start-visible.ps1`.
- To roll back, stop the verified server and run `node rp-gamemode/scripts/rollback.cjs`; this restores the previous gamemode configuration only and does not restore world/player data. Keep the content-addressed new bundle/assets for diagnosis.
- Commit/push status: pending in this report revision.

## Limitations

Automated tests do not prove gameplay, two-client isolation in the actual engine, CEF input behavior, or a successful in-game publication. Do not treat G2.3 as owner-accepted until the manual Skyrim steps above pass.
