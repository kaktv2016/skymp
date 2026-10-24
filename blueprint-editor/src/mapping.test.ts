import {test,expect} from 'vitest';
import {toCanvas,fromCanvas,connect,validConnection} from './mapping';
import type {Graph} from '../../rp-gamemode/src/modules/dialogue/graph-model';
const graph:Graph={schemaVersion:1,id:'test',version:4,entry:'start',nodes:[{id:'start',type:'entry',next:'greet'},{id:'greet',type:'npc',text:'ยินดีต้อนรับ',next:'choose'},{id:'choose',type:'choices',choices:[{id:'leave',text:'ออก',next:'end'}]},{id:'end',type:'end'}]};
test('runtime graph roundtrips exactly including Unicode and stable choice IDs',()=>{const canvas=toCanvas(graph,{start:{x:12,y:34}});expect(fromCanvas(graph,canvas)).toEqual(graph);expect(canvas.nodes[0].position).toEqual({x:12,y:34});});
test('connection replaces one output and rejects missing nodes or unsupported handles',()=>{const c=toCanvas(graph);const updated=connect({source:'start',sourceHandle:'next',target:'end',targetHandle:null},c);expect(fromCanvas(graph,updated).nodes[0].next).toBe('end');expect(validConnection({source:'end',sourceHandle:'next',target:'start',targetHandle:null},c)).toBe(false);expect(validConnection({source:'greet',sourceHandle:'fake',target:'end',targetHandle:null},c)).toBe(false);});
test('removing an edge creates a visible validation gap instead of retaining an old target',()=>{const c=toCanvas(graph);c.edges=[];expect(fromCanvas(graph,c).nodes[0].next).toBe('');});
