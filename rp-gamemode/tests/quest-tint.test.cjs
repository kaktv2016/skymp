const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function fixture(){const window={};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../../../mod-work/frostveil-courier-navigation/.test-build/tint.js'),'utf8'),{window,console});return window.FrostveilQuestTint;}
function marker(label,markerType){return{label,markerType,IconClip:{transform:{ra:100,ga:100,ba:100,aa:100,rb:0,gb:0,bb:0,ab:0}}};}
function rootWithMarkers(){const root={MarkerClips:{Marker0:marker('Whiterun',1),Marker1:marker('Courier: Heartwood Mill',62),Marker2:marker('Frostveil: Navigation Test',63),Marker3:marker('Player destination',65)}};return root;}
test('gold and green apply to quest/quest-door icons while town and player pins stay unchanged',()=>{const api=fixture(),root=rootWithMarkers();assert.equal(api.paint(root,0xffd54a,true),2);assert.equal(root.MarkerClips.Marker1.IconClip.rgb,0xffd54a);assert.equal(root.MarkerClips.Marker2.IconClip.rgb,0xffd54a);assert.equal(root.MarkerClips.Marker0.IconClip.rgb,undefined);assert.equal(root.MarkerClips.Marker3.IconClip.rgb,undefined);api.paint(root,0x7fff7a,true);assert.equal(root.MarkerClips.Marker1.IconClip.rgb,0x7fff7a);});
test('clearing the job restores original color transforms and reused/native clips remain usable',()=>{const api=fixture(),root=rootWithMarkers();const old={...root.MarkerClips.Marker1.IconClip.transform};api.paint(root,0xffd54a,true);api.paint(root,0,false);assert.deepEqual(root.MarkerClips.Marker1.IconClip.transform,old);assert.equal(root.MarkerClips.Marker1.IconClip.rgb,undefined);assert.equal(api.paint(root,0,false),0);});
test('vanilla/SkyUI map nesting is colored while the unidentified compass quest-holder stays native',()=>{const api=fixture(),r={Map:{MapMovie:{MarkerClips:{Marker0:marker('Courier: Watchtower Letter'),Marker1:marker('Riverwood')}}},HUDMovieBaseInstance:{CompassRect:{QuestHolder:{transform:{ra:100}}}}};assert.equal(api.paint(r,0xffd54a,true),1);assert.equal(r.Map.MapMovie.MarkerClips.Marker0.IconClip.rgb,0xffd54a);assert.equal(r.Map.MapMovie.MarkerClips.Marker1.IconClip.rgb,undefined);assert.equal(r.HUDMovieBaseInstance.CompassRect.QuestHolder.rgb,undefined);});

test('unrelated vanilla quests and doors never inherit Courier colors, and recycled clips restore immediately',()=>{
 const api=fixture(),root={MarkerClips:{own:marker('Courier: Heartwood Mill',62),other:marker('Dragon Rising',62),door:marker('To Dragonsreach',63),town:marker('Courier: not a quest',1)}};
 assert.equal(api.paint(root,0x7fff7a,true),1);assert.equal(root.MarkerClips.other.IconClip.rgb,undefined);assert.equal(root.MarkerClips.door.IconClip.rgb,undefined);assert.equal(root.MarkerClips.town.IconClip.rgb,undefined);
 root.MarkerClips.own.label='Whiterun';root.MarkerClips.own.markerType=1;
 assert.equal(api.paint(root,0x7fff7a,true),0);assert.equal(root.MarkerClips.own.IconClip.rgb,undefined,'reused native clip keeps its original transform');
});
test('the exact active objective label is tinted while another delivery objective stays native',()=>{
 const api=fixture(),root={MarkerClips:{active:marker('Deliver to Heartwood Mill (/job deliver)',62),other:marker('Deliver to Whiterun',62)}};
 assert.equal(api.paint(root,0xffd54a,true,'Deliver to Heartwood Mill (/job deliver)'),1);assert.equal(root.MarkerClips.active.IconClip.rgb,0xffd54a);assert.equal(root.MarkerClips.other.IconClip.rgb,undefined);
});
