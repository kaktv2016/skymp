import type {QuestCatalogueEntry} from './quest-navigation';

/** Serialized additive Scaleform helper. Never replaces Map/HUD/SkyUI menus. */
export function installQuestTint(ctx:{sp:any;_expired?:boolean;getMyFormIdInServerFormat():number},catalogue:readonly QuestCatalogueEntry[],clock:()=>number=Date.now){
 var sp=ctx.sp,key='__rpQuestTintV1',old=sp.storage[key],root='_root.__FrostveilCourierTintV1';
 if(old&&typeof old==='object'&&typeof old.dispose==='function')old.dispose();
 var handles:any[]=[],disposed=false,disposing=false,lastTick=-Infinity,lastError='';
 var menus:{[name:string]:{started:number;loaded:boolean;painted:number}}={};
 function trace(message:string){if(typeof sp.writeLogs==='function')try{sp.writeLogs('rpQuestTint',message);}catch{}}
 function problem(message:string){if(lastError===message)return;lastError=message;trace(message);
  if(sp.browser&&typeof sp.browser.executeJavaScript==='function')try{sp.browser.executeJavaScript('if(window.__rpChatUiV1)window.__rpChatUiV1.nativeNotice("quest-tint",'+JSON.stringify(message?('สีหมุดเควสไม่พร้อม: '+message):'')+');');}catch{}
 }
 function state(){
  var manager=sp.storage.__rpQuestNavigationV1,s=manager&&typeof manager==='object'&&typeof manager.status==='function'?manager.status():null;
  var active=!disposing&&!ctx._expired&&sp.mpClientPlugin.isConnected()&&ctx.getMyFormIdInServerFormat()>0&&s&&s.displayed&&s.tracked;
  var color=0xffd54a;
  if(active&&!sp.Ui.isMenuOpen('Loading Menu')&&!sp.Ui.isMenuOpen('Main Menu')){
   var entry=catalogue.find(function(c){return c.key===s.targetKey;});
   if(entry){var p=sp.Game.getPlayer(),w=p&&p.getWorldSpace(),c=p&&p.getParentCell(),cell=w?w.getFormID():c?c.getFormID():0;
    if(p&&cell===parseInt(entry.cell.split(':')[0]!,16)){
     var x=p.getPositionX()-entry.pos[0]!,y=p.getPositionY()-entry.pos[1]!,z=p.getPositionZ()-entry.pos[2]!;
     // Visual arrival hint only. Server delivery radius, time and payment checks remain authoritative.
     if(x*x+y*y+z*z<=200*200)color=0x7fff7a;
    }
   }
  }else if(active)active=false;
  var expectedLabel='';if(active){var selected=catalogue.find(function(c){return c.key===s.targetKey;});if(selected&&typeof selected.destination==='string')expectedLabel=selected.testOnly?'Reach '+selected.destination:'Deliver to '+selected.destination+' (/job deliver)';}
  return{active:!!active,color:color,expectedLabel:expectedLabel};
 }
 function menu(name:string,value:{active:boolean;color:number;expectedLabel:string}){
  if(!sp.Ui.isMenuOpen(name)){delete menus[name];return;}
  sp.Ui.setBool(name,'_root.__fvQuestTintActiveV1',value.active);
  sp.Ui.setInt(name,'_root.__fvQuestTintColorV1',value.color);
  sp.Ui.setString(name,'_root.__fvQuestTintLabelV1',value.expectedLabel);
  var item=menus[name];
  if(!item){item=menus[name]={started:clock(),loaded:false,painted:-1};
   // SP3's argument converter treats JS arrays as pooled native objects.
   // SKSE UICallback accepts scalar arguments and preserves the numeric depth.
   var callback=sp.callNative('UICallback','Create',null,name,'_root.createEmptyMovieClip');
   if(!Number.isSafeInteger(callback)||callback<=0)throw Error('UICallback creation failed for '+name);
   try{
    sp.callNative('UICallback','PushString',null,callback,'__FrostveilCourierTintV1');
    sp.callNative('UICallback','PushInt',null,callback,1048000);
    if(sp.callNative('UICallback','Send',null,callback)!==true)throw Error('UICallback send failed for '+name);
    callback=0;
   }finally{if(callback)sp.callNative('UICallback','Release',null,callback);}
   sp.Ui.invokeString(name,root+'.loadMovie','Frostveil/CourierQuestTint.swf');
  }
  if(sp.Ui.getInt(name,root+'.fvVersion')===1){
   if(!item.loaded){item.loaded=true;trace('SWF loaded '+name);}
   sp.Ui.invokeBool(name,root+'.fvApply',true);
   var painted=sp.Ui.getInt(name,root+'.fvPainted');if(painted!==item.painted){item.painted=painted;trace('SWF painted '+name+' markers='+painted);}
  }else if(clock()-item.started>=6000)problem('SWF unavailable in '+name+'; repair through Launcher Play');
 }
 function finish(){disposed=true;handles.forEach(function(h){sp.unsubscribe(h);});handles=[];}
 function update(){
  if(disposed)return;if(ctx._expired)disposing=true;
  var at=clock();if(!disposing&&at-lastTick<500)return;lastTick=at;
  try{var value=state();menu('HUD Menu',value);menu('MapMenu',value);if(disposing)finish();}catch(error){problem(String(error));}
 }
 var manager={dispose:function(){disposing=true;if(!Object.keys(menus).length)finish();},status:function(){return{error:lastError,disposed:disposed,loadedMenus:Object.keys(menus).filter(function(n){return menus[n]!.loaded;})};}};
 sp.storage[key]=manager;
 if(typeof sp.callNative!=='function'||!sp.Ui||!['getInt','setBool','setInt','setString','invokeString','invokeBool'].every(function(n){return typeof sp.Ui[n]==='function';})){lastError='Installed Skyrim Platform Ui/UICallback API unavailable';trace(lastError);finish();return;}
 handles.push(sp.on('update',update));
 // Installed EventHandler.cpp dispatches menuOpen/Close via AddUpdateTask, with VM context.
 // Seed parent variables before loadMovie so the SWF also works if Map pauses gameplay updates.
 handles.push(sp.on('menuOpen',function(e:any){if(disposed||e.name!=='MapMenu'&&e.name!=='HUD Menu')return;try{delete menus[e.name];menu(e.name,state());}catch(error){problem(String(error));}}));
 handles.push(sp.on('menuClose',function(e:any){delete menus[e.name];}));
}
