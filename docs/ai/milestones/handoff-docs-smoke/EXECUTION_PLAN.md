# Documentation-only handoff smoke plan

Milestone: handoff-docs-smoke
Revision: 1

## Strategy

Control commits the three documents and pins revision 1 in a separate approval commit. A fresh Codex receiver loads the pointer using the handoff script.

## Tasks

1. `receive-pinned-handoff` — Read the tracked pointer and validate the approved spec, plan and acceptance. Report the gate label `DOCS-HANDOFF-RECEIVE`.
2. `record-smoke-evidence` — Main compares the receiving result to the approved data and records the outcome and Context Manager closeout.

## Skills

Use the existing Frostveil feature and context manager guidance. The receiver only performs the read step.

## Subagent assignments

Main owns approval, verification, evidence and Git. The fresh receiver performs a bounded read-only smoke.

## Quality gates

`DOCS-HANDOFF-RECEIVE` requires a clean approved Git pin and exact recovery of the target, task and acceptance from a fresh session. The handoff and Context Manager contract checks must pass.
