/** Minimal signatures verified against ScampServer.cpp at 2849e676. */
export interface NativeMp {
  get(formId: number, propertyName: string): unknown;
  set(formId: number, propertyName: string, value: unknown): unknown;
  getActorName(actorId: number): unknown;
  getDescFromId(formId: number): unknown;
  getUserByActor(actorId: number): unknown;
  getUserActor(userId: number): unknown;
  isConnected(userId: number): unknown;
  getUserGuid(userId: number): unknown;
  makeProperty?(name: string, options: { isVisibleByOwner: boolean; isVisibleByNeighbors: boolean; updateOwner: string; updateNeighbor: string }): unknown;
  makeEventSource?(name: string, body: string): unknown;
}

export function nativeMp(value: unknown): NativeMp {
  if (value === null || typeof value !== 'object') throw new TypeError('SkyMP native object is unavailable');
  for (const name of ['get', 'set', 'getActorName', 'getDescFromId', 'getUserByActor', 'getUserActor', 'isConnected', 'getUserGuid'] as const) {
    if (typeof (value as Record<string, unknown>)[name] !== 'function') throw new TypeError(`Missing native API ${name}`);
  }
  return value as NativeMp;
}
