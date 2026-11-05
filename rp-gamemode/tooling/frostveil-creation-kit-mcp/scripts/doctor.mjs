import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
const pkg=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const client=new Client({name:'frostveil-owner-diagnostics',version:'1'});
try{
 await client.connect(new StdioClientTransport({command:process.execPath,args:[path.join(pkg,'dist/index.js')],stderr:'inherit'}));
 const call=async(name,args={})=>{const r=await client.callTool({name,arguments:args});if(r.isError)throw Error(JSON.stringify(r.content));return JSON.parse(r.content[0].text);};
 const installation=await call('ck_inspect_installation');
 const npcs=await call('ck_list_npcs',{plugin:'FrostveilNPCTest.esp'});
 console.log(JSON.stringify({mcp:'CONNECTED',installation,approvedFixture:{plugin:npcs.plugin,sha256:npcs.sha256,activeNPCs:npcs.npcs.filter(n=>!n.deleted).map(n=>n.editorId),source:'PRESERVED_APPROVED_STAGING_NOT_CURRENT_GAME'},notice:'Successful diagnostics do not approve a changed game baseline or install assets. Start a new Codex session to reload updated MCP code.'},null,2));
}catch(e){console.error(e.message);process.exitCode=1;}finally{await client.close();}
