---
name: frostveil-debug
description: Reproduce, diagnose, and repair a Frostveil regression, test failure, persistence bug, or runtime symptom using evidence.
---

# Frostveil debug

**Inputs**

Exact symptom, expected behavior, environment/build, and available logs or reproduction.

1. Read `docs/ai/DEVELOPMENT_SOP.md`, then collect exact command, time, exit and scope. Preserve diagnostics privately.
2. Use a bounded fixture to reproduce. Compare to the last known-good source and runtime; trace input to authority, mutation, persistence and client observation as applicable.
3. Test the smallest supported hypothesis. Add or strengthen a regression check when the suite misses it. Use `scripts/ai/test-focused.ps1` and `test-regression.ps1` where applicable.
4. Rerun affected checks and ask for independent review. After three repairs, reassess or report the blocker with evidence and next diagnostic.

**Outputs and blockers**

Reproduction, confirmed root cause or bounded uncertainty, focused repair, regression receipts. Stop if protected data, missing native evidence or incompatible identity makes further testing unsafe.
