import { CommandRegistry, CommandResult } from '../../core/command-registry';
import { ModuleDefinition } from '../../core/module-registry';
import { SkyMpAdapter } from '../../engine/adapter';
import { ActorId } from '../../engine/ids';
import { IdentityService } from '../identity/identity-service';
import { DiceService } from './dice-service';

export interface DiceSettings { tryDc: number; actionMaxLength: number; }

export function diceSettings(chatMaxLength: number, overrides: Partial<DiceSettings> = {}): DiceSettings {
  // Reserve the five code points of '/try '; very small chat limits disable actions.
  const maximum = Math.max(0, chatMaxLength - 5);
  const settings = { tryDc: 11, actionMaxLength: Math.min(240, maximum), ...overrides };
  if (!Number.isInteger(settings.tryDc) || settings.tryDc < 1 || settings.tryDc > 20) throw new RangeError('tryDc must be an integer from 1 to 20');
  if (!Number.isInteger(settings.actionMaxLength) || settings.actionMaxLength < 0 || settings.actionMaxLength > maximum) throw new RangeError('actionMaxLength must fit within the chat limit after /try ');
  return settings;
}

export function diceModule(adapter: SkyMpAdapter, identity: IdentityService, commands: CommandRegistry, dice: DiceService, settings: DiceSettings): ModuleDefinition {
  const invalid = (message: string): CommandResult => ({ ok: false, code: 'INVALID_ARGUMENTS', message });
  const nameFor = (actor: ActorId): string => {
    adapter.sessionForActor(actor);
    const current = identity.lookup(actor);
    if (!current) throw new Error('RP identity is not ready');
    return current.metadata.displayName;
  };
  return { id: 'rp-dice', dependencies: ['rp-chat'], initialize(scope) {
    scope.defer(commands.register('roll', (context, args) => {
      if (args.length > 1 || (args.length === 1 && !/^[1-9]\d{0,2}$/.test(args[0]!))) return invalid('Usage: /roll [integer sides 2–100]');
      const sides = args.length ? Number(args[0]) : 20;
      if (sides < 2 || sides > 100) return invalid('Dice sides must be from 2 to 100');
      const sender = nameFor(context.actorId);
      const result = dice.roll(sides);
      return { ok: true, data: { kind: 'DO', sender, text: `[ROLL] ${sender} rolled D${sides} → ${result}` } };
    }, 'rp-dice'));
    scope.defer(commands.register('try', (context, args) => {
      const action = args.join(' ').trim().normalize('NFC');
      if (!action || [...action].length > settings.actionMaxLength || /[\x00-\x1f\x7f-\x9f]/.test(action) || /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(action)) return invalid(`Usage: /try [action, up to ${settings.actionMaxLength} characters]`);
      const sender = nameFor(context.actorId);
      const result = dice.roll();
      const outcome = result >= settings.tryDc ? 'สำเร็จ' : 'ล้มเหลว';
      const description = action.startsWith('พยายาม') ? action : `พยายาม ${action}`;
      // Information only: no gameplay setter or persistent dice attribute.
      return { ok: true, data: { kind: 'DO', sender, text: `[TRY] ${sender} ${description} → ${outcome} (${result}/20)` } };
    }, 'rp-dice'));
  } };
}
