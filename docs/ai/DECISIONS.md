# Workflow decisions

| Date | Decision and reason |
|---|---|
| 2026-11-09 | Keep one tracked workflow hub in SkyMP. Both repositories keep their own source and delivery authority. Preserve the Launcher owner's dirty index and working tree. |
| 2026-11-09 | Put roles in `.codex/agents/` and skills in `.agents/skills/`. Use project-scoped workspace permissions and a three-child cap where the host loads the project config. This keeps the global setup and MCP registrations intact. |
| 2026-11-09 | Use explicit receipt scripts in the milestone loop. Existing hooks remain in place. Explicit gates let Main pick relevant suites and avoid triggering tests or deploys in unrelated work. |
| 2026-11-09 | Keep test and log integrity separate from release provenance and actual Skyrim acceptance. Existing seals, deployment runbooks, and trust decisions still govern delivery. |

See the [G2.4 technical decision](../../FROSTVEIL_G2_4_ARCHITECTURE_DECISION.md) and the dated release and owner reports for existing technical decisions.
