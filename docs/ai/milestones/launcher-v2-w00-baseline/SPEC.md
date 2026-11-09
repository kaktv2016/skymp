# Launcher V2 W00 — Baseline and First Release Scope

Milestone: launcher-v2-w00-baseline
Revision: 1

## Goals

Produce a read-only Launcher V2 baseline and propose one first-release player profile. Resolve which user journeys need Steam authentication, which storage could be reclaimed while preserving Restore, and which decisions block the first pilot.

Source brief is Frostveil Launcher V2 Master Roadmap Draft 1.1 dated 2026-11-09 (Asia/Bangkok), sections 2, 18 and 23. The reviewed draft SHA-256 is `b0def491f7e40cbdd3038f3c52caa5152850f7fb72489a3f99a0d8d82a521d19`. This specification and its companion documents define the handoff.

## Requirements

- Record exact SkyMP and Launcher Git identities, release and blocker evidence, and the distinction between committed code, existing WIP, fixture and owner observations.
- Inventory authorized storage roots by volume and separate active runtime, Restore dependencies, verified operation-owned disposable files, user data and unknown ownership. Report logical and allocated bytes separately. Count reclaimable bytes only when ownership, link relationships and recovery independence are evidenced.
- Trace compatible warm preparation, cold missing depots, expired authentication and the supported fallback. Use current source and existing receipts for DepotDownloader and leave fresh released-GUI batch or Steam Console behavior unverified until supported evidence exists.
- Map the existing Launcher modules and contracts to reuse, harden or new. Record the current release and metadata renewal obligations from dated evidence separately from V2 decisions.
- Propose one pilot profile and list its pins, exclusions, unresolved decisions and later automated versus owner gates. Windows with Steam Skyrim English and the reported `1.6.1170.0` runtime are the starting candidate. Verify the available evidence for SKSE and SkyMP pins. The pilot proposal carries no runtime or release certification.

## Scope

Read the pinned source, repository status, existing reports and receipts. Treat any separately authorized inspection of existing Launcher WIP as a distinct evidence source. Inspect only approved local paths for metadata about Steam libraries, the active installation, Launcher state, staging, caches, depots and backups. Begin with existing inventory and journal references and use bounded file reads where needed.

Write the redacted audit summary and supporting `CURRENT_STATE_AUDIT.md`, `COMPATIBILITY_BASELINE.md` and `DEPENDENCY_AUDIT.md` under SkyMP `docs/launcher-v2/w00/` during Execution. Keep the detailed `STORAGE_INVENTORY.json` and raw command receipts in private local evidence storage referenced by Context Manager.

## Exclusions

Game launch, Steam authentication, depot acquisition, file repair, runtime changes, cleanup, storage migration, installing or updating Launcher, metadata renewal, CDN changes, production release and implementing any pilot feature are outside W00. The audit may report these follow-up actions. It cannot authorize them.

## Constraints

Preserve Launcher staged and unstaged work, existing runtime and Restore data, signing controls and all current release safeguards. Keep the pinned committed baseline separate from the working copy. Do not stash, reset, stage or commit Launcher work. Avoid traversal through links or reparse points during inventory. Keep credentials, tokens, private paths and raw logs out of tracked outputs. Classify material claims as OBSERVED, ASSUMED, PROPOSED or UNKNOWN.

Record unavailable evidence as UNKNOWN with its cause and the decision it blocks. Unknown ownership or Restore dependence excludes the bytes from confirmed reclaimable totals. Report dates, sizes and release status from older reports as dated evidence until verified in scope.

## Dependencies

- Launcher commit: 29641f25666cf492614374770f5ae1808b90ca2c
- Required tools: git, pwsh

Use a verified clean Launcher checkout at the exact pin for the handoff validator and committed-source audit. The owner's current checkout has staged and unstaged changes. Use a separate clean linked worktree and pass its path as `-LauncherRoot` when approving and loading the handoff. Preserve the existing checkout and use its reports or WIP only as distinctly labelled read-only evidence.

Review the Launcher runtime normalization and R2 delivery reports, SkyMP project state, and [Frostveil handoff](../../MILESTONE_HANDOFF.md). Confirm allowed live inventory roots before inspecting them. If a root is unavailable, continue with authorized repository and report evidence and record the gap.
