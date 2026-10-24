import {test,expect} from 'vitest';
import {toCanvas,fromCanvas,connect,validConnection,arrange,overlaps,nodeHeight} from './mapping';
import type {Graph} from '../../rp-gamemode/src/modules/dialogue/graph-model';
const graph:Graph={schemaVersion:1,id:'test',version:4,entry:'start',nodes:[{id:'start',type:'entry',next:'greet'},{id:'greet',type:'npc',text:'ยินดีต้อนรับ',next:'choose'},{id:'choose',type:'choices',choices:[{id:'leave',text:'ออก',next:'end'}]},{id:'end',type:'end'}]};
test('runtime graph roundtrips exactly including Unicode and stable choice IDs',()=>{const canvas=toCanvas(graph,{start:{x:12,y:34}});expect(fromCanvas(graph,canvas)).toEqual(graph);expect(canvas.nodes[0].position).toEqual({x:12,y:34});});
test('connection replaces one output and rejects missing nodes or unsupported handles',()=>{const c=toCanvas(graph);const updated=connect({source:'start',sourceHandle:'next',target:'end',targetHandle:null},c);expect(fromCanvas(graph,updated).nodes[0].next).toBe('end');expect(validConnection({source:'end',sourceHandle:'next',target:'start',targetHandle:null},c)).toBe(false);expect(validConnection({source:'greet',sourceHandle:'fake',target:'end',targetHandle:null},c)).toBe(false);});
test('removing an edge creates a visible validation gap instead of retaining an old target',()=>{const c=toCanvas(graph);c.edges=[];expect(fromCanvas(graph,c).nodes[0].next).toBe('');});
test('dense choice menus and return paths lay out without overlaps or runtime changes',()=>{
 const dense:Graph={...graph,nodes:[graph.nodes[0]!,graph.nodes[1]!,{id:'choose',type:'choices',choices:Array.from({length:16},(_,i)=>({id:'pick'+i,text:'ทางเลือก '+i,next:'service'+i}))},...Array.from({length:16},(_,i)=>({id:'service'+i,type:'action' as const,action:'contracts' as const,next:'choose'})),{id:'end',type:'end'}]};
 const canvas=toCanvas(dense);
 expect(overlaps(canvas)).toBe(false);
 expect(nodeHeight(dense.nodes[2]!)).toBeGreaterThan(700);
 expect(fromCanvas(dense,canvas)).toEqual(dense);
 expect(arrange(canvas,dense.entry)).toEqual(canvas);
 const menu=canvas.nodes.find(n=>n.id==='choose')!;
 for(const node of canvas.nodes.filter(n=>n.data.runtime.type==='action'))expect(node.position.x).toBeGreaterThan(menu.position.x);
});
test('legacy overlapping saved grids are repaired while non-overlapping manual layouts survive',()=>{
 const layout=Object.fromEntries(graph.nodes.map(n=>[n.id,{x:0,y:0}]));
 expect(overlaps(toCanvas(graph,layout))).toBe(false);
 const spaced=Object.fromEntries(graph.nodes.map((n,i)=>[n.id,{x:i*500,y:350}]));
 expect(toCanvas(graph,spaced).nodes.map(n=>n.position)).toEqual(Object.values(spaced));
});
