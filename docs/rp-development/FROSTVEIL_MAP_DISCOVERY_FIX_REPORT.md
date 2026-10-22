# Frostveil — Map Discovery Persistence Fix Report

Date: 2026-10-22
Branch: `develop`

## Root cause

The existing Skyrim Platform `locationDiscovery` handler placed a discovery in a client queue, sent it once, and removed it immediately. There was no server acknowledgement or retry. The server correctly rejects stale, ambiguous, out-of-range, wrong-session, or wrong-world reports; if one such report or transport packet was lost, the one-shot client had no way to recover it. The character custom-property persistence itself is durable: the pinned native integration test confirmed that `rpMapDiscoveryStateV1` survives separate server processes on isolated synthetic characters.

The installed Skyrim Platform source confirms `locationDiscovery` and the native `ObjectReference.isMapMarkerVisible`, `canFastTravelToMarker`, and `addToMap` APIs. The fix continues to save only validated discoveries and restores only saved native markers. It does not use reveal-all commands, and it preserves each saved `canTravelTo` flag.

## Changes

- Client map reports now use a bounded, per-actor in-memory outbox with stable request IDs. They retry with exponential backoff (1–30 seconds) across network reconnect and client source replacement until the owner-only server snapshot acknowledges persistence.
- Server accepts an idempotent retry for an already-persisted marker and returns its acknowledgement without another character-state write. Acknowledgements are session-scoped and capped at 32; existing marker IDs, persistence schema, player data, and fast-travel flags are unchanged.
- Added regressions for acknowledgement/retry, reconnect and source replacement, actor isolation, duplicate replay after server restart, and no redundant persistence write.

Changed files:

- `rp-gamemode/src/client/map-discovery.ts`
- `rp-gamemode/src/modules/map-discovery/map-discovery-service.ts`
- `rp-gamemode/tests/map-discovery-client.test.cjs`
- `rp-gamemode/tests/map-discovery.test.cjs`

## Verification

- `npm test`: **274 passed, 0 failed**; includes the full RP regression suite and TypeScript/type-test builds.
- `node --test tests/map-discovery-native.test.cjs`: **1 passed**. It used the pinned native addon and installed master files with disposable synthetic characters and separate writer/reloader processes; it verified 435 catalogue records, persistence, and character isolation without changing physical character fields.
- Focused map-discovery tests: **23 passed**.
- Built `dist/rp-gamemode.cjs` contains the retry/outbox and acknowledgement code.
- New regression tests were observed failing before the implementation and passing afterward.

Owner confirmed the live Skyrim check passed after both disconnect/reconnect and a full server restart: the icon for a newly discovered location remained visible. This confirms those two persistence paths; per-character isolation and the no-unintended-fast-travel check still need their own in-game confirmation.

## Delivery

The generated server gamemode bundle is `rp-gamemode/dist/rp-gamemode.cjs`. No client JS binary, ESP, Launcher, modpack, or player installation file needs changing; the server delivers its registered client event source as before. The bundle has only been built locally: it has **not** been deployed or published.

## Manual Skyrim check

1. Start the test server with this generated bundle and connect through the normal Launcher.
2. On a character, discover one previously undiscovered base-game marker. Wait until the client log `rpMapDiscovery` reports `discovery persistence acknowledged` (and server log records validated discovery).
3. Disconnect and reconnect; verify the marker remains on Skyrim's native map and compass.
4. Restart the test server without resetting world/player data, reconnect, and verify the same marker remains.
5. On another character, verify the discovered marker was not exposed; discover a second marker and confirm both remain only on their respective characters after reconnect.
6. Confirm a nearby visible-but-undiscovered marker remains hidden and that no new fast-travel permission was granted.


## Local deployment and owner check
Deployed on 2026-10-22 through deployment.cjs (code/config backup only). Local UDP 127.0.0.1:7777 was listening; map transport and foundation readiness were confirmed. Bundle SHA-256: f940abb4644071f2d13216124206287e0f8b9b10b1e017466311bd043710971f. Backup: `build/rp-audit/map-discovery/deploy-1792681871164`. No player installation or world/economy data was modified by deployment.

Owner confirmed on 2026-10-22 that a newly discovered icon remained on the native map after disconnect/reconnect and after restarting the server. The other-character isolation, visible-but-undiscovered marker, and fast-travel checks in the manual checklist remain outstanding.
