import {SkyMpAdapter} from '../../engine/adapter';
import {nativeMp} from '../../engine/mp-api';
import {EventRouter} from '../../core/event-router';
import {ModuleDefinition} from '../../core/module-registry';
import {Logger,Scheduler} from '../identity/identity-module';
import {mapDiscoverySources} from '../../client/map-discovery';
import {mapMarkers} from '../../config/map-markers';
import {MapDiscoveryService,MAP_DISCOVERY_EVENT,MAP_DISCOVERY_PROPERTY,MAP_DISCOVERY_INBOX} from './map-discovery-service';

/** Independent of chat/Courier. Native definitions live for the process; all
 * module-owned event callbacks become inert during shutdown. */
export function mapDiscoveryModule(raw:unknown,adapter:SkyMpAdapter,events:EventRouter,scheduler:Scheduler,logger:Logger):ModuleDefinition {
 return{id:'rp-map-discovery',dependencies:['rp-identity'],initialize(scope){
  const mp=nativeMp(raw);if(!mp.makeProperty||!mp.makeEventSource)throw Error('Native map discovery transport unavailable');
  const service=new MapDiscoveryService(raw,adapter,mapMarkers),sources=mapDiscoverySources();
  if(sources.event.length>24*1024||sources.owner.length>2048)throw Error('Map discovery transport exceeds source budget');
  scope.defer(()=>service.clear());
  scope.defer(events.register(MAP_DISCOVERY_EVENT,(sender,packet,...extra)=>{if(!extra.length&&service.receive(sender,packet)&&packet&&typeof packet==='object'&&(packet as {kind?:unknown}).kind==='discover')logger.info('[rp-map] validated discovery persisted actor='+String(sender));}));
  // Registration is required both for native set/get and snapshot privacy.
  mp.makeProperty(MAP_DISCOVERY_PROPERTY,{isVisibleByOwner:true,isVisibleByNeighbors:false,updateOwner:'',updateNeighbor:''});
  mp.makeProperty(MAP_DISCOVERY_INBOX,{isVisibleByOwner:true,isVisibleByNeighbors:false,updateOwner:sources.owner,updateNeighbor:''});
  mp.makeEventSource(MAP_DISCOVERY_EVENT,sources.event);
  scope.defer(scheduler.every(1000,()=>{try{service.sync();}catch{logger.error('[rp-map] session observation failed');}}));
  const emitter=raw as{on?:(event:string,callback:(user:unknown)=>void)=>unknown};
  if(typeof emitter.on==='function'){let active=true;const observe=(user:unknown)=>{if(active)service.connectionEvent(user);};emitter.on('connect',observe);emitter.on('disconnect',observe);scope.defer(()=>{active=false;});}
  logger.info('[rp-map] native map discovery transport registered');
 }};
}
