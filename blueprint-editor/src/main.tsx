import React, {useEffect, useRef, useState, useMemo, useCallback} from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, Handle, Position,
  applyNodeChanges, applyEdgeChanges, useUpdateNodeInternals, useReactFlow,
  type Edge, type NodeProps
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './style.css';
import {toCanvas, fromCanvas, connect, positions, arrange, nodeHeight, nodeHandles, edgesFromNodes, type Canvas, type BlueprintNode} from './mapping';
import {graphIndex,connection,trace,search,title,validSelection,openingNodes,nodeInfo,nodeColors,actionLabels,type Selection,type TraceMode} from './inspection';
import {ConnectionEdge,ConnectionInspector} from './connection-ui';
import {validateGraph, type Graph, type Node} from '../../rp-gamemode/src/modules/dialogue/graph-model';

type FlowHandle = {screenToFlowPosition(point: {x: number; y: number}): {x: number; y: number};fitView(options?:any):Promise<boolean>;getViewport():{x:number;y:number;zoom:number};setViewport(view:{x:number;y:number;zoom:number},options?:{duration?:number}):Promise<boolean>};
const nodeTypesList: Node['type'][] = ['entry','npc','choices','condition','action','end'];

const Card=React.memo(function Card({id, data, selected}: NodeProps<BlueprintNode>) {
  const update = useUpdateNodeInternals();
  const runtime = data.runtime;
  const outputs = runtime.type === 'choices'
    ? (runtime.choices ?? []).map(choice => ({id:'choice:'+choice.id,label:choice.text || 'Choice'}))
    : runtime.type === 'end' ? []
    : runtime.type === 'condition' ? [{id:'next',label:'True'},{id:'otherwise',label:'False'}]
    : [{id:'next',label:runtime.type==='action'?'หลังใช้บริการ':'ดำเนินเรื่องต่อ'}];
  useEffect(() => update(id), [id, outputs.length, update]);
  const info=nodeInfo[runtime.type];
  return <article style={{height:nodeHeight(runtime),'--node-accent':nodeColors[runtime.type]} as React.CSSProperties} className={'node node-'+runtime.type+' '+(selected?'selected':data.related?'related':'')}>
    {runtime.type!=='entry'&&<Handle type="target" position={Position.Left}/>}
    <div className="node-heading"><span className="node-icon">{info.icon}</span><div><small>{runtime.type==='action'?'SERVICE':runtime.type.toUpperCase()}</small><strong>{runtime.type==='action'?actionLabels[runtime.action??'']??info.label:info.label}</strong></div>{runtime.type==='choices'&&<span className="node-count">{outputs.length}</span>}</div>
    <div className="node-detail">{runtime.type==='npc'?<p>{runtime.text||'เพิ่มข้อความบทสนทนา…'}</p>:runtime.type==='action'?<span>{data.targetLabel??runtime.argument??'บริการ Courier Guild'}</span>:runtime.type==='condition'?<span>{runtime.condition==='courierIdle'?'ผู้เล่นไม่มีงาน Courier อยู่':'ผ่านเงื่อนไขเสมอ'}</span>:runtime.type==='choices'?<span>เลือกคำตอบเพื่อไปยังขั้นตอนถัดไป</span>:<span>{info.hint}</span>}</div>
    <div className="node-outputs">
    {outputs.map((output,index)=><div className="output" key={output.id}>
      {runtime.type==='choices'&&<span className="choice-number">{String(index+1).padStart(2,'0')}</span>}<span title={output.label}>{output.label}</span><span className="output-arrow">→</span>
      <Handle id={output.id} type="source" position={Position.Right} style={{top:'50%',right:-22}}/>
    </div>)}</div><div className="node-id">{runtime.id}</div>
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
  const [dirty,setDirty]=useState(false), [revision,setRevision]=useState(0), [published,setPublished]=useState(0);
  const [history,setHistory]=useState<any[]>([]), [preview,setPreview]=useState<any>(null), [previewPath,setPreviewPath]=useState<string[]>([]);
  const [activeCourier,setActiveCourier]=useState(false), [npc,setNpc]=useState('');
  const [libraryOpen,setLibraryOpen]=useState(()=>window.innerWidth>=1450),[inspectorOpen,setInspectorOpen]=useState(true),[miniMapOpen,setMiniMapOpen]=useState(false);
  const undo=useRef<{canvas:Canvas;selection:Selection}[]>([]), redo=useRef<{canvas:Canvas;selection:Selection}[]>([]), dragStart=useRef<Canvas|null>(null), flow=useRef<FlowHandle|null>(null);
  const [overlapIds,setOverlapIds]=useState<string[]>([]),lastEdgeClick=useRef<{x:number;y:number;key:string;index:number}|null>(null);
  const selected=selection?.kind==='node'?selection.id:'';
  const setSelected=useCallback((id:string)=>{setSelection(id?{kind:'node',id}:null);setOverlapIds([]);},[]);
  const selectEdge=useCallback((id:string)=>{setSelection({kind:'edge',id});setInspectorOpen(true);},[]);
  const [traceMode,setTraceMode]=useState<TraceMode>('direct');
  const [searchText,setSearchText]=useState(''),[searchOpen,setSearchOpen]=useState(false),[searchActive,setSearchActive]=useState(0);
  const inspectorElement=useRef<HTMLElement>(null),searchInput=useRef<HTMLInputElement>(null),[inspectorWidth,setInspectorWidth]=useState(340);
  const views=useRef<{x:number;y:number;zoom:number}[]>([]),[viewCount,setViewCount]=useState(0);
  // Position/measurement changes do not rebuild adjacency or text indexes.
  const semanticNodes=useRef<Node[]>([]),runtimeNodes=canvas.nodes.map(n=>n.data.runtime);
  if(runtimeNodes.length!==semanticNodes.current.length||runtimeNodes.some((n,i)=>n!==semanticNodes.current[i]))semanticNodes.current=runtimeNodes;
  const index=useMemo(()=>graphIndex(semanticNodes.current,canvas.edges),[semanticNodes.current,canvas.edges]);
  const openingIds=useMemo(()=>openingNodes(index,graph?.entry??''),[index,graph?.entry]);
  const targets=useMemo(()=>new Map<string,string>([...(catalog?.routes??[]),...(catalog?.permits??[])].map((n:any)=>[n.id,n.label])),[catalog]);
  const traced=useMemo(()=>trace(index,selection,traceMode),[index,selection,traceMode]);
  const found=useMemo(()=>search(index,searchText,targets),[index,searchText,targets]);
  const decorations=useRef(new Map<string,BlueprintNode['data']>());
  const nodeViews=useRef(new Map<string,{raw:BlueprintNode;view:BlueprintNode}>());
  const viewNodes=useMemo(()=>canvas.nodes.map(n=>{
    const targetLabel=targets.get(n.data.runtime.argument??''),related=traced.nodes.has(n.id),old=decorations.current.get(n.id);
    const data=old&&old.runtime===n.data.runtime&&old.targetLabel===targetLabel&&old.related===related?old:{runtime:n.data.runtime,targetLabel,related};
    decorations.current.set(n.id,data);
    const cached=nodeViews.current.get(n.id),isSelected=n.id===selected;
    if(cached?.raw===n&&cached.view.data===data&&cached.view.selected===isSelected)return cached.view;
    const view={...n,measured:{width:272,height:nodeHeight(n.data.runtime)},handles:nodeHandles(n.data.runtime),selected:isSelected,data};nodeViews.current.set(n.id,{raw:n,view});return view;
  }),[canvas.nodes,targets,traced.nodes,selected,setSelected]);
  const descriptorCache=useRef(new Map<string,{edge:Edge;detail:ReturnType<typeof connection>;lane:number}>());
  const descriptors=useMemo(()=>{
    const lanes=new Map<string,number>();
    return canvas.edges.map(edge=>{const detail=connection(index,edge),group=detail.source?.type==='choices'?'source:'+edge.source:'target:'+edge.target,ordinal=lanes.get(group)??0,lane=ordinal%16;lanes.set(group,ordinal+1);const old=descriptorCache.current.get(edge.id);if(old?.edge===edge&&old.lane===lane&&old.detail.meaning===detail.meaning&&old.detail.source?.type===detail.source?.type)return old;const value={edge,detail,lane};descriptorCache.current.set(edge.id,value);return value;});
  },[canvas.edges,index]);
  const edgeViews=useRef(new Map<string,{descriptor:typeof descriptors[number];active:boolean;chosen:boolean;view:Edge}>());
  const viewEdges=useMemo(()=>descriptors.map(descriptor=>{
      const {edge:e,detail,lane}=descriptor,active=traced.edges.has(e.id),chosen=selection?.kind==='edge'&&selection.id===e.id;
      const cached=edgeViews.current.get(e.id);if(cached?.descriptor===descriptor&&cached.active===active&&cached.chosen===chosen)return cached.view;
      const color=chosen?'#ffe3a1':active?'#f3ce83':nodeColors[detail.source?.type??'entry'];
      const view={...e,type:'connection',selected:chosen,selectable:true,focusable:true,interactionWidth:26,ariaRole:'button' as const,ariaLabel:detail.meaning,
        domAttributes:{onFocus:()=>selectEdge(e.id)},data:{lane,active,meaning:detail.meaning,shortLabel:detail.choiceNumber?'#'+detail.choiceNumber+' · '+detail.output:detail.output},
        zIndex:chosen?8:active?3:0,style:{stroke:color,strokeWidth:chosen?3.4:active?2.5:1.5},
        className:chosen?'edge-chosen':active?'edge-focused':'',markerEnd:{type:'arrowclosed' as const,color,width:16,height:16}};
      edgeViews.current.set(e.id,{descriptor,active,chosen,view});return view;
  }),[descriptors,selection,traced.edges,selectEdge]);
  useEffect(()=>{const nodes=new Set(canvas.nodes.map(n=>n.id)),edges=new Set(canvas.edges.map(e=>e.id));for(const id of nodeViews.current.keys())if(!nodes.has(id))nodeViews.current.delete(id);for(const id of edgeViews.current.keys())if(!edges.has(id)){edgeViews.current.delete(id);descriptorCache.current.delete(id);}},[canvas.nodes,canvas.edges]);
  useEffect(()=>{setSelection(current=>validSelection(index,current));setOverlapIds(ids=>ids.filter(id=>index.edges.has(id)));},[index]);
  useEffect(()=>{const ids=new Set(canvas.nodes.map(n=>n.id));for(const id of decorations.current.keys())if(!ids.has(id))decorations.current.delete(id);},[canvas.nodes]);
  function navigate(ids?:string[]){if(!flow.current)return;views.current.push(flow.current.getViewport());if(views.current.length>20)views.current.shift();setViewCount(views.current.length);void flow.current.fitView({nodes:ids?.map(id=>({id})),padding:.2,maxZoom:1,duration:220,includeHiddenNodes:true});}
  function focusNode(id:string){navigate([id]);}
  function opening(){navigate(openingIds);}
  function chooseResult(id:string){setSelected(id);setInspectorOpen(true);setSearchOpen(false);focusNode(id);}
  function clearSelection(){setSelection(null);setTraceMode('direct');setOverlapIds([]);lastEdgeClick.current=null;}
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
  async function run(fn:()=>Promise<void>){try{await fn();}catch(error){setMessage(error instanceof Error?error.message:String(error));}}
  function record(previous:Canvas){undo.current.push({canvas:structuredClone(previous),selection});if(undo.current.length>100)undo.current.shift();redo.current=[];}
  function change(next:Canvas){record(canvas);setCanvas(next);setDirty(true);setPreview(null);}
  async function refresh(token=csrf){const value=await api('catalog',{},token);setCatalog(value);return value;}
  async function load(id:string,token=csrf){
    if(!id)return;
    if(dirty&&!confirm('Discard unsaved changes?'))return;
    const result=await api('graph',{id},token), value=result.draft?.graph??result.published;
    if(!value)throw Error('Graph data is unavailable');
    setGraph(value);setCanvas(toCanvas(value,result.draft?.layout));setRevision(result.draft?.revision??0);
    setPublished(result.published?.version??0);setHistory(result.history);setDirty(false);setSelected(value.nodes.find((n:Node)=>n.type==='npc')?.id??value.entry);
    undo.current=[];redo.current=[];views.current=[];setViewCount(0);setSearchText('');setSearchOpen(false);setPreview(null);setMessage('Loaded '+id);
  }
  async function save(){
    const value=current();if(!value)throw Error('Choose a graph first');
    const saved=await api('draft',{graph:value,layout:positions(canvas),revision});
    setRevision(saved.revision);setDirty(false);await refresh();setMessage('Draft saved at revision '+saved.revision);return saved;
  }
  async function validate(){
    const value=current();if(!value||!catalog)throw Error('Choose a graph first');
    validateGraph(value,catalog.routeIds,catalog.permitIds);
    await api('validate',{graph:value});setMessage('Valid graph — ready to preview or publish');
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
  function undoChange(){const previous=undo.current.pop();if(previous){redo.current.push({canvas:structuredClone(canvas),selection});setCanvas(previous.canvas);setSelection(previous.selection);setDirty(true);setPreview(null);}}
  function redoChange(){const next=redo.current.pop();if(next){undo.current.push({canvas:structuredClone(canvas),selection});setCanvas(next.canvas);setSelection(next.selection);setDirty(true);setPreview(null);}}

  useEffect(()=>{
    const warn=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue='';}};
    const keys=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setSearchOpen(true);searchInput.current?.focus();return;}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){
      if(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement)return;
      event.preventDefault();event.shiftKey?redoChange():undoChange();
    }else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){
      if(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement)return;
      event.preventDefault();redoChange();
    }else if((event.key==='Delete'||event.key==='Backspace')&&!preview&&!(event.target instanceof HTMLInputElement)&&!(event.target instanceof HTMLTextAreaElement)&&!(event.target instanceof HTMLSelectElement)){if(selection){event.preventDefault();deleteSelection();}}else if(event.key==='Escape'){if(preview)setPreview(null);else if(searchOpen){setSearchOpen(false);searchInput.current?.blur();}else clearSelection();}};
    window.addEventListener('beforeunload',warn);window.addEventListener('keydown',keys);
    return()=>{window.removeEventListener('beforeunload',warn);window.removeEventListener('keydown',keys);};
  },[dirty,preview,canvas,selection,searchOpen]);
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
  if(!csrf)return <main className="login"><div className="seal">F</div><h1>Frostveil</h1><h2>Blueprint Studio</h2><p>Author dialogue. Shape the world.</p>
    <label>One-time editor grant<input value={grant} onChange={event=>setGrant(event.target.value)} autoComplete="off" type="password"/></label>
    <button disabled={!grant} onClick={()=>run(login)}>Enter studio →</button><p role="alert">{message}</p></main>;

  return <div className="studio">
    <header><div><small>FROSTVEIL / WORLD AUTHORING</small><h1>Blueprint Studio</h1></div>
      <select aria-label="Graph" value={graph?.id??''} onChange={event=>run(()=>load(event.target.value))}>{catalog?.graphs.map((item:any)=><option key={item.id} value={item.id}>{item.id} · v{item.version}{item.draftRevision?` · draft ${item.draftRevision}`:''}</option>)}</select>
      <span className={'badge '+(dirty?'unsaved':'')}>{dirty?'Unsaved changes':'Saved draft'}</span>
      <button onClick={()=>{if(dirty&&!confirm('Discard unsaved changes?'))return;const id='dialogue-'+crypto.randomUUID().slice(0,8);const value:Graph={schemaVersion:1,id,version:1,entry:'entry',nodes:[{id:'entry',type:'entry',next:'end'},{id:'end',type:'end'}]};setGraph(value);setCanvas(toCanvas(value));setRevision(0);setPublished(0);setHistory([]);setDirty(true);setSelected('entry');undo.current=[];redo.current=[];}}>New graph</button>
      <button onClick={()=>run(async()=>{await api('logout');setCsrf('');setCatalog(null);setGraph(null);setCanvas({nodes:[],edges:[]});setMessage('Signed out');})}>Sign out</button>
    </header>
    <nav><button onClick={undoChange} disabled={!undo.current.length}>Undo</button><button onClick={redoChange} disabled={!redo.current.length}>Redo</button>
      <button onClick={()=>run(save)}>Save draft</button><button onClick={()=>run(validate)}>Validate</button>
      <button onClick={()=>run(()=>showPreview([]))}>Preview</button>
      <button className="primary" onClick={()=>run(async()=>{
        if(!confirm('Publish this graph for new conversations?'))return;
        await validate();const saved=dirty?await save():{revision};
        const result=await api('publish',{id:graph!.id,draftRevision:saved.revision,version:published});
        setPublished(result.version);const updated=await api('graph',{id:graph!.id});setHistory(updated.history);await refresh();setMessage('Published v'+result.version+' for new conversations');
      })}>Publish</button>
      <select aria-label="NPC" value={npc} onChange={event=>setNpc(event.target.value)}><option value="">Choose NPC</option>{catalog?.npcs.map((item:any)=><option value={item.id} key={item.id}>{item.name}</option>)}</select>
      <button disabled={!npc||!published} onClick={()=>run(async()=>{const value=await api('assign',{npc,id:graph!.id,revision:catalog.revision});await refresh();setMessage('Graph assignment saved (catalog '+value.revision+')');})}>Assign graph</button>
    </nav>
    <div style={{'--inspector-width':inspectorWidth+'px'} as React.CSSProperties} className={'workspace '+(!libraryOpen?'library-hidden ':'')+(!inspectorOpen?'inspector-hidden':'')}>
      <aside className="library"><small>NODE LIBRARY</small><input aria-label="Search nodes" placeholder="Search nodes…" value={query} onChange={event=>setQuery(event.target.value)}/>
        <p className="muted">ลากการ์ดลงพื้นที่ หรือคลิกเพื่อเพิ่ม</p>
        {nodeTypesList.filter(type=>(type+' '+nodeInfo[type].label).includes(query.toLowerCase())).map(type=><button className="palette-item" style={{'--node-accent':nodeColors[type]} as React.CSSProperties} draggable key={type} disabled={type==='entry'&&canvas.nodes.some(item=>item.data.runtime.type==='entry')} onClick={()=>add(type)} onDragStart={event=>{event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('application/frostveil-node',type);}}><span className="palette-icon">{nodeInfo[type].icon}</span><span>{nodeInfo[type].label}<em>{type}</em></span><span className="palette-add">+</span></button>)}
        <hr/><small>VERSION HISTORY</small>{history.map(item=><button key={item.version} onClick={()=>run(async()=>{
          if(dirty&&!confirm('Discard current changes and roll back to v'+item.version+'?'))return;
          if(!confirm('Publish version '+item.version+' as a new version?'))return;
          const result=await api('rollback',{id:graph!.id,targetVersion:item.version,version:published});
          await load(graph!.id);setPublished(result.version);setMessage('Rollback published as v'+result.version);
        })}>v{item.version} · Roll back</button>)}
        <p className="muted">Future extensions<br/>Quest events · flags · shops<br/>Unavailable in this runtime</p>
      </aside>
      <section className={'canvas '+(selection?'trace-active':'')} onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect='copy';}} onDrop={event=>{
        event.preventDefault();const type=event.dataTransfer.getData('application/frostveil-node') as Node['type'];
        if(nodeTypesList.includes(type)&&flow.current)add(type,flow.current.screenToFlowPosition({x:event.clientX,y:event.clientY}));
      }}>
        <div className="canvas-toolbar"><div><span className="canvas-eyebrow">CONVERSATION FLOW</span><b>{canvas.nodes.length} ขั้นตอน · {canvas.edges.length} เส้นเชื่อม</b></div>
          <div className="canvas-tools"><button aria-label="Toggle node library" onClick={()=>setLibraryOpen(v=>!v)}>☷</button><button onClick={()=>{change(arrange(canvas,graph?.entry??''));setTimeout(()=>navigate(),50);}}>จัดกราฟใหม่</button><button onClick={()=>navigate()}>Fit All</button><button onClick={opening}>Opening</button>
          <button disabled={!selection} onClick={()=>navigate(selection?.kind==='node'?[selection.id]:[...traced.nodes])}>Focus Selected</button>
          <button disabled={!viewCount} onClick={()=>{const previous=views.current.pop();if(previous){void flow.current?.setViewport(previous,{duration:220});setViewCount(views.current.length);}}}>Back View</button>
          <button aria-pressed={miniMapOpen} onClick={()=>setMiniMapOpen(v=>!v)}>แผนผังย่อ</button><button aria-label="Toggle properties" onClick={()=>setInspectorOpen(v=>!v)}>⚙</button></div></div>
        <div className="graph-navigation">
          <div className="graph-search"><input ref={searchInput} aria-label="Search graph" placeholder="ค้นหาโหนด บทพูด ตัวเลือก หรือ ID…  Ctrl+K" value={searchText} aria-expanded={searchOpen} aria-controls="graph-results" role="combobox" aria-autocomplete="list" aria-activedescendant={searchOpen&&found[searchActive]?'result-'+found[searchActive]!.id:undefined}
            onFocus={()=>setSearchOpen(true)} onChange={e=>{setSearchText(e.target.value);setSearchActive(0);setSearchOpen(true);}}
            onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setSearchActive(i=>Math.min(found.length-1,i+1));}else if(e.key==='ArrowUp'){e.preventDefault();setSearchActive(i=>Math.max(0,i-1));}else if(e.key==='Enter'&&found[searchActive]){e.preventDefault();chooseResult(found[searchActive]!.id);}else if(e.key==='Escape'){e.stopPropagation();setSearchOpen(false);e.currentTarget.blur();}}}/>
            {searchOpen&&<div className="search-results" id="graph-results" role="listbox" aria-label="Matching nodes"><div className="search-summary">{found.length} results <button onClick={()=>{setSearchText('');setSearchOpen(false);}}>Clear search</button></div>{!found.length&&<p>ไม่พบโหนด ลองชื่อ ชนิดโหนด หรือข้อความไทย</p>}{found.map((n,i)=><button type="button" id={'result-'+n.id} role="option" aria-selected={i===searchActive} key={n.id} onClick={()=>chooseResult(n.id)}><span style={{color:nodeColors[n.type]}}>{nodeInfo[n.type].icon}</span><span><b>{title(n)}</b><em>{n.id} · {(n.text??n.choices?.[0]?.text??n.argument??nodeInfo[n.type].hint).slice(0,85)}</em></span></button>)}</div>}
          </div>
          <label className="trace-control">Trace<select aria-label="Trace mode" value={traceMode} onChange={e=>setTraceMode(e.target.value as TraceMode)} disabled={selection?.kind!=='node'}><option value="direct">Direct connections</option><option value="upstream">Upstream dependencies</option><option value="downstream">Downstream flow</option></select></label><button onClick={clearSelection}>Reset trace</button>
        </div>
        <ReactFlow<BlueprintNode> nodes={viewNodes} edges={viewEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onInit={instance=>{flow.current=instance;}}
          onPaneClick={()=>{clearSelection();setSearchOpen(false);}} onNodeClick={(_,item)=>{setSelected(item.id);setInspectorOpen(true);setSearchOpen(false);}} onEdgeClick={inspectEdge}
          onNodeDragStart={()=>{dragStart.current=structuredClone(canvas);}}
          onNodeDragStop={()=>{if(dragStart.current){record(dragStart.current);dragStart.current=null;setDirty(true);}}}
          onNodesChange={changes=>{const chosen=changes.find(c=>c.type==='select'&&c.selected);if(chosen?.type==='select')setSelected(chosen.id);if(changes.every(c=>c.type==='select'))return;const next={...canvas,nodes:applyNodeChanges(changes.filter(c=>c.type!=='select'),canvas.nodes)};
            if(changes.some(change=>change.type==='remove')||!dragStart.current&&changes.some(c=>c.type==='position'&&c.position&&!c.dragging))changeCanvas(next);else setCanvas(next);
          }} onEdgesChange={changes=>{const chosen=changes.find(c=>c.type==='select'&&c.selected);if(chosen?.type==='select')selectEdge(chosen.id);if(changes.every(c=>c.type==='select'))return;const next={...canvas,edges:applyEdgeChanges(changes.filter(c=>c.type!=='select'),canvas.edges)};if(changes.some(item=>item.type==='remove'||item.type==='add'||item.type==='replace'))change(next);else setCanvas(next);}}
          onConnect={connection=>{try{change(connect(connection,canvas));}catch(error){setMessage(error instanceof Error?error.message:String(error));}}}
          onlyRenderVisibleElements minZoom={.01} maxZoom={1.6} colorMode="dark" edgesFocusable nodesFocusable deleteKeyCode={null}><ReadingView graphId={graph?.id??''} ids={openingIds}/><Background gap={24} color="#344348" size={1}/><Controls/>{miniMapOpen&&<MiniMap nodeColor={n=>nodeColors[(n.data.runtime as Node).type]} maskColor="#0c141cbb" pannable zoomable/>}</ReactFlow>
        <div className="canvas-hint">ลากพื้นเพื่อเลื่อน · เลื่อนล้อเพื่อซูม · คลิกโหนดเพื่อเน้นเส้นทาง <span>เส้นประ = เส้นทางย้อนกลับ</span></div>
      </section>
      <aside className="inspector" ref={inspectorElement}><div className="inspector-sizing"><label>Panel width<input aria-label="Inspector width" type="range" min="300" max="480" step="10" value={inspectorWidth} onChange={e=>setInspectorWidth(Number(e.target.value))}/></label></div>
      {selection?.kind==='edge'?<ConnectionInspector index={index} id={selection.id} focus={focusNode} select={selectEdge} clear={clearSelection} remove={deleteSelection} overlaps={overlapIds}/>:<><small>NODE INSPECTOR</small>{node?<><h2>{nodeInfo[node.type].label}</h2><p className="muted">{node.id}</p>
        {node.type==='npc'&&<label>Dialogue<textarea value={node.text??''} maxLength={4096} onChange={event=>patch({text:event.target.value})}/></label>}
        {node.type==='entry'&&<label>Continue to<select value={node.next??''} onChange={event=>patch({next:event.target.value})}><option value="">Connect on canvas…</option>{canvas.nodes.filter(item=>item.id!==node.id&&item.data.runtime.type!=='entry').map(item=><option key={item.id}>{item.id}</option>)}</select></label>}
        {node.type==='condition'&&<label>Condition<select value={node.condition} onChange={event=>patch({condition:event.target.value as Node['condition']})}>{catalog.conditions.map((item:string)=><option key={item}>{item}</option>)}</select></label>}
        {node.type==='action'&&<><label>Service<select value={node.action} onChange={event=>patch({action:event.target.value as Node['action'],argument:undefined})}>{catalog.actions.map((item:string)=><option key={item}>{item}</option>)}</select></label>
          {['accept','buyPermit'].includes(node.action!)&&<label>Target<select value={node.argument??''} onChange={event=>patch({argument:event.target.value})}><option value="">Choose…</option>{(node.action==='accept'?catalog.routes:catalog.permits).map((item:any)=><option value={item.id} key={item.id}>{item.label}</option>)}</select></label>}</>}
        {node.type==='choices'&&<><div className="choices">{node.choices?.map(choice=><div className="choice" key={choice.id}><input aria-label="Choice label" value={choice.text} maxLength={256} onChange={event=>patch({choices:node.choices!.map(item=>item.id===choice.id?{...item,text:event.target.value}:item)})}/>
          <small>ID {choice.id}</small><button onClick={()=>{if(confirm('Remove this choice and its connection?'))patch({choices:node.choices!.filter(item=>item.id!==choice.id)});}}>Remove</button></div>)}</div>
          <button disabled={(node.choices?.length??0)>=16} onClick={()=>patch({choices:[...(node.choices??[]),{id:'choice-'+crypto.randomUUID().slice(0,8),text:'New choice',next:''}]})}>Add choice</button></>}
        <details className="node-connections"><summary>Connections ({new Set([...(index.incoming.get(node.id)??[]),...(index.outgoing.get(node.id)??[])].map(e=>e.id)).size})</summary>{[...new Map([...(index.incoming.get(node.id)??[]),...(index.outgoing.get(node.id)??[])].map(e=>[e.id,e])).values()].map(e=><button key={e.id} onClick={()=>selectEdge(e.id)}>{e.target===node.id?'← Incoming':'→ Outgoing'} · {connection(index,e).meaning}</button>)}</details><details className="node-neighbors"><summary>Connected nodes ({traced.nodes.size>0?traced.nodes.size-1:0})</summary>{[...traced.nodes].filter(id=>id!==node.id&&index.nodes.has(id)).map(id=><button key={id} onClick={()=>chooseResult(id)}>{title(index.nodes.get(id)!)} · {id}</button>)}</details><hr/><button disabled={node.type==='entry'} onClick={()=>{if(canvas.nodes.length>=128){setMessage('Maximum 128 nodes');return;}const id=node.type+'-'+crypto.randomUUID().slice(0,8);change({...canvas,nodes:[...canvas.nodes,{id,type:'blueprint',position:{x:selectedNode.position.x+48,y:selectedNode.position.y+48},data:{runtime:{...structuredClone(node),id}}}]});setSelected(id);}}>Duplicate node</button>
        <button className="danger" disabled={node.id===graph?.entry} onClick={()=>{if(confirm('Delete this node and its links?')){changeCanvas({nodes:canvas.nodes.filter(item=>item.id!==node.id),edges:canvas.edges.filter(edge=>edge.source!==node.id&&edge.target!==node.id)});setSelected('');}}}>Delete node</button>
      </>:<div className="inspector-empty"><span>◇</span><h2>เลือกหนึ่งขั้นตอน</h2><p className="muted">คลิกการ์ดบนพื้นที่ทำงาน<br/>เพื่อแก้บทพูด ตัวเลือก หรือบริการ</p><p className="muted">เริ่มจากการ์ด “บทพูด NPC”<br/>แล้วลอง Preview ก่อนเผยแพร่</p></div>}</>}</aside>
    </div>
    <footer role="status" aria-live="polite">{message}</footer>
    {preview&&<div className="modal" role="dialog" aria-modal="true" aria-label="Read-only dialogue preview"><section><small>READ-ONLY PREVIEW</small><h2>{preview.current.title??'Conversation ended'}</h2>
      <label><input type="checkbox" checked={activeCourier} onChange={event=>{setActiveCourier(event.target.checked);setPreview(null);}}/> Mock active Courier contract</label><p>{preview.current.text}</p>
      {preview.current.choices?.map((choice:any)=><button key={choice.id} onClick={()=>run(()=>showPreview([...previewPath,choice.id]))}>{choice.text}</button>)}
      <p className="muted">Actions are descriptions only. No player or economy data changes.</p><button onClick={()=>setPreview(null)}>Close preview</button></section></div>}
  </div>;
  function changeCanvas(next:Canvas){record(canvas);setCanvas(next);setDirty(true);setPreview(null);}
}
