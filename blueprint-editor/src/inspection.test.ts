import {test,expect} from 'vitest';
import {graphIndex,connection,trace,search,validSelection,openingNodes} from './inspection';
import {toCanvas,fromCanvas} from './mapping';
import type {Graph} from '../../rp-gamemode/src/modules/dialogue/graph-model';
const graph:Graph={schemaVersion:1,id:'test',version:1,entry:'start',nodes:[{id:'start',type:'entry',next:'greet'},{id:'greet',type:'npc',text:'สวัสดีชาวเมือง',next:'menu'},{id:'menu',type:'choices',choices:[{id:'one',text:'ดูงานส่งจดหมาย',next:'service'},{id:'two',text:'จบ',next:'end'}]},{id:'service',type:'action',action:'accept',argument:'sarethi-farm',next:'menu'},{id:'end',type:'end'},{id:'detached',type:'condition',condition:'courierIdle',next:'end',otherwise:'end'}]};
const canvas=toCanvas(graph),index=graphIndex(graph.nodes,canvas.edges);
test('connection details use stable handle identities, not layout/choice order',()=>{
 const e=canvas.edges.find(e=>e.id==='menu:choice:one')!;
 const d=connection(index,e);expect(d.source?.id).toBe('menu');expect(d.target?.id).toBe('service');expect(d.output).toBe('ดูงานส่งจดหมาย');expect(d.choiceNumber).toBe(1);expect(d.issues).toEqual([]);expect(d.input).toBe('default input');
 const reordered=graphIndex(graph.nodes.map(n=>n.id==='menu'?{...n,choices:[...n.choices!].reverse()}:n),canvas.edges);
 expect(connection(reordered,e).output).toBe(d.output);expect(connection(reordered,e).choiceNumber).toBe(2);
});
test('missing nodes, dangling choices and unsupported input handles are explicit',()=>{
 expect(connection(index,{id:'bad',source:'missing',target:'ghost',sourceHandle:'fake'}).issues).toEqual(['Missing source node','Missing target node']);
 expect(connection(index,{id:'bad',source:'menu',target:'end',sourceHandle:'choice:gone',targetHandle:'fake'}).issues).toContain('Missing source choice');
 expect(connection(index,{id:'bad',source:'start',target:'end',sourceHandle:'next',targetHandle:'fake'}).issues).toContain('Unknown target input');
});
test('direct/upstream/downstream tracing handles branches, cycles and detached drafts without mutation',()=>{
 const before=JSON.stringify(canvas);
 expect([...trace(index,{kind:'node',id:'menu'},'direct').nodes].sort()).toEqual(['end','greet','menu','service']);
 expect([...trace(index,{kind:'node',id:'service'},'upstream').nodes].sort()).toEqual(['greet','menu','service','start']);
 const down=trace(index,{kind:'node',id:'start'},'downstream');expect(down.nodes.has('end')).toBe(true);expect(down.nodes.has('detached')).toBe(false);
 expect([...trace(index,{kind:'edge',id:'menu:choice:one'},'downstream').nodes].sort()).toEqual(['menu','service']);
 expect(trace(index,null,'direct').edges.size).toBe(0);expect(JSON.stringify(canvas)).toBe(before);
});
test('Unicode search covers dialogue, choice text, type, action, condition, target and ID',()=>{
 const targets=new Map([['sarethi-farm','ฟาร์ม Sarethi']]);
 for(const [query,id]of [['สวัสดี','greet'],['จดหมาย','menu'],['NPC','greet'],['รับสัญญา','service'],['ไม่มีงาน','detached'],['detached','detached'],['ฟาร์ม','service']])expect(search(index,query!,targets).map(n=>n.id)).toContain(id);
 expect(search(index,'ไม่พบแน่นอน',targets)).toHaveLength(0);
});
test('inspection and trace operations preserve graph serialization; deletion invalidates only absent selections',()=>{
 expect(validSelection(index,{kind:'edge',id:'menu:choice:one'})).toEqual({kind:'edge',id:'menu:choice:one'});
 expect(validSelection(index,{kind:'node',id:'ghost'})).toBeNull();expect(validSelection(index,{kind:'edge',id:'gone'})).toBeNull();
 for(const edge of canvas.edges)connection(index,edge);search(index,'',new Map());trace(index,{kind:'node',id:'menu'},'downstream');
 expect(fromCanvas(graph,canvas)).toEqual(graph);
});
test('128-node / 16-choice cyclic graphs stay bounded and preserve distinct parallel handles',()=>{
 const nodes=Array.from({length:128},(_,i)=>({id:'node-'+i,type:'choices' as const,choices:Array.from({length:16},(_,j)=>({id:'option-'+j,text:'เลือก '+j,next:'node-'+((i+j+1)%128)}))}));
 const c=toCanvas({...graph,entry:'node-0',nodes}),ix=graphIndex(nodes,c.edges),start=performance.now();
 for(let i=0;i<100;i++){const result=trace(ix,{kind:'node',id:'node-0'},'downstream');expect(result.nodes.size).toBe(128);expect(result.edges.size).toBe(2048);}
 console.info('Phase A trace benchmark: '+((performance.now()-start)/100).toFixed(3)+' ms/trace, 128 nodes / 2048 edges');
 const edges=c.edges.filter(e=>e.source==='node-0');expect(new Set(edges.map(e=>e.sourceHandle)).size).toBe(16);for(let i=0;i<16;i++)expect(connection(ix,edges[i]!).choiceNumber).toBe(i+1);
});

test('opening navigation follows real links rather than array order and stops at choices',()=>{const shuffled=graphIndex([...graph.nodes].reverse(),canvas.edges);expect(openingNodes(shuffled,'start')).toEqual(['start','greet','menu']);expect(openingNodes(shuffled,'ghost')).toEqual([]);});
