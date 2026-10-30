'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const stat=file=>{try{return fs.lstatSync(file);}catch(e){if(e.code==='ENOENT')return;throw e;}};
function noLinks(root,file){const relative=path.relative(root,file);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('UI destination outside isolated root');for(let p=file;;p=path.dirname(p)){const s=stat(p);if(s?.isSymbolicLink())throw Error('Redirected symbolic UI destination');if(s&&!s.isFile()&&!s.isDirectory())throw Error('Invalid UI destination');if(p===root)break;} }
function installNpcEditorAssets(root,assets){
 root=fs.realpathSync(root);const destination=path.join(root,'npc-management-ui');noLinks(root,destination);
 const old=stat(destination);if(old){if(!old.isDirectory())throw Error('UI destination is not a directory');const visit=(dir,prefix='')=>{const entries=fs.readdirSync(dir,{withFileTypes:true});if(entries.length>32)throw Error('Unexpected UI output size');for(const entry of entries){const f=path.join(dir,entry.name),rel=prefix+entry.name;noLinks(root,f);const s=stat(f);if(s.isDirectory()){if(rel!=='assets')throw Error('Unexpected UI directory');visit(f,'assets/');}else if(!/^(index\.html|assets\/[A-Za-z0-9._-]+\.(js|css))$/.test(rel)||s.nlink!==1)throw Error('Unexpected UI file');}};visit(destination);}
 if(assets.size<2||assets.size>32)throw Error('Invalid UI output count');const prepared=[];
 for(const [url,asset]of assets){if(url!=='/'&&!/^\/assets\/[A-Za-z0-9._-]+\.(js|css)$/.test(url)||!Buffer.isBuffer(asset.body)||asset.body.length>2*1024*1024)throw Error('Invalid UI asset');prepared.push({relative:url==='/'?'index.html':url.slice(1),body:asset.body});}
 if(!prepared.some(a=>a.relative==='index.html'))throw Error('UI shell missing');
 const stage=path.join(root,'.npc-management-ui.stage-'+randomUUID());noLinks(root,stage);fs.mkdirSync(stage);fs.mkdirSync(path.join(stage,'assets'));
 for(const item of prepared){const target=path.join(stage,item.relative);noLinks(root,target);const fd=fs.openSync(target,'wx');try{fs.writeFileSync(fd,item.body);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
 let displaced;noLinks(root,destination);if(old){const current=stat(destination);if(!current||current.ino!==old.ino||current.dev!==old.dev)throw Error('UI destination changed during staging');displaced=path.join(root,'.npc-management-ui.before-'+randomUUID());fs.renameSync(destination,displaced);}else if(stat(destination))throw Error('UI destination appeared during staging');
 try{fs.renameSync(stage,destination);}catch(error){if(displaced&&!stat(destination)){try{noLinks(root,displaced);noLinks(root,destination);fs.renameSync(displaced,destination);}catch(restoreError){throw new AggregateError([error,restoreError],'UI swap failed; prior and staged directories retained for recovery');}}throw error;}return prepared.map(a=>'npc-management-ui/'+a.relative);
}
module.exports={installNpcEditorAssets};
