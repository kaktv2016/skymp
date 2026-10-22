export const MAX_COURIER_XP=1000000000;
export interface CourierRank {name:string;xp:number;}
export interface GuildPermit {id:string;name:string;price:number;requiredRank:number;prerequisite:string|null;}
export interface CourierProgressionConfig {ranks:readonly CourierRank[];permits:readonly GuildPermit[];}
export const courierProgressionConfig:CourierProgressionConfig={
 ranks:[{name:'ผู้ส่งฝึกหัด (Novice)',xp:0},{name:'ผู้ส่งขั้นต้น (Apprentice)',xp:30},{name:'ผู้ส่งชำนาญ (Experienced)',xp:90},{name:'ผู้ส่งอาวุโส (Senior)',xp:180},{name:'ผู้ส่งเชี่ยวชาญ (Master)',xp:300}],
 permits:[{id:'regional',name:'ใบอนุญาตส่งข้ามชุมชน',price:100,requiredRank:1,prerequisite:null},{id:'long-distance',name:'ใบอนุญาตส่งทางไกล',price:250,requiredRank:2,prerequisite:'regional'}]
};
export function progressionSettings(input:CourierProgressionConfig=courierProgressionConfig):CourierProgressionConfig {
 const c=structuredClone(input);
 if(c.ranks.length!==5||c.ranks[0]?.xp!==0||c.ranks.some((r,i)=>typeof r.name!=='string'||!r.name.trim()||!Number.isSafeInteger(r.xp)||r.xp<0||r.xp>MAX_COURIER_XP||(i>0&&r.xp<=c.ranks[i-1]!.xp)))throw Error('Invalid Courier ranks');
 if(c.permits.length>16||new Set(c.permits.map(p=>p.id)).size!==c.permits.length||c.permits.some(p=>!/^([a-z][a-z0-9-]{0,31})$/.test(p.id)||!p.name.trim()||!Number.isSafeInteger(p.price)||p.price<1||p.price>1000000000||!Number.isSafeInteger(p.requiredRank)||p.requiredRank<0||p.requiredRank>=c.ranks.length||(p.prerequisite!==null&&!c.permits.some(q=>q.id===p.prerequisite))))throw Error('Invalid Courier permits');
 for(const permit of c.permits){const seen=new Set<string>();let p:GuildPermit|undefined=permit;while(p){if(seen.has(p.id))throw Error('Cyclic permit prerequisites');seen.add(p.id);p=c.permits.find(q=>q.id===p!.prerequisite);}}
 return c;
}
export function courierRank(xp:number,c:CourierProgressionConfig):number {if(!Number.isSafeInteger(xp)||xp<0||xp>MAX_COURIER_XP)throw Error('Invalid Courier XP');let rank=0;for(let i=1;i<c.ranks.length;i++)if(xp>=c.ranks[i]!.xp)rank=i;return rank;}
