export const COURIER_PROPERTY = 'private.rp.v1.courier';
export const MAX_COURIER_PROGRESS = 1000000000;
export interface CourierState {
  schemaVersion: 1;
  activeContractId: string | null;
  lifecycle: 'idle' | 'active';
  completedDeliveries: number;
  reputation: number;
}
export function emptyCourierState(): CourierState {
  return { schemaVersion: 1, activeContractId: null, lifecycle: 'idle', completedDeliveries: 0, reputation: 0 };
}
/** Unknown schema/fields and inconsistent state are preserved by refusing mutation. */
export function courierState(value: unknown): CourierState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid Courier metadata');
  const state = value as Record<string, unknown>;
  const count = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= MAX_COURIER_PROGRESS;
  if (Object.keys(state).some(k => !['schemaVersion','activeContractId','lifecycle','completedDeliveries','reputation'].includes(k)) || state.schemaVersion !== 1 || !count(state.completedDeliveries) || !count(state.reputation) ||
    !((state.lifecycle === 'idle' && state.activeContractId === null) || (state.lifecycle === 'active' && typeof state.activeContractId === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(state.activeContractId)))) throw new TypeError('Unsupported or corrupt Courier metadata; saved data preserved');
  return { schemaVersion: 1, activeContractId: state.activeContractId as string | null, lifecycle: state.lifecycle as 'idle'|'active', completedDeliveries: state.completedDeliveries as number, reputation: state.reputation as number };
}
