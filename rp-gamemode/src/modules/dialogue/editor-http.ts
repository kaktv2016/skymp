import {createServer,IncomingMessage,ServerResponse} from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import type {AddressInfo} from 'node:net';
import {EditorAuthority} from './editor-authority';
import {BlueprintService} from './blueprint-service';
export interface EditorAsset {body:Buffer;type:string;}
/** Reads only Vite's flat production output; symlinks, source files and maps are refused. */
export function loadEditorAssets(directory:string):ReadonlyMap<string,EditorAsset>{
 const root=path.resolve(directory),stat=fs.lstatSync(root);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Invalid Blueprint editor assets directory');
 const entries=fs.readdirSync(root,{withFileTypes:true}),result=new Map<string,EditorAsset>();
 const read=(name:string,type:string,limit:number,url=name==='index.html'?'/':'/assets/'+path.basename(name))=>{const file=path.join(root,name),s=fs.lstatSync(file);if(!s.isFile()||s.isSymbolicLink()||s.size>limit)throw Error('Invalid Blueprint editor asset');result.set(url,{body:fs.readFileSync(file),type});};
 if(!entries.some(e=>e.isFile()&&e.name==='index.html'))throw Error('Blueprint editor build is missing index.html');
 read('index.html','text/html; charset=utf-8',16384);
 const assets=path.join(root,'assets'),assetStat=fs.lstatSync(assets);if(!assetStat.isDirectory()||assetStat.isSymbolicLink())throw Error('Invalid Blueprint asset folder');
 for(const entry of fs.readdirSync(assets,{withFileTypes:true})){
  if(!entry.isFile()||!/^[A-Za-z0-9._-]+\.(?:js|css)$/.test(entry.name))throw Error('Unexpected Blueprint build asset');
  read(path.join('assets',entry.name),entry.name.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8',entry.name.endsWith('.js')?2*1024*1024:256*1024);
 }
 if(result.size<2)throw Error('Blueprint editor build has no application assets');
 return result;
}
/** Dedicated loopback listener. Static shell contains no server data or secrets. */
export class EditorHttpServer {
 private server;private host='';private requests=0;private window=Date.now();
 private listening=false;private closed=false;
 constructor(private authority:EditorAuthority,private service:BlueprintService,private assets:ReadonlyMap<string,EditorAsset>){
  this.server=createServer((req,res)=>{void this.handle(req,res);});this.server.requestTimeout=10000;this.server.headersTimeout=10000;this.server.maxConnections=32;
 }
 async listen(port=3210){if(this.closed||this.listening)throw Error('Editor listener is not available');if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid editor port');await new Promise<void>((resolve,reject)=>{this.server.once('error',reject);this.server.listen(port,'127.0.0.1',()=>{this.server.removeListener('error',reject);this.listening=true;resolve();});});this.host='127.0.0.1:'+(this.server.address() as AddressInfo).port;return 'http://'+this.host;}
 async close(){if(this.closed)return;this.closed=true;this.authority.close();if(!this.listening){this.server.closeAllConnections();return;}await new Promise<void>((resolve,reject)=>{this.server.close(e=>e?reject(e):resolve());this.server.closeAllConnections();});this.listening=false;}
 private send(res:ServerResponse,status:number,body:unknown){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));}
 private async body(req:IncomingMessage){if(req.headers['content-type']?.split(';')[0]!=='application/json')throw Error('JSON required');if(Number(req.headers['content-length']??0)>65536)throw Error('Request too large');let size=0;const chunks:Buffer[]=[];for await(const part of req){const b=Buffer.from(part);size+=b.length;if(size>65536)throw Error('Request too large');chunks.push(b);}const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid request');return value;}
 private async handle(req:IncomingMessage,res:ServerResponse){
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'");
  try{
   if(req.socket.remoteAddress!=='127.0.0.1'||req.headers.host!==this.host||req.headers['sec-fetch-site']==='cross-site')return this.send(res,403,{error:'Forbidden origin'});
   if(Date.now()-this.window>60000){this.window=Date.now();this.requests=0;}if(++this.requests>600)return this.send(res,429,{error:'Request rate exceeded'});
   const url=new URL(req.url??'/','http://'+this.host);
   if(req.method==='GET'&&!url.pathname.startsWith('/api/')){const asset=this.assets.get(url.pathname);if(!asset)return this.send(res,404,{error:'Not found'});res.writeHead(200,{'Content-Type':asset.type});res.end(asset.body);return;}
   if(req.method!=='POST'||req.headers.origin!=='http://'+this.host)return this.send(res,403,{error:'Forbidden method or origin'});
   const input=await this.body(req);
   if(url.pathname==='/api/login'){
    if(Object.keys(input).join(',')!=='grant')throw Error('Invalid login fields');const session=this.authority.exchange(input.grant);
    res.setHeader('Set-Cookie','fv-editor='+session.token+'; HttpOnly; SameSite=Strict; Path=/api; Max-Age=900');return this.send(res,200,{csrf:session.csrf,expires:session.expires});
   }
   const cookie=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('fv-editor='))?.slice(10);
   const principal=this.authority.verify(cookie,req.headers['x-fv-csrf']);
   if(url.pathname==='/api/logout'){this.authority.logout(cookie);res.setHeader('Set-Cookie','fv-editor=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0');return this.send(res,200,{ok:true});}
   const op=url.pathname.slice('/api/'.length);if(!url.pathname.startsWith('/api/'))throw Error('Unknown operation');
   const result=op==='catalog'||op==='graph'||op==='references'?this.service.read(op,input):this.service.execute(op,input,principal.principal);this.send(res,200,result);
  }catch(error){const message=error instanceof Error?error.message:'Request failed';const status=/credentials|authorization|CSRF|login/.test(message)?401:/conflict/.test(message)?409:/rate/.test(message)?429:400;this.send(res,status,{error:message.slice(0,240)});}
 }
}
