const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const compiled=require('node:path').resolve(__dirname,'../.test-build/client/quest-tint.js');
const installQuestTint=fs.existsSync(compiled)?require(compiled).installQuestTint:null;
const catalogue=require('../../../mod-work/frostveil-courier-navigation/catalogue.json');
function fixture(){
 assert.equal(typeof installQuestTint,'function','Quest tint controller must be installed');
 const events=new Map(),menus=new Map([['HUD Menu',new Map()]]),calls=[],logs=[];let now=0,inside=false,connected=true,world=0x3c,pos=[0,0,0],state={displayed:true,tracked:true,targetKey:catalogue[2].key};
 const root='_root.__FrostveilCourierTintV1';
 const native=f=>(...args)=>{assert.equal(inside,true,'Ui/Game natives need update VM');return f(...args);};
 const Ui={isMenuOpen:native(n=>menus.has(n)),getInt:native((n,p)=>menus.get(n)?.get(p)||0),
  setBool:native((n,p,v)=>{menus.get(n).set(p,v);calls.push(['bool',n,p,v]);}),setInt:native((n,p,v)=>{menus.get(n).set(p,v);calls.push(['int',n,p,v]);}),
  setString:native((n,p,v)=>{menus.get(n).set(p,v);calls.push(['string',n,p,v]);}),
  invokeStringA:native((n,p,args)=>{assert.equal(p,'_root.createEmptyMovieClip');assert.deepEqual(args,[root.slice(6),'1048000']);calls.push(['create',n]);}),
  invokeString:native((n,p,v)=>{assert.equal(p,root+'.loadMovie');assert.equal(v,'Frostveil/CourierQuestTint.swf');calls.push(['load',n]);menus.get(n).set(root+'.fvVersion',1);}),
  invokeBool:native((n,p,v)=>{assert.equal(p,root+'.fvApply');calls.push(['paint',n,v]);})};
 const callbacks=new Map();let nextHandle=1;
 const callNative=native((type,method,self,...args)=>{assert.equal(type,'UICallback');assert.equal(self,null);assert.ok(args.every(v=>!Array.isArray(v)),'SP3 cannot pass JS arrays to native functions');
  if(method==='Create'){const handle=nextHandle++;callbacks.set(handle,{menu:args[0],target:args[1],args:[]});return handle;}
  const callback=callbacks.get(args[0]);assert.ok(callback,'invalid UI callback handle');
  if(method==='PushString'||method==='PushInt'){callback.args.push(args[1]);return;}
  if(method==='Send'){assert.equal(callback.target,'_root.createEmptyMovieClip');assert.deepEqual(callback.args,['__FrostveilCourierTintV1',1048000]);calls.push(['create',callback.menu]);callbacks.delete(args[0]);return true;}
  if(method==='Release'){callbacks.delete(args[0]);return;}
  assert.fail('unexpected UICallback method '+method);
 });
 const sp={callNative,storage:{__rpQuestNavigationV1:{status:()=>state}},Ui,Game:{getPlayer:native(()=>({getWorldSpace:()=>({getFormID:()=>world}),getParentCell:()=>({getFormID:()=>world}),getPositionX:()=>pos[0],getPositionY:()=>pos[1],getPositionZ:()=>pos[2]}))},
  mpClientPlugin:{isConnected:()=>connected},on:(n,f)=>{const set=events.get(n)||new Set();set.add(f);events.set(n,set);return[n,f];},unsubscribe:h=>events.get(h[0]).delete(h[1]),writeLogs:(_p,t)=>logs.push(t)};
 const ctx={sp,getMyFormIdInServerFormat:()=>1};installQuestTint(ctx,catalogue,()=>now);
 function emit(n,e){inside=true;try{for(const f of [...events.get(n)||[]])f(e);}finally{inside=false;}}
 return{ctx,calls,logs,menus,root,callbacks,tick(){now+=500;emit('update');},open(n){menus.set(n,new Map());emit('menuOpen',{name:n});},close(n){menus.delete(n);emit('menuClose',{name:n});},state(v){state={...state,...v};},position(v,w=0x3c){pos=v;world=w;},disconnect(){connected=false;},dispose(){sp.storage.__rpQuestTintV1.dispose();},listeners(){return [...events.values()].reduce((n,s)=>n+s.size,0);},install(){installQuestTint(ctx,catalogue,()=>now);}};
}
test('additive menu helper loads once, confirms version, tints gold and restores after untracking',()=>{
 const e=fixture();e.tick();e.tick();assert.equal(e.calls.filter(c=>c[0]==='load').length,1);assert.equal(e.menus.get('HUD Menu').get('_root.__fvQuestTintColorV1'),0xffd54a);assert.equal(e.menus.get('HUD Menu').get('_root.__fvQuestTintLabelV1'),'Deliver to Heartwood Mill (/job deliver)');
 e.state({tracked:false});e.tick();assert.equal(e.menus.get('HUD Menu').get('_root.__fvQuestTintActiveV1'),false);assert.ok(e.calls.some(c=>c[0]==='paint'));assert.ok(e.logs.some(t=>/loaded.*HUD Menu/.test(t)));
});
test('paint telemetry records the actual SWF match count when it changes',()=>{
 const e=fixture();e.tick();e.menus.get('HUD Menu').set(e.root+'.fvPainted',1);e.tick();e.tick();assert.ok(e.logs.some(t=>/painted HUD Menu markers=1/.test(t)));
});
test('green requires actual destination cell and proximity; door approach or other cell stays gold',()=>{
 const e=fixture(),c=catalogue[2];e.position(c.pos);e.tick();assert.equal(e.menus.get('HUD Menu').get('_root.__fvQuestTintColorV1'),0x7fff7a);
 e.position(c.pos,0x16bb4);e.tick();assert.equal(e.menus.get('HUD Menu').get('_root.__fvQuestTintColorV1'),0xffd54a);
 e.state({displayed:false});e.tick();assert.equal(e.menus.get('HUD Menu').get('_root.__fvQuestTintActiveV1'),false);
});
test('Map opens and gets initial state in native menu callback even without a subsequent gameplay update',()=>{
 const e=fixture();e.tick();e.open('MapMenu');assert.equal(e.menus.get('MapMenu').get('_root.__fvQuestTintActiveV1'),true);assert.ok(e.calls.some(c=>c[0]==='load'&&c[1]==='MapMenu'));
 e.close('MapMenu');e.open('MapMenu');assert.equal(e.calls.filter(c=>c[0]==='load'&&c[1]==='MapMenu').length,2);
});
test('dispose queues restoration, hot replacement removes stale handlers and disconnect clears color',()=>{
 const e=fixture();e.tick();e.dispose();e.tick();assert.equal(e.menus.get('HUD Menu').get('_root.__fvQuestTintActiveV1'),false);assert.equal(e.listeners(),0);
 e.install();e.tick();e.disconnect();e.tick();assert.equal(e.menus.get('HUD Menu').get('_root.__fvQuestTintActiveV1'),false);
});
test('missing helper acknowledgements report failure with bounded loading, without touching quest state',()=>{
 const e=fixture();e.ctx.sp.Ui.invokeString=()=>{};for(let i=0;i<30;i++)e.tick();assert.equal(e.calls.filter(c=>c[0]==='create').length,1);assert.match(e.ctx.sp.storage.__rpQuestTintV1.status().error,/SWF.*Launcher/i);assert.equal(e.ctx.sp.storage.__rpQuestNavigationV1.status().tracked,true);
});

