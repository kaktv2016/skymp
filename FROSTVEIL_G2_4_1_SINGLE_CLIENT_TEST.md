# G2.4.1 — single-client acceptance

**Current state: BLOCKED_MISSING_ASSETS. No visual acceptance claimed.** Do not run the appearance fixture on the live server. Its production defaults are disabled. Two-client testing is explicitly deferred and is not the current blocker.

## Work available now (PowerShell, repository root)

```powershell
Set-Location 'C:\Users\basba\OneDrive\Desktop\skyrim-rp\skymp'
npm run build --prefix rp-gamemode
node .\rp-gamemode\scripts\g241-dev.cjs prepare
```

The last command prints a new isolated root. It contains fresh empty world/registry locations, a code snapshot, disabled approval, and `start-visible.ps1`. It copies no live saves or economy journals. Keep this root for the following commands:

```powershell
$fixture='<root printed by prepare>'
node .\rp-gamemode\scripts\g241-dev.cjs probe "$fixture"
```

Probe runs the actual addon in separate write/reload processes, with no game, no network clients and no production restart. It creates only a legacy clerk in a separate **probe registry**, proves missing custom assets cannot spawn, and records diagnostics. It is not the visual fixture and must not be treated as a visual test. Logs: `$fixture\probe-write.log`, `probe-reload.log`, `probe-result.json`, `source-candidates.json`, protected before/after manifests. No private live journals are included.

## Gates before opening Skyrim

1. Follow `FROSTVEIL_G2_4_1_ASSET_AUTHORING_GUIDE.md`: create the real owned ESP and four real FaceGen exports. No such files were generated in this milestone.
2. Run `node .\rp-gamemode\scripts\g241-stage.cjs "$fixture" '<authored-package-root>'`. This reads real records/resources and produces a **disabled draft**, never installs/signs/publishes. Missing assets fail. A complete NIF/headpart/ARMA/texture closure verifier has not been established; the loader refuses approved spawning catalogs until that verifier is integrated and tested. An authoring review text alone cannot bypass this gate.
3. After that gate is implemented with real authoring evidence, use the existing **signed development Launcher delivery** to install the approved package on Play, verify all expected file hashes and active plugin order, and approve that exact isolated package/config. No production manifest replacement, unsigned installation, hand-copying into Skyrim or manual enable-by-JSON workaround.
4. Server/client prefix must match: five masters, existing FrostveilCourierNavigation.esp, then FrostveilNPCTest.esp. Do not insert the test plugin ahead of existing entries. The native loader checks the constructor's actual load-order paths as well as index names and hashes.
5. Only after all gates pass, the developer enables the reviewed isolated approval and starts its visible PowerShell: `& "$fixture\start-visible.ps1"`. As delivered, this command refuses to start because approval is disabled. Expected future ports are UDP 17777 and resources 17778; production UDP 7777/resources 3000 remain separate.

## One-client Skyrim checklist, after the gates above

Select the isolated `127.0.0.1:17777` server through the supported Launcher/server selection. Do not edit player installation files. A fresh test character/world is expected; the live Clerk is not copied or replaced.

Grant the current verified local session using the existing OS-operator workflow:

```powershell
node .\rp-gamemode\scripts\admin-local.cjs "$fixture\admin" list
node .\rp-gamemode\scripts\admin-local.cjs "$fixture\admin" grant <actorHex-from-list> owner
```

Stand on flat open ground near the isolated start area, then use only names in chat:

```text
/npc templates
/npc fixture create
/npc fixture list
```

- **Identity:** exactly two test NPCs, recognizable `[TEST]` names; repeat create and compare the full UUIDs in fixture list. No extra actors. Move closer to one, look toward it, `/npc select` then `/npc info`; save its assignment/revision/base and do the same for the other.
- **Appearance:** Nord female clerk and Imperial male warrior (or explicitly reviewed authored choices), distinct face/hair/skin/body. No dark faces, missing hair/eyes/textures or head/body seams. Compare against authored reference screenshots.
- **Equipment:** clerk wears the approved fixed civilian/robe outfit; warrior wears approved fixed armor. Verify weapon only if one was explicitly authored and validated. Data saying “worn” is not a pass. No missing meshes, random inheritance or changes to unrelated actors.
- **Pose:** idle animates; rename does not move/spin; `/npc rotate 90` and `/npc move here` work as before. Selection revision conflict should ask for reselection, not overwrite another edit.
- **Persistence:** walk far enough to unload, return; reconnect; restart **only the isolated server** and reconnect/regrant admin. Compare the same two UUIDs, appearance and equipment after each step. Never restart production for this test.
- **Cleanup:** `/npc fixture cleanup`, then `/npc fixture list`. Both fixture entries should be tombstones and invisible; unrelated definitions remain. Repeat cleanup to prove idempotence. These are recoverable soft deletions, not destructive deletion. Stop the isolated server with Ctrl+C; preserve its evidence and data until review. Production Clerk/profile/world/economy hashes must remain unchanged.

Record screenshot paths in an owner-created `$fixture\acceptance\` folder, plus the visible server console log, timestamps, `/npc info` output, plugin/file hashes and client/CrashLogger paths. Codex does not operate Skyrim's GUI or take gameplay success from mocks. Set `VERIFIED_SINGLE_CLIENT_VISUAL` only after owner confirmation for all applicable checks.
