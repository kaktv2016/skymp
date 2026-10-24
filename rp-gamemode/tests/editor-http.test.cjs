const {test}=require('node:test'),a=require('node:assert/strict');
const {EditorHttpServer}=require('../.test-build/modules/dialogue/editor-http.js');
const {EditorAuthority}=require('../.test-build/modules/dialogue/editor-authority.js');
test('loopback HTTP requires actual session, origin and CSRF for all data operations',async t=>{
 let allowed=true,calls=0;const auth=new EditorAuthority(()=>allowed?{principal:'owner',identity:'one'}:null);const service={read:()=>{calls++;return {ok:true};},execute:()=>{calls++;return {ok:true};}};const server=new EditorHttpServer(auth,service,new Map([['/',{body:Buffer.from('editor'),type:'text/html'}]]));const base=await server.listen(0);t.after(()=>server.close());
 const post=(op,input={},headers={})=>fetch(base+'/api/'+op,{method:'POST',headers:{origin:base,'content-type':'application/json',...headers},body:JSON.stringify(input)});
 a.equal((await post('catalog')).status,401);a.equal(calls,0);
 a.equal((await post('login',{grant:auth.issue(1)},{origin:'http://evil.test'})).status,403);
 const login=await post('login',{grant:auth.issue(1)});a.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0],{csrf}=await login.json();const h={cookie,'x-fv-csrf':csrf};
 a.equal((await post('catalog',{},h)).status,200);a.equal(calls,1);
 a.equal((await post('draft',{}, {...h,'x-fv-csrf':'0'.repeat(64)})).status,401);a.equal(calls,1);
 a.equal((await post('draft',{blob:'x'.repeat(70000)},h)).status,400);a.equal(calls,1);
 allowed=false;a.equal((await post('catalog',{},h)).status,401);a.equal(calls,1);
 const shell=await fetch(base);a.equal(shell.status,200);a.match(shell.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 const status=await new Promise((resolve,reject)=>{require('node:http').get(base,{headers:{host:'evil.test'}},r=>{r.resume();resolve(r.statusCode);}).on('error',reject);});a.equal(status,403);
});
