// @vitest-environment jsdom
import ELK from 'elkjs/lib/elk.bundled.js';
import {test,expect,vi,afterEach} from 'vitest';
import {renderHook,act,waitFor,cleanup} from '@testing-library/react';
import {toCanvas} from './mapping';
import {useGraphRouting} from './use-graph-routing';
import {buildRoutingGeometry} from './routing-geometry';
import {layoutWithElk} from './elk-layout';
const mock=vi.hoisted(()=>({resolve:null as any,runs:0}));
vi.mock('./routing-client',async()=>{const real=await vi.importActual<any>('./routing-client');const {routeSmart}=await import('./orthogonal-router');return {...real,createRouteClient:()=>({run:async({graph}:any)=>{mock.runs++;return routeSmart(graph);},cancel:()=>{},dispose:()=>{}}),createLayoutClient:()=>({run:()=>new Promise(r=>{mock.resolve=r;}),cancel:()=>{},dispose:()=>{}})};});
afterEach(cleanup);
const graph={schemaVersion:1 as const,id:'g',version:1,entry:'a',nodes:[{id:'a',type:'entry' as const,next:'b'},{id:'b',type:'end' as const}]};
test('manual pointer changes do not route until settled and never move nodes',async()=>{const canvas=toCanvas(graph),before=JSON.stringify(canvas),start=mock.runs;const {result,rerender}=renderHook(({c,rev})=>useGraphRouting(c,'a','g',rev,rev),{initialProps:{c:canvas,rev:0}});await waitFor(()=>expect(result.current.result).toBeTruthy());const moved={...canvas,nodes:canvas.nodes.map(n=>({...n,position:{x:n.position.x+100,y:n.position.y}}))};rerender({c:moved,rev:0});expect(mock.runs).toBe(start+1);expect(result.current.displayedCanvas).toBe(moved);rerender({c:moved,rev:1});await waitFor(()=>expect(mock.runs).toBe(start+2));expect(JSON.stringify(canvas)).toBe(before);});
test('discards a layout resolved after an edit or graph switch; cancel restores original canvas',async()=>{const canvas=toCanvas(graph),layout=await layoutWithElk(buildRoutingGeometry(canvas,'a').graph,new ELK());const {result,rerender}=renderHook(({gen,id})=>useGraphRouting(canvas,'a',id,gen,gen),{initialProps:{gen:0,id:'g'}});let pending:Promise<void>;act(()=>{pending=result.current.requestLayout();});rerender({gen:1,id:'g'});await act(async()=>{mock.resolve(layout);await pending;});expect(result.current.candidate).toBeNull();act(()=>{pending=result.current.requestLayout();});await act(async()=>{mock.resolve(layout);await pending;});expect(result.current.candidate).toBeTruthy();act(()=>result.current.cancelLayout());expect(result.current.displayedCanvas).toBe(canvas);act(()=>{pending=result.current.requestLayout();});rerender({gen:1,id:'other'});await act(async()=>{mock.resolve(layout);await pending;});expect(result.current.candidate).toBeNull();});
