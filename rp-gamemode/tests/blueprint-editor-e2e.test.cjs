const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {BlueprintStore}=require('../.test-build/modules/dialogue/blueprint-store.js');
const {BlueprintService}=require('../.test-build/modules/dialogue/blueprint-service.js');
const {EditorAuthority}=require('../.test-build/modules/dialogue/editor-authority.js');
const {EditorHttpServer,loadEditorAssets}=require('../.test-build/modules/dialogue/editor-http.js');
const {clerkGraph}=require('../.test-build/modules/dialogue/dialogue-runtime.js');

test('authenticated editor workflow persists drafts, validates, previews, publishes, assigns and rolls back',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fv-blueprint-e2e-'));let store=new BlueprintStore(dir,['route'],['regional'],clerkGraph(['route'],['regional']));
 const npcs=[{id:'npc-stable-1',name:'Guild Clerk',enabled:true,deleted:false}], principals=new Map([[1,{principal:'owner',identity:'user-1/session-a'}],[2,{principal:'owner',identity:'user-2/session-b'}]]);
 const auth=new EditorAuthority(actor=>principals.get(actor)??null),service=new BlueprintService(store,['route'],[{id:'regional',label:'ใบอนุญาตภูมิภาค'}],()=>npcs);
 const assets=loadEditorAssets(path.resolve(__dirname,'../../blueprint-editor/dist'));a.ok(assets.has('/'));a.ok([...assets.keys()].some(k=>k.endsWith('.js')));
 const server=new EditorHttpServer(auth,service,assets),base=await server.listen(0);t.after(async()=>{await server.close();store.close();fs.rmSync(dir,{recursive:true,force:true});});
 async function login(actor){const response=await fetch(base+'/api/login',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({grant:auth.issue(actor)})});a.equal(response.status,200);const body=await response.json();return {cookie:response.headers.get('set-cookie').split(';')[0],csrf:body.csrf};}
 async function post(session,op,payload){return fetch(base+'/api/'+op,{method:'POST',headers:{origin:base,'content-type':'application/json',cookie:session.cookie,'x-fv-csrf':session.csrf},body:JSON.stringify(payload)});}
 const one=await login(1),two=await login(2);
 const catalog=await (await post(one,'catalog',{})).json();a.equal(catalog.graphs[0].id,'courier-clerk');a.equal(catalog.npcs[0].id,'npc-stable-1');a.equal(catalog.permits[0].label,'ใบอนุญาตภูมิภาค');
 const loaded=await (await post(one,'graph',{id:'courier-clerk'})).json(),graph=loaded.published;graph.nodes.find(n=>n.type==='npc').text='ยินดีต้อนรับสู่กิลด์';
 const draftPayload={graph,layout:{entry:{x:10,y:20}},revision:0};a.equal((await post(one,'draft',draftPayload)).status,200);a.equal((await post(two,'draft',draftPayload)).status,409);
 a.equal((await post(one,'validate',{graph})).status,200);const preview=await (await post(one,'preview',{graph,choices:['accept-route'],activeCourier:false})).json();a.match(JSON.stringify(preview),/Preview only/);a.ok(preview.actions.length);
 a.equal((await post(one,'publish',{id:graph.id,draftRevision:1,version:1})).status,200);
 const conflict=await post(two,'publish',{id:graph.id,draftRevision:1,version:1});a.equal(conflict.status,409);
 a.equal((await post(one,'assign',{npc:'npc-stable-1',id:graph.id,revision:2})).status,200);
 a.equal((await post(one,'rollback',{id:graph.id,targetVersion:1,version:2})).status,200);
 const bad=structuredClone(graph);bad.nodes.find(n=>n.type==='action').action='console';a.equal((await post(one,'validate',{graph:bad})).status,400);
 await server.close();store.close();store=new BlueprintStore(dir,['route'],['regional'],clerkGraph(['route'],['regional']));a.equal(store.history('courier-clerk').length,3);a.equal(store.forNpc('npc-stable-1').version,3);a.equal(store.published('courier-clerk').version,3);
});
