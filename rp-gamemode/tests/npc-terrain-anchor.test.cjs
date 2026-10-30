const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {NpcService}=require('../.test-build/modules/npc/npc-service.js');

function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'fv-terrain-')),forms=new Map(),properties={};let next=0xff000001;
 const native={lookupEspmRecordById:()=>({record:{type:'NPC_'}}),makeProperty:(k,v)=>properties[k]=v,place(){const id=next++;forms.set(id,{baseDesc:'39f83:Skyrim.esm'});return id;},get:(id,k)=>forms.get(id)?.[k],set:(id,k,v)=>forms.get(id)[k]=structuredClone(v),setEnabled(){}};
 const service=new NpcService(native,{sessionForActor:()=>({guid:'s'}),fullLocation:()=>({cell:'3c:Skyrim.esm',pos:[0,0,0],rot:[0,0,0]})},root,()=>true,()=>{});service.start();service.execute(1,['create','clerk']);
 const pose=structuredClone([...forms.values()][0].frostveilNpcPose),calls=[],logs=[];let now=1000,pos=[0,0,0],rot=[0,0,0],loaded=true,deleted=false,id=5,world=60;
 const actor={isGhost:()=>false,setGhost:v=>calls.push(['ghost',v]),stopCombat:()=>calls.push(['combat']),stopCombatAlarm(){},enableAI:v=>calls.push(['ai',v]),setDontMove:v=>calls.push(['stationary',v]),clearKeepOffsetFromActor(){}};
 const ref={getFormID:()=>id,isDeleted:()=>deleted,is3DLoaded:()=>loaded,getWorldSpace:()=>({getFormID:()=>world}),getParentCell:()=>({getFormID:()=>world}),getPositionX:()=>pos[0],getPositionY:()=>pos[1],getPositionZ:()=>pos[2],getAngleX:()=>rot[0],getAngleY:()=>rot[1],getAngleZ:()=>rot[2],getAnimationVariableFloat:()=>0,getAnimationVariableBool:()=>false,stopTranslation:()=>calls.push(['stop']),setAnimationVariableFloat:()=>a.fail('No animation clamp')};
 const target={getFormID:()=>60};const ctx={value:pose,refr:ref,state:{},_model:{movement:{},animation:{animEventName:'IdleDialogueExpressive',numChanges:7}},sp:{Actor:{from:()=>actor},Game:{getFormFromFile:()=>target},Cell:{from:()=>null},WorldSpace:{from:()=>target},settings:{'skymp5-client':{'server-ip':'127.0.0.1','server-port':17777}},writeLogs:(key,line)=>logs.push(JSON.parse(line)),Debug:{sendAnimationEvent:()=>a.fail('No forced idle')},TESModPlatform:{moveRefrToPosition(_r,_c,_w,...values){calls.push(['move',...values]);pos=values.slice(0,3);rot=values.slice(3).map(x=>x*180/Math.PI);}}}};
 const update=vm.runInNewContext('(function(ctx){'+properties.frostveilNpcPose.updateNeighbor+'})',{Date:{now:()=>now}});
 t.after(()=>{service.stop();fs.rmSync(root,{recursive:true,force:true});});
 return {ctx,calls,logs,pose,step(ms=16){now+=ms;update(ctx);},position:v=>pos=v,rotation:v=>rot=v,loaded:v=>loaded=v,deleted:v=>deleted=v,id:v=>id=v,world:v=>world=v,moves:()=>calls.filter(c=>c[0]==='move')};
}

test('real observed pitch-only trigger is accepted inside the unchanged anchor envelope',t=>{
 const f=fixture(t);f.position([-0.0078125,0,0]);f.rotation([10.994688,0,0]);
 for(let i=0;i<10000;i++)f.step();a.equal(f.moves().length,0);a.equal(f.calls.filter(c=>c[0]==='stop').length,1);a.equal(f.calls.filter(c=>c[0]==='ai').length,1);
 a.equal(f.ctx._model.animation.animEventName,'IdleDialogueExpressive');a.equal(f.logs.length,20);a.equal(f.logs.at(-1).corrections,0);
});

