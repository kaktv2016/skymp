const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {EventEmitter} = require('node:events');
const esbuild = require('../../../skyrim-rp-launcher/node_modules/esbuild');
const root = path.resolve(__dirname,'../..');

function spawnClass() {
  let source = fs.readFileSync(path.join(root,'skymp5-server/ts/systems/spawn.ts'),'utf8');
  if(process.env.SPAWN_LOCATION_BASELINE === '1') {
    const map=JSON.parse(fs.readFileSync(path.join(root,'build/dist/server/dist_back/skymp5-server.js.map'),'utf8'));
    const i=map.sources.findIndex(s=>s.endsWith('/systems/spawn.ts'));
    assert.ok(i>=0,'deployed source map contains Spawn');source=map.sourcesContent[i];
  }
  const mod={exports:{}};
  vm.runInNewContext('(function(require,module,exports){'+esbuild.transformSync(source,{loader:'ts',format:'cjs'}).code+'\n})')(
    name=> { assert.equal(name,'../settings'); return {Settings:{get:async()=>({startPoints:[{pos:[1,2,3],angleZ:0,worldOrCell:'60'}]})}}; },mod,mod.exports);
  return mod.exports.Spawn;
}

test('existing interior and exterior worlds remain authoritative on reconnect and persistence restart',async()=>{
  for(const cell of ['13a8c:Skyrim.esm','12345:Other.esm','3c:Skyrim.esm']) {
    const saved={cellOrWorldDesc:cell,pos:[10,20,30],rot:[0,0,90]};
    let location=JSON.parse(JSON.stringify(saved)),actor=0;
    const ctx={gm:new EventEmitter(),svr:{getActorsByProfileId:()=>[0xff000000],
      get:(id,key)=> key==='locationalData'?location:key==='spawnPoint'?{cellOrWorldDesc:'3c:Skyrim.esm',pos:[1,2,3],rot:[0,0,0]}:undefined,
      set:(id,key,value)=>{if(key==='locationalData')location=value;},
      setEnabled(){},setUserActor:(user,id)=>actor=id,getUserActor:()=>actor}};
    const Spawn=spawnClass();const system=new Spawn(()=>{});await system.initAsync(ctx);ctx.gm.emit('spawnAllowed',1,1,[]);
    assert.deepEqual(location,saved);system.disconnect(1,ctx);
    location=JSON.parse(JSON.stringify(location));ctx.gm.emit('spawnAllowed',1,1,[]);
    assert.deepEqual(location,saved,'restart has original destination without pending in-memory recovery data');
  }
});
