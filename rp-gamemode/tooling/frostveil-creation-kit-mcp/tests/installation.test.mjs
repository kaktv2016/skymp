import {test} from 'node:test';
import a from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {discoverGame,steamLibraryPaths} from '../dist/installation.js';
import {Service,repo} from '../dist/service.js';
const pkg=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// These are filesystem discovery fixtures, never engine/plugin acceptance data.
test('Steam discovery uses library metadata, tolerates absent CK, and rejects ambiguous or redirected installs',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'fv-path-test-'));
 const steam=path.join(root,'Steam'),library=path.join(root,'Library with spaces'),game=path.join(library,'steamapps/common/Skyrim Special Edition');
 fs.mkdirSync(path.join(steam,'steamapps'),{recursive:true});fs.mkdirSync(path.join(game,'Data'),{recursive:true});
 fs.writeFileSync(path.join(game,'SkyrimSE.exe'),'discovery fixture');fs.writeFileSync(path.join(game,'Data/Skyrim.esm'),'discovery fixture');
 fs.writeFileSync(path.join(steam,'steamapps/libraryfolders.vdf'),`"libraryfolders" { "0" { "path" ${JSON.stringify(library)} } }`);
 a.deepEqual(steamLibraryPaths(steam),[library]);a.equal(discoverGame({steamRoots:[steam]}),game);
 if(process.platform==='win32')a.equal(discoverGame({steamRoots:[steam,steam.toUpperCase()]}),game);
 a.equal(discoverGame({explicit:game,steamRoots:[]}),game);
 a.throws(()=>discoverGame({explicit:path.join(root,'missing'),steamRoots:[steam]}),/INSTALLATION_REQUIRED/);
 const second=path.join(steam,'steamapps/common/Skyrim Special Edition');fs.mkdirSync(path.join(second,'Data'),{recursive:true});
 for(const file of ['SkyrimSE.exe','Data/Skyrim.esm'])fs.writeFileSync(path.join(second,file),'discovery fixture');
 a.throws(()=>discoverGame({steamRoots:[steam]}),/INSTALLATION_AMBIGUOUS/);
 const link=path.join(root,'redirected');fs.symlinkSync(game,link,'junction');a.throws(()=>discoverGame({explicit:link,steamRoots:[]}),/Symlink|reparse/);
});
test('owner CLI helper works in Windows PowerShell without Codex on PATH',()=>{
 const system=process.env.SystemRoot??'C:/Windows';
 const run=spawnSync(path.join(system,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-File',path.join(pkg,'scripts/codex.ps1'),'mcp','list','--json'],{encoding:'utf8',windowsHide:true,timeout:15000,env:{...process.env,PATH:path.join(system,'System32'),CODEX_CLI_PATH:''}});
 a.equal(run.status,0,run.stdout+run.stderr);a.ok(JSON.parse(run.stdout).some(s=>s.name==='frostveil_creation_kit'));
 const before=JSON.parse(run.stdout),registered=before.find(s=>s.name==='frostveil_creation_kit');
 const install=spawnSync(path.join(system,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-File',path.join(pkg,'scripts/install.ps1')],{encoding:'utf8',windowsHide:true,timeout:15000,env:{...process.env,PATH:path.dirname(registered.transport.command)+';'+path.join(system,'System32'),CODEX_CLI_PATH:''}});
 a.equal(install.status,0,install.stdout+install.stderr);a.match(install.stdout,/Existing matching/);a.doesNotMatch(install.stdout,/Added global/);
 const after=spawnSync(path.join(system,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-File',path.join(pkg,'scripts/codex.ps1'),'mcp','list','--json'],{encoding:'utf8',windowsHide:true,timeout:15000,env:{...process.env,PATH:path.join(system,'System32'),CODEX_CLI_PATH:''}});
 a.equal(after.status,0,after.stderr);a.deepEqual(JSON.parse(after.stdout),before);
});
test('an unapproved master is blocked before adapter calls or NPC writes',async()=>{
 const root=fs.mkdtempSync(path.join(repo,'build/rp-audit/creation-kit-mcp/incompatible-'));
 const master=path.join(root,'Skyrim.esm');fs.writeFileSync(master,'Deliberately mismatched hash; never an engine acceptance fixture');
 const s=new Service(path.join(root,'work'),{master});
 s.adapter=async()=>{throw Error('Must not call Mutagen on incompatible source');};
 await a.rejects(s.invoke('ck_plan_npc_creation',{editorId:'FV_Blocked',displayName:'Blocked'}),e=>e.code==='BASELINE_MISMATCH');
 a.deepEqual(fs.readdirSync(path.join(s.root,'operations')),[]);
 a.throws(()=>new Service(path.join(root,'outside-master'),{master:path.join(os.tmpdir(),'Skyrim.esm')}),/private.*audit tree/);
});
