const test=require('node:test'),assert=require('node:assert/strict');
const {buildCatalogue}=require('../scripts/build-map-marker-catalogue.cjs');
function field(type,data){const b=Buffer.alloc(6);b.write(type);b.writeUInt16LE(data.length,4);return Buffer.concat([b,data]);}
function u32(v){const b=Buffer.alloc(4);b.writeUInt32LE(v);return b;}
function record(type,id,data,flags=0){const b=Buffer.alloc(24);b.write(type);b.writeUInt32LE(data.length,4);b.writeUInt32LE(flags,8);b.writeUInt32LE(id,12);return Buffer.concat([b,data]);}
function group(type,label,data){const b=Buffer.alloc(24);b.write('GRUP');b.writeUInt32LE(data.length+24,4);b.writeUInt32LE(label,8);b.writeUInt32LE(type,12);return Buffer.concat([b,data]);}
function marker(id,x,type=13,flags=0){const pos=Buffer.alloc(24);pos.writeFloatLE(x);const t=Buffer.alloc(2);t.writeUInt16LE(type);return record('REFR',id,Buffer.concat([field('NAME',u32(0x10)),field('XMRK',Buffer.alloc(0)),field('FULL',u32(0x123456)),field('FNAM',Buffer.from([0])),field('TNAM',t),field('DATA',pos)]),flags);}
function master(name,masters,data){return{name,bytes:Buffer.concat([record('TES4',0,Buffer.concat(masters.map(m=>field('MAST',Buffer.from(m+'\0')))),0x80),group(1,0x3c,group(6,0x100,data))])};}
test('catalogue merges winning overrides, remaps plugin-local masters, and never decodes STRINGS ids as names',()=>{
 const files=[master('Skyrim.esm',[],Buffer.concat([marker(0x123,1),marker(0x124,2)])),master('Update.esm',['Skyrim.esm'],Buffer.concat([marker(0x123,10),record('REFR',0x124,Buffer.alloc(0),0x20)])),master('Dawnguard.esm',['Skyrim.esm','Update.esm'],marker(0x02000123,30))];
 const result=buildCatalogue(files);assert.deepEqual(result.markers,[{id:'123:dawnguard.esm',world:'3c:skyrim.esm',cell:'100:skyrim.esm',pos:[30,0,0],type:13,name:null,showAllHidden:false},{id:'123:skyrim.esm',world:'3c:skyrim.esm',cell:'100:skyrim.esm',pos:[10,0,0],type:13,name:null,showAllHidden:false}]);assert.equal(result.sources.length,3);assert.match(result.sources[0].sha256,/^[a-f0-9]{64}$/);
});
test('catalogue refuses malformed lengths, foreign plugins and unresolved master indices',()=>{
 assert.throws(()=>buildCatalogue([{name:'Foreign.esp',bytes:Buffer.alloc(24)}]));const broken=master('Skyrim.esm',[],marker(0x123,1));broken.bytes.writeUInt32LE(0x7fffffff,4);assert.throws(()=>buildCatalogue([broken]));assert.throws(()=>buildCatalogue([master('Skyrim.esm',[],marker(0x04000123,1))]));
});
