import { ClientListener, CombinedController, Sp } from "./clientListener";
import { NiPoint3 } from "../../sync/movement";
import { ObjectReferenceEx } from "../../extensions/objectReferenceEx";
import { Actor } from "skyrimPlatform";
import { logTrace } from "../../logging";

export class WorldCleanerService extends ClientListener {
  constructor(private sp: Sp, private controller: CombinedController) {
    super();
    this.controller.on("update", () => this.onUpdate());
    this.controller.emitter.on("gameLoad", () => this.onGameLoad());
    this.controller.on("preLoadGame", () => this.resetRetirementSession(true));
    this.controller.on("loadGame", () => this.resetRetirementSession(false));
  }

  modWcProtection(actorId: number, mod: number): void {
    const currentProtection = this.getWcProtection(actorId);
    this.protection.set(actorId, Math.max(0, currentProtection + mod));
    if (mod > 0) {
      this.retiredActors.delete(actorId);
      this.invalidateSpawn(actorId);
    }
  }

  getWcProtection(actorId: number): number {
    return this.protection.get(actorId) || 0;
  }

  getFormRetirementGuard(): () => boolean {
    const session = this.retirementSession;
    return () => session === this.retirementSession && !this.loading;
  }

  // Pure checks are safe in Promise continuations; native form resolution is
  // performed by SpawnProcess only inside its following update callback.
  getActorSpawnGuard(actorId: number): () => boolean {
    const session = this.retirementSession;
    const revision = this.spawnRevisions.get(actorId);
    return () => session === this.retirementSession && !this.loading
      && revision === this.spawnRevisions.get(actorId)
      && this.getWcProtection(actorId) > 0
      && !this.pendingRetirements.has(actorId) && !this.retiredActors.has(actorId);
  }

  private invalidateSpawn(actorId: number): void {
    this.spawnRevisions.set(actorId, (this.spawnRevisions.get(actorId) || 0) + 1);
  }

  // Called once per detached FormView. Resolve forms only on an update in the
  // same game session: a form ID can identify a different object after loading.
  retireForm(actorId: number, ownerIsCurrent?: () => boolean): void {
    if (actorId < 0xff000000 || this.loading) {
      return;
    }
    if (ownerIsCurrent) {
      if (!ownerIsCurrent() || this.releasedOwners.has(ownerIsCurrent)) {
        return;
      }
      this.releasedOwners.add(ownerIsCurrent);
    }
    const pendingReleases = this.pendingRetirements.get(actorId);
    if (pendingReleases !== undefined) {
      // Coalesce native work, but release every distinct FormView lease. Calls
      // without an owner token retain their existing per-frame deduplication.
      if (ownerIsCurrent) {
        this.pendingRetirements.set(actorId, pendingReleases + 1);
      }
      return;
    }
    this.pendingRetirements.set(actorId, 1);
    this.invalidateSpawn(actorId);
    const session = this.retirementSession;
    this.controller.once("update", () => {
      if (session !== this.retirementSession || this.loading) {
        return;
      }
      const releases = this.pendingRetirements.get(actorId) || 0;
      this.pendingRetirements.delete(actorId);
      this.modWcProtection(actorId, -releases);
      if (this.getWcProtection(actorId) > 0) {
        return;
      }
      const refr = this.sp.ObjectReference.from(this.sp.Game.getFormEx(actorId));
      if (!refr || refr.isDeleted()) {
        return;
      }
      const actor = this.sp.Actor.from(refr);
      if (actor) {
        if (actor.getFormID() === 0x14 || this.retiredActors.has(actorId) || !actor.getBaseObject()) {
          return;
        }
        // Reset native overrides while the actor is still valid, before hiding.
        this.sp.TESModPlatform.setWeaponDrawnMode(actor, -1);
        this.hideActor(actor, actorId);
      } else {
        // Non-actor temporary objects have no NPC movement controller.
        refr.delete();
      }
    });
  }

