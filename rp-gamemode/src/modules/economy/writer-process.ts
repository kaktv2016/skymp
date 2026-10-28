import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';

export interface WriterProcess {alive:boolean;identity?:string;startedAtMs?:number;}
let ownIdentity:WriterProcess|undefined;
/** Unknown identity remains live: inability to inspect a writer never authorizes takeover. */
export function writerProcess(pid:number):WriterProcess {
 if(!Number.isSafeInteger(pid)||pid<1)throw Error('Invalid writer PID');
 if(pid===process.pid&&ownIdentity)return ownIdentity;
 const remember=(value:WriterProcess)=>{if(pid===process.pid&&value.identity)ownIdentity=value;return value;};
 try{process.kill(pid,0);}catch(e){if((e as NodeJS.ErrnoException).code==='ESRCH')return{alive:false};throw e;}
 try{
  if(process.platform==='win32'){
   const shell=path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
   const text=execFileSync(shell,['-NoProfile','-NonInteractive','-Command',`$ErrorActionPreference='Stop'; $s=(Get-Process -Id ${pid}).StartTime.ToUniversalTime(); @{identity=('windows:'+$s.Ticks);startedAtMs=([DateTimeOffset]$s).ToUnixTimeMilliseconds()} | ConvertTo-Json -Compress`],{encoding:'utf8',windowsHide:true,timeout:5000,maxBuffer:4096});
   const value=JSON.parse(text);if(typeof value.identity==='string'&&/^windows:\d+$/.test(value.identity)&&Number.isSafeInteger(value.startedAtMs))return remember({alive:true,...value});
  }else if(process.platform==='linux'){
   const stat=fs.readFileSync(`/proc/${pid}/stat`,'utf8'),ticks=stat.slice(stat.lastIndexOf(')')+2).split(' ')[19];
   const boot=fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim();
   if(/^\d+$/.test(ticks!)&&/^[a-f0-9-]+$/.test(boot))return remember({alive:true,identity:`linux:${boot}:${ticks}`});
  }
 }catch{/* Fail closed if process inspection is unavailable or races an exit. */}
 return{alive:true};
}
