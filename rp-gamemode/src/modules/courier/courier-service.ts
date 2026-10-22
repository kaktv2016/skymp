import {beaconStyles} from './beacon-styles';
import { CommandResult } from '../../core/command-registry';
import { SkyMpAdapter } from '../../engine/adapter';
import { ActorId } from '../../engine/ids';
import { CourierSettings, CourierRoute, inZone } from './contracts';
import { CourierState, emptyCourierState, MAX_COURIER_PROGRESS } from './state';
import type {CourierWaypoint} from '../chat/contracts';

export class CourierService {
  constructor(private readonly adapter: SkyMpAdapter, private readonly settings: CourierSettings, private readonly isMockActive?: (actor: ActorId) => boolean) {}
  private previews=new Map<ActorId,{guid:string;style:string}>();
  previewEnabled():boolean{return this.settings.beaconPreview;}
  clearPreviews():void{this.previews.clear();}
  preview(actor:ActorId,args:readonly string[]):CommandResult {
    const fail=(message:string):CommandResult=>({ok:false,code:'PREVIEW_UNAVAILABLE',message:'[BEACON] '+message});
    if(!this.settings.beaconPreview)return fail('Development preview disabled');
    const session=this.adapter.sessionForActor(actor),command=args[0]?.toLowerCase()??'list';
    const usage='Usage: /beacon list | next | default | off | '+beaconStyles.map(s=>s.id).join(' | ');
    if(args.length>1)return fail(usage);
    if(command==='list')return {ok:true,data:{systemMessage:'[BEACON] '+beaconStyles.map(s=>s.id+': '+s.label).join(' / ')}};
    if(!this.waypoint(actor))return fail('Accept a Courier job first');
    const old=this.previews.get(actor),previous=old?.guid===session.guid?old.style:'amber';
    const next=command==='next'?beaconStyles[(beaconStyles.findIndex(s=>s.id===previous)+1)%beaconStyles.length]!.id:command==='default'?'amber':command;
    if(next!=='off'&&!beaconStyles.some(s=>s.id===next))return fail(usage);
    this.previews.set(actor,{guid:session.guid,style:next});
    return {ok:true,data:{systemMessage:'[BEACON] Preview: '+next+' (session only; /beacon next | default | off)'}};
  }
  routes():readonly CourierRoute[]{return this.settings.routes;}
  route(id?:string|null):CourierRoute|null{return id?this.settings.routes.find(r=>r.id===id)??null:this.settings.route;}
  commandHints():readonly string[]{return ['list','status','accept','deliver','abandon','cancel','rank','guild',...this.settings.routes.map(r=>'accept '+r.id),...(this.settings.devpos?['devpos']:[])];}
  waypoint(actor:ActorId,state?:CourierState,instance?:string,snapshot?:CourierRoute|null):CourierWaypoint|null {
    const session=this.adapter.sessionForActor(actor);
    const selected=this.previews.get(actor);if(selected&&selected.guid!==session.guid)this.previews.delete(actor);
    const style=this.previews.get(actor)?.style??'amber';
    const current=state??this.adapter.readCourier(actor),route=snapshot===undefined?this.route(current?.activeContractId):snapshot;
    return current?.lifecycle==='active' && route && current.activeContractId===route.id?{id:instance??route.id,cell:route.delivery.cell,pos:route.delivery.pos,label:route.delivery.label,style}:null;
  }

