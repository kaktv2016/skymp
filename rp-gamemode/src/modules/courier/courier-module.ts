import {beaconStyles} from './beacon-styles';
import { CommandRegistry } from '../../core/command-registry';
import { ModuleDefinition } from '../../core/module-registry';
import { CourierService } from './courier-service';
import type {EconomyService} from '../economy/economy-service';

export function courierModule(service: CourierService, commands: CommandRegistry, economy?:EconomyService): ModuleDefinition {
  return { id: 'rp-courier', dependencies: ['rp-chat'], initialize(scope) {
    scope.defer(commands.register('job', (context, args) => economy?economy.execute(context.actorId,args):service.execute(context.actorId, args), 'rp-courier', [...service.commandHints(),...(economy?economy.commandHints():[])]));
    if(service.previewEnabled()){
      scope.defer(commands.register('beacon',(context,args)=>service.preview(context.actorId,args),'rp-courier',['list','next','default','off',...beaconStyles.map(s=>s.id)]));
      scope.defer(()=>service.clearPreviews());
    }
    if(economy){scope.defer(()=>economy.close());scope.defer(commands.register('wallet',(context,args)=>economy.execute(context.actorId,args,true),'rp-courier'));}
  } };
}
