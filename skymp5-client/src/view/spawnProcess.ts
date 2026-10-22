import { ObjectReference, Game, Actor, MotionType, once, printConsole } from "skyrimPlatform";
import { Appearance, applyTints } from "../sync/appearance";
import { NiPoint3 } from "../sync/movement";
import { ObjectReferenceEx } from "../extensions/objectReferenceEx";
import { SpApiInteractor } from "../services/spApiInteractor";
import { WorldCleanerService } from "../services/services/worldCleanerService";

export class SpawnProcess {
  private isCurrent: () => boolean;

  constructor(
    appearance: Appearance | null,
    pos: NiPoint3,
    refrId: number,
    private callback: () => void,
  ) {
    const cleaner = SpApiInteractor.getControllerInstance().lookupListener(WorldCleanerService);
    this.isCurrent = cleaner.getActorSpawnGuard(refrId);
    this.onUpdate(() => {
      const refr = this.getReference(refrId);
      if (refr) {
        this.after(refr.setPosition(...pos), () => this.enable(appearance, refrId));
      }
    });
  }

  private onUpdate(action: () => void): void {
    once("update", () => {
      if (this.isCurrent()) {
        action();
      }
    });
  }

  private after(operation: Promise<void>, action: () => void): void {
    // Promise continuations only enqueue work; all native calls stay on update.
    operation.then(() => this.onUpdate(action), error => {
      this.onUpdate(() => printConsole(`SpawnProcess failed: ${error}`));
    });
  }

  private getReference(refrId: number): ObjectReference | null {
    if (!this.isCurrent()) {
      return null;
    }
    const refr = ObjectReference.from(Game.getFormEx(refrId));
    if (!refr || refr.getFormID() !== refrId || refr.isDeleted() || !refr.getBaseObject()) {
      return null;
    }
    return refr;
  }

  private enable(appearance: Appearance | null, refrId: number): void {
    const refr = this.getReference(refrId);
    if (!refr) {
      return;
    }
    const ac = Actor.from(refr);
    if (ac && appearance) {
      applyTints(ac, appearance);
    }
    this.after(refr.enable(false), () => this.resurrect(refrId));
  }

  private resurrect(refrId: number): void {
    const refr = this.getReference(refrId);
    if (!refr) {
      return;
    }
    const ac = Actor.from(refr);
    if (ac) {
      this.after(ac.resurrect(), this.callback);
      return;
    }
    ObjectReferenceEx.dealWithRef(refr, refr.getBaseObject()!);
    this.after(refr.setMotionType(MotionType.Keyframed, true), this.callback);
  }
}
