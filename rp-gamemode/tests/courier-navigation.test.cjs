const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {beaconStyles}=require('../.test-build/modules/courier/beacon-styles.js');
const {installCourierNavigation}=require('../.test-build/client/courier-navigation.js');
function fixture(){
 const handlers=new Map(),refs=[],failures=[],bases=new Map();let clones=0;
 const sourceBase={getFormID:()=>0x877f8,getWorldModelPath:()=>"Magic/FXFirePillar01.nif",setWorldModelPath(){throw Error("must never change vanilla form");},tempClone(){clones++;const base={id:0xff001000+clones-1,getFormID(){return this.id;},path:"",getWorldModelPath(){return this.path;},setWorldModelPath(p){this.path=p;}};bases.set(base.id,base);return base;}};let at=0,connected=true,remote=1,cell=1,world=60,loading=false,pending;
 const player={is3DLoaded:()=>true,getParentCell:()=>({getFormID:()=>cell}),getWorldSpace:()=>world?{getFormID:()=>world}:null,
 getPositionX:()=>0,getPositionY:()=>0,getPositionZ:()=>0,
 placeAtMe(form,count,persist,disabled){assert.ok(form.id>=0xff001000);assert.ok(beaconStyles.some(s=>s.model===form.getWorldModelPath()));assert.equal(count,1);assert.equal(persist,false);assert.equal(disabled,true);const ref={getFormID:()=>0xff000100+refs.indexOf(ref),deleted:false,enabled:false,disableNoWait(){this.enabled=false;},delete(){this.deleted=true;return Promise.resolve();},setAngle(){return Promise.resolve();},setScale(){return Promise.resolve();},setPosition(){return pending??Promise.resolve();},enable(){this.enabled=true;return Promise.resolve();},isDeleted(){return this.deleted;}};refs.push(ref);return ref;}};
 const ctx={sp:{storage:{},Game:{getPlayer:()=>player,getFormFromFile:()=>sourceBase,getFormEx:id=>bases.get(id)??refs.find(r=>r.getFormID()===id)??null},ObjectReference:{from:r=>r},Ui:{isMenuOpen:()=>loading},mpClientPlugin:{isConnected:()=>connected},on:(name,fn)=>{const h={name,fn};handlers.set(h,fn);return h;},unsubscribe:h=>handlers.delete(h),printConsole:s=>failures.push(s)},getMyFormIdInServerFormat:()=>remote};
 const source='('+installCourierNavigation.toString()+')(ctx,'+JSON.stringify(beaconStyles)+');',context=vm.createContext({ctx,Date:{now:()=>at},Math,JSON,Promise});vm.runInContext(source,context);
 const emit=(n,e={})=>[...handlers.keys()].filter(h=>h.name===n).forEach(h=>h.fn(e)),tick=async()=>{at+=1000;emit('update');for(let i=0;i<12;i++)await Promise.resolve();};
 return {ctx,refs,handlers,failures,bases,cloneCount:()=>clones,tick,frame:()=>emit('update'),emit,install:()=>vm.runInContext(source,context),receive:v=>ctx.sp.storage.__rpCourierNavigationV1.receive(v),loading:v=>loading=v,cell:v=>cell=v,world:v=>world=v,disconnect:()=>{connected=false;remote=0;},connect:()=>{connected=true;remote=1;},defer:()=>{let resolve;pending=new Promise(r=>resolve=r);return resolve;}};
}
const target={id:'job-1',cell:'3c:Skyrim.esm',pos:[1000,0,0],label:'ส่งจดหมาย'};
test('local temporary beacon is singular, ends on null, and reconnect needs fresh active state',async()=>{
 const e=fixture();e.receive(target);await e.tick();assert.equal(e.refs.length,1);assert.equal(e.refs[0].enabled,true);
 for(let i=0;i<10;i++)await e.tick();assert.equal(e.refs.length,1);
 e.receive(null);await e.tick();assert.equal(e.refs[0].deleted,true);
 e.receive(target);await e.tick();e.disconnect();await e.tick();assert.ok(e.refs.every(r=>r.deleted));e.connect();await e.tick();assert.equal(e.refs.length,2);
 e.receive(target);await e.tick();assert.equal(e.refs.length,3);assert.equal(e.refs[2].enabled,true);
});
test('loading/different cells suppress beacon, returning restores it without duplicate handlers',async()=>{
 const e=fixture();e.world(0);e.cell(2);e.receive(target);await e.tick();assert.equal(e.refs.length,0);
 e.world(60);e.loading(true);await e.tick();assert.equal(e.refs.length,0);e.loading(false);await e.tick();assert.equal(e.refs.length,1);
 e.cell(3);await e.tick();assert.equal(e.refs[0].deleted,true);await e.tick();assert.equal(e.refs.filter(r=>!r.deleted).length,1);
 const count=e.handlers.size;e.install();await e.tick();assert.equal(e.handlers.size,count);assert.ok(e.refs.every(r=>r.deleted));
 e.ctx._expired=true;await e.tick();assert.equal(e.handlers.size,0);
});
test('late placement after abandon/disposal is deleted while disabled and cannot leak a visible effect',async()=>{
 const e=fixture(),resolve=e.defer();e.receive(target);await e.tick();assert.equal(e.refs.length,1);assert.equal(e.refs[0].enabled,false);
 e.receive(null);e.ctx._expired=true;await e.tick();resolve();for(let i=0;i<20;i++)await Promise.resolve();assert.equal(e.refs[0].enabled,false);assert.equal(e.refs[0].deleted,true);
});
test('malformed/unknown targets never spawn world objects',async()=>{
 const e=fixture();for(const bad of [{...target,pos:[Infinity,0,0]},{...target,cell:'bad:Unknown.esm'},{...target,pos:[1e15,0,0]},{}]){e.receive(bad);await e.tick();}assert.equal(e.refs.length,0);
});
test('loadGame retires old local references but restores an unchanged active contract in the loaded cell',async()=>{
 const e=fixture();e.receive(target);await e.tick();e.emit('loadGame');await e.tick();await e.tick();assert.equal(e.refs[0].deleted,true);assert.equal(e.refs.filter(r=>!r.deleted&&r.enabled).length,1);
});
test('failed asynchronous deletion continues after disposal and replacement waits for cleanup',async()=>{
 const e=fixture();e.receive(target);await e.tick();let attempts=0;const ref=e.refs[0];ref.delete=()=>{if(++attempts===1)return Promise.reject(Error('temporarily unloaded'));ref.deleted=true;return Promise.resolve();};
 e.install();e.receive(target);await e.tick();assert.equal(e.refs.length,1);assert.equal(ref.enabled,false);await e.tick();await e.tick();await e.tick();assert.ok(attempts>=2);assert.equal(ref.deleted,true);assert.equal(e.refs.filter(r=>!r.deleted).length,1);
});
test('native world-projected fallback remains at destination while mesh awaits a latent call and all owned glyphs clear on abandon',async()=>{
 const e=fixture(),resolve=e.defer(),texts=new Map();let seq=0;const sp=e.ctx.sp;
 let front=true;sp.worldPointToScreenPoint=()=>[[0.5,0.5,front?0.5:-0.5]];
 sp.createText=(_x,_y,text,color)=>{assert.equal(color[0],1);texts.set(++seq,{text});return seq;};sp.destroyText=id=>texts.delete(id);sp.setTextSize=(id,size)=>{assert.ok(size>0&&size<=1);texts.get(id).size=size;};sp.setTextRefr=(id,ref)=>texts.get(id).ref=ref;sp.setTextRefrOffset=(id,pos)=>texts.get(id).pos=pos;
 e.receive(target);await e.tick();assert.equal(e.refs[0].enabled,false);assert.equal(texts.size,1);assert.deepEqual([...texts.values()].map(t=>t.text),['[Courier]']);assert.ok([...texts.values()].every(t=>t.ref===0x14&&t.pos[0]===1000));
 for(let i=0;i<5;i++)await e.tick();assert.equal(seq,1);front=false;e.emit('update');assert.equal(texts.size,0);front=true;await e.tick();assert.equal(texts.size,1);e.receive(null);assert.equal(texts.size,0);resolve();await e.tick();assert.equal(texts.size,0);
});
test('replacement cleanup promise retains predecessor barrier across three successive installations',async()=>{
 const e=fixture();e.receive(target);await e.tick();let release;const old=e.refs[0];old.delete=()=>new Promise(r=>release=()=>{old.deleted=true;r();});
 e.install();await e.tick();e.install();e.receive(target);await e.tick();assert.equal(e.refs.length,1);release();for(let i=0;i<20;i++)await Promise.resolve();await e.tick();await e.tick();assert.equal(e.refs.filter(r=>!r.deleted).length,1);
});

