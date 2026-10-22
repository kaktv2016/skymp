# ระบบที่มีอยู่แล้วและขอบเขตที่ยังต้องพัฒนา — Skyrim RP

สำรวจ local source/configuration และหลักฐานเดิมวันที่ 2026-10-13 (Asia/Bangkok) สำหรับใช้วางแผนต่อ ไม่ใช่การรับรองทุกระบบด้วย gameplay test รอบใหม่

**อัปเดต 2026-10-14:** ผู้ใช้ยืนยัน final Phase2.2 solo checks และ Phase2.3 checklist1–5 ผ่านแล้ว: Character Sheet/Thai edits/Save, reopen/Cancel/ชื่อว่าง, focus, reconnect/server-restart profile persistence, commands เดิมและ native character/items. Profile editing/UI จึงเป็น implemented + solo verified แล้ว ดู [PHASE23](../../rp-gamemode/PHASE23.md) สำหรับขอบเขตตรงตามการยืนยัน; automated output/count และ two-player ยังไม่มีหลักฐานใหม่ คำแนะนำ Phase ถัดไปด้านล่างเป็นประวัติของ audit ก่อน Phase2.3

## ข้อสรุปสำหรับวางแผน

**Phase2.4 อัปเดต 2026-10-14:** `/roll [2–100]` (default D20) และ `/try [action]` (D20/DC11) เพิ่มใน registry/chat เดิมแล้ว ผู้ใช้ยืนยัน solo manual checklist ผ่านครบ รวม input ผิด, Thai/RP name, คำสั่ง/profile/focus เดิม และไม่เปลี่ยน inventory/equipment/attributes/world. ภาพมี D6=6/2 และ throttle feedback. ระบบนี้เป็นข้อความประกอบ RP ไม่มี automatic world actions; ไม่ต้องสร้าง dice/chat ใหม่. Two-player visibility/proximity ยัง UNVERIFIED และไม่มี automated output/count ใหม่ ดู [PHASE24](../../rp-gamemode/PHASE24.md)

โปรเจกต์นี้ไม่ได้เริ่มจากศูนย์: SkyMP เป็นเจ้าของ login/spawn, actor, inventory, equipment, appearance, position/cell, world saves และ multiplayer transport อยู่แล้ว เราเพิ่ม RP metadata, module/command/event infrastructure และแชตที่ส่งถึง server และกลับมาแสดงได้จริงแล้ว

**อย่าวาง Phase ถัดไปเป็นการสร้างระบบเหล่านี้ใหม่เพียงเพราะยังไม่ได้ทดสอบสองคน** ให้ใช้ระบบเดิมเป็นฐาน แล้วเพิ่มเฉพาะกติกา RP/UI/metadata ที่ยังขาด การมีโค้ดพื้นฐานกับการพิสูจน์ความถูกต้องในเกมเป็นคนละเรื่อง

คู่มือส่งให้ ChatGPT: [CHATGPT_PLANNING_CONTEXT.md](CHATGPT_PLANNING_CONTEXT.md) รายงานนี้ให้บริบท local ที่ใหม่กว่าเอกสาร Phase 1/2.0/2.1 ซึ่งยังเก็บข้อความ pending ตาม checkpoint เก่าไว้

## Snapshot และหลักฐาน

