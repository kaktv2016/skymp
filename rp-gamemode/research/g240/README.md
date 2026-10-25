# G2.4.0 isolated capability research

Not imported by production. No playable NPC fixture, live feature or deployable visual preset.

From the SkyMP repository root on the audited Windows environment:

```powershell
npm run build --prefix rp-gamemode
node --test rp-gamemode/research/g240/client-state.test.cjs
node rp-gamemode/research/g240/native-poc.cjs --isolated
```

The last command requires the installed native addon and configured five vanilla masters. It reads their paths from the existing server settings but creates fresh empty storage under `build/rp-audit/g240/native-*`, outside live saves. It uses the existing compiled NpcService and actual addon in separate writer/reloader processes, never launches Skyrim, never updates production config and never publishes anything. Port/config/realpath guards reject production storage. Logs are retained in the ignored audit folder; no cleanup deletes owner files.

Appearance values are numeric capability markers with empty headparts, **not visually valid presets**. Do not connect Skyrim to this fixture or promote its world/profiles. Equipment setter rejection is expected; it proves an API boundary, not successful outfitting. VM tests exercise actual source with inert platform mocks, not the installed native renderer. Two simulated handlers are not two real clients.

Results: eight capability tests pass; real addon registry write/reload passes with exactly two identities and unchanged live protected-data manifests. Full RP 347, editor 80 and client 50 regressions pass; native ESM suite passes 84 cases (475,373 assertions on the final root run). RP and editor build/typechecks pass. Client webpack/typecheck passes with DEPLOY_PLUGIN=false; no installation/deployment hook runs.

See the root compatibility report and architecture decision for source references, exact installed hashes, negative findings, rights restrictions and future conditional manual acceptance. `evidence.json` is a sanitized summary, not a signed release attestation. Full logs remain local under `build/rp-audit/g240`.
