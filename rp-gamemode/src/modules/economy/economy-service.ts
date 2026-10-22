import {createHash,randomUUID} from 'node:crypto';
import {CommandResult} from '../../core/command-registry';
import {SkyMpAdapter} from '../../engine/adapter';
import {ActorId} from '../../engine/ids';
import {EconomyConfig,economySettings} from '../../config/economy';
import {CourierProgressionConfig,courierRank,progressionSettings,MAX_COURIER_XP} from '../../config/courier-progression';
import {CourierService} from '../courier/courier-service';
import {cellKey,CourierRoute} from '../courier/contracts';
import {emptyCourierState,CourierState} from '../courier/state';
import type {CourierWaypoint} from '../chat/contracts';
import {EconomyJournal} from './journal';
import {EconomyState,LegacyEconomyState,economyState} from './state';
import {questDetails} from '../courier/quest-details';
export interface EconomyOptions {storageRoot:string;config?:Partial<EconomyConfig>;progression?:CourierProgressionConfig;now?:()=>number;fault?:(point:string)=>void;log?:(message:string)=>void;}
const fail=(message:string):CommandResult=>({ok:false,code:'ECONOMY_UNAVAILABLE',message:'[RP] '+message});
const success=(message:string):CommandResult=>({ok:true,data:{systemMessage:'[RP] '+message}});
export class EconomyService {
 private readonly journal:EconomyJournal;private readonly config:EconomyConfig;private readonly progression:CourierProgressionConfig;private readonly now:()=>number;private readonly busy=new Set<string>();
 private readonly navigationCache=new Map<string,{guid:string;mirror:string;state:EconomyState|null;blocked:boolean}>();
 constructor(private readonly adapter:SkyMpAdapter,private readonly courier:CourierService,private readonly options:EconomyOptions){this.config=economySettings(options.config);this.progression=progressionSettings(options.progression);this.now=options.now??Date.now;this.journal=new EconomyJournal(options.storageRoot,options.fault);for(const r of courier.routes())if(r.requiredPermit&&!this.progression.permits.some(p=>p.id===r.requiredPermit))throw Error('Route references unknown permit');}
 private identity(actor:ActorId){const session=this.adapter.sessionForActor(actor);return{session,key:createHash('sha256').update(session.profileId+'\n'+cellKey(this.adapter.describe(actor))).digest('hex')};}
 private reward(level:number,route?:CourierRoute|null){const value=(route?.reward??this.config.baseReward)+level*this.config.rewardPerLevel;if(!Number.isSafeInteger(value)||value<1||value>this.config.maximumBalance)throw Error('Invalid reward');return value;}
 private upgrade(state:EconomyState|LegacyEconomyState):EconomyState {
  if(state.schemaVersion===2)return state;
  const route=this.courier.route(state.courier.activeContractId);
  return {...state,schemaVersion:2,progression:{xp:0,permits:[],lastDelivery:null},activeJob:state.activeJob?{...state.activeJob,acceptedAt:0,xpReward:route?.xpReward??0,contract:route?structuredClone(route):null}:null};
 }
 private remember(actor:ActorId,key:string,state:EconomyState){this.navigationCache.set(key,{guid:this.adapter.sessionForActor(actor).guid,mirror:JSON.stringify(state.courier),state:structuredClone(state),blocked:false});if(this.navigationCache.size>512)this.navigationCache.delete(this.navigationCache.keys().next().value!);}
 private load(actor:ActorId,key:string):EconomyState {
  let raw=this.journal.read(key),fresh=false;
  if(raw===null){const courier=this.adapter.readCourier(actor)??emptyCourierState(),id='1:'+randomUUID();raw={schemaVersion:1,identity:key,revision:1,balance:0,satchelLevel:0,courier,activeJob:courier.lifecycle==='active'?{id,reward:this.reward(0)}:null,lastMutationAt:0,lastTransaction:{id,kind:'migration',jobId:null}};fresh=true;}
  const stored=economyState(raw,key);let state=this.upgrade(stored);
  if(state.balance>this.config.maximumBalance||state.satchelLevel>this.config.upgradeCosts.length)throw Error('Saved economy exceeds configured limits; preserved');
  const restored=state.activeJob&&!state.activeJob.contract?this.courier.route(state.courier.activeContractId):null;
  if(restored)state={...state,activeJob:{...state.activeJob!,contract:structuredClone(restored),xpReward:restored.xpReward}};
  if(stored.schemaVersion===1||restored){
   if(!fresh)state={...state,revision:state.revision+1,lastTransaction:{id:(state.revision+1)+':'+randomUUID(),kind:'migration',jobId:state.activeJob?.id??null}};
   const checked=economyState(state,key);if(checked.schemaVersion!==2)throw Error('Migration schema');this.navigationCache.delete(key);this.journal.append(key,checked);
  }
  return state;
 }
 private mirror(actor:ActorId,state:EconomyState){const current=this.adapter.readCourier(actor);if(JSON.stringify(current)!==JSON.stringify(state.courier)){this.adapter.writeCourier(actor,state.courier);if(JSON.stringify(this.adapter.readCourier(actor))!==JSON.stringify(state.courier))throw Error('Courier mirror did not confirm');}}
 inspect(actor:ActorId):EconomyState {const {key}=this.identity(actor);if(this.busy.has(key))throw Error('Economy operation in progress');this.busy.add(key);try{const state=this.load(actor,key);this.mirror(actor,state);this.remember(actor,key,state);return structuredClone(state);}finally{this.busy.delete(key);}}
 /** First connection reads a checksum-validated snapshot only; ambient chat never migrates or fsyncs money. */
 navigation(actor:ActorId):CourierWaypoint|null {
  const {key,session}=this.identity(actor),native=this.adapter.readCourier(actor),mirror=JSON.stringify(native);if(this.busy.has(key))return null;
  let cached=this.navigationCache.get(key);
  if(!cached||cached.guid!==session.guid||cached.mirror!==mirror){
   try{const raw=this.journal.peek(key);cached={guid:session.guid,mirror,state:raw===null?null:this.upgrade(economyState(raw,key)),blocked:false};}catch{cached={guid:session.guid,mirror,state:null,blocked:true};}
   this.navigationCache.set(key,cached);if(this.navigationCache.size>512)this.navigationCache.delete(this.navigationCache.keys().next().value!);
  }
  if(cached.blocked)return null;
  return cached.state?this.courier.waypoint(actor,cached.state.courier,cached.state.activeJob?.id,cached.state.activeJob?.contract??null):this.courier.waypoint(actor,native??undefined);
 }
 commandHints():readonly string[]{return ['upgrades','upgrade satchel',...this.progression.permits.map(p=>'guild buy '+p.id)];}
 quest(actor:ActorId){const point=this.navigation(actor);if(!point)return null;const {key}=this.identity(actor),state=this.navigationCache.get(key)?.state;return questDetails(point,state?.activeJob?.reward??null,state?.activeJob?.xpReward??null);}
 private rank(state:EconomyState){return courierRank(state.progression.xp,this.progression);}
 private rankText(state:EconomyState){const rank=this.rank(state),next=this.progression.ranks[rank+1];return `แรงก์ ${this.progression.ranks[rank]!.name} | XP ${state.progression.xp}${next?' | ขั้นถัดไป '+next.name+' ที่ '+next.xp+' XP':' | ระดับสูงสุด'}`;}
 private statusText(actor:ActorId,state:EconomyState){
  const job=state.activeJob,route=job?.contract;let message=`ส่งสำเร็จ ${state.courier.completedDeliveries} งาน | ชื่อเสียง ${state.courier.reputation} | ${this.rankText(state)} | Satchel ${state.satchelLevel}`;
  if(!job)return 'ไม่มีสัญญาที่กำลังทำ | '+message+' | /job list';
  message=`สัญญา ${state.courier.activeContractId} | ${route?.displayName??'สัญญาเดิมที่ยังไม่มีพิกัด'} | ปลายทาง ${route?.delivery.label??'ยังยืนยันไม่ได้'} | รางวัล ${job.reward} RP / ${job.xpReward} XP\n`+message;
  if(route)try{const here=this.adapter.location(actor);if(cellKey(here.cell)===cellKey(route.delivery.cell)){const dx=route.delivery.pos[0]-here.pos[0],dy=route.delivery.pos[1]-here.pos[1],distance=Math.round(Math.hypot(dx,dy,route.delivery.pos[2]-here.pos[2])),directions=['ตะวันออก','ตะวันออกเฉียงเหนือ','เหนือ','ตะวันตกเฉียงเหนือ','ตะวันตก','ตะวันตกเฉียงใต้','ใต้','ตะวันออกเฉียงใต้'];message+='\nทิศ'+directions[(Math.round(Math.atan2(dy,dx)/(Math.PI/4))+8)%8]+' | ห่างประมาณ '+distance+' หน่วยโลก'+(distance>8192?' (เสาแสงจะปรากฏเมื่อเข้าใกล้)':'');}}catch{/* Status remains available while native location is loading. */}
  return message;
 }
 private restrictions(state:EconomyState,route:CourierRoute):string[]{const reasons:string[]=[];if(!route.enabled)reasons.push('ยังไม่เปิด');if(this.rank(state)<route.requiredRank)reasons.push('ต้องแรงก์ '+this.progression.ranks[route.requiredRank]!.name);if(route.requiredPermit&&!state.progression.permits.includes(route.requiredPermit))reasons.push('ต้องใบอนุญาต '+route.requiredPermit);return reasons;}
 execute(actor:ActorId,args:readonly string[],wallet=false):CommandResult {
  let key:string|undefined,ownsGuard=false;
  try{
   const identity=this.identity(actor);key=identity.key;if(this.busy.has(key))return fail('กำลังบันทึกรายการ กรุณารอสักครู่');this.busy.add(key);ownsGuard=true;
   const command=args[0]?.toLowerCase();
   const valid=wallet?args.length===0:args.length===0||(args.length===1&&['status','list','rank','guild','accept','deliver','cancel','abandon','upgrades','devpos'].includes(command!))||(args.length===2&&((command==='upgrade'&&args[1]?.toLowerCase()==='satchel')||command==='accept'))||(args.length===3&&command==='guild'&&args[1]?.toLowerCase()==='buy');
   if(!valid)return fail('ใช้ /job list | accept [routeId] | status | deliver | cancel | rank | guild | guild buy <permitId>');
   const state=this.load(actor,key);this.mirror(actor,state);this.remember(actor,key,state);
   if(wallet)return success(`ยอดเงิน RP: ${state.balance} RP (กระเป๋าเซิร์ฟเวอร์ ไม่ใช่ทอง Skyrim)`);
   if(command==='status')return success(this.statusText(actor,state));
   if(command==='upgrades')return success(`Satchel ระดับ ${state.satchelLevel}/${this.config.upgradeCosts.length} | ${state.satchelLevel===this.config.upgradeCosts.length?'ระดับสูงสุด':`ระดับถัดไป ${this.config.upgradeCosts[state.satchelLevel]} RP`} | +${this.config.rewardPerLevel} RP ต่องานที่รับใหม่ | /job upgrade satchel`);
   if(command==='rank'){
    const rank=this.rank(state),next=this.courier.routes().filter(r=>r.enabled&&(r.requiredRank>rank||(r.requiredPermit&&!state.progression.permits.includes(r.requiredPermit)))).sort((a,b)=>a.requiredRank-b.requiredRank)[0];
    return success(this.rankText(state)+(next?' | งานถัดไป '+next.id+' ('+this.restrictions(state,next).join(', ')+')':''));
   }
   if(command==='list')return success('สัญญา Courier (ราคาเป็น RP ไม่ใช่ทอง Skyrim)\n'+this.courier.routes().map(r=>{const locked=this.restrictions(state,r);return `${r.id}: ${r.displayName} | ${r.tier} | ${this.reward(state.satchelLevel,r)} RP / ${r.xpReward} XP | ${locked.length?'ล็อก: '+locked.join(', '):'รับได้'}`;}).join('\n'));
   if(command==='guild'&&args.length===1)return success('สมาชิกพื้นฐาน: ฟรีสำหรับทุกคน\n'+this.progression.permits.map(p=>`${p.id}: ${p.name} | ${p.price} RP | ต้องแรงก์ ${this.progression.ranks[p.requiredRank]!.name}${p.prerequisite?' และ '+p.prerequisite:''} | ${state.progression.permits.includes(p.id)?'เป็นเจ้าของแล้ว':'/job guild buy '+p.id}`).join('\n'));
   const at=this.now();if(!Number.isSafeInteger(at)||at<0)throw Error('Invalid economy clock');
   const commit=(next:EconomyState,kind:string,delta:number,jobId:string|null)=>{
    if(at-state.lastMutationAt<this.config.mutationIntervalMs)throw Error('Economic commands too fast');
    const current=this.identity(actor);if(current.key!==key||current.session.guid!==identity.session.guid)throw Error('Connection changed');
    next.revision=state.revision+1;next.lastMutationAt=at;next.lastTransaction={id:next.revision+':'+randomUUID(),kind,jobId};
    const checked=economyState(next,key!);if(checked.schemaVersion!==2||checked.balance>this.config.maximumBalance||checked.satchelLevel>this.config.upgradeCosts.length)throw Error('Economy configured limit');
    this.navigationCache.delete(key!);this.journal.append(key!,checked);this.mirror(actor,checked);this.remember(actor,key!,checked);this.options.log?.(`[rp-economy] committed kind=${kind} revision=${checked.revision} delta=${delta}`);
   };
   if(command==='guild'){
    const permit=this.progression.permits.find(p=>p.id===args[2]);if(!permit)return fail('ไม่พบใบอนุญาต ใช้ /job guild');
    if(state.progression.permits.includes(permit.id))return fail('ซื้อใบอนุญาตนี้แล้ว ไม่มีการหักเงินซ้ำ');
    if(this.rank(state)<permit.requiredRank||permit.prerequisite&&!state.progression.permits.includes(permit.prerequisite))return fail('แรงก์หรือใบอนุญาตก่อนหน้ายังไม่ครบ ใช้ /job rank และ /job guild');
    if(state.balance<permit.price)return fail(`เงิน RP ไม่พอ ต้องใช้ ${permit.price} RP (มี ${state.balance} RP)`);
    const next={...state,balance:state.balance-permit.price,progression:{...state.progression,permits:[...state.progression.permits,permit.id]}};commit(next,'guild-permit',-permit.price,null);return success(`ซื้อ${permit.name}แล้ว -${permit.price} RP | คงเหลือ ${next.balance} RP`);
   }
   if(command==='upgrade'){
    const price=this.config.upgradeCosts[state.satchelLevel];if(price===undefined)return fail('Satchel อยู่ระดับสูงสุดแล้ว');if(state.balance<price)return fail(`เงิน RP ไม่พอ ต้องใช้ ${price} RP (มี ${state.balance} RP)`);
    const next={...state,balance:state.balance-price,satchelLevel:state.satchelLevel+1};commit(next,'upgrade',-price,null);return success(`ซื้อ Satchel ระดับ ${next.satchelLevel} แล้ว -${price} RP | คงเหลือ ${next.balance} RP; โบนัสใช้กับงานที่รับใหม่`);
   }
   let route:CourierRoute|null=state.activeJob?.contract??null,delta=0,xp=0;
   if(command==='accept'){
    route=this.courier.route(args[1]);if(!route)return fail('ไม่พบเส้นทาง ใช้ /job list');
    const reasons=this.restrictions(state,route);if(reasons.length)return fail('รับงานไม่ได้: '+reasons.join(', '));
    const last=state.progression.lastDelivery;if(last?.routeId===route.id&&at-last.at<route.repeatCooldownMs)return fail('เพิ่งส่งเส้นทางนี้ กรุณารอ '+Math.ceil((route.repeatCooldownMs-(at-last.at))/1000)+' วินาที หรือเลือกงานอื่น');
   }
   if(command==='deliver'&&state.activeJob){if(!route)return fail('สัญญาเดิมยังไม่มีพิกัดที่ยืนยัน ใช้ /job status หรือ /job cancel');if(at-state.activeJob.acceptedAt<route.minimumTravelMs)return fail('ยังไม่ครบเวลาเดินทางขั้นต่ำของสัญญานี้');}
   const result=this.courier.execute(actor,args,{state:state.courier,...(state.courier.lifecycle==='active'||command==='accept'?{route}:{}),commit:(courier:CourierState)=>{
    const next:EconomyState={...state,courier};let jobId:string|null=null;
    if(command==='accept'){
     if(!route)throw Error('Missing selected route');next.activeJob={id:(state.revision+1)+':'+randomUUID(),reward:this.reward(state.satchelLevel,route),xpReward:route.xpReward,contract:structuredClone(route),acceptedAt:at};jobId=next.activeJob.id;
    }else if(command==='deliver'){
     if(!state.activeJob||state.courier.lifecycle!=='active')throw Error('Missing durable job instance');delta=state.activeJob.reward;xp=state.activeJob.xpReward;
     if(state.balance>this.config.maximumBalance-delta||state.progression.xp>MAX_COURIER_XP-xp)throw Error('Wallet or XP limit reached');jobId=state.activeJob.id;next.balance+=delta;next.progression={...state.progression,xp:state.progression.xp+xp,lastDelivery:{routeId:state.courier.activeContractId!,at}};next.activeJob=null;
    }else if(command==='abandon'||command==='cancel'){jobId=state.activeJob?.id??null;next.activeJob=null;}else throw Error('Unsupported financial mutation');
    commit(next,command==='cancel'?'abandon':command!,delta,jobId);
   }});
   if(result.ok){const data=result.data as {systemMessage:string};if(command==='deliver')data.systemMessage+=` | รับ ${delta} RP และ ${xp} Courier XP แล้ว | ${this.rankText({...state,progression:{...state.progression,xp:state.progression.xp+xp}})}`;if(command==='status'||command==='accept'){const quote=this.load(actor,key).activeJob;data.systemMessage+=` | รางวัล ${quote?.reward??this.reward(state.satchelLevel,this.courier.route())} RP / ${quote?.xpReward??0} XP | Satchel ${state.satchelLevel}`;}}
   return result;
  }catch{return fail('ระบบเงิน/การบันทึกยังไม่พร้อม หรือส่งคำสั่งเร็วเกินไป; รายการอาจบันทึกแล้ว ตรวจ /wallet และ /job status ก่อนลองใหม่ ไม่มีการรีเซ็ตยอดเงิน');}
  finally{if(key&&ownsGuard)this.busy.delete(key);}
 }
 close(){this.navigationCache.clear();this.journal.close();}
}
