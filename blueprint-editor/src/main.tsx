import React, {useEffect, useRef, useState, useMemo, useCallback} from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, Handle,
  applyNodeChanges, applyEdgeChanges, useUpdateNodeInternals, useReactFlow,
  type Edge, type NodeProps
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './style.css';
import {toCanvas, fromCanvas, connect, positions, nodeHeight, nodeHandles, outputRows, NODE_WIDTH, edgesFromNodes, type Canvas, type BlueprintNode, type Layout} from './mapping';
import {graphIndex,connection,trace,search,title,validSelection,openingNodes,nodeInfo,nodeColors,actionLabels,conditionLabels,type Selection,type TraceMode} from './inspection';
import {ConnectionEdge,ConnectionInspector} from './connection-ui';
import {Icon,PanelResize,DialogFrame} from './studio-ui';
import {useGraphRouting} from './use-graph-routing';
import type {RoutedPath,RoutingNode} from './routing-types';
import {validateGraph, type Graph, type Node} from '../../rp-gamemode/src/modules/dialogue/graph-model';
import {
  emptyPresentation,
  buildQuickPaletteItems,
  filterQuickPalette,
  createQuickNodeOnCanvas,
  planEdgeInsertion,
  applyEdgeInsertion,
  copySelection,
  pasteClipboard,
  duplicateSelection,
  cutSelection,
  moveSelectedNodes,
  deleteSelectedNodes,
  nodesInRectangle,
  createVisualGroup,
  updateVisualGroup,
  moveVisualGroupWithContents,
  deleteVisualGroup,
  GROUP_COLOR_INFO,
  GRAPH_TEMPLATES,
  buildTemplateBlueprint,
  insertGraphTemplate,
  type EditorPresentation,
  type GroupColor,
  type QuickPaletteItem,
  type PendingConnectionSource,
  type ClipboardEnvelope,
  type GraphTemplateSpec
} from './authoring';
import {
  PRESET_PLAYER_PROFILES,
  createDebuggerSession,
  stepDebuggerSession,
  continueDebuggerSession,
  compareScenarioPaths,
  diagnoseGraph,
  type TestPlayerProfile,
  type DebuggerSession
} from './debugger';
import {
  diffGraphVersions,
  buildRecoverySnapshot,
  saveRecoverySnapshotToStorage,
  loadRecoverySnapshotFromStorage,
  clearRecoverySnapshotFromStorage,
  assessRecoveryConflict,
  findReferences,
  addGraphBookmark,
  renameGraphBookmark,
  deleteGraphBookmark,
  EDITOR_SHORTCUTS,
  RECOVERY_DEBOUNCE_MS,
  type VersionSnapshotInput,
  type RecoveryConflictAssessment,
  type ServerReferenceEntry
} from './content-management';

type FlowHandle = {screenToFlowPosition(point: {x: number; y: number}): {x: number; y: number};fitView(options?:any):Promise<boolean>;getViewport():{x:number;y:number;zoom:number};setViewport(view:{x:number;y:number;zoom:number},options?:{duration?:number}):Promise<boolean>};
const nodeTypesList: Node['type'][] = ['entry','npc','choices','condition','action','end'];

interface UndoSnapshot {
  canvas: Canvas;
  presentation: EditorPresentation;
  selection: Selection;
  selectedIds: string[];
}