  private resetRetirementSession(loading: boolean): void {
    ++this.retirementSession;
    this.loading = loading;
    this.pendingRetirements.clear();
    this.retiredActors.clear();
    this.protection.clear();
    this.spawnRevisions.clear();
    this.initialPos = undefined;
    this.initialCellOrWorld = undefined;
    // LoadGameService may emit gameLoad before this native loadGame listener.
    // Capture the new session only after every load listener has completed.
    this.initialPositionCaptureSession = loading ? undefined : this.retirementSession;
  }

  private hideActor(actor: Actor, actorId: number): void {
    this.retiredActors.add(actorId);
    // DisableNoWait is already supported by the installed SP API. Do not mark
    // actors deleted while native AI/movement may still hold them, and do not
    // call native functions from a latent Disable Promise continuation.
    actor.disableNoWait(this.isActorInDialogue(actor));
  }

  private onGameLoad() {
    this.initialPositionCaptureSession = this.retirementSession;
  }

  private captureInitialPosition() {
    const player = this.sp.Game.getPlayer();
    if (!player) {
      return;
    }

    this.initialPos = ObjectReferenceEx.getPos(player);
    this.initialCellOrWorld = ObjectReferenceEx.getWorldOrCell(player);
  }

  private onUpdate() {
    if (this.loading) {
      return;
    }
    if (this.initialPositionCaptureSession === this.retirementSession) {
      this.initialPositionCaptureSession = undefined;
      this.captureInitialPosition();
    }
    this.processOneActor();
  }

  private processOneActor() {
    const pc = this.sp.Game.getPlayer();
    if (pc === null) {
      return;
    }

    const actor = this.sp.Game.findRandomActor(
      pc.getPositionX(),
      pc.getPositionY(),
      pc.getPositionZ(),
      8192
    );
    if (actor === null) {
      return;
    }

    const actorId = actor.getFormID();

    const currentProtection = this.protection.get(actorId) || 0;
    if (currentProtection > 0) {
      return;
    }

    if (actorId === 0x14 || this.retiredActors.has(actorId) || actor.isDeleted() || !actor.getBaseObject() || actor.isDisabled()) {
      return;
    }

    if (this.isActorInDialogue(actor)) {
      // Deleting actor in dialogue crashes Skyrim
      // https://github.com/skyrim-multiplayer/issue-tracker/issues/13
      this.hideActor(actor, actorId);
      return;
    }

    // Keep vanilla pre-placed bodies; dynamic bodies follow actor retirement.
    if (actor.isDead() && actorId < 0xff000000) {
      actor.blockActivation(true);
      return;
    }

    const pos = ObjectReferenceEx.getPos(actor);
    const cellOrWorld = ObjectReferenceEx.getWorldOrCell(actor);

    const chickenRace = 0xa919d;

    // We discovered anomaly chickens that fail to Disable if we load game near to them
    // Refs: 106C22, 106C23
    if (actorId < 0xff000000 && actor.getRace()?.getFormID() === chickenRace) {
      if (this.initialPos && ObjectReferenceEx.getDistanceNoZ(pos, this.initialPos) < 4096) {
        if (cellOrWorld === this.initialCellOrWorld) {
          if (this.isActorInDialogue(actor)) {
            return;
          }
          logTrace(this, `Deleting chicken anomaly`, actorId.toString(16));
          actor.killSilent(null);
          actor.blockActivation(true);
          actor.disableNoWait(false);
          actor.setAlpha(0, false);
          return;
        }
      }
    }

    this.hideActor(actor, actorId);
  }

  private isActorInDialogue(ac: Actor) {
    return ac.isInDialogueWithPlayer() || ac.getDialogueTarget() !== null;
  }

  private protection = new Map<number, number>();
  private pendingRetirements = new Map<number, number>();
  private releasedOwners = new WeakSet<() => boolean>();
  private spawnRevisions = new Map<number, number>();
  private retiredActors = new Set<number>();
  private retirementSession = 0;
  private loading = false;
  private initialPositionCaptureSession?: number;
  private initialPos?: NiPoint3;
  private initialCellOrWorld?: number;
}
