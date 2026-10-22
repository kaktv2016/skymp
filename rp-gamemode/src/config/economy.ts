export interface EconomyConfig {baseReward:number;rewardPerLevel:number;upgradeCosts:readonly number[];maximumBalance:number;mutationIntervalMs:number;}
export const economyConfig:EconomyConfig=Object.freeze({baseReward:25,rewardPerLevel:5,upgradeCosts:Object.freeze([100,250,500]),maximumBalance:1000000000,mutationIntervalMs:750});
export function economySettings(overrides:Partial<EconomyConfig>={}):EconomyConfig {
 const c={...economyConfig,...overrides,upgradeCosts:[...(overrides.upgradeCosts??economyConfig.upgradeCosts)]};
 const integer=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
 if(!integer(c.maximumBalance,1,1000000000)||!integer(c.baseReward,1,c.maximumBalance)||!integer(c.rewardPerLevel,0,c.maximumBalance)||!integer(c.mutationIntervalMs,0,60000)||c.upgradeCosts.length<1||c.upgradeCosts.length>10||!c.upgradeCosts.every(p=>integer(p,1,c.maximumBalance))||!integer(c.baseReward+c.rewardPerLevel*c.upgradeCosts.length,1,c.maximumBalance))throw Error('Invalid server economy configuration');
 return Object.freeze({...c,upgradeCosts:Object.freeze(c.upgradeCosts)});
}
