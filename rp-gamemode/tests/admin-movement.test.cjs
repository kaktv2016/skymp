const test=require('node:test'),assert=require('node:assert/strict');
const {AdminService}=require('../.test-build/modules/admin/admin-service.js');
function fixture(){let guid='a',profileId=4,allowed=true,now=1000,principal='owner';const logs=[];
 const adapter={sessionForActor:actor=>({actorId:actor,userId:0,profileId,guid})};
 const service=new AdminService(adapter,{authorize:s=>allowed&&s.profileId===4?principal:null,now:()=>now,log:x=>logs.push(x)});
 return{service,logs,reconnect:()=>guid='b',profile:v=>profileId=v,revoke:()=>allowed=false,advance:()=>now+=1000,principal:v=>principal=v};
}
test('admin defaults deny, never trusts display name, slot or a client-selected profile',()=>{
 const e=fixture(),denied=new AdminService({sessionForActor:()=>({actorId:1,userId:0,profileId:4,guid:'a'})});
 assert.equal(denied.execute(1,['fly','on']).ok,false);e.profile(5);assert.equal(e.service.execute(1,['fly','on']).ok,false);assert.equal(e.service.state(1),null);
});
test('authorized movement is absolute, scoped to owner/session, bounded and revocable',()=>{
 const e=fixture();assert.equal(e.service.execute(1,['fly','on']).ok,true);const one=e.service.state(1);assert.equal(one.fly,true);
 assert.equal(e.service.execute(1,['fly','on']).ok,true);assert.deepEqual(e.service.state(1),one);
 assert.equal(e.service.execute(1,['speed','2']).ok,true);assert.equal(e.service.state(1).speed,2);assert.equal(e.service.state(2).speed,1);
 for(const n of ['0','6','NaN','Infinity','2x'])assert.equal(e.service.execute(1,['speed',n]).ok,false);
 assert.equal(e.service.execute(1,['speed','reset']).ok,true);assert.equal(e.service.state(1).speed,1);
 e.revoke();assert.equal(e.service.state(1),null);assert.equal(e.service.execute(1,['fly','off']).ok,false);
});
test('reconnect, account change and clear never restore privileged movement',()=>{
 const e=fixture();e.service.execute(1,['fly','on']);e.service.execute(1,['speed','3']);e.reconnect();assert.equal(e.service.state(1).fly,false);assert.equal(e.service.state(1).speed,1);
 e.service.execute(1,['speed','4']);e.principal('other');assert.equal(e.service.state(1).speed,1);
 e.service.execute(1,['fly','on']);e.service.clear();assert.equal(e.service.state(1).fly,false);
 assert.ok(e.logs.some(x=>x.includes('fly on')));assert.ok(e.logs.every(x=>!x.includes('guid=')));
});
