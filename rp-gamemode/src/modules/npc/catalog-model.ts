/** Serializable catalog metadata shared with the admin view. No native or Node code. */
export interface TemplateAssignment {catalogId:string;catalogVersion:number;catalogHash:string;base:string;assetManifestRevision:string;}
export interface TemplateMetadata {
 appearancePreset:string;raceLabel:string;sex:string;category:string;outfitLabel:string;
 outfitItems:{form:string;label:string;slots:number}[];faceGen:{path:string;sha256:string;size:number}[];
 dependencies:{filename:string;sha256:string}[];approval:'DEVELOPMENT_ONLY';renderProof:'PENDING_RENDER_PROOF';
}
export interface ApprovedTemplate {id:string;displayName:string;base:string;baseId:number;assignment:TemplateAssignment;details:{description:string;appearance:{race:string;sex:string;headParts:string[]};fixedOutfit:{form:string;items:string[]};weapon:{form:string;count:number}|null;requiredPlugin:string;requiredPluginSHA256:string;metadata?:TemplateMetadata};}
