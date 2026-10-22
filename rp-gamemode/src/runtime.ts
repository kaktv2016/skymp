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

export interface RuntimeOptions { scheduler?: Scheduler; logger?: Logger; chat?: false | (Partial<ChatConfig> & { now?: () => number }); profile?:Partial<ProfileLimits>&{now?:()=>number}; dice?: Partial<DiceSettings> & { rng?: DiceRng }; courier?: CourierOptions; economy?:EconomyOptions;admin?:AdminOptions; }
export function createRuntime(rawMp: unknown, options: RuntimeOptions = {}) {
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
