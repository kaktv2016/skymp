# รายงานตรวจสอบ Frostveil Multi-Agent Orchestration

ตรวจเมื่อ 9 พฤศจิกายน 2026 ตามเวลาไทย งานนี้จำกัดที่การตั้งค่า Codex และการอ่านซอร์ส SkyMP ที่ `3b2ff1ac135f74886b978410e8e52d497eed1b58` และ Launcher ที่ `29641f25666cf492614374770f5ae1808b90ca2c` เป็น baseline ของการตรวจ ไม่ได้เริ่ม gameplay milestone หรือ deploy

## Host, trust และ config ที่มีผล

- Desktop `26.1103.4239.0`, CLI `0.167.0-alpha.3.2`, ลงชื่อเข้าด้วย ChatGPT แล้ว Workspace ของแชตนี้คือ `C:\Users\basba\OneDrive\Desktop\skyrim-rp` ส่วน canonical Git root คือ `C:\Users\basba\OneDrive\Desktop\skyrim-rp\skymp`
- ใช้ App Server `config/read` พร้อม `includeLayers: true` กับทั้งสอง path จากโปรเซสที่ใช้ config และบัญชีจริง ค่า origins ที่ path ของ SkyMP มาจาก project layer โดยไม่มี `disabledReason` รายการ trust ของ SkyMP มีอยู่แล้ว `config/read` ที่โฟลเดอร์แม่เห็น user/system layers และไม่ได้โหลด config จากโฟลเดอร์ลูก
- Fresh App Server thread ที่เริ่มจาก SkyMP โหลด `workspace-write` และ `on-request` โดยไม่มีการ override สิทธิ์ ค่า `configRequirements/read` เป็น `null` และไม่มี managed requirement จาก API นี้ แชตปัจจุบันยังมีข้อจำกัดจาก collaboration host แยกต่างหาก การอ่าน config ของแชตที่กำลังรันโดยตรงผ่าน `app-server proxy` เชื่อมต่อ control socket ไม่ได้บน Windows ด้วย error 10050 จึงอ้างผล API เฉพาะ path และ thread ที่ทดสอบ
- User layer ที่อ่านได้ใช้ `agents.enabled=true`, เพดาน 3, โมเดลเริ่มต้น `gpt-6-luna` และ reasoning `low` หลังแก้ไฟล์ ค่า SkyMP ที่ resolve ได้เป็น `agents.enabled=true`, เพดาน 3, `max_depth=1`, โมเดลเริ่มต้น `gpt-6-luna` และ reasoning `medium` ทุกค่านี้มาจาก `skymp/.codex/config.toml` ตาม origins ของ API

