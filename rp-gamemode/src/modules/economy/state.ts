import {CourierState,courierState} from '../courier/state';
import {CourierRoute,courierRoute} from '../courier/contracts';
import {MAX_COURIER_XP} from '../../config/courier-progression';
export interface LegacyEconomyState {schemaVersion:1;identity:string;revision:number;balance:number;satchelLevel:number;courier:CourierState;activeJob:{id:string;reward:number}|null;lastMutationAt:number;lastTransaction:{id:string;kind:string;jobId:string|null};}
export interface CourierProgression {xp:number;permits:string[];lastDelivery:{routeId:string;at:number}|null;}
export interface EconomyState extends Omit<LegacyEconomyState,'schemaVersion'|'activeJob'> {schemaVersion:2;progression:CourierProgression;activeJob:{id:string;reward:number;xpReward:number;acceptedAt:number;contract:CourierRoute|null}|null;}
const keys=(v:Record<string,unknown>,names:string[])=>Object.keys(v).sort().join(',')===[...names].sort().join(',');
const int=(v:unknown,max:number)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=max;
export function economyState(raw:unknown,identity:string):EconomyState|LegacyEconomyState {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid economy state');const s=raw as Record<string,unknown>;
 const names=['schemaVersion','identity','revision','balance','satchelLevel','courier','activeJob','lastMutationAt','lastTransaction'];
 if(s.schemaVersion===2)names.push('progression');
 if(!keys(s,names)||![1,2].includes(s.schemaVersion as number)||s.identity!==identity||!int(s.revision,1000000000)||s.revision===0||!int(s.balance,1000000000)||!int(s.satchelLevel,10)||!int(s.lastMutationAt,Number.MAX_SAFE_INTEGER))throw Error('Unsupported or corrupt economy state');
 const courier=courierState(s.courier),job=s.activeJob as EconomyState['activeJob'],txn=s.lastTransaction as EconomyState['lastTransaction'];
 const instance=(v:unknown)=>typeof v==='string'&&/^\d+:[a-f0-9-]{36}$/.test(v);
 if(!txn||!keys(txn as unknown as Record<string,unknown>,['id','kind','jobId'])||!instance(txn.id)||!['migration','accept','deliver','abandon','upgrade',...(s.schemaVersion===2?['guild-permit']:[])].includes(txn.kind)||(txn.jobId!==null&&!instance(txn.jobId)))throw Error('Invalid economy transaction');
 if(courier.lifecycle==='active'){
  if(!job||!keys(job as unknown as Record<string,unknown>,s.schemaVersion===1?['id','reward']:['id','reward','xpReward','acceptedAt','contract'])||!instance(job.id)||!int(job.reward,1000000000)||job.reward===0)throw Error('Active Courier lacks a valid quoted job instance');
  if(s.schemaVersion===2){
   if(!int(job.xpReward,1000000)||!int(job.acceptedAt,Number.MAX_SAFE_INTEGER))throw Error('Invalid Courier XP quote');
   if(job.contract!==null){const contract=courierRoute(job.contract);if(contract.id!==courier.activeContractId||contract.xpReward!==job.xpReward||!keys(job.contract as unknown as Record<string,unknown>,Object.keys(contract)))throw Error('Invalid accepted contract snapshot');}
  }
 }else if(job!==null)throw Error('Idle Courier has an active quote');
 if(s.schemaVersion===2){
  const p=s.progression as CourierProgression;
  if(!p||!keys(p as unknown as Record<string,unknown>,['xp','permits','lastDelivery'])||!int(p.xp,MAX_COURIER_XP)||!Array.isArray(p.permits)||p.permits.length>16||new Set(p.permits).size!==p.permits.length||p.permits.some(id=>typeof id!=='string'||!/^[a-z][a-z0-9-]{0,31}$/.test(id)))throw Error('Invalid Courier progression');
  if(p.lastDelivery!==null&&(!p.lastDelivery||!keys(p.lastDelivery as unknown as Record<string,unknown>,['routeId','at'])||typeof p.lastDelivery.routeId!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(p.lastDelivery.routeId)||!int(p.lastDelivery.at,Number.MAX_SAFE_INTEGER)))throw Error('Invalid Courier completion history');
 }
 return structuredClone({...s,courier}) as unknown as EconomyState|LegacyEconomyState;
}
