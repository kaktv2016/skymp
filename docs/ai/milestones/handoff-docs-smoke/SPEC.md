# Documentation-only handoff smoke

Milestone: handoff-docs-smoke
Revision: 1

## Goals

Recover a committed Frostveil milestone in a fresh Codex session using only the active pointer and repository documents.

## Requirements

The receiver must report the exact milestone ID, revision, pinned commit, gate label `DOCS-HANDOFF-RECEIVE`, and next task from the plan. The owner supplies only the Milestone Execution request.

## Scope

Read and validate the three documents in this directory and the tracked approval pointer. Record observed handoff evidence and close the example.

## Exclusions

Gameplay, runtime and Launcher changes, deployments, production data, external publication and Creation Kit actions are outside the example.

## Constraints

Use a read-only receiver. Leave the approved documents at revision 1 and retain the approval in Git history.

## Dependencies

- Launcher commit: none
- Required tools: git, pwsh

The receiving Codex session needs access to the same SkyMP Git history.
