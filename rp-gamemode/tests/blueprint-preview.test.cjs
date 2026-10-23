const {test}=require('node:test'),a=require('node:assert/strict');
const {previewDialogue}=require('../.test-build/modules/dialogue/preview.js');
const {clerkGraph}=require('../.test-build/modules/dialogue/dialogue-runtime.js');
test('preview traverses real runtime and describes service actions without executing transactions',()=>{
 const g=clerkGraph(['route'],['regional']);const result=previewDialogue(g,['accept-route','buy-regional'],false,['route'],['regional']);
 a.deepEqual(result.actions,[['accept','route'],['guild','buy','regional']]);a.equal(result.current.version,1);a.match(result.current.text,/Preview/);
 a.equal(previewDialogue(g,['exit'],false,['route'],['regional']).current.closed,true);
 a.throws(()=>previewDialogue(g,['forged'],false,['route'],['regional']),/choice/i);
});
test('preview supports actual courierIdle condition and enforces traversal bounds',()=>{
 const g=clerkGraph([],[]);g.nodes[0].next='check';g.nodes.push({id:'check',type:'condition',condition:'courierIdle',next:'welcome',otherwise:'end'});
 a.equal(previewDialogue(g,[],true,[],[]).current.closed,true);a.ok(previewDialogue(g,[],false,[],[]).current.choices);
 a.throws(()=>previewDialogue(g,Array(129).fill('rank'),false,[],[]),/limit/i);
});
