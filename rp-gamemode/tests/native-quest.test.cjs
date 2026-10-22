const test=require('node:test'),assert=require('node:assert/strict');
const {installQuestNavigation}=require('../.test-build/client/quest-navigation.js');
const catalogue=require('../../../mod-work/frostveil-courier-navigation/catalogue.json');
function fixture(strict=false){const handlers=new Map(),quests=new Map(),logs=[],unsafe=[];let actor=1,connected=true,loading=false,now=0,pending,world=0x3c,aliasReads=0,inUpdate=false;
 for(const c of catalogue){const q={running:false,active:false,display:false,reference:0,starts:0,resets:0,isActive(){return this.active;},isRunning(){return this.running;},isStopped(){return !this.running;},start(){this.starts++;return pending?new Promise(r=>pending=()=>{this.running=true;r(true);}):(this.running=true,Promise.resolve(true));},stop(){this.running=false;this.reference=0;},reset(){this.resets++;},setActive(v){this.active=v;},setObjectiveDisplayed(_i,v){this.display=v;},setCurrentStageID(){return Promise.resolve(true);},getAlias(){aliasReads++;return{forceRefTo:r=>q.reference=r.id,getReference:()=>q.reference?{getFormID:()=>q.reference}:null,clear:()=>q.reference=0};}};quests.set(c.quest,q);}
 const ctx={getMyFormIdInServerFormat:()=>actor,sp:{storage:{},Game:{getFormFromFile:(id,file)=>{if(file!=='FrostveilCourierNavigation.esp'&&file!=='Skyrim.esm')throw Error('foreign file');return quests.get(id)??{id,getFormID:()=>id};},getPlayer:()=>({getWorldSpace:()=>({getFormID:()=>world}),getParentCell:()=>({getFormID:()=>0x97b4})})},Quest:{from:x=>x},ReferenceAlias:{from:x=>x},ObjectReference:{from:x=>({...x,getFormID:()=>x.id})},mpClientPlugin:{isConnected:()=>connected},Ui:{isMenuOpen:n=>n==='Loading Menu'&&loading},on:(n,f)=>{const a=handlers.get(n)??new Set();a.add(f);handlers.set(n,a);return[n,f];},unsubscribe:h=>handlers.get(h[0]).delete(h[1]),printConsole:s=>logs.push(s)}};
 // Installed SP rejects Game/Quest natives without a live VM stack. Promise
 // continuations and server property delivery are deliberately outside update.
 if(strict){for(const obj of [ctx.sp.Game,...quests.values()])for(const name of Object.keys(obj))if(typeof obj[name]==='function'){const call=obj[name];obj[name]=function(...args){if(!inUpdate){unsafe.push(name);throw Error('Native outside update: '+name);}return call.apply(this,args);};}}
 const install=()=>installQuestNavigation(ctx,catalogue,()=>now);install();const manager=()=>ctx.sp.storage.__rpQuestNavigationV1;
 return{ctx,quests,logs,unsafe,install,manager,aliasReads:()=>aliasReads,setWorld:v=>world=v,receive:v=>manager().receive(v),async tick(){for(let frame=0;frame<8;frame++){now+=250;inUpdate=true;try{for(const f of handlers.get('update')??[])f();}finally{inUpdate=false;}for(let i=0;i<25;i++)await Promise.resolve();}},disconnect(){connected=false;},reconnect(){connected=true;actor++;},loading:v=>loading=v,defer(){pending=true;return()=>{const p=pending;pending=undefined;p();};}};
}
const target={id:'job-a',targetKey:catalogue[2].key};
test('native objective is shown at unlimited range, idempotent, preserves manual untracking and clears on cancellation',async()=>{
 const e=fixture();e.receive(target);await e.tick();const q=e.quests.get(catalogue[2].quest);assert.equal(q.active,true);assert.equal(q.display,true);assert.equal(q.reference,catalogue[2].reference);
 q.active=false;for(let i=0;i<4;i++){e.receive(target);await e.tick();}assert.equal(q.starts,1);assert.equal(q.active,false);
 e.receive(null);await e.tick();assert.equal(q.running,false);assert.equal(q.display,false);assert.equal(q.reference,0);
 e.receive({...target,id:'job-b'});await e.tick();assert.equal(q.active,true);assert.equal(q.starts,2);
});
test('latent start cannot resurrect cancelled/replaced jobs; reconnect and loading restore only current objective',async()=>{
 const e=fixture(),release=e.defer();e.receive(target);await e.tick();e.receive(null);release();await e.tick();assert.ok([...e.quests.values()].every(q=>!q.display));
 e.loading(true);e.receive(target);await e.tick();assert.ok([...e.quests.values()].every(q=>!q.display));e.loading(false);await e.tick();assert.equal(e.quests.get(catalogue[2].quest).display,true);
 e.disconnect();await e.tick();assert.ok([...e.quests.values()].every(q=>!q.display));e.reconnect();e.receive({...target,id:'restored'});await e.tick();assert.equal(e.quests.get(catalogue[2].quest).active,true);
});
test('invalid catalogue keys and missing plugin fail visibly without touching vanilla quests',async()=>{
 const e=fixture();e.receive({id:'x',targetKey:'foreign'});await e.tick();assert.ok([...e.quests.values()].every(q=>!q.display));e.ctx.sp.Game.getFormFromFile=()=>null;e.receive(target);await e.tick();assert.ok(e.logs.some(x=>x.includes('unavailable')));
});

