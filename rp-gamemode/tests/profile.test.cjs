// Phase 2.3 source-only tests. User runs build/tests; agent did not execute.
const test=require('node:test'),assert=require('node:assert/strict');
const {createRuntime}=require('../.test-build/runtime.js');
const {actorId}=require('../.test-build/engine/ids.js');
const {CHAT_EVENT,CHAT_INBOX}=require('../.test-build/modules/chat/contracts.js');
const ID='private.rp.v1.identity',ACTOR=0xff000000;
function fixture(metadata={schemaVersion:1,displayName:'Hibire01'}) {
  const fields=new Map([[ID,structuredClone(metadata)]]),writes=[],timers=[];
  let time=10000,guid='one',connected=true;
  const mp={get:(actor,key)=>key==='onlinePlayers'?[ACTOR]:key==='profileId'?1:key==='locationalData'?{cellOrWorldDesc:'3c:Skyrim.esm',pos:[0,0,0]}:fields.get(key)??null,
    set:(actor,key,value)=>{assert.equal(actor,ACTOR);assert.ok([ID,CHAT_INBOX].includes(key));writes.push(key);fields.set(key,structuredClone(value));},
    getActorName:()=> 'Native name',getDescFromId:()=> '0',getUserByActor:()=>0,getUserActor:()=>ACTOR,isConnected:()=>connected,getUserGuid:()=>guid,
    makeProperty(){},makeEventSource(){}};
  const runtime=createRuntime(mp,{scheduler:{every:(_ms,fn)=>{timers.push(fn);return()=>{};}},logger:{info(){},error(){}},chat:{now:()=>time},profile:{now:()=>time}});
  return {runtime,mp,fields,writes,advance:()=>time+=2000,reconnect:()=>guid='two',disconnect:()=>connected=false,
    command:text=>runtime.commands.dispatch(text,{actorId:actorId(ACTOR)}),identity:()=>fields.get(ID),inbox:()=>fields.get(CHAT_INBOX)};
}
test('schema1 lookup is unchanged; commands edit same identity and whoami reads new RP name',async()=>{
  const e=fixture();await e.runtime.start();
  assert.equal((await e.command('/profile')).ok,true);
  assert.equal((await e.command('/setrpname  Aldric   Stormborn ')).ok,true);
  assert.equal(e.identity().displayName,'Aldric Stormborn');e.advance();
  assert.equal((await e.command('/setbio A former soldier')).ok,true);e.advance();
  assert.equal((await e.command('/whoami')).data.metadata.displayName,'Aldric Stormborn');
  assert.equal((await e.command('/setbio --clear')).ok,true);assert.equal(e.identity().biography,'');
  assert.equal(e.identity().schemaVersion,1);await e.runtime.stop();
});
test('central update validation preserves Thai/combining marks and rejects invalid/partial changes',async()=>{
  const e=fixture();await e.runtime.start();
  const bad=['',' ','A','x'.repeat(41),'\u0000bad','bad\ud800'];
  for(const displayName of bad) {
    const before=structuredClone(e.identity()),count=e.writes.filter(k=>k===ID).length;
    assert.equal(e.runtime.identity.update(actorId(ACTOR),{displayName,biography:'new'}).ok,false);
    assert.deepEqual(e.identity(),before);assert.equal(e.writes.filter(k=>k===ID).length,count);
  }
  assert.equal(e.runtime.identity.update(actorId(ACTOR),{displayName:'  นักรบ   ไทย  ',biography:'ชีวิต\nใหม่'}).ok,true);
  assert.equal(e.identity().displayName,'นักรบ ไทย');assert.equal(e.identity().biography,'ชีวิต ใหม่');e.advance();
  assert.equal(e.runtime.identity.update(actorId(ACTOR),{biography:'ก\u0e48'}).ok,true);e.advance();
  assert.equal(e.runtime.identity.update(actorId(ACTOR),{biography:'x'.repeat(241)}).ok,false);
  assert.equal(e.runtime.identity.update(actorId(ACTOR),{actorId:ACTOR,displayName:'Other'}).ok,false);
});
test('updates throttle current sessions and reject disconnected ownership without native state writes',async()=>{
  const e=fixture();await e.runtime.start();
  assert.equal((await e.command('/setrpname First Name')).ok,true);
  assert.equal((await e.command('/setbio Too fast')).code,'PROFILE_THROTTLED');
  e.reconnect();assert.equal((await e.command('/setbio New session')).ok,true);
  e.disconnect();const before=structuredClone(e.identity());
  assert.equal((await e.command('/setrpname Wrong Owner')).ok,false);assert.deepEqual(e.identity(),before);
});
test('legacy lengths remain readable; unsupported schemas/unknown metadata are not overwritten',async()=>{
  const legacy={schemaVersion:1,displayName:'x'.repeat(64),biography:'y'.repeat(512)};
  const e=fixture(legacy);await e.runtime.start();assert.equal((await e.command('/profile')).ok,true);
  assert.deepEqual(e.identity(),legacy);
  for(const saved of [{schemaVersion:2,displayName:'Future'},{schemaVersion:1,displayName:'Known',futureField:'keep'}]) {
    e.fields.set(ID,structuredClone(saved));
    assert.equal(e.runtime.identity.update(actorId(ACTOR),{displayName:'Changed'}).ok,false);
    assert.deepEqual(e.identity(),saved);
  }
});
test('UI requests reuse chat event; strict ownership/payload gate, private replies and reconnect reads',async()=>{
  const e=fixture();await e.runtime.start();
  await e.runtime.chat.receive(ACTOR,{v:1,id:'read',op:'profile-read'});
  assert.equal(e.inbox().profile.action,'open');assert.equal(e.inbox().profile.profile.displayName,'Hibire01');
  assert.equal('actorId' in e.inbox().profile.profile,false);assert.equal('guid' in e.inbox().profile.profile,false);
  const bad={v:1,id:'bad',op:'profile-save',displayName:'Stolen',biography:'x',actorId:ACTOR};
  const before=structuredClone(e.identity());e.advance();await e.runtime.chat.receive(ACTOR,bad);
  assert.deepEqual(e.identity(),before);assert.equal(e.inbox().profile.action,'error');e.advance();
  await e.runtime.chat.receive(ACTOR,{v:1,id:'save',op:'profile-save',displayName:'ตัวละคร ไทย',biography:'ชีวิตใหม่'});
  assert.equal(e.inbox().profile.action,'saved');assert.equal(e.identity().displayName,'ตัวละคร ไทย');e.advance();
  await e.runtime.chat.receive(ACTOR,{v:1,id:'duplicate',op:'profile-save',displayName:'Next',biography:'ok'});
  e.advance();await e.runtime.chat.receive(ACTOR,{v:1,id:'duplicate',op:'profile-save',displayName:'Must not write',biography:'ok'});
  assert.equal(e.identity().displayName,'Next');e.reconnect();
  await e.runtime.chat.receive(ACTOR,{v:1,id:'reopen',op:'profile-read'});
  assert.equal(e.inbox().profile.profile.displayName,'Next');assert.equal(typeof e.mp[CHAT_EVENT],'function');
});
test('real chat command result opens owner sheet with readable fallback and new name reaches me/whoami',async()=>{
  const e=fixture();await e.runtime.start();
  await e.runtime.chat.receive(ACTOR,{v:1,id:'profile',text:'/profile'});
  assert.equal(e.inbox().profile.action,'open');assert.equal(e.inbox().profile.requestId,'profile');
  assert.ok(e.inbox().messages.some(m=>m.kind==='System' && m.text.includes('RP profile: Hibire01')));e.advance();
  await e.runtime.chat.receive(ACTOR,{v:1,id:'name',text:'/setrpname นักรบ ไทย'});e.advance();
  await e.runtime.chat.receive(ACTOR,{v:1,id:'whoami',text:'/whoami'});e.advance();
  await e.runtime.chat.receive(ACTOR,{v:1,id:'me',text:'/me waves'});
  assert.ok(e.inbox().messages.some(m=>m.text==='RP name: นักรบ ไทย'));
  assert.ok(e.inbox().messages.some(m=>m.text==='* นักรบ ไทย waves'));
});
test('malformed UI operation, oversized biography and spoofed native sender never update identity',async()=>{
  const e=fixture();await e.runtime.start();const before=structuredClone(e.identity());
  for(const payload of [{v:1,id:'object',op:{toString:null}},{v:1,id:'oversized',op:'profile-save',displayName:'Good',biography:'x'.repeat(241)}]) {
    await e.runtime.chat.receive(ACTOR,payload);assert.equal(e.inbox().profile.action,'error');assert.deepEqual(e.identity(),before);e.advance();
  }
  const writes=e.writes.length;
  await e.runtime.chat.receive(ACTOR+1,{v:1,id:'wrong-owner',op:'profile-save',displayName:'Stolen',biography:''});
  assert.equal(e.writes.length,writes);assert.deepEqual(e.identity(),before);
});
