import type {Point,RoutedPath} from './routing-types';
const cache=new WeakMap<RoutedPath,{path:string;x:number;y:number}>();
export function polylineData(points:Point[]){
 const path=points.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ');let length=0;for(let i=1;i<points.length;i++)length+=Math.hypot(points[i]!.x-points[i-1]!.x,points[i]!.y-points[i-1]!.y);
 let remaining=length/2,mid=points[0]??{x:0,y:0};for(let i=1;i<points.length;i++){const a=points[i-1]!,b=points[i]!,d=Math.hypot(b.x-a.x,b.y-a.y);if(remaining<=d&&d){mid={x:a.x+(b.x-a.x)*remaining/d,y:a.y+(b.y-a.y)*remaining/d};break;}remaining-=d;}
 return {path,x:mid.x,y:mid.y};
}
export function attachedRoute(route:RoutedPath|undefined,start:Point,end:Point){
 if(route&&Math.abs(route.points[0]!.x-start.x)<.01&&Math.abs(route.points[0]!.y-start.y)<.01&&Math.abs(route.points.at(-1)!.x-end.x)<.01&&Math.abs(route.points.at(-1)!.y-end.y)<.01){let value=cache.get(route);if(!value){value=polylineData(route.points);cache.set(route,value);}return {...value,pending:false};}
 // Cheap, explicitly temporary attachment during dragging/pending routing.
 // The settled obstacle router is never recomputed from pointer movement.
 const sx=start.x+18,tx=end.x-18,y=(start.y+end.y)/2;
 return {...polylineData([start,{x:sx,y:start.y},{x:sx,y},{x:tx,y},{x:tx,y:end.y},end]),pending:true};
}
