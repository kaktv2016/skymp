import { ClientListener, CombinedController, Sp } from "./clientListener";
import { ChangeFormNpc } from "skyrimPlatform";
import { SpawnDestination, isSpawnResumeHeld, setSpawnResumeHeld, validSpawnDestination,
    sameSpawnDestination, matchesSpawnPosition, matchesSpawnDestination,
    isVerifiedSafeSpawn, MAX_SPAWN_RELOCATION_ATTEMPTS } from "./spawnResume";

export class LoadGameService extends ClientListener {
    constructor(private sp: Sp, private controller: CombinedController) {
        super();
        this.controller.on("loadGame", () => this.onLoadGame());
        this.controller.on("update", () => this.updateSpawn());
        this.controller.on("tick", () => this.checkDeadline());
        for (const event of ['connectionAccepted', 'connectionDisconnect', 'connectionDenied', 'connectionFailed'] as const) {
            this.controller.emitter.on(event, () => {
                if (event === 'connectionAccepted') this.foreignLoad = false;
                this.cancelSpawn(!this.foreignLoad);
            });
        }
    }

    private epoch = 0;
    private loadSerial = 0;
    private foreignLoad = false;
    private lastDestination?: SpawnDestination;
    private pending?: {
        epoch: number; destination: SpawnDestination; phase: 'queued' | 'loading' | 'restoring' | 'failed';
        deadline: number; nextMove: number; moveAttempts: number; lastObserved?: SpawnDestination; onReady?: () => void;
    };
    private changedControls = [false, false, false, false];

    public getSpawnEpoch() { return this.epoch; }
    public isCurrentSpawn(epoch: number) { return epoch === this.epoch; }

    private cancelSpawn(hold = true) {
        ++this.epoch;
        this.pending = undefined;
        this.lastDestination = undefined;
        const epoch = this.epoch;
        this.controller.once('update', () => {
            if (this.epoch === epoch) this.restoreControls();
        });
        // A foreign save belongs to single-player; a network loss remains held
        // until the next authenticated actor has actually spawned.
        setSpawnResumeHeld(hold);
    }

    public spawnPlayer(destination: SpawnDestination, npc?: ChangeFormNpc, loadOrder?: string[],
        time?: { seconds: number, minutes: number, hours: number }, onReady?: () => void) {
        if (!this.pending && this.lastDestination && validSpawnDestination(destination) &&
            sameSpawnDestination(this.lastDestination, destination)) return;
        if (this.pending && validSpawnDestination(this.pending.destination) && validSpawnDestination(destination) &&
            sameSpawnDestination(this.pending.destination, destination) && this.pending.phase !== 'failed') return;
        ++this.epoch;
        setSpawnResumeHeld(true);
        const epoch = this.epoch;
        const copy = validSpawnDestination(destination) ? {
            worldOrCell: destination.worldOrCell, pos: destination.pos.slice(), rot: destination.rot.slice()
        } : destination;
        this.lastDestination = validSpawnDestination(copy) ? copy : undefined;
        this.pending = { epoch, destination: copy, phase: 'queued', deadline: Date.now() + 120000, nextMove: 0, moveAttempts: 0, onReady };
        // spawnPlayer is called by the networking tick, including at the main menu:
        // validate only data here; Papyrus form lookup/classification requires update.
        if (!validSpawnDestination(copy)) {
            this.failSpawn('Invalid saved cell or position. Reconnect to retry.');
            return;
        }
        // update runs in-game; two ticks also run at the main menu. Whichever wins selects warm/cold loading.
        this.controller.once('tick', () => this.controller.once('tick', () => {
            const pending = this.pending;
            if (!pending || pending.epoch !== epoch || pending.phase !== 'queued') return;
            pending.phase = 'loading';
            this.diagnostic('cold-load', { destination: pending.destination });
            // Known exterior landing used only in the generated client save; server location stays intact.
            // All cold loads use it, so no destination Papyrus calls run at the main menu.
            const stage: SpawnDestination = { worldOrCell: 0x3c, pos: [133857, -61130, 14662], rot: [0, 0, 72] };
            try { this.loadGame(stage.pos, stage.rot, stage.worldOrCell, npc, loadOrder, time); }
            catch (error) { this.failSpawn('Unable to load saved character. Reconnect to retry.'); }
        }));
    }

    private failSpawn(reason: string) {
        if (!this.pending || this.pending.phase === 'failed') return;
        this.pending.phase = 'failed';
        this.diagnostic('failed', { reason, destination: this.pending.destination, lastObserved: this.pending.lastObserved });
        const message = `Character location restore stopped: ${reason} Saved location is preserved.`;
        this.sp.printConsole(message);
        const epoch = this.epoch;
        this.controller.once('update', () => {
            if (this.epoch === epoch) this.sp.Debug.notification(message);
        });
    }

    private diagnostic(stage: string, details: unknown) {
        try { this.sp.writeLogs('spawnResume', new Date().toISOString() + ' ' + stage + ' ' + JSON.stringify(details)); }
        catch { /* Diagnostics must never interrupt restoration. */ }
    }

    private checkRecoveryOrTimeout(reason: string) {
        const pending = this.pending;
        if (!pending || pending.phase === 'failed') return;
        const actual = pending.lastObserved;
        if (actual && isVerifiedSafeSpawn(actual, pending.destination)) {
            try { pending.onReady?.(); }
            catch (_) { this.failSpawn('Unable to apply saved character state. Reconnect to retry.'); return; }
            if (this.pending !== pending) return;
            this.diagnostic('recovered', { reason, destination: pending.destination, actual });
            this.pending = undefined;
            this.restoreControls();
            setSpawnResumeHeld(false);
            const notice = 'Character location verified with safe tolerance. Ready to play.';
            this.sp.printConsole(notice);
            return;
        }
        this.failSpawn(reason);
    }

