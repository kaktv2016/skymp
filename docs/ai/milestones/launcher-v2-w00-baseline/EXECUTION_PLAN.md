# Launcher V2 W00 — Execution Plan

Milestone: launcher-v2-w00-baseline
Revision: 1

## Strategy

Start only after the tracked handoff pins the approved specification. Run the existing handoff loader against the approved clean Launcher checkout, record both repository baselines, then initialize or resume the matching Context Manager checkpoint. Audit existing evidence before scanning storage. Keep technical conclusions separate from release and owner acceptance.

The only write scope is the redacted SkyMP audit deliverables, normal workflow records and private local evidence. Use a clean linked Launcher worktree for the pinned source. Keep changes out of the owner's existing Launcher checkout.

## Tasks

| Task | Work and evidence | Depends on | Acceptance |
|---|---|---|---|
| W00-T1 | Record repository HEADs, status, release and build receipts, reported signed metadata expiry, NSIS gate and owner E2E status. Identify which report comes from committed source or WIP. | Approved handoff | W00-A1 |
| W00-T2 | Resolve allowed storage roots and active profile from existing evidence. Inventory by volume using file metadata first and targeted hashing only where it resolves ownership or duplicate content. Trace journal, Restore and link relationships. Compute confirmed reclaimable bytes and explain exclusions. | W00-T1 and approved roots | W00-A2 |
| W00-T3 | Trace provider selection in pinned runtime/distribution code and map compatible warm, staged reuse, cold depot acquisition, expiry and fallback to dated receipts. Record gaps for released GUI and other providers. | W00-T1 | W00-A3 |
| W00-T4 | Prepare the candidate profile and later fixture/owner checks. Produce a reuse, harden or new map. Name only pilot-blocking ADRs and assign a next decision or evidence owner for each blocker. | W00-T2 and W00-T3 | W00-A4, W00-A5 |
| W00-T5 | Verify output consistency, reconcile totals, review evidence boundaries, compare the Launcher HEAD, index and working status with intake, and retain receipts. Update workflow status and save the milestone boundary. | W00-T1 through W00-T4 | W00-A6 |

If storage roots have yet to be approved, complete W00-T1 and W00-T3 and mark W00-T2 blocked with the exact missing scope. Do not fill missing rows from estimates without a label.

## Skills

Use `frostveil-feature` for the milestone workflow and `frostveil-context-manager` for checkpoint and handoff. Use `frostveil-release` to read existing release and expiry evidence within audit scope. Apply the relevant native guidance only to interpret existing pin and compatibility evidence.

## Subagent assignments

Main owns the approved pin, scope, write decisions, integration and owner handoff. Assign the researcher to the bounded provider/source trace and QA to storage evidence and reconciliation. The reviewer checks the output independently for unsupported claims, ownership and preservation. Use generic fallback or run sequentially when host capabilities require it. Children have no write, approval, release or deployment authority.

## Quality gates

- Gate A verifies the approval pin, clean Launcher dependency and actual repositories. Record separate preservation fingerprints for the existing Launcher HEAD, index and working tree.
- Gates B/C validate the inventory JSON, reconcile volume totals where supported, check task-to-acceptance coverage and verify report references. Record exact commands, exit codes and evidence. The audit uses no game or installation tests.
- Gate D reviews ownership, recovery dependence, scope and how each material claim is supported. Resolve findings or record blockers.
- Native, deployment and gameplay gates E/F/G are outside W00. List any future gate needed to validate the proposed pilot, including cold and warm preparation, Verify, Play/join/reconnect and Restore.