- Repository: `skymp`, branch `develop`, HEAD `5397cd3bf4666c942f78193107881d8cf0ac2748`; upstream engine parent `2849e676fe008925384b26f34476e382a30bd877` มี working-tree changes ของ RP/diagnostic/documentation ที่ยังไม่ commit จึงอย่าถือว่า HEAD เพียงตัวเดียวบรรจุ Phase 2.2
- Runtime ที่บันทึกและใช้งานได้: Skyrim SE 1.6.1170 + SKSE 2.2.6; VS 2022 x64/v143. Cache ปัจจุบันยืนยัน generator `Visual Studio 17 2022`, x64, v143, `BUILD_FRONT=OFF`, `BUILD_GAMEMODE=OFF`
- Config ที่อ่านจริง: `offlineMode=true`, `maxPlayers=5`, port 7777, `databaseDriver=file`, `databaseName=rp-world`, `npcEnabled=false`, `enableConsoleCommandsForAll=false`
- Gamemode ที่ config เลือก: `rp-gamemode/deployed/a4706056a60b36c6dd69808dd0678debcd8c933eb80d0d3a0a33c5d2c443514c.cjs` ไม่ใช่ empty upstream gamemode; path/name นี้เป็น snapshot ไม่ใช่คำรับรอง hash ที่ตรวจใหม่
- บริบท server ที่ผ่านการใช้จริงคือ localhost; ยังไม่รับรองการเชื่อมต่อจาก LAN/Internet หรือจำนวนผู้เล่นมากกว่าที่ทดสอบ
- Phase 1: 12/12 CTest targets ผ่านในรอบ unfiltered ที่บันทึกไว้; Phase 2.1: 67/67 tests ผ่านในรายงานเดิม พร้อม copied-world/native persistence และ wrapper checks; **ไม่ได้รันซ้ำในการสำรวจนี้** และไม่ใช่จำนวน tests ปัจจุบันของ Phase 2.2
- ผู้ใช้ยืนยัน solo character/inventory/equipment/position/reconnect/server-restart persistence และ Phase 2.1 regression checks ผ่านแล้ว ตามข้อความเริ่ม Phase 2.1/2.2
- Phase 2.2: screenshot ล่าสุดแสดง normal chat, Thai text, `/whoami`, `/me`, `/do`; `rpChat-logs.txt` มี 5 sends และ owner inbox เพิ่มจาก 1 เป็น 6 messages; `build/dist/server/logs/phase22-event-prefix-fix1.log` มี 5 server receipts/handler returns. ยืนยันเส้นทางจริงแบบผู้เล่นคนเดียว ไม่ใช่ mocks
- ไม่รัน build/test/server/game/install; ไม่แก้ gameplay, configuration, DLL, game assets, world หรือสร้าง commit ในการสำรวจนี้ อ่าน source และเขียน documentation เท่านั้น

## วิธีอ่านสถานะ

| สถานะ | ความหมาย |
| --- | --- |
| มีใน SOURCE | พบ implementation; ไม่เท่ากับเปิดใช้หรือทำงานได้จริงทุกกรณี |
| REGISTERED | entry point สร้าง service/register API หรือ module แล้ว; อาจมีเงื่อนไขภายใน |
| ENABLED/CONFIGURED | config/registration ที่ตรวจรองรับการใช้งานในชุดปัจจุบัน; ไม่ใช่ gameplay certification |
| SOLO PASS | มีหลักฐานจากผู้ใช้/ภาพ/log เกมหนึ่ง client; ไม่ได้พิสูจน์ผู้เล่นเห็นกันหรือ proximity |
| AUTOMATED RECORDED | ผล tests เดิมที่มีหลักฐาน ไม่รันซ้ำ และขอบเขตต่างจาก real gameplay |
| ยังไม่ VERIFIED | ต้องตรวจเฉพาะเมื่อจะใช้งานเส้นทางนั้น ไม่ใช่คำสั่งให้สร้างระบบใหม่ |
| RP GAP | ไม่พบ domain module/กติกา RP ที่ต้องการใน custom gamemode ปัจจุบัน |

## ระบบพื้นฐานของ SkyMP: ใช้ของเดิมก่อน

ทุก path ในตารางอ้างจาก repository root; กลุ่ม client services ถูกสร้างใน `skymp5-client/src/index.ts` และ native API export อยู่ใน `skymp5-server/cpp/addon/ScampServer.cpp`

