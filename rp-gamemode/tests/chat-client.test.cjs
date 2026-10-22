// Source-only Phase 2.2 tests; agent did not execute them.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { chatSources } = require('../dist/rp-gamemode.cjs');
const { defaults } = require('../.test-build/modules/chat/contracts.js');
function environment(storage={}) {
  const handlers=new Map(), scripts=[], urls=[], logs=[];
  let focus=false, visible=true, remote=1, connected=true, menu=false, at=1000, textInput=false;
  const sp={storage, writeLogs:(plugin,line)=>{assert.equal(plugin,'rpChat');logs.push(line);}, browser:{setVisible:v=>visible=v,isVisible:()=>visible,setFocused:v=>focus=v,isFocused:()=>focus,loadUrl:u=>urls.push(u),executeJavaScript:s=>{new vm.Script(s);scripts.push(s);}},
    Ui:{isMenuOpen:()=>menu,isTextInputEnabled:()=>textInput},mpClientPlugin:{isConnected:()=>connected},
    on:(name,fn)=>{const handle={name,fn};handlers.set(handle,fn);return handle;},unsubscribe:handle=>handlers.delete(handle)};
  const sent=[], ctx={sp,sendEvent:p=>sent.push(p),getMyFormIdInServerFormat:()=>remote};
  const world=vm.createContext({ctx,Date:{now:()=>at},Math,JSON});
  const source=chatSources(defaults);
  const install=()=>new vm.Script(source.event).runInContext(world);
  const emit=(name,event={})=>[...handlers.keys()].filter(h=>h.name===name).forEach(h=>h.fn(event));
  install();
  return {sp,ctx,sent,scripts,urls,logs,source,world,install,emit,handlers,ready:()=>emit('browserMessage',{arguments:['rp-chat-v1','ready']}),tick:()=>{at+=300;emit('update');},focus:()=>focus,visible:()=>visible,disconnect:()=>{connected=false;remote=0;},connect:()=>{connected=true;remote=1;},menu:v=>menu=v,textInput:v=>textInput=v};
}
const f7={device:0,code:65,isDown:true,isRepeating:false};
test('late CEF ESC close from a previous focus lease cannot close one-press F7 reopen',()=>{
 const e=environment();e.ready();e.tick();e.emit('buttonEvent',f7);
 const first=e.scripts.filter(s=>/ChatUiV1.open\(/.test(s)).at(-1).match(/open\((\d+)\)/);assert.ok(first,'open has a focus lease');
 e.emit('buttonEvent',{...f7,code:1});e.tick();e.emit('buttonEvent',f7);assert.equal(e.focus(),true);
 e.emit('browserMessage',{arguments:['rp-chat-v1','close',undefined,Number(first[1])]});assert.equal(e.focus(),true);
 e.emit('browserMessage',{arguments:['rp-chat-v1','focus-check',undefined,Number(first[1])]});assert.equal(e.focus(),true);
});
test('native Escape does not dismiss an active RP IME composition and stale composition signals cannot own new focus',()=>{
 const e=environment();e.ready();e.tick();e.emit('buttonEvent',f7);const lease=Number(e.scripts.filter(s=>/ChatUiV1.open\(/.test(s)).at(-1).match(/open\((\d+)\)/)[1]);
 e.emit('browserMessage',{arguments:['rp-chat-v1','composition','start',lease]});assert.equal(e.sp.storage.__rpChatClientV1.isComposing(),true);
 e.emit('buttonEvent',{...f7,code:1});assert.equal(e.focus(),true);
 e.emit('browserMessage',{arguments:['rp-chat-v1','composition','end',lease]});e.emit('buttonEvent',{...f7,code:1});assert.equal(e.focus(),false);
 e.tick();e.emit('buttonEvent',f7);e.emit('browserMessage',{arguments:['rp-chat-v1','composition','start',lease]});assert.equal(e.sp.storage.__rpChatClientV1.isComposing(),false);
});
test('upstream key router owns toggling once; arbitrarily delayed CEF F7 cannot reverse a newly opened lease',()=>{
 const e=environment({__rpChatNativeKeysV2:true});e.ready();e.tick();const manager=e.sp.storage.__rpChatClientV1;
 assert.equal(typeof manager.handleKeys,'function');
 manager.handleKeys(true,false);assert.equal(e.focus(),true);manager.handleKeys(false,false);e.tick();
 e.emit('browserMessage',{arguments:['rp-chat-v1','toggle',undefined,1]});assert.equal(e.focus(),true);
 manager.handleKeys(false,true);assert.equal(e.focus(),false);manager.handleKeys(false,false);
 manager.handleKeys(true,false);assert.equal(e.focus(),true);
 e.emit('buttonEvent',f7);assert.equal(e.focus(),true);manager.handleKeys(true,false);assert.equal(e.focus(),true);
 manager.handleKeys(false,false);manager.handleKeys(true,false);assert.equal(e.focus(),false);
});
test('actual string-only CEF control envelope closes ESC and one F7 reopens with submit authority; stale close is rejected',()=>{
 const e=environment({__rpChatNativeKeysV2:true});e.ready();e.tick();const manager=e.sp.storage.__rpChatClientV1;
 manager.handleKeys(true,false);manager.handleKeys(false,false);
 const send=(kind,value,lease)=>e.emit('browserMessage',{arguments:['rp-chat-v2',kind,JSON.stringify({value,lease})]});
 send('close',null,1);assert.equal(e.focus(),false);manager.handleKeys(true,false);manager.handleKeys(false,false);assert.equal(e.focus(),true);
 send('close',null,1);assert.equal(e.focus(),true);send('submit','ทดสอบหลัง ESC',2);assert.equal(e.sent.at(-1).text,'ทดสอบหลัง ESC');
});
test('first F7 restores native input even if upstream Escape unfocused browser before its CEF close arrived',()=>{
 const e=environment({__rpChatNativeKeysV2:true});e.ready();e.tick();const manager=e.sp.storage.__rpChatClientV1;
 manager.handleKeys(true,false);manager.handleKeys(false,false);assert.equal(e.focus(),true);
 e.sp.browser.setFocused(false);manager.handleKeys(true,false);assert.equal(e.focus(),true);
 e.emit('browserMessage',{arguments:['rp-chat-v2','submit',JSON.stringify({lease:2,value:'หลัง ESC'})]});assert.equal(e.sent.at(-1).text,'หลัง ESC');
});
test('browser Cursor Menu keeps chat open; inventory closes it without undoing upstream visibility',()=>{
  const e=environment();e.ready();e.tick();e.emit('buttonEvent',f7);
  assert.equal(e.focus(),true);
  // BrowserApiTilted::SetFocused(true) queues this menu to show the cursor.
  e.emit('menuOpen',{name:'Cursor Menu'});
  e.emit('menuOpen',{name:'HUD Menu'});
  for(let i=0;i<10;i++)e.tick();
  assert.equal(e.focus(),true);
  e.emit('browserMessage',{arguments:['rp-chat-v1','submit','Hello']});
  assert.equal(e.sent.length,1);
  // Existing BrowserService hides CEF when an inventory menu opens.
  e.sp.browser.setVisible(false);e.menu(true);
  e.emit('menuOpen',{name:'InventoryMenu'});
  assert.equal(e.focus(),false);assert.equal(e.visible(),false);
  e.menu(false);e.sp.browser.setVisible(true);e.emit('buttonEvent',f7);
  assert.equal(e.focus(),true);
  e.emit('buttonEvent',{device:0,code:1,isDown:true,isRepeating:false});
  assert.equal(e.focus(),false);
});
test('F7 uses the exported Ui class and respects its text-input guard',()=>{
  const e=environment();assert.equal(e.sp.UI,undefined);
  e.ready();e.tick();e.textInput(true);e.emit('buttonEvent',f7);
  assert.equal(e.focus(),false);
  e.textInput(false);e.emit('buttonEvent',f7);assert.equal(e.focus(),true);
});
// SP's legacy storage returns a callable placeholder for an unset property.
// A plain object mock concealed the real first-install failure.
function legacyStorage() {
  return new Proxy({}, {get(target,key) {
    if(key in target) return target[key];
    return function(){throw new Error('Property "'+String(key)+'" is not defined in storage');};
  }});
}
test('legacy SP storage initializes chat and disposes real managers without duplicate handlers',async()=>{
  const e=environment(legacyStorage());
  assert.ok(e.logs.some(line=>line.includes('client source installed')));
  const count=e.handlers.size;assert.ok(count>0);
  e.ready();e.tick();e.emit('buttonEvent',f7);assert.equal(e.focus(),true);
  e.install();assert.equal(e.handlers.size,count);assert.equal(e.focus(),false);
  e.ctx._expired=true;e.tick();for(let i=0;i<12;i++)await Promise.resolve();assert.equal(e.handlers.size,0);
  assert.equal(typeof e.sp.storage.__rpChatClientV1,'function');
});
test('owner delivery ignores unset legacy storage and retries after chat is installed',()=>{
  const e=environment(legacyStorage());
  e.sp.storage.__rpChatClientV1.dispose();
  e.ctx.value={v:1,epoch:'legacy',messages:[{seq:1,kind:'System',sender:'',text:'Ready'}]};
  const count=e.scripts.length;
  new vm.Script(e.source.owner).runInContext(e.world);
  assert.equal(e.scripts.length,count);
  assert.equal(typeof e.sp.storage.__rpChatDeliveredV1,'function');
  e.install();e.ready();e.tick();
  new vm.Script(e.source.owner).runInContext(e.world);
  assert.ok(e.scripts[e.scripts.length-1].includes('.receive('));
  const delivered=e.scripts.length;
  new vm.Script(e.source.owner).runInContext(e.world);assert.equal(e.scripts.length,delivered);
});
test('client file diagnostics expose readiness gates without recording chat content',()=>{
  const e=environment();e.tick();e.emit('buttonEvent',f7);
  assert.ok(e.logs.some(line=>line.includes('client source installed')));
  assert.ok(e.logs.some(line=>line.includes('connected=true ready=false')));
  e.sp.writeLogs=()=>{throw new Error('Unwritable log');};e.ready();e.emit('buttonEvent',f7);assert.equal(e.focus(),true);
});
test('missing CEF handshake loads isolated local bootstrap once and retries installation finitely',()=>{
  const e=environment(); for(let i=0;i<30;i++)e.tick();
  assert.deepEqual(e.urls,[defaults.uiUrl]);
  e.emit('browserMessage',{arguments:['rp-chat-root-ready']});e.ready();e.emit('buttonEvent',f7);
  assert.equal(e.focus(),true);
  const count=e.scripts.length;for(let i=0;i<10;i++)e.tick();assert.equal(e.urls.length,1);assert.equal(e.scripts.length,count);
});
test('working upstream CEF handshake never navigates away from existing UI',()=>{
  const e=environment();e.ready();for(let i=0;i<20;i++)e.tick();assert.equal(e.urls.length,0);
});
test('serialized bundle client source has no unresolved imports and prevents duplicate handlers',async()=>{
  const e=environment();const count=e.handlers.size;e.install();assert.equal(e.handlers.size,count);
  e.ctx._expired=true;e.tick();for(let i=0;i<12;i++)await Promise.resolve();assert.equal(e.handlers.size,0);assert.equal(e.sp.storage.__rpChatClientV1,undefined);
});
test('F7 respects menus/other text input; chat close and disconnect release browser focus',()=>{
  const e=environment();e.ready();e.tick();e.menu(true);e.emit('buttonEvent',f7);assert.equal(e.focus(),false);
  e.menu(false);e.textInput(true);e.emit('buttonEvent',f7);assert.equal(e.focus(),false);
  e.textInput(false);e.emit('buttonEvent',f7);assert.equal(e.focus(),true);
  e.emit('browserMessage',{arguments:['rp-chat-v1','submit','สวัสดี']});assert.equal(e.sent.length,1);assert.equal(e.sent[0].text,'สวัสดี');assert.equal('actorId' in e.sent[0],false);
  e.emit('browserMessage',{arguments:['rp-chat-v1','close']});assert.equal(e.focus(),false);assert.equal(e.visible(),true);
  e.emit('buttonEvent',f7);e.disconnect();e.tick();assert.equal(e.focus(),false);assert.ok(e.scripts.some(s=>s.includes('.clear()')));
  e.connect();e.tick();e.emit('buttonEvent',f7);assert.equal(e.focus(),true);
});
test('owner inbox is delivered once per sequence and treats hostile text as data',()=>{
  const e=environment();e.ready();e.tick();
  e.ctx.value={v:1,epoch:'one',messages:[{seq:1,kind:'Local',sender:'A',text:'</script><img onerror=alert(1)>\u2028สวัสดี'}]};
  new vm.Script(e.source.owner).runInContext(e.world);const length=e.scripts.length;
  new vm.Script(e.source.owner).runInContext(e.world);assert.equal(e.scripts.length,length);
  assert.ok(e.scripts[length-1].includes('\\u2028'));
});
test('CEF page reload while typing releases focus before replacing hidden UI',()=>{
  const e=environment();e.ready();e.tick();e.emit('buttonEvent',f7);assert.equal(e.focus(),true);
  const handles=e.handlers.size;
  e.emit('browserMessage',{arguments:['front-loaded']});assert.equal(e.focus(),false);
  e.ready();assert.equal(e.handlers.size,handles);
  e.emit('buttonEvent',f7);assert.equal(e.focus(),true);
});
test('browser renders hostile/Thai text literally and bounds history without HTML insertion',()=>{
  const e=environment();
  function node(tag) {
    const value={tagName:tag.toUpperCase(),style:{},children:[],listeners:{},value:'',scrollHeight:0,scrollTop:0,
      appendChild(n){this.children.push(n);return n;},removeChild(n){this.children.splice(this.children.indexOf(n),1);},
      addEventListener(n,f){this.listeners[n]=f;},removeEventListener(n){delete this.listeners[n];},focus(){doc.activeElement=this;},blur(){doc.activeElement=null;},remove(){}};
    Object.defineProperty(value,'firstChild',{get(){return this.children[0];}});
    let text='';Object.defineProperty(value,'textContent',{get(){return text;},set(v){text=v;this.children=[];}});
    Object.defineProperty(value,'innerHTML',{set(){throw new Error('Unsafe HTML rendering');}});
    return value;
  }
  const doc={activeElement:null,createElement:node,body:node('body')};
  const sent=[],win={skyrimPlatform:{sendMessage:(...args)=>{if(args[0]==='rp-chat-v2'){const p=JSON.parse(args[2]);sent.push(['rp-chat-v1',args[1],p.value,p.lease]);}else sent.push(args);}},addEventListener(){},removeEventListener(){}};
  const uiWorld=vm.createContext({window:win,document:doc});
  new vm.Script(e.scripts[0]).runInContext(uiWorld);
  const root=doc.body.children[0],history=root.children[1],input=root.children[2];
  const hostile='<img onerror=alert(1)> สวัสดี';
  win.__rpChatUiV1.receive({v:1,epoch:'x',messages:[{seq:1,kind:'Local',sender:'A',text:hostile}]});
  assert.equal(history.children[0].textContent,hostile);
  for(let i=2;i<150;i++)win.__rpChatUiV1.receive({v:1,epoch:'x',messages:[{seq:i,kind:'ME',sender:'A',text:'* A moves'}]});
  assert.equal(history.children.length,100);
  win.__rpChatUiV1.open();input.value='สวัสดี';
  input.listeners.keydown({key:'Enter',isComposing:true,preventDefault(){},stopPropagation(){}});
  assert.equal(sent.filter(a=>a[1]==='submit').length,0);
  input.listeners.keydown({key:'Enter',isComposing:false,preventDefault(){},stopPropagation(){}});
  assert.equal(sent.find(a=>a[1]==='submit')[2],'สวัสดี');
  input.value='/whoami';
  input.listeners.keydown({key:'Unidentified',keyCode:13,isComposing:false,preventDefault(){},stopPropagation(){}});
  assert.equal(sent.filter(a=>a[1]==='submit').length,2);
  assert.equal(sent.filter(a=>a[1]==='submit')[1][2],'/whoami');
  input.value='composition';
  input.listeners.keydown({key:'Enter',keyCode:229,isComposing:false,preventDefault(){},stopPropagation(){}});
  input.listeners.keydown({key:'Enter',keyCode:13,isComposing:false,repeat:true,preventDefault(){},stopPropagation(){}});
  assert.equal(sent.filter(a=>a[1]==='submit').length,2);
  assert.ok(sent.some(a=>a[1]==='key-diagnostic'));
});
test('native transport and location source contracts remain explicit',()=>{
  const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'../..');
  const read=n=>fs.readFileSync(path.join(root,n),'utf8');
  const custom=read('skymp5-server/cpp/server_guest_lib/gamemode_events/CustomEvent.cpp');assert.ok(custom.includes('newArray.push_back(refrId)'));
  const location=read('skymp5-server/cpp/addon/property_bindings/LocationalDataBinding.cpp');assert.ok(location.includes('"cellOrWorldDesc"'));assert.ok(location.includes('"pos"'));
  const platform=read('skyrim-platform/src/platform_se/codegen/convert-files/skyrimPlatform.ts');for(const name of ['isTextInputEnabled','isMenuOpen','unsubscribe','executeJavaScript'])assert.ok(platform.includes(name));
  const uiClass=platform.match(/export declare class Ui extends PapyrusObject \{([\s\S]*?)\n\}/);
  assert.ok(uiClass,'Native export must be Ui with matching capitalization');
  for(const name of ['isTextInputEnabled','isMenuOpen'])assert.ok(uiClass[1].includes('static '+name+'('));
});
