import React from 'react';
import {BaseEdge,EdgeLabelRenderer,getSmoothStepPath,getBezierPath,type EdgeProps} from '@xyflow/react';
import {connection,title,nodeInfo,actionLabels,conditionLabels,type GraphIndex} from './inspection';
import {Icon} from './studio-ui';
import {attachedRoute} from './route-svg';
import {safeLabelPosition,clearLabelAt} from './route-label';
import type {RoutedPath,RoutingNode} from './routing-types';

export const ConnectionEdge=React.memo(function ConnectionEdge(props:EdgeProps){
 const lane=Number(props.data?.lane??0);
 const route=props.data?.route as RoutedPath|undefined;
 const smart=!!props.data?.smart,returning=smart&&route?route.returning:props.targetX<=props.sourceX;
 const legacy=returning?getBezierPath({...props,curvature:.25+lane*.025}):getSmoothStepPath({...props,borderRadius:12,offset:28+lane*9,stepPosition:.25+(lane%6)*.09});
 const routed=React.useMemo(()=>smart?attachedRoute(route,{x:props.sourceX,y:props.sourceY},{x:props.targetX,y:props.targetY}):null,[smart,route,props.sourceX,props.sourceY,props.targetX,props.targetY]);
 const [path,x,y]=routed?[routed.path,routed.x,routed.y]:legacy;
 const wantsLabel=props.selected||!!props.data?.spotlight,obstacles=(props.data?.labelObstacles??[]) as RoutingNode[];
 const label=React.useMemo(()=>wantsLabel?(smart?(routed?.pending?undefined:safeLabelPosition(route?.points??[],obstacles)):(clearLabelAt({x,y},obstacles)?{x,y}:undefined)):undefined,[wantsLabel,smart,routed?.pending,route?.points,x,y,obstacles]);
 return <g data-routing={smart?(routed?.pending?'pending':route?.origin??'pending'):'legacy'} data-route-status={route?.status} data-returning={returning?'true':'false'}><title>{String(props.data?.meaning??'Connection')}</title><BaseEdge path={path} markerEnd={props.markerEnd} style={{...props.style,strokeDasharray:returning?'6 5':undefined,opacity:returning&&!props.data?.active?0.7:1}} interactionWidth={26}/>
 {label&&<EdgeLabelRenderer><div className={'edge-label nodrag nopan '+(props.data?.spotlight?'spotlight-label':'')} style={{transform:`translate(-50%,-100%) translate(${label.x}px,${label.y}px)`}}><span>{props.data?.spotlight?'ACTIVE PATH':'SELECTED CONNECTION'}</span><b>{String(props.data?.shortLabel??'Selected connection')}</b></div></EdgeLabelRenderer>}</g>;
});

export function ConnectionInspector({index,id,focus,select,clear,remove,onInsert,overlaps=[],route,legacy}:{index:GraphIndex;id:string;focus:(id:string)=>void;select:(id:string)=>void;clear:()=>void;remove:()=>void;onInsert?:(edgeId:string)=>void;overlaps?:string[];route?:RoutedPath;legacy?:boolean}){
 const edge=index.edges.get(id);if(!edge)return null;
 const detail=connection(index,edge);
 const siblings=[...index.edges.values()].filter(e=>e.id!==id&&(e.source===edge.source||e.target===edge.target));
 return <div className="connection-inspector"><small>CONNECTION INSPECTOR</small><h2>เส้นทางเชื่อมต่อ</h2><p className={detail.issues.length?'connection-invalid':'connection-valid'} role="status"><Icon name={detail.issues.length?'warning':'check'} size={15}/>{detail.issues.length?detail.issues.join(' · '):'✓ Valid connection'}</p>
 <div className="endpoint-navigation"><button disabled={!detail.source} onClick={()=>focus(edge.source)}>Focus Source</button><button disabled={!detail.target} onClick={()=>focus(edge.target)}>Focus Target</button></div>{overlaps.length>1&&<details open className="overlap-options"><summary>Overlapping connections ({overlaps.length}) · คลิกจุดเดิมเพื่อสลับเส้น</summary>{overlaps.filter(key=>index.edges.has(key)).map(key=><button key={key} data-overlap-edge={key} aria-pressed={key===id} onClick={()=>select(key)}>{connection(index,index.edges.get(key)!).meaning}</button>)}</details>}<section><h3>Source · ต้นทาง</h3><b>{detail.source?title(detail.source):'Missing source'}</b><dl><dt>Type</dt><dd>{detail.source?.type??'unknown'}</dd><dt>Stable ID</dt><dd>{edge.source}</dd><dt>Output handle</dt><dd>{edge.sourceHandle??'(missing)'}</dd><dt>Choice / output</dt><dd>{detail.choiceNumber?`#${detail.choiceNumber} · `:''}{detail.output}</dd></dl></section>
 <div className="connection-direction"><Icon name="arrow" size={17}/><span>{detail.choiceNumber?'Choice '+detail.choiceNumber:'Continue'}</span></div><section><h3>Target · ปลายทาง</h3><b>{detail.target?title(detail.target):'Missing target'}</b><dl><dt>Type</dt><dd>{detail.target?.type??'unknown'}</dd><dt>Stable ID</dt><dd>{edge.target}</dd><dt>Input handle</dt><dd>{detail.input}</dd></dl></section>
 <p className="route-quality">{legacy?'Legacy curves':route?`${route.origin==='elk'?'ELK layered':'Smart fixed positions'} · ${route.returning?'backward visual route · ':''}${route.status}${route.reason?' — '+route.reason:''}`:'Routing pending…'}</p><h3>ความหมาย</h3><p className="connection-meaning">{detail.meaning}</p>
 {[detail.source,detail.target].filter(n=>n?.action||n?.condition).map((n,i)=><p key={i} className="muted">{nodeInfo[n!.type].label}: {n!.action?actionLabels[n!.action]:conditionLabels[n!.condition??'']} {n!.argument&&<code>{n!.argument}</code>}</p>)}
 <div className="inspector-actions">{onInsert&&<button onClick={()=>onInsert(id)}><Icon name="plus" size={14}/>Insert node on connection</button>}<button onClick={()=>select(id)}>Highlight Connection</button><button onClick={clear}>Clear Selection</button><button className="danger" onClick={remove}>Delete connection</button></div>
 {siblings.length>0&&<details><summary>เส้นใกล้เคียง / ร่วมปลายทาง ({siblings.length})</summary><div className="connection-alternatives">{siblings.map(e=><button key={e.id} onClick={()=>select(e.id)}>{connection(index,e).meaning}</button>)}</div></details>}
 </div>;
}