| ระบบ | มีอะไรจริงและเปิดอย่างไร | หลักฐาน/ขอบเขตการทดสอบ | การตัดสินใจสำหรับ Phase ต่อไป |
| --- | --- | --- | --- |
| Login / session / profile | `skymp5-server/ts/systems/login.ts`; offline profile/current GUID และเส้นทาง master-session auth มีแล้ว ใช้ offline ใน local config | SOLO login ผ่าน; online/master auth ยังไม่รับรอง | รักษา login เดิม ไม่สร้าง account/session อีกชุด |
| สร้าง/โหลดตัวละคร + spawn | `ts/systems/spawn.ts` เรียก getActorsByProfileId แล้วโหลด actor เดิม หรือ createActor + race menu เมื่อยังไม่มี | SOLO create/re-entry/persistence ผ่านตามผู้ใช้; default เลือก actor แรกของ profile | ไม่สร้าง RP actor แยก; multi-character selection ยังเป็นงานเพิ่มหากต้องการ |
| Identity mappings | `ScampServer.cpp`, `property_bindings/ProfileIdBinding.cpp`; ActorId/UserId/ProfileId มีความหมายต่างกัน | native actor/profile reuse ผ่าน; GUID ใช้ตรวจ session ปัจจุบัน | RP metadata ผูก actor เดิม; อย่าใช้ connection ID เป็น character ID |
| Inventory + item counts | `cpp/addon/property_bindings/InventoryBinding.cpp`, `cpp/server_guest_lib/Inventory.cpp`, `skymp5-client/src/sync/inventory.ts` | solo inventory/restart ผ่านตามผู้ใช้; historic NUMBER_OUT_OF_RANGE ยังเป็น known issue | ใช้ native inventory เป็น authority; ไม่ทำ inventory JSON/SQL สำเนาอีกชุด |
| Equipment / appearance | `EquipmentBinding.cpp`, `AppearanceBinding.cpp`, client `sync/equipment.ts`, `sync/appearance.ts` | solo equipment/character regression ผ่าน; ไม่ได้ยืนยันทุก item/mod | ต่อยอดผ่าน native state; อย่าสร้าง equipment synchronization ใหม่ |
| Position / cells / movement / animation | `LocationalDataBinding.cpp`, `PosBinding.cpp`, `WorldOrCellDescBinding.cpp`; client `sync/movement.ts`, `sync/animation.ts`, `view/worldView.ts` | solo walking/position persistence ผ่าน; remote movement/cell transitions ยังไม่สองคน | reuse transport/model เดิม; proximity ใช้ server location |
| Persistence + restart | `cpp/server_guest_lib/MpChangeForms.cpp`, `WorldState.cpp`, `database_drivers/FileDatabase.cpp` | save native state + dynamicFields; solo restart และ RP metadata retention ผ่าน | ไม่เขียน character-save engine ใหม่; file storage เพียงพอสำหรับ slice เล็ก |
| Network + reconnect | client `services/services/networkingService.ts`, server `cpp/mp_common/Networking.cpp` | login/re-entry จริงผ่าน; เมื่อ server ดับ client reconnect และยังเห็นฉาก local | ไม่มี forced-disconnect screen/movement lock ที่แชตเพิ่มให้; UX disconnect เป็นส่วนเพิ่มได้ภายหลัง |
| Combat / hit / bow / magic | client `hitService.ts`, `playerBowShotService.ts`, `magicSyncService.ts`, `sync/spell.ts`, `sync/actorvalues.ts`; native `ActionListener.cpp`/`HitTest.cpp` | มี registered paths และ native automated coverage; combat ระหว่างผู้เล่นยังไม่ยืนยัน; historic unknown-target error | เพิ่ม RP damage/rules เมื่อจำเป็น; ไม่เขียน combat transport ใหม่ |
| Death / respawn | client `deathService.ts`; native `gamemode_events/DeathEvent.cpp`, `RespawnEvent.cpp`, `SpawnPointBinding.cpp`, `SpawnDelayBinding.cpp` | SOURCE/REGISTERED; gameplay death/respawn รอบนี้ยังไม่ยืนยัน | medical RP/downed policy ยังเป็น RP GAP; native death ไม่เท่ากับระบบแพทย์ RP |
| Activate / container / take-put / drop | client `activationService.ts`, `containersService.ts`, `dropItemService.ts`; native `ActionListener.cpp` OnActivate/OnPutItem/OnTakeItem/OnDropItem | SOURCE/REGISTERED; ไม่ตีความ solo inventory pass ว่า container/player trade ทุกกรณีผ่าน | ใช้เส้นทางเดิมสำหรับ interaction/item actions ก่อนเพิ่ม policy/UI |
| Crafting พื้นฐาน Skyrim | client `craftService.ts` ส่ง CraftItem; native `ActionListener.cpp` OnCraftItem และ `unit/CraftTest.cpp` | SOURCE/REGISTERED + native tests ในชุดเดิม; workstation gameplay ยังไม่ยืนยัน | ไม่สร้าง crafting transport ใหม่; RP recipes, permissions, jobs, rewards เป็นงานเพิ่ม |
| Form/world/record/Papyrus APIs | `ScampServer.cpp` มี get/set/place, lookupEspmRecordById, getNeighborsByPosition, call/registerPapyrusFunction, getAllForms | export ตรวจจาก source; adapter RP ยัง expose เฉพาะที่ใช้ | ขยาย typed adapter ทีละ API เมื่อจำเป็น; ไม่เดาว่าทุก export เป็น safe RP operation |
| HTTP manifest + metrics | `skymp5-server/ts/ui.ts`, `manifestGen.ts`, `systems/metricsSystem.ts` | HTTP/metrics เคยผ่าน baseline; manifest/load-order ยังมี warning เดิม | reuse health/metrics/manifest; ไม่เท่ากับ launcher/mod installer หรือ RP admin dashboard |
| UI / keyboard / CEF bridge | native `BrowserApiTilted.cpp`, `main.cpp`, `InputConverter.cpp`; client `browserService.ts` | CEF แชต/typing/ไทย/send ผ่านจริง; keyboard layout converter รองรับ Alt+Shift/Ctrl+Shift ใน source | reuse CEF; upstream frontend source มีแต่ BUILD_FRONT=OFF ไม่ใช่ full RP UI ที่ deploy แล้ว |
| JS gamemode events/properties | `ScampServer.cpp` makeEventSource/makeProperty; client gamemodeEventSourceService/gamemodeUpdateService | แชต `_onRpChatV1` + owner inbox ทำงานจริง | reuse custom-event/property transport; ไม่สร้าง protocol ใหม่ |

