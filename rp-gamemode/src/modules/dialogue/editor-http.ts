import {createServer,IncomingMessage,ServerResponse} from 'node:http';
import type {AddressInfo} from 'node:net';
import {EditorAuthority} from './editor-authority';
import {BlueprintService} from './blueprint-service';
export interface EditorAsset {body:Buffer;type:string;}
/** Dedicated loopback listener. Static shell contains no server data or secrets. */
export class EditorHttpServer {
 private server;private host='';private requests=0;private window=Date.now();
 constructor(private authority:EditorAuthority,private service:BlueprintService,private assets:ReadonlyMap<string,EditorAsset>){
  this.server=createServer((req,res)=>{void this.handle(req,res);});this.server.requestTimeout=10000;this.server.headersTimeout=10000;this.server.maxConnections=32;
 }
 async listen(port=3210){if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid editor port');await new Promise<void>((resolve,reject)=>{this.server.once('error',reject);this.server.listen(port,'127.0.0.1',()=>{this.server.removeListener('error',reject);resolve();});});this.host='127.0.0.1:'+(this.server.address() as AddressInfo).port;return 'http://'+this.host;}
 async close(){this.authority.close();await new Promise<void>((resolve,reject)=>{this.server.close(e=>e?reject(e):resolve());this.server.closeAllConnections();});}
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
   const result=op==='catalog'||op==='graph'?this.service.read(op,input):this.service.execute(op,input,principal.principal);this.send(res,200,result);
  }catch(error){const message=error instanceof Error?error.message:'Request failed';const status=/credentials|authorization|CSRF|login/.test(message)?401:/conflict/.test(message)?409:/rate/.test(message)?429:400;this.send(res,status,{error:message.slice(0,240)});}
 }
}