interface EdgeInsertState {
  edgeId: string;
  nodeType: Node['type'];
  action: Node['action'];
  argument: string;
  condition: Node['condition'];
  text: string;
  outgoingHandle: string;
  position?: {x: number; y: number};
}

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
    {handles.map(h=><Handle key={h.type+':'+h.id} id={h.id??undefined} type={h.type} position={h.position} title={h.type==='source'?outputs.find(o=>o.id===h.id)?.label:'Input'} style={{left:h.x-1,top:h.y-1,right:'auto',transform:'none'}} onPointerEnter={()=>h.type==='source'&&data.onPortFocus?.(id,h.id??null)} onPointerLeave={()=>h.type==='source'&&data.onPortFocus?.(id,null)} />)}
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
  const [presentation,setPresentation]=useState<EditorPresentation>(emptyPresentation);
  const hadPresentation=useRef(false);
  const [selection,setSelection]=useState<Selection>(null), [selectedIds,setSelectedIds]=useState<string[]>([]);
  const [query,setQuery]=useState(''), [message,setMessage]=useState('Sign in with a one-time editor grant.');
  const editGeneration=useRef(0),[routingRevision,setRoutingRevision]=useState(0);
  const recoveryTimerRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  function scheduleRecovery(){
    if(recoveryTimerRef.current)clearTimeout(recoveryTimerRef.current);
    recoveryTimerRef.current=setTimeout(()=>{
      const st=recoveryStateRef.current;
      if(!st.graph)return;
      try{
        const g=fromCanvas(st.graph,st.canvas);
        const snap=buildRecoverySnapshot(g,positions(st.canvas),st.presentation,st.revision,st.published,st.catalog?.routeIds??[],st.catalog?.permitIds??[]);
        if(saveRecoverySnapshotToStorage(snap)){
          autoSavedRecoveryGraphId.current=st.graph.id;
        }
      }catch{}
    },RECOVERY_DEBOUNCE_MS);
  }
  function markDirty(geometryChanged=true){cancelLayoutView();editGeneration.current++;if(geometryChanged)setRoutingRevision(v=>v+1);setDirty(true);scheduleRecovery();}
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
  const undo=useRef<UndoSnapshot[]>([]), redo=useRef<UndoSnapshot[]>([]), dragStart=useRef<UndoSnapshot|null>(null), flow=useRef<FlowHandle|null>(null);
  const layoutViewport=useRef<{x:number;y:number;zoom:number}|null>(null);

  // C1.1 Quick Node Creation state
  const [quickOpen,setQuickOpen]=useState(false),[quickQuery,setQuickQuery]=useState(''),[quickActive,setQuickActive]=useState(0);
  const [quickPosition,setQuickPosition]=useState<{x:number;y:number}>({x:240,y:160});
  const [quickSource,setQuickSource]=useState<PendingConnectionSource|null>(null);
  const lastPointer=useRef<{x:number;y:number}>({x:420,y:280});
  const connectStartRef=useRef<PendingConnectionSource|null>(null),connectSucceededRef=useRef(false);

  // C1.2 Insert Node on Edge state
  const [edgeInsert,setEdgeInsert]=useState<EdgeInsertState|null>(null);

  // C1.3 Clipboard & Box Select state
  const clipboardRef=useRef<ClipboardEnvelope|null>(null),pasteCountRef=useRef(0);
  const [boxSelectMode,setBoxSelectMode]=useState(false);
  const [marquee,setMarquee]=useState<{x1:number;y1:number;x2:number;y2:number}|null>(null);
  const canvasSectionRef=useRef<HTMLElement>(null);

  // C1.4 Group drag state
  const groupDragRef=useRef<{groupId:string;startX:number;startY:number;snapshot:UndoSnapshot}|null>(null);

  // C1.5 Template Preview state
  const [activeTemplate,setActiveTemplate]=useState<GraphTemplateSpec['id']|null>(null);
  const [templateRouteId,setTemplateRouteId]=useState('');
  const [templatePermitId,setTemplatePermitId]=useState('');

  // C.2 Visual Dialogue Debugger & Validation Navigator state
  const [debuggerOpen,setDebuggerOpen]=useState(false);
  const [debugProfile,setDebugProfile]=useState<TestPlayerProfile>(()=>structuredClone(PRESET_PLAYER_PROFILES[0]!));
  const [debugBreakpoints,setDebugBreakpoints]=useState<string[]>([]);
  const [debugSession,setDebugSession]=useState<DebuggerSession|null>(null);
  const [compareOpen,setCompareOpen]=useState(false);
  const [diagnosticsOpen,setDiagnosticsOpen]=useState(false);

  // C.3 Content Management & Recovery state
  const [versionSnapshots,setVersionSnapshots]=useState<Array<{version:number;graph:Graph;layout:Layout;presentation:EditorPresentation}>>([]);
  const [diffOpen,setDiffOpen]=useState(false);
  const [diffBaseKey,setDiffBaseKey]=useState<string>('published');
  const [diffTargetKey,setDiffTargetKey]=useState<string>('draft');
  const [inspectedRemovedNode,setInspectedRemovedNode]=useState<Node|null>(null);
  const [recoveryPrompt,setRecoveryPrompt]=useState<RecoveryConflictAssessment|null>(null);
  const autoSavedRecoveryGraphId=useRef<string|null>(null);
  const preserveRecoveryOnUnload=useRef(false);
  const [referencesOpen,setReferencesOpen]=useState(false);
  const [crossGraphRefs,setCrossGraphRefs]=useState<ServerReferenceEntry[]>([]);
  const [bookmarksOpen,setBookmarksOpen]=useState(false);
  const [newBookmarkName,setNewBookmarkName]=useState('');
  const [helpOpen,setHelpOpen]=useState(false);

  const routing=useGraphRouting(canvas,graph?.entry??'',graph?.id??'',editGeneration.current,routingRevision);
  const displayCanvas=routing.displayedCanvas;
  function cancelLayoutView(){routing.cancelLayout();if(layoutViewport.current){void flow.current?.setViewport(layoutViewport.current,{duration:0});layoutViewport.current=null;}}
  function autoArrange(){layoutViewport.current=flow.current?.getViewport()??null;void routing.requestLayout();}
  function applyLayout(){const next=routing.applyLayout();if(next){layoutViewport.current=null;change(next);}}
  useEffect(()=>{if(!routing.candidate)return;const task=requestAnimationFrame(()=>{void flow.current?.fitView({padding:.15,maxZoom:.9,includeHiddenNodes:true});});return()=>cancelAnimationFrame(task);},[routing.candidate]);
  const [overlapIds,setOverlapIds]=useState<string[]>([]),lastEdgeClick=useRef<{x:number;y:number;key:string;index:number}|null>(null);
  const selected=selection?.kind==='node'?selection.id:'';
  const selectedSet=useMemo(()=>new Set(selectedIds.length?selectedIds:selected?[selected]:[]),[selectedIds,selected]);

  const setSelected=useCallback((id:string)=>{
    setHoveredPort(null);setKeyboardPort(null);
    setSelection(id?{kind:'node',id}:null);
    setSelectedIds(id?[id]:[]);
    setOverlapIds([]);
  },[]);

  const selectEdge=useCallback((id:string)=>{
    setHoveredPort(null);setKeyboardPort(null);
    setSelection({kind:'edge',id});
    setSelectedIds([]);
    setInspectorOpen(true);
  },[]);

  const selectGroup=useCallback((id:string)=>{
    setHoveredPort(null);setKeyboardPort(null);
    setSelection({kind:'group',id});
    setSelectedIds([]);
    setInspectorOpen(true);
  },[]);

  const [traceMode,setTraceMode]=useState<TraceMode>('direct'),[focusPath,setFocusPath]=useState(false);
  const [searchText,setSearchText]=useState(''),[searchOpen,setSearchOpen]=useState(false),[searchActive,setSearchActive]=useState(0);
  const inspectorElement=useRef<HTMLDivElement>(null),searchInput=useRef<HTMLInputElement>(null),[inspectorWidth,setInspectorWidth]=useState(340);
  const views=useRef<{x:number;y:number;zoom:number}[]>([]),[viewCount,setViewCount]=useState(0);
  // Position/measurement changes do not rebuild adjacency or text indexes.
  const nodeIdsKey=canvas.nodes.map(n=>n.id).join('|');
  const semanticNodes=useRef<Node[]>([]),runtimeNodes=canvas.nodes.map(n=>n.data.runtime);
  if(runtimeNodes.length!==semanticNodes.current.length||runtimeNodes.some((n,i)=>n!==semanticNodes.current[i]))semanticNodes.current=runtimeNodes;
  const index=useMemo(()=>graphIndex(semanticNodes.current,canvas.edges),[semanticNodes.current,canvas.edges]);
  const groupIdSet=useMemo(()=>new Set(presentation.groups.map(g=>g.id)),[presentation.groups]);
  const openingIds=useMemo(()=>openingNodes(index,graph?.entry??''),[nodeIdsKey,canvas.edges,graph?.entry]);
  const targets=useMemo(()=>new Map<string,string>([...(catalog?.routes??[]),...(catalog?.permits??[])].map((n:any)=>[n.id,n.label])),[catalog]);
  const traced=useMemo(()=>trace(index,selection,traceMode),[nodeIdsKey,canvas.edges,selection,traceMode]);
  const activePath=portFocus?index.edges.get(portFocus.source+':'+portFocus.handle):undefined;
  const activePathId=activePath?.id??(debuggerOpen&&debugSession?.activeEdgeId?debugSession.activeEdgeId:''),activeTarget=activePath?.target??(debuggerOpen&&debugSession?.currentNodeId?debugSession.currentNodeId:'');
  const debugVisitedSet=useMemo(()=>new Set(debuggerOpen&&debugSession?debugSession.visitedNodeIds:[]),[debuggerOpen,debugSession]);
  const found=useMemo(()=>searchOpen||searchText?search(index,searchText,targets):[],[index,searchText,searchOpen,targets]);
  const decorations=useRef(new Map<string,BlueprintNode['data']>());
  const nodeViews=useRef(new Map<string,{raw:BlueprintNode;view:BlueprintNode}>());
  const viewNodes=useMemo(()=>displayCanvas.nodes.map(n=>{
    const targetLabel=targets.get(n.data.runtime.argument??''),related=traced.nodes.has(n.id)||debugVisitedSet.has(n.id),spotlight=n.id===activeTarget,old=decorations.current.get(n.id);
    const data=old&&old.runtime===n.data.runtime&&old.targetLabel===targetLabel&&old.related===related&&old.spotlight===spotlight?old:{runtime:n.data.runtime,targetLabel,related,spotlight,onPortFocus};
    decorations.current.set(n.id,data);
    // Keep Phase A's SVG/card stacking for ordinary graph work. Raising every
    // card caused GPU raster stalls on long stress-fixture paths. Only the
    // inspected connection's endpoints and precise hover target need a cover.
    const cached=nodeViews.current.get(n.id),isSelected=selectedSet.has(n.id),zIndex=spotlight||selection?.kind==='edge'&&related?10:0;
    if(cached?.raw===n&&cached.view.data===data&&cached.view.selected===isSelected&&cached.view.zIndex===zIndex)return cached.view;
    const view={...n,zIndex,measured:{width:NODE_WIDTH,height:nodeHeight(n.data.runtime)},handles:nodeHandles(n.data.runtime),selected:isSelected,data};nodeViews.current.set(n.id,{raw:n,view});return view;
  }),[displayCanvas.nodes,targets,traced.nodes,debugVisitedSet,selectedSet,selection?.kind,activeTarget,onPortFocus]);
  const descriptorCache=useRef(new Map<string,{edge:Edge;detail:ReturnType<typeof connection>;lane:number}>());
  const descriptors=useMemo(()=>{
    const lanes=new Map<string,number>();
    return canvas.edges.map(edge=>{const detail=connection(index,edge),group=detail.source?.type==='choices'?'source:'+edge.source:'target:'+edge.target,ordinal=lanes.get(group)??0,lane=ordinal%16;lanes.set(group,ordinal+1);const old=descriptorCache.current.get(edge.id);if(old?.edge===edge&&old.lane===lane&&old.detail.meaning===detail.meaning&&old.detail.source?.type===detail.source?.type)return old;const value={edge,detail,lane};descriptorCache.current.set(edge.id,value);return value;});
  },[canvas.edges,index]);
  const labelObstacles=useMemo(()=>routing.snapshot.graph.nodes.map(n=>({...n,...routing.candidate?.result.positions[n.id]})),[routing.snapshot,routing.candidate]);
  const edgeViews=useRef(new Map<string,{obstacles:RoutingNode[];descriptor:typeof descriptors[number];active:boolean;chosen:boolean;spotlight:boolean;route:RoutedPath|undefined;smart:boolean;view:Edge}>());
  const viewEdges=useMemo(()=>descriptors.map(descriptor=>{
      const {edge:e,detail,lane}=descriptor,active=traced.edges.has(e.id),chosen=selection?.kind==='edge'&&selection.id===e.id,spotlight=e.id===activePathId;
      const route=routing.result?.routes.get(e.id),smart=!!routing.candidate||routing.mode==='smart'&&!routing.error;
      const cached=edgeViews.current.get(e.id);if(cached?.descriptor===descriptor&&cached.active===active&&cached.chosen===chosen&&cached.spotlight===spotlight&&cached.route===route&&cached.smart===smart&&cached.obstacles===labelObstacles)return cached.view;
      const color=spotlight?'#b8e6dd':chosen?'#e8ca8a':nodeColors[detail.source?.type??'entry'];
      const view={...e,type:'connection',selected:chosen,selectable:true,focusable:true,interactionWidth:26,ariaRole:'button' as const,ariaLabel:detail.meaning,
        domAttributes:{onFocus:()=>selectEdge(e.id)},data:{lane,active,spotlight,route,smart,labelObstacles,meaning:detail.meaning,shortLabel:detail.choiceNumber?'#'+detail.choiceNumber+' · '+detail.output:detail.output},
        zIndex:spotlight?9:chosen?8:active?3:0,style:{stroke:color,strokeWidth:spotlight||chosen?2.8:active?1.8:1.4},
        className:(chosen?'edge-chosen ':active?'edge-focused ':'')+(spotlight?'edge-spotlight':''),markerEnd:{type:'arrowclosed' as const,color,width:14,height:14}};
      edgeViews.current.set(e.id,{obstacles:labelObstacles,descriptor,active,chosen,spotlight,route,smart,view});return view;
  }),[descriptors,selection,traced.edges,selectEdge,activePathId,routing.result,routing.mode,routing.error,routing.candidate,labelObstacles]);
  useEffect(()=>{const nodes=new Set(canvas.nodes.map(n=>n.id)),edges=new Set(canvas.edges.map(e=>e.id));for(const id of nodeViews.current.keys())if(!nodes.has(id))nodeViews.current.delete(id);for(const id of edgeViews.current.keys())if(!edges.has(id)){edgeViews.current.delete(id);descriptorCache.current.delete(id);}},[nodeIdsKey,canvas.edges]);
  useEffect(()=>{
    setSelection(current=>validSelection(index,current,groupIdSet));
    setSelectedIds(ids=>ids.every(id=>index.nodes.has(id))?ids:ids.filter(id=>index.nodes.has(id)));
    setOverlapIds(ids=>ids.every(id=>index.edges.has(id))?ids:ids.filter(id=>index.edges.has(id)));
  },[nodeIdsKey,canvas.edges,groupIdSet]);
  useEffect(()=>{const ids=new Set(canvas.nodes.map(n=>n.id));for(const id of decorations.current.keys())if(!ids.has(id))decorations.current.delete(id);},[nodeIdsKey]);
  function navigate(ids?:string[]){if(!flow.current)return;views.current.push(flow.current.getViewport());if(views.current.length>20)views.current.shift();setViewCount(views.current.length);void flow.current.fitView({nodes:ids?.map(id=>({id})),padding:.2,maxZoom:1,duration:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?0:220,includeHiddenNodes:true});}
  function focusNode(id:string){navigate([id]);}
  function opening(){navigate(openingIds);}
  function chooseResult(id:string){setSelected(id);setInspectorOpen(true);setSearchOpen(false);focusNode(id);}
  function clearSelection(){setSelection(null);setSelectedIds([]);setHoveredPort(null);setKeyboardPort(null);setTraceMode('direct');setOverlapIds([]);lastEdgeClick.current=null;}
  function inspectEdge(event:React.MouseEvent,edge:Edge){
    const ids=[...new Set(document.elementsFromPoint(event.clientX,event.clientY).map(el=>el.closest('.react-flow__edge')?.getAttribute('data-id')).filter((id):id is string=>!!id&&index.edges.has(id)))].sort();
    if(!ids.includes(edge.id))ids.push(edge.id);ids.sort();
    const key=ids.join('|'),last=lastEdgeClick.current,same=last&&last.key===key&&Math.hypot(last.x-event.clientX,last.y-event.clientY)<5;
    const next=same?(last.index+1)%ids.length:ids.indexOf(edge.id);
    lastEdgeClick.current={x:event.clientX,y:event.clientY,key,index:next};setOverlapIds(ids.length>1?ids:[]);selectEdge(ids[next]!);setSearchOpen(false);
  }
  function deleteSelection(){
    if(selectedIds.length>1){
      const removableCount=selectedIds.filter(id=>id!==graph?.entry).length;
      if(!removableCount){setMessage('Entry node cannot be deleted');return;}
      if(!confirm(`Delete ${removableCount} selected nodes and their connections?`))return;
      const res=deleteSelectedNodes(canvas,presentation,selectedIds,graph?.entry??'entry');
      commitState(res.canvas,res.presentation,null,[]);
      setMessage(`Deleted ${res.removedCount} nodes`);
      return;
    }
    if(!selection)return;
    if(selection.kind==='group'){
      if(!confirm('Delete this visual group frame? (Member nodes will be kept)'))return;
      const nextPres=deleteVisualGroup(presentation,selection.id);
      commitState(canvas,nextPres,null,[]);
      return;
    }
    if(selection.kind==='node'&&selection.id===graph?.entry)return;
    if(!confirm(selection.kind==='edge'?'Delete this connection?':'Delete this node and its links?'))return;
    if(selection.kind==='node'){
      const res=deleteSelectedNodes(canvas,presentation,[selection.id],graph?.entry??'entry');
      commitState(res.canvas,res.presentation,null,[]);
    }else{
      change({nodes:canvas.nodes,edges:canvas.edges.filter(e=>e.id!==selection.id)});
      clearSelection();
    }
  }
  useEffect(()=>{if(inspectorElement.current)inspectorElement.current.scrollTop=0;},[selection?.kind,selection?.id,selectedIds.length]);
  useEffect(()=>{if(searchOpen&&found[searchActive])document.getElementById('result-'+found[searchActive]!.id)?.scrollIntoView?.({block:'nearest'});},[searchActive,searchOpen,found]);
  // C3.2 Safe Draft Recovery debounced persistence via ref timer
  const recoveryStateRef=useRef({graph,canvas,presentation,revision,published,catalog,selection,selectedIds,selectedSet,activeCourier});
  recoveryStateRef.current={graph,canvas,presentation,revision,published,catalog,selection,selectedIds,selectedSet,activeCourier};
  const current=()=>{const st=recoveryStateRef.current;return st.graph?fromCanvas(st.graph,st.canvas):null;};

  useEffect(()=>()=>{
    if(recoveryTimerRef.current)clearTimeout(recoveryTimerRef.current);
    if(autoSavedRecoveryGraphId.current&&!preserveRecoveryOnUnload.current){
      clearRecoverySnapshotFromStorage(autoSavedRecoveryGraphId.current);
    }
  },[]);

  async function api(op:string,input:unknown={},token=csrf) {
    const response=await fetch('/api/'+op,{method:'POST',headers:{'content-type':'application/json','x-fv-csrf':token},body:JSON.stringify(input)});
    const data=await response.json();
    if(!response.ok){if(response.status===401&&op!=='login'){setCsrf('');setMessage('Editor session expired. Request a new /editor grant.');}throw Error(data.error||'Request failed');}
    return data;
  }
  async function run(fn:()=>Promise<unknown>){if(busyRef.current)return;busyRef.current=true;setBusy(true);setNoticeTone('info');try{await fn();}catch(error){setNoticeTone('error');setNoticeVisible(true);setMessage(error instanceof Error?error.message:String(error));}finally{busyRef.current=false;setBusy(false);}}
  function makeSnapshot(c=recoveryStateRef.current.canvas,p=recoveryStateRef.current.presentation,sel=recoveryStateRef.current.selection,ids=recoveryStateRef.current.selectedIds):UndoSnapshot{
    return {canvas:structuredClone(c),presentation:p.groups.length||p.bookmarks.length?structuredClone(p):p,selection:sel,selectedIds:ids.length?[...ids]:ids};
  }
  function record(previous=recoveryStateRef.current.canvas,prevPres=recoveryStateRef.current.presentation,prevSel=recoveryStateRef.current.selection,prevIds=recoveryStateRef.current.selectedIds){
    undo.current.push(makeSnapshot(previous,prevPres,prevSel,prevIds));
    if(undo.current.length>100)undo.current.shift();
    redo.current=[];
  }
  function commitState(nextCanvas:Canvas,nextPres=recoveryStateRef.current.presentation,nextSel:Selection=recoveryStateRef.current.selection,nextIds:string[]=recoveryStateRef.current.selectedIds){
    record();
    if(nextPres.groups.length>0||nextPres.bookmarks.length>0)hadPresentation.current=true;
    setCanvas(nextCanvas);
    setPresentation(nextPres);
    setSelection(nextSel);
    setSelectedIds(nextIds);
    markDirty();
    setValidation('unchecked');
    setPreview(null);
  }
  function change(next:Canvas){
    record();
    setCanvas(next);
    markDirty();
    setValidation('unchecked');
    setPreview(null);
  }
  async function refresh(token=csrf){
    const value=await api('catalog',{},token);
    setCatalog(value);
    if(!templateRouteId&&value.routeIds?.[0])setTemplateRouteId(value.routeIds[0]);
    if(!templatePermitId&&value.permitIds?.[0])setTemplatePermitId(value.permitIds[0]);
    return value;
  }
  async function load(id:string,token=csrf,cat=recoveryStateRef.current.catalog){
    if(!id)return;
    if(dirty&&!confirm('Discard unsaved changes?'))return;
    cancelLayoutView();
    const result=await api('graph',{id},token), value=result.draft?.graph??result.published;
    if(!value)throw Error('Graph data is unavailable');
    const loadedPres=result.draft?.presentation??emptyPresentation();
    hadPresentation.current=!!result.draft?.presentation;
    const loadedCanvas=toCanvas(value,result.draft?.layout);
    const serverRev=result.draft?.revision??0;
    const serverPub=result.published?.version??0;
    setGraph(value);setCanvas(loadedCanvas);setPresentation(loadedPres);setRevision(serverRev);
    setRoutingRevision(v=>v+1);setPublished(serverPub);setHistory(result.history??[]);setDirty(false);setSelected(value.nodes.find((n:Node)=>n.type==='npc')?.id??value.entry);
    const snaps=Array.isArray(result.versions)&&result.versions.length
      ? result.versions
      : result.published
        ? [{version:result.published.version,graph:result.published,layout:{},presentation:emptyPresentation()}]
        : [];
    setVersionSnapshots(snaps);
    // Check C3.2 recovery snapshot
    const savedRecovery=loadRecoverySnapshotFromStorage(id,cat?.routeIds??[],cat?.permitIds??[]);
    if(savedRecovery&&JSON.stringify(savedRecovery.graph)!==JSON.stringify(value)){
      setRecoveryPrompt(assessRecoveryConflict(savedRecovery,serverRev,serverPub,value));
    }else{
      setRecoveryPrompt(null);
    }
    undo.current=[];redo.current=[];views.current=[];setViewCount(0);setHoveredPort(null);setKeyboardPort(null);setValidation('unchecked');setSearchText('');setSearchOpen(false);setPreview(null);setQuickOpen(false);setEdgeInsert(null);setActiveTemplate(null);setDebugSession(null);setMessage('Loaded '+id);
  }
  async function save(){
    const st=recoveryStateRef.current;
    const value=current();if(!value)throw Error('Choose a graph first');const savingGeneration=editGeneration.current;
    const includePres=hadPresentation.current||st.presentation.groups.length>0||st.presentation.bookmarks.length>0;
    const payload:Record<string,unknown>={graph:value,layout:positions(st.canvas),revision:st.revision,...(includePres?{presentation:st.presentation}:{})};
    const saved=await api('draft',payload);
    if(recoveryTimerRef.current){clearTimeout(recoveryTimerRef.current);recoveryTimerRef.current=null;}
    clearRecoverySnapshotFromStorage(value.id);
    autoSavedRecoveryGraphId.current=null;
    setRecoveryPrompt(null);
    setRevision(saved.revision);setDirty(editGeneration.current!==savingGeneration);await refresh();setMessage('Draft saved at revision '+saved.revision);return saved;
  }
  async function validate(){
    const st=recoveryStateRef.current;
    const value=current();if(!value||!st.catalog)throw Error('Choose a graph first');
    try{validateGraph(value,st.catalog.routeIds,st.catalog.permitIds);await api('validate',{graph:value});setValidation('valid');setMessage('Valid graph — ready to preview or publish');}catch(error){setValidation('invalid');throw error;}
  }
  async function showPreview(path:string[]){
    const st=recoveryStateRef.current;
    const value=current();if(!value)throw Error('Choose a graph first');
    setPreview(await api('preview',{graph:value,choices:path,activeCourier:st.activeCourier}));setPreviewPath(path);
  }
  function add(type:Node['type'],position?:{x:number;y:number}){
    const c=recoveryStateRef.current.canvas;
    const resolvedPos=position??{x:160+c.nodes.length*18,y:100+c.nodes.length*18};
    if(c.nodes.length>=128){setMessage('Maximum 128 nodes');return;}
    const id=type+'-'+crypto.randomUUID().slice(0,8);
    const runtime:Node={id,type,...(type==='end'?{}:type==='choices'?{choices:[]}:{next:''}),
      ...(type==='npc'?{text:''}:type==='action'?{action:'contracts' as const}:type==='condition'?{condition:'always' as const,otherwise:''}:{})};
    change({...c,nodes:[...c.nodes,{id,type:'blueprint',position:resolvedPos,data:{runtime}}]});setSelected(id);
  }
  function undoChange(){
    const previous=undo.current.pop();
    if(previous){
      redo.current.push(makeSnapshot());
      setCanvas(previous.canvas);
      setPresentation(previous.presentation);
      setSelection(previous.selection);
      setSelectedIds(previous.selectedIds);
      markDirty();setValidation('unchecked');setPreview(null);
    }
  }
  function redoChange(){
    const next=redo.current.pop();
    if(next){
      undo.current.push(makeSnapshot());
      setCanvas(next.canvas);
      setPresentation(next.presentation);
      setSelection(next.selection);
      setSelectedIds(next.selectedIds);
      markDirty();setValidation('unchecked');setPreview(null);
    }
  }

  // C1.1 Quick Palette helpers
  const hasEntryNode=useMemo(()=>canvas.nodes.some(n=>n.data.runtime.type==='entry'),[nodeIdsKey]);
  const quickItems=useMemo(()=>quickOpen?filterQuickPalette(buildQuickPaletteItems(catalog,hasEntryNode,quickSource),quickQuery):[],[quickOpen,catalog,hasEntryNode,quickSource,quickQuery]);
  function openQuickPalette(pos?:{x:number;y:number},source:PendingConnectionSource|null=null){
    if(routing.candidate)return;
    const resolvedPos=pos??(flow.current?flow.current.screenToFlowPosition(lastPointer.current):{x:240,y:160});
    setQuickPosition(resolvedPos);
    setQuickSource(source);
    setQuickQuery('');
    setQuickActive(0);
    setQuickOpen(true);
  }
  function applyQuickPaletteItem(item:QuickPaletteItem){
    try{
      if(item.kind==='group'){
        const {presentation:nextPres,group}=createVisualGroup(presentation,canvas,[...selectedSet],{position:quickPosition});
        commitState(canvas,nextPres,{kind:'group',id:group.id},[]);
        setInspectorOpen(true);
        setQuickOpen(false);
        setQuickSource(null);
        setMessage('Created visual group '+group.title);
        return;
      }
      const {canvas:nextCanvas,nodeId}=createQuickNodeOnCanvas(canvas,item,quickPosition,catalog,quickSource);
      commitState(nextCanvas,presentation,{kind:'node',id:nodeId},[nodeId]);
      setInspectorOpen(true);
      setQuickOpen(false);
      setQuickSource(null);
      setMessage(quickSource?`Created and connected ${nodeId}`:`Created ${nodeId}`);
    }catch(error){
      setNoticeTone('error');
      setMessage(error instanceof Error?error.message:String(error));
    }
  }

  // C1.2 Edge Insertion helpers
  function startEdgeInsert(edgeId:string,nodeType:Node['type']='npc',position?:{x:number;y:number}){
    if(!index.edges.has(edgeId))return;
    setEdgeInsert({
      edgeId,
      nodeType,
      action:'contracts',
      argument:catalog?.routeIds?.[0]??'',
      condition:'courierIdle',
      text:'',
      outgoingHandle:nodeType==='condition'?'':'next',
      position
    });
  }
  const edgeInsertPlan=useMemo(()=>{
    if(!edgeInsert)return null;
    return planEdgeInsertion(canvas,edgeInsert.edgeId,edgeInsert.nodeType,{
      outgoingHandle:edgeInsert.outgoingHandle||undefined,
      action:edgeInsert.action,
      argument:edgeInsert.argument||undefined,
      condition:edgeInsert.condition,
      text:edgeInsert.text,
      position:edgeInsert.position,
      catalog
    });
  },[canvas,edgeInsert,catalog]);
  function confirmEdgeInsert(){
    if(!edgeInsertPlan||!edgeInsertPlan.valid)return;
    try{
      const nextCanvas=applyEdgeInsertion(canvas,edgeInsertPlan);
      const insertedId=edgeInsertPlan.node.id;
      commitState(nextCanvas,presentation,{kind:'node',id:insertedId},[insertedId]);
      setEdgeInsert(null);
      setInspectorOpen(true);
      setMessage(`Inserted ${insertedId} on connection`);
    }catch(error){
      setNoticeTone('error');
      setMessage(error instanceof Error?error.message:String(error));
    }
  }

  // C1.3 Copy / Cut / Paste / Duplicate helpers
  function handleCopy(){
    const st=recoveryStateRef.current;
    const ids=[...st.selectedSet];
    const env=copySelection(st.canvas,ids);
    if(!env.nodes.length){setMessage('Select at least one non-entry node to copy');return;}
    clipboardRef.current=env;
    pasteCountRef.current=0;
    try{void navigator.clipboard?.writeText?.(JSON.stringify(env));}catch{}
    setMessage(`Copied ${env.nodes.length} node(s)`);
  }
  function handleCut(){
    const st=recoveryStateRef.current;
    const ids=[...st.selectedSet];
    try{
      const res=cutSelection(st.canvas,st.presentation,ids,st.graph?.entry??'entry');
      clipboardRef.current=res.clipboard;
      pasteCountRef.current=0;
      try{void navigator.clipboard?.writeText?.(JSON.stringify(res.clipboard));}catch{}
      commitState(res.canvas,res.presentation,null,[]);
      setMessage(`Cut ${res.clipboard.nodes.length} node(s)`);
    }catch(error){
      setNoticeTone('error');
      setMessage(error instanceof Error?error.message:String(error));
    }
  }
  async function handlePaste(){
    const st=recoveryStateRef.current;
    try{
      let payload:unknown=clipboardRef.current;
      if(!payload&&navigator.clipboard?.readText){
        try{
          const text=await navigator.clipboard.readText();
          if(text.trim().startsWith('{'))payload=JSON.parse(text);
        }catch{}
      }
      if(!payload){setMessage('Clipboard is empty');return;}
      const step=++pasteCountRef.current;
      const res=pasteClipboard(payload,st.canvas,st.catalog?.routeIds??[],st.catalog?.permitIds??[],{x:48*step,y:48*step});
      const lastId=res.pastedIds.at(-1)??null;
      commitState(res.canvas,st.presentation,lastId?{kind:'node',id:lastId}:null,res.pastedIds);
      setMessage(`Pasted ${res.pastedIds.length} node(s)`);
    }catch(error){
      setNoticeTone('error');
      setMessage(error instanceof Error?error.message:String(error));
    }
  }
  function handleDuplicate(){
    const st=recoveryStateRef.current;
    const ids=[...st.selectedSet];
    try{
      const res=duplicateSelection(st.canvas,ids,st.catalog?.routeIds??[],st.catalog?.permitIds??[],{x:48,y:48});
      clipboardRef.current=res.clipboard;
      const lastId=res.duplicatedIds.at(-1)??null;
      commitState(res.canvas,st.presentation,lastId?{kind:'node',id:lastId}:null,res.duplicatedIds);
      setMessage(`Duplicated ${res.duplicatedIds.length} node(s)`);
    }catch(error){
      setNoticeTone('error');
      setMessage(error instanceof Error?error.message:String(error));
    }
  }
  function handleCreateGroup(){
    const st=recoveryStateRef.current;
    try{
      const {presentation:nextPres,group}=createVisualGroup(st.presentation,st.canvas,[...st.selectedSet]);
      commitState(st.canvas,nextPres,{kind:'group',id:group.id},[]);
      setInspectorOpen(true);
      setMessage(`Created visual group "${group.title}"`);
    }catch(error){
      setNoticeTone('error');
      setMessage(error instanceof Error?error.message:String(error));
    }
  }

  // C1.5 Template insertion
  const templatePreview=useMemo(()=>{
    if(!activeTemplate)return null;
    try{
      return buildTemplateBlueprint(activeTemplate,{
        routeId:templateRouteId||catalog?.routeIds?.[0],
        permitId:templatePermitId||catalog?.permitIds?.[0],
        catalog
      });
    }catch{return null;}
  },[activeTemplate,templateRouteId,templatePermitId,catalog]);

  function handleConfirmTemplate(){
    if(!activeTemplate)return;
    const st=recoveryStateRef.current;
    try{
      const res=insertGraphTemplate(st.canvas,activeTemplate,{
        routeId:templateRouteId||st.catalog?.routeIds?.[0],
        permitId:templatePermitId||st.catalog?.permitIds?.[0],
        catalog:st.catalog
      });
      const firstId=res.insertedIds[0]??null;
      commitState(res.canvas,st.presentation,firstId?{kind:'node',id:firstId}:null,res.insertedIds);
      setActiveTemplate(null);
      setInspectorOpen(true);
      setMessage(`Inserted template (${res.insertedIds.length} nodes)`);
    }catch(error){
      setNoticeTone('error');
      setMessage(error instanceof Error?error.message:String(error));
    }
  }

  // C.2 Visual Dialogue Debugger helpers
  function startOrRestartDebugger(profileOverride=debugProfile){
    const st=recoveryStateRef.current;
    const g=current();if(!g)return;
    const sess=createDebuggerSession(g,st.canvas,profileOverride,debugBreakpoints);
    setDebugSession(sess);
    setDebuggerOpen(true);
    if(sess.currentNodeId)setSelected(sess.currentNodeId);
    setMessage('Visual debugger started (read-only simulation — 0 gameplay mutations)');
  }
  function stepDebugger(choiceId?:string){
    const st=recoveryStateRef.current;
    const g=current();if(!g)return;
    const base=debugSession??createDebuggerSession(g,st.canvas,debugProfile,debugBreakpoints);
    const next=stepDebuggerSession(base,g,st.canvas,st.catalog,choiceId);
    setDebugSession(next);
    if(next.currentNodeId)setSelected(next.currentNodeId);
  }
  function continueDebugger(){
    const st=recoveryStateRef.current;
    const g=current();if(!g)return;
    const base=debugSession??createDebuggerSession(g,st.canvas,debugProfile,debugBreakpoints);
    const next=continueDebuggerSession(base,g,st.canvas,st.catalog);
    setDebugSession(next);
    if(next.currentNodeId)setSelected(next.currentNodeId);
  }
  function toggleBreakpoint(nodeId:string){
    setDebugBreakpoints(prev=>{
      const next=prev.includes(nodeId)?prev.filter(id=>id!==nodeId):[...prev,nodeId];
      setDebugSession(s=>s?{...s,breakpoints:next}:null);
      return next;
    });
  }
  const scenarioComparisonRows=useMemo(()=>{
    if(!debuggerOpen||!compareOpen||!graph)return [];
    const g=fromCanvas(graph,canvas);
    return compareScenarioPaths(g,canvas,[debugProfile,...PRESET_PLAYER_PROFILES.filter(p=>p.id!==debugProfile.id)],debugSession?.choiceHistory??[],catalog);
  },[debuggerOpen,compareOpen,graph,canvas,debugProfile,debugSession?.choiceHistory,catalog]);

  // C2.5 Validation Navigator diagnostics (only computed when panel is open)
  const diagnosticsList=useMemo(()=>{
    if(!diagnosticsOpen||!graph)return [];
    return diagnoseGraph(fromCanvas(graph,canvas),canvas,catalog);
  },[diagnosticsOpen,graph,canvas,catalog]);

  // C3.1 Visual Version Diff (only computed when modal is open)
  const availableDiffSnapshots=useMemo<Record<string,VersionSnapshotInput>>(()=>{
    if(!diffOpen||!graph)return {};
    const out:Record<string,VersionSnapshotInput>={
      draft:{
        label:`Current Working Draft (r${revision})`,
        revision,
        graph:fromCanvas(graph,canvas),
        layout:positions(canvas),
        presentation
      }
    };
    for(const snap of versionSnapshots){
      out[`v${snap.version}`]={
        label:`Published v${snap.version}`,
        version:snap.version,
        graph:snap.graph,
        layout:snap.layout,
        presentation:snap.presentation
      };
    }
    return out;
  },[diffOpen,graph,canvas,presentation,revision,versionSnapshots]);

  const activeVersionDiff=useMemo(()=>{
    if(!diffOpen)return null;
    const keys=Object.keys(availableDiffSnapshots);
    const baseSnap=availableDiffSnapshots[diffBaseKey]??availableDiffSnapshots[keys.find(k=>k!=='draft')??'draft'];
    const targetSnap=availableDiffSnapshots[diffTargetKey]??availableDiffSnapshots.draft;
    if(!baseSnap||!targetSnap)return null;
    return diffGraphVersions(baseSnap,targetSnap);
  },[diffOpen,availableDiffSnapshots,diffBaseKey,diffTargetKey]);

  // C3.3 Find References (only computed when modal is open)
  const activeReferences=useMemo(()=>{
    if(!referencesOpen||!graph)return [];
    const g=fromCanvas(graph,canvas);
    const selNode=canvas.nodes.find(n=>n.id===selected)?.data.runtime;
    return findReferences(
      g,
      canvas,
      {
        nodeId:selected||undefined,
        action:selNode?.type==='action'?selNode.action:undefined,
        argument:selNode?.type==='action'?selNode.argument:undefined
      },
      crossGraphRefs
    );
  },[referencesOpen,graph,canvas,selected,crossGraphRefs]);

  async function openFindReferences(){
    setReferencesOpen(true);
    try{
      const res=await api('references');
      if(Array.isArray(res.entries))setCrossGraphRefs(res.entries);
    }catch{}
  }

  // C3.2 Recovery actions
  function handleRestoreRecovery(){
    if(!recoveryPrompt)return;
    const snap=recoveryPrompt.snapshot;
    const restoredCanvas=toCanvas(snap.graph,snap.layout);
    commitState(restoredCanvas,snap.presentation,{kind:'node',id:snap.graph.entry},[snap.graph.entry]);
    setRecoveryPrompt(null);
    setMessage(`Restored recovered draft from ${snap.savedAt.slice(0,19).replace('T',' ')}`);
  }
  function handleDiscardRecovery(){
    if(!recoveryPrompt)return;
    clearRecoverySnapshotFromStorage(recoveryPrompt.snapshot.graphId);
    autoSavedRecoveryGraphId.current=null;
    setRecoveryPrompt(null);
    setMessage('Discarded local recovery snapshot');
  }

  // C3.4 Bookmarks helpers
  function handleAddBookmark(){
    try{
      const vp=flow.current?.getViewport()??{x:0,y:0,zoom:1};
      const name=newBookmarkName.trim()||(selected?`Focus: ${selected}`:`View ${presentation.bookmarks.length+1}`);
      const {presentation:nextPres,bookmark}=addGraphBookmark(presentation,{
        name,
        nodeId:selected||undefined,
        viewport:vp
      });
      commitState(canvas,nextPres);
      setNewBookmarkName('');
      setMessage(`Added bookmark "${bookmark.name}"`);
    }catch(error){
      setNoticeTone('error');
      setMessage(error instanceof Error?error.message:String(error));
    }
  }
  function handleJumpBookmark(bm:EditorPresentation['bookmarks'][number]){
    if(bm.nodeId&&index.nodes.has(bm.nodeId)){
      setSelected(bm.nodeId);
      focusNode(bm.nodeId);
    }else if(flow.current){
      void flow.current.setViewport({x:bm.viewport.x,y:bm.viewport.y,zoom:bm.viewport.zoom},{duration:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?0:220});
    }
    setMessage(`Jumped to bookmark "${bm.name}"`);
  }

  const windowHandlersRef=useRef<{warn:(e:BeforeUnloadEvent)=>void;keys:(e:KeyboardEvent)=>void}>({warn:()=>{},keys:()=>{}});
  windowHandlersRef.current={
    warn:(event:BeforeUnloadEvent)=>{
      if(dirty&&graph){
        preserveRecoveryOnUnload.current=true;
        try{
          const g=fromCanvas(graph,canvas);
          const snap=buildRecoverySnapshot(g,positions(canvas),presentation,revision,published,catalog?.routeIds??[],catalog?.permitIds??[]);
          saveRecoverySnapshotToStorage(snap);
        }catch{}
        event.preventDefault();
        event.returnValue='';
      }
    },
    keys:(event:KeyboardEvent)=>{
      if(event.isComposing||event.keyCode===229)return;
      const inInput=event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement||event.target instanceof HTMLSelectElement||(event.target as HTMLElement)?.isContentEditable;
      if(routing.candidate&&((event.ctrlKey||event.metaKey)&&['s','z','y','c','v','x','d','g'].includes(event.key.toLowerCase())||['Delete','Backspace',' '].includes(event.key))){event.preventDefault();return;}
      if(event.key==='Escape'&&(routing.candidate||routing.layoutBusy)&&!preview){event.preventDefault();cancelLayoutView();return;}
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='b'){event.preventDefault();setLibraryOpen(v=>!v);return;}
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();void run(save);return;}
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setSearchOpen(true);searchInput.current?.focus();return;}
      if(event.key==='F1'||(!inInput&&event.key==='?'&&!event.ctrlKey&&!event.metaKey)){event.preventDefault();setHelpOpen(v=>!v);return;}
      if(!inInput&&!preview&&!quickOpen&&!edgeInsert&&!activeTemplate&&!diagnosticsOpen&&!diffOpen&&!referencesOpen&&!bookmarksOpen&&!helpOpen){
        if(event.key===' '&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!(event.target instanceof HTMLButtonElement)){
          event.preventDefault();
          openQuickPalette();
          return;
        }
        if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='c'){
          if(selectedSet.size>0){event.preventDefault();handleCopy();return;}
        }
        if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='x'){
          if(selectedSet.size>0){event.preventDefault();handleCut();return;}
        }
        if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='v'){
          event.preventDefault();void handlePaste();return;
        }
        if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='d'){
          if(selectedSet.size>0){event.preventDefault();handleDuplicate();return;}
        }
        if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='g'){
          event.preventDefault();handleCreateGroup();return;
        }
      }
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){
        if(inInput)return;
        event.preventDefault();event.shiftKey?redoChange():undoChange();
      }else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){
        if(inInput)return;
        event.preventDefault();redoChange();
      }else if((event.key==='Delete'||event.key==='Backspace')&&!preview&&!quickOpen&&!edgeInsert&&!activeTemplate&&!inInput){
        if(selection||selectedIds.length){event.preventDefault();deleteSelection();}
      }else if(event.key==='Escape'){
        if(preview)setPreview(null);
        else if(quickOpen){setQuickOpen(false);setQuickSource(null);}
        else if(edgeInsert)setEdgeInsert(null);
        else if(activeTemplate)setActiveTemplate(null);
        else if(diagnosticsOpen)setDiagnosticsOpen(false);
        else if(diffOpen){setDiffOpen(false);setInspectedRemovedNode(null);}
        else if(referencesOpen)setReferencesOpen(false);
        else if(bookmarksOpen)setBookmarksOpen(false);
        else if(helpOpen)setHelpOpen(false);
        else if(searchOpen){setSearchOpen(false);searchInput.current?.blur();}
        else clearSelection();
      }
    }
  };
  useEffect(()=>{
    const warn=(event:BeforeUnloadEvent)=>windowHandlersRef.current.warn(event);
    const keys=(event:KeyboardEvent)=>windowHandlersRef.current.keys(event);
    window.addEventListener('beforeunload',warn);window.addEventListener('keydown',keys);
    return()=>{window.removeEventListener('beforeunload',warn);window.removeEventListener('keydown',keys);};
  },[]);

  const selectedNode=canvas.nodes.find(item=>item.id===selected), node=selectedNode?.data.runtime;
  const selectedGroup=selection?.kind==='group'?presentation.groups.find(g=>g.id===selection.id):undefined;
  const lastTextPatch=useRef<{at:number;id:string;choices:number}>({at:0,id:'',choices:-1});

  function patch(data:Partial<Node>){
    if(!selectedNode)return;
    const runtime={...selectedNode.data.runtime,...data};
    const now=Date.now(),choiceLen=runtime.choices?.length??0;
    const coalesce=now-lastTextPatch.current.at<300&&lastTextPatch.current.id===selected&&lastTextPatch.current.choices===choiceLen&&undo.current.length>0;
    lastTextPatch.current={at:now,id:selected,choices:choiceLen};
    const nextOutgoing=edgesFromNodes([runtime]);
    const oldOutgoing=canvas.edges.filter(e=>e.source===selected);
    const sameEdges=oldOutgoing.length===nextOutgoing.length&&oldOutgoing.every((e,i)=>e.id===nextOutgoing[i]!.id&&e.target===nextOutgoing[i]!.target&&e.sourceHandle===nextOutgoing[i]!.sourceHandle);
    const nextEdges=sameEdges?canvas.edges:[...canvas.edges.filter(e=>e.source!==selected),...nextOutgoing];
    const geometryChanged=!sameEdges||nodeHeight(selectedNode.data.runtime)!==nodeHeight(runtime);
    const next={...canvas,nodes:canvas.nodes.map(n=>n.id===selected?{...n,data:{runtime}}:n),edges:nextEdges};
    if(!coalesce)record(canvas,presentation,selection,selectedIds);
    setCanvas(next);markDirty(geometryChanged);setValidation('unchecked');setPreview(null);
  }
  async function login(){
    const session=await api('login',{grant});setCsrf(session.csrf);setGrant('');
    const next=await refresh(session.csrf);if(next.graphs[0])await load(next.graphs[0].id,session.csrf,next);
  }
  const topChromeMemo=useMemo(()=><>
    <header className="app-header">
      <div className="studio-brand"><div className="brand-mark" aria-hidden="true">F<span>◇</span></div><div><strong>Frostveil <span>Studio</span></strong><small>ARCANE WORKBENCH</small></div></div>
      <div className="graph-context"><Icon name="npc"/><select aria-label="Graph" value={graph?.id??''} disabled={busy||!!routing.candidate} onChange={event=>run(()=>load(event.target.value))}>{catalog?.graphs.map((item:any)=><option key={item.id} value={item.id}>{item.id} · v{item.version}{item.draftRevision?` · draft ${item.draftRevision}`:''}</option>)}</select></div>
      <span className={'badge '+(dirty?'unsaved':'')}><span className="status-dot"/>{dirty?'Unsaved changes':'Saved draft'}</span>
      <div className="header-session"><span className="session-dot"/>Local workspace</div>
      <button type="button" className="icon-button" aria-label="Keyboard shortcuts" title="Editor Shortcuts & Help · F1 / ?" onClick={()=>setHelpOpen(true)}><Icon name="help" size={17}/></button>
      <details className="account-menu"><summary title="Authenticated editor session"><Icon name="user"/><span>Admin session</span><span className="chevron">⌄</span></summary><div><p>สิทธิ์ตรวจสอบจากเซิร์ฟเวอร์<br/><span>Session expires automatically</span></p><button onClick={()=>run(async()=>{if(dirty&&!confirm('Discard unsaved changes?'))return;await api('logout');setCsrf('');setCatalog(null);setGraph(null);setCanvas({nodes:[],edges:[]});setPresentation(emptyPresentation());setMessage('Signed out');})}><Icon name="logout"/>Sign out</button></div></details>
    </header>
    <nav className="primary-toolbar" aria-label="Authoring workflow" aria-busy={busy}>
      <div className="tool-group"><small>EDIT</small><div><button className="icon-button" aria-label="Undo" title="Undo · Ctrl+Z" onClick={undoChange} disabled={busy||!!routing.candidate||!undo.current.length}><Icon name="undo"/></button><button className="icon-button" aria-label="Redo" title="Redo · Ctrl+Shift+Z" onClick={redoChange} disabled={busy||!!routing.candidate||!redo.current.length}><Icon name="redo"/></button><button title="Save draft · Ctrl+S" disabled={busy||!graph||!!routing.candidate} onClick={()=>run(save)}><Icon name="save"/>Save draft</button></div></div>
      <div className="tool-group"><small>AUTHOR</small><div><button className="icon-button" aria-label="Quick create node" title="Quick node creation palette · Space" disabled={busy||!graph||!!routing.candidate} onClick={()=>openQuickPalette()}><Icon name="plus"/></button><button className="icon-button" aria-label="Copy selection" title="Copy selected nodes · Ctrl+C" disabled={busy||!selectedSet.size||!!routing.candidate} onClick={handleCopy}><Icon name="copy"/></button><button className="icon-button" aria-label="Paste clipboard" title="Paste copied nodes · Ctrl+V" disabled={busy||!graph||!!routing.candidate} onClick={()=>void handlePaste()}><Icon name="paste"/></button><button className="icon-button" aria-label="Add visual group" title="Create comment/group frame · Ctrl+G" disabled={busy||!graph||!!routing.candidate} onClick={handleCreateGroup}><Icon name="group"/></button></div></div>
      <div className="tool-group"><small>NAVIGATE</small><div><button title="Fit every node in view" onClick={()=>navigate()}><Icon name="fit"/>Fit All</button><button title="Focus the opening conversation" onClick={opening}><Icon name="entry"/>Opening</button><button className="icon-button" aria-label="Bookmarks" title="Named graph bookmarks" disabled={!graph} onClick={()=>setBookmarksOpen(true)}><Icon name="bookmark"/></button></div></div>
      <div className="tool-group"><small>REVIEW</small><div><button disabled={busy||!graph} title="Check graph structure and service permissions" onClick={()=>run(validate)}><Icon name="check"/>Validate</button><button className="icon-button" aria-label="Validation navigator" title="Open categorized Validation Navigator" disabled={!graph} onClick={()=>setDiagnosticsOpen(true)}><Icon name="warning"/></button><button disabled={busy||!graph} title="Preview without changing player data" onClick={()=>run(()=>showPreview([]))}><Icon name="preview"/>Preview</button><button className="icon-button" aria-label="Visual debugger" aria-pressed={debuggerOpen} title="Step-by-step Visual Dialogue Debugger" disabled={!graph} onClick={()=>{if(!debuggerOpen&&!debugSession)startOrRestartDebugger();else setDebuggerOpen(v=>!v);}}><Icon name="bug"/></button><button className="icon-button" aria-label="Compare versions" title="Visual Version Diff" disabled={!graph} onClick={()=>setDiffOpen(true)}><Icon name="diff"/></button></div></div>
      <div className="tool-group delivery-tools"><small>DELIVER</small><div><button className="primary" disabled={busy||!graph||!!routing.candidate} title="Validate and publish · confirmation required" onClick={()=>run(async()=>{
        if(!confirm('Publish this graph for new conversations?'))return;
        await validate();const saved=dirty?await save():{revision};
        const result=await api('publish',{id:graph!.id,draftRevision:saved.revision,version:published});
        setPublished(result.version);const updated=await api('graph',{id:graph!.id});setHistory(updated.history);if(Array.isArray(updated.versions))setVersionSnapshots(updated.versions);await refresh();setMessage('Published v'+result.version+' for new conversations');
      })}><Icon name="publish"/>Publish</button>
      <select aria-label="NPC" title="NPC assignment target" value={npc} disabled={busy} onChange={event=>setNpc(event.target.value)}><option value="">Choose NPC</option>{catalog?.npcs.map((item:any)=><option value={item.id} key={item.id}>{item.name}</option>)}</select>
      <button disabled={busy||!!routing.candidate||!npc||!published} title="Assign the published version to the selected NPC" onClick={()=>run(async()=>{const value=await api('assign',{npc,id:graph!.id,revision:catalog.revision});await refresh();setMessage('Graph assignment saved (catalog '+value.revision+')');})}><Icon name="link"/>Assign graph</button></div></div>
      <button className="new-graph icon-button" aria-label="New graph" title="Create a new empty graph" disabled={busy||!!routing.candidate} onClick={()=>{if(dirty&&!confirm('Discard unsaved changes?'))return;const id='dialogue-'+crypto.randomUUID().slice(0,8);const value:Graph={schemaVersion:1,id,version:1,entry:'entry',nodes:[{id:'entry',type:'entry',next:'end'},{id:'end',type:'end'}]};setGraph(value);setCanvas(toCanvas(value));setPresentation(emptyPresentation());hadPresentation.current=false;setRevision(0);setPublished(0);setHistory([]);setVersionSnapshots([]);setRecoveryPrompt(null);markDirty();setValidation('unchecked');setSelected('entry');undo.current=[];redo.current=[];}}><Icon name="plus"/></button>
    </nav>
  </>,[graph?.id,catalog,dirty,busy,routing.candidate,selectedSet.size,debuggerOpen,debugSession,npc,published,revision,undo.current.length,redo.current.length]);

  const libraryAsideMemo=useMemo(()=><aside className="library" aria-label="Node library">
    <div className="panel-title"><div><Icon name="library"/><b>Node Library</b></div><button className="icon-button" aria-label="Collapse node library" title="Collapse library · Ctrl+B" onClick={()=>setLibraryOpen(false)}><Icon name="close" size={16}/></button></div>
    <div className="library-scroll"><div className="library-search"><Icon name="search"/><input aria-label="Search nodes" placeholder="Find a node…" value={query} onChange={event=>setQuery(event.target.value)}/></div>
    <p className="library-help">ลากลงพื้นที่ทำงาน ทับเส้นเชื่อมเพื่อแทรก หรือคลิกเพื่อเพิ่ม</p>
    {['CONVERSATION','FLOW & LOGIC','SERVICES'].map(category=><section className="library-category" key={category}><h3>{category}</h3>{nodeTypesList.filter(type=>(category==='CONVERSATION'?['npc','choices']:category==='FLOW & LOGIC'?['entry','condition','end']:['action']).includes(type)&&(type+' '+nodeInfo[type].label+' '+nodeInfo[type].hint).toLowerCase().includes(query.toLowerCase())).map(type=><button className="palette-item" style={{'--node-accent':nodeColors[type]} as React.CSSProperties} draggable key={type} disabled={type==='entry'&&hasEntryNode} onClick={()=>add(type)} onDragStart={event=>{event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('application/frostveil-node',type);}}><span className="palette-icon"><Icon name={type}/></span><span>{nodeInfo[type].label}<em>{nodeInfo[type].hint}</em></span><span className="palette-add">+</span></button>)}</section>)}
    {query&&!nodeTypesList.some(type=>(type+' '+nodeInfo[type].label+' '+nodeInfo[type].hint).toLowerCase().includes(query.toLowerCase()))&&<p className="empty-note">ไม่พบโหนดที่ค้นหา</p>}
    <section className="library-category template-section"><h3><Icon name="template" size={14}/>GRAPH TEMPLATES</h3>
      {GRAPH_TEMPLATES.filter(t=>!query||(t.title+' '+t.thaiTitle+' '+t.description).toLowerCase().includes(query.toLowerCase())).map(tpl=><button className="palette-item template-item" key={tpl.id} onClick={()=>{setActiveTemplate(tpl.id);if(!templateRouteId&&catalog?.routeIds?.[0])setTemplateRouteId(catalog.routeIds[0]);if(!templatePermitId&&catalog?.permitIds?.[0])setTemplatePermitId(catalog.permitIds[0]);}}><span className="palette-icon"><Icon name="template" size={16}/></span><span>{tpl.thaiTitle}<em>{tpl.title}</em></span><span className="palette-add">↗</span></button>)}
    </section>
    <section className="version-section"><h3><Icon name="history" size={16}/>VERSION HISTORY<span>{history.length}</span></h3>{history.length?history.map(item=><button className="history-item" aria-label={'v'+item.version+' · Roll back'} title={'Publish version '+item.version+' as a new version · confirmation required'} key={item.version} onClick={()=>run(async()=>{
      if(dirty&&!confirm('Discard current changes and roll back to v'+item.version+'?'))return;
      if(!confirm('Publish version '+item.version+' as a new version?'))return;
      const result=await api('rollback',{id:graph!.id,targetVersion:item.version,version:published});
      await load(graph!.id);setPublished(result.version);setMessage('Rollback published as v'+result.version);
    })}><Icon name="history" size={16}/><span>v{item.version} · Roll back</span><span>↗</span></button>):<p className="empty-note">ยังไม่มีเวอร์ชันเผยแพร่</p>}</section>
    </div><div className="panel-sizing"><label>Library width<input aria-label="Node library width" type="range" min="220" max="320" step="10" value={libraryWidth} onChange={e=>setLibraryWidth(Number(e.target.value))}/></label></div>
    <PanelResize label="Resize node library" value={libraryWidth} min={220} max={320} onChange={setLibraryWidth} side="left"/>
  </aside>,[query,hasEntryNode,history,dirty,published,graph?.id,libraryWidth,catalog,templateRouteId,templatePermitId]);

  const canvasToolbarMemo=useMemo(()=><div className="canvas-toolbar"><div className="canvas-context"><Icon name="npc" size={16}/><span>Dialogue graph</span><span className="context-separator">/</span><b>{graph?.id}</b><span className="context-version">v{published}</span></div>
    <div className="canvas-tools"><label className="routing-mode">Routing<select aria-label="Routing mode" value={routing.mode} disabled={routing.layoutBusy||!!routing.candidate} onChange={e=>routing.setMode(e.target.value as 'smart'|'legacy')}><option value="smart">Smart</option><option value="legacy">Legacy</option></select></label><button className="icon-button" aria-label="Box select" aria-pressed={boxSelectMode} title="Rectangle multi-selection" onClick={()=>setBoxSelectMode(v=>!v)}><Icon name="box" size={17}/></button><button className="icon-button" aria-label="Toggle node library" aria-pressed={libraryOpen} title="Node library · Ctrl+B" onClick={()=>setLibraryOpen(v=>!v)}><Icon name="library" size={17}/></button><button className="icon-button" aria-label="Auto Arrange" title="Auto Arrange · Preview ELK layout before applying" disabled={routing.layoutBusy||!!routing.candidate||!graph} onClick={autoArrange}><Icon name="arrange" size={17}/></button>
    <button title="Focus selected node or connection endpoints" disabled={!selection&&!selectedIds.length} onClick={()=>navigate(selectedIds.length>1?selectedIds:selection?.kind==='node'?[selection.id]:selection?.kind==='group'?presentation.groups.find(g=>g.id===selection.id)?.nodeIds:[...traced.nodes])}><Icon name="focus" size={16}/><span>Focus Selected</span></button>
    <button className="icon-button" aria-label="Back View" title="Return to previous canvas view" disabled={!viewCount} onClick={()=>{const previous=views.current.pop();if(previous){void flow.current?.setViewport(previous,{duration:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?0:220});setViewCount(views.current.length);}}}><Icon name="back" size={17}/></button>
    <button className="icon-button" aria-label="แผนผังย่อ" title="Toggle minimap" aria-pressed={miniMapOpen} onClick={()=>setMiniMapOpen(v=>!v)}><Icon name="map" size={17}/></button><button className="icon-button" aria-label="Toggle properties" aria-pressed={inspectorOpen} title="Toggle inspector" onClick={()=>setInspectorOpen(v=>!v)}><Icon name="panel" size={17}/></button></div></div>,[graph?.id,published,routing.mode,routing.layoutBusy,routing.candidate,boxSelectMode,libraryOpen,selection,selectedIds,presentation.groups,traced.nodes,viewCount,miniMapOpen,inspectorOpen]);

  if(!csrf)return <main className="login"><div className="seal">F</div><small>FROSTVEIL STUDIO</small><h1>Arcane Workbench</h1><p>เครื่องมือสร้างบทสนทนาและเส้นทางของโลก Frostveil</p>
    <label>One-time editor grant<input value={grant} onChange={event=>setGrant(event.target.value)} autoComplete="off" type="password"/></label>
    <button disabled={!grant||busy} onClick={()=>run(login)}>Enter studio →</button><p role="alert">{message}</p><p className="muted">ใช้รหัสครั้งเดียวจากคำสั่ง /editor ในเกม<br/>Local workspace · Authorized administrators only</p></main>;

  return <div className="studio">
    {topChromeMemo}
    <div style={{'--inspector-width':inspectorWidth+'px','--library-width':libraryWidth+'px'} as React.CSSProperties} className={'workspace '+(!libraryOpen?'library-hidden ':'')+(!inspectorOpen?'inspector-hidden':'')}>
      {libraryAsideMemo}
      <section ref={canvasSectionRef} data-active-edge={activePathId} className={'canvas '+(selection?'trace-active ':'')+(activePath?'path-isolated ':'')+(focusPath&&selection?.kind==='edge'?'selected-path-focus':'')}
        onPointerMove={event=>{
          lastPointer.current={x:event.clientX,y:event.clientY};
          if(marquee&&flow.current){
            const pt=flow.current.screenToFlowPosition({x:event.clientX,y:event.clientY});
            setMarquee(prev=>prev?{...prev,x2:pt.x,y2:pt.y}:null);
          }
          if(groupDragRef.current&&flow.current){
            const pt=flow.current.screenToFlowPosition({x:event.clientX,y:event.clientY});
            const dx=Math.round(pt.x-groupDragRef.current.startX);
            const dy=Math.round(pt.y-groupDragRef.current.startY);
            const base=groupDragRef.current.snapshot;
            const moved=moveVisualGroupWithContents(base.canvas,base.presentation,groupDragRef.current.groupId,{x:dx,y:dy});
            setCanvas(moved.canvas);
            setPresentation(moved.presentation);
          }
        }}
        onPointerUp={()=>{
          if(marquee){
            const hits=nodesInRectangle(canvas,marquee);
            setMarquee(null);
            setBoxSelectMode(false);
            if(hits.length){
              setSelectedIds(hits);
              setSelection({kind:'node',id:hits[0]!});
              setInspectorOpen(true);
              setMessage(`Selected ${hits.length} node(s)`);
            }
          }
          if(groupDragRef.current){
            undo.current.push(groupDragRef.current.snapshot);
            if(undo.current.length>100)undo.current.shift();
            redo.current=[];
            hadPresentation.current=true;
            groupDragRef.current=null;
            markDirty();
          }
        }}
        onPointerDown={event=>{
          if(boxSelectMode&&flow.current&&!(event.target as HTMLElement).closest('.node,.visual-group,.canvas-toolbar,.graph-navigation')){
            const pt=flow.current.screenToFlowPosition({x:event.clientX,y:event.clientY});
            setMarquee({x1:pt.x,y1:pt.y,x2:pt.x,y2:pt.y});
          }
        }}
        onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect='copy';}}
        onDrop={event=>{
          event.preventDefault();if(routing.candidate)return;
          const type=event.dataTransfer.getData('application/frostveil-node') as Node['type'];
          if(!nodeTypesList.includes(type))return;
          const pos=flow.current?flow.current.screenToFlowPosition({x:event.clientX,y:event.clientY}):{x:240,y:160};
          const targetEl=event.target as HTMLElement|null;
          const hitEdgeId=targetEl?.closest?.('[data-edge-id]')?.getAttribute('data-edge-id')??
            targetEl?.closest?.('.react-flow__edge')?.getAttribute('data-id')??
            document.elementsFromPoint(event.clientX,event.clientY).map(el=>el.closest('.react-flow__edge')?.getAttribute('data-id')??el.closest('[data-edge-id]')?.getAttribute('data-edge-id')).find((id):id is string=>!!id&&index.edges.has(id));
          if(hitEdgeId&&index.edges.has(hitEdgeId)){
            startEdgeInsert(hitEdgeId,type,pos);
            return;
          }
          add(type,pos);
        }}>
        {canvasToolbarMemo}
        <div className="graph-navigation">
          <div className="graph-search"><Icon name="search" size={16}/><input ref={searchInput} aria-label="Search graph" placeholder="ค้นหาโหนด บทพูด ตัวเลือก…  Ctrl+K" value={searchText} aria-expanded={searchOpen} aria-controls="graph-results" role="combobox" aria-autocomplete="list" aria-activedescendant={searchOpen&&found[searchActive]?'result-'+found[searchActive]!.id:undefined}
            onFocus={()=>setSearchOpen(true)} onChange={e=>{setSearchText(e.target.value);setSearchActive(0);setSearchOpen(true);}}
            onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setSearchActive(i=>Math.min(found.length-1,i+1));}else if(e.key==='ArrowUp'){e.preventDefault();setSearchActive(i=>Math.max(0,i-1));}else if(e.key==='Enter'&&found[searchActive]){e.preventDefault();chooseResult(found[searchActive]!.id);}else if(e.key==='Escape'){e.stopPropagation();setSearchOpen(false);e.currentTarget.blur();}}}/>
            {searchOpen&&<div className="search-results" id="graph-results" role="listbox" aria-label="Matching nodes"><div className="search-summary">{found.length} results <button onClick={()=>{setSearchText('');setSearchOpen(false);}}>Clear search</button></div>{!found.length&&<p>ไม่พบโหนด ลองชื่อ ชนิดโหนด หรือข้อความไทย</p>}{found.map((n,i)=><button type="button" id={'result-'+n.id} role="option" aria-selected={i===searchActive} key={n.id} onClick={()=>chooseResult(n.id)}><span style={{color:nodeColors[n.type]}}><Icon name={n.type} size={20}/></span><span><b>{title(n)}</b><em>{n.id} · {(n.text??n.choices?.[0]?.text??n.argument??nodeInfo[n.type].hint).slice(0,85)}</em></span></button>)}</div>}
          </div>
          <label className="trace-control">Trace<select aria-label="Trace mode" value={traceMode} onChange={e=>setTraceMode(e.target.value as TraceMode)} disabled={selection?.kind!=='node'}><option value="direct">Direct connections</option><option value="upstream">Upstream dependencies</option><option value="downstream">Downstream flow</option></select></label><button className="focus-path" aria-label="Focus Path" aria-pressed={focusPath&&selection?.kind==='edge'} disabled={selection?.kind!=='edge'} title="Dim unrelated connections without changing graph data" onClick={()=>setFocusPath(v=>!v)}>Focus Path</button><button className="reset-trace" title="Clear selection and tracing · Escape" onClick={clearSelection}>Reset trace</button>
        </div>
        {recoveryPrompt&&<div className={'recovery-banner'+(recoveryPrompt.hasServerConflict?' conflict':'')} role="region" aria-label="Draft recovery">
          <div>
            <b>{recoveryPrompt.hasServerConflict?'Draft Recovery Conflict Detected':'Unsaved Local Recovery Snapshot Available'}</b>
            <span>{recoveryPrompt.explanation}</span>
          </div>
          <div className="recovery-actions">
            <button type="button" className="primary" onClick={handleRestoreRecovery}>Restore recovered draft</button>
            <button type="button" onClick={handleDiscardRecovery}>Discard recovery snapshot</button>
          </div>
        </div>}
        {(routing.layoutBusy||routing.candidate||routing.layoutMessage)&&<div className="layout-preview-bar" role="region" aria-label="Auto Arrange preview"><div><b>{routing.layoutBusy?'Calculating ELK layout…':routing.candidate?'Layout preview':'Auto Arrange'}</b><span>{routing.layoutMessage}{routing.candidate&&` · ${routing.candidate.result.routes.size} routes · ${Math.round(routing.candidate.result.elapsedMs)}ms`}</span></div>{routing.candidate&&<button className="primary" disabled={busy} onClick={applyLayout}>Apply layout</button>}<button aria-label="Cancel auto arrange" onClick={cancelLayoutView}>{routing.candidate||routing.layoutBusy?'Cancel':'Dismiss'}</button></div>}
        {edgeInsert&&edgeInsertPlan&&<div className="edge-insert-bar" role="region" aria-label="Edge insertion preview">
          <div className="edge-insert-summary">
            <b>Insert Node on Connection · {edgeInsert.edgeId}</b>
            <span>{edgeInsertPlan.valid?`Preview: ${edgeInsertPlan.sourceId} [${edgeInsertPlan.sourceHandle}] → ${edgeInsertPlan.node.type} [${edgeInsertPlan.selectedOutput}] → ${edgeInsertPlan.targetId}`:edgeInsertPlan.reason}</span>
          </div>
          <div className="edge-insert-controls">
            <label>Node type<select aria-label="Insert node type" value={edgeInsert.nodeType} onChange={e=>{const t=e.target.value as Node['type'];setEdgeInsert({...edgeInsert,nodeType:t,outgoingHandle:t==='condition'?'':'next'});}}>{nodeTypesList.map(t=><option key={t} value={t}>{nodeInfo[t].label} ({t})</option>)}</select></label>
            {edgeInsert.nodeType==='condition'&&<>
              <label>Condition<select aria-label="Insert condition" value={edgeInsert.condition} onChange={e=>setEdgeInsert({...edgeInsert,condition:e.target.value as Node['condition']})}>{(catalog?.conditions??['always','courierIdle']).map((c:string)=><option key={c} value={c}>{conditionLabels[c]??c}</option>)}</select></label>
              <label>Continue branch<select aria-label="Outgoing branch" value={edgeInsert.outgoingHandle} onChange={e=>setEdgeInsert({...edgeInsert,outgoingHandle:e.target.value})}><option value="">Select branch…</option><option value="next">True · เมื่อเงื่อนไขเป็นจริง</option><option value="otherwise">False · เมื่อเงื่อนไขเป็นเท็จ</option></select></label>
            </>}
            {edgeInsert.nodeType==='action'&&<>
              <label>Service<select aria-label="Insert service" value={edgeInsert.action} onChange={e=>setEdgeInsert({...edgeInsert,action:e.target.value as Node['action']})} >{(catalog?.actions??['contracts','rank','permits','accept','buyPermit']).map((a:string)=><option key={a} value={a}>{actionLabels[a]??a}</option>)}</select></label>
              {['accept','buyPermit'].includes(edgeInsert.action!)&&<label>Target<select aria-label="Insert target" value={edgeInsert.argument} onChange={e=>setEdgeInsert({...edgeInsert,argument:e.target.value})}><option value="">Choose…</option>{((edgeInsert.action==='accept'?catalog?.routes:catalog?.permits)??[]).map((opt:any)=><option key={opt.id} value={opt.id}>{opt.label}</option>)}</select></label>}
            </>}
            <button className="primary" disabled={!edgeInsertPlan.valid||edgeInsertPlan.ambiguous} onClick={confirmEdgeInsert}>Confirm insert</button>
            <button onClick={()=>setEdgeInsert(null)}>Cancel insert</button>
          </div>
        </div>}
        {debuggerOpen&&debugSession&&<div className="debugger-dock" role="region" aria-label="Visual dialogue debugger">
          <div className="debugger-header">
            <div>
              <small>VISUAL DIALOGUE DEBUGGER · SAFE SIMULATION ENGINE</small>
              <strong>Status: <span className={'dbg-status dbg-'+debugSession.status}>{debugSession.status.toUpperCase()}</span> · Current: <code>{debugSession.currentNodeId??'none'}</code> → Expected Next: <code>{debugSession.expectedNextNodeId??'none'}</code></strong>
            </div>
            <span className="sim-safety-badge">SIMULATED — 0 GAMEPLAY MUTATIONS</span>
            <div className="debugger-controls">
              <button type="button" onClick={()=>startOrRestartDebugger()}>Restart simulation</button>
              <button type="button" className="primary" disabled={debugSession.status==='completed'||debugSession.status==='error'||debugSession.status==='awaiting-choice'} onClick={()=>stepDebugger()}>Step simulation</button>
              <button type="button" disabled={debugSession.status==='completed'||debugSession.status==='error'||debugSession.status==='awaiting-choice'} onClick={continueDebugger}>Continue simulation</button>
              <button type="button" disabled={!debugSession.currentNodeId} onClick={()=>debugSession.currentNodeId&&focusNode(debugSession.currentNodeId)}>Focus executing node</button>
              <button type="button" disabled={!selected} onClick={()=>selected&&toggleBreakpoint(selected)}>{selected&&debugBreakpoints.includes(selected)?`Remove breakpoint (${selected})`:`Toggle breakpoint (${selected||'none'})`}</button>
              <button type="button" aria-pressed={compareOpen} onClick={()=>setCompareOpen(v=>!v)}>Compare scenarios</button>
              <button type="button" onClick={()=>setDebuggerOpen(false)}>Close debugger</button>
            </div>
          </div>
          <div className="debugger-body">
            <div className="debugger-profile-config">
              <label>Test Player Profile<select aria-label="Test player profile" value={debugProfile.id} onChange={e=>{const foundProf=PRESET_PLAYER_PROFILES.find(p=>p.id===e.target.value);if(foundProf){const cloned=structuredClone(foundProf);setDebugProfile(cloned);startOrRestartDebugger(cloned);}}}>{PRESET_PLAYER_PROFILES.map(p=><option key={p.id} value={p.id}>{p.name} — {p.thaiName}</option>)}</select></label>
              <label>Courier state<select aria-label="Mock courier state" value={debugProfile.courierLifecycle} onChange={e=>{const nextP={...debugProfile,courierLifecycle:e.target.value as 'idle'|'active'};setDebugProfile(nextP);startOrRestartDebugger(nextP);}}><option value="idle">Idle (No active contract)</option><option value="active">Active contract</option></select></label>
              <label>Wallet Gold<input aria-label="Mock wallet gold" type="number" min={0} max={999999} value={debugProfile.walletGold} onChange={e=>{const nextP={...debugProfile,walletGold:Number(e.target.value)};setDebugProfile(nextP);}}/></label>
              <label className="inline-check"><input type="checkbox" checked={debugProfile.courierRankEligible} onChange={e=>{const nextP={...debugProfile,courierRankEligible:e.target.checked};setDebugProfile(nextP);startOrRestartDebugger(nextP);}}/>Rank eligible</label>
            </div>
            {debugSession.error&&<p className="debugger-error" role="alert">{debugSession.error}</p>}
            {debugSession.steps.at(-1)?.dialogueText&&!debugSession.steps.at(-1)?.actionOutcome&&<p className="debugger-dialogue">{debugSession.steps.at(-1)!.dialogueText}</p>}
            {debugSession.steps.at(-1)?.conditionEval&&<p className="debugger-condition-eval"><b>Condition Evaluation:</b> {debugSession.steps.at(-1)!.conditionEval!.explanation}</p>}
            {debugSession.steps.at(-1)?.actionOutcome&&<p className="debugger-action-eval"><b>Simulated Action:</b> {debugSession.steps.at(-1)!.actionOutcome!.summary} <em>({debugSession.steps.at(-1)!.actionOutcome!.verificationNote})</em></p>}
            {debugSession.status==='awaiting-choice'&&<div className="debugger-choices" aria-label="Debugger player choices">
              {debugSession.availableChoices.map((ch,idx)=><button type="button" key={ch.id} onClick={()=>stepDebugger(ch.id)}><span>{idx+1}.</span> {ch.text} → <code>{ch.next||'unlinked'}</code></button>)}
            </div>}
            <div className="debugger-timeline" aria-label="Execution history timeline">
              <small>EXECUTION HISTORY ({debugSession.steps.length} steps · Breakpoints: {debugBreakpoints.length?debugBreakpoints.join(', '):'none'}):</small>
              <div className="timeline-steps">{debugSession.steps.map(st=><button type="button" key={st.stepIndex} className={st.nodeId===debugSession.currentNodeId?'active-step':''} onClick={()=>{setSelected(st.nodeId);focusNode(st.nodeId);}}>#{st.stepIndex} {st.nodeId} ({st.nodeType}){st.chosenChoiceId?` [${st.chosenChoiceId}]`:''}</button>)}</div>
            </div>
            {compareOpen&&<div className="debugger-comparison" aria-label="Scenario path comparison">
              <h4>Scenario Path Comparison (Zero live state changes)</h4>
              <table>
                <thead><tr><th>Profile</th><th>Status</th><th>Path (Visited Nodes)</th><th>Conditions / Simulated Services</th></tr></thead>
                <tbody>{scenarioComparisonRows.map(row=><tr key={row.profileId}><td><b>{row.profileName}</b></td><td>{row.status}</td><td><code>{row.visitedNodeIds.join(' → ')}</code></td><td>{[...row.conditionBranches,...row.simulatedActions].join(' · ')||'—'}</td></tr>)}</tbody>
              </table>
            </div>}
          </div>
        </div>}
        {(routing.error||routing.warnings.length>0)&&<div className="routing-notice" role="status">{routing.error?'Smart routing unavailable; showing Legacy paths. '+routing.error:`${routing.warnings.length} routing notes · ${routing.warnings.slice(0,2).join(' · ')}`}</div>}
        {presentation.groups.length>0&&<div className="groups-layer" aria-label="Visual groups">{presentation.groups.map(grp=>{
          const colorHex=GROUP_COLOR_INFO[grp.color]?.hex??'#d3b77e';
          const isGroupSelected=selection?.kind==='group'&&selection.id===grp.id;
          return <div key={grp.id} data-group-id={grp.id} style={{'--group-accent':colorHex,width:grp.width,height:grp.collapsed?44:grp.height} as React.CSSProperties} className={'visual-group'+(isGroupSelected?' selected':'')+(grp.collapsed?' collapsed':'')} onClick={e=>{e.stopPropagation();selectGroup(grp.id);}}>
            <div className="visual-group-header" onPointerDown={e=>{
              if((e.target as HTMLElement).closest('button'))return;
              if(flow.current){
                const pt=flow.current.screenToFlowPosition({x:e.clientX,y:e.clientY});
                groupDragRef.current={groupId:grp.id,startX:pt.x,startY:pt.y,snapshot:makeSnapshot()};
              }
            }}>
              <span className="group-dot"/>
              <strong>{grp.title}</strong>
              <span className="group-count">{grp.nodeIds.length} nodes</span>
              <button type="button" className="icon-button" aria-label={`Toggle collapse ${grp.title}`} onClick={e=>{e.stopPropagation();commitState(canvas,updateVisualGroup(presentation,grp.id,{collapsed:!grp.collapsed}),{kind:'group',id:grp.id},[]);}}>{grp.collapsed?'+':'−'}</button>
            </div>
            {!grp.collapsed&&<p className="visual-group-desc">{grp.description}</p>}
          </div>;
        })}</div>}
        <ReactFlow<BlueprintNode> nodes={viewNodes} edges={viewEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onInit={instance=>{flow.current=instance;}}
          onMoveEnd={(_,view)=>setZoom(Math.round(view.zoom*100))} onPaneClick={()=>{clearSelection();setSearchOpen(false);}}
          onNodeClick={(event,item)=>{
            setSearchOpen(false);
            setInspectorOpen(true);
            if(event?.shiftKey||event?.ctrlKey||event?.metaKey){
              setSelectedIds(prev=>{
                const base=prev.length?prev:selected?[selected]:[];
                const next=base.includes(item.id)?base.filter(id=>id!==item.id):[...base,item.id];
                const last=next.at(-1)??null;
                setSelection(last?{kind:'node',id:last}:null);
                return next;
              });
              return;
            }
            setSelected(item.id);
          }}
          onEdgeClick={inspectEdge}
          onConnectStart={(_,params)=>{
            if(params?.handleType==='source'&&params.nodeId&&params.handleId){
              connectStartRef.current={source:params.nodeId,sourceHandle:params.handleId};
              connectSucceededRef.current=false;
            }
          }}
          onConnectEnd={event=>{
            const pending=connectStartRef.current;
            connectStartRef.current=null;
            if(pending&&!connectSucceededRef.current){
              const clientX='clientX' in event?event.clientX:(event as TouchEvent).changedTouches?.[0]?.clientX??lastPointer.current.x;
              const clientY='clientY' in event?event.clientY:(event as TouchEvent).changedTouches?.[0]?.clientY??lastPointer.current.y;
              const target=event.target as HTMLElement|null;
              if(!target?.closest?.('.react-flow__handle')){
                const dropPos=flow.current?flow.current.screenToFlowPosition({x:clientX,y:clientY}):{x:320,y:180};
                openQuickPalette(dropPos,pending);
              }
            }
          }}
          nodesDraggable={!routing.candidate} nodesConnectable={!routing.candidate} onNodeDragStart={()=>{dragStart.current=makeSnapshot();}}
          onNodeDragStop={()=>{if(dragStart.current){undo.current.push(dragStart.current);if(undo.current.length>100)undo.current.shift();redo.current=[];dragStart.current=null;markDirty();}}}
          onNodesChange={changes=>{
            const chosen=changes.find(c=>c.type==='select'&&c.selected);
            if(chosen?.type==='select')setSelected(chosen.id);
            if(changes.every(c=>c.type==='select'))return;
            const posChanges=changes.filter((c):c is any=>c.type==='position'&&!!c.position);
            let nextNodes=applyNodeChanges(changes.filter(c=>c.type!=='select'),canvas.nodes);
            if(posChanges.length===1&&selectedSet.size>1&&selectedSet.has(posChanges[0].id)){
              const movedId=posChanges[0].id;
              const oldNode=canvas.nodes.find(n=>n.id===movedId);
              const newPos=posChanges[0].position;
              if(oldNode&&newPos){
                const dx=newPos.x-oldNode.position.x,dy=newPos.y-oldNode.position.y;
                if(dx!==0||dy!==0){
                  nextNodes=nextNodes.map(n=>n.id!==movedId&&selectedSet.has(n.id)?{...n,position:{x:n.position.x+dx,y:n.position.y+dy}}:n);
                }
              }
            }
            const next={...canvas,nodes:nextNodes};
            if(changes.some(change=>change.type==='remove')||!dragStart.current&&changes.some(c=>c.type==='position'&&c.position&&!c.dragging))changeCanvas(next);else setCanvas(next);
          }} onEdgesChange={changes=>{const chosen=changes.find(c=>c.type==='select'&&c.selected);if(chosen?.type==='select')selectEdge(chosen.id);if(changes.every(c=>c.type==='select'))return;const next={...canvas,edges:applyEdgeChanges(changes.filter(c=>c.type!=='select'),canvas.edges)};if(changes.some(item=>item.type==='remove'||item.type==='add'||item.type==='replace'))change(next);else setCanvas(next);}}
          onConnect={connection=>{connectSucceededRef.current=true;try{change(connect(connection,canvas));}catch(error){setMessage(error instanceof Error?error.message:String(error));}}}
          elevateEdgesOnSelect={false} onlyRenderVisibleElements minZoom={.01} maxZoom={1.6} colorMode="dark" edgesFocusable nodesFocusable deleteKeyCode={null}><ReadingView graphId={graph?.id??''} ids={openingIds}/><Background gap={24} color="#30353c" size={1}/><Controls/>{miniMapOpen&&<MiniMap nodeColor={n=>nodeColors[(n.data.runtime as Node).type]} maskColor="#0c141cbb" pannable zoomable/>}</ReactFlow>
        <div className="canvas-hint">{activePath?<span className="active-path"><Icon name="arrow" size={14}/>Active path · {connection(index,activePath).output}</span>:<span>ลากพื้นเพื่อเลื่อน <i>·</i> Space สร้างโหนดด่วน <i>·</i> Ctrl+K ค้นหา</span>}<span title={routing.warnings.join(' · ')}>{routing.mode==='legacy'?'Legacy curves':routing.routing?'Routing… (updates on drop)':routing.result?`Smart · ${routing.result.routes.size} routes · ${Math.round(routing.result.elapsedMs)}ms`: 'Smart routing'} · เส้นประ = ย้อนกลับ</span></div>
      </section>
      <aside className="inspector" aria-label="Properties inspector">
        <div className="panel-title"><div><Icon name={selection?.kind==='edge'?'link':selection?.kind==='group'?'group':'panel'}/><b>{selection?.kind==='edge'?'Connection':selection?.kind==='group'?'Visual Group':selectedSet.size>1?`Multi-selection (${selectedSet.size})`:'Properties'}</b></div><button className="icon-button" aria-label="Collapse inspector" title="Collapse inspector" onClick={()=>setInspectorOpen(false)}><Icon name="close" size={16}/></button></div>
        <div className="inspector-sizing"><label>Panel width<input aria-label="Inspector width" type="range" min="300" max="480" step="10" value={inspectorWidth} onChange={e=>setInspectorWidth(Number(e.target.value))}/></label></div>
        <div className="inspector-content" ref={inspectorElement}><fieldset className="inspector-fields" disabled={!!routing.candidate}>
      {selection?.kind==='edge'?<ConnectionInspector index={index} id={selection.id} focus={focusNode} select={selectEdge} clear={clearSelection} remove={deleteSelection} onInsert={edgeId=>startEdgeInsert(edgeId)} overlaps={overlapIds} route={routing.result?.routes.get(selection.id)} legacy={routing.mode==='legacy'&&!routing.candidate}/>:
      selection?.kind==='group'&&selectedGroup?<div className="group-inspector">
        <small>VISUAL GROUP & COMMENT</small>
        <div className="inspector-heading" style={{'--node-accent':GROUP_COLOR_INFO[selectedGroup.color].hex} as React.CSSProperties}><span className="inspector-type-icon"><Icon name="group" size={22}/></span><div><h2>{selectedGroup.title}</h2><span>Non-executable authoring annotation</span></div></div>
        <label>Group title<input aria-label="Group title" value={selectedGroup.title} maxLength={120} onChange={e=>commitState(canvas,updateVisualGroup(presentation,selectedGroup.id,{title:e.target.value}))}/></label>
        <label>Comment / Description<textarea aria-label="Group description" value={selectedGroup.description} maxLength={1024} rows={4} onChange={e=>commitState(canvas,updateVisualGroup(presentation,selectedGroup.id,{description:e.target.value}))}/></label>
        <label>Category color<select aria-label="Group color" value={selectedGroup.color} onChange={e=>commitState(canvas,updateVisualGroup(presentation,selectedGroup.id,{color:e.target.value as GroupColor}))}>{Object.entries(GROUP_COLOR_INFO).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></label>
        <div className="group-dimensions">
          <label>Width<input aria-label="Group width" type="number" min={120} max={4000} step={20} value={selectedGroup.width} onChange={e=>commitState(canvas,updateVisualGroup(presentation,selectedGroup.id,{width:Number(e.target.value)}))}/></label>
          <label>Height<input aria-label="Group height" type="number" min={72} max={4000} step={20} value={selectedGroup.height} onChange={e=>commitState(canvas,updateVisualGroup(presentation,selectedGroup.id,{height:Number(e.target.value)}))}/></label>
        </div>
        <section className="property-section"><h3>GROUPED NODES ({selectedGroup.nodeIds.length})</h3>
          <div className="group-move-controls">
            <button type="button" onClick={()=>{const m=moveVisualGroupWithContents(canvas,presentation,selectedGroup.id,{x:60,y:0});commitState(m.canvas,m.presentation);}}>Move Group Right →</button>
            <button type="button" onClick={()=>{const m=moveVisualGroupWithContents(canvas,presentation,selectedGroup.id,{x:0,y:60});commitState(m.canvas,m.presentation);}}>Move Group Down ↓</button>
          </div>
          <div className="group-node-list">{canvas.nodes.map(n=>{
            const inGroup=selectedGroup.nodeIds.includes(n.id);
            return <label key={n.id} className="group-member-toggle"><input type="checkbox" checked={inGroup} onChange={e=>{
              const nextIds=e.target.checked?[...selectedGroup.nodeIds,n.id]:selectedGroup.nodeIds.filter(id=>id!==n.id);
              commitState(canvas,updateVisualGroup(presentation,selectedGroup.id,{nodeIds:nextIds}));
            }}/><span>{title(n.data.runtime)} · <code>{n.id}</code></span></label>;
          })}</div>
        </section>
        <div className="node-management">
          <button type="button" onClick={()=>commitState(canvas,updateVisualGroup(presentation,selectedGroup.id,{collapsed:!selectedGroup.collapsed}))}>{selectedGroup.collapsed?'Expand group':'Collapse group'}</button>
          <button type="button" className="danger" onClick={deleteSelection}><Icon name="trash" size={16}/>Delete group frame</button>
        </div>
      </div>:
      selectedSet.size>1?<div className="multi-inspector">
        <small>MULTI-SELECTION</small>
        <h2>{selectedSet.size} nodes selected</h2>
        <p className="muted">จัดการหลายโหนดพร้อมกันในคำสั่งเดียว รองรับ Undo/Redo</p>
        <div className="node-management">
          <button type="button" onClick={handleCopy}><Icon name="copy" size={16}/>Copy selected</button>
          <button type="button" onClick={handleCut}><Icon name="cut" size={16}/>Cut selected</button>
          <button type="button" onClick={handleDuplicate}><Icon name="copy" size={16}/>Duplicate selected</button>
          <button type="button" onClick={handleCreateGroup}><Icon name="group" size={16}/>Group selected nodes</button>
          <button type="button" onClick={()=>commitState(moveSelectedNodes(canvas,[...selectedSet],{x:48,y:0}),presentation)}>Move selected right →</button>
          <button type="button" className="danger" onClick={deleteSelection}><Icon name="trash" size={16}/>Delete selected nodes</button>
        </div>
      </div>:
      <><small>NODE INSPECTOR</small>{node?<>
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
        <div className="node-management">
          <button type="button" onClick={()=>void openFindReferences()}><Icon name="search" size={16}/>Find references</button>
          <button type="button" onClick={()=>toggleBreakpoint(node.id)}><Icon name="bug" size={16}/>{debugBreakpoints.includes(node.id)?'Remove breakpoint':'Add breakpoint'}</button>
          <button disabled={node.type==='entry'} onClick={handleDuplicate}><Icon name="copy" size={16}/>Duplicate node</button>
          <button className="danger" disabled={node.id===graph?.entry} onClick={deleteSelection}><Icon name="trash" size={16}/>Delete node</button>
        </div>
      </>:<div className="inspector-empty"><span><Icon name="panel" size={36}/></span><h2>เลือกสิ่งที่ต้องการแก้ไข</h2><p>คลิกโหนดเพื่อแก้บทพูดและตัวเลือก<br/>หรือคลิกเส้นเพื่อตรวจเส้นทาง</p><div><kbd>Ctrl</kbd> + <kbd>K</kbd><p>ค้นหาและข้ามไปยังโหนด</p></div></div>}</>}</fieldset></div>
      <PanelResize label="Resize inspector" value={inspectorWidth} min={300} max={480} onChange={setInspectorWidth} side="right"/>
      </aside>
    </div>
    <footer className="status-bar"><div><span className="session-dot"/><b>Local</b><span>{canvas.nodes.length} nodes</span><span>{canvas.edges.length} connections</span>{presentation.groups.length>0&&<span>{presentation.groups.length} groups</span>}{presentation.bookmarks.length>0&&<span>{presentation.bookmarks.length} bookmarks</span>}<span className="status-separator"/><span>{dirty?'Modified':'Saved'} · draft r{revision}</span><span>Published v{published}</span></div><div><span className={'validation-state '+validation}><Icon name={validation==='invalid'?'warning':validation==='valid'?'check':'condition'} size={14}/>{validation==='valid'?'Validation passed':validation==='invalid'?'Validation failed':'Not validated'}</span><span className="status-separator"/><span>{busy?'Working…':'Ready'}</span><b>{zoom}%</b></div></footer>
    {noticeVisible&&<div className={'toast '+noticeTone} role={noticeTone==='error'?'alert':'status'}><Icon name={noticeTone==='error'?'warning':'check'} size={18}/><span>{message}</span><button className="icon-button" aria-label="Dismiss notification" onClick={()=>setNoticeVisible(false)}><Icon name="close" size={15}/></button></div>}
    {quickOpen&&<DialogFrame label="Quick node creation" contentKey={quickSource?.source} onClose={()=>{setQuickOpen(false);setQuickSource(null);}}>
      <div className="preview-heading"><div><small>{quickSource?`CONNECT FROM ${quickSource.source} (${quickSource.sourceHandle})`:'QUICK NODE CREATION · SPACE'}</small><h2>สร้างโหนดด่วน</h2></div><Icon name="plus" size={24}/></div>
      <input aria-label="Search node types" autoFocus placeholder="ค้นหาโหนด บริการ หรือเงื่อนไข (ภาษาไทย / English)…" value={quickQuery}
        onChange={e=>{setQuickQuery(e.target.value);setQuickActive(0);}}
        onKeyDown={e=>{
          if(e.key==='ArrowDown'){e.preventDefault();setQuickActive(i=>Math.min(quickItems.length-1,i+1));}
          else if(e.key==='ArrowUp'){e.preventDefault();setQuickActive(i=>Math.max(0,i-1));}
          else if(e.key==='Enter'&&quickItems[quickActive]){e.preventDefault();applyQuickPaletteItem(quickItems[quickActive]!);}
        }}/>
      <div className="quick-palette-list" role="listbox" aria-label="Compatible node types">
        {!quickItems.length&&<p className="empty-note">ไม่พบชนิดโหนดที่ตรงกับคำค้นหา</p>}
        {quickItems.map((item,idx)=><button type="button" key={item.id} role="option" aria-selected={idx===quickActive} className="quick-palette-option" onClick={()=>applyQuickPaletteItem(item)}>
          <span style={{color:item.nodeType?nodeColors[item.nodeType]:'#d3b77e'}}><Icon name={item.nodeType??'group'} size={18}/></span>
          <div><b>{item.label}</b><small>{item.subtitle}</small></div>
        </button>)}
      </div>
      <div className="modal-actions"><button onClick={()=>{setQuickOpen(false);setQuickSource(null);}}>Cancel</button></div>
    </DialogFrame>}
    {activeTemplate&&templatePreview&&<DialogFrame label="Graph template preview" contentKey={activeTemplate} onClose={()=>setActiveTemplate(null)}>
      <div className="preview-heading"><div><small>GRAPH TEMPLATE PREVIEW</small><h2>{templatePreview.spec.thaiTitle} · {templatePreview.spec.title}</h2></div><Icon name="template" size={24}/></div>
      <p className="muted">{templatePreview.spec.description}</p>
      {templatePreview.spec.requiresRoute&&<label>Courier Route<select aria-label="Template route" value={templateRouteId} onChange={e=>setTemplateRouteId(e.target.value)}>{(catalog?.routes??[]).map((r:any)=><option key={r.id} value={r.id}>{r.label}</option>)}</select></label>}
      {templatePreview.spec.requiresPermit&&<label>Guild Permit<select aria-label="Template permit" value={templatePermitId} onChange={e=>setTemplatePermitId(e.target.value)}>{(catalog?.permits??[]).map((p:any)=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>}
      <div className="template-preview-summary">
        <h3>NODES TO INSERT ({templatePreview.nodes.length} nodes · {templatePreview.edges.length} connections)</h3>
        <ul>{templatePreview.nodes.map(n=><li key={n.runtime.id}><b>{title(n.runtime)}</b> ({n.runtime.type}) {n.runtime.text?`— "${n.runtime.text}"`:n.runtime.argument?`— [${n.runtime.argument}]`:''}</li>)}</ul>
      </div>
      <div className="modal-actions"><button className="primary" onClick={handleConfirmTemplate}>Insert template</button><button onClick={()=>setActiveTemplate(null)}>Cancel</button></div>
    </DialogFrame>}
    {diagnosticsOpen&&<DialogFrame label="Validation Navigator" contentKey={diagnosticsList.length} onClose={()=>setDiagnosticsOpen(false)}>
      <div className="preview-heading"><div><small>VALIDATION NAVIGATOR · AUTHORITATIVE PRE-PUBLISH DIAGNOSTICS</small><h2>ตรวจสอบความถูกต้องของกราฟ</h2></div><Icon name="warning" size={24}/></div>
      <p className="muted">{diagnosticsList.filter(d=>d.blockingPublish).length} blocking error(s) · {diagnosticsList.filter(d=>d.severity==='warning').length} warning(s) · {diagnosticsList.filter(d=>d.severity==='info').length} notice(s)</p>
      <div className="diagnostics-list" role="list" aria-label="Validation diagnostics">
        {diagnosticsList.map(d=><div key={d.id} role="listitem" className={'diagnostic-item diag-'+d.severity}>
          <div className="diag-header">
            <span className={'diag-badge '+d.severity}>{d.blockingPublish?'ERROR (BLOCKS PUBLISH)':d.severity.toUpperCase()}</span>
            <strong>{d.title}</strong>
            {d.nodeId&&<code>{d.nodeId}</code>}
            {d.nodeId&&index.nodes.has(d.nodeId)&&<button type="button" onClick={()=>{setSelected(d.nodeId!);focusNode(d.nodeId!);setDiagnosticsOpen(false);}}>Focus node {d.nodeId}</button>}
          </div>
          <p>{d.explanation}</p>
          <p className="diag-rec"><b>Recommended fix:</b> {d.recommendation}</p>
        </div>)}
      </div>
      <div className="modal-actions"><button className="primary" onClick={()=>{setDiagnosticsOpen(false);void run(validate);}}>Run Server Validation</button><button onClick={()=>setDiagnosticsOpen(false)}>Close</button></div>
    </DialogFrame>}
    {diffOpen&&<DialogFrame label="Visual Version Diff" contentKey={diffBaseKey+':'+diffTargetKey} onClose={()=>{setDiffOpen(false);setInspectedRemovedNode(null);}}>
      <div className="preview-heading"><div><small>VISUAL VERSION DIFF · STABLE ID COMPARISON</small><h2>เปรียบเทียบเวอร์ชันกราฟ</h2></div><Icon name="diff" size={24}/></div>
      <div className="diff-selectors">
        <label>Base version<select aria-label="Diff base version" value={diffBaseKey} onChange={e=>setDiffBaseKey(e.target.value)}>{Object.entries(availableDiffSnapshots).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></label>
        <label>Target version<select aria-label="Diff target version" value={diffTargetKey} onChange={e=>setDiffTargetKey(e.target.value)}>{Object.entries(availableDiffSnapshots).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></label>
      </div>
      {activeVersionDiff&&<div className="diff-results">
        <p className="diff-summary"><b>Summary:</b> {activeVersionDiff.summaryText}</p>
        {activeVersionDiff.addedNodes.length>0&&<section><h3>ADDED NODES ({activeVersionDiff.addedNodes.length})</h3><ul>{activeVersionDiff.addedNodes.map(n=><li key={n.nodeId}><code>{n.nodeId}</code> ({n.nodeType}) {index.nodes.has(n.nodeId)&&<button type="button" onClick={()=>{setSelected(n.nodeId);focusNode(n.nodeId);setDiffOpen(false);}}>Focus {n.nodeId}</button>}</li>)}</ul></section>}
        {activeVersionDiff.removedNodes.length>0&&<section><h3>REMOVED NODES ({activeVersionDiff.removedNodes.length})</h3><ul>{activeVersionDiff.removedNodes.map(n=><li key={n.nodeId}><code>{n.nodeId}</code> ({n.nodeType}) <button type="button" onClick={()=>setInspectedRemovedNode(n.historicalNode)}>Inspect historical snapshot {n.nodeId}</button></li>)}</ul></section>}
        {inspectedRemovedNode&&<div className="historical-node-inspector" role="region" aria-label="Historical removed node snapshot">
          <h4>Historical Snapshot (Read-Only · Not Reintroduced): <code>{inspectedRemovedNode.id}</code> ({inspectedRemovedNode.type})</h4>
          <p>{inspectedRemovedNode.text?`Dialogue: "${inspectedRemovedNode.text}"`:inspectedRemovedNode.action?`Action: ${inspectedRemovedNode.action} (${inspectedRemovedNode.argument??'none'})`:inspectedRemovedNode.condition?`Condition: ${inspectedRemovedNode.condition}`:'No extra text'}</p>
          <button type="button" onClick={()=>setInspectedRemovedNode(null)}>Close snapshot</button>
        </div>}
        {activeVersionDiff.modifiedNodes.length>0&&<section><h3>MODIFIED NODES ({activeVersionDiff.modifiedNodes.length})</h3><ul>{activeVersionDiff.modifiedNodes.map(m=><li key={m.nodeId}><b>{m.nodeId}</b> ({m.nodeType}): {m.changes.map(c=>`${c.field}: "${c.before}" → "${c.after}"`).join(' | ')} {index.nodes.has(m.nodeId)&&<button type="button" onClick={()=>{setSelected(m.nodeId);focusNode(m.nodeId);setDiffOpen(false);}}>Focus {m.nodeId}</button>}</li>)}</ul></section>}
        {activeVersionDiff.edgeDiffs.length>0&&<section><h3>CONNECTION CHANGES ({activeVersionDiff.edgeDiffs.length})</h3><ul>{activeVersionDiff.edgeDiffs.map(e=><li key={e.edgeId}><code>{e.edgeId}</code> ({e.kind}): {e.beforeTarget??'none'} → {e.afterTarget??'none'}</li>)}</ul></section>}
        {activeVersionDiff.presentationDiffs.length>0&&<section><h3>PRESENTATION & LAYOUT-ONLY CHANGES ({activeVersionDiff.presentationDiffs.length})</h3><ul>{activeVersionDiff.presentationDiffs.map((p,i)=><li key={i}>{p.summary}</li>)}</ul></section>}
      </div>}
      <div className="modal-actions"><button onClick={()=>{setDiffOpen(false);setInspectedRemovedNode(null);}}>Close diff</button></div>
    </DialogFrame>}
    {referencesOpen&&<DialogFrame label="Find References" contentKey={selected} onClose={()=>setReferencesOpen(false)}>
      <div className="preview-heading"><div><small>INDEXED REFERENCE LOOKUP · LOCAL & CROSS-GRAPH</small><h2>ค้นหาการอ้างอิงโหนดและบริการ</h2></div><Icon name="search" size={24}/></div>
      <p className="muted">Target: <code>{selected||'none'}</code> · Found {activeReferences.length} reference(s)</p>
      <div className="references-list" role="list" aria-label="Reference results">
        {!activeReferences.length&&<p className="empty-note">ไม่พบการอ้างอิงเพิ่มเติมสำหรับรายการนี้</p>}
        {activeReferences.map((ref,idx)=><div key={idx} role="listitem" className="reference-item">
          <span className="ref-badge">{ref.scope==='local'?'CURRENT GRAPH':ref.graphId}</span>
          <span>{ref.summary}</span>
          {ref.scope==='local'&&index.nodes.has(ref.nodeId)&&<button type="button" onClick={()=>{setSelected(ref.nodeId);focusNode(ref.nodeId);setReferencesOpen(false);}}>Focus {ref.nodeId}</button>}
        </div>)}
      </div>
      <div className="modal-actions"><button onClick={()=>setReferencesOpen(false)}>Close</button></div>
    </DialogFrame>}
    {bookmarksOpen&&<DialogFrame label="Graph Bookmarks" contentKey={presentation.bookmarks.length} onClose={()=>setBookmarksOpen(false)}>
      <div className="preview-heading"><div><small>NAMED GRAPH BOOKMARKS · PRESENTATION METADATA</small><h2>บุ๊กมาร์กจุดสำคัญบนแคนวาส</h2></div><Icon name="bookmark" size={24}/></div>
      <div className="bookmark-add-row">
        <input aria-label="Bookmark name" placeholder={selected?`Bookmark for ${selected}…`:'Bookmark name…'} value={newBookmarkName} onChange={e=>setNewBookmarkName(e.target.value)}/>
        <button type="button" className="primary" onClick={handleAddBookmark}>Add bookmark</button>
      </div>
      <div className="bookmarks-list" role="list" aria-label="Saved bookmarks">
        {!presentation.bookmarks.length&&<p className="empty-note">ยังไม่มีบุ๊กมาร์กในกราฟนี้</p>}
        {presentation.bookmarks.map(bm=><div key={bm.id} role="listitem" className="bookmark-item">
          <div>
            <strong>{bm.name}</strong>
            <small>{bm.nodeId?`Node: ${bm.nodeId} · `:''}View ({bm.viewport.x}, {bm.viewport.y}) · {Math.round(bm.viewport.zoom*100)}%</small>
          </div>
          <div className="bookmark-actions">
            <button type="button" onClick={()=>{handleJumpBookmark(bm);setBookmarksOpen(false);}}>Jump to {bm.name}</button>
            <button type="button" onClick={()=>{const nextName=prompt('Rename bookmark:',bm.name);if(nextName)commitState(canvas,renameGraphBookmark(presentation,bm.id,nextName));}}>Rename {bm.name}</button>
            <button type="button" className="danger" onClick={()=>commitState(canvas,deleteGraphBookmark(presentation,bm.id))}>Delete {bm.name}</button>
          </div>
        </div>)}
      </div>
      <div className="modal-actions"><button onClick={()=>setBookmarksOpen(false)}>Close</button></div>
    </DialogFrame>}
    {helpOpen&&<DialogFrame label="Keyboard Shortcuts and Help" contentKey="help" onClose={()=>setHelpOpen(false)}>
      <div className="preview-heading"><div><small>EDITOR SHORTCUTS & HELP · F1 / ?</small><h2>คีย์ลัดและคู่มือ Arcane Workbench</h2></div><Icon name="help" size={24}/></div>
      <div className="shortcuts-table-wrap">
        <table className="shortcuts-table" aria-label="Keyboard shortcuts">
          <thead><tr><th>Shortcut</th><th>Category</th><th>Action</th><th>คำอธิบาย</th></tr></thead>
          <tbody>{EDITOR_SHORTCUTS.map(s=><tr key={s.keys}><td><kbd>{s.keys}</kbd></td><td>{s.category}</td><td><b>{s.action}</b></td><td>{s.thaiDescription}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="modal-actions"><button onClick={()=>setHelpOpen(false)}>Close help</button></div>
    </DialogFrame>}
    {preview&&<DialogFrame contentKey={preview.current} onClose={()=>setPreview(null)}><div className="preview-heading"><div><small>READ-ONLY PREVIEW</small><h2>{preview.current.title??'Conversation ended'}</h2></div><Icon name="preview" size={26}/></div>
      <label className="preview-toggle"><input type="checkbox" checked={activeCourier} onChange={event=>{setActiveCourier(event.target.checked);setPreview(null);}}/> Mock active Courier contract</label><p className="preview-dialogue">{preview.current.text}</p>
      <div className="preview-choices">{preview.current.choices?.map((choice:any,i:number)=><button disabled={busy} key={choice.id} onClick={()=>run(()=>showPreview([...previewPath,choice.id]))}><span>{String(i+1).padStart(2,'0')}</span>{choice.text}<Icon name="arrow" size={16}/></button>)}</div>
      <p className="muted">Actions are descriptions only. No player or economy data changes.</p><button onClick={()=>setPreview(null)}>Close preview</button></DialogFrame>}

  </div>;
  function changeCanvas(next:Canvas){record(canvas);setCanvas(next);markDirty();setValidation('unchecked');setPreview(null);}
}