Native file saves มี asynchronous processing (`WorldState.cpp`/save storage); persistence pass ที่เคยได้ไม่ใช่ guarantee ว่า force-kill/crash ทุกเวลาไม่เสีย latest changes และไม่ใช่ multi-account economy transaction engine. บริบทนี้ไม่ต้องเปลี่ยน DB เพียงเพราะจะมี RP metadata เพิ่ม

## RP foundation ที่เราเพิ่มแล้ว

| ส่วน | Source / registration | สถานะและสิ่งที่ไม่ควรทำซ้ำ |
| --- | --- | --- |
| Typed adapter + IDs | `rp-gamemode/src/engine/adapter.ts`, `ids.ts`, `mp-api.ts` | มี runtime checks และ branded IDs; phase21 automated/native evidence. ขยาย adapter เดิมแทนอีก wrapper |
| Module registry/lifecycle | `src/core/module-registry.ts`, `src/runtime.ts` | dependency ordering, scoped cleanup, reverse shutdown/partial rollback มีแล้ว; one-shot boot ไม่ใช่ framework hot reload |
| Command registry | `src/core/command-registry.ts`, identity/chat modules | parsing/owned registration/dispatch มีแล้ว; อย่าสร้าง command dispatcher อีกชุด |
| Event router | `src/core/event-router.ts`, runtime | owned hook, previous-handler preservation, duplicate prevention มีแล้ว; native client custom event ต้องขึ้นต้น `_` |
| RP identity/profile | `src/modules/identity/*`, `src/client/profile-ui.ts`, registered ใน runtime | `private.rp.v1.identity` schema1; Character Sheet แก้ชื่อ/biography, Save/Cancel/focus/reconnect/restart SOLO PASS ใน Phase2.3; multi-character selector ยังไม่มี |
| RP chat/UI/transport | `src/client/chat-ui.ts`, `chat-bridge.ts`, `src/modules/chat/*`, `client-ui/index.html` | default chat enabled; F7/CEF + Enter + response path SOLO PASS; reuse panel/transport เดิม |
| `/whoami`, `/me`, `/do`, normal/Thai chat | identity/chat command registrations | ภาพและ client/server logs SOLO PASS; ไม่ต้องสร้างใหม่หรือกลับไปบอกว่าไม่มี in-game transport |
| Local routing | chat-service.ts selectRecipients | server cell + distance, default 2000 units, self-echo, invalid state fails closed มี implementation; two-player range ยังไม่ VERIFIED |
| Feature validation | chat-service.ts/contracts.ts | length280 code points, interval750ms, bounded dedup/history/inbox, textContent มี source/tests; invalid-input/throttling gameplay ยังไม่ยืนยัน |
| Build/deploy/rollback | `scripts/build.cjs`, `deployment.cjs`, `deploy.cjs`, `rollback.cjs` | immutable bundled CJS, backups/config selection/hashes มีแล้ว; latest world ไม่ restore อัตโนมัติ; live rollback ทุก deployment ไม่รับรอง |
| Chat diagnostics | RP source + client `rpChatDiagnostics.ts`/gamemodeEventSourceService.ts | diagnostic logs ใช้อยู่จากรอบแก้แชต ไม่ใช่ระบบ RP เพิ่ม; cleanup ต้องเป็นงานเฉพาะ ไม่ทำในการสำรวจนี้ |

