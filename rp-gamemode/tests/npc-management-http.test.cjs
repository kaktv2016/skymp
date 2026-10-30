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
