import {beaconStyles} from '../modules/courier/beacon-styles';
import type { ChatConfig, ChatEnvelope } from '../modules/chat/contracts';
import { browserChat } from './chat-ui';
import { browserProfile } from './profile-ui';
import type { ProfileResponse } from '../modules/identity/profile-validation';
import {installCourierNavigation} from './courier-navigation';
import {installQuestNavigation} from './quest-navigation';
import {installQuestTint} from './quest-tint';
import {installAdminMovement} from './admin-movement';
import {navigationCatalogue} from '../config/navigation-catalogue';
interface Platform {
  storage: Record<string, any>;
  browser: { setVisible(v:boolean):void; isVisible():boolean; setFocused(v:boolean):void; isFocused():boolean; executeJavaScript(code:string):void; loadUrl(url:string):void };
  printConsole?(message:string):void;
  writeLogs?(plugin:string, message:string):void;
  mpClientPlugin: { isConnected():boolean };
  Ui: { isMenuOpen(name:string):boolean; isTextInputEnabled():boolean };
  on(name:string, callback:(event:any)=>void):unknown;
  unsubscribe(handle:unknown):void;
}
interface ClientContext { sp:Platform; _expired?:boolean; sendEvent(...args:unknown[]):void; getMyFormIdInServerFormat():number; }

