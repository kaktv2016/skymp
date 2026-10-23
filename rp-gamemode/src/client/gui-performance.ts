/** Standalone opt-in CEF diagnostics. Event-to-rAF is a proxy, not displayed latency. */
export function guiPerformanceBrowser(){
 const w=window as any;if(w.__fvGuiProfile)return;
 const names=['raf_interval','mouse_to_raf_proxy','click_to_response','longtask'];
 let samples:number[][]=names.map(()=>[]),counts=names.map(()=>0),totals=names.map(()=>0),last=0,mouse=0,click=0,scenario='baseline',disposed=false;
 function add(i:number,n:number){counts[i]=(counts[i]??0)+1;totals[i]=(totals[i]??0)+n;const a=samples[i]!;a[(counts[i]!-1)%2048]=n;}
 const move=()=>{if(!mouse)mouse=performance.now();};const press=()=>{if(!click)click=performance.now();};
 document.addEventListener('mousemove',move,true);document.addEventListener('click',press,true);
 let observer:any;try{observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())add(3,entry.duration);});observer.observe({entryTypes:['longtask']});}catch{}
 let frame=0;function tick(now:number){if(disposed)return;if(last)add(0,now-last);last=now;if(mouse){add(1,performance.now()-mouse);mouse=0;}frame=requestAnimationFrame(tick);}frame=requestAnimationFrame(tick);
 const timer=setInterval(()=>{const metrics=names.map((name,i)=>{const a=samples[i]!.slice().sort((x,y)=>x-y),n=a.length;return{name,count:counts[i],avgMs:counts[i]?totals[i]!/counts[i]!:null,p95Ms:n?a[Math.floor((n-1)*.95)]:null,p99Ms:n?a[Math.floor((n-1)*.99)]:null};});w.skyrimPlatform.sendMessage('fv-gui-profile',JSON.stringify({scenario,metrics}));samples=names.map(()=>[]);counts=names.map(()=>0);totals=names.map(()=>0);},5000);
 w.__fvGuiProfile={scenario(value:string){if(value!==scenario){scenario=value;last=0;mouse=0;click=0;samples=names.map(()=>[]);counts=names.map(()=>0);totals=names.map(()=>0);}},response(){if(click){add(2,performance.now()-click);click=0;}},dispose(){disposed=true;clearInterval(timer);cancelAnimationFrame(frame);observer?.disconnect();document.removeEventListener('mousemove',move,true);document.removeEventListener('click',press,true);delete w.__fvGuiProfile;}};
}
