'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {shaderTexturePath,inspectFaceTintDds}=require('../scripts/g241b-resources.cjs');
test('shader lookup normalizes the observed vanilla prefix without rewriting assets',()=>{
 for(const s of ['Data\\Textures\\Actors\\head.dds','Textures/Actors/head.dds','Actors/head.dds'])assert.equal(shaderTexturePath(s),'textures/actors/head.dds');
 for(const s of ['Data/../Textures/Actors/head.dds','C:/Textures/Actors/head.dds','Data/Data/Textures/Actors/head.dds','Actors/head.nif','//textures/actors/x.dds'])assert.throws(()=>shaderTexturePath(s));
});
function dds(){const b=Buffer.alloc(144);b.write('DDS ');for(const [o,v]of [[4,124],[12,2],[16,2],[20,8],[28,1],[76,32],[80,65],[88,32],[92,255],[96,65280],[100,16711680],[104,4278190080]])b.writeUInt32LE(v,o);return b;}
test('FaceTint validates actual supported format and entire pixel payload',()=>{
 assert.equal(inspectFaceTintDds(dds()).payloadValidated,true);
 assert.throws(()=>inspectFaceTintDds(dds().subarray(0,143)),/RGBA8/);
 const bad=dds();bad.writeUInt32LE(4,20);assert.throws(()=>inspectFaceTintDds(bad),/RGBA8/);
 const compressed=dds();compressed.writeUInt32LE(4,80);assert.throws(()=>inspectFaceTintDds(compressed),/RGBA8/);
});
