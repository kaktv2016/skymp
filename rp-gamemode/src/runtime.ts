import {DialogueRuntime,DialogueStore} from './modules/dialogue/dialogue-runtime';
import {dialogueSources} from './client/dialogue';
import {courierProgressionConfig} from './config/courier-progression';
import {actorId} from './engine/ids';
import { CommandRegistry } from './core/command-registry';
import { ModuleRegistry } from './core/module-registry';
import { SkyMpAdapter } from './engine/adapter';
import { IdentityService } from './modules/identity/identity-service';
import { identityModule, Logger, Scheduler } from './modules/identity/identity-module';
import { EventRouter } from './core/event-router';
import { ChatConfig, chatConfig } from './modules/chat/contracts';
import { ChatService } from './modules/chat/chat-service';
import { chatModule } from './modules/chat/chat-module';
import type { ProfileLimits } from './modules/identity/profile-validation';
import { DiceRng, DiceService } from './modules/dice/dice-service';
import { DiceSettings, diceSettings, diceModule } from './modules/dice/dice-module';
import { CourierOptions, courierSettings } from './modules/courier/contracts';
import { CourierService } from './modules/courier/courier-service';
import { courierModule } from './modules/courier/courier-module';
import { courierConfig } from './config/courier';
import {EconomyService,EconomyOptions} from './modules/economy/economy-service';
import {AdminService,AdminOptions,adminHints} from './modules/admin/admin-service';
import {questDetails} from './modules/courier/quest-details';
import {mapDiscoveryModule} from './modules/map-discovery/map-discovery-module';
import {NpcService,npcHints} from './modules/npc/npc-service';
import path from 'node:path';
import {BlueprintStore} from './modules/dialogue/blueprint-store';
import {BlueprintService} from './modules/dialogue/blueprint-service';
import {EditorAuthority} from './modules/dialogue/editor-authority';
import {EditorHttpServer,loadEditorAssets} from './modules/dialogue/editor-http';

