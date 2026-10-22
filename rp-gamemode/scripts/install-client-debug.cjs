// USER runs after exiting Skyrim. Replaces only the client JS after preserving it.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {contained}=require('./deployment.cjs');
const root=path.resolve(__dirname,'../..');
const game='C:/Program Files (x86)/Steam/steamapps/common/Skyrim Special Edition';
const destination=path.resolve(game,'Data/Platform/Plugins/skymp5-client.js');
const audit=path.join(root,'build/rp-audit/phase22-client-transport-debug1');
const recordFile=path.join(audit,'installation.json');
const backup=path.join(audit,'skymp5-client-before.js');
const source=path.join(root,'build/dist/client/Data/Platform/Plugins/skymp5-client.js');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function replace(contents) {
  const temp=destination+'.'+crypto.randomUUID()+'.tmp';
  fs.writeFileSync(temp,contents,{flag:'wx'});fs.renameSync(temp,destination);
}
try {
  if(!fs.existsSync(path.join(game,'SkyrimSE.exe')))throw new Error('Verified game location missing');
  contained(path.resolve(game),destination);contained(root,audit);
  const logs=path.resolve(game,'Data/Platform/Logs');contained(path.resolve(game),logs);
  if(process.argv.length>3 || (process.argv[2] && process.argv[2]!=='--rollback'))throw new Error('Usage: install-client-debug.cjs [--rollback]');
  if(process.argv[2]==='--rollback') {
    const record=JSON.parse(fs.readFileSync(recordFile,'utf8'));
    if(record.destination!==destination || record.backup!==backup || hash(backup)!==record.before)throw new Error('Backup/destination mismatch');
    const current=hash(destination);
    if(current!==record.after && current!==record.before)throw new Error('Client changed since installation; preserve and review it');
    if(current!==record.before)replace(fs.readFileSync(backup));
    console.log('Restored previous client JS only; game/world/native DLLs retained.');
  } else {
    const content=fs.readFileSync(source,'utf8');
    if(!content.includes('event-source service initialized')||!content.includes('rpChatTransport'))throw new Error('Build the diagnostic client source first');
    fs.mkdirSync(logs,{recursive:true});
    if(fs.existsSync(recordFile)) {
      const record=JSON.parse(fs.readFileSync(recordFile,'utf8'));
      if(record.after!==hash(source)||hash(destination)!==record.after)throw new Error('Previous debug record exists; preserve it and review before another install');
      console.log('Diagnostic client already installed.');
    } else {
      fs.mkdirSync(audit,{recursive:true});
      const before=hash(destination);
      fs.copyFileSync(destination,backup,fs.constants.COPYFILE_EXCL);
      fs.writeFileSync(recordFile,JSON.stringify({destination,backup,before,after:hash(source)},null,2),{flag:'wx'});
      if(hash(destination)!==before)throw new Error('Client changed during backup');
      replace(content);
      console.log(JSON.stringify({destination,backup,log:path.join(logs,'rpChatTransport-logs.txt')},null,2));
    }
  }
} catch(error){console.error(error.message);process.exitCode=1;}
