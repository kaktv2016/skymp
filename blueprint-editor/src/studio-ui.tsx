import React,{useEffect,useRef} from 'react';

const paths:Record<string,string>={
 entry:'M5 12h14m-6-6 6 6-6 6',npc:'M4 4h16v12H9l-5 4V4Zm4 5h8m-8 3h5',
 choices:'M5 12h6m0 0V5h8m-8 7v7h8',condition:'m12 3 9 9-9 9-9-9 9-9Z',
 action:'m14 4 6 6-9 9H5v-6l9-9Zm-7 9 4 4',end:'M6 6h12v12H6z',
 save:'M5 3h12l4 4v14H3V3h2Zm2 0v6h10V3M7 21v-8h10v8',undo:'m8 5-5 5 5 5M3 10h10a7 7 0 0 1 7 7',redo:'m16 5 5 5-5 5m5-5H11a7 7 0 0 0-7 7',
 check:'m5 12 4 4L19 6',preview:'M3 12s3-7 9-7 9 7 9 7-3 7-9 7-9-7-9-7Zm6 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
 publish:'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',search:'M10 3a7 7 0 1 0 0 14 7 7 0 1 0 0-14Zm5 12 6 6',
 library:'M3 4h5v16H3V4Zm8 0h4v16h-4V4Zm7 0 4 15',panel:'M3 4h18v16H3V4Zm11 0v16',
 focus:'M3 8V3h5m8 0h5v5m0 8v5h-5M8 21H3v-5m6-4a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
 fit:'M9 3H3v6m12-6h6v6m0 6v6h-6M3 15v6h6',back:'m10 5-7 7 7 7M3 12h18',
 arrange:'M3 3h6v6H3V3Zm12 0h6v6h-6V3ZM9 15h6v6H9v-6ZM6 9v3h12V9m-6 3v3',
 plus:'M12 5v14M5 12h14',close:'m6 6 12 12M6 18 18 6',history:'M4 4v6h6M4 10a8 8 0 1 1 1 9m7-13v6l4 2',
 user:'M8 7a4 4 0 1 0 8 0 4 4 0 1 0-8 0ZM4 21v-3a8 8 0 0 1 16 0v3',
 link:'m10 8 2-2a5 5 0 0 1 7 7l-2 2m-3 1-2 2a5 5 0 0 1-7-7l2-2m1 7 8-8',
 map:'m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16',arrow:'M4 12h16m-6-6 6 6-6 6',
 warning:'m12 3 10 18H2L12 3Zm0 6v5m0 3v1',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
 copy:'M9 9h12v12H9V9ZM15 6V3H3v12h3',logout:'M10 3H3v18h7m4-15 6 6-6 6m-7-6h13'
};
export function Icon({name,size=18}:{name:string;size?:number}){return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]??paths.condition}/></svg>;}

export function PanelResize({label,value,min,max,onChange,side}:{label:string;value:number;min:number;max:number;onChange:(n:number)=>void;side:'left'|'right'}){
 const start=useRef<{x:number;width:number}|null>(null);
 const clamp=(n:number)=>Math.max(min,Math.min(max,n));
 return <div className={'panel-resize '+side} role="separator" tabIndex={0} aria-label={label} aria-orientation="vertical" aria-valuenow={value} aria-valuemin={min} aria-valuemax={max}
  onPointerDown={e=>{e.preventDefault();start.current={x:e.clientX,width:value};e.currentTarget.setPointerCapture(e.pointerId);}}
  onPointerMove={e=>{if(start.current)onChange(clamp(start.current.width+(e.clientX-start.current.x)*(side==='left'?1:-1)));}}
  onPointerUp={e=>{start.current=null;e.currentTarget.releasePointerCapture(e.pointerId);}} onLostPointerCapture={()=>{start.current=null;}}
  onKeyDown={e=>{const next=e.key==='Home'?min:e.key==='End'?max:e.key==='ArrowLeft'?value-10:e.key==='ArrowRight'?value+10:null;if(next!==null){e.preventDefault();onChange(clamp(next));}}}><span/></div>;
}

export function DialogFrame({children,onClose,contentKey}:{children:React.ReactNode;onClose:()=>void;contentKey:unknown}){
 const root=useRef<HTMLElement>(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{const before=document.activeElement as HTMLElement|null;root.current?.focus();const listener=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();close.current();}if(e.key!=='Tab')return;const items=[...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,textarea,[tabindex="0"]')??[])];const first=items[0],last=items.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===root.current)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===root.current)){e.preventDefault();first?.focus();}};root.current?.addEventListener('keydown',listener);return()=>{root.current?.removeEventListener('keydown',listener);before?.focus();};},[]);
 useEffect(()=>{if(root.current&&!root.current.contains(document.activeElement))root.current.focus();},[contentKey]);
 return <div className="modal"><section ref={root} role="dialog" aria-modal="true" aria-label="Read-only dialogue preview" tabIndex={-1}>{children}</section></div>;
}
