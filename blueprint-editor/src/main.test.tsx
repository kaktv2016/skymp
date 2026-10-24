// @vitest-environment jsdom
import React from 'react';
import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
import {render,screen,waitFor,within,cleanup} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {App} from './main';
import type {Graph} from '../../rp-gamemode/src/modules/dialogue/graph-model';

const fixture:Graph={schemaVersion:1,id:'courier-clerk',version:1,entry:'entry',nodes:[
 {id:'entry',type:'entry',next:'welcome'},
 {id:'welcome',type:'npc',text:'ยินดีต้อนรับ',next:'menu'},
 {id:'menu',type:'choices',choices:[{id:'contracts',text:'ดูสัญญา',next:'contracts'},{id:'exit',text:'ออก',next:'end'}]},
 {id:'contracts',type:'action',action:'contracts',next:'menu'},
 {id:'end',type:'end'}
]};

vi.mock('@xyflow/react',async()=>{
 const React=await import('react');
 return {
  ReactFlow:({nodes,edges,nodeTypes,onNodeClick,onEdgeClick,onInit}:any)=>{React.useEffect(()=>{onInit?.(viewport);},[]);return <div aria-label="Graph canvas">{nodes.map((node:any)=>React.createElement('div',{key:node.id,'data-node-id':node.id,'data-stack':node.zIndex,onClick:event=>{event.stopPropagation();onNodeClick?.(event,node);}},React.createElement(nodeTypes.blueprint,{id:node.id,data:node.data,selected:node.selected})))}{edges.map((edge:any)=><button key={edge.id} data-edge-id={edge.id} data-stack={edge.zIndex} aria-label={'Edge '+edge.id} onClick={e=>onEdgeClick?.(e,edge)}>{edge.id}</button>)}</div>;},
  Background:()=>null,Controls:()=>null,MiniMap:()=>null,Handle:()=>null,Position:{Left:'left',Right:'right'},
  applyNodeChanges:(changes:any,nodes:any[])=>changes.reduce((result:any[],change:any)=>change.type==='remove'?result.filter(n=>n.id!==change.id):result,nodes),
  applyEdgeChanges:(_changes:any,edges:any[])=>edges,useUpdateNodeInternals:()=>updateInternals
 };
});

const viewport=vi.hoisted(()=>({fitView:vi.fn(async(_options?:any)=>true),getViewport:vi.fn(()=>({x:0,y:0,zoom:1})),setViewport:vi.fn(async(_view?:any,_options?:any)=>true),screenToFlowPosition:vi.fn((p:any)=>p)}));
const updateInternals=vi.hoisted(()=>vi.fn());
let calls:{op:string;payload:any}[]=[];
function response(value:unknown,status=200){return {ok:status<300,status,json:async()=>value};}
afterEach(()=>cleanup());
beforeEach(()=>{
 (document as any).elementsFromPoint=vi.fn(()=>[]);
 calls=[];viewport.fitView.mockClear();viewport.setViewport.mockClear();updateInternals.mockClear();vi.stubGlobal('confirm',vi.fn(()=>true));
 vi.stubGlobal('fetch',vi.fn(async(url:string,init:any)=>{
  const op=url.split('/').pop()!,payload=JSON.parse(init.body||'{}');calls.push({op,payload});
  if(op==='login')return response({csrf:'a'.repeat(64),expires:999999});
  if(op==='catalog')return response({graphs:[{id:'courier-clerk',version:1,draftRevision:0}],npcs:[{id:'npc-1',name:'Guild Clerk'}],routes:[{id:'route-1',label:'เส้นทางหนึ่ง'}],permits:[{id:'regional',label:'ใบอนุญาต'}],routeIds:['route-1'],permitIds:['regional'],revision:0,actions:['contracts','rank','permits','accept','buyPermit'],conditions:['always','courierIdle']});
  if(op==='graph')return response({draft:null,published:structuredClone(fixture),history:[{version:1}]});
  if(op==='draft')return response({revision:1,graph:payload.graph});
  if(op==='validate')return response({valid:true});
  if(op==='preview')return response({current:{title:'Guild Clerk',text:'[Preview only] contracts',choices:payload.choices.length?[]:[{id:'exit',text:'ออก'}]},actions:[['list']]});
  if(op==='publish')return response({...fixture,version:2});
  if(op==='assign')return response({revision:1});
  if(op==='rollback')return response({...fixture,version:2});
  if(op==='logout')return response({ok:true});
  return response({error:'Unknown'},404);
 }));
});

async function enter(){const user=userEvent.setup();render(<App/>);await user.type(screen.getByLabelText('One-time editor grant'),'one-use-secret');await user.click(screen.getByRole('button',{name:'Enter studio →'}));const flow=await screen.findByLabelText('Graph canvas');await user.click(within(flow).getAllByText('welcome')[0]);await screen.findByLabelText('Dialogue');return user;}

