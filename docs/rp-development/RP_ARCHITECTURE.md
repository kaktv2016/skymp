# Future RP integration architecture

Source-based design notes for commit `2849e676fe008925384b26f34476e382a30bd877`, 2026-10-13. No RP gameplay systems were implemented. The foundation now supports the recorded single-client smoke test; multiplayer/stability validation remains pending as described in [BUILD_REPORT](BUILD_REPORT.md). The following module boundaries are recommendations, not existing features or validated performance claims.

## Existing extension surface

The Node server loads bundled JS through `gamemodePath` and binds global `mp` to the native `ScampServer`. TypeScript can compile to that JS entry point; keep the custom project separate from engine internals. Current built-in TS systems handle master registration, login, spawning, Discord bans and metrics. These systems are part of the server wrapper, not automatically configurable gamemode modules.

`ScampServer::Init` exports property/event definitions (`makeProperty`, `makeEventSource`, `get`, `set`, `clear`), actor creation/assignment/querying, kicks and custom packets, form description conversion, record lookup, placement, neighbors and property indexing. It also exposes Papyrus call/registration, packet history and native metrics. See [scripting reference](../docs_serverside_scripting_reference.md) and the native binding table in `skymp5-server/cpp/addon/ScampServer.cpp`; `ts/scampNative.ts` describes only part of the current surface. Add a typed adapter for APIs actually used rather than treating those incomplete declarations as an exhaustive contract.

Existing `gamemode_events` include activation, crafting, death/respawn, item actions, appearance/equipment attempts and Papyrus events. Check each event's source name and arguments before wiring a handler. For example `ActivateEvent` exposes `onActivate(refrId, casterRefrId)`; custom event arguments prepend the actor/reference ID. `makeEventSource` defines client-executed source code that sends an event; custom names begin with underscore. Availability of a callback is not proof that it can veto every engine action: verify the corresponding event and action code before relying on cancellation.

Properties define owner/neighbor replication and client update snippets. Built-ins cover world state such as position, appearance, inventory and enabled status, with some read-only values. Store only small, serializable, explicitly versioned RP state on these boundaries. Persistent private property names appear in the upstream Spawn system, but private visibility is not a place to store passwords/tokens. Never put credentials into a replicated update snippet.

## Proposed modular layers

| Layer/module | Future responsibility | Boundary |
| --- | --- | --- |
| SkyMP adapter | Typed access to mp, forms, actors, events and custom packets | Existing script APIs; only justified missing bindings warrant C++ work |
| Session adapter | Authenticated account, connection GUID, actor assignment and disconnect lifecycle | Existing Login/Spawn flow; must retain GUID race guards |
| Domain modules | Character rules, inventory/economy/jobs/permissions later | Server-authoritative commands; no direct transport or engine ownership |
| Repository adapters | RP account/character records and audit operations | Asynchronous database access with explicit schema/versioning |
| Client/UI adapter | Input intents, property rendering and notifications | Existing event sources/custom packets; never authoritative balances or permissions |
| Diagnostics | Timings, rejection/error counters, save/DB lag and health | Existing metrics plus bounded module-level measurements |

Start with one compiled gamemode entry that registers module handlers and manages teardown/reload. Do not replace transport, world replication, actor save storage or the Papyrus VM. Avoid repeated global listeners and timers during file-watcher reload; the source clears registered properties/events but application-owned resources still require disposal. Prefer explicit restart for critical schema/session changes until hot reload is tested.

## Validation and event safety

Treat every client payload and event-source argument as untrusted input. Resolve the actual connected actor from the session rather than accepting a target identity from the packet. Validate schema, lengths, numeric ranges, target existence, permissions, proximity, ownership and rate limits before mutations. Put decoding inside error boundaries; the upstream custom-packet path uses `JSON.parse` before individual system try/catch blocks. Logging an uncaught error does not provide transactional safety.

