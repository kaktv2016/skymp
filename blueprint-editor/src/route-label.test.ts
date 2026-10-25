import {test,expect} from 'vitest';
import {safeLabelPosition} from './route-label';
const card=(x:number,y:number,width=100,height=100)=>({x,y,width,height});
test('suppresses canvas labels when they would cover cards or ports and keeps them in roomy corridors',()=>{expect(safeLabelPosition([{x:106,y:50},{x:194,y:50}],[card(0,0),card(200,0)])).toBeUndefined();const p=safeLabelPosition([{x:106,y:200},{x:594,y:200}],[card(0,150),card(600,150)]);expect(p).toBeDefined();expect(p!.x).toBeGreaterThan(230);expect(p!.x).toBeLessThan(470);expect(safeLabelPosition([{x:106,y:200},{x:594,y:200}],[card(0,150),card(600,150),card(200,80,300,180)])).toBeUndefined();});