describe('Blueprint Studio UI',()=>{
 it('elevates only precise path endpoints while retaining the ordinary graph paint stack',async()=>{
  const user=await enter();await user.click(within(screen.getByLabelText('Graph canvas')).getByText('menu'));
  const level=(id:string)=>Number(document.querySelector('[data-node-id="'+id+'"]')?.getAttribute('data-stack'));
  expect(['entry','welcome','menu','contracts','end'].every(id=>level(id)===0)).toBe(true);
  const choice=screen.getByRole('button',{name:'Trace choice 1: ดูสัญญา'});await user.hover(choice);
  expect(level('contracts')).toBeGreaterThan(Number(document.querySelector('[data-edge-id="menu:choice:contracts"]')?.getAttribute('data-stack')));expect(level('end')).toBe(0);
  await user.unhover(choice);await user.click(screen.getByRole('button',{name:'Edge menu:choice:exit'}));
  const edgeLevel=Number(document.querySelector('[data-edge-id="menu:choice:exit"]')?.getAttribute('data-stack'));
  expect(level('menu')).toBeGreaterThan(edgeLevel);expect(level('end')).toBeGreaterThan(edgeLevel);expect(level('welcome')).toBe(0);
 });
 it('keeps focus inside Preview when the response replaces the focused choice',async()=>{
  const user=await enter();await user.click(screen.getByRole('button',{name:'Preview'}));
  await user.click(within(await screen.findByRole('dialog')).getByRole('button',{name:/ออก/}));
  await waitFor(()=>expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true));
  await user.tab();expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  await user.keyboard('{Escape}');expect(screen.queryByRole('dialog')).toBeNull();expect(document.activeElement).toBe(screen.getByRole('button',{name:'Preview'}));
 });
 it('retains unsaved state for edits made after an in-flight save snapshot',async()=>{
  const user=await enter(),original=fetch;let release!:(value:any)=>void;let snapshot:any;
  vi.stubGlobal('fetch',vi.fn((url:string,init:any)=>url.endsWith('/draft')?new Promise(resolve=>{snapshot=JSON.parse(init.body);release=resolve;}):original(url,init)));
  await user.click(screen.getByRole('button',{name:'Save draft'}));
  await user.type(screen.getByLabelText('Dialogue'),' ใหม่ที่ยังไม่เซฟ');release(response({revision:1}));
  await screen.findByText('Draft saved at revision 1');expect(screen.getByText('Unsaved changes')).toBeTruthy();
  expect(snapshot.graph.nodes.find((n:any)=>n.id==='welcome').text).toBe('ยินดีต้อนรับ');
  vi.stubGlobal('fetch',original);await user.click(screen.getByRole('button',{name:'Save draft'}));
  await waitFor(()=>expect(calls.find(c=>c.op==='draft')?.payload.graph.nodes.find((n:any)=>n.id==='welcome').text).toBe('ยินดีต้อนรับ ใหม่ที่ยังไม่เซฟ'));
 });
 it('refreshes mounted handle bounds when text wraps without a choice-count change',async()=>{
  const user=await enter();await user.click(within(screen.getByLabelText('Graph canvas')).getByText('menu'));updateInternals.mockClear();
  await user.type(screen.getAllByLabelText('Choice label')[0]!,'W'.repeat(120));
  expect(updateInternals.mock.calls.some(([id])=>id==='menu')).toBe(true);
 });
 it('keeps a keyboard-focused choice highlighted after the pointer leaves',async()=>{
  const user=await enter();await user.click(within(screen.getByLabelText('Graph canvas')).getByText('menu'));
  const choice=screen.getAllByLabelText('Choice label')[0]!;await user.click(choice);await user.unhover(choice);
  expect(document.querySelector('.canvas.path-isolated')?.getAttribute('data-active-edge')).toBe('menu:choice:contracts');
 });
 it('isolates one hovered or keyboard-focused choice and preserves persistent edge selection and graph data',async()=>{
  const user=await enter();
  await user.click(within(screen.getByLabelText('Graph canvas')).getByText('menu'));
  const choice=screen.getByRole('button',{name:'Trace choice 1: ดูสัญญา'});
  await user.hover(choice);
  expect(document.querySelector('.canvas.path-isolated')?.getAttribute('data-active-edge')).toBe('menu:choice:contracts');
  await user.unhover(choice);expect(document.querySelector('.canvas.path-isolated')).toBeNull();
  choice.focus();expect(await screen.findByText('Active path · ดูสัญญา')).toBeTruthy();
  await user.click(screen.getByRole('button',{name:'Edge menu:choice:exit'}));
  expect(screen.getByText('#2 · ออก')).toBeTruthy();
  await user.click(screen.getByRole('button',{name:'Save draft'}));
  await waitFor(()=>expect(calls.find(c=>c.op==='draft')?.payload.graph).toEqual(fixture));
 });
 it('resizes either panel, shows linked choice targets and keeps layout-only interactions out of save history',async()=>{
  const user=await enter();
  await user.keyboard('{Control>}b{/Control}');
  expect(screen.getByRole('slider',{name:'Node library width'})).toBeTruthy();
  await user.click(within(screen.getByLabelText('Graph canvas')).getByText('menu'));
  expect(document.querySelector('.inspector .choice-target')?.textContent).toContain('ดูสัญญาส่งของ · contracts');
  await user.click(screen.getByRole('button',{name:'Save draft'}));
  await waitFor(()=>expect(calls.find(c=>c.op==='draft')?.payload.graph).toEqual(fixture));
 });
 it('prevents duplicate workflow requests while a save is pending and reports request failure',async()=>{
  const user=await enter();const original=fetch;let release!:(value:any)=>void;
  vi.stubGlobal('fetch',vi.fn((url:string,init:any)=>url.endsWith('/draft')?new Promise(resolve=>{release=resolve;}):original(url,init)));
  const save=screen.getByRole('button',{name:'Save draft'});
  await user.click(save);expect(save.hasAttribute('disabled')).toBe(true);
  release(response({error:'Draft revision conflict'},409));
  await screen.findByText('Draft revision conflict');expect(save.hasAttribute('disabled')).toBe(false);
 });
 it('disambiguates overlapping pointer hits and cycles choices without changing data',async()=>{
  const user=await enter();
  const ids=['menu:choice:contracts','menu:choice:exit'];
  (document as any).elementsFromPoint=vi.fn(()=>ids.map(id=>{const el=document.createElement('div');el.className='react-flow__edge';el.setAttribute('data-id',id);return el;}));
  await user.click(screen.getByRole('button',{name:'Edge menu:choice:contracts'}));
  expect(screen.getByText(/Overlapping connections \(2\)/)).toBeTruthy();
  await user.click(screen.getByRole('button',{name:'Edge menu:choice:contracts'}));
  expect(screen.getByText('#2 · ออก')).toBeTruthy();
  expect(calls.some(c=>['draft','publish','assign'].includes(c.op))).toBe(false);
 });
 it('retains validation and version-history rollback controls',async()=>{
  const user=await enter();await user.click(screen.getByRole('button',{name:'Validate'}));
  await screen.findByText('Valid graph — ready to preview or publish');
  await user.click(screen.getByRole('button',{name:'v1 · Roll back'}));
  await screen.findByText('Rollback published as v2');
  expect(calls.find(c=>c.op==='rollback')?.payload).toEqual({id:'courier-clerk',targetVersion:1,version:1});
 });
 it('inspects an exact choice edge and focuses either offscreen endpoint without replacing inspection',async()=>{
  const user=await enter();await user.click(screen.getByRole('button',{name:'Edge menu:choice:contracts'}));
  expect(screen.getByText('CONNECTION INSPECTOR')).toBeTruthy();expect(screen.getByText('#1 · ดูสัญญา')).toBeTruthy();
  await user.click(screen.getByRole('button',{name:'Focus Source'}));expect(viewport.fitView.mock.calls.at(-1)?.[0]).toMatchObject({nodes:[{id:'menu'}]});
  await user.click(screen.getByRole('button',{name:'Focus Target'}));expect(viewport.fitView.mock.calls.at(-1)?.[0]).toMatchObject({nodes:[{id:'contracts'}]});
  expect(screen.getByText('CONNECTION INSPECTOR')).toBeTruthy();
  await user.click(within(screen.getByLabelText('Graph canvas')).getByText('welcome'));expect(screen.queryByText('CONNECTION INSPECTOR')).toBeNull();expect(screen.getByLabelText('Dialogue')).toBeTruthy();
  expect(calls.filter(c=>['draft','publish','assign'].includes(c.op))).toHaveLength(0);
 });
 it('search, trace and viewport navigation preserve unsaved edits and serialized payloads',async()=>{
  const user=await enter();await user.clear(screen.getByLabelText('Dialogue'));await user.type(screen.getByLabelText('Dialogue'),'ข้อความที่ยังไม่บันทึก');
  await user.keyboard('{Control>}k{/Control}');await user.type(screen.getByRole('combobox',{name:'Search graph'}),'contracts');
  await user.keyboard('{ArrowDown}{Enter}');expect(viewport.fitView).toHaveBeenCalled();
  await user.selectOptions(screen.getByLabelText('Trace mode'),'upstream');
  await user.click(screen.getByRole('button',{name:'Fit All'}));await user.click(screen.getByRole('button',{name:'Back View'}));expect(viewport.setViewport).toHaveBeenCalled();
  await user.click(screen.getByRole('button',{name:'Reset trace'}));
  await user.click(screen.getByRole('button',{name:'Save draft'}));await waitFor(()=>expect(calls.some(c=>c.op==='draft')).toBe(true));
  const saved=calls.find(c=>c.op==='draft')!.payload.graph;expect(saved).toEqual({...fixture,nodes:fixture.nodes.map(n=>n.id==='welcome'?{...n,text:'ข้อความที่ยังไม่บันทึก'}:n)});
 });
 it('edge deletion clears inspection and undo/redo restores only valid selection states',async()=>{
  const user=await enter();await user.click(screen.getByRole('button',{name:'Edge menu:choice:contracts'}));
  await user.click(screen.getByRole('button',{name:'Delete connection'}));expect(screen.queryByText('CONNECTION INSPECTOR')).toBeNull();
  await user.click(screen.getByRole('button',{name:'Undo'}));expect(screen.getByText('CONNECTION INSPECTOR')).toBeTruthy();
  await user.click(screen.getByRole('button',{name:'Redo'}));expect(screen.queryByText('CONNECTION INSPECTOR')).toBeNull();
  await user.click(screen.getByRole('button',{name:'Undo'}));expect(screen.getByText('CONNECTION INSPECTOR')).toBeTruthy();
  await user.keyboard('{Escape}');expect(screen.queryByText('CONNECTION INSPECTOR')).toBeNull();
 });
 it('node deletion and multiple undo/redo operations keep node inspection valid',async()=>{
  const user=await enter();await user.click(screen.getByRole('button',{name:'Delete node'}));expect(screen.queryByLabelText('Dialogue')).toBeNull();
  await user.click(screen.getByRole('button',{name:'Undo'}));expect(screen.getByLabelText('Dialogue')).toBeTruthy();
  await user.click(screen.getByRole('button',{name:'Redo'}));expect(screen.queryByLabelText('Dialogue')).toBeNull();
 });
 it('arranging the graph preserves executable dialogue and can be undone before saving',async()=>{
  const user=await enter();
  await user.click(screen.getByRole('button',{name:'จัดกราฟใหม่'}));
  await user.click(screen.getByRole('button',{name:'Undo'}));
  await user.click(screen.getByRole('button',{name:'Save draft'}));
  await waitFor(()=>expect(calls.some(call=>call.op==='draft')).toBe(true));
  expect(calls.find(call=>call.op==='draft')?.payload.graph).toEqual(fixture);
 });
 it('authenticates, edits Unicode dialogue, saves a draft and reloads graph state',async()=>{
  const user=await enter();const dialogue=screen.getByLabelText('Dialogue');await user.clear(dialogue);await user.type(dialogue,'สวัสดีชาว Frostveil');
  await user.click(screen.getByRole('button',{name:'Save draft'}));
  await waitFor(()=>expect(calls.some(call=>call.op==='draft')).toBe(true));
  expect(calls.find(call=>call.op==='draft')?.payload.graph.nodes.find((node: any)=>node.id==='welcome').text).toBe('สวัสดีชาว Frostveil');
  expect(await screen.findByText('Draft saved at revision 1')).toBeTruthy();
 });
 it('previews without side effects, publishes and assigns the existing clerk',async()=>{
  const user=await enter();await user.click(screen.getByRole('button',{name:'Preview'}));
  expect(await screen.findByRole('dialog',{name:'Read-only dialogue preview'})).toBeTruthy();
  expect(screen.getByText('[Preview only] contracts')).toBeTruthy();
  await user.click(screen.getByRole('button',{name:'Close preview'}));
  await user.click(screen.getByRole('button',{name:'Publish'}));await waitFor(()=>expect(calls.some(call=>call.op==='publish')).toBe(true));
  await user.selectOptions(screen.getByLabelText('NPC'),'npc-1');await user.click(screen.getByRole('button',{name:'Assign graph'}));
  await waitFor(()=>expect(calls.some(call=>call.op==='assign')).toBe(true));
  expect(calls.find(call=>call.op==='preview')?.payload.choices).toEqual([]);
 });
 it('adds and removes choices in the selected choices node',async()=>{
  const user=await enter();
  const flow=screen.getByLabelText('Graph canvas');
  await user.click(within(flow).getByText('menu'));
  expect(screen.getAllByLabelText('Choice label')).toHaveLength(2);
  await user.click(screen.getByRole('button',{name:'Add choice'}));
  expect(screen.getAllByLabelText('Choice label')).toHaveLength(3);
  await user.click(screen.getAllByRole('button',{name:'Remove'})[0]!);
  expect(screen.getAllByLabelText('Choice label')).toHaveLength(2);
  expect(screen.getAllByLabelText('Choice label').map(input=>(input as HTMLInputElement).value)).toContain('New choice');
 });
});
