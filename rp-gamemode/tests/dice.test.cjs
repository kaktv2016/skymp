// WRITE ONLY. User runs tests; no statistical/gameplay certification is implied.
const test=require('node:test'),assert=require('node:assert/strict');
const {DiceService}=require('../.test-build/modules/dice/dice-service.js');
const {diceSettings}=require('../.test-build/modules/dice/dice-module.js');
const {createRuntime}=require('../.test-build/runtime.js');
const {CHAT_INBOX,CHAT_EVENT}=require('../.test-build/modules/chat/contracts.js');
test('dice defaults to D20 and injected RNG receives inclusive bounds as exclusive upper bound',()=>{
  const bounds=[];
  const low=new DiceService((min,max)=>{bounds.push([min,max]);return min;});
  const high=new DiceService((_min,max)=>max-1);
  assert.equal(low.roll(),1);assert.deepEqual(bounds[0],[1,21]);
  for(const sides of [2,6,20,100]){assert.equal(low.roll(sides),1);assert.equal(high.roll(sides),sides);}
});
test('invalid sizes never invoke RNG; invalid injected results are refused',()=>{
  let calls=0;const dice=new DiceService(()=>{calls++;return 1;});
  for(const value of [0,1,-2,2.5,101,Infinity,NaN,'20',null])assert.throws(()=>dice.roll(value));
  assert.equal(calls,0);
  for(const value of [0,21,2.5,NaN])assert.throws(()=>new DiceService(()=>value).roll());
});
function fixture(settings={}) {
  let at=10000,guid='one',connected=true,online=[0xff000000],next=20,calls=0;
  const values=new Map(),writes=[],locations=new Map([[0xff000000,{cellOrWorldDesc:'3c:Skyrim.esm',pos:[0,0,0]}],[0xff000001,{cellOrWorldDesc:'3c:Skyrim.esm',pos:[100,0,0]}]]);
  const mp={get:(actor,key)=>key==='onlinePlayers'?online:key==='profileId'?actor-0xff000000+1:key==='locationalData'?locations.get(actor):values.get(actor+':'+key)??null,
    set:(actor,key,value)=>{assert.ok(['private.rp.v1.identity',CHAT_INBOX].includes(key));writes.push([actor,key]);values.set(actor+':'+key,structuredClone(value));},
    getActorName:()=> 'Native name',getDescFromId:()=> '0',getUserByActor:actor=>actor-0xff000000,getUserActor:user=>0xff000000+user,
    isConnected:()=>connected,getUserGuid:()=>guid,makeProperty(){},makeEventSource(){}};
  const runtime=createRuntime(mp,{chat:{now:()=>at},dice:{...settings,rng:(_min,max)=>{calls++;return Math.min(next,max-1);}},scheduler:{every:()=>()=>{}},logger:{info(){},error(){}}});
  const send=(text,id='req'+at)=>runtime.chat.receive(0xff000000,{v:1,id,text});
  return {mp,runtime,values,writes,locations,send,calls:()=>calls,setRoll:v=>next=v,advance:()=>at+=1000,setOnline:v=>online=v,
    disconnect:()=>connected=false,reconnect:()=>{connected=true;guid='two';},messages:actor=>values.get((actor??0xff000000)+':'+CHAT_INBOX).messages};
}

