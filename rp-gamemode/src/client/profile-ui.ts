import type { ProfileResponse, ProfileView } from '../modules/identity/profile-validation';

/** Standalone CEF function injected beside chat into its existing page. */
export function browserProfile() {
  var win=window as unknown as Record<string,any>;
  if(win.__rpProfileUiV1) win.__rpProfileUiV1.dispose();
  var root=document.createElement('section');root.id='rp-profile-v1';
  root.style.cssText='display:none;position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:520px;max-width:85vw;max-height:85vh;overflow:auto;box-sizing:border-box;padding:22px;background:rgba(20,24,25,.97);border:1px solid #b29a67;border-radius:5px;color:#eee3cb;font:16px Tahoma,"Segoe UI",sans-serif;z-index:10001;pointer-events:auto';
  var title=document.createElement('h2');title.textContent='Character Profile';title.style.cssText='margin:0 0 12px;color:#d6bb7c';
  var current=document.createElement('div');current.style.cssText='margin-bottom:16px;color:#c9b98f';
  var nameLabel=document.createElement('label');nameLabel.textContent='RP display name';
  var name=document.createElement('input');name.type='text';name.maxLength=80;
  var bioLabel=document.createElement('label');bioLabel.textContent='Biography';
  var bio=document.createElement('textarea');bio.rows=5;bio.maxLength=480;
  [name,bio].forEach(function(field){field.style.cssText='display:block;box-sizing:border-box;width:100%;margin:6px 0 14px;padding:10px;background:#111b1d;color:#fff;border:1px solid #88754d;font:inherit;resize:vertical';});
  var status=document.createElement('div');status.style.cssText='min-height:24px;white-space:pre-wrap;overflow-wrap:anywhere;color:#d8bd7d';
  var save=document.createElement('button');save.type='button';save.textContent='Save';
  var cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel / Close';
  [save,cancel].forEach(function(button){button.style.cssText='margin:12px 12px 0 0;padding:9px 16px;background:#30332b;border:1px solid #a38b5d;color:#f4e6c9;font:inherit;cursor:pointer';});
  [title,current,nameLabel,name,bioLabel,bio,status,save,cancel].forEach(function(node){root.appendChild(node);});document.body.appendChild(root);
  var opened=false,pending='',timer:number|undefined,snapshot:ProfileView|null=null;
  function send(kind:string,value?:string) {
    if(win.skyrimPlatform && typeof win.skyrimPlatform.sendMessage==='function') {win.skyrimPlatform.sendMessage('rp-profile-v1',kind,value);return true;}
    return false;
  }
  function stopWaiting() {if(timer!==undefined) window.clearTimeout(timer);timer=undefined;pending='';save.disabled=false;}
  function close() {opened=false;stopWaiting();root.style.display='none';name.value='';bio.value='';status.textContent='';name.blur();bio.blur();}
  function load(value:ProfileView) {
    snapshot=value;current.textContent=value.displayName;name.value=value.displayName;bio.value=value.biography;
    name.maxLength=value.limits.nameMax*2;bio.maxLength=value.limits.biographyMax*2;
  }
  function submit() {
    if(!opened || pending) return;
    pending='waiting';save.disabled=true;status.textContent='Saving…';
    if(!send('save',JSON.stringify({displayName:name.value,biography:bio.value}))) {stopWaiting();status.textContent='Profile transport unavailable';return;}
    timer=window.setTimeout(function(){if(pending){stopWaiting();status.textContent='No reply yet. Reopen /profile before retrying.';}},10000);
  }
  function cancelProfile(){close();send('close');}
  function key(event:KeyboardEvent){if(!event.isComposing && event.keyCode!==229 && (event.key==='Escape' || event.keyCode===27)){event.preventDefault();event.stopPropagation();cancelProfile();}}
  function unfocused(){if(opened) cancelProfile();}
  save.addEventListener('click',submit);cancel.addEventListener('click',cancelProfile);
  name.addEventListener('keydown',key);bio.addEventListener('keydown',key);
  window.addEventListener('skymp5-client:browserUnfocused',unfocused);
  win.__rpProfileUiV1={
    receive:function(response:ProfileResponse) {
      if(response.action==='open' && response.profile){stopWaiting();load(response.profile);status.textContent=response.message;}
      else if(opened && pending===response.requestId) {
        stopWaiting();if(response.action==='saved' && response.profile) load(response.profile);
        status.textContent=response.message; // Safe text; errors preserve the local draft.
      }
    },
    expect:function(id:string){if(opened && pending)pending=id;},
    open:function(){if(!snapshot)return;opened=true;root.style.display='block';name.focus();},
    close:close,
    clear:function(){close();snapshot=null;current.textContent='';},
    dispose:function(){close();save.removeEventListener('click',submit);cancel.removeEventListener('click',cancelProfile);name.removeEventListener('keydown',key);bio.removeEventListener('keydown',key);window.removeEventListener('skymp5-client:browserUnfocused',unfocused);root.remove();delete win.__rpProfileUiV1;}
  };
  send('ready');
}
