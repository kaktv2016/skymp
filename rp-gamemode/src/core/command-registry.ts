import type { ActorId } from '../engine/ids';

export interface CommandContext {
  actorId: ActorId;
}

export type CommandResult =
  | { ok: true; data: unknown }
  | { ok: false; code: string; message: string };

export type CommandHandler = (
  ctx: CommandContext,
  args: readonly string[]
) => CommandResult | Promise<CommandResult>;

interface Registration {
  handler: CommandHandler;
  owner: string;
  subcommands: readonly string[];
}

const controlCharacters = /[\u0000-\u001f\u007f-\u009f]/;

function normalizeName(name: string): string {
  const normalized = name.trim().replace(/^\//, '').toLowerCase();
  if (!normalized || /[\s/]/.test(normalized) || controlCharacters.test(name)) {
    throw new Error('Command name must be a single nonempty token');
  }
  return normalized;
}

function isCommandResult(value: unknown): value is CommandResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const result = value as Partial<CommandResult>;
  if (result.ok === true) {
    return Object.prototype.hasOwnProperty.call(result, 'data');
  }
  return result.ok === false && typeof result.code === 'string' && typeof result.message === 'string';
}

export class CommandRegistry {
  private readonly registrations = new Map<string, Registration>();

  register(name: string, handler: CommandHandler, owner: string, subcommands:readonly string[]=[]): () => void {
    const normalized = normalizeName(name);
    if (this.registrations.has(normalized)) {
      throw new Error(`Command already registered: ${normalized}`);
    }
    if(subcommands.some(value=>! /^[a-z0-9-]+(?: [a-z0-9-]+)*$/.test(value) || value.length>100))throw Error('Invalid command completion');
    const registration = { handler, owner, subcommands:[...subcommands] };
    this.registrations.set(normalized, registration);
    return () => {
      if (this.registrations.get(normalized) === registration) {
        this.registrations.delete(normalized);
      }
    };
  }

  async dispatch(input: string, context: CommandContext): Promise<CommandResult> {
    if (typeof input !== 'string' || input.length > 1024 || controlCharacters.test(input)) {
      return { ok: false, code: 'INVALID_INPUT', message: 'Invalid command input' };
    }
    const trimmed = input.trim();
    if (!trimmed.startsWith('/') || trimmed.length < 2 || /\s/.test(trimmed.charAt(1))) {
      return { ok: false, code: 'INVALID_INPUT', message: 'Expected a slash-prefixed command' };
    }
    const [name, ...args] = trimmed.slice(1).split(/\s+/);
    if (!name || name.includes('/')) {
      return { ok: false, code: 'INVALID_INPUT', message: 'Invalid command name' };
    }
    const registration = this.registrations.get(name.toLowerCase());
    if (!registration) {
      return { ok: false, code: 'NOT_FOUND', message: 'Command not found' };
    }
    try {
      const result: unknown = await registration.handler(context, args);
      if (isCommandResult(result)) {
        return result;
      }
      return { ok: false, code: 'HANDLER_ERROR', message: 'Command returned an invalid result' };
    } catch {
      return { ok: false, code: 'HANDLER_ERROR', message: 'Command handler failed' };
    }
  }

  list(): readonly string[] {
    return [...this.registrations.keys()];
  }
  completions():readonly string[]{return [...new Set([...this.registrations.entries()].flatMap(([name,value])=>['/'+name,...value.subcommands.flatMap(s=>s.split(' ').map((_part,i,parts)=>'/'+name+' '+parts.slice(0,i+1).join(' ')))]))].sort();}
}
