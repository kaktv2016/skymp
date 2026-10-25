# G2.4.1 — deferred real-client acceptance

`MULTIPLAYER_VISUAL_ACCEPTANCE = DEFERRED / UNVERIFIED`

The owner postponed this work. Do not launch a second game, work around Steam, create a VM, or treat automated model handlers as real renderers. Its absence does not block the present backend work or eventual one-client local acceptance.

After asset/resource-closure/signed-delivery gates and one-client acceptance pass, use two permitted accounts on separate real Skyrim clients against the same disposable environment:

1. Verify both signed development installations have the same ESP, masters/order, FaceGen, outfit resources and exact hashes. Capture the reviewed catalog ID/version/hash.
2. Admin creates the fixture pair once. Compare registry UUIDs/base identities and photographs of faces, hair, skin/body, clothes/armor and any approved weapon on both clients. No other actor using a source base changes.
3. Client B joins late, then independently leaves/re-enters the streaming area. Compare A/B again. Unload/reload cells and cross interior/exterior boundaries as applicable; no duplicate actors or unsafe callbacks.
4. Reconnect clients individually, then restart only the isolated server and rejoin. The same UUIDs, base assignments, appearance and gear must return.
5. Test a reviewed immutable catalog revision using the future explicit replacement/assignment protocol. Existing-NPC base hot swap is **not implemented**; do not simulate it by editing a journal or writing baseDesc. Until that protocol exists, revision mismatch must fail closed and preserve the old identity.
6. Missing/old/wrong-hash assets or plugin order must be rejected by signed Launcher preflight and catalog validation. Do not bypass either check to connect a broken client. If server-side per-client compatibility cannot be proven, record that remaining gate rather than claiming multiplayer readiness.
7. Unauthorized commands, stale sessions/selections, duplicate fixture requests and cleanup must affect no other character or NPC. Compare protected live data hashes. Check both client logs/CrashLogger and server logs for reference leaks, repeated relocation or spawn churn.

Archive timestamps, actual artifact hashes, both plugin lists, exact UUID/revision records and paired screenshots. Only real two-client evidence may change the deferred status. No 50–100-player capacity claim follows from two-client success.
