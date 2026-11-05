import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const {noLinks}=createRequire(import.meta.url)(path.join(repo,'rp-gamemode/scripts/g245-assets.cjs'));
function fault(code:string,message:string):never{throw Object.assign(new Error(code+': '+message),{code});}
export function steamLibraryPaths(steam:string):string[]{
 const file=path.join(steam,'steamapps/libraryfolders.vdf');if(!fs.existsSync(file))return [];
 noLinks(file);if(fs.statSync(file).size>1024*1024)fault('INSTALLATION_METADATA','Steam library metadata exceeds bound');
 const paths:string[]=[];
 for(const match of fs.readFileSync(file,'utf8').matchAll(/"path"\s*"((?:\\.|[^"\\])*)"/g)){
  const value=JSON.parse('"'+match[1]+'"');if(typeof value==='string'&&path.isAbsolute(value))paths.push(path.resolve(value));
  if(paths.length>64)fault('INSTALLATION_METADATA','Steam library count exceeds bound');
 }
 return [...new Set(paths)];
}
function registeredSteamRoots(){
 const roots:string[]=[];
 if(process.platform==='win32')for(const [key,value] of [['HKCU\\Software\\Valve\\Steam','SteamPath'],['HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam','InstallPath']]){
  const run=spawnSync(path.join(process.env.SystemRoot??'C:/Windows','System32/reg.exe'),['query',key,'/v',value],{encoding:'utf8',windowsHide:true,timeout:3000});
  const match=run.stdout?.match(/REG_SZ\s+(.+)/);if(run.status===0&&match)roots.push(match[1].trim());
 }
 for(const base of [process.env['ProgramFiles(x86)'],process.env.ProgramFiles])if(base)roots.push(path.join(base,'Steam'));
 return [...new Set(roots.map(p=>path.resolve(p)))];
}
export function discoverGame(options:{explicit?:string;steamRoots?:string[]}={}):string|undefined{
 const explicit=options.explicit??process.env.FROSTVEIL_CK_GAME;
 const valid=(root:string)=>{
  if(!fs.existsSync(root))return false;noLinks(root);
  return ['SkyrimSE.exe','Data/Skyrim.esm'].every(name=>{const file=path.join(root,name);if(!fs.existsSync(file))return false;noLinks(file);return fs.statSync(file).isFile();});
 };
 if(explicit){if(!path.isAbsolute(explicit)||!valid(explicit))fault('INSTALLATION_REQUIRED','FROSTVEIL_CK_GAME must name a real Skyrim installation');return path.resolve(explicit);}
 const roots=options.steamRoots??registeredSteamRoots(),libraries=new Map<string,string>();
 const add=(root:string)=>{const resolved=path.resolve(root);const key=process.platform==='win32'?resolved.toLowerCase():resolved;if(!libraries.has(key))libraries.set(key,resolved);};
 for(const root of roots){add(root);for(const library of steamLibraryPaths(root))add(library);}
 const matches=[...libraries.values()].map(root=>path.join(root,'steamapps/common/Skyrim Special Edition')).filter(valid);
 if(matches.length>1)fault('INSTALLATION_AMBIGUOUS','Multiple Skyrim installations found; set FROSTVEIL_CK_GAME explicitly');
 return matches[0];
}
