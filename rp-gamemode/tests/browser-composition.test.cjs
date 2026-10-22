const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const ts=require('../../skymp5-server/node_modules/typescript');
test('actual BrowserService Escape defers to the active RP IME composition owner without affecting ordinary Escape',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../../skymp5-client/src/services/services/browserService.ts'),'utf8');
 const handlers={},menu=new Proxy({},{get:(_t,key)=>String(key)}),exports={};let focused=true,composing=true,changes=[];
 const sp={storage:{__rpChatClientV1:{isComposing:()=>composing}},browser:{setVisible(){},setFocused:v=>{changes.push(v);focused=v;},isFocused:()=>focused,executeJavaScript(){}}};
 const controller={on(){},once(){},emitter:{on:(n,f)=>handlers[n]=f}};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>n==='./clientListener'?{ClientListener:class{}}:n==='skyrimPlatform'?{DxScanCode:{Escape:1,F1:2,F2:3,F6:4,Enter:5},Menu:menu}:{FormView:{}}});
 new exports.BrowserService(sp,controller);const escape=()=>handlers.queryKeyCodeBindings({isDown:keys=>keys[0]===1});
 escape();assert.deepEqual(changes,[]);composing=false;escape();assert.deepEqual(changes,[false]);
 focused=true;sp.storage.__rpChatClientV1=()=>{throw Error('Legacy missing key');};escape();assert.deepEqual(changes,[false,false]);
});
test('BrowserService routes raw F7/Escape state to the RP owner and does not also unfocus its composition',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../../skymp5-client/src/services/services/browserService.ts'),'utf8'),handlers={},exports={},calls=[];
 const sp={storage:{__rpChatClientV1:{handleKeys:(f7,esc)=>{calls.push([f7,esc]);return true;}}},browser:{setVisible(){},setFocused(){throw Error('Second focus owner');},isFocused:()=>true,executeJavaScript(){}}};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>n==='./clientListener'?{ClientListener:class{}}:n==='skyrimPlatform'?{DxScanCode:{Escape:1,F1:2,F2:3,F6:4,Enter:5,F7:65},Menu:new Proxy({},{get:(_t,k)=>String(k)})}:{FormView:{}}});
 new exports.BrowserService(sp,{on(){},once(){},emitter:{on:(n,f)=>handlers[n]=f}});handlers.queryKeyCodeBindings({isDown:keys=>keys[0]===65});handlers.queryKeyCodeBindings({isDown:keys=>keys[0]===1});assert.deepEqual(calls,[[true,false],[false,true]]);assert.equal(sp.storage.__rpChatNativeKeysV2,true);
});
