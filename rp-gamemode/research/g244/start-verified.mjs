// Server-only isolated start. Does not activate a client profile or launch Skyrim.
import fs from 'node:fs/promises';import path from 'node:path';import{createHash,randomUUID}from'node:crypto';import{createRequire}from'node:module';import{pathToFileURL}from'node:url';
const repo=path.resolve(import.meta.dirname,'../../..'),audit=path.join(repo,'build/rp-audit/g244'),require=createRequire(import.meta.url),launcher=path.resolve(repo,'../skyrim-rp-launcher');
const h=JSON.parse(await fs.readFile(path.join(repo,'build/rp-audit/g241d/owner-handoff.json'),'utf8'));
const {root}=require('../../scripts/g241-dev.cjs').guard(h.isolatedRoot);require('./deployment.cjs').idle(root);
require('../../scripts/g241d-runtime.cjs').activeProfile(root);
const {validateRuntimeSeal}=await import(pathToFileURL(path.join(launcher,'scripts/npc-runtime-seal.mjs')).href);validateRuntimeSeal(h.artifacts);
const hash=async f=>createHash('sha256').update(await fs.readFile(f)).digest('hex');
for(const a of h.artifacts)if(await hash(path.join(root,a.path))!==a.sha256)throw Error('Sealed isolated artifact differs: '+a.path);
if(await hash(h.startScript)!==h.startScriptSHA256||await hash(h.serveScript)!==h.serveScriptSHA256)throw Error('Startup artifact differs');
const {startIsolatedPowerShell,waitForStartup}=await import(pathToFileURL(path.join(launcher,'scripts/npc-startup.mjs')).href),startupId=randomUUID();
const child=await startIsolatedPowerShell({root,startScript:h.startScript,startupId,logs:path.join(audit,'powershell-start.json')});
const expected={childPid:child.pid,startupId,launchedAt:child.launchedAt,profileHash:h.profileHash,catalogHash:h.catalogHash},logs=path.join(repo,'build/rp-audit/g241d',`readiness-${Date.now()}-${child.pid}.json`);
const readiness=await waitForStartup({expected,root,startScript:h.startScript,serveScript:h.serveScript,logs});
await fs.writeFile(path.join(audit,'startup-verification.json'),JSON.stringify({expected,logs,readiness},null,2));console.log(JSON.stringify({startupId,powershellPid:child.pid,readiness:'READY',ownerGameLaunched:false}));
