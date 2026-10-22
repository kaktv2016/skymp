import {createReadStream} from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
/** Pure Node file IO: the installed SP filename validator rejects spaces/apostrophes.
 * Never throw that native C++ exception from an update callback or invent a CRC. */
export async function readPluginFileInfo(filename:string,dataDirectory='Data'):Promise<{size:number;crc32:number}>{
 if(!filename||filename==='.'||filename==='..'||/[\\/\x00-\x1f:]/.test(filename)||! /\.(esm|esp|esl)$/i.test(filename))throw Error('Unsafe plugin filename');
 const nativeCrc=(zlib as unknown as {crc32?:(b:Buffer,previous?:number)=>number}).crc32;
 const table=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[i]=c>>>0;}
 return new Promise((resolve,reject)=>{let size=0,crc=0,state=0xffffffff;const stream=createReadStream(path.join(dataDirectory,filename),{highWaterMark:65536});
  stream.on('data',(b:Buffer)=>{size+=b.length;if(nativeCrc)crc=nativeCrc(b,crc);else{for(let i=0;i<b.length;i++)state=table[(state^b[i])&255]^(state>>>8);}});
  stream.on('error',reject);stream.on('end',()=>resolve({size,crc32:(nativeCrc?crc:(state^0xffffffff))|0}));
 });
}
