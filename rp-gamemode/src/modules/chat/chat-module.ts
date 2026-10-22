import { CommandRegistry } from '../../core/command-registry';
import { EventRouter } from '../../core/event-router';
import { ModuleDefinition } from '../../core/module-registry';
import { SkyMpAdapter } from '../../engine/adapter';
import { chatSources } from '../../client/chat-bridge';
import { Logger, Scheduler } from '../identity/identity-module';
import { ChatService } from './chat-service';
import { CHAT_EVENT, ChatConfig } from './contracts';

export function chatModule(adapter:SkyMpAdapter, chat:ChatService, commands:CommandRegistry, events:EventRouter, scheduler:Scheduler, logger:Logger, config:ChatConfig):ModuleDefinition {
  return { id:'rp-chat', dependencies:['rp-identity'], initialize(scope) {
    scope.defer(()=>chat.clear());
    scope.defer(commands.register('me',(context,args)=>chat.formatAction(context.actorId,args,'ME'),'rp-chat'));
    scope.defer(commands.register('do',(context,args)=>chat.formatAction(context.actorId,args,'DO'),'rp-chat'));
    scope.defer(events.register(CHAT_EVENT,(sender,payload,...extra)=> {
      logger.info('[rp] chat event received');
      if(extra.length) { logger.error('[rp] chat event rejected: extra arguments'); return; }
      void chat.receive(sender,payload).then(()=>logger.info('[rp] chat handler returned')).catch(()=>logger.error('[rp] chat dispatch failed'));
    }));
    const source=chatSources(config);
    adapter.registerChatTransport(source.event,source.owner);
    // Native definitions have process lifetime; do not clear other gamemode state.
    chat.sync();
    scope.defer(scheduler.every(1000,()=>{try{chat.sync();}catch{logger.error('[rp] chat session observation failed');}}));
    logger.info('[rp] Phase 2.2 chat sources registered; client/game verification pending');
  } };
}
