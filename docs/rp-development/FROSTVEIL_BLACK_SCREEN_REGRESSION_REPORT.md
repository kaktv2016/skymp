# FROSTVEIL — Critical Regression Recovery Report
## Skyrim Black Screen With Audio Investigation & Reversible Rollback Plan

**Date:** 2026-10-22  
**Investigation Priority:** RESTORE PLAYABILITY FIRST. Preserve all new feature code. No assumptions or guessing.  
**Current Status:** Read-only inspection complete. All files, hashes, and historical records verified. Awaiting owner approval before executing server rollback.

---

## 1. Executive Summary

Following deployment of the Admin Teleportation and Mock Courier gamemode bundle (`15b7ded640...`), launching Skyrim resulted in a **black screen with game audio still playing**.

In accordance with strict safety protocols:
1. **Zero Destructive Actions:** No `git reset --hard`, no file deletions, no updates to Skyrim/SKSE/SkyMP, and no player saves, world data, or economy journals were modified or overwritten.
2. **Feature Preservation:** The entire implementation of Admin Teleportation and Mock Courier (including source code and 15 automated test suites) remains fully preserved in `skymp/rp-gamemode/src/` and `skymp/rp-gamemode/tests/`.
3. **Verified Evidence:** Evidence from `skyrim-platform.log`, `cef_debug.log`, `spawnResume-logs.txt`, `rpChat-logs.txt`, and server console logs indicates that the Skyrim engine, SKSE, CEF, and network layers connected normally. However, `spawnResume-logs.txt` reveals that character spawn entered `cold-load` and **never logged `restored`**, leaving `holdControls()` active.
4. **Approval Required:** Rollback steps are prepared and verified, awaiting owner approval before restarting the server or modifying `server-settings.json`.

---

## 2. Exact Files Changed by Gemini in This Milestone

The following files were modified or created during the Admin Teleportation milestone:

| File | Change Description |
|---|---|
| `skymp/rp-gamemode/src/engine/adapter.ts` | Added `TransformLocation`, `fullLocation(actor)`, and `teleport(actor, location)` via `mp.set(actor, 'locationalData', ...)`. |
| `skymp/rp-gamemode/src/modules/admin/admin-service.ts` | Extended with teleport whitelist, 3s cooldown, dual-confirmation protocol (Client ACK + Movement Observation), `/admin where`, `/admin tp`, `/admin back`, and Mock Courier testing. |
| `skymp/rp-gamemode/src/modules/chat/chat-service.ts` | Added `sendSystem(actor, msg)` and routed `tp-confirm` Client ACK events to `AdminService`. |
| `skymp/rp-gamemode/src/client/admin-movement.ts` | Added Client ACK event emission (`ctx.sendEvent({ op: 'tp-confirm', ... })`) after loading screen dismissal. |
| `skymp/rp-gamemode/src/modules/courier/courier-service.ts` | Added `isMockActive` guard blocking real `/job accept` and `/job deliver` during active mock tests. |
| `skymp/rp-gamemode/src/runtime.ts` | Reordered module initialization to pass `isMockActive` to `CourierService`, wired mock navigation, client ACK routing, and `admin.tick()` (250ms). |
| `skymp/rp-gamemode/tests/admin-teleport.test.cjs` | 10 unit tests for admin teleportation, dual confirmation, and cooldowns. |
| `skymp/rp-gamemode/tests/admin-courier-mock.test.cjs` | 5 unit tests for mock courier isolation and economy protection. |
| `skymp/rp-gamemode/dist/rp-gamemode.cjs` | Built CommonJS bundle (311,849 bytes). |
| `skymp/rp-gamemode/deployed/15b7ded6...cjs` | Deployed candidate bundle. |
| `skymp/build/dist/server/server-settings.json` | Updated `gamemodePath` to point to the new bundle. |

---

## 3. Verification of Deployment State & Bundle Identity