test('explicit door handoff preserves manual untracking for the same accepted job',async()=>{const e=fixture(),c=catalogue[5],t={id:'test',targetKey:c.key,explicitDoors:true};e.receive(t);await e.tick();const q=e.quests.get(c.quest);q.active=false;e.setWorld(0x16bb4);await e.tick();assert.equal(q.active,false);assert.equal(q.reference,c.approaches[1].reference);});

test('refuses a displayed marker when native alias binding silently fails',async()=>{const e=fixture(),q=e.quests.get(catalogue[2].quest);q.getAlias=()=>({forceRefTo(){},getReference:()=>null,clear(){}});e.receive(target);await e.tick();assert.equal(q.display,false);assert.ok(e.logs.some(s=>s.includes('Destination alias failed to bind')));});

test('initialization and repeated idle updates never read or clear aliases of stopped quests',async()=>{const e=fixture();assert.equal(e.aliasReads(),0,'Stopped quest alias read during installation');for(let i=0;i<5;i++)await e.tick();assert.equal(e.aliasReads(),0,'Idle cleanup invokes unsafe alias API');});

test('initialization, latent completion, cancellation and replacement cleanup use update VM context',async()=>{
 const e=fixture(true);e.receive(target);await e.tick();assert.equal(e.quests.get(2050).display,true,'Native start continuation must resume on update');
 e.receive(null);await e.tick();assert.equal(e.quests.get(2050).display,false);
 e.receive(target);await e.tick();e.install();await e.tick();assert.equal(e.quests.get(2050).display,false,'Replaced manager clears its native quest');
 assert.deepEqual(e.unsafe,[],'Native APIs invoked without update VM');
});

test('cancelled latent work cannot display between its completion callback and the next update',async()=>{
 const e=fixture(true),release=e.defer();e.receive(target);await e.tick();e.receive(null);release();for(let i=0;i<25;i++)await Promise.resolve();
 assert.ok([...e.quests.values()].every(q=>!q.display));await e.tick();assert.ok([...e.quests.values()].every(q=>!q.running));assert.deepEqual(e.unsafe,[]);
});

test('switching routing mode for the same job preserves the player journal tracking choice',async()=>{
 const e=fixture(true),c=catalogue[5];e.receive({id:'test',targetKey:c.key});await e.tick();const q=e.quests.get(2053);q.active=false;
 e.receive({id:'test',targetKey:c.key,explicitDoors:true});await e.tick();assert.equal(q.reference,0x42284);assert.equal(q.active,false);
});

test('primitive tint status follows confirmed objective, manual untracking, cancellation and disconnect',async()=>{
 const e=fixture(true);e.receive(target);assert.equal(e.manager().status().displayed,false);await e.tick();
 assert.deepEqual(e.manager().status(),{error:'',displayed:true,tracked:true,targetKey:target.targetKey});
 e.quests.get(2050).active=false;await e.tick();assert.equal(e.manager().status().tracked,false);
 e.receive(null);assert.equal(e.manager().status().displayed,false);await e.tick();
 e.receive(target);await e.tick();e.disconnect();await e.tick();assert.equal(e.manager().status().displayed,false);assert.deepEqual(e.unsafe,[]);
});

test('SP3 null alias return uses the ESP forced reference without hiding missing alias definitions',async()=>{
 const e=fixture(true),q=e.quests.get(2050);q.getAlias=()=>null;q.getNumAliases=()=>1;
 e.receive(target);await e.tick();assert.equal(q.display,true,'known forced-reference objective must not depend on broken SP3 alias return conversion');assert.equal(e.manager().status().error,'');assert.deepEqual(e.unsafe,[]);
 const wrong=fixture(true),bad=wrong.quests.get(2050);bad.getAlias=()=>null;bad.getNumAliases=()=>0;wrong.receive(target);await wrong.tick();assert.equal(bad.display,false);assert.match(wrong.manager().status().error,/alias.*(definition|count|unavailable)/i);
});

test('a null alias bridge never silently points an explicit door objective at the interior instead',async()=>{
 const e=fixture(true),q=e.quests.get(2053);q.getAlias=()=>null;q.getNumAliases=()=>1;
 e.receive({id:'test',targetKey:catalogue[5].key,explicitDoors:true});await e.tick();assert.equal(q.display,false);assert.match(e.manager().status().error,/door|native routing/i);
});
