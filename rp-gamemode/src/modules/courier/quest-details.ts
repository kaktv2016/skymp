import {navigationCatalogue} from '../../config/navigation-catalogue';
import {cellKey} from './contracts';
import type {CourierWaypoint,QuestDetails} from '../chat/contracts';
export function questDetails(point:CourierWaypoint|null,reward:number|null=null,xpReward:number|null=null):QuestDetails|null{
 if(!point)return null;
 const c=navigationCatalogue.find(c=>!('testOnly' in c)&&cellKey(c.cell)===cellKey(point.cell)&&c.pos.every((v,i)=>Math.abs(v-point.pos[i]!)<0.01));
 return c?{id:point.id,targetKey:c.key,title:c.title,destination:point.label,reward,xpReward}:null;
}
