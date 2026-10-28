const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
assert.equal(process.platform,'win32','Pinned Windows diagnostic verification');
const repo=path.resolve(__dirname,'../../..'),out=fs.mkdtempSync(path.join(repo,'build/rp-audit/g2421/dump-test-')),exe=path.join(out,'fixture.exe');
const source=path.join(__dirname,'dump-fixture.cpp'),vc='C:/Program Files (x86)/Microsoft Visual Studio/2022/BuildTools/VC/Auxiliary/Build/vcvars64.bat';
const command=path.join(out,'build.cmd');fs.writeFileSync(command,`@echo off\r\ncall "${vc.replaceAll('/','\\')}" >nul\r\nif errorlevel 1 exit /b 1\r\ncl.exe /nologo /EHsc /std:c++17 /Fe:"${exe}" /Fo:"${path.join(out,'fixture.obj')}" "${source}"\r\n`);
const built=spawnSync('cmd.exe',['/d','/c',command],{encoding:'utf8',windowsHide:true,timeout:30000});
fs.writeFileSync(path.join(out,'build.log'),built.stdout+built.stderr);assert.equal(built.status,0,built.stdout+built.stderr);
const dumps=path.join(out,'private-dumps');fs.mkdirSync(dumps);
for(let i=0;i<4;i++){const run=spawnSync(exe,[],{env:{...process.env,FROSTVEIL_ISOLATED_NATIVE_DUMPS:dumps},windowsHide:true,timeout:15000});assert.equal(run.error,undefined);assert.notEqual(run.status,0);}
const names=fs.readdirSync(dumps);assert.equal(names.length,3,'Three-dump budget must preserve existing evidence');
for(const name of names){const b=fs.readFileSync(path.join(dumps,name));assert.equal(b.readUInt32LE(0),0x504d444d,'Real minidump signature');assert(b.length>128&&b.length<32*1024*1024);const streams=b.readUInt32LE(8),directory=b.readUInt32LE(12);let found=false;for(let i=0;i<streams;i++){const offset=directory+i*12;if(b.readUInt32LE(offset)===6){const stream=b.readUInt32LE(offset+8);assert.equal(b.readUInt32LE(stream+8),0xc0000005);found=true;}}assert(found,'Native exception stream must retain access violation');}
const env={...process.env};delete env.FROSTVEIL_ISOLATED_NATIVE_DUMPS;const inactive=spawnSync(exe,[],{env,windowsHide:true,timeout:15000});assert.equal(inactive.error,undefined);assert.equal(fs.readdirSync(dumps).length,3);
fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({signature:'PASS',exceptionCode:'0xC0000005',dumpBudget:3,optInOnly:true,productionTouched:false}));console.log(JSON.stringify({result:'PASS',evidence:out,dumps:3}));
