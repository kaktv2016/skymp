# Phase B.1 implementation plan

Owner authorizes autonomous delivery of the supplied Phase B.1 specification. Base: c11b9c57 (verified Phase B plus stable startup command). Branch: dev/smart-routing-phase-b1.

- [x] Freeze Phase B Clerk/stress geometry, screenshots and performance baseline.
- [x] Add view-only routing types/geometry and bounded fixed-node orthogonal router, deterministic lanes, return handling, quantitative metrics and fixtures A–H. Agent owns orthogonal-router.ts / routing-metrics.ts and their tests only.
- [x] Integrate pinned ELK layered with actual fixed-position ports, engine sections translated into rendered paths, EPL notice and actual engine tests. Separate cancellable workers for layout/manual routing.
- [x] Add Smart/Legacy, asynchronous Auto Arrange preview/Apply/Cancel, stale-result protection and one undo transaction. Save only positions explicitly. Keep caches off pointer movement; use cheap attached endpoint previews while dragging.
- [x] Run editor/RP builds and regressions. Browser geometry, routing, quantitative metrics and equal-geometry performance checks at 1366/1920/2560. Review/fix with evidence.
- [x] Backup/deploy verified loopback environment; verify immutable assets, auth and protected data, then report, commit/push. Owner acceptance remains pending.

Safety: no runtime/schema/IDs/service/persistence/Launcher/native changes; no auto save/publish/assign; do not alter owner graphs. Algorithmic fallback must be visible and documented, not silently misrepresented as an ELK route. Exact overlaps can remain; no zero-crossings claim.