export interface RuntimeOptions { scheduler?: Scheduler; logger?: Logger; chat?: false | (Partial<ChatConfig> & { now?: () => number }); profile?:Partial<ProfileLimits>&{now?:()=>number}; dice?: Partial<DiceSettings> & { rng?: DiceRng }; courier?: CourierOptions; economy?:EconomyOptions;admin?:AdminOptions; npc?:{storageRoot:string}; blueprintEditor?:{storageRoot:string;assetsRoot:string;port?:number}; }
export function createRuntime(rawMp: unknown, options: RuntimeOptions = {}) {
  if(options.blueprintEditor&&(!options.npc||options.chat===false))throw Error('Blueprint editor requires NPC and chat modules');
  const adapter = new SkyMpAdapter(rawMp);
  const identity = new IdentityService(adapter,options.profile);
  const commands = new CommandRegistry();
  const events = new EventRouter(rawMp);
  const modules = new ModuleRegistry();
  const logger: Logger = options.logger ?? { info: message => console.log(message), error: message => console.error(message) };
  const scheduler: Scheduler = options.scheduler ?? {
    every(milliseconds, callback) {
      const timer = setInterval(callback, milliseconds);
      timer.unref();
      return () => clearInterval(timer);
    },
  };
  modules.register(identityModule(adapter, identity, commands, scheduler, logger,options.chat!==false));
  let chat: ChatService | undefined;
  let economy:EconomyService|undefined;
  const courierSettingsObj = courierSettings(options.courier ?? courierConfig);
  let admin: AdminService;
  const courier = new CourierService(adapter, courierSettingsObj, actor => admin.isMockActive(actor));
  if (options.economy) economy = new EconomyService(adapter, courier, { ...options.economy, log: options.economy.log ?? logger.info });

  admin = new AdminService(adapter, {
    ...options.admin,
    log: options.admin?.log ?? logger.info,
    sendSystemMessage: (actor, msg) => chat?.sendSystem(actor, msg),
    courierRoutes: courier.routes(),
    getActiveCourierJob: actor => {
      const state = adapter.readCourier(actor);
      if (!state || state.lifecycle !== 'active' || !state.activeContractId) return null;
      const r = courier.route(state.activeContractId);
      return r ? { route: r } : null;
    }
  });

  if (options.chat !== false) {
    const { now = Date.now, ...overrides } = options.chat ?? {};
    const config = chatConfig(overrides);
    chat = new ChatService(adapter, identity, commands, config, now);
    modules.register(chatModule(adapter, chat, commands, events, scheduler, logger, config));
    modules.register(mapDiscoveryModule(rawMp,adapter,events,scheduler,logger));
    const { rng, ...diceOverrides } = options.dice ?? {};
    modules.register(diceModule(adapter, identity, commands, new DiceService(rng), diceSettings(config.maxLength, diceOverrides)));
    // Snapshot-aware visual hint only. Never migrate, reconcile or fsync
    // financial state during ambient chat; command transactions do that explicitly.
    chat.setNavigation(actor => admin.mockNavigation(actor) ?? (economy ? economy.navigation(actor) : courier.waypoint(actor)));
    chat.setAdmin(actor => admin.state(actor), (actor, id, cell, pos) => admin.receiveClientAck(actor, id, cell, pos));
    chat.setQuest(actor => {
      const mock = admin.mockQuest(actor);
      if (mock) return mock;
      const state = admin.state(actor);
      if (state?.testNavigation) return { id: 'admin-navigation-test', targetKey: 'riften-interior-test-v1', title: 'Frostveil: Navigation Test', destination: 'The Bee and Barb, Riften (test only)', reward: null, xpReward: null, explicitDoors: state.explicitDoors };
      return economy ? economy.quest(actor) : questDetails(courier.waypoint(actor));
    });
    modules.register(courierModule(courier,commands,economy));
    if(options.npc){
      const npc=new NpcService(rawMp as ConstructorParameters<typeof NpcService>[0],adapter,options.npc.storageRoot,actor=>admin.state(actor)!==null,logger.info);
      modules.register({id:'rp-npc',dependencies:['rp-chat'],initialize:async(scope)=>{
        scope.defer(()=>npc.stop());npc.start();
        scope.defer(commands.register('npc',(ctx,args)=>npc.execute(ctx.actorId,args),'rp-npc',npcHints));
        scope.defer(scheduler.every(1000,()=>npc.prune()));
        const native=rawMp as any,sources=dialogueSources();
        const routes=courier.routes().map(r=>r.id),permits=courierProgressionConfig.permits.map(p=>p.id);
        const store=new DialogueStore(options.npc!.storageRoot+'-dialogues',routes,permits);
        scope.defer(()=>store.close());const graph=store.load();
        native.makeProperty('frostveilDialogue',{isVisibleByOwner:true,isVisibleByNeighbors:false,updateOwner:sources.owner,updateNeighbor:''});
        const blueprints=options.blueprintEditor?new BlueprintStore(options.blueprintEditor.storageRoot,routes,permits,graph):undefined;
        if(blueprints)scope.defer(()=>blueprints.close());
        const dialogue=new DialogueRuntime(adapter,graph,id=>npc.lookup(id),(a,args)=>economy?economy.execute(a,args):courier.execute(a,args),(a,value)=>native.set(a,'frostveilDialogue',value),Date.now,id=>blueprints?.forNpc(id)??graph);
        scope.defer(()=>dialogue.clear());
        if(typeof native.on==='function'){let active=true;const connection=(user:unknown)=>{if(active)dialogue.connectionEvent(user);};native.on('connect',connection);native.on('disconnect',connection);scope.defer(()=>{active=false;});}
        scope.defer(events.register('_frostveilDialogue',(sender,packet,...extra)=>{if(extra.length)return;try{dialogue.receive(actorId(sender),packet);}catch{logger.error('[rp-dialogue] rejected invalid sender');}}));
        native.makeEventSource('_frostveilDialogue',sources.event);
        scope.defer(scheduler.every(250,()=>dialogue.prune()));
        if(options.blueprintEditor){
          if(!options.admin?.authorize)throw Error('Blueprint editor requires verified server admin authority');
          const authority=new EditorAuthority(actor=>{
            const principal=admin.principal(actor);if(!principal)return null;
            const session=adapter.sessionForActor(actor);
            return {principal,identity:JSON.stringify([session.userId,session.profileId,session.guid])};
          });
          const service=new BlueprintService(blueprints!,routes.map(id=>({id,label:courier.route(id)?.displayName??id})),
            courierProgressionConfig.permits.map(p=>({id:p.id,label:p.name})),()=>npc.listRegistered());
          const http=new EditorHttpServer(authority,service,loadEditorAssets(options.blueprintEditor.assetsRoot));
          scope.defer(()=>http.close());
          const url=await http.listen(options.blueprintEditor.port??3210);
          scope.defer(commands.register('editor',(ctx,args)=>{
            if(args.length)return {ok:false,code:'INVALID_ARGUMENTS',message:'Usage: /editor'};
            try{return {ok:true,data:{systemMessage:`Blueprint Studio: ${url}\nOne-time login grant (valid 60 seconds): ${authority.issue(ctx.actorId)}`}};}
            catch{return {ok:false,code:'ADMIN_REQUIRED',message:'Admin permission required'};}
          },'rp-blueprint-editor'));
          logger.info(`[rp-blueprint] loopback editor listening at ${url}`);
        }
        logger.info('[rp-dialogue] clerk graph v'+graph.version+' ready; native Activate-key transport registered');

      }});
    }
    modules.register({id:'rp-admin',dependencies:['rp-chat'],initialize(scope){
      scope.defer(()=>admin.clear());
      scope.defer(commands.register('admin',(ctx,args)=>admin.execute(ctx.actorId,args),'rp-admin',adminHints));
      scope.defer(scheduler.every(250, () => {
        try { admin.tick(); } catch { logger.error('[rp-admin] tick failed'); }
      }));
      scope.defer(scheduler.every(1000,()=>{
        try{admin.prune(adapter.onlineActors());}catch{logger.error('[rp-admin] session observation failed');}
      }));
      const native=rawMp as {on?:(event:string,callback:(user:unknown)=>void)=>unknown};
      if(options.admin&&typeof native.on==='function'){let active=true;const observe=(user:unknown)=>{if(active)admin.connectionEvent(user);};native.on('connect',observe);native.on('disconnect',observe);scope.defer(()=>{active=false;});} // Native emitter has no off API; callbacks are inert after shutdown.
    }});
  }
  return {
    adapter, identity, commands, modules, events, chat, economy, admin,
    start: () => modules.boot(),
    stop: () => modules.shutdown(),
  };
}