/** Standalone SP function; all execution-time dependencies are inside this function. */
export function installChatClient(ctx:ClientContext, config:ChatConfig, uiSource:string,profileSource:string) {
  var sp=ctx.sp, key='__rpChatClientV1';
  // Legacy SP storage returns a truthy function for missing keys, not undefined.
  var old=sp.storage[key];
  if(old && typeof old==='object' && typeof old.dispose==='function') old.dispose();
  var handles:unknown[]=[], opened=false, visible=false, focused=false, ready=false, pending:ChatEnvelope|null=null;
  var sheetOpened=false,profileReady=false,pendingProfile:ProfileResponse|null=null,profileToken='',expectedOpen='';
  var lastCheck=0, actor=0, disposed=false, connected=false, request=0;
  var started=Date.now(), navigated=false, lastInstall=0, installAttempts=0;
  var clientId=Date.now().toString(36)+'_'+Math.random().toString(36).slice(2);
  var lease=0, lastOpen=-Infinity, cefToggleAt=-Infinity;
  var composing=false;
  var heldF7=false,heldEscape=false;
  var badMenus=['BarterMenu','Book Menu','ContainerMenu','Crafting Menu','GiftMenu','InventoryMenu','Journal Menu','Lockpicking Menu','Loading Menu','MapMenu','RaceSex Menu','StatsMenu','TweenMenu','Console','Console Native UI Menu','Main Menu','Dialogue Menu','MessageBoxMenu','MagicMenu','FavoritesMenu','Quantity Menu','Sleep/Wait Menu'];
  function log(message:string) {
    var line='[rp-chat] '+message;
    if(typeof sp.printConsole==='function') sp.printConsole(line);
    // Verified ConsoleApi::WriteLogs. Diagnostic failure must not break chat.
    if(typeof sp.writeLogs==='function') { try { sp.writeLogs('rpChat',line); } catch {} }
  }
  function execute(code:string) { sp.browser.executeJavaScript(code); }
  function close(menu = false) {
    var owned=opened || sheetOpened;
    // Release our state before native/CEF callbacks can reenter.
    opened=false;sheetOpened=false;expectedOpen='';composing=false;
    execute('if(window.__rpChatUiV1)window.__rpChatUiV1.close('+lease+');');
    execute('if(window.__rpProfileUiV1)window.__rpProfileUiV1.close();');
    if(owned) {
      sp.browser.setFocused(focused);
      // Existing BrowserService owns menu visibility; do not undo its hide.
      if(!menu) sp.browser.setVisible(visible);
    }
  }
  function blocked() { return sp.Ui.isTextInputEnabled() || badMenus.some(function(menu){return sp.Ui.isMenuOpen(menu);}); }
  function install() { ready=false;profileReady=false;lastInstall=Date.now(); execute('('+uiSource+')('+JSON.stringify(config)+');('+profileSource+')();'); }
  function toggleChat(){
    if(sp.storage.__fvDialogueOpen===true)return;
    if(opened && sp.browser.isFocused()){close();return;}
    if(sheetOpened){
      if(!connected || !ready || badMenus.some(function(menu){return sp.Ui.isMenuOpen(menu);})){close();return;}
      execute('if(window.__rpProfileUiV1)window.__rpProfileUiV1.close();');
      sheetOpened=false;opened=true;composing=false;expectedOpen='';
    }else{
      var denied=blocked();
      log('F7 open connected='+connected+' ready='+ready+' blocked='+denied+' focus='+sp.browser.isFocused());
      if(!connected || !ready || denied || sp.browser.isFocused())return;
      // Native focus is authoritative if an old CEF close was lost/delayed.
      visible=sp.browser.isVisible();focused=false;opened=true;
      sp.browser.setVisible(true);sp.browser.setFocused(true);
    }
    ++lease;lastOpen=Date.now();
    execute('if(window.__rpChatUiV1)window.__rpChatUiV1.open('+lease+');');
  }
  function deliverProfile(response:ProfileResponse) {
    if(!profileReady || response.token===profileToken) return;
    profileToken=response.token;
    // An old persisted owner envelope must never open a sheet after reconnect.
    if(response.action==='open') {
      if(response.requestId!==expectedOpen || !connected) return;
      if(!opened && !sheetOpened && (blocked() || sp.browser.isFocused())) return;
      if(opened || sheetOpened) {
        // Transfer our existing focus lease: false->true queues Cursor Menu hide.
        execute('if(window.__rpChatUiV1)window.__rpChatUiV1.close();');
        execute('if(window.__rpProfileUiV1)window.__rpProfileUiV1.close();');
        opened=false;sheetOpened=true;expectedOpen='';
      } else {
        visible=sp.browser.isVisible();focused=sp.browser.isFocused();sheetOpened=true;expectedOpen='';
        sp.browser.setVisible(true);sp.browser.setFocused(true);
      }
    }
    execute('if(window.__rpProfileUiV1)window.__rpProfileUiV1.receive('+JSON.stringify(response).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+');');
    if(response.action==='open') execute('if(window.__rpProfileUiV1)window.__rpProfileUiV1.open();');
  }
  function deliver(value:ChatEnvelope) {
    pending=value;
    var navigation=sp.storage.__rpCourierNavigationV1;
    if(navigation && typeof navigation==='object' && typeof navigation.receive==='function')navigation.receive(value.navigation??null);
    var quest=sp.storage.__rpQuestNavigationV1;
    if(quest && typeof quest==='object' && typeof quest.receive==='function')quest.receive(value.quest??null);
    var admin=sp.storage.__rpAdminMovementV1;
    if(admin && typeof admin==='object' && typeof admin.receive==='function')admin.receive(value.admin??null);
    log('owner inbox received; messages='+value.messages.length+' uiReady='+ready);
    if(ready)[['quest',quest],['quest-tint',sp.storage.__rpQuestTintV1],['admin',admin]].forEach(function(pair){var manager=pair[1];if(manager&&typeof manager==='object'&&typeof manager.status==='function'){var error=manager.status().error;execute('if(window.__rpChatUiV1)window.__rpChatUiV1.nativeNotice('+JSON.stringify(pair[0])+','+JSON.stringify(typeof error==='string'?error:'')+');');}});
    if(ready) execute('if(window.__rpChatUiV1)window.__rpChatUiV1.receive('+JSON.stringify(value).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+');');
    if(value.profile){pendingProfile=value.profile;deliverProfile(value.profile);}
  }
  var manager={
    context:ctx,
    receive:deliver,
    isComposing:function(){return opened && composing && !ctx._expired;},
    handleKeys:function(f7:boolean,escape:boolean){
      var owned=opened||sheetOpened;
      if(escape && !heldEscape && owned && !composing)close();
      if(f7 && !heldF7)toggleChat();
      heldF7=f7;heldEscape=escape;return owned||opened||sheetOpened;
    },
    dispose:function() {
      if(disposed) return; disposed=true;
      close(); handles.forEach(function(handle){sp.unsubscribe(handle);}); handles=[];
      execute('if(window.__rpChatUiV1)window.__rpChatUiV1.dispose();');
      execute('if(window.__rpProfileUiV1)window.__rpProfileUiV1.dispose();');
      if(sp.storage[key]===manager) delete sp.storage[key];
    }
  };
  sp.storage[key]=manager;
  handles.push(sp.on('browserMessage',function(event) {
    var args=event.arguments;
    if(!Array.isArray(args)) return;
    if(args[0]==='front-loaded') { close(); install(); return; }
    if(args[0]==='rp-chat-root-ready') { log('isolated CEF page loaded'); close(); install(); return; }
    if(args[0]==='rp-chat-root-error') { log('CEF error: '+String(args[1])); return; }
    if(args[0]==='rp-profile-v1') {
      if(args[1]==='ready'){profileReady=true;if(pendingProfile)deliverProfile(pendingProfile);}
      else if(args[1]==='close')close();
      else if(args[1]==='save' && sheetOpened && connected && typeof args[2]==='string' && args[2].length<=4096) {
        var edits:unknown;try{edits=JSON.parse(args[2]);}catch{return;}
        if(!edits || typeof edits!=='object' || Array.isArray(edits))return;
        var fields=edits as Record<string,unknown>;
        if(Object.keys(fields).length!==2 || Object.keys(fields).some(function(key){return key!=='displayName' && key!=='biography';}))return;
        var saveId=clientId+'_'+(++request);
        execute('if(window.__rpProfileUiV1)window.__rpProfileUiV1.expect('+JSON.stringify(saveId)+');');
        ctx.sendEvent({v:1,id:saveId,op:'profile-save',displayName:fields.displayName,biography:fields.biography});
      }
      return;
    }
    if(args[0]==='rp-chat-v2'){
      if(typeof args[2]!=='string' || args[2].length>4096)return;
      try{var packet=JSON.parse(args[2]);if(!packet || !Number.isSafeInteger(packet.lease))return;args=['rp-chat-v1',args[1],packet.value,packet.lease];}catch{return;}
    }
    if(args[0]!=='rp-chat-v1') return;
    if(args[1]==='ready') { ready=true; log('UI ready'); if(pending) deliver(pending); }
    else if(args[1]==='key-diagnostic' && typeof args[2]==='string' && args[2].length<300) log('CEF key: '+args[2]);
    else if(args[1]==='composition') {if(opened && args[3]===lease)composing=args[2]==='start';}
    else if(args[1]==='close') {if(args[3]===undefined || args[3]===lease)close();}
    else if(args[1]==='focus-check') {if(args[3]===lease && (opened||sheetOpened) && !sp.browser.isFocused())close();}
    else if(args[1]==='toggle') {
      if(sp.storage.__rpChatNativeKeysV2===true)return;
      if(opened && args[3]===lease && Date.now()-lastOpen>=120){cefToggleAt=Date.now();close();}
    }
    else if(args[1]==='submit') {
      log('CEF submit received; opened='+opened+' connected='+connected+' textIsString='+(typeof args[2]==='string'));
      if(!opened || !connected || typeof args[2]!=='string') return;
      if(args[3]!==undefined && args[3]!==lease)return;
      // Authoritative actor is added by native CustomEvent, never sent in payload.
      var chatId=clientId+'_'+(++request);
      if(/^\/profile$/i.test(args[2].trim()))expectedOpen=chatId;
      ctx.sendEvent({v:1,id:chatId,text:args[2]});
      log('custom event submitted; request='+request);
    }
  }));
  handles.push(sp.on('buttonEvent',function(event) {
    if(!event.isDown || event.isRepeating || event.device!==0) return;
    if(sp.storage.__rpChatNativeKeysV2===true && (event.code===1 || event.code===config.openKey))return;
    if(event.code===1 && (opened || sheetOpened)) {if(!composing)close();return;}
    if(event.code!==config.openKey) return;
    if(Date.now()-cefToggleAt<120)return;
    toggleChat();
  }));
  handles.push(sp.on('menuOpen',function(event) {
    // Tilted browser focus opens Cursor Menu itself; that must not close chat.
    if((opened || sheetOpened) && badMenus.indexOf(event.name)>=0) {
      log('chat closed for menu: '+event.name);
      close(true);
    }
  }));
  handles.push(sp.on('update',function() {
    var at=Date.now(); if(at-lastCheck<250) return; lastCheck=at;
    if(ctx._expired) { manager.dispose(); return; }
    var next=sp.mpClientPlugin.isConnected()?ctx.getMyFormIdInServerFormat():0;
    if(next!==actor || (connected && next===0)) {
      log('native connection actor changed: '+actor+' -> '+next);
      close(); pending=null;
      execute('if(window.__rpChatUiV1)window.__rpChatUiV1.clear();');
      actor=next;
      pendingProfile=null;profileToken='';
      execute('if(window.__rpProfileUiV1)window.__rpProfileUiV1.clear();');
      // New owner/same actor reconnect must replay the latest envelope once.
      delete sp.storage.__rpChatDeliveredV1;
    }
    connected=next>0;
    if(connected && !ready && at-started>=1500) {
      if(!navigated) {
        // The current BUILD_FRONT=OFF installation has no upstream UI index.
        // Navigate only after a missing handshake, using a separate user-installed page.
        navigated=true; log('UI handshake missing; loading isolated bootstrap '+config.uiUrl);
        sp.browser.loadUrl(config.uiUrl);
      } else if(at-lastInstall>=1000 && installAttempts<3) {
        ++installAttempts; install();
      }
    }
    // Skyrim text-input state is checked before opening; do not mistake our own
    // focused CEF input for another field while chat is open.
    if((opened || sheetOpened) && (!connected || !sp.browser.isFocused() || badMenus.some(function(menu){return sp.Ui.isMenuOpen(menu);}))) close();
  }));
  log('client source installed; configured key='+config.openKey);
  try { install(); }
  catch(error) { log('initial CEF execution failed: '+String(error)); }
}