Capture connection GUID/account/actor before asynchronous work and recheck connection and GUID before applying its result. The Login system already implements this around profile resolution; preserve it. Serialize conflicting mutations per character, reject stale requests and make retryable writes idempotent. Do not await slow database/network operations inside the native tick call. Bound queues and timeouts; avoid logging sensitive session payloads.

## Authentication, identity and sessions

Online Login queries the configured master API's server session endpoint and performs profile/GUID checks. Offline Login accepts a numeric client-selected profile ID, which is useful only for isolated development. It provides no production identity proof. `masterKey`, session tokens and future account credentials stay outside repository/client-visible state.

Connection `userId`, connection GUID, account/profile ID, actor form ID and future character ID are different lifetimes. `Spawn` currently reuses the first actor for a profile, creates a new one otherwise, sets the user's actor, opens race menu for new actors and disables actors on disconnect. A future multi-character selector must intentionally adapt that built-in flow; adding a second spawn handler without controlling the existing one can create conflicting assignments. Use an adapter at the wrapper boundary, and only propose native changes if the script API cannot express the verified requirement.

Custom authentication is not available merely by assigning a gamemode path: it must integrate with Login/session validation and Spawn without bypassing authoritative mapping. Inspect both ends of the master/client handshake before choosing an external identity provider. HTTP `/rpc` is not globally authenticated by the router; a future RPC handler needs explicit auth/authorization. Do not publish it during offline testing.

## Persistence and database ownership

Engine file/Mongo/ZIP drivers own actor/world `MpChangeForm` persistence. Keep world position, inventory and actor properties on the existing save path where appropriate. RP account/character metadata, audit records and transactional economy may later use separate schema-controlled repositories. Changing the engine database driver does not automatically provide a transaction spanning these records and native world state.

Avoid writing engine `changeForms` files directly while the server is running. Build explicit mapping from account to character to actor using stable form descriptions where appropriate, and record schema versions. Plan backup, restore, rollback and migrations before production; use the engine migration driver only with tested backups. File persistence is adequate for the initial five-player verification target; do not infer crash safety or 100-player suitability. Benchmark it against Mongo before choosing a production driver.

For actions spanning an external database and world state, define one source of truth, an operation ID, compensation/reconciliation and retry policy. Do not assume atomic commit across Node DB promises and native asynchronous saves. Multi-character ownership constraints and reconnect restoration need tests before storing valuable persistent state.

## TypeScript versus C++ changes

| Requirement class | Preferred path |
| --- | --- |
| RP rules, commands, permissions, metadata and UI intents supported by mp | TypeScript gamemode modules/adapters |
| External database/account integration | Node adapter first; wrapper/session extension only where required |
| Character selection | Adapt existing Login/Spawn lifecycle; verify actor APIs before considering native work |
| New transport messages/reliability, replication changes or native game hooks | Likely coordinated C++ and client changes; preserve protocol compatibility |
| Missing authoritative validation, native combat/Papyrus behavior or required inaccessible engine state | Investigate a narrow upstream-compatible C++ extension with native regression tests |
| Proven tick/save bottleneck | Profile first; then optimize the measured TS/native boundary or engine path |

These are decision boundaries, not commitments to modify the engine. A requested RP feature needs an API capability audit before classifying it as native work.

## Performance evidence required before Phase 2 scaling

Measure crowded and dispersed players separately at 5, then progressively toward 50/100. Watch neighbor fan-out and serialization, UDP throughput/loss/reliability backlog, native tick p95/p99, Node event-loop delays and allocations, repeated get/set crossings, save queue/flush latency, database timeouts, reconnect races, NPC/Papyrus cost, HTTP payload sizes and client Chromium frame time. Existing Prometheus metrics include connects/disconnects/logins/login errors, RPC duration and tick duration; use authenticated localhost collection initially.

Synthetic bots can exercise load paths but cannot validate in-game visibility, animation or combat. Require two real clients and durable reconnect/restart evidence first. Phase 2 should begin with a minimal typed adapter and validated session/character boundaries, only after Phase 1's build/startup gate is satisfied. Implement RP modules incrementally rather than assuming 50–100 players from configuration limits.
