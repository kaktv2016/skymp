# Frostveil G2.3 Blueprint Editor Report

**Status:** deployed to the verified local test server; in-game owner acceptance remains pending.

The first browser check exposed a real delivery bug: the server registered bundled UI files as `/assets/assets/<file>`, while `index.html` requested `/assets/<file>`. The browser therefore showed a blank page. The asset loader now maps the exact Vite URLs; a regression test parses the production HTML and verifies every JS/CSS path is served. The visible PowerShell start script also continues through Node's non-fatal deprecation warning instead of treating stderr as a fatal error.

## Delivered

- Added a React/TypeScript `@xyflow/react` authoring UI with graph/node editing, searchable palette, inspector, Thai/Unicode text, action and condition selectors, duplicate/delete, undo/redo, layout, dirty-state warnings, validation, read-only preview, publish/history/rollback and NPC assignment.
- Reuses the dialogue runtime graph schema and strict validation. Drafts allow incomplete links/text while publishing requires valid graph structure and allowlisted actions. Preview describes service calls without invoking economy or changing player state.
- Implemented node types are `entry`, `npc`, `choices`, `condition`, `action` and `end`; conditions are `always` and `courierIdle`; service actions are `contracts`, `rank`, `permits`, `accept` and `buyPermit`. Quest events, player flags, shops, factions/reputation and arbitrary quest-journal/native nodes are unsupported until real runtime handlers and validation exist.
- Added isolated, checksummed BlueprintStore persistence, optimistic revisions and version history. Published graph assignment is keyed by stable registered NPC ID; existing sessions keep their graph snapshot and new sessions use the latest assigned graph.
- Added the loopback-only editor service with one-time admin grant (`/editor`, valid 60 seconds), expiring session, per-request authority checks, CSRF/origin/host checks, bounded payloads, request limits and safe static asset delivery.
- Added immutable server bundle deployment with a content-addressed UI asset directory and hash verification. Server-only deployment does not require a matching client pin because it changes no client or Launcher files.

## Verification

- RP gamemode build and regression suite: **339/339 passed**, no skips.
- Blueprint editor TypeScript production build and UI tests: **6/6 passed**, covering Thai editing, draft saving, choices add/remove, preview, publish and NPC assignment. Graph mapping tests cover valid connection, invalid handles/targets and round-trip preservation.
- Deployment tests: **8/8 passed**; deployment script syntax checked; `git diff --check` passed.
- Browser health check: `http://127.0.0.1:3210/` returned **200** and title `Frostveil · Blueprint Studio`; unauthenticated `/api/catalog` returned **403**.
- Playwright against the live browser first reproduced 404 JS/CSS requests and an empty DOM; after the fix the actual page rendered its complete login UI with zero console errors. The single remaining console message is a browser password-field advisory. Evidence is retained under `build/rp-audit/g23/deploy-1792818156044/browser-evidence/`.
- Server is listening in visible PowerShell on loopback UDP **7777**, resource HTTP **3000** and editor HTTP **3210**. Its configured gamemode is `d8a4f626b45d3a7ebb4b27233b594443272fbfc7cbda4f60ada93adfb01dea99.cjs`; bundle SHA-256 is `d8a4f626b45d3a7ebb4b27233b594443272fbfc7cbda4f60ada93adfb01dea99`. UI assets SHA-256: `6bb93cc141ad51743502464e62e76e7cece71caa5ceaea48fa778e40289de5a7`.
- Protected world, economy, NPC and dialogue data manifest SHA-256 was identical before and after the corrected deployment: `54e4511359544ac80b9f514dd1189ece1959fb01c286b46c686ac58b116311c9`. No player installation or Launcher file changed.

## Manual Skyrim acceptance

1. Join the local server.
2. After a server restart, local admin approvals are cleared. On the server machine, use PowerShell from the project root to inspect the live session: `node .\rp-gamemode\scripts\admin-local.cjs .\build\dist\server\rp-admin list`. Match your active character's actor ID, then substitute that hexadecimal value for `ACTOR_HEX` in `node .\rp-gamemode\scripts\admin-local.cjs .\build\dist\server\rp-admin grant ACTOR_HEX owner`.
3. In game, run `/editor` and copy the one-time login grant returned in your chat within 60 seconds.
4. Open `http://127.0.0.1:3210/` in a browser and redeem the one-time grant.
5. Edit the existing Courier Guild Clerk graph, enter Thai text, save a draft, validate and preview it, then publish and assign it to the registered Clerk.
6. Open a new Clerk conversation and verify the published text/actions. Confirm an already-open conversation retains its original snapshot, then reconnect and verify the published graph remains assigned.
7. Confirm non-admin access fails and that invalid/replayed actions do not alter Courier rewards or economy.

## Deployment and rollback

- Corrected deployment record: `build/rp-audit/g23/deploy-1792818156044/deployment.json`.
- Visible PowerShell start script: `build/rp-audit/g23/deploy-1792818156044/start-visible.ps1`.
- To roll back this specific deployment, stop the verified server and run `node rp-gamemode/scripts/rollback-blueprint.cjs --record build/rp-audit/g23/deploy-1792818156044/deployment.json`. It verifies the selected G2.3 bundle/assets and prior config before restoring only the gamemode path; it never restores world/player data. Keep the content-addressed new bundle/assets for diagnosis.
- Implementation, the asset-path correction (`b1da4dc`) and report updates are pushed to `frostveil/wip/gui-performance-profiling`.

## Limitations

Automated tests do not prove gameplay, two-client isolation in the actual engine, CEF input behavior, or a successful in-game publication. Do not treat G2.3 as owner-accepted until the manual Skyrim steps above pass.