    private checkDeadline() {
        if (this.pending && this.pending.phase !== 'failed' && Date.now() > this.pending.deadline) {
            this.checkRecoveryOrTimeout('Timed out waiting for the saved cell. Reconnect to retry.');
        }
    }

    private holdControls() {
        const game = this.sp.Game;
        const enabled = [game.isMovementControlsEnabled(), game.isFightingControlsEnabled(),
            game.isLookingControlsEnabled(), game.isActivateControlsEnabled()];
        enabled.forEach((value, i) => { this.changedControls[i] ||= value; });
        if (enabled.some(Boolean)) game.disablePlayerControls(enabled[0], enabled[1], false, enabled[2], false, false, enabled[3], false, 0);
    }

    private restoreControls() {
        const [move, fight, look, activate] = this.changedControls;
        if (this.changedControls.some(Boolean)) this.sp.Game.enablePlayerControls(move, fight, false, look, false, false, activate, false, 0);
        this.changedControls = [false, false, false, false];
    }

    private updateSpawn() {
        const pending = this.pending;
        if (!pending || !isSpawnResumeHeld()) return;
        this.holdControls();
        this.checkDeadline();
        if (pending.phase === 'failed' || pending.phase === 'loading') return;
        if (pending.phase === 'queued') pending.phase = 'restoring';
        const player = this.sp.Game.getPlayer();
        if (!player) return;
        const destination = pending.destination;
        const form = this.sp.Game.getFormEx(destination.worldOrCell);
        const cell = this.sp.Cell.from(form);
        const world = this.sp.WorldSpace.from(form);
        if (!form || (!cell && !world)) {
            this.failSpawn('Invalid saved cell or position. Reconnect to retry.');
            return;
        }
        const worldOrCell = cell ? player.getParentCell() : player.getWorldSpace();
        const actual: SpawnDestination | undefined = worldOrCell ? { worldOrCell: worldOrCell.getFormID(),
            pos: [player.getPositionX(), player.getPositionY(), player.getPositionZ()],
            rot: [player.getAngleX(), player.getAngleY(), player.getAngleZ()] } : undefined;
        pending.lastObserved = actual;
        if (actual && matchesSpawnDestination(actual, pending.destination)) {
            try { pending.onReady?.(); }
            catch (_) { this.failSpawn('Unable to apply saved character state. Reconnect to retry.'); return; }
            if (this.pending !== pending) return;
            this.diagnostic('restored', { destination });
            this.pending = undefined;
            this.restoreControls();
            setSpawnResumeHeld(false);
            return;
        }
        if (Date.now() < pending.nextMove) return;
        pending.nextMove = Date.now() + 250;
        try {
            if (actual && matchesSpawnPosition(actual, destination)) {
                // Never reopen scene loading only to adjust facing. Papyrus SetAngle uses degrees.
                player.setAngle(destination.rot[0], destination.rot[1], destination.rot[2]);
                return;
            }
            if (++pending.moveAttempts > MAX_SPAWN_RELOCATION_ATTEMPTS) {
                this.checkRecoveryOrTimeout('Exceeded maximum relocation attempts. Reconnect to retry.');
                return;
            }
            // GetAngle* / network transforms use degrees; native MoveTo_Impl uses radians.
            // Wrong units prevent settling and repeatedly restart scene transitions.
            const radians = destination.rot.map(angle => angle * Math.PI / 180);
            this.sp.TESModPlatform.moveRefrToPosition(player, cell, world,
                destination.pos[0], destination.pos[1], destination.pos[2], radians[0], radians[1], radians[2]);
        } catch (_) { this.failSpawn('Unable to move to the saved cell. Reconnect to retry.'); }
    }

    public loadGame(pos: number[], rot: number[], worldOrCell: number, changeFormNpc?: ChangeFormNpc, loadOrder?: string[], time?: { seconds: number, minutes: number, hours: number }) {
        ++this.loadSerial;
        this._isCausedBySkyrimPlatform = true;
        try {
            // @ts-ignore
            this.sp.loadGame(pos, rot, worldOrCell, changeFormNpc, loadOrder, time);
        } catch (e) {
            // Hotfix non-vanilla headparts bug
            try {
                // @ts-ignore
                this.sp.loadGame(pos, rot, worldOrCell, undefined, loadOrder, time);
            } catch (fallbackError) {
                this._isCausedBySkyrimPlatform = false;
                throw fallbackError;
            }
        }
    }

    private onLoadGame() {
        if (!this._isCausedBySkyrimPlatform) {
            // SinglePlayerService closes the native client without a disconnect event.
            // Invalidate restore/inventory callbacks before that service observes the load.
            this.foreignLoad = true;
            this.cancelSpawn(false);
        }
        if (this.pending?.phase === 'loading') this.pending.phase = 'restoring';
        const serial = this.loadSerial;
        try {
            const gameLoadEvent = {
                isCausedBySkyrimPlatform: this._isCausedBySkyrimPlatform
            };
            this.controller.emitter.emit("gameLoad", gameLoadEvent);
        } catch (e) {
            this.controller.once("tick", () => {
                if (serial !== this.loadSerial) return;
                this._isCausedBySkyrimPlatform = false;
            });
            throw e;
        }
        this.controller.once("tick", () => {
            if (serial !== this.loadSerial) return;
            this._isCausedBySkyrimPlatform = false;
        });
    }

    private _isCausedBySkyrimPlatform = false;
}
