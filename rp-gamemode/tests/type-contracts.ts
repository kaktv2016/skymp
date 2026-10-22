import { ActorId, UserId, ProfileId, FormDesc } from '../src/engine/ids';
import { SkyMpAdapter } from '../src/engine/adapter';
declare const actor: ActorId;
declare const user: UserId;
declare const profile: ProfileId;
declare const descriptor: FormDesc;
declare const adapter: SkyMpAdapter;
adapter.profileForActor(actor);
// @ts-expect-error A connection slot is not an actor ID.
adapter.profileForActor(user);
// @ts-expect-error A profile ID is not an actor ID.
adapter.profileForActor(profile);
// @ts-expect-error A descriptor is not an actor ID.
adapter.profileForActor(descriptor);
// @ts-expect-error Native mutation is absent from the safe facade.
adapter.set(actor, 'inventory', {});
// @ts-expect-error Actor creation is absent from the safe facade.
adapter.createActor();
