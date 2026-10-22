const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {browserChat}=require('../.test-build/client/chat-ui.js');
const {defaults}=require('../.test-build/modules/chat/contracts.js');
function ui(){
 let doc;const events={},sent=[];
 function node(tag){return {tagName:tag.toUpperCase(),style:{},children:[],listeners:{},value:'',selectionStart:0,selectionEnd:0,
 appendChild(n){this.children.push(n);},removeChild(n){this.children.splice(this.children.indexOf(n),1);},remove(){},
 addEventListener(k,f){this.listeners[k]=f;},removeEventListener(k){delete this.listeners[k];},focus(){doc.activeElement=this;},blur(){doc.activeElement=null;},setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;}};}
 doc={activeElement:null,body:node('body'),createElement:node};
 const win={skyrimPlatform:{sendMessage:(...a)=>{if(a[0]==='rp-chat-v2'){const p=JSON.parse(a[2]);sent.push(['rp-chat-v1',a[1],p.value,p.lease]);}else sent.push(a);}},addEventListener:(k,f)=>events[k]=f,removeEventListener:k=>delete events[k]};
 vm.runInNewContext('('+browserChat.toString()+')('+JSON.stringify(defaults)+')',{document:doc,window:win});
 const input=doc.body.children[0].children[2],api=win.__rpChatUiV1;api.open(1);
 const type=(v,caret=v.length)=>{input.value=v;input.setSelectionRange(caret,caret);input.listeners.input?.({});};
 const key=(key,extra={})=>{let prevented=false;input.listeners.keydown({key,preventDefault(){prevented=true;},stopPropagation(){},...extra});return prevented;};
 return {input,api,sent,events,type,key,commands:()=>api.receive({v:1,epoch:'x',messages:[],commands:['/job','/job status','/job accept','/job abandon','/job deliver','/job upgrades','/job upgrade satchel','/profile','/me','/do']})};
}
test('Tab cycles registered command tokens/subcommands and preserves following Thai arguments',()=>{
 const e=ui();e.commands();e.type('/jo');assert.equal(e.key('Tab'),true);assert.equal(e.input.value,'/job');
 e.type('/job a');e.key('Tab');assert.equal(e.input.value,'/job abandon');e.key('Tab');assert.equal(e.input.value,'/job accept');e.key('Tab',{shiftKey:true});assert.equal(e.input.value,'/job abandon');
 e.type('/job upgrade s');e.key('Tab');assert.equal(e.input.value,'/job upgrade satchel');
 e.type('/m สวัสดี',2);e.key('Tab');assert.equal(e.input.value,'/me สวัสดี');
 e.type('ordinary text');assert.equal(e.key('Tab'),false);assert.equal(e.input.value,'ordinary text');assert.equal(e.sent.filter(x=>x[1]==='submit').length,0);
});
test('command catalog includes intermediate registered subcommands and unregister removes them',()=>{
 const {CommandRegistry}=require('../.test-build/core/command-registry.js'),registry=new CommandRegistry();
 const unregister=registry.register('job',()=>({ok:true,data:null}),'courier',['status','upgrade satchel']);
 assert.ok(registry.completions().includes('/job upgrade'));unregister();assert.deepEqual(registry.completions(),[]);
});
test('the physical opening F7 cannot dismiss its own CEF input; keyup rearms one explicit close intent',()=>{
 const e=ui();e.key('F7');assert.equal(e.sent.filter(m=>m[1]==='close').length,0);
 e.events.keyup({key:'F7'});e.key('F7');assert.equal(e.sent.filter(m=>m[1]==='close').length,1);
});
test('sent history is bounded/deduplicated, arrows restore draft without executing and clear removes private history',()=>{
 const e=ui();e.type('สวัสดี');e.key('Enter');e.type('/job status');e.key('Enter');e.type('/job status');e.key('Enter');
 e.type('ยังไม่ส่ง');e.key('ArrowUp');assert.equal(e.input.value,'/job status');e.key('ArrowUp');assert.equal(e.input.value,'สวัสดี');e.key('ArrowDown');assert.equal(e.input.value,'/job status');e.key('ArrowDown');assert.equal(e.input.value,'ยังไม่ส่ง');
 assert.equal(e.sent.filter(x=>x[1]==='submit').length,3);e.type('');e.key('Enter');assert.equal(e.sent.filter(x=>x[1]==='submit').length,3);
 e.api.clear();e.api.open(2);e.key('ArrowUp');assert.equal(e.input.value,'');
});
test('IME composition and modified editing keys are not intercepted; stale close cannot dismiss reopened input',()=>{
 const e=ui();e.commands();e.type('/jo');assert.equal(e.key('Tab',{isComposing:true}),false);assert.equal(e.input.value,'/jo');
 e.input.listeners.compositionstart?.({});e.key('Enter');e.key('Escape');assert.equal(e.sent.filter(x=>x[1]==='submit'||x[1]==='close').length,0);e.input.listeners.compositionend?.({});
 assert.equal(e.key('ArrowUp',{ctrlKey:true}),false);e.key('Escape');e.api.open(2);e.api.close(1);assert.equal(e.input.value,'/jo');assert.equal(e.key('F7'),true);e.events.keyup({key:'F7'});e.key('F7');assert.ok(e.sent.some(x=>x[1]==='close'));
});
