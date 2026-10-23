const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {guiPerformanceBrowser}=require('../.test-build/client/gui-performance.js');
test('opt-in browser profiler bounds diagnostics and cleans listeners/timers',()=>{
 const listeners=new Map(),messages=[];let tick,flush,time=10,cleared=0,cancelled=0;
 const document={addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:(k,v)=>{if(listeners.get(k)===v)listeners.delete(k);}};
 const window={skyrimPlatform:{sendMessage:(name,value)=>messages.push({name,value})}};
 const context={window,document,performance:{now:()=>time},requestAnimationFrame:cb=>{tick=cb;return 1;},cancelAnimationFrame:()=>cancelled++,setInterval:cb=>{flush=cb;return 1;},clearInterval:()=>cleared++};
 vm.runInNewContext('('+guiPerformanceBrowser.toString()+')()',context);
 vm.runInNewContext('('+guiPerformanceBrowser.toString()+')()',context);assert.equal(listeners.size,2);
 tick(10);listeners.get('mousemove')();tick(26);listeners.get('click')();time=42;window.__fvGuiProfile.response();
 for(let i=0;i<10000;i++)tick(42+i*16);flush();
 assert.equal(messages.length,1);assert.ok(messages[0].value.length<4096);const result=JSON.parse(messages[0].value);
 assert.equal(result.metrics[1].count,1);assert.equal(result.metrics[2].avgMs,32);assert.equal(result.metrics[0].p99Ms,16);
 window.__fvGuiProfile.dispose();assert.equal(listeners.size,0);assert.equal(cleared,1);assert.equal(cancelled,1);assert.equal(window.__fvGuiProfile,undefined);
});
test('production dialogue source excludes diagnostics unless explicitly enabled',()=>{
 const {dialogueSources}=require('../.test-build/client/dialogue.js');const before=process.env.FROSTVEIL_GUI_PROFILE;
 try{delete process.env.FROSTVEIL_GUI_PROFILE;assert.ok(!dialogueSources().event.includes('mouse_to_raf_proxy'));process.env.FROSTVEIL_GUI_PROFILE='1';assert.ok(dialogueSources().event.includes('mouse_to_raf_proxy'));}finally{if(before===undefined)delete process.env.FROSTVEIL_GUI_PROFILE;else process.env.FROSTVEIL_GUI_PROFILE=before;}
});
