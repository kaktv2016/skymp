// WRITE ONLY: tests actual serialized functions with legacy SP storage/CEF mocks.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {chatSources}=require('../dist/rp-gamemode.cjs');
const {defaults}=require('../.test-build/modules/chat/contracts.js');
const {browserProfile}=require('../.test-build/client/profile-ui.js');
function client() {
  const handlers=new Map(),scripts=[],sent=[],focusChanges=[];
  const storage=new Proxy({}, {get:(target,key)=>key in target?target[key]:()=>{throw Error('Unset storage');}});
  let focus=false,visible=true,connected=true,actor=1,at=1000,menu=false;
  const sp={storage,browser:{executeJavaScript:code=>{new vm.Script(code);scripts.push(code);},loadUrl(){},setVisible:v=>visible=v,isVisible:()=>visible,setFocused:v=>{focusChanges.push(v);focus=v;},isFocused:()=>focus},
    Ui:{isTextInputEnabled:()=>false,isMenuOpen:()=>menu},mpClientPlugin:{isConnected:()=>connected},
    on:(name,fn)=>{const h={name,fn};handlers.set(h,fn);return h;},unsubscribe:h=>handlers.delete(h)};
  const ctx={sp,sendEvent:p=>sent.push(p),getMyFormIdInServerFormat:()=>actor},world=vm.createContext({ctx,Date:{now:()=>at},Math,JSON});
  const sources=chatSources(defaults),emit=(name,e={})=>[...handlers.keys()].filter(h=>h.name===name).forEach(h=>h.fn(e));
  const install=()=>new vm.Script(sources.event).runInContext(world);install();
  const tick=()=>{at+=300;emit('update');};tick();
  emit('browserMessage',{arguments:['rp-chat-v1','ready']});emit('browserMessage',{arguments:['rp-profile-v1','ready']});
  const f7=()=>emit('buttonEvent',{device:0,code:65,isDown:true,isRepeating:false});
  const owner=profile=>{ctx.value={v:1,epoch:'now',messages:[{seq:scripts.length+1,kind:'System',sender:'',text:'Profile'}],profile};new vm.Script(sources.owner).runInContext(world);};
  return {sp,ctx,sent,scripts,handlers,focusChanges,emit,install,tick,f7,owner,focus:()=>focus,visible:()=>visible,menu:v=>menu=v,
    disconnect:()=>{connected=false;actor=0;},connect:()=>{connected=true;actor=1;}};
}
const profile={schemaVersion:1,displayName:'ตัวละคร',biography:'ชีวิตใหม่',limits:{nameMin:2,nameMax:40,biographyMax:240,intervalMs:1000}};
test('profile takes chat focus once; save has no actor/account fields; F7 returns to chat',()=>{
  const e=client();e.f7();e.emit('browserMessage',{arguments:['rp-chat-v1','submit','/profile']});
  const id=e.sent[0].id,count=e.handlers.size;
  e.owner({token:'one',requestId:id,action:'open',message:'Profile',profile});
  assert.equal(e.focus(),true);assert.ok(e.scripts.some(s=>s.includes('__rpProfileUiV1.open()')));
  assert.deepEqual(e.focusChanges,[true]); // No Cursor Menu hide/show on panel transfer.
  e.emit('menuOpen',{name:'Cursor Menu'});e.tick();assert.equal(e.focus(),true);
  e.emit('browserMessage',{arguments:['rp-chat-v1','submit','must not send while sheet owns focus']});assert.equal(e.sent.length,1);
  e.emit('browserMessage',{arguments:['rp-profile-v1','save',JSON.stringify({displayName:'ชื่อใหม่',biography:'ไทย'})]});
  assert.equal(e.sent.length,2);assert.deepEqual(Object.keys(e.sent[1]).sort(),['biography','displayName','id','op','v']);
  assert.equal(e.sent[1].op,'profile-save');assert.equal(e.handlers.size,count);
  e.f7();assert.equal(e.focus(),true);assert.deepEqual(e.focusChanges,[true]);e.emit('browserMessage',{arguments:['rp-chat-v1','submit','Chat again']});assert.equal(e.sent.length,3);
  e.install();assert.equal(e.handlers.size,count);
});
test('stale persisted profile cannot open; inventory/disconnect clear draft and pending-open intent',()=>{
  const e=client();e.owner({token:'old',requestId:'previous-client',action:'open',message:'Old',profile});assert.equal(e.focus(),false);
  e.f7();e.emit('browserMessage',{arguments:['rp-chat-v1','submit','/profile']});const id=e.sent[0].id;
  e.owner({token:'fresh',requestId:id,action:'open',message:'Profile',profile});
  e.sp.browser.setVisible(false);e.menu(true);e.emit('menuOpen',{name:'InventoryMenu'});assert.equal(e.focus(),false);assert.equal(e.visible(),false);
  e.menu(false);e.sp.browser.setVisible(true);e.f7();e.emit('browserMessage',{arguments:['rp-chat-v1','submit','/profile']});const pending=e.sent[1].id;
  e.disconnect();e.tick();assert.equal(e.focus(),false);assert.ok(e.scripts.some(s=>s.includes('__rpProfileUiV1.clear()')));
  e.connect();e.tick();e.owner({token:'late',requestId:pending,action:'open',message:'Late',profile});assert.equal(e.focus(),false);
});
test('character sheet keeps drafts local, renders text safely, saves explicitly and preserves failed edits',()=>{
  let doc;const events={},messages=[],timeouts=new Map();let timer=0;
  function node(tag){const n={tagName:tag.toUpperCase(),style:{},children:[],listeners:{},value:'',disabled:false,
    appendChild(x){this.children.push(x);},addEventListener(k,f){this.listeners[k]=f;},removeEventListener(k){delete this.listeners[k];},
    focus(){doc.activeElement=this;},blur(){if(doc.activeElement===this)doc.activeElement=null;},remove(){}};
    Object.defineProperty(n,'innerHTML',{set(){throw Error('Unsafe HTML');}});return n;}
  doc={body:node('body'),createElement:node,activeElement:null};
  const win={skyrimPlatform:{sendMessage:(...args)=>messages.push(args)},addEventListener:(k,f)=>events[k]=f,removeEventListener:k=>delete events[k],
    setTimeout:f=>{timeouts.set(++timer,f);return timer;},clearTimeout:id=>timeouts.delete(id)};
  new vm.Script('('+browserProfile.toString()+')();').runInContext(vm.createContext({window:win,document:doc}));
  const ui=win.__rpProfileUiV1,root=doc.body.children[0],name=root.children[3],bio=root.children[5],status=root.children[6],save=root.children[7],cancel=root.children[8];
  ui.receive({token:'open',requestId:'open',action:'open',message:'Read',profile});ui.open();
  name.value='<b>ชื่อใหม่</b>';bio.value='ไทย';assert.equal(messages.filter(m=>m[1]==='save').length,0);
  save.listeners.click();save.listeners.click();assert.equal(messages.filter(m=>m[1]==='save').length,1);assert.equal(save.disabled,true);
  ui.expect('req');ui.receive({token:'error',requestId:'req',action:'error',message:'Invalid name'});
  assert.equal(name.value,'<b>ชื่อใหม่</b>');assert.equal(status.textContent,'Invalid name');assert.equal(save.disabled,false);
  save.listeners.click();ui.expect('ok');ui.receive({token:'saved',requestId:'ok',action:'saved',message:'Saved',profile:{...profile,displayName:'<b>ชื่อใหม่</b>'}});
  assert.equal(root.children[1].textContent,'<b>ชื่อใหม่</b>');assert.equal(timeouts.size,0);
  cancel.listeners.click();assert.equal(root.style.display,'none');assert.equal(name.value,'');
  ui.clear();ui.open();assert.equal(root.style.display,'none');ui.dispose();assert.equal(win.__rpProfileUiV1,undefined);
});
