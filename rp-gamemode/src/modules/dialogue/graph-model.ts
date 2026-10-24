// Shared runtime/editor schema and validation. No native, filesystem or service access.
export type Node={id:string;type:'entry'|'npc'|'choices'|'condition'|'action'|'end';text?:string;next?:string;otherwise?:string;condition?:'always'|'courierIdle';action?:'contracts'|'rank'|'permits'|'accept'|'buyPermit';argument?:string;choices?:{id:string;text:string;next:string}[]};
export interface Graph {schemaVersion:1;id:string;version:number;entry:string;nodes:Node[];}
const ID=/^[a-z][a-z0-9-]{0,63}$/;
const validId=(v:unknown):v is string=>typeof v==='string'&&ID.test(v);
export function validateGraph(input:unknown,routes:readonly string[],permits:readonly string[]):Graph{
 const g=input as Graph;if(!g||Object.keys(g).some(k=>!['schemaVersion','id','version','entry','nodes'].includes(k))||g.schemaVersion!==1||!validId(g.id)||!Number.isSafeInteger(g.version)||g.version<1||!Array.isArray(g.nodes)||!g.nodes.length||g.nodes.length>128)throw Error('Invalid dialogue graph');
 if(!validId(g.entry))throw Error('Invalid entry ID');
 const fields:Record<Node['type'],readonly string[]>={entry:['id','type','next'],npc:['id','type','text','next'],choices:['id','type','choices'],condition:['id','type','condition','next','otherwise'],action:['id','type','action','argument','next'],end:['id','type']};
 const ids=new Set<string>();for(const n of g.nodes){if(!n||!validId(n.id)||ids.has(n.id)||Object.keys(n).some(k=>!['id','type','text','next','otherwise','condition','action','argument','choices'].includes(k))||!['entry','npc','choices','condition','action','end'].includes(n.type)||n.text!==undefined&&(typeof n.text!=='string'||n.text.length>4096)||n.type==='choices'&&(!Array.isArray(n.choices)||!n.choices.length||n.choices.length>16||new Set(n.choices.map(c=>c.id)).size!==n.choices.length||n.choices.some(c=>!c||Object.keys(c).sort().join(',')!=='id,next,text'||!validId(c.id)||typeof c.text!=='string'||!c.text||c.text.length>256)))throw Error('Invalid dialogue node');if(Object.keys(n).some(k=>!fields[n.type].includes(k))||n.type==='npc'&&typeof n.text!=='string')throw Error('Invalid fields for dialogue node type');ids.add(n.id);
 if(n.type==='condition'&&!['always','courierIdle'].includes(n.condition!))throw Error('Unknown condition');
 if(n.type==='action'&&(!['contracts','rank','permits','accept','buyPermit'].includes(n.action!)||n.action==='accept'&&!routes.includes(n.argument!)||n.action==='buyPermit'&&!permits.includes(n.argument!)||!['accept','buyPermit'].includes(n.action!)&&n.argument!==undefined))throw Error('Unknown service action');}
 if(g.nodes.filter(n=>n.type==='entry').length!==1||g.nodes.find(n=>n.id===g.entry)?.type!=='entry')throw Error('Missing or duplicate entry');for(const n of g.nodes){const links=n.type==='choices'?n.choices!.map(c=>c.next):n.type==='end'?[]:n.type==='condition'?[n.next,n.otherwise]:[n.next];if(links.some(id=>!validId(id)||!ids.has(id)))throw Error('Dangling dialogue link');}
 // Reject automatic cycles; user choices are the only permitted loop boundary.
 const index=new Map(g.nodes.map(n=>[n.id,n]));
 const visiting=new Set<string>(),done=new Set<string>();
 function visit(id:string):void {
  if(visiting.has(id))throw Error('Automatic dialogue cycle');
  if(done.has(id))return;
  const n=index.get(id)!;
  if(n.type==='choices'||n.type==='end'){done.add(id);return;}
  visiting.add(id);visit(n.next!);if(n.type==='condition')visit(n.otherwise!);
  visiting.delete(id);done.add(id);
 }
 for(const n of g.nodes)visit(n.id);return structuredClone(g);
}