  execute(actor: ActorId, args: readonly string[], transaction?: {state:CourierState;route?:CourierRoute|null;commit:(next:CourierState)=>void}): CommandResult {
    const fail = (message: string): CommandResult => ({ ok: false, code: 'COURIER_UNAVAILABLE', message: '[JOB] ' + message });
    const success = (message: string): CommandResult => ({ ok: true, data: { systemMessage: '[JOB] ' + message } });
    try {
      const session = this.adapter.sessionForActor(actor);
      if (args.length > 2||(args.length===2&&args[0]?.toLowerCase()!=='accept')) return fail('ใช้ /job list | accept [routeId] | status | deliver | cancel');
      const command = args[0]?.toLowerCase();
      if (!command) return success('Courier: /job list | /job accept [routeId] | /job deliver | /job cancel | /job rank | /job guild');
      if (['accept', 'deliver'].includes(command) && this.isMockActive?.(actor)) {
        return fail('มีงานจำลอง Courier ค้างอยู่ กรุณาใช้ /admin courier clear ก่อนดำเนินการ / active mock job in progress; clear it first via /admin courier clear');
      }
      if (command === 'devpos') {
        if (!this.settings.devpos) return fail('devpos is disabled; enable development and devpos explicitly for local development only');
        const location = this.adapter.location(actor);
        return success(`Own server location: cell=${location.cell} pos=${JSON.stringify(location.pos)}`);
      }
      if (!['status','accept','deliver','abandon','cancel'].includes(command)) return fail('ใช้ /job list | accept [routeId] | status | deliver | cancel | rank | guild');
      const state = transaction?.state ?? this.adapter.readCourier(actor) ?? emptyCourierState();
      const route = transaction&&'route' in transaction?transaction.route:command==='accept'?this.route(args[1]):this.route(state.activeContractId);
      if (state.activeContractId !== null && (!route || state.activeContractId !== route.id)&&!(transaction&&['cancel','abandon'].includes(command))) return fail('สัญญานี้ไม่มีพิกัดที่ตรวจสอบได้ ข้อมูลยังอยู่ ใช้ /job cancel เพื่อยกเลิกโดยไม่รับรางวัล');
      if (command === 'status') return success(`Profession: Courier | State: ${state.lifecycle} | Contract: ${state.activeContractId ?? 'none'} | Objective: ${route ? (state.lifecycle === 'active' ? route.delivery.label : route.pickup.label) + ' (' + route.displayName + ')' : this.settings.routeError} | Completed: ${state.completedDeliveries} | Reputation: ${state.reputation}`);
      if (!route&&!['cancel','abandon'].includes(command)) return fail(this.settings.routeError||'ไม่พบเส้นทางที่ระบุ');
      let next: CourierState, message: string;
      if (command === 'accept') {
        if(!route?.enabled)return fail('เส้นทางนี้ยังไม่เปิดให้รับงาน');
        if(!transaction&&(route.requiredRank>0||route.requiredPermit))return fail('เส้นทางนี้ต้องใช้ระบบแรงก์และใบอนุญาตแบบถาวร');
        if (state.lifecycle === 'active') return fail('You already have an active Courier contract');
        if (!inZone(this.adapter.location(actor), route.pickup, route.radius)) return fail(`You must reach pickup: ${route.pickup.label}`);
        next = { ...state, lifecycle: 'active', activeContractId: route.id };
        message = `Courier contract accepted: ${route.displayName}. Deliver to ${route.delivery.label}`;
      } else if (command === 'deliver') {
        if(!route)return fail('ไม่พบข้อมูลปลายทางของสัญญา');
        if (state.lifecycle !== 'active') return fail('No active Courier contract');
        if (!inZone(this.adapter.location(actor), route.delivery, route.radius)) return fail(`You must reach delivery destination: ${route.delivery.label}`);
        if (state.completedDeliveries >= MAX_COURIER_PROGRESS || state.reputation > MAX_COURIER_PROGRESS - route.reputationReward) return fail('Courier progress limit reached; contract preserved');
        next = { ...state, lifecycle: 'idle', activeContractId: null, completedDeliveries: state.completedDeliveries + 1, reputation: state.reputation + route.reputationReward };
        message = `Delivery completed! +1 delivery, +${route.reputationReward} Courier Reputation. Total: ${next.completedDeliveries} deliveries / ${next.reputation} reputation`;
      } else {
        if (state.lifecycle !== 'active') return fail('No active Courier contract');
        next = { ...state, lifecycle: 'idle', activeContractId: null };
        message = 'Courier contract abandoned; no reward';
      }
      if (this.adapter.sessionForActor(actor).guid !== session.guid) return fail('Connection changed; check /job status');
      // Synchronous read/validate/single-property write. No separately granted reward.
      if(transaction)transaction.commit(next);
      else {
        this.adapter.writeCourier(actor, next);
        if (JSON.stringify(this.adapter.readCourier(actor)) !== JSON.stringify(next)) return fail('Courier state write was not confirmed; check /job status before retrying');
      }
      return success(message);
    } catch {
      return fail('Courier state/location/persistence unavailable; no automatic reset. A write may already have applied: check /job status before retrying');
    }
  }
}
