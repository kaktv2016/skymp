// Run only by the server OS operator. This never connects to a game, alters a save or accepts remote requests.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const [directory,command,actorText,account,expectedSession]=process.argv.slice(2);
if(!directory||!['list','grant','revoke'].includes(command))throw Error('Usage: node admin-local.cjs <server-private-rp-admin-directory> list | grant <actor-hex> <account> | revoke <actor-hex>');
const root=fs.realpathSync(directory),inventory=JSON.parse(fs.readFileSync(path.join(root,'sessions.json'),'utf8'));
if(!inventory||!Array.isArray(inventory.sessions)||!Array.isArray(inventory.accounts)||typeof inventory.boot!=='string')throw Error('Invalid inventory');
if(command==='list'){console.log(JSON.stringify({accounts:inventory.accounts,sessions:inventory.sessions.map(({nonce,...s})=>({...s,actorHex:s.actorId.toString(16)}))},null,2));process.exit(0);}
if(!/^(?:0x)?[a-f0-9]{1,8}$/i.test(actorText??''))throw Error('Expected explicit actor hexadecimal ID');
const actor=parseInt(actorText.replace(/^0x/i,''),16),target=inventory.sessions.find(s=>s.actorId===actor);if(!target)throw Error('Actor is not in current server inventory; reconnect/tick before granting');
if(expectedSession!==undefined){const digest=crypto.createHash('sha256').update(JSON.stringify({boot:inventory.boot,actorId:target.actorId,profileId:target.profileId,nonce:target.nonce})).digest('hex');if(command!=='grant'||!/^[a-f0-9]{64}$/.test(expectedSession)||digest!==expectedSession)throw Error('Operator-selected session changed; fresh approval required');}
const file=path.join(root,'approvals.json');let grants=[];if(fs.existsSync(file)){const st=fs.lstatSync(file);if(st.isSymbolicLink()||st.nlink!==1||st.size>65536)throw Error('Unsafe approval file');const raw=JSON.parse(fs.readFileSync(file));if(raw.boot===inventory.boot&&Array.isArray(raw.grants))grants=raw.grants;}
grants=grants.filter(g=>g.actorId!==actor&&g.expiresAt>Date.now());
if(command==='grant'){if(!inventory.accounts.includes(account))throw Error('Account is not in server-side operator allowlist');grants.push({...target,account,expiresAt:Date.now()+1800000});}
const temporary=path.join(root,crypto.randomUUID()+'.tmp');fs.writeFileSync(temporary,JSON.stringify({boot:inventory.boot,grants}),{flag:'wx',mode:0o600});fs.renameSync(temporary,file);console.log(command==='grant'?'Operator-approved local session granted for 30 minutes. Reconnect/restart requires a fresh approval.':'Local approval revoked.');
