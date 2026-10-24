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
  ReactFlow:({nodes,nodeTypes,onNodeClick}:any)=><div aria-label="Graph canvas">{nodes.map((node:any)=>React.createElement('div',{key:node.id,onClick:event=>{event.stopPropagation();onNodeClick?.(event,node);}},React.createElement(nodeTypes.blueprint,{id:node.id,data:node.data,selected:false})))}</div>,
  Background:()=>null,Controls:()=>null,MiniMap:()=>null,Handle:()=>null,Position:{Left:'left',Right:'right'},
  applyNodeChanges:(changes:any,nodes:any[])=>changes.reduce((result:any[],change:any)=>change.type==='remove'?result.filter(n=>n.id!==change.id):result,nodes),
  applyEdgeChanges:(_changes:any,edges:any[])=>edges,useUpdateNodeInternals:()=>()=>{}
 };
});

let calls:{op:string;payload:any}[]=[];
function response(value:unknown,status=200){return {ok:status<300,status,json:async()=>value};}
afterEach(()=>cleanup());
beforeEach(()=>{
 calls=[];vi.stubGlobal('confirm',vi.fn(()=>true));
 vi.stubGlobal('fetch',vi.fn(async(url:string,init:any)=>{
  const op=url.split('/').pop()!,payload=JSON.parse(init.body||'{}');calls.push({op,payload});
  if(op==='login')return response({csrf:'a'.repeat(64),expires:999999});
  if(op==='catalog')return response({graphs:[{id:'courier-clerk',version:1,draftRevision:0}],npcs:[{id:'npc-1',name:'Guild Clerk'}],routes:[{id:'route-1',label:'เส้นทางหนึ่ง'}],permits:[{id:'regional',label:'ใบอนุญาต'}],routeIds:['route-1'],permitIds:['regional'],revision:0,actions:['contracts','rank','permits','accept','buyPermit'],conditions:['always','courierIdle']});
  if(op==='graph')return response({draft:null,published:structuredClone(fixture),history:[{version:1}]});
  if(op==='draft')return response({revision:1,graph:payload.graph});
  if(op==='validate')return response({valid:true});
  if(op==='preview')return response({current:{title:'Guild Clerk',text:'[Preview only] contracts',choices:[{id:'exit',text:'ออก'}]},actions:[['list']]});
  if(op==='publish')return response({...fixture,version:2});
  if(op==='assign')return response({revision:1});
  if(op==='logout')return response({ok:true});
  return response({error:'Unknown'},404);
 }));
});

async function enter(){const user=userEvent.setup();render(<App/>);await user.type(screen.getByLabelText('One-time editor grant'),'one-use-secret');await user.click(screen.getByRole('button',{name:'Enter studio →'}));const flow=await screen.findByLabelText('Graph canvas');await user.click(within(flow).getAllByText('welcome')[0]);await screen.findByLabelText('Dialogue');return user;}

describe('Blueprint Studio UI',()=>{
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
