# บริบทสำหรับส่งให้ ChatGPT วางแผน Skyrim RP

อัปเดต 2026-10-14; แนบเอกสารนี้พร้อม [SYSTEM_CAPABILITY_REPORT.md](SYSTEM_CAPABILITY_REPORT.md) แทนการส่ง report เก่าที่มี pending checkpoints เพียงอย่างเดียว

## สถานะที่ต้องใช้เป็นฐาน

- Phase2.4 `/roll` และ `/try` implemented + SOLO MANUAL PASS ครบตามผู้ใช้ยืนยัน 2026-10-14: server crypto RNG, D20/D6/D100, DC11, Thai/current RP name, invalid inputs, throttle, commands/profile/focus เดิม และไม่มีผลต่อ inventory/equipment/attributes/world. ใช้ registry/chat/identity/local routing เดิม ไม่มี dice UI/database ใหม่; two-player และ automated output ยังไม่ยืนยัน ดู [PHASE24](../../rp-gamemode/PHASE24.md). อย่าสร้างระบบนี้ซ้ำ
- SkyMP `develop`, HEAD `5397cd3bf4666c942f78193107881d8cf0ac2748`, engine parent `2849e676fe008925384b26f34476e382a30bd877`; RP/diagnostic changes ยังอยู่ใน working tree ไม่ได้ commit ทั้งหมด
- Skyrim 1.6.1170 + SKSE 2.2.6, server Node/native addon ใช้ file world `rp-world`, localhost, offline profile, max5, NPC ปิด
- มี native login/session/profile, character creation/spawn/re-entry, inventory/item counts, equipment/appearance, position/cell, world persistence และ reconnect transport แล้ว อย่าสร้างซ้ำ
- ผู้ใช้ยืนยัน solo character/inventory/equipment/position/reconnect/server-restart persistence และ Phase2.1 regression ผ่านแล้ว ใช้เป็น baseline; ไม่ต้องกลับไปวาง Phase1 ใหม่
- Core movement/animation/combat/death/container/crafting มี source/registered primitives แต่ cross-player gameplay ยังไม่ verified; **ยังไม่ verified ไม่ได้แปลว่ายังไม่ implemented**
- RP foundation มี typed adapter/IDs, module lifecycle, command registry, owned event router, private schema1 identity metadata และ versioned build/deploy/rollback แล้ว
- RP chat UI ส่งถึง server และตอบกลับในเกมจริงแล้ว: normal self-echo, Thai text, `/whoami`, `/me`, `/do` SOLO PASS พร้อม screenshot/logs. ใช้ UI/commands/transport เดิม
- ผู้ใช้ยืนยัน final Phase2.2 solo checks ครบ และ Phase2.3 checks1–5 ผ่าน: Character Sheet แก้ชื่อ/biography ไทยและ Save, reopen/Cancel/ชื่อว่าง, Escape/F7, reconnect/server-restart persistence, commands เดิมและ character/items. ใช้ profile UI/validation/private schema1 metadata เดิม ไม่ต้องสร้าง profile system ใหม่
- `/profile`, `/setrpname`, `/setbio`, `/setbio --clear` มี source ใช้ identity/commands/owner transport เดียวกัน; การทดสอบคำสั่งแก้ข้อมูลโดยตรงแต่ละคำสั่งยังไม่ได้รายงานแยก ไม่มี automated output/count ใหม่ให้ยืนยัน
- Local chat same-cell +2000 units, throttling/limits/dedup/safe rendering มี source; proximity ยังไม่สองคน ทดสอบเพิ่มตามผลกระทบของงานใหม่ ไม่ย้อนทดสอบทุกระบบ
- CTest 12/12 และ Phase2.1 tests67/67 เป็นผลเดิมที่บันทึกไว้ ไม่ใช่ผล rerun ล่าสุดหรือจำนวน tests ของ Phase2.2. ยังไม่มี output/count tests ปัจจุบันให้ยืนยัน
- NPC ปิด, optional full gamemode/frontend build OFF, SweetPie features บางส่วน gated, native XP/fast travel restrictions มีใน client. อย่าสมมติว่า Skyrim single-player systems ทุกตัวทำงานเหมือน vanilla
- Gold/inventory/container/crafting primitives ไม่ใช่ economy ledger/player trade/jobs/housing ที่เสร็จแล้ว; custom RP module เหล่านี้ยังไม่มี

## คำขอสำหรับการวางแผน

ช่วยวางแผน Phase ถัดไปเป็น slice เล็กโดยใช้ข้อมูลนี้เป็นฐาน ก่อนเสนอ implementation ให้แสดงตาราง:

| ความต้องการ | สิ่งที่มีอยู่ + source path | RP gap ที่ต้องเพิ่ม | reuse/extend/new | acceptance เฉพาะ change | สิ่งที่ยังต้องทดสอบสองคน |
| --- | --- | --- | --- | --- | --- |

ข้อกำหนด:

1. Reuse native actor/inventory/equipment/position/persistence; ไม่ทำ authority/save/protocol ซ้ำ
2. Reuse custom module/command/identity/UI/event transport; client custom event ต้องขึ้นต้น `_`, Skyrim Platform export คือ `Ui`, storage missing key อาจเป็น callable placeholder, browser focus เปิด Cursor Menu
3. อย่าเสนอติดตั้ง SQL/Mongo, เปลี่ยน engine หรือเพิ่ม framework โดยไม่มีข้อกำหนดที่ native/private metadata เดิมทำไม่ได้ และอธิบาย tradeoff ก่อน
4. แยก source, registered, configured, automated, solo และ multiplayer verified; ไม่อ้าง README หรือ research repo ว่า feature ถูก install แล้ว
5. อย่าสั่งผู้ใช้ทดสอบทุกระบบทุก Phase. จำกัด tests ตามสิ่งที่แก้/feature acceptance; baseline ที่ผ่านแล้วทดสอบซ้ำเมื่อมีผลกระทบหรืออาการใหม่
6. งาน UI/chat ไม่บังคับ combat/crafting/death regression ทั้งเกม. งาน metadata ตรวจ metadata/schema/session/restart ที่เกี่ยวข้อง. งาน item/economy ตรวจ count/atomicity/duplicates/failure ของ transaction ที่เพิ่ม
7. Solo development ไม่ต้องรอผู้เล่นสองคนสำหรับงานอิสระ แต่ต้องเก็บ real two-client gate ไว้ก่อนรับรอง proximity/shared interaction/combat และก่อนเปิดเซิร์ฟหลายผู้เล่น
8. ไม่แตะ live world, game files, DLL หรือทำ commit โดยอัตโนมัติ. แยก planning ออกจาก implementation; Phase2.3 และ Phase2.4 solo acceptance ผ่านแล้ว ยังไม่เริ่ม Phase2.5 จนผู้ใช้เลือก scope

อย่าเสนอ roadmap ที่ทำครบ economy/jobs/housing/admin/launcher พร้อมกัน ให้เสนอหนึ่ง feature ที่เล็กและเห็นผล โดยบอกว่าส่วนไหนเป็นกติกา RP เพิ่มบนฐานเดิม
