'use strict';
// Browser QA only: synthetic admin/session/registry; never binds the live listener.
const fs=require('node:fs'),path=require('node:path');
const repo=path.resolve(__dirname,'../../..'),audit=path.join(repo,'build/rp-audit/g244');
const {setup}=require('../../tests/helpers/npc-management.cjs'),{EditorAuthority}=require('../../.test-build/modules/dialogue/editor-authority.js'),{EditorHttpServer,loadEditorAssets}=require('../../.test-build/modules/dialogue/editor-http.js');
const cleanups=[],f=setup({after:fn=>cleanups.push(fn)});f.npc().execute(1,['create','guild-clerk']);f.npc().execute(1,['rename','Guild Clerk']);f.npc().execute(1,['create','warrior']);f.npc().execute(1,['rename','Warrior']);
const latest=fs.readdirSync(audit).filter(n=>n.startsWith('native-probe-')&&fs.existsSync(path.join(audit,n,'write-result.json'))).sort((a,b)=>fs.statSync(path.join(audit,a,'write-result.json')).mtimeMs-fs.statSync(path.join(audit,b,'write-result.json')).mtimeMs).at(-1),metadata=JSON.parse(fs.readFileSync(path.join(audit,latest,'write-result.json'))).metadata;
const auth=new EditorAuthority(()=>({principal:'qa-fixture-only',identity:'synthetic-session'}));
const http=new EditorHttpServer(auth,undefined,loadEditorAssets(path.join(repo,'blueprint-editor/dist')),(op,input,p)=>{const s=f.run(op,input,p);if(op==='snapshot')for(const t of s.templates){t.details.metadata=metadata.find(m=>m.id===t.id);t.displayName=t.id==='guild-clerk'?'Guild Clerk':'Warrior';}return s;});
http.listen(13211).then(url=>{fs.writeFileSync(path.join(audit,'browser-login.private.json'),JSON.stringify({grant:auth.issue(1)}));console.log('Synthetic browser fixture listening: '+url+'/npcs');});
process.on('SIGINT',()=>{void http.close().finally(()=>{for(const fn of cleanups)fn();process.exit(0);});});