/** Owner callback runs each frame in the existing client: execute JS only on change. */
export function receiveChatOwner(ctx: { sp:Platform; value:ChatEnvelope; getMyFormIdInServerFormat():number }) {
  var manager=ctx.sp.storage.__rpChatClientV1;
  var value=ctx.value;
  if(!manager || typeof manager!=='object' || typeof manager.receive!=='function' || !ctx.sp.mpClientPlugin.isConnected() || ctx.getMyFormIdInServerFormat()<=0 || !value || value.v!==1 || !Array.isArray(value.messages)) return;
  var last=value.messages[value.messages.length-1];
  var token=value.epoch+':'+(last?last.seq:0)+':'+JSON.stringify([value.navigation,value.commands,value.quest,value.admin]);
  if(ctx.sp.storage.__rpChatDeliveredV1===token) return;
  manager.receive(value);
  ctx.sp.storage.__rpChatDeliveredV1=token;
}
export function chatSources(config:ChatConfig) {
  return { event:`(${installCourierNavigation.toString()})(ctx,${JSON.stringify(beaconStyles)});(${installQuestNavigation.toString()})(ctx,${JSON.stringify(navigationCatalogue)});(${installQuestTint.toString()})(ctx,${JSON.stringify(navigationCatalogue)});(${installAdminMovement.toString()})(ctx);(${installChatClient.toString()})(ctx,${JSON.stringify(config)},${JSON.stringify(browserChat.toString())},${JSON.stringify(browserProfile.toString())});`, owner:`(${receiveChatOwner.toString()})(ctx);` };
}
