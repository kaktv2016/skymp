const {test}=require('node:test');const a=require('node:assert/strict');
const {validateGraph}=require('../.test-build/modules/dialogue/graph-model.js');
const {clerkGraph}=require('../.test-build/modules/dialogue/dialogue-runtime.js');
test('shared validator rejects type coercion, node-field mismatches and missing NPC text',()=>{
 for(const mutate of [g=>g.id=123,g=>g.nodes[0].id=123,g=>g.nodes.find(n=>n.type==='end').next='entry',g=>g.nodes.find(n=>n.type==='npc').action='rank',g=>delete g.nodes.find(n=>n.type==='npc').text]){const g=clerkGraph([],[]);mutate(g);a.throws(()=>validateGraph(g,[],[]));}
});
test('branching automatic graph validation is bounded and keeps explicit choice loops valid',()=>{
 const g=clerkGraph([],[]);for(let i=0;i<50;i++)g.nodes.push({id:'branch-'+i,type:'condition',condition:'always',next:i===49?'end':'branch-'+(i+1),otherwise:i===49?'end':'branch-'+(i+1)});
 a.equal(validateGraph(g,[],[]).nodes.length,g.nodes.length);
 g.nodes.find(n=>n.id==='branch-49').otherwise='branch-0';a.throws(()=>validateGraph(g,[],[]),/cycle/i);
});
