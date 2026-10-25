import React, {useEffect, useRef, useState, useMemo, useCallback} from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, Handle, Position,
  applyNodeChanges, applyEdgeChanges, useUpdateNodeInternals, useReactFlow,
  type Edge, type NodeProps
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './style.css';
import {toCanvas, fromCanvas, connect, positions, arrange, nodeHeight, nodeHandles, outputRows, NODE_WIDTH, edgesFromNodes, type Canvas, type BlueprintNode} from './mapping';
import {graphIndex,connection,trace,search,title,validSelection,openingNodes,nodeInfo,nodeColors,actionLabels,conditionLabels,type Selection,type TraceMode} from './inspection';
import {ConnectionEdge,ConnectionInspector} from './connection-ui';
import {Icon,PanelResize,DialogFrame} from './studio-ui';
import {useGraphRouting} from './use-graph-routing';
import type {RoutedPath} from './routing-types';
import {validateGraph, type Graph, type Node} from '../../rp-gamemode/src/modules/dialogue/graph-model';

type FlowHandle = {screenToFlowPosition(point: {x: number; y: number}): {x: number; y: number};fitView(options?:any):Promise<boolean>;getViewport():{x:number;y:number;zoom:number};setViewport(view:{x:number;y:number;zoom:number},options?:{duration?:number}):Promise<boolean>};
const nodeTypesList: Node['type'][] = ['entry','npc','choices','condition','action','end'];

const Card=React.memo(function Card({id, data, selected}: NodeProps<BlueprintNode>) {
  const update = useUpdateNodeInternals();
  const runtime = data.runtime;
  const outputs=outputRows(runtime),handles=nodeHandles(runtime);
  const geometryKey=outputs.map(o=>o.id+':'+o.height).join('|');
  useEffect(() => update(id), [id, geometryKey, update]);
  const info=nodeInfo[runtime.type];
  const incomplete=runtime.type==='npc'&&!runtime.text?.trim()||runtime.type==='choices'&&(!runtime.choices?.length||runtime.choices.some(c=>!c.text.trim()||!c.next))||runtime.type!=='end'&&runtime.type!=='choices'&&!runtime.next||runtime.type==='condition'&&!runtime.otherwise;
  return <article style={{height:nodeHeight(runtime),'--node-accent':nodeColors[runtime.type]} as React.CSSProperties} className={'node node-'+runtime.type+' '+(selected?'selected':data.related?'related':'')+(data.spotlight?' node-spotlight':'')+(incomplete?' node-incomplete':'')}>
    <div className="node-heading"><span className="node-icon"><Icon name={runtime.type} size={20}/></span><div><small>{runtime.type==='action'?'GUILD SERVICE':runtime.type==='npc'?'NPC DIALOGUE':runtime.type.toUpperCase()}</small><strong>{runtime.type==='action'?actionLabels[runtime.action??'']??info.label:info.label}</strong></div>{runtime.type==='choices'&&<span className="node-count">{outputs.length}</span>}</div>
    <div className="node-detail">{runtime.type==='npc'?<p title={runtime.text}>{runtime.text||'เพิ่มข้อความบทสนทนา…'}</p>:runtime.type==='action'?<span>{data.targetLabel??runtime.argument??'บริการ Courier Guild'}</span>:runtime.type==='condition'?<span>{runtime.condition==='courierIdle'?'ผู้เล่นไม่มีงาน Courier อยู่':'ผ่านเงื่อนไขเสมอ'}</span>:runtime.type==='choices'?<span>เลือกคำตอบเพื่อไปยังขั้นตอนถัดไป</span>:<span>{info.hint}</span>}</div>
    <div className="node-outputs">
    {outputs.map((output,index)=><div className="output" key={output.id} style={{height:output.height}}>
      {runtime.type==='choices'&&<span className="choice-number">{String(index+1).padStart(2,'0')}</span>}
      <button type="button" className="output-label nodrag nopan" aria-label={runtime.type==='choices'?`Trace choice ${index+1}: ${output.label}`:`Trace output: ${output.label}`} title={output.label} onPointerEnter={()=>data.onPortFocus?.(id,output.id)} onPointerLeave={()=>data.onPortFocus?.(id,null)} onFocus={()=>data.onPortFocus?.(id,output.id,'focus')} onBlur={()=>data.onPortFocus?.(id,null,'focus')} onClick={e=>e.stopPropagation()}>{output.label}</button><span className="output-arrow">→</span>
    </div>)}</div><div className="node-id" title={runtime.id}><span className="node-dot"/>{runtime.id}{incomplete&&<span className="node-incomplete-tag" title="Incomplete draft node">Incomplete</span>}</div>
    {handles.map(h=><Handle key={h.type+':'+h.id} id={h.id??undefined} type={h.type} position={h.position} title={h.type==='source'?outputs.find(o=>o.id===h.id)?.label:'Input'} style={{left:h.x-1,top:h.y-1,right:'auto',transform:'none'}} onPointerEnter={()=>h.type==='source'&&data.onPortFocus?.(id,h.id??null)} onPointerLeave={()=>data.onPortFocus?.(id,null)} />)}
  </article>;
});
const nodeTypes = {blueprint:Card};
const edgeTypes={connection:ConnectionEdge};
function ReadingView({graphId,ids}:{graphId:string;ids:string[]}){
  const {fitView}=useReactFlow<BlueprintNode>(),opening=useRef(ids);opening.current=ids;
  useEffect(()=>{const task=requestAnimationFrame(()=>{void fitView({nodes:opening.current.map(id=>({id})),padding:.15,maxZoom:.9,includeHiddenNodes:true});});return()=>cancelAnimationFrame(task);},[graphId,fitView]);
  return null;
}