test('flat HomHom baseline and legitimate bounded settling do not rebase the persistent anchor',t=>{
 const f=fixture(t),anchor=structuredClone(f.pose);for(let i=0;i<100;i++){f.position([Math.min(i/100,1),0,Math.min(i/20,4.6)]);f.rotation([i/10,-2,0]);f.step(100);}
 a.equal(f.moves().length,0);a.deepEqual(f.pose,anchor);a.equal(f.ctx._model.movement.runMode,'Standing');a.equal(f.ctx._model.movement.speed,0);
});

test('yaw-only correction preserves grounded coordinates and native tilt instead of resetting XYZ',t=>{
 const f=fixture(t);f.position([1.4,0,4.6]);f.rotation([10.99,-2,90]);f.step();
 const move=f.moves()[0];a.equal(f.moves().length,1);a.deepEqual(move.slice(1,4),[1.4,0,4.6]);a.ok(Math.abs(move[4]-10.99*Math.PI/180)<1e-9);a.ok(Math.abs(move[5]+2*Math.PI/180)<1e-9);a.equal(move[6],0);
 for(let i=0;i<1000;i++)f.step();a.equal(f.moves().length,1);
});

test('actual displacement, falling and a late translation still require stop-before-anchor correction',t=>{
 const f=fixture(t);f.step();for(const pos of [[2.01,0,0],[0,0,64.01],[0,0,-64.01]]){
  f.position(pos);f.calls.length=0;f.step();a.deepEqual(f.calls.map(c=>c[0]),['stop','move']);a.deepEqual(f.moves()[0].slice(1,4),[0,0,0]);f.step();a.equal(f.moves().length,1);
 }
});

test('explicit Move and Rotate converge without mutating pose data or stopping idle',t=>{
 const f=fixture(t);f.step();f.pose.pos=[100,200,30];f.step();a.deepEqual(f.moves().at(-1).slice(1,4),[100,200,30]);
 f.position([100.5,200,34]);f.pose.rot=[0,0,80];f.step();a.deepEqual(f.moves().at(-1).slice(1,4),[100.5,200,34]);a.ok(Math.abs(f.moves().at(-1)[6]-80*Math.PI/180)<1e-9);
 const count=f.moves().length;for(let i=0;i<1000;i++)f.step();a.equal(f.moves().length,count);a.deepEqual(f.pose.pos,[100,200,30]);a.equal(f.ctx._model.animation.numChanges,7);
});

test('streaming/reconnect state reacquires protection and rejects unloaded, deleted, wrong-world or nonfinite observations',t=>{
 const f=fixture(t);f.loaded(false);f.step();a.equal(f.calls.length,0);f.loaded(true);f.step();a.equal(f.calls.filter(c=>c[0]==='ghost').length,1);
 f.id(6);f.ctx.state={};f.rotation([11,0,0]);f.step();a.equal(f.calls.filter(c=>c[0]==='ghost').length,2);a.equal(f.moves().length,0);
 f.position([100,0,0]);f.world(61);f.step();a.equal(f.moves().length,0);f.world(60);f.deleted(true);f.step();a.equal(f.moves().length,0);f.deleted(false);
 f.position([NaN,0,0]);f.rotation([0,0,90]);f.step();a.equal(f.moves().length,0,'do not pass invalid coordinates to native calls');
});

test('diagnostics have bounded time context, correction reason and convergence without identity secrets',t=>{
 const f=fixture(t);for(let i=0;i<100;i++)f.step(500);a.equal(f.logs.length,20);
 a.equal(typeof f.logs[0].atMs,'number');a.equal(f.logs[0].reason,'IN_BOUNDS');a.equal(f.logs.at(-1).outcome,'STABLE_IN_BOUNDS');a.ok(f.logs.at(-1).elapsedMs>=1000);
 f.position([3,0,0]);f.pose.rot=[0,0,80];f.step(500);a.equal(f.logs.at(-1).reason,'POSITION_AND_YAW');
 a.equal(f.logs.some(row=>Object.keys(row).some(key=>/nonce|account|token|principal/i.test(key))),false);
});
