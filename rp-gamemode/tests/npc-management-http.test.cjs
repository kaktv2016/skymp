const {test}=require('node:test'),a=require('node:assert/strict');
const {EditorHttpServer}=require('../.test-build/modules/dialogue/editor-http.js');
const {EditorAuthority}=require('../.test-build/modules/dialogue/editor-authority.js');
const {setup}=require('./helpers/npc-management.cjs');
test('NPC loopback routes reuse single-use login, origin, session revocation and CSRF protection',async t=>{
 const f=setup(t);let allowed=true;const auth=new EditorAuthority(()=>allowed?{principal:'owner',identity:'one'}:null);
 const http=new EditorHttpServer(auth,undefined,new Map([['/',{body:Buffer.from('NPC shell'),type:'text/html'}]]),(op,input,p)=>f.run(op,input,p));const base=await http.listen(0);t.after(()=>http.close());
 const post=(op,input={},h={})=>fetch(base+'/api/'+op,{method:'POST',headers:{origin:base,'content-type':'application/json',...h},body:JSON.stringify(input)});
 a.equal((await fetch(base+'/npcs')).status,200);a.equal((await post('npc/snapshot')).status,401);a.equal(f.count(),0);
 const grant=auth.issue(1),login=await post('login',{grant}),{csrf}=await login.json();const cookie=login.headers.get('set-cookie').split(';')[0],headers={cookie,'x-fv-csrf':csrf};a.equal((await post('login',{grant})).status,401);
 a.equal((await post('npc/snapshot',{},headers)).status,200);a.equal((await post('npc/review',f.input(),{...headers,origin:'http://evil.test'})).status,403);a.equal((await post('npc/review',f.input(),{cookie,'x-fv-csrf':'0'.repeat(64)})).status,401);
 a.equal((await post('npc/review',{...f.input(),actor:2},headers)).status,400);
 const review=await (await post('npc/review',f.input(),headers)).json();a.ok(review.token);a.equal((await post('npc/apply',{token:review.token},headers)).status,200);a.equal(f.count(),1);a.equal((await post('npc/apply',{token:review.token},headers)).status,400);
 a.equal((await post('draft',{},headers)).status,400);allowed=false;a.equal((await post('npc/snapshot',{},headers)).status,401);
});

test('asset intake uses the same live admin session, CSRF and origin gates without exposing filesystem paths',async t=>{
 let live=true,calls=0;const auth=new EditorAuthority(()=>live?{principal:'owner',identity:'verified-session'}:null);
 const http=new EditorHttpServer(auth,undefined,new Map([['/',{body:Buffer.from('Asset shell'),type:'text/html'}]]),(op,input,p)=>{a.equal(op,'assets/list');a.equal(p.principal,'owner');a.deepEqual(input,{});calls++;return {sources:[{id:'reviewed',label:'Reviewed source'}]};});const base=await http.listen(0);t.after(()=>http.close());
 const post=(input={},headers={})=>fetch(base+'/api/npc/assets/list',{method:'POST',headers:{origin:base,'content-type':'application/json',...headers},body:JSON.stringify(input)});
 a.equal((await fetch(base+'/npc-assets')).status,200);a.equal((await post()).status,401);a.equal(calls,0);
 const login=await fetch(base+'/api/login',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({grant:auth.issue(1)})}),data=await login.json(),cookie=login.headers.get('set-cookie').split(';')[0],headers={cookie,'x-fv-csrf':data.csrf};
 a.equal((await post({},headers)).status,200);a.equal(calls,1);a.equal((await post({},{...headers,origin:'http://evil.test'})).status,403);a.equal((await post({},{cookie,'x-fv-csrf':'0'.repeat(64)})).status,401);live=false;a.equal((await post({},headers)).status,401);a.equal(calls,1);
});