export function App() {
  const [csrf,setCsrf]=useState(''), [grant,setGrant]=useState(''), [catalog,setCatalog]=useState<any>(null);
  const [graph,setGraph]=useState<Graph|null>(null), [canvas,setCanvas]=useState<Canvas>({nodes:[],edges:[]});
  const [selection,setSelection]=useState<Selection>(null), [query,setQuery]=useState(''), [message,setMessage]=useState('Sign in with a one-time editor grant.');
  const editGeneration=useRef(0),[routingRevision,setRoutingRevision]=useState(0);
  function markDirty(){cancelLayoutView();editGeneration.current++;setRoutingRevision(v=>v+1);setDirty(true);}
  const [dirty,setDirty]=useState(false), [revision,setRevision]=useState(0), [published,setPublished]=useState(0);
  const [history,setHistory]=useState<any[]>([]), [preview,setPreview]=useState<any>(null), [previewPath,setPreviewPath]=useState<string[]>([]);
  const [activeCourier,setActiveCourier]=useState(false), [npc,setNpc]=useState('');
  const [libraryOpen,setLibraryOpen]=useState(()=>window.innerWidth>=1450),[inspectorOpen,setInspectorOpen]=useState(true),[miniMapOpen,setMiniMapOpen]=useState(false);
  const [libraryWidth,setLibraryWidth]=useState(248),[zoom,setZoom]=useState(100),[validation,setValidation]=useState<'unchecked'|'valid'|'invalid'>('unchecked');
  const [busy,setBusy]=useState(false),busyRef=useRef(false),[noticeTone,setNoticeTone]=useState<'info'|'error'>('info'),[noticeVisible,setNoticeVisible]=useState(true);
  const [hoveredPort,setHoveredPort]=useState<{source:string;handle:string}|null>(null),[keyboardPort,setKeyboardPort]=useState<{source:string;handle:string}|null>(null);
  const portFocus=hoveredPort??keyboardPort;
  const onPortFocus=useCallback((source:string,handle:string|null,mode:'hover'|'focus'='hover')=>{const setter=mode==='focus'?setKeyboardPort:setHoveredPort;setter(old=>handle?(old?.source===source&&old.handle===handle?old:{source,handle}):old?.source===source?null:old);},[]);
  useEffect(()=>{setNoticeVisible(true);},[message]);
  const undo=useRef<{canvas:Canvas;selection:Selection}[]>([]), redo=useRef<{canvas:Canvas;selection:Selection}[]>([]), dragStart=useRef<Canvas|null>(null), flow=useRef<FlowHandle|null>(null);
  const layoutViewport=useRef<{x:number;y:number;zoom:number}|null>(null);
  const routing=useGraphRouting(canvas,graph?.entry??'',graph?.id??'',editGeneration.current,routingRevision);
  const displayCanvas=routing.displayedCanvas;
  function cancelLayoutView(){routing.cancelLayout();if(layoutViewport.current){void flow.current?.setViewport(layoutViewport.current,{duration:0});layoutViewport.current=null;}}
  function autoArrange(){layoutViewport.current=flow.current?.getViewport()??null;void routing.requestLayout();}
  function applyLayout(){const next=routing.applyLayout();if(next){layoutViewport.current=null;change(next);}}
  useEffect(()=>{if(!routing.candidate)return;const task=requestAnimationFrame(()=>{void flow.current?.fitView({padding:.15,maxZoom:.9,includeHiddenNodes:true});});return()=>cancelAnimationFrame(task);},[routing.candidate]);
  const [overlapIds,setOverlapIds]=useState<string[]>([]),lastEdgeClick=useRef<{x:number;y:number;key:string;index:number}|null>(null);
  const selected=selection?.kind==='node'?selection.id:'';
  const setSelected=useCallback((id:string)=>{setHoveredPort(null);setKeyboardPort(null);setSelection(id?{kind:'node',id}:null);setOverlapIds([]);},[]);
  const selectEdge=useCallback((id:string)=>{setHoveredPort(null);setKeyboardPort(null);setSelection({kind:'edge',id});setInspectorOpen(true);},[]);
  const [traceMode,setTraceMode]=useState<TraceMode>('direct');
  const [searchText,setSearchText]=useState(''),[searchOpen,setSearchOpen]=useState(false),[searchActive,setSearchActive]=useState(0);
  const inspectorElement=useRef<HTMLDivElement>(null),searchInput=useRef<HTMLInputElement>(null),[inspectorWidth,setInspectorWidth]=useState(340);
  const views=useRef<{x:number;y:number;zoom:number}[]>([]),[viewCount,setViewCount]=useState(0);
  // Position/measurement changes do not rebuild adjacency or text indexes.
  const semanticNodes=useRef<Node[]>([]),runtimeNodes=canvas.nodes.map(n=>n.data.runtime);
  if(runtimeNodes.length!==semanticNodes.current.length||runtimeNodes.some((n,i)=>n!==semanticNodes.current[i]))semanticNodes.current=runtimeNodes;
  const index=useMemo(()=>graphIndex(semanticNodes.current,canvas.edges),[semanticNodes.current,canvas.edges]);
  const openingIds=useMemo(()=>openingNodes(index,graph?.entry??''),[index,graph?.entry]);
  const targets=useMemo(()=>new Map<string,string>([...(catalog?.routes??[]),...(catalog?.permits??[])].map((n:any)=>[n.id,n.label])),[catalog]);
  const traced=useMemo(()=>trace(index,selection,traceMode),[index,selection,traceMode]);
  const activePath=portFocus?index.edges.get(portFocus.source+':'+portFocus.handle):undefined;
  const activePathId=activePath?.id??'',activeTarget=activePath?.target??'';
  const found=useMemo(()=>search(index,searchText,targets),[index,searchText,targets]);
  const decorations=useRef(new Map<string,BlueprintNode['data']>());
  const nodeViews=useRef(new Map<string,{raw:BlueprintNode;view:BlueprintNode}>());
  const viewNodes=useMemo(()=>displayCanvas.nodes.map(n=>{
    const targetLabel=targets.get(n.data.runtime.argument??''),related=traced.nodes.has(n.id),spotlight=n.id===activeTarget,old=decorations.current.get(n.id);
    const data=old&&old.runtime===n.data.runtime&&old.targetLabel===targetLabel&&old.related===related&&old.spotlight===spotlight?old:{runtime:n.data.runtime,targetLabel,related,spotlight,onPortFocus};
    decorations.current.set(n.id,data);
    // Keep Phase A's SVG/card stacking for ordinary graph work. Raising every
    // card caused GPU raster stalls on long stress-fixture paths. Only the
    // inspected connection's endpoints and precise hover target need a cover.
    const cached=nodeViews.current.get(n.id),isSelected=n.id===selected,zIndex=spotlight||selection?.kind==='edge'&&related?10:0;
    if(cached?.raw===n&&cached.view.data===data&&cached.view.selected===isSelected&&cached.view.zIndex===zIndex)return cached.view;
    const view={...n,zIndex,measured:{width:NODE_WIDTH,height:nodeHeight(n.data.runtime)},handles:nodeHandles(n.data.runtime),selected:isSelected,data};nodeViews.current.set(n.id,{raw:n,view});return view;
  }),[displayCanvas.nodes,targets,traced.nodes,selected,selection?.kind,activeTarget,onPortFocus]);
  const descriptorCache=useRef(new Map<string,{edge:Edge;detail:ReturnType<typeof connection>;lane:number}>());
  const descriptors=useMemo(()=>{
    const lanes=new Map<string,number>();
    return canvas.edges.map(edge=>{const detail=connection(index,edge),group=detail.source?.type==='choices'?'source:'+edge.source:'target:'+edge.target,ordinal=lanes.get(group)??0,lane=ordinal%16;lanes.set(group,ordinal+1);const old=descriptorCache.current.get(edge.id);if(old?.edge===edge&&old.lane===lane&&old.detail.meaning===detail.meaning&&old.detail.source?.type===detail.source?.type)return old;const value={edge,detail,lane};descriptorCache.current.set(edge.id,value);return value;});
  },[canvas.edges,index]);
  const edgeViews=useRef(new Map<string,{descriptor:typeof descriptors[number];active:boolean;chosen:boolean;spotlight:boolean;route:RoutedPath|undefined;smart:boolean;view:Edge}>());
  const viewEdges=useMemo(()=>descriptors.map(descriptor=>{
      const {edge:e,detail,lane}=descriptor,active=traced.edges.has(e.id),chosen=selection?.kind==='edge'&&selection.id===e.id,spotlight=e.id===activePathId;
      const route=routing.result?.routes.get(e.id),smart=!!routing.candidate||routing.mode==='smart'&&!routing.error;
      const cached=edgeViews.current.get(e.id);if(cached?.descriptor===descriptor&&cached.active===active&&cached.chosen===chosen&&cached.spotlight===spotlight&&cached.route===route&&cached.smart===smart)return cached.view;
      const color=spotlight?'#b8e6dd':chosen?'#e8ca8a':nodeColors[detail.source?.type??'entry'];
      const view={...e,type:'connection',selected:chosen,selectable:true,focusable:true,interactionWidth:26,ariaRole:'button' as const,ariaLabel:detail.meaning,
        domAttributes:{onFocus:()=>selectEdge(e.id)},data:{lane,active,spotlight,route,smart,meaning:detail.meaning,shortLabel:detail.choiceNumber?'#'+detail.choiceNumber+' · '+detail.output:detail.output},
        zIndex:spotlight?9:chosen?8:active?3:0,style:{stroke:color,strokeWidth:spotlight||chosen?2.8:active?1.8:1.4},
        className:(chosen?'edge-chosen ':active?'edge-focused ':'')+(spotlight?'edge-spotlight':''),markerEnd:{type:'arrowclosed' as const,color,width:14,height:14}};
      edgeViews.current.set(e.id,{descriptor,active,chosen,spotlight,route,smart,view});return view;
  }),[descriptors,selection,traced.edges,selectEdge,activePathId,routing.result,routing.mode,routing.error,routing.candidate]);
  useEffect(()=>{const nodes=new Set(canvas.nodes.map(n=>n.id)),edges=new Set(canvas.edges.map(e=>e.id));for(const id of nodeViews.current.keys())if(!nodes.has(id))nodeViews.current.delete(id);for(const id of edgeViews.current.keys())if(!edges.has(id)){edgeViews.current.delete(id);descriptorCache.current.delete(id);}},[canvas.nodes,canvas.edges]);
  useEffect(()=>{setSelection(current=>validSelection(index,current));setOverlapIds(ids=>ids.filter(id=>index.edges.has(id)));},[index]);
  useEffect(()=>{const ids=new Set(canvas.nodes.map(n=>n.id));for(const id of decorations.current.keys())if(!ids.has(id))decorations.current.delete(id);},[canvas.nodes]);
  function navigate(ids?:string[]){if(!flow.current)return;views.current.push(flow.current.getViewport());if(views.current.length>20)views.current.shift();setViewCount(views.current.length);void flow.current.fitView({nodes:ids?.map(id=>({id})),padding:.2,maxZoom:1,duration:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?0:220,includeHiddenNodes:true});}
  function focusNode(id:string){navigate([id]);}
  function opening(){navigate(openingIds);}
  function chooseResult(id:string){setSelected(id);setInspectorOpen(true);setSearchOpen(false);focusNode(id);}
  function clearSelection(){setSelection(null);setHoveredPort(null);setKeyboardPort(null);setTraceMode('direct');setOverlapIds([]);lastEdgeClick.current=null;}
  function inspectEdge(event:React.MouseEvent,edge:Edge){
    const ids=[...new Set(document.elementsFromPoint(event.clientX,event.clientY).map(el=>el.closest('.react-flow__edge')?.getAttribute('data-id')).filter((id):id is string=>!!id&&index.edges.has(id)))].sort();
    if(!ids.includes(edge.id))ids.push(edge.id);ids.sort();
    const key=ids.join('|'),last=lastEdgeClick.current,same=last&&last.key===key&&Math.hypot(last.x-event.clientX,last.y-event.clientY)<5;
    const next=same?(last.index+1)%ids.length:ids.indexOf(edge.id);
    lastEdgeClick.current={x:event.clientX,y:event.clientY,key,index:next};setOverlapIds(ids.length>1?ids:[]);selectEdge(ids[next]!);setSearchOpen(false);
  }
  function deleteSelection(){
    if(!selection)return;
    if(selection.kind==='node'&&selection.id===graph?.entry)return;
    if(!confirm(selection.kind==='edge'?'Delete this connection?':'Delete this node and its links?'))return;
    change({nodes:selection.kind==='node'?canvas.nodes.filter(n=>n.id!==selection.id):canvas.nodes,edges:canvas.edges.filter(e=>selection.kind==='edge'?e.id!==selection.id:e.source!==selection.id&&e.target!==selection.id)});
    clearSelection();
  }
  useEffect(()=>{if(inspectorElement.current)inspectorElement.current.scrollTop=0;},[selection?.kind,selection?.id]);
  useEffect(()=>{if(searchOpen&&found[searchActive])document.getElementById('result-'+found[searchActive]!.id)?.scrollIntoView?.({block:'nearest'});},[searchActive,searchOpen,found]);
  const current=()=>graph?fromCanvas(graph,canvas):null;

  async function api(op:string,input:unknown={},token=csrf) {
    const response=await fetch('/api/'+op,{method:'POST',headers:{'content-type':'application/json','x-fv-csrf':token},body:JSON.stringify(input)});
    const data=await response.json();
    if(!response.ok){if(response.status===401&&op!=='login'){setCsrf('');setMessage('Editor session expired. Request a new /editor grant.');}throw Error(data.error||'Request failed');}
    return data;
  }
  async function run(fn:()=>Promise<unknown>){if(busyRef.current)return;busyRef.current=true;setBusy(true);setNoticeTone('info');try{await fn();}catch(error){setNoticeTone('error');setNoticeVisible(true);setMessage(error instanceof Error?error.message:String(error));}finally{busyRef.current=false;setBusy(false);}}
  function record(previous:Canvas){undo.current.push({canvas:structuredClone(previous),selection});if(undo.current.length>100)undo.current.shift();redo.current=[];}
  function change(next:Canvas){record(canvas);setCanvas(next);markDirty();setValidation('unchecked');setPreview(null);}
  async function refresh(token=csrf){const value=await api('catalog',{},token);setCatalog(value);return value;}
  async function load(id:string,token=csrf){
    if(!id)return;
    if(dirty&&!confirm('Discard unsaved changes?'))return;
    cancelLayoutView();
    const result=await api('graph',{id},token), value=result.draft?.graph??result.published;
    if(!value)throw Error('Graph data is unavailable');
    setGraph(value);setCanvas(toCanvas(value,result.draft?.layout));setRevision(result.draft?.revision??0);
    setRoutingRevision(v=>v+1);setPublished(result.published?.version??0);setHistory(result.history);setDirty(false);setSelected(value.nodes.find((n:Node)=>n.type==='npc')?.id??value.entry);
    undo.current=[];redo.current=[];views.current=[];setViewCount(0);setHoveredPort(null);setKeyboardPort(null);setValidation('unchecked');setSearchText('');setSearchOpen(false);setPreview(null);setMessage('Loaded '+id);
  }
  async function save(){
    const value=current();if(!value)throw Error('Choose a graph first');const savingGeneration=editGeneration.current;
    const saved=await api('draft',{graph:value,layout:positions(canvas),revision});
    setRevision(saved.revision);setDirty(editGeneration.current!==savingGeneration);await refresh();setMessage('Draft saved at revision '+saved.revision);return saved;
  }
  async function validate(){
    const value=current();if(!value||!catalog)throw Error('Choose a graph first');
    try{validateGraph(value,catalog.routeIds,catalog.permitIds);await api('validate',{graph:value});setValidation('valid');setMessage('Valid graph — ready to preview or publish');}catch(error){setValidation('invalid');throw error;}
  }
  async function showPreview(path:string[]){
    const value=current();if(!value)throw Error('Choose a graph first');
    setPreview(await api('preview',{graph:value,choices:path,activeCourier}));setPreviewPath(path);
  }
  function add(type:Node['type'],position={x:160+canvas.nodes.length*18,y:100+canvas.nodes.length*18}){
    if(canvas.nodes.length>=128){setMessage('Maximum 128 nodes');return;}
    const id=type+'-'+crypto.randomUUID().slice(0,8);
    const runtime:Node={id,type,...(type==='end'?{}:type==='choices'?{choices:[]}:{next:''}),
      ...(type==='npc'?{text:''}:type==='action'?{action:'contracts' as const}:type==='condition'?{condition:'always' as const,otherwise:''}:{})};
    change({...canvas,nodes:[...canvas.nodes,{id,type:'blueprint',position,data:{runtime}}]});setSelected(id);
  }
  function undoChange(){const previous=undo.current.pop();if(previous){redo.current.push({canvas:structuredClone(canvas),selection});setCanvas(previous.canvas);setSelection(previous.selection);markDirty();setValidation('unchecked');setPreview(null);}}
  function redoChange(){const next=redo.current.pop();if(next){undo.current.push({canvas:structuredClone(canvas),selection});setCanvas(next.canvas);setSelection(next.selection);markDirty();setValidation('unchecked');setPreview(null);}}

  useEffect(()=>{
    const warn=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue='';}};
    const keys=(event:KeyboardEvent)=>{if(routing.candidate&&((event.ctrlKey||event.metaKey)&&['s','z','y'].includes(event.key.toLowerCase())||['Delete','Backspace'].includes(event.key))){event.preventDefault();return;}if(event.key==='Escape'&&(routing.candidate||routing.layoutBusy)&&!preview){event.preventDefault();cancelLayoutView();return;}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='b'){event.preventDefault();setLibraryOpen(v=>!v);return;}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();void run(save);return;}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setSearchOpen(true);searchInput.current?.focus();return;}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){
      if(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement)return;
      event.preventDefault();event.shiftKey?redoChange():undoChange();
    }else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){
      if(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement)return;
      event.preventDefault();redoChange();
    }else if((event.key==='Delete'||event.key==='Backspace')&&!preview&&!(event.target instanceof HTMLInputElement)&&!(event.target instanceof HTMLTextAreaElement)&&!(event.target instanceof HTMLSelectElement)){if(selection){event.preventDefault();deleteSelection();}}else if(event.key==='Escape'){if(preview)setPreview(null);else if(searchOpen){setSearchOpen(false);searchInput.current?.blur();}else clearSelection();}};
    window.addEventListener('beforeunload',warn);window.addEventListener('keydown',keys);
    return()=>{window.removeEventListener('beforeunload',warn);window.removeEventListener('keydown',keys);};
  },[dirty,preview,canvas,selection,searchOpen,routing.candidate,routing.layoutBusy]);
  const selectedNode=canvas.nodes.find(item=>item.id===selected), node=selectedNode?.data.runtime;
  function patch(data:Partial<Node>){
    if(!selectedNode)return;
    const runtime={...selectedNode.data.runtime,...data};
    change({...canvas,nodes:canvas.nodes.map(n=>n.id===selected?{...n,data:{runtime}}:n),edges:[...canvas.edges.filter(e=>e.source!==selected),...edgesFromNodes([runtime])]});
  }
  async function login(){
    const session=await api('login',{grant});setCsrf(session.csrf);setGrant('');
    const next=await refresh(session.csrf);if(next.graphs[0])await load(next.graphs[0].id,session.csrf);
  }
  if(!csrf)return <main className="login"><div className="seal">F</div><small>FROSTVEIL STUDIO</small><h1>Arcane Workbench</h1><p>เครื่องมือสร้างบทสนทนาและเส้นทางของโลก Frostveil</p>
    <label>One-time editor grant<input value={grant} onChange={event=>setGrant(event.target.value)} autoComplete="off" type="password"/></label>
    <button disabled={!grant||busy} onClick={()=>run(login)}>Enter studio →</button><p role="alert">{message}</p><p className="muted">ใช้รหัสครั้งเดียวจากคำสั่ง /editor ในเกม<br/>Local workspace · Authorized administrators only</p></main>;

  return <div className="studio">
    <header className="app-header">
      <div className="studio-brand"><div className="brand-mark" aria-hidden="true">F<span>◇</span></div><div><strong>Frostveil <span>Studio</span></strong><small>ARCANE WORKBENCH</small></div></div>
      <div className="graph-context"><Icon name="npc"/><select aria-label="Graph" value={graph?.id??''} disabled={busy||!!routing.candidate} onChange={event=>run(()=>load(event.target.value))}>{catalog?.graphs.map((item:any)=><option key={item.id} value={item.id}>{item.id} · v{item.version}{item.draftRevision?` · draft ${item.draftRevision}`:''}</option>)}</select></div>
      <span className={'badge '+(dirty?'unsaved':'')}><span className="status-dot"/>{dirty?'Unsaved changes':'Saved draft'}</span>
      <div className="header-session"><span className="session-dot"/>Local workspace</div>
      <details className="account-menu"><summary title="Authenticated editor session"><Icon name="user"/><span>Admin session</span><span className="chevron">⌄</span></summary><div><p>สิทธิ์ตรวจสอบจากเซิร์ฟเวอร์<br/><span>Session expires automatically</span></p><button onClick={()=>run(async()=>{if(dirty&&!confirm('Discard unsaved changes?'))return;await api('logout');setCsrf('');setCatalog(null);setGraph(null);setCanvas({nodes:[],edges:[]});setMessage('Signed out');})}><Icon name="logout"/>Sign out</button></div></details>
    </header>
    <nav className="primary-toolbar" aria-label="Authoring workflow" aria-busy={busy}>
      <div className="tool-group"><small>EDIT</small><div><button className="icon-button" aria-label="Undo" title="Undo · Ctrl+Z" onClick={undoChange} disabled={busy||!!routing.candidate||!undo.current.length}><Icon name="undo"/></button><button className="icon-button" aria-label="Redo" title="Redo · Ctrl+Shift+Z" onClick={redoChange} disabled={busy||!!routing.candidate||!redo.current.length}><Icon name="redo"/></button><button title="Save draft · Ctrl+S" disabled={busy||!graph||!!routing.candidate} onClick={()=>run(save)}><Icon name="save"/>Save draft</button></div></div>
      <div className="tool-group"><small>NAVIGATE</small><div><button title="Fit every node in view" onClick={()=>navigate()}><Icon name="fit"/>Fit All</button><button title="Focus the opening conversation" onClick={opening}><Icon name="entry"/>Opening</button></div></div>
      <div className="tool-group"><small>REVIEW</small><div><button disabled={busy||!graph} title="Check graph structure and service permissions" onClick={()=>run(validate)}><Icon name="check"/>Validate</button><button disabled={busy||!graph} title="Preview without changing player data" onClick={()=>run(()=>showPreview([]))}><Icon name="preview"/>Preview</button></div></div>
      <div className="tool-group delivery-tools"><small>DELIVER</small><div><button className="primary" disabled={busy||!graph||!!routing.candidate} title="Validate and publish · confirmation required" onClick={()=>run(async()=>{
        if(!confirm('Publish this graph for new conversations?'))return;
        await validate();const saved=dirty?await save():{revision};
        const result=await api('publish',{id:graph!.id,draftRevision:saved.revision,version:published});
        setPublished(result.version);const updated=await api('graph',{id:graph!.id});setHistory(updated.history);await refresh();setMessage('Published v'+result.version+' for new conversations');
      })}><Icon name="publish"/>Publish</button>
      <select aria-label="NPC" title="NPC assignment target" value={npc} disabled={busy} onChange={event=>setNpc(event.target.value)}><option value="">Choose NPC</option>{catalog?.npcs.map((item:any)=><option value={item.id} key={item.id}>{item.name}</option>)}</select>
      <button disabled={busy||!!routing.candidate||!npc||!published} title="Assign the published version to the selected NPC" onClick={()=>run(async()=>{const value=await api('assign',{npc,id:graph!.id,revision:catalog.revision});await refresh();setMessage('Graph assignment saved (catalog '+value.revision+')');})}><Icon name="link"/>Assign graph</button></div></div>
      <button className="new-graph icon-button" aria-label="New graph" title="Create a new empty graph" disabled={busy||!!routing.candidate} onClick={()=>{if(dirty&&!confirm('Discard unsaved changes?'))return;const id='dialogue-'+crypto.randomUUID().slice(0,8);const value:Graph={schemaVersion:1,id,version:1,entry:'entry',nodes:[{id:'entry',type:'entry',next:'end'},{id:'end',type:'end'}]};setGraph(value);setCanvas(toCanvas(value));setRevision(0);setPublished(0);setHistory([]);markDirty();setValidation('unchecked');setSelected('entry');undo.current=[];redo.current=[];}}><Icon name="plus"/></button>
    </nav>
    <div style={{'--inspector-width':inspectorWidth+'px','--library-width':libraryWidth+'px'} as React.CSSProperties} className={'workspace '+(!libraryOpen?'library-hidden ':'')+(!inspectorOpen?'inspector-hidden':'')}>
      <aside className="library" aria-label="Node library">
        <div className="panel-title"><div><Icon name="library"/><b>Node Library</b></div><button className="icon-button" aria-label="Collapse node library" title="Collapse library · Ctrl+B" onClick={()=>setLibraryOpen(false)}><Icon name="close" size={16}/></button></div>
        <div className="library-scroll"><div className="library-search"><Icon name="search"/><input aria-label="Search nodes" placeholder="Find a node…" value={query} onChange={event=>setQuery(event.target.value)}/></div>
        <p className="library-help">ลากลงพื้นที่ทำงาน หรือคลิกเพื่อเพิ่ม</p>
        {['CONVERSATION','FLOW & LOGIC','SERVICES'].map(category=><section className="library-category" key={category}><h3>{category}</h3>{nodeTypesList.filter(type=>(category==='CONVERSATION'?['npc','choices']:category==='FLOW & LOGIC'?['entry','condition','end']:['action']).includes(type)&&(type+' '+nodeInfo[type].label+' '+nodeInfo[type].hint).toLowerCase().includes(query.toLowerCase())).map(type=><button className="palette-item" style={{'--node-accent':nodeColors[type]} as React.CSSProperties} draggable key={type} disabled={type==='entry'&&canvas.nodes.some(item=>item.data.runtime.type==='entry')} onClick={()=>add(type)} onDragStart={event=>{event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('application/frostveil-node',type);}}><span className="palette-icon"><Icon name={type}/></span><span>{nodeInfo[type].label}<em>{nodeInfo[type].hint}</em></span><span className="palette-add">+</span></button>)}</section>)}
        {query&&!nodeTypesList.some(type=>(type+' '+nodeInfo[type].label+' '+nodeInfo[type].hint).toLowerCase().includes(query.toLowerCase()))&&<p className="empty-note">ไม่พบโหนดที่ค้นหา</p>}
        <section className="version-section"><h3><Icon name="history" size={16}/>VERSION HISTORY<span>{history.length}</span></h3>{history.length?history.map(item=><button className="history-item" aria-label={'v'+item.version+' · Roll back'} title={'Publish version '+item.version+' as a new version · confirmation required'} key={item.version} onClick={()=>run(async()=>{
          if(dirty&&!confirm('Discard current changes and roll back to v'+item.version+'?'))return;
          if(!confirm('Publish version '+item.version+' as a new version?'))return;
          const result=await api('rollback',{id:graph!.id,targetVersion:item.version,version:published});
          await load(graph!.id);setPublished(result.version);setMessage('Rollback published as v'+result.version);
        })}><Icon name="history" size={16}/><span>v{item.version} · Roll back</span><span>↗</span></button>):<p className="empty-note">ยังไม่มีเวอร์ชันเผยแพร่</p>}</section>
        </div><div className="panel-sizing"><label>Library width<input aria-label="Node library width" type="range" min="220" max="320" step="10" value={libraryWidth} onChange={e=>setLibraryWidth(Number(e.target.value))}/></label></div>
        <PanelResize label="Resize node library" value={libraryWidth} min={220} max={320} onChange={setLibraryWidth} side="left"/>
      </aside>
      <section data-active-edge={activePathId} className={'canvas '+(selection?'trace-active ':'')+(activePath?'path-isolated':'')} onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect='copy';}} onDrop={event=>{
        event.preventDefault();if(routing.candidate)return;const type=event.dataTransfer.getData('application/frostveil-node') as Node['type'];
        if(nodeTypesList.includes(type)&&flow.current)add(type,flow.current.screenToFlowPosition({x:event.clientX,y:event.clientY}));
      }}>
        <div className="canvas-toolbar"><div className="canvas-context"><Icon name="npc" size={16}/><span>Dialogue graph</span><span className="context-separator">/</span><b>{graph?.id}</b><span className="context-version">v{published}</span></div>
          <div className="canvas-tools"><label className="routing-mode">Routing<select aria-label="Routing mode" value={routing.mode} disabled={routing.layoutBusy||!!routing.candidate} onChange={e=>routing.setMode(e.target.value as 'smart'|'legacy')}><option value="smart">Smart</option><option value="legacy">Legacy</option></select></label><button className="icon-button" aria-label="Toggle node library" aria-pressed={libraryOpen} title="Node library · Ctrl+B" onClick={()=>setLibraryOpen(v=>!v)}><Icon name="library" size={17}/></button><button className="icon-button" aria-label="Auto Arrange" title="Auto Arrange · Preview ELK layout before applying" disabled={routing.layoutBusy||!!routing.candidate||!graph} onClick={autoArrange}><Icon name="arrange" size={17}/></button>
          <button title="Focus selected node or connection endpoints" disabled={!selection} onClick={()=>navigate(selection?.kind==='node'?[selection.id]:[...traced.nodes])}><Icon name="focus" size={16}/><span>Focus Selected</span></button>
          <button className="icon-button" aria-label="Back View" title="Return to previous canvas view" disabled={!viewCount} onClick={()=>{const previous=views.current.pop();if(previous){void flow.current?.setViewport(previous,{duration:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?0:220});setViewCount(views.current.length);}}}><Icon name="back" size={17}/></button>
          <button className="icon-button" aria-label="แผนผังย่อ" title="Toggle minimap" aria-pressed={miniMapOpen} onClick={()=>setMiniMapOpen(v=>!v)}><Icon name="map" size={17}/></button><button className="icon-button" aria-label="Toggle properties" aria-pressed={inspectorOpen} title="Toggle inspector" onClick={()=>setInspectorOpen(v=>!v)}><Icon name="panel" size={17}/></button></div></div>
        <div className="graph-navigation">
          <div className="graph-search"><Icon name="search" size={16}/><input ref={searchInput} aria-label="Search graph" placeholder="ค้นหาโหนด บทพูด ตัวเลือก…  Ctrl+K" value={searchText} aria-expanded={searchOpen} aria-controls="graph-results" role="combobox" aria-autocomplete="list" aria-activedescendant={searchOpen&&found[searchActive]?'result-'+found[searchActive]!.id:undefined}
            onFocus={()=>setSearchOpen(true)} onChange={e=>{setSearchText(e.target.value);setSearchActive(0);setSearchOpen(true);}}
            onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setSearchActive(i=>Math.min(found.length-1,i+1));}else if(e.key==='ArrowUp'){e.preventDefault();setSearchActive(i=>Math.max(0,i-1));}else if(e.key==='Enter'&&found[searchActive]){e.preventDefault();chooseResult(found[searchActive]!.id);}else if(e.key==='Escape'){e.stopPropagation();setSearchOpen(false);e.currentTarget.blur();}}}/>
            {searchOpen&&<div className="search-results" id="graph-results" role="listbox" aria-label="Matching nodes"><div className="search-summary">{found.length} results <button onClick={()=>{setSearchText('');setSearchOpen(false);}}>Clear search</button></div>{!found.length&&<p>ไม่พบโหนด ลองชื่อ ชนิดโหนด หรือข้อความไทย</p>}{found.map((n,i)=><button type="button" id={'result-'+n.id} role="option" aria-selected={i===searchActive} key={n.id} onClick={()=>chooseResult(n.id)}><span style={{color:nodeColors[n.type]}}><Icon name={n.type} size={20}/></span><span><b>{title(n)}</b><em>{n.id} · {(n.text??n.choices?.[0]?.text??n.argument??nodeInfo[n.type].hint).slice(0,85)}</em></span></button>)}</div>}
          </div>
          <label className="trace-control">Trace<select aria-label="Trace mode" value={traceMode} onChange={e=>setTraceMode(e.target.value as TraceMode)} disabled={selection?.kind!=='node'}><option value="direct">Direct connections</option><option value="upstream">Upstream dependencies</option><option value="downstream">Downstream flow</option></select></label><button className="reset-trace" title="Clear selection and tracing · Escape" onClick={clearSelection}>Reset trace</button>
        </div>
        {(routing.layoutBusy||routing.candidate||routing.layoutMessage)&&<div className="layout-preview-bar" role="region" aria-label="Auto Arrange preview"><div><b>{routing.layoutBusy?'Calculating ELK layout…':routing.candidate?'Layout preview':'Auto Arrange'}</b><span>{routing.layoutMessage}{routing.candidate&&` · ${routing.candidate.result.routes.size} routes · ${Math.round(routing.candidate.result.elapsedMs)}ms`}</span></div>{routing.candidate&&<button className="primary" disabled={busy} onClick={applyLayout}>Apply layout</button>}<button aria-label="Cancel auto arrange" onClick={cancelLayoutView}>{routing.candidate||routing.layoutBusy?'Cancel':'Dismiss'}</button></div>}
        {(routing.error||routing.warnings.length>0)&&<div className="routing-notice" role="status">{routing.error?'Smart routing unavailable; showing Legacy paths. '+routing.error:`${routing.warnings.length} routing notes · ${routing.warnings.slice(0,2).join(' · ')}`}</div>}
        <ReactFlow<BlueprintNode> nodes={viewNodes} edges={viewEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onInit={instance=>{flow.current=instance;}}
          onMoveEnd={(_,view)=>setZoom(Math.round(view.zoom*100))} onPaneClick={()=>{clearSelection();setSearchOpen(false);}} onNodeClick={(_,item)=>{setSelected(item.id);setInspectorOpen(true);setSearchOpen(false);}} onEdgeClick={inspectEdge}
          nodesDraggable={!routing.candidate} nodesConnectable={!routing.candidate} onNodeDragStart={()=>{dragStart.current=structuredClone(canvas);}}
          onNodeDragStop={()=>{if(dragStart.current){record(dragStart.current);dragStart.current=null;markDirty();}}}
          onNodesChange={changes=>{const chosen=changes.find(c=>c.type==='select'&&c.selected);if(chosen?.type==='select')setSelected(chosen.id);if(changes.every(c=>c.type==='select'))return;const next={...canvas,nodes:applyNodeChanges(changes.filter(c=>c.type!=='select'),canvas.nodes)};
            if(changes.some(change=>change.type==='remove')||!dragStart.current&&changes.some(c=>c.type==='position'&&c.position&&!c.dragging))changeCanvas(next);else setCanvas(next);
          }} onEdgesChange={changes=>{const chosen=changes.find(c=>c.type==='select'&&c.selected);if(chosen?.type==='select')selectEdge(chosen.id);if(changes.every(c=>c.type==='select'))return;const next={...canvas,edges:applyEdgeChanges(changes.filter(c=>c.type!=='select'),canvas.edges)};if(changes.some(item=>item.type==='remove'||item.type==='add'||item.type==='replace'))change(next);else setCanvas(next);}}
          onConnect={connection=>{try{change(connect(connection,canvas));}catch(error){setMessage(error instanceof Error?error.message:String(error));}}}
          elevateEdgesOnSelect={false} onlyRenderVisibleElements minZoom={.01} maxZoom={1.6} colorMode="dark" edgesFocusable nodesFocusable deleteKeyCode={null}><ReadingView graphId={graph?.id??''} ids={openingIds}/><Background gap={24} color="#30353c" size={1}/><Controls/>{miniMapOpen&&<MiniMap nodeColor={n=>nodeColors[(n.data.runtime as Node).type]} maskColor="#0c141cbb" pannable zoomable/>}</ReactFlow>
        <div className="canvas-hint">{activePath?<span className="active-path"><Icon name="arrow" size={14}/>Active path · {connection(index,activePath).output}</span>:<span>ลากพื้นเพื่อเลื่อน <i>·</i> เลื่อนล้อเพื่อซูม <i>·</i> Ctrl+K ค้นหา</span>}<span title={routing.warnings.join(' · ')}>{routing.mode==='legacy'?'Legacy curves':routing.routing?'Routing… (updates on drop)':routing.result?`Smart · ${routing.result.routes.size} routes · ${Math.round(routing.result.elapsedMs)}ms`: 'Smart routing'} · เส้นประ = ย้อนกลับ</span></div>
      </section>
      <aside className="inspector" aria-label="Properties inspector">
        <div className="panel-title"><div><Icon name={selection?.kind==='edge'?'link':'panel'}/><b>{selection?.kind==='edge'?'Connection':'Properties'}</b></div><button className="icon-button" aria-label="Collapse inspector" title="Collapse inspector" onClick={()=>setInspectorOpen(false)}><Icon name="close" size={16}/></button></div>
        <div className="inspector-sizing"><label>Panel width<input aria-label="Inspector width" type="range" min="300" max="480" step="10" value={inspectorWidth} onChange={e=>setInspectorWidth(Number(e.target.value))}/></label></div>
        <div className="inspector-content" ref={inspectorElement}><fieldset className="inspector-fields" disabled={!!routing.candidate}>
      {selection?.kind==='edge'?<ConnectionInspector index={index} id={selection.id} focus={focusNode} select={selectEdge} clear={clearSelection} remove={deleteSelection} overlaps={overlapIds} route={routing.result?.routes.get(selection.id)} legacy={routing.mode==='legacy'&&!routing.candidate}/>:<><small>NODE INSPECTOR</small>{node?<>
        <div className="inspector-heading" style={{'--node-accent':nodeColors[node.type]} as React.CSSProperties}><span className="inspector-type-icon"><Icon name={node.type} size={22}/></span><div><h2>{title(node)}</h2><span>{node.type==='npc'?'NPC dialogue':node.type==='action'?'Guild service':node.type}</span></div></div>
        <details className="technical-id"><summary>Node identity</summary><code>{node.id}</code></details>
        <section className="property-section"><h3>{node.type==='choices'?'PLAYER CHOICES':node.type==='npc'?'CONVERSATION':'CONFIGURATION'}</h3>
        {node.type==='npc'&&<label>Dialogue<textarea aria-label="Dialogue" value={node.text??''} maxLength={4096} onChange={event=>patch({text:event.target.value})}/><span className="field-help">ข้อความที่แสดงต่อผู้เล่น · {(node.text??'').length}/4096</span></label>}
        {node.type==='entry'&&<label>Continue to<select value={node.next??''} onChange={event=>patch({next:event.target.value})}><option value="">Connect on canvas…</option>{canvas.nodes.filter(item=>item.id!==node.id&&item.data.runtime.type!=='entry').map(item=><option value={item.id} key={item.id}>{title(item.data.runtime)} · {item.id}</option>)}</select></label>}
        {node.type==='condition'&&<label>Condition<select value={node.condition} onChange={event=>patch({condition:event.target.value as Node['condition']})}>{catalog.conditions.map((item:string)=><option value={item} key={item}>{conditionLabels[item]??item}</option>)}</select><span className="field-help">แยกเส้นทางจริงและเท็จตามสถานะผู้เล่น</span></label>}
        {node.type==='action'&&<><label>Service<select value={node.action} onChange={event=>patch({action:event.target.value as Node['action'],argument:undefined})}>{catalog.actions.map((item:string)=><option value={item} key={item}>{actionLabels[item]??item}</option>)}</select><span className="field-help">ใช้บริการ Courier ที่ตรวจสิทธิ์โดยเซิร์ฟเวอร์</span></label>
          {['accept','buyPermit'].includes(node.action!)&&<label>Target<select value={node.argument??''} onChange={event=>patch({argument:event.target.value})}><option value="">Choose…</option>{(node.action==='accept'?catalog.routes:catalog.permits).map((item:any)=><option value={item.id} key={item.id}>{item.label}</option>)}</select></label>}</>}
        {node.type==='end'&&<p className="empty-note">จบการสนทนาและคืนการควบคุมให้ผู้เล่น</p>}
        {node.type==='choices'&&<><p className="field-help">ชี้หรือโฟกัสคำตอบเพื่อเน้นหนึ่งเส้นทาง · {node.choices?.length??0}/16</p><div className="choices">{node.choices?.map((choice,i)=><div className="choice" key={choice.id} onPointerEnter={()=>onPortFocus(node.id,'choice:'+choice.id)} onPointerLeave={()=>onPortFocus(node.id,null)}>
          <div className="choice-heading"><span>{String(i+1).padStart(2,'0')}</span><small>PLAYER RESPONSE</small><button className="text-button danger" onClick={()=>{if(confirm('Remove this choice and its connection?'))patch({choices:node.choices!.filter(item=>item.id!==choice.id)});}}>Remove</button></div>
          <label className="sr-only" htmlFor={'edit-'+choice.id}>Choice label</label><textarea id={'edit-'+choice.id} aria-label="Choice label" value={choice.text} maxLength={256} rows={2} onFocus={()=>onPortFocus(node.id,'choice:'+choice.id,'focus')} onBlur={()=>onPortFocus(node.id,null,'focus')} onChange={event=>patch({choices:node.choices!.map(item=>item.id===choice.id?{...item,text:event.target.value}:item)})}/>
          <div className={'choice-target '+(!index.nodes.has(choice.next)?'missing':'')}><Icon name="arrow" size={14}/><span>{index.nodes.has(choice.next)?title(index.nodes.get(choice.next)!)+' · '+choice.next:'ยังไม่ได้เชื่อมปลายทาง'}</span>{index.nodes.has(choice.next)&&<button className="icon-button" aria-label={'Focus choice '+(i+1)+' destination'} title="Focus destination" onClick={()=>focusNode(choice.next)}><Icon name="focus" size={14}/></button>}</div>
          <details className="technical-id"><summary>Choice identity</summary><code>{choice.id}</code></details>
        </div>)}</div><button className="add-choice" disabled={(node.choices?.length??0)>=16} onClick={()=>patch({choices:[...(node.choices??[]),{id:'choice-'+crypto.randomUUID().slice(0,8),text:'New choice',next:''}]})}><Icon name="plus" size={16}/>Add choice</button></>}
        </section>
        <details className="node-connections"><summary>Connections ({new Set([...(index.incoming.get(node.id)??[]),...(index.outgoing.get(node.id)??[])].map(e=>e.id)).size})</summary>{[...new Map([...(index.incoming.get(node.id)??[]),...(index.outgoing.get(node.id)??[])].map(e=>[e.id,e])).values()].map(e=><button key={e.id} onClick={()=>selectEdge(e.id)}>{e.target===node.id?'← Incoming':'→ Outgoing'} · {connection(index,e).meaning}</button>)}</details>
        <details className="node-neighbors"><summary>Connected nodes ({traced.nodes.size>0?traced.nodes.size-1:0})</summary>{[...traced.nodes].filter(id=>id!==node.id&&index.nodes.has(id)).map(id=><button key={id} onClick={()=>chooseResult(id)}>{title(index.nodes.get(id)!)} · {id}</button>)}</details>
        <div className="node-management"><button disabled={node.type==='entry'} onClick={()=>{if(canvas.nodes.length>=128){setMessage('Maximum 128 nodes');return;}const id=node.type+'-'+crypto.randomUUID().slice(0,8);change({...canvas,nodes:[...canvas.nodes,{id,type:'blueprint',position:{x:selectedNode.position.x+48,y:selectedNode.position.y+48},data:{runtime:{...structuredClone(node),id}}}]});setSelected(id);}}><Icon name="copy" size={16}/>Duplicate node</button>
        <button className="danger" disabled={node.id===graph?.entry} onClick={deleteSelection}><Icon name="trash" size={16}/>Delete node</button></div>
      </>:<div className="inspector-empty"><span><Icon name="panel" size={36}/></span><h2>เลือกสิ่งที่ต้องการแก้ไข</h2><p>คลิกโหนดเพื่อแก้บทพูดและตัวเลือก<br/>หรือคลิกเส้นเพื่อตรวจเส้นทาง</p><div><kbd>Ctrl</kbd> + <kbd>K</kbd><p>ค้นหาและข้ามไปยังโหนด</p></div></div>}</>}</fieldset></div>
      <PanelResize label="Resize inspector" value={inspectorWidth} min={300} max={480} onChange={setInspectorWidth} side="right"/>
      </aside>
    </div>
    <footer className="status-bar"><div><span className="session-dot"/><b>Local</b><span>{canvas.nodes.length} nodes</span><span>{canvas.edges.length} connections</span><span className="status-separator"/><span>{dirty?'Modified':'Saved'} · draft r{revision}</span><span>Published v{published}</span></div><div><span className={'validation-state '+validation}><Icon name={validation==='invalid'?'warning':validation==='valid'?'check':'condition'} size={14}/>{validation==='valid'?'Validation passed':validation==='invalid'?'Validation failed':'Not validated'}</span><span className="status-separator"/><span>{busy?'Working…':'Ready'}</span><b>{zoom}%</b></div></footer>
    {noticeVisible&&<div className={'toast '+noticeTone} role={noticeTone==='error'?'alert':'status'}><Icon name={noticeTone==='error'?'warning':'check'} size={18}/><span>{message}</span><button className="icon-button" aria-label="Dismiss notification" onClick={()=>setNoticeVisible(false)}><Icon name="close" size={15}/></button></div>}
    {preview&&<DialogFrame contentKey={preview.current} onClose={()=>setPreview(null)}><div className="preview-heading"><div><small>READ-ONLY PREVIEW</small><h2>{preview.current.title??'Conversation ended'}</h2></div><Icon name="preview" size={26}/></div>
      <label className="preview-toggle"><input type="checkbox" checked={activeCourier} onChange={event=>{setActiveCourier(event.target.checked);setPreview(null);}}/> Mock active Courier contract</label><p className="preview-dialogue">{preview.current.text}</p>
      <div className="preview-choices">{preview.current.choices?.map((choice:any,i:number)=><button disabled={busy} key={choice.id} onClick={()=>run(()=>showPreview([...previewPath,choice.id]))}><span>{String(i+1).padStart(2,'0')}</span>{choice.text}<Icon name="arrow" size={16}/></button>)}</div>
      <p className="muted">Actions are descriptions only. No player or economy data changes.</p><button onClick={()=>setPreview(null)}>Close preview</button></DialogFrame>}

  </div>;
  function changeCanvas(next:Canvas){record(canvas);setCanvas(next);markDirty();setValidation('unchecked');setPreview(null);}
}
