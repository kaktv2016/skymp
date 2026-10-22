import type {CourierOptions} from '../modules/courier/contracts';

// Frozen G1.1 pickup/delivery, radius and base payment; original owner devpos evidence.
const beginner={
 id:'courier-route-1',displayName:'จดหมายรอบหอคอย',
 pickup:{label:'จุดรับจดหมาย Rift Watchtower',cell:'3c:Skyrim.esm',pos:[122694.9453125,-66909.78125,11639.1201171875]},
 delivery:{label:'จุดส่งจดหมายเดิม',cell:'3c:Skyrim.esm',pos:[123342.421875,-65940.078125,11686.185546875]},
 radius:200,reputationReward:1,reward:25,xpReward:10,requiredRank:0,requiredPermit:null,tier:'local',enabled:true,minimumTravelMs:8000,repeatCooldownMs:15000
};
// Exact vanilla MapLanding REFR positions, Tamriel world 0x3c. Each XY lies on an
// exterior NAVM triangle 12-31 units below the landing point. No quest-lock,
// enable-parent, teleport, VMAD or initially-disabled/deleted flags on these refs.
// These are enabled for owner acceptance, NOT claimed traversal/gameplay tested.
// Provenance and cautions: docs/rp-development/FROSTVEIL_G1_3_GAMEPLAY_REPORT.md.
export const courierConfig:CourierOptions={development:false,devpos:false,route:beginner,routes:[
 beginner,
 { ...beginner,id:'sarethi-farm',displayName:'จดหมายถึงฟาร์ม Sarethi',delivery:{label:'Sarethi Farm — จุดลงแผนที่',cell:'3c:Skyrim.esm',pos:[113230.2109375,-70612.046875,11489.9326171875]},reward:35,xpReward:15,minimumTravelMs:30000,repeatCooldownMs:45000 }, // REFR a05ce / CELL 97d5 / NAVM 6f3ae tri595
 { ...beginner,id:'heartwood-mill',displayName:'เอกสารถึงโรงเลื่อย Heartwood',delivery:{label:'Heartwood Mill — จุดลงแผนที่',cell:'3c:Skyrim.esm',pos:[133492.171875,-95859.5546875,10712.95703125]},tier:'regional',reward:60,xpReward:25,requiredRank:1,requiredPermit:'regional',minimumTravelMs:60000,repeatCooldownMs:60000 }, // REFR a05d0 / CELL bcda / NAVM db482 tri403
 { ...beginner,id:'merryfair-farm',displayName:'พัสดุถึงฟาร์ม Merryfair',delivery:{label:'Merryfair Farm — จุดลงแผนที่',cell:'3c:Skyrim.esm',pos:[166696.125,-88590.9765625,11069.578125]},tier:'regional',reward:65,xpReward:30,requiredRank:1,requiredPermit:'regional',minimumTravelMs:75000,repeatCooldownMs:90000 }, // REFR a05cd / CELL bc90 / NAVM eea5a tri269
 { ...beginner,id:'shors-stone',displayName:'สารทางไกลถึง Shor’s Stone',delivery:{label:'Shor’s Stone — จุดลงแผนที่',cell:'3c:Skyrim.esm',pos:[163113.09375,-62752.30078125,7487.85791015625]},tier:'long-distance',reward:90,xpReward:40,requiredRank:2,requiredPermit:'long-distance',minimumTravelMs:90000,repeatCooldownMs:120000 } // REFR a05cc / CELL bbcb / NAVM 10822e tri29
]};
