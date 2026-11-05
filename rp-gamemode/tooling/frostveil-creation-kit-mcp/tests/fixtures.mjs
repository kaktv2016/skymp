import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {repo,pkg} from '../dist/service.js';
const require=createRequire(import.meta.url);
// Real frozen master from the original accepted authoring run, never a generated
// plugin or a replacement installed into the owner's new game.
export function approvedMaster(){
 const h=JSON.parse(fs.readFileSync(path.join(repo,'build/rp-audit/g241d/owner-handoff.json')));
 const config=JSON.parse(fs.readFileSync(path.join(h.isolatedRoot,'g241d-config.json')));
 const catalog=JSON.parse(fs.readFileSync(path.join(h.isolatedRoot,config.packageDirectory,'g241.json')));
 const expected=require(path.join(repo,'rp-gamemode/scripts/g241d-resources.cjs')).HASH;
 if(require(path.join(pkg,'dist/template-catalog.cjs')).catalogHash(catalog)!==expected)throw Error('Approved fixture catalog changed');
 const hash=catalog.plugins.find(p=>p.filename==='Skyrim.esm').sha256;
 const file=path.join(repo,'build/rp-audit/creation-kit-mcp/work/snapshots',hash,'Skyrim.esm');
 const bytes=require(path.join(repo,'rp-gamemode/scripts/g245-assets.cjs')).readConfined(path.dirname(file),'Skyrim.esm',512*1024*1024);
 if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('Archived authoring fixture missing or changed; tests require original approved master; no installed-game fallback');
 return file;
}
