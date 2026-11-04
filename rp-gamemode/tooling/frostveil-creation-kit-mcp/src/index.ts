import {McpServer,type ServerContext} from '@modelcontextprotocol/server';
import {serveStdio,StdioServerTransport} from '@modelcontextprotocol/server/stdio';
import {Service} from './service.js';
import {schemas,type ToolName} from './schemas.js';
const service=new Service();
function createServer(){
 const server=new McpServer({name:'frostveil-creation-kit-mcp',version:'0.1.0'},{maxToolInputElements:128});
 for(const name of Object.keys(schemas) as ToolName[]){
  server.registerTool(name,{description:name==='ck_create_npc'?'Create only a reviewed immutable scratch full ESP. Does not install, approve or activate.':name==='ck_export_facegen'?'Returns MANUAL_REQUIRED: native FaceGen export is not available.':name==='ck_update_npc'?'Plan name/height changes to an owned scratch NPC as a NEW immutable replacement plugin identity. Review and create separately. Approved originals are protected.':'Local Frostveil NPC tooling; actual backend and limits are returned.',inputSchema:schemas[name],annotations:{readOnlyHint:!['ck_create_npc','ck_plan_npc_creation','ck_update_npc'].includes(name),destructiveHint:false,openWorldHint:false}},async(args:any,ctx:ServerContext)=>{
   const token=ctx.mcpReq._meta?.progressToken;
   const progress=async(value:number,message:string)=>{if(token!==undefined)await ctx.mcpReq.notify({method:'notifications/progress',params:{progressToken:token,progress:value,total:2,message}}).catch(()=>{});};
   try {await progress(0,'Validating local operation');const result=await service.call(name,args,ctx.mcpReq.signal);await progress(2,'Operation completed; inspect returned status and limitations');return {content:[{type:'text' as const,text:JSON.stringify(result)}]};}
   catch(e:any){return {isError:true,content:[{type:'text' as const,text:JSON.stringify({backend:'MUTAGEN_HEADLESS',status:'FAILED',code:e.code??'VALIDATION',message:String(e.message).slice(0,2000)})}]};}
  });
 }
 return server;
}
void serveStdio(createServer,{transport:new StdioServerTransport(process.stdin,process.stdout,{maxBufferSize:65536}),onerror:e=>console.error(e.message)});
