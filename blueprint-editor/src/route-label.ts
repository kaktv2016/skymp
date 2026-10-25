import type {Point} from './routing-types';
type Box={x:number;y:number;width:number;height:number};
/** Conservative bounds exceed the 180x64 label; 24px node padding includes ports. */
export function clearLabelAt(p:Point,nodes:Box[]){const left=p.x-100,right=p.x+100,top=p.y-86,bottom=p.y;return nodes.every(n=>right<=n.x-24||left>=n.x+n.width+24||bottom<=n.y-24||top>=n.y+n.height+24);}
export function safeLabelPosition(points:Point[],nodes:Box[]):Point|undefined{
 const segments=points.slice(1).map((b,i)=>({a:points[i],b,length:Math.hypot(b.x-points[i].x,b.y-points[i].y)})).filter(s=>s.length>=160).sort((a,b)=>(b.a.y===b.b.y?200:0)+b.length-((a.a.y===a.b.y?200:0)+a.length));
 for(const s of segments)for(const t of [.5,1/3,2/3]){const p={x:s.a.x+(s.b.x-s.a.x)*t,y:s.a.y+(s.b.y-s.a.y)*t};if(clearLabelAt(p,nodes))return p;}
 return undefined;
}
