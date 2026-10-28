/** Owns only the named RP hook. Never clears native login/spawn handlers. */
export class EventRouter {
  private readonly owned = new Set<string>();
  private readonly raw: Record<string, unknown>;
  constructor(raw: unknown) {
    if (!raw || typeof raw !== 'object') throw new TypeError('Native event target unavailable');
    this.raw = raw as Record<string, unknown>;
  }
  register(name: string, listener: (...args: unknown[]) => void): () => void {
    return this.own(name, listener, false);
  }
  /** Explicit synchronous veto hooks only; ordinary asynchronous RP hooks keep their contract. */
  registerVeto(name:string,listener:(...args:unknown[])=>boolean):()=>void {
    return this.own(name, listener, true);
  }
  private own(name:string,listener:(...args:unknown[])=>unknown,veto:boolean):()=>void {
    if (!/^_?[A-Za-z][A-Za-z0-9_]*$/.test(name) || this.owned.has(name)) throw new Error('Duplicate or invalid owned event');
    const previous = this.raw[name];
    if (previous !== undefined && typeof previous !== 'function') throw new TypeError('Existing event is not callable');
    const wrapped = (...args: unknown[]) => {
      if (typeof previous === 'function' && previous.apply(this.raw, args) === false) return false;
      const result=listener(...args);
      if(veto)return result===true;
      return true; // Native synchronous event contract; async chat is not a veto.
    };
    this.owned.add(name);
    this.raw[name] = wrapped;
    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      if (this.raw[name] === wrapped) {
        if (previous === undefined) delete this.raw[name];
        else this.raw[name] = previous;
      }
      this.owned.delete(name);
    };
  }
}
