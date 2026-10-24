import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {
  ReactFlow, Background, Controls, MiniMap, Handle, Position,
  applyNodeChanges, applyEdgeChanges, useUpdateNodeInternals,
  type NodeProps
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './style.css';
import {toCanvas, fromCanvas, connect, positions, type Canvas, type BlueprintNode} from './mapping';
import {validateGraph, type Graph, type Node} from '../../rp-gamemode/src/modules/dialogue/graph-model';

type FlowHandle = {screenToFlowPosition(point: {x: number; y: number}): {x: number; y: number}};
const nodeTypesList: Node['type'][] = ['entry','npc','choices','condition','action','end'];

function Card({id, data, selected}: NodeProps<BlueprintNode>) {
  const update = useUpdateNodeInternals();
  const runtime = data.runtime;
  const outputs = runtime.type === 'choices'
    ? (runtime.choices ?? []).map(choice => ({id:'choice:'+choice.id,label:choice.text || 'Choice'}))
    : runtime.type === 'end' ? []
    : runtime.type === 'condition' ? [{id:'next',label:'True'},{id:'otherwise',label:'False'}]
    : [{id:'next',label:'Next'}];
  useEffect(() => update(id), [id, outputs.length, update]);
  return <article className={'node '+(selected?'selected':'')}>
    <Handle type="target" position={Position.Left}/>
    <small>{runtime.type}</small><strong>{runtime.id}</strong>
    <p>{runtime.type==='npc'?runtime.text||'Add dialogue text':runtime.action||runtime.condition||'Connect a path'}</p>
    {outputs.map((output,index)=><div className="output" key={output.id}>
      <span>{output.label}</span>
      <Handle id={output.id} type="source" position={Position.Right} style={{top:74+index*28}}/>
    </div>)}
  </article>;
}
const nodeTypes = {blueprint:Card};

export function App() {
  const [csrf,setCsrf]=useState(''), [grant,setGrant]=useState(''), [catalog,setCatalog]=useState<any>(null);
  const [graph,setGraph]=useState<Graph|null>(null), [canvas,setCanvas]=useState<Canvas>({nodes:[],edges:[]});
  const [selected,setSelected]=useState(''), [query,setQuery]=useState(''), [message,setMessage]=useState('Sign in with a one-time editor grant.');
  const [dirty,setDirty]=useState(false), [revision,setRevision]=useState(0), [published,setPublished]=useState(0);
  const [history,setHistory]=useState<any[]>([]), [preview,setPreview]=useState<any>(null), [previewPath,setPreviewPath]=useState<string[]>([]);
  const [activeCourier,setActiveCourier]=useState(false), [npc,setNpc]=useState('');
  const undo=useRef<Canvas[]>([]), redo=useRef<Canvas[]>([]), dragStart=useRef<Canvas|null>(null), flow=useRef<FlowHandle|null>(null);
  const current=()=>graph?fromCanvas(graph,canvas):null;

  async function api(op:string,input:unknown={},token=csrf) {
    const response=await fetch('/api/'+op,{method:'POST',headers:{'content-type':'application/json','x-fv-csrf':token},body:JSON.stringify(input)});
    const data=await response.json();
    if(!response.ok){if(response.status===401&&op!=='login'){setCsrf('');setMessage('Editor session expired. Request a new /editor grant.');}throw Error(data.error||'Request failed');}
    return data;
  }
  async function run(fn:()=>Promise<void>){try{await fn();}catch(error){setMessage(error instanceof Error?error.message:String(error));}}
  function record(previous:Canvas){undo.current.push(structuredClone(previous));if(undo.current.length>100)undo.current.shift();redo.current=[];}
  function change(next:Canvas){record(canvas);setCanvas(next);setDirty(true);setPreview(null);}
  async function refresh(token=csrf){const value=await api('catalog',{},token);setCatalog(value);return value;}
  async function load(id:string,token=csrf){
    if(!id)return;
    if(dirty&&!confirm('Discard unsaved changes?'))return;
    const result=await api('graph',{id},token), value=result.draft?.graph??result.published;
    if(!value)throw Error('Graph data is unavailable');
    setGraph(value);setCanvas(toCanvas(value,result.draft?.layout));setRevision(result.draft?.revision??0);
    setPublished(result.published?.version??0);setHistory(result.history);setDirty(false);setSelected('');
    undo.current=[];redo.current=[];setPreview(null);setMessage('Loaded '+id);
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
  function undoChange(){const previous=undo.current.pop();if(previous){redo.current.push(structuredClone(canvas));setCanvas(previous);setDirty(true);setPreview(null);}}
  function redoChange(){const next=redo.current.pop();if(next){record(canvas);setCanvas(next);setDirty(true);setPreview(null);}}

  useEffect(()=>{
    const warn=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue='';}};
    const keys=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){
      if(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement)return;
      event.preventDefault();event.shiftKey?redoChange():undoChange();
    }else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){
      if(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement)return;
      event.preventDefault();redoChange();
    }else if(event.key==='Escape'&&preview)setPreview(null);};
    window.addEventListener('beforeunload',warn);window.addEventListener('keydown',keys);
    return()=>{window.removeEventListener('beforeunload',warn);window.removeEventListener('keydown',keys);};
  },[dirty,preview]);
  const selectedNode=canvas.nodes.find(item=>item.id===selected), node=selectedNode?.data.runtime;
  function patch(data:Partial<Node>){
    if(!selectedNode)return;
    change({...canvas,nodes:canvas.nodes.map(item=>item.id===selected?{...item,data:{runtime:{...item.data.runtime,...data}}}:item)});
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
    <div className="workspace">
      <aside className="library"><small>NODE LIBRARY</small><input aria-label="Search nodes" placeholder="Search nodes…" value={query} onChange={event=>setQuery(event.target.value)}/>
        {nodeTypesList.filter(type=>type.includes(query.toLowerCase())).map(type=><button draggable key={type} disabled={type==='entry'&&canvas.nodes.some(item=>item.data.runtime.type==='entry')} onClick={()=>add(type)} onDragStart={event=>{event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('application/frostveil-node',type);}}>＋ {type}</button>)}
        <hr/><small>VERSION HISTORY</small>{history.map(item=><button key={item.version} onClick={()=>run(async()=>{
          if(dirty&&!confirm('Discard current changes and roll back to v'+item.version+'?'))return;
          if(!confirm('Publish version '+item.version+' as a new version?'))return;
          const result=await api('rollback',{id:graph!.id,targetVersion:item.version,version:published});
          await load(graph!.id);setPublished(result.version);setMessage('Rollback published as v'+result.version);
        })}>v{item.version} · Roll back</button>)}
        <p className="muted">Future extensions<br/>Quest events · flags · shops<br/>Unavailable in this runtime</p>
      </aside>
      <section className="canvas" onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect='copy';}} onDrop={event=>{
        event.preventDefault();const type=event.dataTransfer.getData('application/frostveil-node') as Node['type'];
        if(nodeTypesList.includes(type)&&flow.current)add(type,flow.current.screenToFlowPosition({x:event.clientX,y:event.clientY}));
      }}>
        <ReactFlow nodes={canvas.nodes} edges={canvas.edges} nodeTypes={nodeTypes} onInit={instance=>{flow.current=instance;}}
          onNodeClick={(_,item)=>setSelected(item.id)} onNodeDragStart={()=>{dragStart.current=structuredClone(canvas);}}
          onNodeDragStop={()=>{if(dragStart.current){record(dragStart.current);dragStart.current=null;setDirty(true);}}}
          onNodesChange={changes=>{const next={...canvas,nodes:applyNodeChanges(changes,canvas.nodes)};
            if(changes.some(change=>change.type==='remove'))changeCanvas(next);else setCanvas(next);
          }} onEdgesChange={changes=>{const next={...canvas,edges:applyEdgeChanges(changes,canvas.edges)};if(changes.some(item=>item.type==='remove'||item.type==='add'||item.type==='replace'))change(next);else setCanvas(next);}}
          onConnect={connection=>{try{change(connect(connection,canvas));}catch(error){setMessage(error instanceof Error?error.message:String(error));}}}
          fitView colorMode="dark" deleteKeyCode={null}><Background gap={24}/><Controls/><MiniMap pannable zoomable/></ReactFlow>
      </section>
      <aside className="inspector"><small>PROPERTIES</small>{node?<><h2>{node.type}</h2><p className="muted">{node.id}</p>
        {node.type==='npc'&&<label>Dialogue<textarea value={node.text??''} maxLength={4096} onChange={event=>patch({text:event.target.value})}/></label>}
        {node.type==='entry'&&<label>Continue to<select value={node.next??''} onChange={event=>patch({next:event.target.value})}><option value="">Connect on canvas…</option>{canvas.nodes.filter(item=>item.id!==node.id&&item.data.runtime.type!=='entry').map(item=><option key={item.id}>{item.id}</option>)}</select></label>}
        {node.type==='condition'&&<label>Condition<select value={node.condition} onChange={event=>patch({condition:event.target.value as Node['condition']})}>{catalog.conditions.map((item:string)=><option key={item}>{item}</option>)}</select></label>}
        {node.type==='action'&&<><label>Service<select value={node.action} onChange={event=>patch({action:event.target.value as Node['action'],argument:undefined})}>{catalog.actions.map((item:string)=><option key={item}>{item}</option>)}</select></label>
          {['accept','buyPermit'].includes(node.action!)&&<label>Target<select value={node.argument??''} onChange={event=>patch({argument:event.target.value})}><option value="">Choose…</option>{(node.action==='accept'?catalog.routes:catalog.permits).map((item:any)=><option value={item.id} key={item.id}>{item.label}</option>)}</select></label>}</>}
        {node.type==='choices'&&<><div className="choices">{node.choices?.map(choice=><div className="choice" key={choice.id}><input aria-label="Choice label" value={choice.text} maxLength={256} onChange={event=>patch({choices:node.choices!.map(item=>item.id===choice.id?{...item,text:event.target.value}:item)})}/>
          <small>ID {choice.id}</small><button onClick={()=>{if(confirm('Remove this choice and its connection?'))patch({choices:node.choices!.filter(item=>item.id!==choice.id)});}}>Remove</button></div>)}</div>
          <button disabled={(node.choices?.length??0)>=16} onClick={()=>patch({choices:[...(node.choices??[]),{id:'choice-'+crypto.randomUUID().slice(0,8),text:'New choice',next:''}]})}>Add choice</button></>}
        <hr/><button disabled={node.type==='entry'} onClick={()=>{if(canvas.nodes.length>=128){setMessage('Maximum 128 nodes');return;}const id=node.type+'-'+crypto.randomUUID().slice(0,8);change({...canvas,nodes:[...canvas.nodes,{id,type:'blueprint',position:{x:selectedNode.position.x+48,y:selectedNode.position.y+48},data:{runtime:{...structuredClone(node),id}}}]});setSelected(id);}}>Duplicate node</button>
        <button className="danger" disabled={node.id===graph?.entry} onClick={()=>{if(confirm('Delete this node and its links?')){changeCanvas({nodes:canvas.nodes.filter(item=>item.id!==node.id),edges:canvas.edges.filter(edge=>edge.source!==node.id&&edge.target!==node.id)});setSelected('');}}}>Delete node</button>
      </>:<p className="muted">Select a node to edit its properties.</p>}</aside>
    </div>
    <footer role="status" aria-live="polite">{message}</footer>
    {preview&&<div className="modal" role="dialog" aria-modal="true" aria-label="Read-only dialogue preview"><section><small>READ-ONLY PREVIEW</small><h2>{preview.current.title??'Conversation ended'}</h2>
      <label><input type="checkbox" checked={activeCourier} onChange={event=>{setActiveCourier(event.target.checked);setPreview(null);}}/> Mock active Courier contract</label><p>{preview.current.text}</p>
      {preview.current.choices?.map((choice:any)=><button key={choice.id} onClick={()=>run(()=>showPreview([...previewPath,choice.id]))}>{choice.text}</button>)}
      <p className="muted">Actions are descriptions only. No player or economy data changes.</p><button onClick={()=>setPreview(null)}>Close preview</button></section></div>}
  </div>;
  function changeCanvas(next:Canvas){record(canvas);setCanvas(next);setDirty(true);setPreview(null);}
}
