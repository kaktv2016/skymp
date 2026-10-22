import { CommandRegistry } from '../../core/command-registry';
import { Cleanup, ModuleDefinition } from '../../core/module-registry';
import { SkyMpAdapter } from '../../engine/adapter';
import { actorId } from '../../engine/ids';
import { IdentityService } from './identity-service';

export interface Scheduler { every(milliseconds: number, callback: () => void): Cleanup; }
export interface Logger { info(message: string): void; error(message: string): void; }

export function identityModule(adapter: SkyMpAdapter, identity: IdentityService, commands: CommandRegistry, scheduler: Scheduler, logger: Logger,profileCommands=false): ModuleDefinition {
  return {
    id: 'rp-identity',
    initialize(scope) {
      scope.defer(commands.register('whoami', (context, args) => {
        if (args.length !== 0) return { ok: false, code: 'INVALID_ARGUMENTS', message: 'Usage: /whoami' };
        const actor = actorId(context.actorId);
        adapter.sessionForActor(actor);
        const current = identity.lookup(actor);
        return current === null
          ? { ok: false, code: 'IDENTITY_NOT_READY', message: 'RP identity is not initialized' }
          : { ok: true, data: current };
      }, 'rp-identity'));
      if(profileCommands) {
        scope.defer(commands.register('profile',(context,args)=> {
          if(args.length) return {ok:false,code:'INVALID_ARGUMENTS',message:'Usage: /profile'};
          const result=identity.profile(actorId(context.actorId));
          return result.ok?{ok:true,data:{systemMessage:`RP profile: ${result.data.displayName} | Biography: ${result.data.biography||'(empty)'}`,profile:result.data}}:result;
        },'rp-identity'));
        scope.defer(commands.register('setrpname',(context,args)=> {
          if(!args.length) return {ok:false,code:'INVALID_ARGUMENTS',message:'Usage: /setrpname [name]'};
          const result=identity.update(actorId(context.actorId),{displayName:args.join(' ')});
          return result.ok?{ok:true,data:{systemMessage:`RP name saved: ${result.data.displayName}`}}:result;
        },'rp-identity'));
        scope.defer(commands.register('setbio',(context,args)=> {
          if(!args.length) return {ok:false,code:'INVALID_ARGUMENTS',message:'Usage: /setbio [description] or /setbio --clear'};
          const result=identity.update(actorId(context.actorId),{biography:args.length===1 && args[0]==='--clear'?'':args.join(' ')});
          return result.ok?{ok:true,data:{systemMessage:result.data.biography?'Biography saved':'Biography cleared'}}:result;
        },'rp-identity',['--clear']));
      }

      let lastError = '';
      let knownActors = new Set<number>();
      const actorErrors = new Map<number, string>();
      const refresh = (initial = false) => {
        const actors = adapter.onlineActors();
        identity.prune(actors);
        const associated = new Set<number>();
        for (const actor of actors) {
          try {
            adapter.sessionForActor(actor);
            const current = identity.ensure(actor);
            if (!knownActors.has(actor)) {
              logger.info(`[rp] identity associated actor=${actor.toString(16)} profile=${current.profileId} schema=1`);
            }
            associated.add(actor);
            actorErrors.delete(actor);
          } catch (error) {
            if (initial) throw error;
            const message = error instanceof Error ? error.message : 'Unknown identity observation error';
            if (actorErrors.get(actor) !== message) logger.error(`[rp] identity observation failed actor=${actor.toString(16)}: ${message}`);
            actorErrors.set(actor, message);
          }
        }
        for (const actor of actorErrors.keys()) if (!actors.includes(actorId(actor))) actorErrors.delete(actor);
        knownActors = associated;
        lastError = '';
      };
      // Initial failure aborts boot and rolls back the owned command.
      refresh(true);
      scope.defer(scheduler.every(1000, () => {
        try { refresh(); }
        catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown identity observation error';
          if (message !== lastError) logger.error(`[rp] identity observation failed: ${message}`);
          lastError = message;
        }
      }));
    },
  };
}
