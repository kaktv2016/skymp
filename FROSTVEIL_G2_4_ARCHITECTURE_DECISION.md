# Frostveil G2.4 architecture decision

Date: 2026-10-26. Status: **research recommendation; production implementation and real-client acceptance pending**. Evidence: [G2.4.0 compatibility report](FROSTVEIL_G2_4_0_COMPATIBILITY_REPORT.md).

## Primary: immutable preauthored NPC catalog

Use distinct NPC_ bases, matching FaceGen and fixed default outfits in an owned ordinary ESP with a signed, dependency-complete asset catalog. The server assigns an allowlisted template to each existing registry UUID. Existing G2.1 provisioning/tag recovery, pose/idle anchoring and G2.2 dialogue identity remain authoritative. Clients render the same approved base/resources through existing actor streaming.

This is selected because the current renderer already preserves distinct base IDs, while a valid shared base bypasses generated appearance. Native appearance storage/restart works, but the available direct equipment setter is rejected. A data protocol alone is not a complete visible customization system. No new native binary is justified by this milestone.

Fixed authored outfits must not inherit uncontrolled leveled gear. Validate race, sex, body/head/hair/eyes dependencies, slots and weapons per template; prove actual visuals, stream lifecycle and two-client convergence before promotion. Custom FaceGen export and render are still UNVERIFIED.

## Fallback: vetted vanilla template catalog

If custom-asset gates cannot pass, use a small server-approved catalog of existing vanilla bases/default outfits. It offers limited appearance choice, not arbitrary face editing. Keep the last verified assignment when a new revision is unavailable or invalid; a fallback never silently mutates an existing Clerk base. Even this catalog needs explicit template/identity integration and visual acceptance. Current production remains the existing clerk template, unchanged.

Do not use owner-local presets as a multiplayer fallback. Native appearance becomes a future alternative only after a safe per-instance renderer and server-authoritative gear application are independently proven. NPA is not an emergency fallback.

## Authoring and dependencies

RaceMenu may be an optional administrator authoring tool; no mandatory RaceMenu runtime dependency is introduced for the primary catalog. A jslot is an input, not a deployable multiplayer NPC. Manual authoring/conversion, dependency approval and matching base/FaceGen export precede manifest publication. Preserve `bExternalHeads=0`. Keep third-party mod binaries and restricted assets out of project releases unless the established permission/external-source policy permits them.

NPA remains a research reference, excluded from production. Its installed absence and unproven dynamic-reference/network behavior do not support adopting it now. Author documentation and dependency/permission findings are linked and qualified in the compatibility report; no binary investigation was performed.

## Proposed G2.4.1–G2.4.3 data contract (not implemented)

- **Template catalog:** immutable `catalogId`, `version`, content hash, plugin-qualified base identity, fixed outfit/weapon references, dependency manifest revision, validation result and rights evidence. Prefer ordinary ESP until FE/light resolution is proven. No arbitrary Form ID, JavaScript, Papyrus, console or filesystem paths in Studio content.
- **Profiles:** immutable `profileId`, version, template/catalog revision, optional future validated appearance/equipment profile references. A schema migration must explicitly handle the current null-only registry fields; this milestone performs none.
- **Assignment request:** authenticated admin + current session generation, registry UUID, expected NPC revision, catalog/profile IDs and revisions, idempotency key. Validate registered identity, authorization and all references on the server. One active assignment transaction per NPC.
- **Preview:** disposable, isolated fixture/session with explicit lifetime; opening an inspector cannot alter live NPCs. Do not retain Skyrim Platform wrappers across awaits/load transitions. Capture IDs and re-resolve on update.
- **Apply:** validate catalog and client compatibility first, then publish a bounded durable assignment revision through existing safe journal patterns. Preserve the stable registry UUID even if an eventual tested replacement of a native form is needed. Do not claim baseDesc can be rewritten in place. Native actor replacement, dialogue cancellation, retired form guards and rollback require dedicated implementation tests.
- **Rollback:** reassign the previous validated immutable revision, preserving audit history and live world/player/economy data. Failed apply leaves the existing assignment intact. No profile editing by overwriting published objects.
- **Replication:** owner/observer data follows existing authoritative NPC interest streaming, with revision deduplication and late-join snapshots. Rendering must not depend on a local co-save or administration client's preset cache. Missing assets block the new assignment, never trigger arbitrary client native calls.

G2.4.1 should first prove two preauthored bases and fixed outfits on two clients, including restart. G2.4.2 may expose only validated catalog assignment/preview; G2.4.3 may expand authored profile workflows after measured convergence. These are dependency stages, not authorization to start new milestones now.

## Capacity and promotion gates

Reuse interest streaming, cached asset validation and change-driven revision broadcasts; avoid per-frame preset application and writes on every stream-in. Bound catalogs, assignment histories, updates and concurrent previews. Existing registry capacity is 64 definitions including deleted entries, not proof of 100-player capacity. Measure 50–100-player interest sets, memory, late-join traffic and NPC churn before making scaling claims.

The G2.4.0 PoC verified native data isolation/persistence only and deliberately failed its visual/equipment promotion gate. Keep it absent from production imports/catalogs. Do not deploy, upload R2 assets or update Launcher for this research result. Signed Launcher delivery is required if a future approved client or asset change becomes necessary.
