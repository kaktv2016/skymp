/** Fixed, read-only inspected shipped meshes. No spells, scripts or asset downloads. */
export const beaconStyles=[
 {id:'beam',label:'Ambient beam',model:'Effects\\Ambient\\FXAmbBeamXbDust02.nif',scale:2},
 {id:'dust',label:'Dust beam',model:'Effects\\Ambient\\FXAmbBeamDust02.nif',scale:2},
 {id:'mist',label:'Mist beam',model:'Effects\\Ambient\\FXAmbBeamWetMist01.nif',scale:2},
 {id:'orb',label:'Magelight orb',model:'Magic\\LightSpellStaticLight.nif',scale:2},
 {id:'soul',label:'Soul Cairn beam',model:'DLC01\\Effects\\FXSoulCairnBeam.nif',scale:1},
 {id:'portal',label:'Soul portal',model:'DLC01\\Effects\\FXDLC1SCTransPortal.nif',scale:1},
 {id:'vortex',label:'Tel Mithryn vortex',model:'DLC02\\Effects\\DLC2TelMithrynTeleportFXActivate.nif',scale:1},
 {id:'amber',label:'Frostveil amber column (Pack 1.0.2)',model:'Frostveil\\Courier\\column_amber.nif',scale:1},
 {id:'column',label:'Tel Mithryn column',model:'DLC02\\Effects\\DLC2TelMithrynTeleportFXActivateBeam.nif',scale:1},
 {id:'rune',label:'Dark rune',model:'Magic\\RuneTestDark.nif',scale:1.5},
 {id:'summon',label:'Conjuration art',model:'Magic\\MagInvSummon.nif',scale:2},
 {id:'arcane',label:'Apocrypha art',model:'DLC02\\Magic\\MagInvApocryphaReward.nif',scale:2},
 {id:'holy',label:'Turn Undead art',model:'Magic\\MagInvTurnUndead.nif',scale:2}
] as const;
export interface BeaconStyle {readonly id:string;readonly label:string;readonly model:string;readonly scale:number;}
