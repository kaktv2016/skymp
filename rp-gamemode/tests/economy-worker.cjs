// Disposable journal fault/race worker. Never imports game/server or live paths.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const [mode,modulePath,root,label,staleToken]=process.argv.slice(2);assert.ok(path.basename(root).startsWith('frostveil-economy-'));const {EconomyJournal}=require(modulePath);
if(mode==='crash'){const store=new EconomyJournal(root,point=>{if(point===label)process.exit(71);});store.append('e'.repeat(64),{balance:25,active:false});throw Error('Crash point not reached');}
else if(mode==='race')process.once('message',()=>{
 const read=fs.readFileSync,unlink=fs.unlinkSync;let waited=false;
 fs.readFileSync=function(file,...args){const result=read.call(fs,file,...args);if(!waited&&path.basename(String(file))==='writer.lock'&&String(result).includes(staleToken)){waited=true;fs.writeFileSync(path.join(root,label+'.ready'),'ready');const deadline=Date.now()+5000;while(!fs.existsSync(path.join(root,'release'))){if(Date.now()>deadline)throw Error('No race release');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);}}return result;};
 fs.unlinkSync=function(file,...args){if(label==='b'&&path.basename(String(file))==='writer.lock')Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,200);return unlink.call(fs,file,...args);};
 const store=new EconomyJournal(root);let ok=false;try{const prior=store.read('f'.repeat(64));store.append('f'.repeat(64),{balance:(prior?.balance??0)+25});ok=true;process.send({type:'outcome',ok:true});}catch(e){process.send({type:'outcome',ok:false,error:String(e)});}setTimeout(()=>{try{store.close();}catch{}process.exit(ok?0:1);},600);
});else throw Error('Unknown test mode');
