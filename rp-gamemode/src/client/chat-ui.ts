import type { ChatConfig, ChatEnvelope } from '../modules/chat/contracts';

/** Standalone CEF function: serialized, so no imported runtime helpers. */
export function browserChat(config: ChatConfig) {
  var win = window as unknown as Record<string, any>;
  if (win.__rpChatUiV1) { win.__rpChatUiV1.dispose(); }
  var root=document.createElement('section'); root.id='rp-chat-v1';
  root.style.cssText='position:fixed;left:3%;bottom:7%;width:560px;max-width:65vw;color:#ede4d0;background:rgba(18,22,24,.9);border:1px solid #a99162;border-radius:4px;padding:12px;z-index:10000;font:16px Tahoma,"Segoe UI",sans-serif;display:none;pointer-events:auto';
  var title=document.createElement('div'); title.textContent='Local • /me • /do • /whoami • /profile'; title.style.cssText='color:#c7ae7b;margin-bottom:8px;font-size:13px';
  var history=document.createElement('div'); history.style.cssText='height:240px;overflow-y:auto;white-space:pre-wrap;overflow-wrap:anywhere;user-select:text';
  var input=document.createElement('input'); input.type='text'; input.placeholder='พูดคุย / Enter ส่ง / Escape ปิด'; input.maxLength=config.maxLength*2;
  input.style.cssText='box-sizing:border-box;width:100%;margin-top:10px;padding:9px;background:#111a1d;border:1px solid #877653;color:#fff;font:inherit';
  root.appendChild(title); root.appendChild(history); root.appendChild(input); document.body.appendChild(root);
  var questDetails=document.createElement('div');questDetails.id='rp-quest-details';questDetails.style.cssText='display:none;border-top:1px solid #877653;margin-top:8px;padding-top:8px;white-space:pre-wrap;color:#dfc68e;font-size:14px;pointer-events:none';root.appendChild(questDetails);
  var nativeStatus=document.createElement('div');nativeStatus.style.cssText='white-space:pre-wrap;color:#efbd80;font-size:13px;pointer-events:none';root.appendChild(nativeStatus);var nativeNotices:Record<string,string>={};
  var epoch='', last=0, keyDiagnostics=0, lease=0, composing=false,f7Released=false;
  var commands:string[]=[], sent:string[]=[], cursor=0, draft='';
  var cycle:{before:string;after:string;matches:string[];index:number;value:string}|null=null;
  function send(kind:string, value?:string) {
    if (win.skyrimPlatform && typeof win.skyrimPlatform.sendMessage==='function') win.skyrimPlatform.sendMessage('rp-chat-v2',kind,JSON.stringify({lease:lease,value:value??null}));
  }
  function hide(expected?:number) { if(expected!==undefined && expected!==lease)return; root.style.display='none'; input.blur(); cycle=null; }
  function resetCycle(){cycle=null;}
  function compositionStart(){composing=true;send('composition','start');}
  function compositionEnd(){composing=false;cycle=null;send('composition','end');}
  function complete(backward:boolean):boolean {
    if(cycle && input.value===cycle.value){cycle.index=(cycle.index+(backward?-1:1)+cycle.matches.length)%cycle.matches.length;}
    else {
      var caret=typeof input.selectionStart==='number'?input.selectionStart:input.value.length;
      if(input.selectionStart!==input.selectionEnd)return false;
      var left=input.value.slice(0,caret),right=input.value.slice(caret);
      if(!/^\/[a-z]*(?:\s+[a-z-]*)*$/i.test(left))return false;
      var space=left.lastIndexOf(' '),before=space<0?'':left.slice(0,space+1),prefix=left.slice(space+1).toLowerCase();
      // Replace only the token under the caret, preserving all following arguments.
      var tail=right.replace(/^[^\s]*/,''),parent=before.trim().toLowerCase();
      var matches=commands.filter(function(command){var parts=command.split(' ');return (parts.slice(0,-1).join(' ')===parent) && parts[parts.length-1]!.toLowerCase().indexOf(prefix)===0;}).map(function(command){return command.split(' ').pop()!;});
      matches=matches.filter(function(v,i){return matches.indexOf(v)===i;}).sort();
      if(!matches.length)return false;
      cycle={before:before,after:tail,matches:matches,index:backward?matches.length-1:0,value:''};
    }
    input.value=cycle.before+cycle.matches[cycle.index]+cycle.after;cycle.value=input.value;
    var end=cycle.before.length+cycle.matches[cycle.index]!.length;input.setSelectionRange(end,end);return true;
  }
  function key(event:KeyboardEvent) {
    var enter=event.key==='Enter' || event.keyCode===13 || event.which===13;
    var escape=event.key==='Escape' || event.keyCode===27 || event.which===27;
    var inComposition=composing || event.isComposing || event.keyCode===229;
    // Record control-key interpretation only, never typed characters or text.
    if(enter || escape || keyDiagnostics<3) {
      ++keyDiagnostics;
      send('key-diagnostic','enter='+enter+' escape='+escape+' composing='+!!inComposition+' repeat='+!!event.repeat+' modernEnter='+(event.key==='Enter')+' numericEnter='+(event.keyCode===13 || event.which===13));
    }
    if(inComposition || event.ctrlKey || event.altKey || event.metaKey || (event.shiftKey && (event.key==='ArrowUp'||event.key==='ArrowDown')))return;
    if(escape) { event.preventDefault(); event.stopPropagation(); hide(); send('close'); }
    else if(event.key==='F7' || event.keyCode===118) {event.preventDefault();event.stopPropagation();if(!event.repeat && f7Released){hide();send('close');}}
    else if(event.key==='Tab' || event.keyCode===9){if(complete(event.shiftKey)){event.preventDefault();event.stopPropagation();}}
    else if(event.key==='ArrowUp' || event.key==='ArrowDown' || event.keyCode===38 || event.keyCode===40){
      if(!sent.length)return;
      event.preventDefault();event.stopPropagation();cycle=null;
      if(cursor===sent.length)draft=input.value;
      cursor=Math.max(0,Math.min(sent.length,cursor+((event.key==='ArrowUp'||event.keyCode===38)?-1:1)));
      input.value=cursor===sent.length?draft:sent[cursor]!;
      input.setSelectionRange(input.value.length,input.value.length);
    }
    else if(enter && !event.repeat) {
      event.preventDefault(); event.stopPropagation();
      if(!input.value.trim())return;
      var value=input.value;send('submit',value);
      sent=sent.filter(function(previous){return previous!==value;});sent.push(value);sent=sent.slice(-config.historyLimit);
      cursor=sent.length;draft='';cycle=null;input.value='';
    }
  }
  input.addEventListener('keydown',key);
  function keyUp(event:KeyboardEvent){if(event.key==='F7'||event.keyCode===118)f7Released=true;}
  window.addEventListener('keyup',keyUp);
  input.addEventListener('input',resetCycle);
  input.addEventListener('compositionstart',compositionStart);input.addEventListener('compositionend',compositionEnd);
  // BrowserService queues this notification asynchronously. Ask the native
  // focus owner to recheck, rather than closing a newer F7 lease blindly.
  function unfocused() { send('focus-check'); }
  window.addEventListener('skymp5-client:browserUnfocused',unfocused);
  win.__rpChatUiV1={
    open:function(nextLease?:number) {
      lease=nextLease??lease;composing=false;f7Released=false;cycle=null;cursor=sent.length;draft=input.value;
      var active=document.activeElement;
      if(active && active!==input && ((active as HTMLElement).isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))) { send('close'); return; }
      root.style.display='block'; input.focus(); history.scrollTop=history.scrollHeight;
    },
    close:hide,
    nativeNotice:function(kind:string,message:string){if(!['quest','admin'].includes(kind)||typeof message!=='string')return;nativeNotices[kind]=message.slice(0,500);nativeStatus.textContent=Object.values(nativeNotices).filter(Boolean).join('\n');},
    clear:function() { hide(); input.value='';sent=[];cursor=0;draft='';commands=[]; history.textContent='';questDetails.textContent='';questDetails.style.display='none'; epoch=''; last=0; },
    receive:function(value:ChatEnvelope) {
      if(!value || value.v!==1 || typeof value.epoch!=='string' || !Array.isArray(value.messages)) return;
      var q=value.quest;
      questDetails.textContent=q?'งานส่งของ: '+q.destination+'\n'+(q.reward!==null?'รางวัล '+q.reward+' RP / '+q.xpReward+' XP · /job deliver':'ทดสอบระบบนำทางเท่านั้น — ไม่มีรางวัล'):'';
      questDetails.style.display=q?'block':'none';
      if(Array.isArray(value.commands))commands=value.commands.slice(0,512).filter(function(v){return typeof v==='string' && /^\/[a-z][a-z0-9-]*(?: [a-z0-9-]+)*$/i.test(v) && v.length<=128;});
      if(epoch!==value.epoch) { history.textContent=''; epoch=value.epoch; last=0; }
      value.messages.slice(-config.inboxLimit).forEach(function(message) {
        if(!message || typeof message.seq!=='number' || message.seq<=last || typeof message.text!=='string') return;
        last=message.seq;
        var row=document.createElement('div');
        row.style.cssText='padding:3px 0;color:'+({Local:'#ece3cc',ME:'#c9b4df',DO:'#9bc8ce',System:'#d2b472'}[message.kind] || '#ece3cc');
        row.textContent=message.text; // Never interpolate user text as HTML or code.
        history.appendChild(row);
        while(history.children.length>config.historyLimit) history.removeChild(history.firstChild!);
      });
      history.scrollTop=history.scrollHeight;
    },
    dispose:function() { input.removeEventListener('keydown',key);input.removeEventListener('input',resetCycle);input.removeEventListener('compositionstart',compositionStart);input.removeEventListener('compositionend',compositionEnd);window.removeEventListener('keyup',keyUp); window.removeEventListener('skymp5-client:browserUnfocused',unfocused); root.remove(); delete win.__rpChatUiV1; }
  };
  send('ready');
}