ข้อจำกัด: `rpChatInboxV1` เป็น owner-visible native property จึงอาจอยู่ใน world save เป็นข้อความล่าสุดแบบ bounded; ไม่ใช่ durable chat archive/audit database. `/whoami` เปิดเฉพาะ RP name ไม่ได้เปิดข้อมูล account/profile/GUID ให้ผู้เล่น

## สิ่งที่มี source แต่ห้ามนับเป็นระบบ RP พร้อมใช้

| สิ่งที่พบ | สถานะจริง | ผลต่อการวางแผน |
| --- | --- | --- |
| NPC/Papyrus/world simulation | engine มีแล้ว แต่ local `npcEnabled=false` | อย่าวางแผนงาน NPC/ร้าน/quest โดยสมมติว่ามี NPC ออนไลน์อยู่ หรือสั่งสร้าง NPC engine ใหม่ |
| MongoDB/zip/migration drivers | `database_drivers/DatabaseFactory.cpp` มีทางเลือก; ใช้ file จริง | driver ไม่ใช่ wallet/ledger/transaction schema; ไม่สั่งติดตั้ง Mongo/SQL โดยไม่มีความต้องการ |
| Gold item | native inventory รองรับไอเทม Skyrim รวมทอง | ไม่เท่ากับ bank, accounts, prices, trade atomicity, economy ledger |
| SweetTaffy/SweetPie perks/skill UI | services ถูก instantiate; บางเส้นทางมี `hasSweetPie()` gate ตรวจ plugin | registered ไม่เท่ากับ enabled; ยังไม่รับรอง modpack gate ทุกตัวหรือ skill/jobs RP ที่พร้อมใช้ |
| XP/fast travel/difficulty behavior | disableSkillAdvanceService, disableFastTravelService, disableDifficultySelectionService ถูก register; ปิด XP/fast travel และกำหนด difficulty ใน source | vanilla progression ไม่ควรสมมติว่าทำงานตามปกติ; ตรวจ policy ก่อนเพิ่มระบบ skill ของเรา |
| Master/Discord/auth/ban wrappers | upstream TS systems ถูกใส่ใน wrapper แต่หลายเส้นทางขึ้นกับ config/services | offline login pass ไม่ใช่ production auth/Discord/admin roles pass |
| Mod manifest/load-order verification | source + installed client มีแล้ว; เคยมี mod-count warning | reuse ตรวจ manifest ก่อน; ไม่เท่ากับ launcher, patcher, updater/download manager |
| External RP research repos | audit Phase2.0 มีเอกสาร reuse/license แล้ว; runtime ไม่ได้โหลด source เหล่านั้น | jobs/housing/economy ที่อยู่ใน research ไม่ใช่ installed features ของเรา |

## ส่วนที่ยังไม่มี domain implementation ใน custom gamemode ปัจจุบัน

