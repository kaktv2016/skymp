const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const clientPath='Data/Platform/Plugins/skymp5-client.js';
function overlayProfiles(local){
 const packages=path.join(local,'Packages');if(!fs.existsSync(packages))return [];
 return fs.readdirSync(packages).filter(n=>n.startsWith('OpenAI.Codex_')).map(n=>path.join(packages,n,'LocalCache/Local/SkyrimRPLauncher/compatibility-profile.json'));
}
/** Read only: refuse MSIX shadow profiles before trusting the baseline visible to Codex. */
function assertLauncherBaseline(options={}){
 const local=process.env.LOCALAPPDATA;
 if(!options.storage&&!local)return {status:'NOT_CONFIGURED'};
 const storage=options.storage??path.join(local,'SkyrimRPLauncher');
 const shadows=options.overlayPaths??(local?overlayProfiles(local):[]);
 if(shadows.some(p=>fs.existsSync(p)))throw Error('Launcher baseline shadow copy detected in Codex MSIX LocalCache. Verify and repair the real desktop profile before deployment; do not update the shadow copy.');
 const settingsFile=path.join(storage,'settings.json'),profileFile=path.join(storage,'compatibility-profile.json');
 if(!fs.existsSync(settingsFile)&&!fs.existsSync(profileFile))return {status:'NOT_CONFIGURED'};
 const parse=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
 const settings=parse(settingsFile),profile=parse(profileFile);
 if(typeof settings.directory!=='string'||!path.isAbsolute(settings.directory))throw Error('Launcher game directory is invalid');
 const pins=Array.isArray(profile.files)?profile.files.filter(f=>f.path===clientPath):[];
 if(pins.length!==1||typeof pins[0].sha256!=='string'||!/^([0-9a-f]{64})$/i.test(pins[0].sha256)||!Number.isSafeInteger(pins[0].size))throw Error('Launcher client baseline is invalid');
 const bytes=fs.readFileSync(path.join(settings.directory,...clientPath.split('/'))),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
 if(sha256!==pins[0].sha256.toLowerCase()||bytes.length!==pins[0].size)throw Error('Launcher client baseline mismatch. Preserve game files and update the reviewed REAL desktop baseline before asking the owner to play.');
 return {status:'VERIFIED',profile:profileFile,sha256};
}
module.exports={assertLauncherBaseline};
if(require.main===module){try{console.log(JSON.stringify(assertLauncherBaseline(),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