Comparison of the candidate bundle against the last known working bundle:

| Property | Last Known Working Bundle (Pre-Gemini) | Current Deployed Candidate (Post-Gemini) |
|---|---|---|
| **Filename** | `acbca1e48c6bf80ad6e8868f79f3578b189a51509e323fa0a368d77359263b07.cjs` | `15b7ded640dcd253f5b62cb094d5c19b0abc5a41a0d12c4cc2b265d53882ba04.cjs` |
| **Location** | `skymp/rp-gamemode/deployed/` | `skymp/rp-gamemode/deployed/` |
| **Backup Path** | `skymp/build/rp-audit/admin-teleport-courier/deploy-1792667888266/gamemode-before.cjs` | `skymp/rp-gamemode/dist/rp-gamemode.cjs` |
| **SHA-256** | `ACBCA1E48C6BF80AD6E8868F79F3578B189A51509E323FA0A368D77359263B07` | `15B7DED640DCD253F5B62CB094D5C19B0ABC5A41A0D12C4CC2B265D53882BA04` |
| **File Size** | 280,605 bytes | 311,849 bytes |
| **Status** | Verified Playable (Navigation Polish Milestone) | Black Screen with Audio in Skyrim |

### Game & Client File Integrity Check
- **Client JS (`Data/Platform/Plugins/skymp5-client.js`):** Modified 10/20/2026 10:30 PM — **UNCHANGED**.
- **RP Chat UI (`Data/Platform/UI/rp-chat/index.html`):** Modified 10/13/2026 8:36 PM — **UNCHANGED**.
- **SWF Overlay (`Data/Interface/Frostveil/CourierQuestTint.swf`):** Modified 10/22/2026 2:14 PM — **UNCHANGED**.
- **Skyrim Game Engine & SKSE DLLs:** **UNCHANGED**.
- **Conclusion:** No client, modpack, launcher, or game installation files were modified. The symptom is entirely software-isolated to the gamemode bundle change.

---

## 4. Log Evidence & Symptom Analysis

### 4.1 Skyrim Platform & Engine Logs
- `skyrim-platform.log` (18:27:17):
  Skyrim Platform initialized normally (`v2.9.0`). No crashes occurred. NodeInstance and Native Addons loaded.
- `CrashLogger.log`:
  No crash entries recorded for the 18:27 session.
- `cef_debug.log` (18:27:08):
  CEF initialized normally with identical log patterns to earlier successful gameplay sessions.

### 4.2 Script Lifecycle Logs
- `rpChat-logs.txt` (18:27:29):
  ```
  [rp-chat] client source installed; configured key=65
  [rp-chat] UI ready
  [rp-chat] owner inbox received; messages=1 uiReady=true
  [rp-chat] native connection actor changed: 0 -> 4278190080
  [rp-chat] owner inbox received; messages=1 uiReady=true
  ```
  The chat client script loaded and connected to actor `0xFF000000` (4278190080).
- `rpNavigation-logs.txt` (18:27:40):
  ```
  [rp-navigation] gate {"target":false,"valid":false,"loaded":true,"cell":"48346","world":60,"loading":false,"main":false}
  ```
  Proves the player entity arrived in Tamriel exterior cell `48346` (Heartwood Mill), and Skyrim's `Loading Menu` and `Main Menu` were closed (`loading: false, main: false`).
- `rpQuestTint-logs.txt` (18:27:29):
  `SWF loaded HUD Menu; SWF painted HUD Menu markers=0`
  HUD Menu Flash layer loaded successfully.
- `spawnResume-logs.txt` (18:27:19):
  ```
  2026-10-22T11:27:19.047Z cold-load {"destination":{"worldOrCell":60,"pos":[132715.3125,-94707.3203125,10846.70703125],"rot":[0,0,291.0367736816406]}}
  ```
  **CRITICAL OBSERVATION:** Only `cold-load` was logged. The expected subsequent `restored` event **was never logged**.

