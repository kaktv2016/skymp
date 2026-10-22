// Phase 2.2 tests intentionally written but NOT EXECUTED by the agent.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRuntime } = require('../.test-build/runtime.js');
const { SkyMpAdapter } = require('../.test-build/engine/adapter.js');
const { EventRouter } = require('../.test-build/core/event-router.js');
const { selectRecipients } = require('../.test-build/modules/chat/chat-service.js');
const { CHAT_EVENT, CHAT_INBOX } = require('../.test-build/modules/chat/contracts.js');
function fixture(options = {}) {
  let online = [0xff000000], now = 10000, guid = 'one';
  const fields = new Map(); const timers = new Set(), writes = [], properties = [], sources = [];
  const mp = {
    get(actor, key) {
      if (key === 'onlinePlayers') return online;
      if (key === 'profileId') return actor === 0xff000000 ? 1 : 2;
      if (key === 'locationalData') return { cellOrWorldDesc: '3c:Skyrim.esm', pos: [actor === 0xff000000 ? 0 : 100, 0, 0], rot: [0,0,0] };
      return fields.get(actor + ':' + key) ?? null;
    },
    set(actor, key, value) { assert.ok(key === 'private.rp.v1.identity' || key === CHAT_INBOX); fields.set(actor + ':' + key, structuredClone(value)); writes.push([actor,key,value]); },
    getActorName() { return 'Aldric'; }, getDescFromId(actor) { return actor === 0xff000000 ? '0' : '1'; },
    getUserByActor(actor) { return actor === 0xff000000 ? 0 : 1; }, getUserActor(user) { return user === 0 ? 0xff000000 : 0xff000001; },
    isConnected() { return true; }, getUserGuid() { return guid; },
    makeProperty(name, spec) { properties.push([name,spec]); }, makeEventSource(name, body) { sources.push([name,body]); },
  };
  const runtime = createRuntime(mp, { chat: { ...options, now: () => now }, scheduler: { every(_ms, fn) { timers.add(fn); return () => timers.delete(fn); } }, logger: { info(){}, error(){} } });
  return { mp, runtime, fields, writes, properties, sources, setOnline: v => online = v, advance: () => now += 1000, reconnect: () => guid = 'two', tick: () => [...timers].forEach(f => f()) };
}
const request = (id, text) => ({ v:1, id, text });
const messages = env => env.fields.get('4278190080:' + CHAT_INBOX).messages;
test('chat event source passes native client-event prefix gate and dispatches to owned hook',async()=>{
  const fs=require('node:fs'),path=require('node:path');
  const native=fs.readFileSync(path.resolve(__dirname,'../../skymp5-server/cpp/server_guest_lib/ActionListener.cpp'),'utf8');
  assert.ok(native.includes("msg.eventName[0] != '_'"),'Review native custom-event naming contract if it changes');
  const e=fixture();await e.runtime.start();
  const [eventName]=e.sources[0];
  // Model ActionListener::OnCustomEvent, not direct invocation of ChatService.
  function fromNative(name,sender,payload) {
    if(!name || name[0]!=='_') return;
    return e.mp[name](sender,payload);
  }
  assert.equal(fromNative('onRpChatV1',0xff000000,request('rejected','Ignored')),undefined);
  assert.equal(messages(e).length,1);
  assert.equal(eventName,CHAT_EVENT);assert.ok(eventName.startsWith('_'));
  assert.equal(fromNative(eventName,0xff000000,request('accepted','Hello')),true);
  await Promise.resolve();
  assert.ok(messages(e).some(m=>m.text==='Aldric: Hello'));
  await e.runtime.stop();assert.equal(e.mp[eventName],undefined);
});
test('normal/me/do/whoami reuse server identity and expose no private IDs', async () => {
  const e=fixture(); await e.runtime.start();
  for (const [id,text] of [['a','Hello'],['b','/me draws his sword'],['c','/do There is blood'],['d','/whoami']]) { await e.runtime.chat.receive(0xff000000,request(id,text)); e.advance(); }
  const out=messages(e); assert.ok(out.some(m=>m.text==='Aldric: Hello'));
  assert.ok(out.some(m=>m.text==='* Aldric draws his sword'));
  assert.ok(out.some(m=>m.kind==='DO' && m.text==='[DO] There is blood'));
  assert.ok(out.some(m=>m.kind==='System' && m.text==='RP name: Aldric'));
  assert.ok(out.every(m=>!('profileId' in m) && !('guid' in m) && !('actorId' in m)));
  await e.runtime.stop();
});
test('empty/unknown/invalid commands and Unicode bounds give explicit feedback', async () => {
  const e=fixture(); await e.runtime.start();
  for(const [id,text] of [['a',' '],['b','/unknown'],['c','/me'],['d','/whoami extra'],['e','x'.repeat(281)],['f','\u0000bad']]) { await e.runtime.chat.receive(0xff000000,request(id,text)); e.advance(); }
  const out=messages(e); assert.ok(out.some(m=>m.text.includes('empty'))); assert.ok(out.some(m=>m.text.includes('Command not found')));
  assert.ok(out.some(m=>m.text.includes('Usage: /me'))); assert.ok(out.some(m=>m.text.includes('Usage: /whoami')));
  await e.runtime.chat.receive(0xff000000,request('thai','สวัสดี ชาวเมือง')); e.advance();
  assert.ok(messages(e).some(m=>m.text.includes('สวัสดี ชาวเมือง')));
  await e.runtime.chat.receive(0xff000000,request('emoji','😀'.repeat(280)));
  assert.ok(messages(e).some(m=>m.kind==='Local' && m.text.includes('😀'))); await e.runtime.stop();
});
test('duplicate request is not dispatched twice; throttle and reconnect are session scoped', async () => {
  const e=fixture(); await e.runtime.start();
  await e.runtime.chat.receive(0xff000000,request('same','Hello'));
  await e.runtime.chat.receive(0xff000000,request('same','Hello'));
  await e.runtime.chat.receive(0xff000000,request('fast','Too fast'));
  assert.equal(messages(e).filter(m=>m.text==='Aldric: Hello').length,1);
  assert.ok(messages(e).some(m=>m.text.includes('wait')));
  e.reconnect(); await e.runtime.chat.receive(0xff000000,request('same','New session'));
  assert.ok(messages(e).some(m=>m.text.includes('New session'))); await e.runtime.stop();
});
test('native cell/distance routing includes self and never broadcasts or trusts client IDs', async () => {
  const e=fixture(); e.setOnline([0xff000000,0xff000001]); await e.runtime.start();
  assert.deepEqual(selectRecipients(new SkyMpAdapter(e.mp),0xff000000,2000),[0xff000000,0xff000001]);
  assert.deepEqual(selectRecipients(new SkyMpAdapter(e.mp),0xff000000,10),[0xff000000]);
  const get=e.mp.get; e.mp.get=(actor,key)=>key==='locationalData' && actor===0xff000001? {cellOrWorldDesc:'1:Skyrim.esm',pos:[0,0,0]}:get(actor,key);
  assert.deepEqual(selectRecipients(new SkyMpAdapter(e.mp),0xff000000,2000),[0xff000000]);
  await e.runtime.chat.receive(0xff000000,{...request('spoof','Hello'),actorId:0xff000001});
  assert.ok(!messages(e).some(m=>m.text==='Aldric: Hello'));
  e.mp.isConnected=()=>false; const writes=e.writes.length;
  await e.runtime.chat.receive(0xff000000,request('stale','Hello')); assert.equal(e.writes.length,writes); await e.runtime.stop();
});
test('bounded inbox and native owner-only transport do not change physical state', async () => {
  const e=fixture({ inboxLimit:3 }); await e.runtime.start();
  for(let i=0;i<8;i++){await e.runtime.chat.receive(0xff000000,request(String(i),'Hello'));e.advance();}
  assert.equal(messages(e).length,3);
  assert.equal(e.properties[0][0],CHAT_INBOX); assert.equal(e.properties[0][1].isVisibleByOwner,true); assert.equal(e.properties[0][1].isVisibleByNeighbors,false);
  assert.equal(e.sources[0][0],CHAT_EVENT); assert.ok(e.sources[0][1].includes('sendEvent'));
  await e.runtime.stop(); assert.equal(e.mp[CHAT_EVENT],undefined); assert.deepEqual(e.runtime.commands.list(),[]);
});
test('event router preserves existing handler, rejects duplicate ownership and restores on dispose', () => {
  const old=()=>true, raw={ event:old }; const router=new EventRouter(raw); let calls=0;
  const dispose=router.register('event',()=>{calls++;}); assert.throws(()=>router.register('event',()=>{}));
  raw.event(12,{}); assert.equal(calls,1); dispose(); assert.equal(raw.event,old); dispose(); assert.equal(raw.event,old);
});
