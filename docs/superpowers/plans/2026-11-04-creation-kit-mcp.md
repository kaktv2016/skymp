# Creation Kit MCP implementation plan

Goal: implement the supplied Frostveil tooling specification without GUI control.
Architecture: official MCP TypeScript SDK stdio server, bounded C# Mutagen adapter,
existing Frostveil independent ESP/resource validators and G245 handoff.
Spec: owner's FROSTVEIL TOOLING — CREATION KIT MCP BRIDGE request (2026-11-04).

Ruling: execute the owner's detailed architecture and autonomous-delivery instruction
directly, in the clean authorized checkout, with no extra design approval loop or
subagents. No runtime deployment is necessary: this is an isolated local tool.

Constraints: no screen/input automation; no master/source overwrite; no native DLL
installation; full owned scratch ESP only; no implicit asset approval or activation.

- [x] Research pinned CKPE PluginAPI/TestPlugin/Facegen, installed versions, SDK.
- [x] Write failing real MCP initialization/read/create/roundtrip/security tests.
- [x] Implement `rp-gamemode/tooling/frostveil-creation-kit-mcp`: `src/schemas.ts`
  (strict schemas), `src/service.ts` (plans, journal, confinement, adapter),
  `src/index.ts` (SDK), `adapter/Program.cs` (typed record authoring/inspection).
- [x] Verify serialized NPC and OTFT with existing independent catalog parser;
  check references, masters, fields, no scripts/factions/packages/inheritance.
- [x] Exercise idempotency, conflicts, tampering, links, traversal, interrupted writes;
  preserve known assets and source hashes; reuse G245 scan without approving.
- [x] Build, run focused and relevant existing tests, inspect final diff/security.
- [x] Back up Codex configuration, register using supported CLI, verify discovery
  and real Codex tool invocations. Keep logs/receipts private under build/rp-audit.
- [x] Report honest capability status/evidence and Thai owner instructions;
  commit and push only to frostveil/dev/npc-activation-g241d.

Review focus: retries after process failure, state/plan tampering, filesystem redirects,
master dependency changes, and confusion between structural evidence and rendering.
