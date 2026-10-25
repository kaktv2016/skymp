import type {Point,RoutingGraph,RoutedPath,RoutingResult,RoutingNode} from './routing-types';
const CLEAR=12, STEP=24;
const key=(p:Point)=>`${Math.round(p.x*100)/100},${Math.round(p.y*100)/100}`;
const same=(a:Point,b:Point)=>Math.abs(a.x-b.x)<.01&&Math.abs(a.y-b.y)<.01;
const inside=(p:Point,n:RoutingNode,pad=CLEAR)=>p.x>n.x-pad&&p.x<n.x+n.width+pad&&p.y>n.y-pad&&p.y<n.y+n.height+pad;
function blocked(a:Point,b:Point,nodes:RoutingNode[],source:string,target:string,clearance=CLEAR){if(a.x!==b.x&&a.y!==b.y)return true;return nodes.some(n=>{const pad=n.id===source||n.id===target?0:clearance;return a.x===b.x? a.x>n.x-pad&&a.x<n.x+n.width+pad&&Math.max(a.y,b.y)>n.y-pad&&Math.min(a.y,b.y)<n.y+n.height+pad : a.y>n.y-pad&&a.y<n.y+n.height+pad&&Math.max(a.x,b.x)>n.x-pad&&Math.min(a.x,b.x)<n.x+n.width+pad;});}
function compress(ps:Point[]){const out:Point[]=[];for(const p of ps){if(out.length&&same(out[out.length-1],p))continue;while(out.length>1){const a=out[out.length-2],b=out[out.length-1];if((a.x===b.x&&b.x===p.x)||(a.y===b.y&&b.y===p.y))out.pop();else break;}out.push(p);}return out;}
const pathLength=(ps:Point[])=>ps.slice(1).reduce((sum,p,i)=>sum+Math.abs(p.x-ps[i].x)+Math.abs(p.y-ps[i].y),0);
interface Lane {exit:number;enter:number;rank:number;count:number;dock:number;trackY?:number;}
/** View-only lanes fit the available corridor; never move cards to make room. */
function allocateLanes(g:RoutingGraph):Map<string,Lane>{
 const lanes=new Map<string,Lane>();
 // Preserve B1's bounded corridor policy on stress drafts; packed ports cannot
 // support thousands of distinct full-width lanes without severe regressions.
 if(g.edges.length>256)return lanes;
 const groups=new Map<string,RoutingGraph['edges']>(),nodes=new Map(g.nodes.map(n=>[n.id,n]));
 for(const e of g.edges){const back=e.end.x<=e.start.x,key=(back?'return:':'out:')+(back?e.target:e.source),list=groups.get(key)??[];list.push(e);groups.set(key,list);}
 const step=(span:number,count:number)=>count>1?Math.min(10,Math.max(0,(span-24)/(count-1))):0;
 for(const [group,edges]of groups){const back=group.startsWith('return:');
  const docks=new Map<string,number>();for(const side of [-1,1]){const list=edges.filter(e=>(e.start.y<e.end.y?-1:1)===side).sort((a,b)=>Math.abs(a.start.y-a.end.y)-Math.abs(b.start.y-b.end.y)||a.id.localeCompare(b.id));list.forEach((e,i)=>docks.set(e.id,side*(list.length-i)*4));}
  const ordered=[...edges].sort((a,b)=>back?Math.abs(a.start.y-a.end.y)-Math.abs(b.start.y-b.end.y)||a.start.y-b.start.y||a.id.localeCompare(b.id):(a.end.y<a.start.y?0:1)-(b.end.y<b.start.y?0:1)||(a.end.y<a.start.y?a.order-b.order:b.order-a.order)||a.id.localeCompare(b.id));
  const span=back?0:Math.min(...edges.map(e=>e.end.x-e.start.x));
  ordered.forEach((e,rank)=>{if(!back){lanes.set(e.id,{exit:e.start.x+Math.min(12,span/3)+rank*step(span,edges.length),enter:e.end.x-12,rank,count:edges.length,dock:docks.get(e.id)!});return;}
   const target=nodes.get(e.target),west=g.nodes.filter(n=>n.id!==e.target&&n.x+n.width<e.end.x&&target&&n.y<target.y+target.height&&n.y+n.height>target.y),westLimit=west.length?Math.max(...west.map(n=>n.x+n.width+12)):e.end.x-140;
   const east=g.nodes.filter(n=>n.id!==e.source&&n.x>e.start.x),eastLimit=east.length?Math.min(...east.map(n=>n.x-12)):e.start.x+140;
   lanes.set(e.id,{exit:e.start.x+12+rank*step(eastLimit-e.start.x,edges.length),enter:e.end.x-12-rank*step(e.end.x-westLimit,edges.length),rank,count:edges.length,dock:docks.get(e.id)!});
  });
  if(back&&g.edges.length<=256){
   const minX=Math.min(...edges.map(e=>lanes.get(e.id)!.enter)),maxX=Math.max(...edges.map(e=>lanes.get(e.id)!.exit));
   const top=Math.min(...g.nodes.map(n=>n.y))-6,bottom=Math.max(...g.nodes.map(n=>n.y+n.height))+6;
   const ys=[...new Set([...g.nodes.flatMap(n=>[n.y-6,n.y+n.height+6]),...Array.from({length:edges.length+1},(_,i)=>top-i*12),...Array.from({length:edges.length+1},(_,i)=>bottom+i*12)])].filter(y=>!blocked({x:minX,y},{x:maxX,y},g.nodes,'','',6));
   for(const side of [-1,1]){let previous:number|undefined;for(const e of ordered.filter(e=>(e.start.y<e.end.y?-1:1)===side)){const source=nodes.get(e.source),target=nodes.get(e.target);if(!source||!target)continue;const bound=side<0?Math.min(source.y,target.y)-6:Math.max(source.y+source.height,target.y+target.height)+6;const row=ys.filter(y=>side<0?y<=bound&&(previous===undefined||y<=previous-12):y>=bound&&(previous===undefined||y>=previous+12)).sort((a,b)=>side<0?b-a:a-b)[0];if(row!==undefined){lanes.get(e.id)!.trackY=row;previous=row;}}}
  }
 }
 return lanes;
}
function route(edge:RoutingGraph['edges'][number],g:RoutingGraph,returnLane=0,lane?:Lane,clearance=CLEAR):Point[]|null{
 const s=edge.start,t=edge.end; if(!Number.isFinite(s.x+s.y+t.x+t.y))return null;
 const blockers=g.nodes.filter(n=>inside(s,n,0)||inside(t,n,0));if(blockers.length)return null;
 // Exit each output on a deterministic short lane; returns use distinct outer
 // corridors. Every candidate is checked against all card interiors/clearances.
 const back=t.x<=s.x,exit=lane?.exit??s.x+clearance+edge.order*3+(back?returnLane*3:0),enter=lane?.enter??t.x-clearance-(back?returnLane*5:0);
 const endpoints=g.nodes.filter(n=>n.id===edge.source||n.id===edge.target),minY=Math.min(s.y,t.y,...endpoints.map(n=>n.y)),maxY=Math.max(s.y,t.y,...endpoints.map(n=>n.y+n.height));
 const envelope=g.nodes.filter(n=>n.x+n.width>=Math.min(s.x,t.x)&&n.x<=Math.max(s.x,t.x)&&n.y<maxY&&n.y+n.height>minY);
 const top=Math.min(minY,...envelope.map(n=>n.y))-clearance*3-returnLane*8;
 const bottom=Math.max(maxY,...envelope.map(n=>n.y+n.height))+clearance*3+returnLane*8;
 const outer=[top,bottom,...(g.edges.length<=256?[Math.min(...g.nodes.map(n=>n.y))-clearance*3-returnLane*8,Math.max(...g.nodes.map(n=>n.y+n.height))+clearance*3+returnLane*8]:[])].sort((a,b)=>Math.abs(s.y-a)+Math.abs(t.y-a)-Math.abs(s.y-b)-Math.abs(t.y-b));
 const dockY=t.y+(lane?.dock??0),dockX=t.x-6;
 const returnPath=(y:number):Point[]=>g.edges.length>256?[s,{x:exit,y:s.y},{x:exit,y},{x:enter,y},{x:enter,y:t.y},t]:[s,{x:exit,y:s.y},{x:exit,y},{x:enter,y},{x:enter,y:dockY},{x:dockX,y:dockY},{x:dockX,y:t.y},t];
 const candidates:Point[][]=back?(lane?.trackY===undefined?outer.map(returnPath):[returnPath(lane.trackY)]):[];
 if(!back)candidates.push([s,{x:exit,y:s.y},{x:exit,y:t.y},t],[s,{x:enter,y:s.y},{x:enter,y:t.y},t]);
 const lo=minY-clearance,hi=maxY+clearance;
 if(!(back&&lane?.trackY!==undefined))for(const n of g.nodes){for(const y of [n.y-clearance-edge.order*2-returnLane*2,n.y+n.height+clearance+edge.order*2+returnLane*2,...(g.edges.length<=256?[n.y-clearance,n.y+n.height+clearance]:[])])if(y>=lo-240&&y<=hi+240)candidates.push(back?returnPath(y):[s,{x:exit,y:s.y},{x:exit,y},{x:enter,y},{x:enter,y:t.y},t]);}
 const cost=(ps:Point[])=>ps.slice(1).reduce((sum,p,i)=>sum+Math.abs(p.x-ps[i].x)+Math.abs(p.y-ps[i].y),0);candidates.sort((a,b)=>cost(a)-cost(b));
 for(const ps of candidates){const path=compress(ps);if(path.slice(1).every((p,i)=>!blocked(path[i],p,g.nodes,edge.source,edge.target,clearance)))return path;}
 if(back&&lane?.trackY!==undefined)return null;
 // Bound pathological dense drafts: retain obvious corridors and report the rest as fallback.
 if(g.edges.length>256)return null;
 const xs=new Set<number>([s.x,t.x]),ys=new Set<number>([s.y,t.y]); for(const n of g.nodes){xs.add(n.x-clearance);xs.add(n.x+n.width+clearance);ys.add(n.y-clearance);ys.add(n.y+n.height+clearance);}
 // Endpoint-adjacent corridors and modest regular channels keep the visibility graph bounded.
 const loX=Math.min(s.x,t.x)-160,hiX=Math.max(s.x,t.x)+160,loY=Math.min(s.y,t.y)-160,hiY=Math.max(s.y,t.y)+160;
 for(let x=Math.ceil(loX/STEP)*STEP;x<=hiX;x+=STEP)xs.add(x);for(let y=Math.ceil(loY/STEP)*STEP;y<=hiY;y+=STEP)ys.add(y);
 const xa=[...xs].filter(Number.isFinite).sort((a,b)=>a-b),ya=[...ys].filter(Number.isFinite).sort((a,b)=>a-b);if(xa.length*ya.length>22000)return null;
 const points=new Map<string,Point>(); for(const x of xa)for(const y of ya){const p={x,y};if((same(p,s)||same(p,t))||!g.nodes.some(n=>inside(p,n,clearance)))points.set(key(p),p);}
 points.set(key(s),s);points.set(key(t),t);
 const adj=new Map<string,{k:string;d:number;turn:number}[]>(); const add=(a:Point,b:Point)=>{if(blocked(a,b,g.nodes,edge.source,edge.target,clearance))return;let ak=key(a),bk=key(b);let aa=adj.get(ak)||[];aa.push({k:bk,d:Math.abs(a.x-b.x)+Math.abs(a.y-b.y),turn:0});adj.set(ak,aa);};
 const byX=new Map<number,Point[]>(),byY=new Map<number,Point[]>();for(const p of points.values()){(byX.get(p.x)|| (byX.set(p.x,[]),byX.get(p.x)!)).push(p);(byY.get(p.y)|| (byY.set(p.y,[]),byY.get(p.y)!)).push(p);} for(const arr of byX.values()){arr.sort((a,b)=>a.y-b.y);for(let i=1;i<arr.length;i++){add(arr[i-1],arr[i]);add(arr[i],arr[i-1]);}}for(const arr of byY.values()){arr.sort((a,b)=>a.x-b.x);for(let i=1;i<arr.length;i++){add(arr[i-1],arr[i]);add(arr[i],arr[i-1]);}}
 // Dijkstra with a bend penalty; deterministic lexical tie break.
 type Q={k:string;dir:number;cost:number};const start=key(s),goal=key(t),dist=new Map<string,number>(),prev=new Map<string,string>();const q:Q[]=[{k:start,dir:0,cost:0}];dist.set(`${start}|0`,0);let found='';while(q.length){q.sort((a,b)=>a.cost-b.cost||a.k.localeCompare(b.k)||a.dir-b.dir);const cur=q.shift()!;if(cur.cost!==dist.get(`${cur.k}|${cur.dir}`))continue;if(cur.k===goal){found=`${cur.k}|${cur.dir}`;break;}const p=points.get(cur.k)!;for(const e of adj.get(cur.k)||[]){const v=points.get(e.k)!,dir=p.x===v.x?1:2,c=cur.cost+e.d+(cur.dir&&cur.dir!==dir?18:0),state=`${e.k}|${dir}`;if(c<(dist.get(state)??Infinity)){dist.set(state,c);prev.set(state,`${cur.k}|${cur.dir}`);q.push({k:e.k,dir,cost:c});}}}if(!found)return null;const path:string[]=[];for(let state=found;state;){const split=state.lastIndexOf('|');path.push(state.slice(0,split));state=prev.get(state)||'';}return compress(path.reverse().map(k=>points.get(k)!));
}
export function routeSmart(graph:RoutingGraph,previous?:{graph:RoutingGraph;result:RoutingResult}):RoutingResult{const started=performance.now(),routes=new Map<string,RoutedPath>(),warnings:string[]=[];const lanes=allocateLanes(graph),oldLanes=previous?allocateLanes(previous.graph):new Map<string,Lane>(),nodesById=new Map(graph.nodes.map(n=>[n.id,n])),oldEdges=new Map(previous?.graph.edges.map(e=>[e.id,e])||[]),oldNodes=new Map(previous?.graph.nodes.map(n=>[n.id,n])||[]);let recomputed=0,reused=0,returnOrdinal=0;const validNode=(n:RoutingNode)=>[n.x,n.y,n.width,n.height].every(Number.isFinite)&&n.width>=0&&n.height>=0;const valid=graph.nodes.every(validNode)&&new Set(graph.nodes.map(n=>n.id)).size===graph.nodes.length;
 for(const edge of graph.edges){const source=nodesById.get(edge.source),target=nodesById.get(edge.target);let returning=!!source&&!!target&&(target.x<source.x||edge.end.x<edge.start.x);const returnLane=returning?(lanes.get(edge.id)?.rank??returnOrdinal++)%32:0;const prior=previous?.result.routes.get(edge.id),oldEdge=oldEdges.get(edge.id),lane=lanes.get(edge.id),oldLane=oldLanes.get(edge.id);const laneSame=lane?.exit===oldLane?.exit&&lane?.enter===oldLane?.enter&&lane?.rank===oldLane?.rank&&lane?.count===oldLane?.count&&lane?.dock===oldLane?.dock&&lane?.trackY===oldLane?.trackY;let reusable=valid&&laneSame&&prior?.status==='clean'&&oldEdge&&oldEdge.source===edge.source&&oldEdge.target===edge.target&&oldEdge.sourceHandle===edge.sourceHandle&&same(oldEdge.start,edge.start)&&same(oldEdge.end,edge.end)&&oldEdge.order===edge.order;
 if(reusable&&prior){for(const n of graph.nodes){const old=oldNodes.get(n.id);if((!old||old.x!==n.x||old.y!==n.y||old.width!==n.width||old.height!==n.height)&&prior.points.some((p,i)=>i>0&&segmentBox(prior.points[i-1],p,n,CLEAR))){reusable=false;break;}}}
 if(reusable){routes.set(edge.id,{...prior!,points:prior!.points.map(p=>({...p}))});reused++;continue;}recomputed++;
 let points:Point[]|null=null,clearance=CLEAR;if(valid&&source&&target&&edge.id&&edge.start&&edge.end&&Number.isFinite(edge.start.x+edge.start.y+edge.end.x+edge.end.y)){points=route(edge,graph,returnLane,lanes.get(edge.id),CLEAR);
 const length=(ps:Point[])=>ps.slice(1).reduce((sum,p,i)=>sum+Math.abs(p.x-ps[i].x)+Math.abs(p.y-ps[i].y),0),direct=Math.abs(edge.end.x-edge.start.x)+Math.abs(edge.end.y-edge.start.y);
 if(graph.edges.length<=256&&(!points||length(points)>direct+300)){const narrow=route(edge,graph,returnLane,lanes.get(edge.id),6);if(narrow&&(!points||length(narrow)+24<length(points))){points=narrow;clearance=6;}}
 }
 if(!points){warnings.push(`Edge ${edge.id||'(unknown)'} could not be routed cleanly`);points=[edge.start,edge.end].filter(p=>p&&Number.isFinite(p.x+p.y));if(!points.length)points=[{x:0,y:0}];routes.set(edge.id,{id:edge.id,points,returning,status:'fallback',origin:'smart',reason:'invalid geometry or no obstacle-free corridor'});}else routes.set(edge.id,{id:edge.id,points,returning,status:'clean',origin:'smart',...(clearance===6?{reason:'Uses a narrow 6px corridor'}:{})});
 }return{routes,warnings,elapsedMs:performance.now()-started,recomputed,reused};}
function segmentBox(a:Point,b:Point,n:RoutingNode,pad:number){return a.x===b.x?a.x>n.x-pad&&a.x<n.x+n.width+pad&&Math.max(a.y,b.y)>n.y-pad&&Math.min(a.y,b.y)<n.y+n.height+pad:a.y>n.y-pad&&a.y<n.y+n.height+pad&&Math.max(a.x,b.x)>n.x-pad&&Math.min(a.x,b.x)<n.x+n.width+pad;}
