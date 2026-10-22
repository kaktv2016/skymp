import fs from 'node:fs';
import {courierConfig} from './config/courier';
import {LocalAdminAuthority} from './modules/admin/local-authority';
export { createRuntime } from './runtime';
export { SkyMpAdapter, IDENTITY_PROPERTY } from './engine/adapter';
export { IdentityService } from './modules/identity/identity-service';
export { actorId, userId, profileId, formDesc } from './engine/ids';
export { chatSources } from './client/chat-bridge';
import { createRuntime } from './runtime';

const globals = globalThis as unknown as Record<string, unknown>;
if (globals.mp !== undefined) {
  const key = '__skyrimRpFoundationV1';
  if (globals[key] !== undefined) throw new Error('RP foundation already loaded. Hot reload is unsupported; restart explicitly.');
  const preview=process.env.FROSTVEIL_BEACON_PREVIEW==='1';
  if(preview){const config=JSON.parse(fs.readFileSync('server-settings.json','utf8'));if(config.listenHost!=='127.0.0.1'||config.uiListenHost!=='127.0.0.1')throw Error('Beacon preview requires explicit loopback development server');}
  let authority:LocalAdminAuthority|undefined;
  if(process.env.FROSTVEIL_ADMIN_LOCAL==='1'){
    const config=JSON.parse(fs.readFileSync('server-settings.json','utf8'));
    if(config.listenHost!=='127.0.0.1'||config.uiListenHost!=='127.0.0.1'||config.offlineMode!==true)throw Error('Local OS-operator grants require explicit offline loopback server');
    authority=new LocalAdminAuthority('rp-admin',['owner']);
    const native=globals.mp as {on?:(event:string,callback:(user:unknown)=>void)=>unknown};
    if(typeof native.on!=='function')throw Error('Native connection events required for local admin grants');
    native.on('connect',authority.connectionEvent);native.on('disconnect',authority.connectionEvent);
    console.log('[rp-admin] Local operator approval enabled, no session has permission by default. Use scripts/admin-local.cjs from the server machine.');
  }
  const runtime = createRuntime(globals.mp,{npc:{storageRoot:'rp-npcs'},economy:{storageRoot:'rp-economy'},...(authority?{admin:{authorize:authority.authorize}}:{}),...(preview?{courier:{...courierConfig,development:true,beaconPreview:true}}:{})});
  globals[key] = runtime;
  runtime.start().then(() => {
    console.log('[rp] Phase 2.1 foundation ready; Phase 2.2 chat transport registered; in-game verification pending');
  }).catch(error => {
    console.error('[rp] foundation boot FAILED; owned resources rolled back', error);
  });
}