เอกสารการ resolve config, การตั้งค่า role และสิทธิ์ที่สืบทอดจาก parent อยู่ใน [OpenAI App Server](https://learn.chatgpt.com/docs/app-server), [Configuration Reference](https://learn.chatgpt.com/docs/config-file/config-reference) และ [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)

## โมเดลและ role definitions

| Agent name | Model | Reasoning |
|---|---|---|
| `frostveil_researcher` | `gpt-6-luna` | `low` |
| `frostveil_engineer` | `gpt-6.1-sol` | `high` |
| `frostveil_qa` | `gpt-6-luna` | `medium` |
| `frostveil_reviewer` | `gpt-6.1-sol` | `high` |

`model/list` ของบัญชีที่ลงชื่อเข้าใช้คืนทั้งสองโมเดลโดย `hidden=false` และคืนระดับ reasoning ที่กำหนดครบ CLI strict parser รับทั้งสามคู่ model/effort ที่ใช้ ตรวจ TOML ทั้งสี่ไฟล์กับ schema ของ custom agent และเทียบกับ baseline เพื่อยืนยันว่าชื่อ คำอธิบาย และ developer instructions เดิมตรงกัน รวมทั้งยืนยันว่า config โครงการเพิ่มเฉพาะค่า default สองค่า

## อินเทอร์เฟซ spawn และ lifecycle

### แชตปัจจุบัน

`collaboration.spawn_agent` รับ `task_name`, `message`, และตัวเลือก `fork_turns`, `model`, `reasoning_effort` ไม่มีตัวเลือก role ตามชื่อ จึงใช้ generic fallback พร้อมคำสั่งตามบทบาทและ model/effort ที่ขอ `list_agents` เห็น Main และ A อยู่ในสถานะ running ก่อนที่การเรียก B จะถูกปฏิเสธด้วย `agent thread limit reached` B เริ่มได้หลัง A จบ และ C เริ่มหลัง B จบ ข้อจำกัดจริงของ collaboration host ในแชตนี้คือหนึ่ง child พร้อม Main ทั้งสามช่วงเป็น sequential ตัว runtime ของแชตนี้รายงาน sandbox `danger-full-access` และ approval `never` ที่มีอยู่ก่อนงานนี้ การอ่านซอร์สของ agents ถูกจำกัดด้วยขอบเขตงานที่มอบหมาย และไม่มีการเปลี่ยน permission mode

| งาน | Agent handle | ผลที่ Main ได้รับ |
|---|---|---|
| A Runtime Identity v2 | `/root/identity_v2_a` | ตรวจ hash และ revision ของ spec, catalog/plugin/base binding, nonce ที่ใช้ครั้งเดียวและผูก session/principal, และ mapper arm/fault จาก `rp-gamemode/src/modules/npc/runtime-identity-spec.ts:8–39`, `rp-gamemode/src/modules/npc/development-identity.ts:89–105`, `rp-gamemode/src/runtime.ts:115–142` |
| B G2.4.5 Asset Importer | `/root/asset_import_b` | ตรวจ explicit owner-source review, allowlisted Data path, pinned masters และ asset closure, snapshot แบบ hash-addressed, one-use approval และการแยก `NOT_HOT_LOADED` ออกจาก runtime activation จาก `rp-gamemode/scripts/npc-assets.cjs:14–23`, `rp-gamemode/scripts/g245-assets.cjs:26–136`, `rp-gamemode/scripts/g246-onboarding.cjs:15–35` |
| C Launcher development profile | `/root/launcher_profile_c` | ตรวจ runtime/asset pins, local owner CLI, typed confirmation, authenticated journal และ `127.0.0.1:17777` ที่แยกจาก normal-play gate จาก Launcher `src/main/management/npc-development-policy.ts:1–79`, `src/main/management/npc-development.ts:13–90`, `scripts/npc-development.mjs:44`, `src/main/runtime/service.ts:24–42` |

A, B และ C ส่งผลพร้อมแหล่งอ้างอิงถึง Main และจบ turn ครบ หลักฐานเป็นการอ่านซอร์ส ไม่มีการเรียกใช้ game/runtime หรือแก้ไฟล์

### Fresh trusted SkyMP App Server

Parent `01a1bfde-287a-74e0-86cb-dbe20a4a889a` รายงานว่าอินเทอร์เฟซของตัวเองมี `agent_type` และเรียก role ตามชื่อ สามครั้งแรกติดข้อผิดพลาดอ่าน rollout ของ ephemeral parent และยังไม่ได้ child ID การเรียกใหม่แบบ isolated fork ตามรายงานของ parent ได้สาม child IDs ด้านล่าง เวลามาจาก `turn/started` และ `turn/completed` ที่บันทึกโดย client

| งาน | Child thread ID | เริ่ม → จบ เวลาไทย |
|---|---|---|
| A | `01a1bfde-92b1-78e0-b1b2-47fff5bee8e7` | 17:33:17.384 → 17:34:42.752 |
| B | `01a1bfde-a58c-7b61-ba01-143d254cd46f` | 17:33:22.209 → 17:34:53.374 |
| C | `01a1bfde-b87b-75f1-bfb1-3e9280270091` | 17:33:27.074 → 17:34:44.795 |

ช่วงที่ทั้งสาม turn ทำงานทับกันยาว **75.678 วินาที** ทั้งสาม turn จบและ parent รวบรวมผลได้ แต่การอ่านซอร์สล้มเหลวก่อน shell เริ่มด้วย `registered Core launch requires an installed app` จึงใช้ผลนี้ยืนยัน concurrency และ lifecycle เท่านั้น การอ่านซอร์สที่ยืนยันได้มาจากแชตปัจจุบันซึ่งรันทีละงาน

### หลักฐาน named role จาก runtime

ทดสอบ role ทั้งสี่อีกครั้งใน local parent `01a1bfe3-be7a-74a2-a21a-6d091233cc97` โดยใช้ named selector `agent_type` และ isolated fork โดยไม่ส่ง model หรือ reasoning override ผล `thread/read` ระหว่างที่ child ยัง active คืน `agentRole`, `model`, `reasoningEffort` และ parent ID ครบและตรงกับ TOML ทุกตัว

| Agent role ที่ runtime คืน | Child thread ID | Model / reasoning ที่ runtime คืน |
|---|---|---|
| `frostveil_researcher` | `01a1bfe3-d764-73d1-b4c9-22fa02cae7c8` | `gpt-6-luna` / `low` |
| `frostveil_engineer` | `01a1bfe3-e28c-70f1-8ccc-06365af3ad4a` | `gpt-6.1-sol` / `high` |
| `frostveil_qa` | `01a1bfe3-ee23-7951-8616-3fd9a7ca3983` | `gpt-6-luna` / `medium` |
| `frostveil_reviewer` | `01a1bfe3-f9d4-71f0-b7c0-a3c3d3a45845` | `gpt-6.1-sol` / `high` |

Parent รวบรวมคำตอบและจบ turn การทดสอบนี้ยืนยันการค้นพบและเรียก role ตามชื่อพร้อมค่า model จริงใน local host ส่วนงานอ่านซอร์สแบบขนานยังติดข้อจำกัดของ shell ตามผลรอบแรก

## สถานะการยอมรับ

| เงื่อนไข | ผล |
|---|---|
| PROJECT_TRUST | PASS สำหรับ canonical SkyMP root จาก config API |
| PROJECT_CONFIG_LOADED | PASS ใน fresh SkyMP App Server ที่เห็น project origins และสิทธิ์เดิม โฟลเดอร์แม่ของแชตนี้มีเฉพาะ user/system layers ในผล API |
| SUBAGENT_CONCURRENCY | PASS ที่สาม child turns บน fresh local parent แชตปัจจุบันจำกัดหนึ่ง child |
| CUSTOM_ROLE_DISCOVERY | PASS ใน fresh local App Server จากการตรวจ TOML ทั้งสี่ไฟล์และ role ที่ runtime คืน |
| NAMED_ROLE_DISPATCH | PASS ใน fresh local App Server สำหรับทั้งสี่ role จาก `thread/read` แชตปัจจุบัน UNAVAILABLE |
| GENERIC_ROLE_FALLBACK | PASS จากการอ่านซอร์ส A, B และ C ในแชตปัจจุบัน |
| PARALLEL_EXECUTION | PASS เฉพาะช่วง overlap ใน local lifecycle การอ่านซอร์สแบบขนาน end-to-end BLOCKED ที่ shell ของ standalone App Server |
| MAIN_AGENT_COORDINATION | PASS จากการรวบรวมผลอ่านซอร์สทั้งสาม และแยกรายงานตัวขวางของ local probe ออกจากผลจริง |

ผลรวมเป็น **ยืนยันได้บางส่วน** สาม child turns ทำงานซ้อนกันใน local probe และผลอ่านซอร์สครบจาก fallback แบบ sequential ยังไม่มีหลักฐานหนึ่งรอบที่ทำทั้งสาม source reviews สำเร็จพร้อมกัน

## Workflow checks และการดำเนินการต่อ

`scripts/ai/test-context-manager.ps1` exit 0 ผ่าน 31 checks และ `scripts/ai/test-workflow.ps1` exit 0 ครอบคลุม gate receipts และเคส fail-closed `codex debug prompt-input` พบ `AGENTS.md` และ Frostveil skills เดิมครบทั้งหกตัว ผลอยู่ใน `context-contract.log`, `workflow-contract.log` และ `skills-discovery.log` ภายใต้ `%TEMP%/frostveil-orchestration-7199cb6416004c0e8e375f1b556af8f3` หลักฐาน API และ lifecycle อยู่ใน `config-audit-standalone.json`, `role-validation.log`, `local-parallel-events.jsonl` และ `native-role-metadata.jsonl` ที่เดียวกัน

ใช้ [SOP](DEVELOPMENT_SOP.md), [Context Manager](CONTEXT_MANAGER.md) และ skills เดิม Main เป็นผู้กำหนดขอบเขต รวมผล ตรวจความปลอดภัย และดำเนินการ Git ใช้ generic fallback เมื่อ spawn ไม่มีตัวเลือก role รักษาขอบเขตไฟล์ให้แยกกันและให้ Main ดูแลการ deploy/push

ตอนนี้ SkyMP มี trust อยู่แล้ว หากต้องยืนยันบน Desktop ให้เปิดเซสชันใหม่โดยเลือก `C:\Users\basba\OneDrive\Desktop\skyrim-rp\skymp` เป็น workspace โดยตรง คง permission mode เดิม แล้วทดสอบ read-only dispatch ซ้ำ หาก Codex ขอ Trust ในอนาคต ให้เจ้าของตรวจ project config แล้วเลือก Trust เฉพาะโฟลเดอร์ canonical นี้ การตั้งค่า global, approvals, MCP, Launcher WIP และ deployed settings ตรวจเทียบกับ baseline ของงานนี้