/** Drafts may leave an output unconnected, but their data shape and all supplied
 * values stay inside the executable graph schema. Full links/cycles are checked
 * by validateGraph before publication. */
export function validateDraftGraph(input:unknown,routes:readonly string[],permits:readonly string[]):Graph{
 const g=input as Graph;
 if(!g||Object.keys(g).some(k=>!['schemaVersion','id','version','entry','nodes'].includes(k))||g.schemaVersion!==1||!validId(g.id)||!Number.isSafeInteger(g.version)||g.version<1||!validId(g.entry)||!Array.isArray(g.nodes)||!g.nodes.length||g.nodes.length>128)throw Error('Invalid dialogue draft');
 const allowed:Record<Node['type'],readonly string[]>={entry:['id','type','next'],npc:['id','type','text','next'],choices:['id','type','choices'],condition:['id','type','condition','next','otherwise'],action:['id','type','action','argument','next'],end:['id','type']};
 const ids=new Set<string>();
 for(const n of g.nodes){
  if(!n||typeof n!=='object'||!validId(n.id)||ids.has(n.id)||!['entry','npc','choices','condition','action','end'].includes(n.type)||Object.keys(n).some(k=>!['id','type','text','next','otherwise','condition','action','argument','choices'].includes(k))||Object.keys(n).some(k=>!allowed[n.type]?.includes(k)))throw Error('Invalid dialogue draft node');
  ids.add(n.id);
  if(n.type==='entry'||n.type==='npc'||n.type==='action'){
   if(n.next!==undefined&&(typeof n.next!=='string'||n.next!==''&&!validId(n.next)))throw Error('Invalid draft link');
  }
  if(n.type==='npc'&&(typeof n.text!=='string'||n.text.length>4096))throw Error('Invalid draft dialogue text');
  if(n.type==='condition'){
   if(!['always','courierIdle'].includes(n.condition!)||[n.next,n.otherwise].some(link=>link!==undefined&&(typeof link!=='string'||link!==''&&!validId(link))))throw Error('Invalid draft condition');
  }
  if(n.type==='action'){
   if(!['contracts','rank','permits','accept','buyPermit'].includes(n.action!))throw Error('Invalid draft action');
   if(n.action==='accept'&&n.argument!==undefined&&n.argument!==''&&!routes.includes(n.argument))throw Error('Invalid draft route');
   if(n.action==='buyPermit'&&n.argument!==undefined&&n.argument!==''&&!permits.includes(n.argument))throw Error('Invalid draft permit');
   if(!['accept','buyPermit'].includes(n.action!)&&n.argument!==undefined)throw Error('Invalid draft action parameters');
  }
  if(n.type==='choices'){
   if(!Array.isArray(n.choices)||n.choices.length>16)throw Error('Invalid draft choices');
   const choices=new Set<string>();for(const c of n.choices){if(!c||Object.keys(c).sort().join(',')!=='id,next,text'||!validId(c.id)||choices.has(c.id)||typeof c.text!=='string'||c.text.length>256||typeof c.next!=='string'||c.next!==''&&!validId(c.next))throw Error('Invalid draft choice');choices.add(c.id);}
  }
 }
 if(g.nodes.filter(n=>n.type==='entry').length!==1||g.nodes.find(n=>n.id===g.entry)?.type!=='entry')throw Error('Invalid draft entry');
 for(const n of g.nodes){const links=n.type==='choices'?n.choices!.map(c=>c.next):n.type==='end'?[]:n.type==='condition'?[n.next,n.otherwise]:[n.next];for(const link of links)if(link&&ids.has(link)&&g.nodes.find(node=>node.id===link)?.type==='entry')throw Error('Invalid draft connection');}
 return structuredClone(g);
}
