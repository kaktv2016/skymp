import type { IdentityMetadata } from '../../engine/adapter';
export interface ProfileLimits { nameMin:number; nameMax:number; biographyMax:number; intervalMs:number; }
export const profileDefaults:ProfileLimits={nameMin:2,nameMax:40,biographyMax:240,intervalMs:1000};
export function profileLimits(overrides:Partial<ProfileLimits>={}):ProfileLimits {
  const limits={...profileDefaults,...overrides};
  for(const [key,min,max] of [['nameMin',1,64],['nameMax',1,64],['biographyMax',1,512],['intervalMs',100,60000]] as const) {
    if(!Number.isInteger(limits[key]) || limits[key]<min || limits[key]>max) throw new TypeError('Invalid profile limits');
  }
  if(limits.nameMin>limits.nameMax) throw new TypeError('Invalid profile name range');
  return limits;
}
export interface ProfileView { schemaVersion:1; displayName:string; biography:string; limits:ProfileLimits; }
export type ProfileResult={ok:true;data:ProfileView}|{ok:false;code:string;message:string};
export interface ProfileResponse { token:string; requestId:string; action:'open'|'saved'|'error'; message:string; profile?:ProfileView; }
export function profileView(metadata:IdentityMetadata,limits:ProfileLimits):ProfileView {
  return {schemaVersion:1,displayName:metadata.displayName,biography:metadata.biography??'',limits:{...limits}};
}
/** Validate only supplied fields: unchanged legacy schema1 values are preserved. */
export function validateProfilePatch(raw:unknown,current:IdentityMetadata,limits:ProfileLimits):IdentityMetadata {
  if(!raw || typeof raw!=='object' || Array.isArray(raw)) throw new TypeError('Invalid profile update');
  const patch=raw as Record<string,unknown>,keys=Object.keys(patch);
  if(!keys.length || keys.some(key=>!['displayName','biography'].includes(key))) throw new TypeError('Invalid profile fields');
  const next={...current};
  for(const key of keys as ('displayName'|'biography')[]) {
    const value=patch[key],max=key==='displayName'?limits.nameMax:limits.biographyMax;
    if(typeof value!=='string' || value.length>max*4 || /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(value)) throw new TypeError('Invalid or oversized '+key);
    const singleLine=key==='biography'?value.replace(/[\r\n\t]/g,' '):value;
    if(/[\x00-\x1f\x7f-\x9f]/.test(singleLine)) throw new TypeError('Unsupported control characters in '+key);
    const normalized=singleLine.normalize('NFC').replace(/\s+/gu,' ').trim(),length=[...normalized].length;
    if(length>max || (key==='displayName' && length<limits.nameMin)) throw new TypeError(key==='displayName'?`RP name must contain ${limits.nameMin}-${max} Unicode characters`:`Biography maximum is ${max} Unicode characters`);
    next[key]=normalized;
  }
  return next;
}