ไม่พบ module ที่ลงทะเบียนใน `rp-gamemode/src/runtime.ts` สำหรับ wallet/bank/economy ledger, jobs/paychecks, player trading/escrow, housing ownership/rent/permissions, faction/police/medical rules, business/shop pricing, custom RP recipe/progression, multi-character selector, RP admin UI หรือ launcher/modpack updater. นี่คือ RP GAP แม้ engine primitives บางอย่างรองรับการต่อยอดแล้ว ส่วน profile editor/Character Sheet มีและผ่าน solo acceptance แล้วใน Phase2.3

ไม่ต้องทำทั้งหมดพร้อมกัน และการยังไม่มี domain module ไม่ใช่เหตุผลให้เปลี่ยน native inventory/character/world engine

## กติกาวาง Phase และลดการทดสอบซ้ำ

1. ก่อนเสนอ feature ระบุ **existing primitive → RP gap → minimal addition** พร้อม source path ห้ามใช้เพียง “ยังไม่ทดสอบ” เป็นหลักฐานว่าต้องสร้างใหม่
2. Baseline ที่ผู้ใช้ยืนยันผ่านแล้วให้เป็น baseline ไม่ใช่ mandatory full regression ในทุก Phase; ทดสอบซ้ำเมื่อแก้เส้นทางนั้น เปลี่ยน engine/runtime/modpack/storage/config ที่เกี่ยวข้อง หรือพบอาการใหม่
3. Pure documentation/planning ไม่ต้อง build/CTest/restart/gameplay. เพิ่ม UI/commands ให้ตรวจเฉพาะ input, result, close/focus และ handler duplication; ไม่บังคับทดสอบ crafting/death/combat ทั้งหมด
4. เขียน RP private metadata เพิ่ม: ตรวจ schema + actor mapping + restart retention เฉพาะ metadata ใหม่ และ native state ที่อาจได้รับผล ไม่รื้อ char/inventory save
5. แตะ item/economy: ตรวจ native counts, exactly-once/double-submit, failure/rollback และ reconnect/restart ของ transaction นั้น; นี่คือ feature acceptance ไม่ใช่ตรวจทุกระบบเกม
6. ประกาศ cross-player feature pass ต้องสอง real clients. Solo development ทำระบบถัดไปที่อิสระได้ โดยเก็บ proximity/combat/cell tests ไว้ gate ก่อนเปิดใช้หลายผู้เล่น ไม่ต้องปลอม pass และไม่ต้องหยุดทุกงานเพื่อรอคนที่สอง
7. Reuse tests เดิมตาม change impact; CTest integrations มี fixture world/config mutation ตาม workflow ห้ามรันกับ live world เป็น default regression
8. รายงานสถานะทุก slice เป็น implemented/registered/enabled/automated/solo/multiplayer แยกกัน ระบุ evidence และ pending ที่เกี่ยวข้องเท่านั้น

## ขอบเขต Phase ถัดไปที่เล็กที่สุด

คำแนะนำการวางแผน ไม่ใช่การอนุมัติ implementation: ใช้ Phase2.2/2.3 solo acceptance ที่ยืนยันแล้วเป็น baseline แล้วเลือก **RP domain เพียงหนึ่งอย่างที่ต้องการจริง** ใช้ module registry/identity/profile/commands/private metadata/UI เดิม เช่นกติกางานหนึ่งงานก่อนทำ framework อาชีพทั้งหมด ไม่สร้าง profile editor ซ้ำหรือย้อนทดสอบทุกระบบ

ถ้าจะเริ่ม economy ต้องเลือก currency authority ก่อน (native gold หรือบัญชี metadata ที่แยกความหมายชัดเจน) แล้วกำหนด transaction correctness; อย่าสร้าง balance อีกชุดที่นับทองเดียวกับ native inventory. ถ้าจะเริ่ม crafting ให้ทดลอง workstation native เฉพาะที่จะใช้ก่อนเพิ่ม recipes/permissions ไม่สร้างระบบรับส่ง inventory ใหม่

Phase2.3 และ Phase2.4 solo acceptance ผ่านแล้ว ยังไม่เริ่ม Phase2.5 และไม่ commit. การอัปเดต report นี้เปลี่ยนเฉพาะเอกสารเพื่อให้วางแผนจากสิ่งที่มีจริงและตรวจเฉพาะความเสี่ยงของงานใหม่
