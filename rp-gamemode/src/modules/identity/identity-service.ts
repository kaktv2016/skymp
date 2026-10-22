import { SkyMpAdapter, IdentityMetadata } from '../../engine/adapter';
import { ActorId, ProfileId, FormDesc } from '../../engine/ids';
import { ProfileLimits, ProfileResult, profileLimits, profileView, validateProfilePatch } from './profile-validation';

export interface IdentityView {
  readonly actorId: ActorId;
  readonly profileId: ProfileId;
  readonly formDesc: FormDesc;
  readonly metadata: IdentityMetadata;
}

export class IdentityService {
  readonly limits:ProfileLimits;
  private readonly now:()=>number;
  private readonly updates=new Map<ActorId,{guid:string;at:number}>();
  constructor(private readonly adapter: SkyMpAdapter,options:Partial<ProfileLimits>&{now?:()=>number}={}) {
    const {now=Date.now,...overrides}=options;this.now=now;this.limits=profileLimits(overrides);
  }
  profile(actor:ActorId):ProfileResult {
    try {
      this.adapter.sessionForActor(actor);
      const current=this.lookup(actor);
      return current?{ok:true,data:profileView(current.metadata,this.limits)}:{ok:false,code:'IDENTITY_NOT_READY',message:'RP identity is not ready'};
    } catch { return {ok:false,code:'PROFILE_UNAVAILABLE',message:'Profile/session unavailable; unsupported saved metadata is preserved'}; }
  }
  update(actor:ActorId,patch:unknown):ProfileResult {
    try {
      const session=this.adapter.sessionForActor(actor),current=this.lookup(actor);
      if(!current) return {ok:false,code:'IDENTITY_NOT_READY',message:'RP identity is not ready'};
      let next:IdentityMetadata;
      try { next=validateProfilePatch(patch,current.metadata,this.limits); }
      catch(error) { return {ok:false,code:'INVALID_PROFILE',message:error instanceof Error?error.message:'Invalid profile'}; }
      const at=this.now(),previous=this.updates.get(actor);
      if(previous?.guid===session.guid && at-previous.at<this.limits.intervalMs) return {ok:false,code:'PROFILE_THROTTLED',message:'Please wait before updating your profile again'};
      if(this.adapter.sessionForActor(actor).guid!==session.guid) return {ok:false,code:'PROFILE_SESSION_CHANGED',message:'Connection changed; reopen your profile'};
      this.adapter.writeIdentity(actor,next); // One validated write; no native character-state setters.
      this.updates.set(actor,{guid:session.guid,at});
      return {ok:true,data:profileView(next,this.limits)};
    } catch { return {ok:false,code:'PROFILE_UNAVAILABLE',message:'Profile/session unavailable; saved metadata is preserved'}; }
  }
  prune(actors:readonly ActorId[]) { for(const actor of this.updates.keys()) if(!actors.includes(actor)) this.updates.delete(actor); }
  lookup(actor: ActorId): IdentityView | null {
    const profile = this.adapter.profileForActor(actor);
    const desc = this.adapter.describe(actor);
    const metadata = this.adapter.readIdentity(actor);
    return metadata === null ? null : { actorId: actor, profileId: profile, formDesc: desc, metadata };
  }
  ensure(actor: ActorId): IdentityView {
    const current = this.lookup(actor);
    if (current !== null) return current;
    const metadata: IdentityMetadata = { schemaVersion: 1, displayName: this.adapter.actorName(actor) };
    this.adapter.writeIdentity(actor, metadata);
    const saved = this.lookup(actor);
    if (saved === null || JSON.stringify(saved.metadata) !== JSON.stringify(metadata)) {
      throw new Error('RP identity native write did not roundtrip');
    }
    return saved;
  }
}
