# G2.4.4 implementation ledger

Spec: owner's G2.4.4 attachment (2026-10-30). Baseline SkyMP dc0c2432 / Launcher 3d88c56f.

## Design and rulings

- Extend the validated immutable catalog with derived record/asset metadata; preserve the approved raw catalog, hashes, two Base Forms, ESP and existing UUIDs.
- Reuse EditorAuthority + loopback HTTP + React infrastructure. Isolated NPC view `/npcs` at 127.0.0.1:13210, independent of graph publication. `/npc manage` issues the existing one-use login grant. No credentials printed by diagnostics.
- Creation uses the existing registry reservation/native place/assignment lifecycle. Naming is a compatible existing-NPC edit. Snapshot digest + catalog revision + expiring single-use review prevent conflicting/replayed changes. Every apply revalidates admin/session, mapper and actual asset integrity.
- No live Base/outfit replacement: native BaseDescBinding and EquipmentBinding are getters; inventory application explicitly skips actors in FormView. SetOutfit declarations do not prove per-instance isolation/replication. Do not rematerialize actors or modify shared bases without evidence.
- Catalog availability is explicitly local-development only with detailed FaceGen/outfit proof pending. Weapon metadata is separate and currently empty. No preview images invented.

## Execution

- [x] Catalog derived metadata and negative validation tests.
- [x] Registry-backed read/create/rename + revisioned review/apply and transport/security tests.
- [x] Isolated React view: selection, filters, compatibility, review, errors and keyboard tests.
- [x] Builds, full RP/editor/client/assets/native/affected CLI regressions; real browser QA.
- [x] Verify idle isolated environment, protect data, back up code, seal, restart and check process/ports/health; reversible rollback.
- [x] Independent review and report; implementation commits created. Push verification recorded in delivery results. Owner visual/multiplayer acceptance remains pending/deferred.

Ruling: retained the previous 25ms native torch timing failure logs; unchanged focused/serial full suite passed, no tests/timeouts altered. Deployment reviewer found UI destination redirection and interrupted rollback issues; both were fixed and covered by focused regressions before deployment. Final automated suites: 417 + 84 + 73 + 20 + 256 = 850 cases. Actual native probe uses fresh storage/simulated owner, never the real owner's registry. Full details: `FROSTVEIL_G2_4_4_NPC_APPEARANCE_EQUIPMENT_REPORT.md` at repository root.
