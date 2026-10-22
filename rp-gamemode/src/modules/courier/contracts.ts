import { FormDesc, formDesc } from '../../engine/ids';

export interface CourierPoint { label: string; cell: FormDesc; pos: readonly [number, number, number]; }
export interface CourierRoute { id: string; displayName: string; pickup: CourierPoint; delivery: CourierPoint; radius: number; reputationReward: number; reward:number|null;xpReward:number;requiredRank:number;requiredPermit:string|null;tier:'local'|'regional'|'long-distance';enabled:boolean;minimumTravelMs:number;repeatCooldownMs:number; }
export interface CourierOptions { route?: unknown; routes?:readonly unknown[]; development?: boolean; beaconPreview?:boolean; devpos?: boolean; }
export interface CourierSettings { route: CourierRoute | null; routes:readonly CourierRoute[];devpos: boolean; beaconPreview:boolean; routeError: string; }

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid route object');
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || [...value].length > max || /[\x00-\x1f\x7f-\x9f]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(value)) throw new TypeError('Invalid route label');
  return value.trim().normalize('NFC');
}
export function cellKey(value: unknown): string {
  const checked = formDesc(value);
  const [id, plugin] = checked.split(':');
  return BigInt('0x' + id!).toString(16) + (plugin ? ':' + plugin.toLowerCase() : '');
}
function point(value: unknown): CourierPoint {
  const raw = object(value);
  if (!Array.isArray(raw.pos) || raw.pos.length !== 3 || !raw.pos.every(v => typeof v === 'number' && Number.isFinite(v)&&Math.abs(v)<10000000)) throw new TypeError('Route coordinates must be three finite numbers');
  return { label: text(raw.label, 64), cell: formDesc(cellKey(raw.cell)), pos: [...raw.pos] as [number, number, number] };
}
/** Same cell and 3D distance; invalid native/configured values never match. */
export function inZone(location: { cell: unknown; pos: readonly number[] }, target: CourierPoint, radius: number): boolean {
  try {
    return Number.isFinite(radius) && radius > 0 && location.pos.length === 3 && location.pos.every(v => Number.isFinite(v)) && target.pos.length === 3 && target.pos.every(v => Number.isFinite(v)) && cellKey(location.cell) === cellKey(target.cell) && Math.hypot(...location.pos.map((v, i) => v - target.pos[i]!)) <= radius;
  } catch { return false; }
}
export function courierRoute(value:unknown):CourierRoute {
    const raw = object(value);
    if (typeof raw.id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(raw.id)) throw new TypeError('Invalid stable contract ID');
    if (typeof raw.radius !== 'number' || !Number.isFinite(raw.radius) || raw.radius <= 0 || raw.radius > 10000) throw new TypeError('Interaction radius must be positive and at most 10000');
    if (typeof raw.reputationReward !== 'number' || !Number.isSafeInteger(raw.reputationReward) || raw.reputationReward < 1 || raw.reputationReward > 1000000) throw new TypeError('Invalid reputation reward');
    const integer=(v:unknown,min:number,max:number):number=>{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min||v>max)throw Error('Invalid route progression');return v;};
    const permit=raw.requiredPermit??null;if(permit!==null&&(typeof permit!=='string'||!/^[a-z][a-z0-9-]{0,31}$/.test(permit)))throw Error('Invalid permit ID');
    const tier=raw.tier??'local';if(!['local','regional','long-distance'].includes(tier as string))throw Error('Invalid difficulty');
    if(raw.enabled!==undefined&&typeof raw.enabled!=='boolean')throw Error('Invalid enabled flag');
    const route: CourierRoute = { id: raw.id, displayName: text(raw.displayName, 64), pickup: point(raw.pickup), delivery: point(raw.delivery), radius: raw.radius, reputationReward: raw.reputationReward,reward:raw.reward==null?null:integer(raw.reward,1,1000000000),xpReward:integer(raw.xpReward??10,1,1000000),requiredRank:integer(raw.requiredRank??0,0,4),requiredPermit:permit as string|null,tier:tier as CourierRoute['tier'],enabled:raw.enabled!==false,minimumTravelMs:integer(raw.minimumTravelMs??0,0,3600000),repeatCooldownMs:integer(raw.repeatCooldownMs??0,0,3600000) };
    if (cellKey(route.pickup.cell) === cellKey(route.delivery.cell) && Math.hypot(...route.pickup.pos.map((v, i) => v - route.delivery.pos[i]!)) <= route.radius * 2) throw new TypeError('Pickup/delivery interaction zones must not overlap or touch');
    return route;
}
export function courierSettings(options: CourierOptions = {}): CourierSettings {
  const settings: CourierSettings = { route: null,routes:[],beaconPreview:options.development===true&&options.beaconPreview===true, devpos: options.development === true && options.devpos === true, routeError: 'Courier route is disabled; configure confirmed pickup/delivery locations first' };
  try {
   if(options.route!=null)settings.route=courierRoute(options.route);
   if(options.routes!==undefined&&(!Array.isArray(options.routes)||options.routes.length>16))throw Error('At most 16 configured routes');
   const routes=(options.routes??[]).map(courierRoute);
   if(new Set(routes.map(r=>r.id)).size!==routes.length)throw Error('Duplicate route IDs');
   if(settings.route&&!routes.some(r=>r.id===settings.route!.id))routes.unshift(settings.route);
   settings.routes=routes;
   if(settings.route){settings.route=routes.find(r=>r.id===settings.route!.id)!;settings.routeError='';}
  }catch(error){settings.route=null;settings.routes=[];settings.routeError='Courier route is disabled: '+(error instanceof Error?error.message:'invalid configuration');}
  return settings;
}
