---
name: frostveil-assets
description: Validate or safely author Frostveil NPC ESP and FaceGen assets with Creation Kit MCP and the G2.4.5 intake and G2.4.6 activation gates.
---

# Frostveil assets

**Inputs**

Owner-approved source and provenance, fresh CK/game/master identity, plugin and expected hash, FormKey, FaceGen and resource closure, intended profile.

1. Read `FROSTVEIL_CREATION_KIT_MCP_REPORT.md`, `FROSTVEIL_G2_4_5_NPC_ASSET_PIPELINE_REPORT.md` and `FROSTVEIL_G2_4_6_RUNTIME_ONBOARDING_REPORT.md`. Query MCP capabilities and installation. Recheck the installed master and native limits.
2. Validate approved full ESP scope, NPC, masters and FaceGen closure via existing MCP validators. If authorized to author, use the reviewed scratch plan and immutable result. Native FaceGen requires the documented manual CK export.
3. Stage only through G2.4.5. Bind its immutable output to the reviewed profile, catalog and Runtime Identity v2 plan for any explicitly authorized G2.4.6 activation. Follow the existing restart/verification runbook.
4. Record hashes, FormKeys, revision and manifest/catalog/profile identities, test receipts and exact owner rendering checklist.

**Outputs and blockers**

Validated candidate or actionable missing asset/action. Stop on incomplete FaceGen, unsupported master/light plugin, changed hash, stale review, or absent authorization. Preserve live installations and existing NPC identities.