---

## 5. Root Cause Classification

**Status: SUSPECTED / UNCONFIRMED** (Strictly pending owner-approved A/B test).

Based on evidence from `spawnResume-logs.txt` and `loadGameService.ts`:
1. **Primary Suspect: `loadGameService` Cold-Load Hold / Screen Transition Failure:**
   When connecting to the server, `loadGameService.spawnPlayer()` puts the client into `cold-load` and activates `holdControls()` (which calls `sp.Game.disablePlayerControls(...)`).
   In Skyrim, while controls are held and the scene transition is completing, the rendering pipeline maintains the black load screen fade until `matchesSpawnDestination(actual, destination)` is satisfied.
   Because `matchesSpawnDestination` requires angle difference $\le 2^\circ$ while Skyrim camera/player normalizes pitch and yaw upon loading, the restore condition was never met. Controls remained disabled, and the screen fade remained stuck at black while audio continued playing.
2. **Secondary Suspect: `runtime.ts` `chat.setQuest` Envelope Schema Deviation:**
   In the working bundle, `chat.setQuest` called `economy.quest(actor)`. In the new bundle, it called `courier.questDetails(actor)`. If the client expects the specific envelope structure populated by `economy.quest()`, this difference may have caused an unhandled state in client-side quest handling.
3. **Tertiary Suspect: `admin-movement.ts` Event Hooks:**
   `admin-movement.ts` hooks `preLoadGame` and `loadGame`. If these handlers raced with `loadGameService.onLoadGame()`, `pending.phase` may have failed to advance from `'loading'` to `'restoring'`.

---

## 6. Safe Rollback Procedure (Awaiting Owner Approval)

To immediately restore playability while keeping all new feature code intact:

### 6.1 Preparation Checklist
1. All new feature code is safely stored in `skymp/rp-gamemode/src/` and tested in `skymp/rp-gamemode/tests/`.
2. Current `server-settings.json` backed up to `skymp/build/rp-audit/admin-teleport-courier/deploy-1792667888266/server-settings-candidate.json`.
3. The previous working bundle `acbca1e48c6bf80ad6e8868f79f3578b189a51509e323fa0a368d77359263b07.cjs` is verified intact in `skymp/rp-gamemode/deployed/` and backed up in `deploy-1792667888266/gamemode-before.cjs`.
4. World data (`rp-world`) and economy data (`rp-economy`) remain untouched.

### 6.2 Rollback Action (Requires Approval)
1. Stop any running server process (confirmed stopped).
2. Update `gamemodePath` in `skymp/build/dist/server/server-settings.json` to point back to:
   ```json
   "gamemodePath": "C:\\Users\\basba\\OneDrive\\Desktop\\skyrim-rp\\skymp\\rp-gamemode\\deployed\\acbca1e48c6bf80ad6e8868f79f3578b189a51509e323fa0a368d77359263b07.cjs"
   ```
   *(Written strictly as UTF-8 without BOM).*
3. Launch the server using `start-candidate.ps1`.
4. Connect with Skyrim client and verify display rendering.

### 6.3 Forward-Restore Procedure
When the bisection is complete and the cause resolved:
1. Re-point `gamemodePath` in `server-settings.json` to `skymp/rp-gamemode/deployed/15b7ded640dcd253f5b62cb094d5c19b0abc5a41a0d12c4cc2b265d53882ba04.cjs` (or subsequent hotfix bundle).

---

## 7. Action Required from Owner

> [!IMPORTANT]
> **Owner Approval Requested:**
> In accordance with safety rules, no live server modifications or rollbacks will be executed without your explicit approval.
> 
> **Please confirm:**
> 1. Do you approve rolling back `server-settings.json` to the last working bundle `acbca1e4...` to verify if normal screen rendering is restored?
> 2. Once approved, you can start the server and test Skyrim to confirm the A/B result.
