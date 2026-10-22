/** Executed inside the existing RP browser page. Text always enters via textContent. */
export function dialogueBrowser(payload:any){
 const w=window as any;let root=document.getElementById('fv-dialogue');if(root)root.remove();
 if(payload.closed){if(w.__fvDialogueKey)document.removeEventListener('keydown',w.__fvDialogueKey,true);delete w.__fvDialogueKey;return;}
 root=document.createElement('section');root.id='fv-dialogue';root.style.cssText='position:fixed;inset:12% 18%;overflow:auto;padding:24px;background:#111c20f5;border:1px solid #d7ad55;color:#fff1cf;z-index:12000;font:18px Tahoma;pointer-events:auto';
 const title=document.createElement('h2');title.textContent=payload.title;root.appendChild(title);
 const text=document.createElement('p');text.textContent=payload.text;text.style.whiteSpace='pre-wrap';root.appendChild(text);
 let pending=false;function send(op:string,choice?:string){if(pending&&op!=='cancel')return;pending=true;root!.querySelectorAll('button').forEach((b:any)=>b.disabled=true);w.skyrimPlatform.sendMessage('fv-dialogue',JSON.stringify(op==='cancel'?{op,token:payload.token}:{op,token:payload.token,node:payload.node,choice}));}
 const buttons:HTMLButtonElement[]=[];payload.choices.forEach((c:any,i:number)=>{const b=document.createElement('button');b.textContent=(i+1)+'. '+c.text;b.style.cssText='display:block;width:100%;text-align:left;padding:10px;margin:6px 0;background:#293b3e;color:#ffe7ae;border:1px solid #ab8c53;font:inherit;cursor:pointer';b.onclick=()=>send('choose',c.id);root!.appendChild(b);buttons.push(b);});
 const exit=document.createElement('button');exit.textContent='ปิด / ESC';exit.onclick=()=>send('cancel');root.appendChild(exit);buttons.push(exit);document.body.appendChild(root);buttons[0]?.focus();
 if(w.__fvDialogueKey)document.removeEventListener('keydown',w.__fvDialogueKey,true);
 w.__fvDialogueKey=(e:KeyboardEvent)=>{if(!document.getElementById('fv-dialogue')||e.isComposing)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();send('cancel');}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const i=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[(i+(e.key==='ArrowDown'?1:buttons.length-1))%buttons.length]?.focus();}};
 document.addEventListener('keydown',w.__fvDialogueKey,true);
}
export function installDialogueClient(ctx:any,source:string){
 const sp=ctx.sp,key='__fvDialogue';const old=sp.storage[key];if(old&&typeof old==='object'&&old.dispose)old.dispose();
 let handles:any[]=[],shown=false,token='',snapshot='',visible=false,focused=false,actor=0,lastOpen=0,disposed=false,dismissed='',pendingKey=-1;
 const menus=['Loading Menu','Main Menu','Console','Console Native UI Menu','MapMenu','InventoryMenu','Journal Menu','Dialogue Menu','RaceSex Menu','ContainerMenu','BarterMenu','TweenMenu','MagicMenu','MessageBoxMenu'];
 function blocked(){return menus.some(m=>sp.Ui.isMenuOpen(m));}
 function close(send=false){const t=token;if(t)dismissed=t;token='';snapshot='';if(shown){shown=false;sp.storage.__fvDialogueOpen=false;sp.browser.executeJavaScript('('+source+')({closed:true});');sp.browser.setFocused(focused);sp.browser.setVisible(visible);}if(send&&t&&!ctx._expired)ctx.sendEvent({op:'cancel',token:t});}
 function receive(value:any){if(disposed||ctx._expired||!value)return;if(value.closed){close();return;}if(value.token===dismissed)return;if(blocked()||!sp.mpClientPlugin.isConnected())return;
 const next=JSON.stringify(value);if(next===snapshot)return;if(!shown){if(sp.browser.isFocused())return;visible=sp.browser.isVisible();focused=sp.browser.isFocused();shown=true;sp.storage.__fvDialogueOpen=true;sp.browser.setVisible(true);sp.browser.setFocused(true);}actor=ctx.getMyFormIdInServerFormat();token=value.token;snapshot=next;sp.browser.executeJavaScript('('+source+')('+next.replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+');');}
 const manager={receive,dispose(){disposed=true;close();handles.forEach(h=>sp.unsubscribe(h));if(sp.storage[key]===manager)delete sp.storage[key];}};sp.storage[key]=manager;
 handles.push(sp.on('buttonEvent',(e:any)=>{if(e.isDown&&!e.isRepeating&&e.device===0)pendingKey=e.code;}));
 handles.push(sp.on('browserMessage',(e:any)=>{const a=e.arguments;if(!shown||!Array.isArray(a)||a[0]!=='fv-dialogue'||typeof a[1]!=='string'||a[1].length>1024)return;try{const p=JSON.parse(a[1]);if(p.token!==token)return;if(p.op==='cancel'){close(true);return;}ctx.sendEvent(p);}catch{close(true);}}));
 handles.push(sp.on('update',()=>{if(ctx._expired){manager.dispose();return;}const keyCode=pendingKey;pendingKey=-1;if(keyCode>=0&&!shown&&!sp.browser.isFocused()&&!sp.Ui.isTextInputEnabled()&&!blocked()&&sp.mpClientPlugin.isConnected()&&keyCode===sp.Input.getMappedKey('Activate',0)&&Date.now()-lastOpen>=750){const ref=sp.Game.getCurrentCrosshairRef();if(ref&&!ref.isDeleted()){const id=ctx.getFormIdInServerFormat(ref.getFormID());if(id){lastOpen=Date.now();ctx.sendEvent({op:'open',npc:id});}}}const current=ctx.getMyFormIdInServerFormat();if(shown&&(!sp.mpClientPlugin.isConnected()||current!==actor||blocked()||!sp.browser.isFocused()))close(true);actor=current;}));
}
export function dialogueSources(){return {event:'('+installDialogueClient.toString()+')(ctx,'+JSON.stringify(dialogueBrowser.toString())+');',owner:'var m=ctx.sp.storage.__fvDialogue;if(m&&typeof m===\"object\"&&typeof m.receive===\"function\")m.receive(ctx.value);'};}