test('installed SP3 rejects array arguments; scalar UICallback still creates and releases the helper',()=>{
 const e=fixture();e.ctx.sp.Ui.invokeStringA=()=>{throw Error('Invalid _skyrimPlatform_indexInPool: JS array is not a native object');};
 e.tick();e.tick();assert.ok(e.calls.some(c=>c[0]==='load'));assert.equal(e.ctx.sp.storage.__rpQuestTintV1.status().error,'');assert.equal(e.callbacks.size,0);
});

test('failed UI callback push releases its native handle without retaining resources',()=>{
 const e=fixture(),call=e.ctx.sp.callNative;e.ctx.sp.callNative=(type,method,...args)=>{if(method==='PushInt')throw Error('native push failure');return call(type,method,...args);};
 e.tick();assert.equal(e.callbacks.size,0);assert.match(e.ctx.sp.storage.__rpQuestTintV1.status().error,/push failure/);
});

test('UI unavailable before Send consumes its callback still releases the native handle',()=>{
 const e=fixture(),call=e.ctx.sp.callNative;e.ctx.sp.callNative=(type,method,...args)=>method==='Send'?false:call(type,method,...args);
 e.tick();assert.equal(e.callbacks.size,0);assert.match(e.ctx.sp.storage.__rpQuestTintV1.status().error,/send failed/);
});