test('one local cloned activator uses a shipped static beam and never mutates the vanilla base',async()=>{
 const e=fixture();e.receive(target);await e.tick();assert.equal(e.cloneCount(),1);assert.equal(e.refs[0].enabled,true);e.receive(null);await e.tick();e.install();e.receive(target);await e.tick();await e.tick();assert.equal(e.cloneCount(),1);assert.equal(e.refs.filter(r=>!r.deleted).length,1);
});
test('native placement returning null is diagnosed and throttled without recreating the clone',async()=>{
 const e=fixture();let attempts=0;e.ctx.sp.Game.getPlayer().placeAtMe=()=>{attempts++;return null;};e.receive(target);await e.tick();await e.tick();assert.equal(attempts,1);assert.equal(e.cloneCount(),1);assert.ok(e.failures.some(x=>x.includes('returned null')));
});
test('a missing clone API never mutates a vanilla form or pretends that an invisible effect succeeded',async()=>{
 const e=fixture();e.ctx.sp.Game.getFormFromFile=()=>({getFormID:()=>0x877f8});e.receive(target);await e.tick();assert.equal(e.refs.length,0);assert.ok(e.failures.some(x=>x.includes('TempClone')));
});
test('native object pool wrappers are never retained across promise callbacks',async()=>{
 const e=fixture(),pc=e.ctx.sp.Game.getPlayer(),spawn=pc.placeAtMe.bind(pc);
 pc.placeAtMe=(...args)=>{const actual=spawn(...args);return {getFormID:actual.getFormID,setPosition(){throw Error('expired native pool wrapper');},disableNoWait(){throw Error('expired native pool wrapper');},delete(){throw Error('expired native pool wrapper');}};};
 e.receive(target);await e.tick();assert.equal(e.refs[0].enabled,true);e.receive(null);await e.tick();assert.equal(e.refs[0].deleted,true);
});


