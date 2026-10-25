// Actual pinned client source under inert platform mocks. NOT a Skyrim render test.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const repo=path.resolve(__dirname,'../../..');
const {transformSync}=require(path.join(repo,'skymp5-server/node_modules/esbuild'));
function load(file,dependencies={}){
 const code=transformSync(fs.readFileSync(path.join(repo,'skymp5-client/src',file),'utf8'),{loader:'ts',format:'cjs',target:'node22'}).code,module={exports:{}};
 const empty=new Proxy({ClientListener:class{}},{get:(t,k)=>t[k]??(()=>{})});
 vm.runInNewContext('(function(require,module,exports){'+code+'\n})',{console,Date,Map,Set,Promise})(name=>dependencies[name]??empty,module,module.exports);
 return module.exports;
}
const clone=v=>JSON.parse(JSON.stringify(v));
function visualFixture(){
 const forms=new Map(),placed=[],generated=[],retired=[];let next=0xff100000;
 const base=id=>{const b={id,name:'stock',getFormID:()=>id,getType:()=>43,setName:n=>{b.name=n;}};forms.set(id,b);return b;};
 const shared=base(0x39f83),alternative=base(0x1000010);
 const player={placeAtMe(b){const id=++next,r={getFormID:()=>id,getBaseObject:()=>b,setDisplayName:n=>{r.displayName=n;}};forms.set(id,r);placed.push(b.id);return r;}};
 const cleaner={modWcProtection(){},getFormRetirementGuard:()=>()=>true,retireForm:id=>retired.push(id)};
 const sp={Game:{getFormEx:id=>forms.get(id)??null,getPlayer:()=>player},Actor:{from:()=>null},ActorBase:{from:v=>v?.getType?.()===43?v:null},ObjectReference:{from:v=>v?.getBaseObject?v:null},FormType:{NPC:43},storage:{},printConsole(){}};
 const appearance={applyAppearance:a=>{generated.push(clone(a));return base(++next);}};
 const {FormView}=load('view/formView.ts',{'skyrimPlatform':sp,'../sync/appearance':appearance,'../extensions/objectReferenceEx':{ObjectReferenceEx:{getWorldOrCell:()=>0}},'../view/spawnProcess':{SpawnProcess:class{}},'./spawnProcess':{SpawnProcess:class{}},'../services/spApiInteractor':{SpApiInteractor:{getControllerInstance:()=>({lookupListener:()=>cleaner})}}});
 const profile=(name,weight=25)=>({name,weight,raceId:0x13746,isFemale:false,headpartIds:[],options:[],presets:[],tints:[]});
 const model=(id,baseId,a)=>({refrId:id,idx:id,baseId,appearance:a,numAppearanceChanges:1,movement:{worldOrCell:0x3c,pos:[0,0,0],rot:[0,0,0]}});
 return {FormView,shared,alternative,placed,generated,retired,forms,profile,model};
}
test('shared-base dynamic NPCs keep the stock base despite different appearance payloads',()=>{
 const h=visualFixture(),a=new h.FormView(0xff000000),b=new h.FormView(0xff000001);
 a.update(h.model(0xff000000,0x39f83,h.profile('A',25)));b.update(h.model(0xff000001,0x39f83,h.profile('B',75)));
 assert.deepEqual(h.placed,[0x39f83,0x39f83]);assert.equal(h.generated.length,0,'Current NPC baseId path bypasses generated appearance');
 assert.notEqual(a.getLocalRefrId(),b.getLocalRefrId());
});
test('preauthored distinct bases remain distinct without a local preset dependency',()=>{
 const h=visualFixture(),a=new h.FormView(0xff000000),b=new h.FormView(0xff000001);
 a.update(h.model(0xff000000,0x39f83,undefined));b.update(h.model(0xff000001,h.alternative.id,undefined));
 assert.deepEqual(h.placed,[h.shared.id,h.alternative.id]);assert.equal(h.generated.length,0);
});
test('missing-base player-like path is a positive control for per-view synthetic bases, not proof for NPCs',()=>{
 const h=visualFixture(),a=new h.FormView(0xff000000),b=new h.FormView(0xff000001);
 a.update(h.model(0xff000000,undefined,h.profile('A')));b.update(h.model(0xff000001,undefined,h.profile('B')));
 assert.equal(h.generated.length,2);assert.notEqual(h.placed[0],h.placed[1]);
});
test('stream destruction/recreation does not leak a local actor into the next view',()=>{
 const h=visualFixture(),a=new h.FormView(0xff000000),model=h.model(0xff000000,0x39f83,h.profile('A'));
 a.update(model);const first=a.getLocalRefrId();a.destroy();a.destroy();assert.deepEqual(h.retired,[first]);
 const b=new h.FormView(0xff000000);b.update(clone(model));assert.notEqual(b.getLocalRefrId(),first);assert.equal(h.placed.length,2);
});
test('name-only appearance updates write the shared base name: keep this path out of production NPC customization',()=>{
 const h=visualFixture(),a=new h.FormView(0xff000000),b=new h.FormView(0xff000001),p=h.profile('A');
 a.update(h.model(0xff000000,0x39f83,p));b.update(h.model(0xff000001,0x39f83,h.profile('B',75)));
 a.update({...h.model(0xff000000,0x39f83,{...p,name:'changed'}),numAppearanceChanges:2});assert.equal(h.shared.name,'changed');
});
test('tint helper requests unsafe base-ID mutation: source-level hazard, never invoked on Skyrim here',()=>{
 const calls=[],base={getFormID:()=>0x39f83},actor={getBaseObject:()=>base};
 const {applyTints}=load('sync/appearance.ts',{'skyrimPlatform':{Game:{getPlayer:()=>({getBaseObject:()=>({getFormID:()=>7})})},TESModPlatform:{clearTintMasks(){},pushTintMask(){},setFormIdUnsafe:(b,id)=>calls.push([b,id])}}});
 applyTints(actor,{tints:[]});assert.equal(calls[0][0],base);assert.equal(calls[0][1],7);
});
test('two independent simulated clients converge on server messages without claiming rendering/network acceptance',()=>{
 function client(){const storage={worldModel:{forms:[{},{}]}};const {RemoteServer}=load('services/services/remoteServer.ts',{'./clientListener':{ClientListener:class{}},'skyrimPlatform':{storage,on(){}}});const c=Object.create(RemoteServer.prototype);c.getIdManager=()=>({getId:idx=>idx});c.getMyActorIndex=()=>-1;return c;}
 const a=client(),b=client(),appearance={name:'A',weight:25},equipment={inv:{entries:[]},numChanges:2};
 for(const c of [a,b]){c.onUpdateAppearanceMessage(clone({message:{idx:0,data:appearance}}));c.onUpdateEquipmentMessage(clone({message:{idx:0,data:equipment}}));}
 assert.deepEqual(clone(a.worldModel),clone(b.worldModel));a.worldModel.forms[0].appearance.weight=50;assert.equal(b.worldModel.forms[0].appearance.weight,25);assert.deepEqual(a.worldModel.forms[1],{});
});
test('research entry point refuses implicit execution and containment rejects live storage',()=>{
 const {inside}=require('./native-poc.cjs'),{spawnSync}=require('node:child_process');assert.equal(inside('/audit','/audit/run/world'),true);assert.equal(inside('/audit','/live/world'),false);assert.equal(inside('/audit','/audit'),false);
 const p=spawnSync(process.execPath,[path.join(__dirname,'native-poc.cjs')],{encoding:'utf8',windowsHide:true});assert.notEqual(p.status,0);assert.match(p.stderr,/explicitly pass --isolated/);
});