test('server dice settings reject invalid DC/length and reserve the chat command prefix',()=>{
  assert.deepEqual(diceSettings(280),{tryDc:11,actionMaxLength:240});
  assert.equal(diceSettings(10).actionMaxLength,5);
  for(const tryDc of [0,21,1.5,NaN])assert.throws(()=>diceSettings(280,{tryDc}));
  for(const actionMaxLength of [-1,276,1.5,NaN])assert.throws(()=>diceSettings(280,{actionMaxLength}));
});
test('commands use current RP identity and existing local chat transport for D20/D6/D100',async()=>{
  const e=fixture();await e.runtime.start();
  e.values.set('4278190080:private.rp.v1.identity',{schemaVersion:1,displayName:'นักรบ ไทย'});
  for(const input of ['/roll','/roll 6','/roll 20','/roll 100']){await e.send(input);e.advance();}
  assert.equal(e.calls(),4);assert.ok(e.messages().some(m=>m.text==='[ROLL] นักรบ ไทย rolled D6 → 6'));
  assert.ok(e.messages().some(m=>m.text==='[ROLL] นักรบ ไทย rolled D20 → 20'));
  assert.ok(e.messages().some(m=>m.text==='[ROLL] นักรบ ไทย rolled D100 → 20'));
  for(const command of ['me','do','whoami','profile','setrpname','setbio','roll','try'])assert.ok(e.runtime.commands.list().includes(command));
  assert.equal(typeof e.mp[CHAT_EVENT],'function');await e.runtime.stop();assert.deepEqual(e.runtime.commands.list(),[]);
});
test('try success/failure boundary, Thai/emoji, configured DC and action limit',async()=>{
  const e=fixture();await e.runtime.start();
  e.setRoll(10);await e.send('/try สะเดาะกุญแจหีบ');e.advance();
  e.setRoll(11);await e.send('/try ปีนกำแพง 😀');
  assert.ok(e.messages().some(m=>m.text.includes('ล้มเหลว (10/20)')));
  assert.ok(e.messages().some(m=>m.text.includes('ปีนกำแพง 😀') && m.text.includes('สำเร็จ (11/20)')));
  e.advance();await e.send('/try พยายามปีนกำแพง');
  assert.ok(e.messages().some(m=>m.text.includes('พยายามปีนกำแพง → สำเร็จ')));
  assert.ok(e.messages().every(m=>!m.text.includes('พยายามพยายาม')));
  const strict=fixture({tryDc:20,actionMaxLength:5});await strict.runtime.start();strict.setRoll(19);
  await strict.send('/try hello');assert.ok(strict.messages().some(m=>m.text.includes('ล้มเหลว (19/20)')));strict.advance();
  strict.setRoll(20);await strict.send('/try 😀😀😀😀😀');assert.ok(strict.messages().some(m=>m.text.includes('สำเร็จ (20/20)')));strict.advance();
  await strict.send('/try too long');assert.equal(strict.calls(),2);
});
test('bad arguments, malformed Unicode, extra forged fields, throttles and duplicate IDs consume no extra rolls',async()=>{
  const e=fixture();await e.runtime.start();
  for(const text of ['/roll 1','/roll 101','/roll 2.5','/roll -6','/roll NaN','/roll 1e2','/roll 6 fake-name','/try','/try '+ 'x'.repeat(241),'/try bad\ud800','/try bad\ninput','/unknown']){await e.send(text);e.advance();}
  assert.equal(e.calls(),0);assert.ok(e.messages().some(m=>m.kind==='System'));
  await e.runtime.chat.receive(0xff000000,{v:1,id:'forged',text:'/roll',result:100,success:true});e.advance();assert.equal(e.calls(),0);
  await e.send('/roll','same');await e.send('/roll','same');await e.send('/roll','throttled');assert.equal(e.calls(),1);
  e.advance();await e.send('/roll','same');assert.equal(e.calls(),1);
  e.disconnect();e.advance();await e.send('/roll','offline');assert.equal(e.calls(),1);
  e.reconnect();await e.send('/roll','same');assert.equal(e.calls(),2);
  assert.ok(e.writes.every(([,key])=>['private.rp.v1.identity',CHAT_INBOX].includes(key)));
});

test('missing identity and RNG errors return feedback without producing a dice message',async()=>{
  const e=fixture();await e.runtime.start();
  e.values.delete('4278190080:private.rp.v1.identity');await e.send('/roll');assert.equal(e.calls(),0);
  e.values.set('4278190080:private.rp.v1.identity',{schemaVersion:1,displayName:'Current name'});
  e.advance();e.setRoll(0);await e.send('/roll');assert.equal(e.calls(),1);
  assert.ok(e.messages().some(m=>m.text==='Command handler failed'));
  assert.equal(e.messages().filter(m=>m.text.startsWith('[ROLL]')).length,0);
  await e.runtime.stop();
});
test('same-cell recipients get one result; other cells excluded; invalid sender location never broadcasts',async()=>{
  const e=fixture();e.setOnline([0xff000000,0xff000001]);await e.runtime.start();
  await e.send('/roll');assert.ok(e.messages(0xff000001).some(m=>m.text.startsWith('[ROLL]')));e.advance();
  e.locations.set(0xff000001,{cellOrWorldDesc:'1:Skyrim.esm',pos:[0,0,0]});const before=e.messages(0xff000001).length;
  await e.send('/try waves');assert.equal(e.messages(0xff000001).length,before);e.advance();
  e.locations.set(0xff000001,{cellOrWorldDesc:'3c:Skyrim.esm',pos:[2001,0,0]});
  await e.send('/roll');assert.equal(e.messages(0xff000001).length,before);e.advance();
  e.locations.delete(0xff000000);await e.send('/roll');assert.equal(e.messages(0xff000001).length,before);
  assert.ok(e.messages().some(m=>m.text.includes('Chat unavailable')));
});