test('projection is refreshed every frame without waiting for 500ms lifecycle tick',async()=>{
 const e=fixture(),sp=e.ctx.sp;let offsets=0;sp.worldPointToScreenPoint=()=>[[.5,.5,.5]];sp.createText=()=>1;sp.destroyText=()=>{};sp.setTextSize=()=>{};sp.setTextRefr=()=>{};sp.setTextRefrOffset=()=>offsets++;
 e.receive(target);await e.tick();const before=offsets;e.frame();assert.ok(offsets>before);assert.equal(e.refs.length,1);
});
test('preview replaces the owned reference, uses a separate local base, and off removes all effects',async()=>{
 const e=fixture();e.receive(target);await e.tick();e.receive({...target,style:'orb'});await e.tick();await e.tick();assert.equal(e.refs[0].deleted,true);assert.equal(e.refs.filter(r=>!r.deleted).length,1);assert.equal(e.cloneCount(),2);e.receive({...target,style:'off'});await e.tick();assert.ok(e.refs.every(r=>r.deleted));
});

test('expanded visual palette contains distinct shipped effect families',()=>{
 for(const id of ['portal','vortex','column','rune','summon','arcane','holy'])assert.ok(beaconStyles.some(s=>s.id===id),'missing '+id);
 assert.ok(!beaconStyles.some(s=>s.id==='seal'),'collision-bearing seal must remain excluded');
 assert.equal(new Set(beaconStyles.map(s=>s.id)).size,beaconStyles.length);assert.equal(new Set(beaconStyles.map(s=>s.model.toLowerCase())).size,beaconStyles.length);
});
test('every fixed preview can replace the previous one and clean up without accumulating visible references',async()=>{
 const e=fixture();for(const style of beaconStyles){e.receive({...target,style:style.id});await e.tick();await e.tick();assert.equal(e.refs.filter(r=>!r.deleted).length,1,style.id);assert.equal(e.refs.filter(r=>!r.deleted&&r.enabled).length,1,style.id);}
 assert.equal(e.cloneCount(),beaconStyles.length);e.receive(null);await e.tick();assert.ok(e.refs.every(r=>r.deleted));
});
