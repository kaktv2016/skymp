import { ActorId, FormDesc, ProfileId, UserId, actorId, formDesc, profileId, userId } from './ids';
import { NativeMp, nativeMp } from './mp-api';
import { CHAT_EVENT, CHAT_INBOX, ChatEnvelope } from '../modules/chat/contracts';
import { COURIER_PROPERTY, CourierState, courierState } from '../modules/courier/state';

export const IDENTITY_PROPERTY = 'private.rp.v1.identity';
export interface IdentityMetadata { schemaVersion: 1; displayName: string; biography?: string; }
export interface ActorSession { actorId: ActorId; userId: UserId; profileId: ProfileId; guid: string; }
export interface TransformLocation { cell: FormDesc; pos: readonly [number, number, number]; rot: readonly [number, number, number]; }

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function validText(value: unknown, max: number, allowEmpty = false): value is string {
  return typeof value === 'string' && (allowEmpty || value.trim().length > 0) && [...value].length <= max && !/[\x00-\x1f\x7f-\x9f]/.test(value);
}
export function identityMetadata(value: unknown): IdentityMetadata {
  if (!record(value) || value.schemaVersion !== 1 || !validText(value.displayName, 64) ||
      Object.keys(value).some(key => !['schemaVersion', 'displayName', 'biography'].includes(key)) ||
      (value.biography !== undefined && !validText(value.biography, 512, true))) {
    throw new TypeError('Invalid or unsupported RP identity metadata; existing record preserved');
  }
  return value.biography === undefined
    ? { schemaVersion: 1, displayName: value.displayName }
    : { schemaVersion: 1, displayName: value.displayName, biography: value.biography };
}

export class SkyMpAdapter {
  readonly #mp: NativeMp;
  constructor(raw: unknown) { this.#mp = nativeMp(raw); }
  onlineActors(): readonly ActorId[] {
    const raw = this.#mp.get(0, 'onlinePlayers');
    if (!Array.isArray(raw) || raw.length > 1000) throw new TypeError('Invalid native onlinePlayers');
    const result = raw.map(actorId);
    if (new Set(result).size !== result.length) throw new TypeError('Duplicate native online actor');
    return result;
  }
  profileForActor(actor: ActorId): ProfileId { return profileId(this.#mp.get(actorId(actor), 'profileId')); }
  describe(actor: ActorId): FormDesc { return formDesc(this.#mp.getDescFromId(actorId(actor))); }
  actorName(actor: ActorId): string {
    const name = this.#mp.getActorName(actorId(actor));
    if (!validText(name, 64)) throw new TypeError('Invalid native actor name');
    return name.trim();
  }
  sessionForActor(actor: ActorId): ActorSession {
    const checkedActor = actorId(actor);
    const user = userId(this.#mp.getUserByActor(checkedActor));
    if (this.#mp.isConnected(user) !== true || actorId(this.#mp.getUserActor(user)) !== checkedActor) {
      throw new Error('Actor is not bound to a current connection');
    }
    const guid = this.#mp.getUserGuid(user);
    if (typeof guid !== 'string' || guid.length < 1 || guid.length > 128) throw new TypeError('Invalid connection GUID');
    return { actorId: checkedActor, userId: user, profileId: this.profileForActor(checkedActor), guid };
  }
  readIdentity(actor: ActorId): IdentityMetadata | null {
    const value = this.#mp.get(actorId(actor), IDENTITY_PROPERTY);
    return value === undefined || value === null ? null : identityMetadata(value);
  }
  writeIdentity(actor: ActorId, value: IdentityMetadata): void {
    this.#mp.set(actorId(actor), IDENTITY_PROPERTY, identityMetadata(value));
  }
  readCourier(actor: ActorId): CourierState | null {
    const value = this.#mp.get(actorId(actor), COURIER_PROPERTY);
    return value === undefined || value === null ? null : courierState(value);
  }
  writeCourier(actor: ActorId, value: CourierState): void {
    this.#mp.set(actorId(actor), COURIER_PROPERTY, courierState(value));
  }
  location(actor: ActorId): { cell: FormDesc; pos: readonly [number, number, number] } {
    const raw = this.#mp.get(actorId(actor), 'locationalData');
    if (!record(raw) || !Array.isArray(raw.pos) || raw.pos.length !== 3 || !raw.pos.every(v => typeof v === 'number' && Number.isFinite(v))) throw new TypeError('Invalid native locationalData');
    return { cell: formDesc(raw.cellOrWorldDesc), pos: raw.pos as [number, number, number] };
  }
  fullLocation(actor: ActorId): TransformLocation {
    const raw = this.#mp.get(actorId(actor), 'locationalData');
    if (!record(raw) || !Array.isArray(raw.pos) || raw.pos.length !== 3 || !raw.pos.every(v => typeof v === 'number' && Number.isFinite(v))) {
      throw new TypeError('Invalid native locationalData');
    }
    const rot = Array.isArray(raw.rot) && raw.rot.length === 3 && raw.rot.every(v => typeof v === 'number' && Number.isFinite(v))
      ? (raw.rot as [number, number, number])
      : ([0, 0, 0] as const);
    return { cell: formDesc(raw.cellOrWorldDesc), pos: raw.pos as [number, number, number], rot };
  }
  teleport(actor: ActorId, location: TransformLocation): void {
    this.#mp.set(actorId(actor), 'locationalData', {
      cellOrWorldDesc: formDesc(location.cell),
      pos: [...location.pos],
      rot: [...location.rot]
    });
  }
  registerChatTransport(eventSource: string, updateOwner: string): void {
    if (typeof this.#mp.makeProperty !== 'function' || typeof this.#mp.makeEventSource !== 'function') throw new Error('Native chat transport unavailable');
    if (!eventSource || !updateOwner || eventSource.length > 100 * 1024 || updateOwner.length > 100 * 1024) throw new Error('Invalid chat transport source');
    this.#mp.makeProperty(CHAT_INBOX, { isVisibleByOwner:true, isVisibleByNeighbors:false, updateOwner, updateNeighbor:'' });
    this.#mp.makeEventSource(CHAT_EVENT, eventSource);
  }
  writeChatInbox(actor: ActorId, value: ChatEnvelope): void {
    // No generic/native physical state setter is exposed.
    this.#mp.set(actorId(actor), CHAT_INBOX, value);
  }
}
