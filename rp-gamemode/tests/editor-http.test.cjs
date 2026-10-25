const {test}=require('node:test'),a=require('node:assert/strict');
const {EditorHttpServer}=require('../.test-build/modules/dialogue/editor-http.js');
const {EditorAuthority}=require('../.test-build/modules/dialogue/editor-authority.js');
const {loadEditorAssets}=require('../.test-build/modules/dialogue/editor-http.js');
const path=require('node:path');
test('production HTML asset URLs resolve to the exact JS and CSS served by the editor',()=>{
 const root=path.resolve(__dirname,'../../blueprint-editor/dist'),assets=loadEditorAssets(root),html=assets.get('/').body.toString('utf8');
 const urls=[...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(match=>match[1]);
 a.ok(urls.some(url=>url.endsWith('.js')));a.ok(urls.some(url=>url.endsWith('.css')));
 for(const url of urls){a.ok(assets.has(url),'missing served asset '+url);const served=assets.get(url);a.ok(served.body.length>0);a.equal(served.type,url.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8');}
});
test('loopback HTTP requires actual session, origin and CSRF for all data operations including /api/references',async t=>{
 let allowed=true,calls=0;const auth=new EditorAuthority(()=>allowed?{principal:'owner',identity:'one'}:null);const service={read:()=>{calls++;return {ok:true};},execute:()=>{calls++;return {ok:true};}};const server=new EditorHttpServer(auth,service,new Map([['/',{body:Buffer.from('editor'),type:'text/html'}]]));const base=await server.listen(0);t.after(()=>server.close());
 const post=(op,input={},headers={})=>fetch(base+'/api/'+op,{method:'POST',headers:{origin:base,'content-type':'application/json',...headers},body:JSON.stringify(input)});
 a.equal((await post('catalog')).status,401);a.equal(calls,0);
 a.equal((await post('references')).status,401);a.equal(calls,0);
 a.equal((await post('login',{grant:auth.issue(1)},{origin:'http://evil.test'})).status,403);
 const login=await post('login',{grant:auth.issue(1)});a.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0],{csrf}=await login.json();const h={cookie,'x-fv-csrf':csrf};
 a.equal((await post('catalog',{},h)).status,200);a.equal(calls,1);
 a.equal((await post('references',{},h)).status,200);a.equal(calls,2);
 a.equal((await post('draft',{}, {...h,'x-fv-csrf':'0'.repeat(64)})).status,401);a.equal(calls,2);
 a.equal((await post('draft',{blob:'x'.repeat(70000)},h)).status,400);a.equal(calls,2);
 allowed=false;a.equal((await post('catalog',{},h)).status,401);a.equal(calls,2);
 const shell=await fetch(base);a.equal(shell.status,200);a.match(shell.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 const status=await new Promise((resolve,reject)=>{require('node:http').get(base,{headers:{host:'evil.test'}},r=>{r.resume();resolve(r.statusCode);}).on('error',reject);});a.equal(status,403);
});
