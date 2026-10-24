import { CommandRegistry } from '../../core/command-registry';
import { ActorId, actorId } from '../../engine/ids';
import { SkyMpAdapter } from '../../engine/adapter';
import { IdentityService, IdentityView } from '../identity/identity-service';
import { ChatConfig, ChatEnvelope, ChatKind, CourierWaypoint } from './contracts';
import type { ProfileResponse, ProfileView } from '../identity/profile-validation';

export function selectRecipients(adapter: SkyMpAdapter, sender: ActorId, range: number): ActorId[] {
  adapter.sessionForActor(sender);
  const origin = adapter.location(sender);
  const recipients = [sender];
  for (const actor of adapter.onlineActors()) {
    if (actor === sender) continue;
    try {
      adapter.sessionForActor(actor);
      const target = adapter.location(actor);
      if (target.cell === origin.cell && target.pos.reduce((sum, value, i) => sum + (value - origin.pos[i]!) ** 2, 0) <= range ** 2) recipients.push(actor);
    } catch { /* Invalid/stale recipients are excluded, never broadcast. */ }
  }
  return recipients;
}
interface Session { guid: string; envelope: ChatEnvelope; seen: Set<string>; lastInput: number; lastFeedback: number; seq: number; }
export class ChatService {
  private readonly sessions = new Map<ActorId, Session>();
  private epoch = 0;
  private navigation:((actor:ActorId)=>CourierWaypoint|null)=()=>null;
  private quest:((actor:ActorId)=>ChatEnvelope['quest'])=()=>null;
  private admin:((actor:ActorId)=>ChatEnvelope['admin'])=()=>null;
  private adminAckHandler: ((actor: ActorId, id: string, cell: unknown, pos: unknown) => void) | null = null;
  setNavigation(provider:(actor:ActorId)=>CourierWaypoint|null):void{this.navigation=provider;}
  setQuest(provider:(actor:ActorId)=>ChatEnvelope['quest']):void{this.quest=provider;}
  setAdmin(provider:(actor:ActorId)=>ChatEnvelope['admin'], ackHandler?: ((actor: ActorId, id: string, cell: unknown, pos: unknown) => void) | undefined):void{
    this.admin=provider;
    this.adminAckHandler=ackHandler??null;
  }
  sendSystem(actor: ActorId, message: string): void {
    try {
      const session = this.session(actor);
      this.push(actor, session, 'System', '', message);
      this.refresh(actor, session);
    } catch {}
  }
  private refresh(actor:ActorId,session:Session):boolean {
    const before=JSON.stringify([session.envelope.commands,session.envelope.navigation,session.envelope.quest,session.envelope.admin]);
    try{session.envelope.admin=this.admin(actor)??null;}catch{session.envelope.admin=null;}
    session.envelope.commands=this.commands.completions().filter(c=>session.envelope.admin!==null||!/^\/(?:admin|npc|editor)(?: |$)/.test(c));
    try{session.envelope.navigation=this.navigation(actor);}catch{session.envelope.navigation=null;}
    try{session.envelope.quest=this.quest(actor)??null;}catch{session.envelope.quest=null;}
    return before!==JSON.stringify([session.envelope.commands,session.envelope.navigation,session.envelope.quest,session.envelope.admin]);
  }
  private readonly bootId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  constructor(private readonly adapter: SkyMpAdapter, private readonly identity: IdentityService, private readonly commands: CommandRegistry, private readonly config: ChatConfig, private readonly now: () => number) {}
  private session(actor: ActorId): Session {
    const native = this.adapter.sessionForActor(actor);
    let value = this.sessions.get(actor);
    if (!value || value.guid !== native.guid) {
      value = { guid:native.guid, envelope:{ v:1, epoch:this.bootId + '-' + (++this.epoch), messages:[] }, seen:new Set(), lastInput:-Infinity, lastFeedback:-Infinity, seq:0 };
      this.sessions.set(actor,value);
      this.push(actor, value, 'System', '', 'RP chat ready. Use the configured chat key; /profile, /whoami, /me, /do.');
    }
    return value;
  }
  private push(actor: ActorId, session: Session, kind: ChatKind, sender: string, text: string): void {
    this.refresh(actor,session);
    session.envelope.messages.push({ seq:++session.seq, kind, sender, text });
    session.envelope.messages = session.envelope.messages.slice(-this.config.inboxLimit);
    this.adapter.writeChatInbox(actor, { ...session.envelope, messages:session.envelope.messages.map(m=>({...m})) });
  }
  sync(): void {
    const online = this.adapter.onlineActors();
    for (const actor of this.sessions.keys()) if (!online.includes(actor)) this.sessions.delete(actor);
    for (const actor of online) { try {const session=this.session(actor);if(this.refresh(actor,session))this.adapter.writeChatInbox(actor,{...session.envelope,messages:session.envelope.messages.map(m=>({...m}))}); } catch { /* Stale slots do not block another actor. */ } }
  }
  clear(): void { this.sessions.clear(); }
  private identityFor(actor: ActorId): IdentityView {
    this.adapter.sessionForActor(actor);
    const identity = this.identity.lookup(actor);
    if (!identity) throw new Error('RP identity is not ready');
    return identity;
  }
  formatAction(actor: ActorId, args: readonly string[], kind: 'ME' | 'DO') {
    if (!args.length) return { ok:false as const, code:'INVALID_ARGUMENTS', message:`Usage: /${kind.toLowerCase()} [${kind === 'ME' ? 'action' : 'description'}]` };
    const identity = this.identityFor(actor);
    const text = args.join(' ');
    return { ok:true as const, data:{ kind, sender:identity.metadata.displayName, text:kind === 'ME' ? `* ${identity.metadata.displayName} ${text}` : `[DO] ${text}` } };
  }
  async receive(rawActor: unknown, raw: unknown): Promise<void> {
    let actor: ActorId, session: Session;
    try { actor=actorId(rawActor); session=this.session(actor); } catch { return; }
    // Bound feedback as well as accepted messages to avoid unbounded property writes.
    const at=this.now();
    const request=raw && typeof raw==='object' && !Array.isArray(raw)?raw as Record<string,unknown>:null;
    const profileRequest=request!==null && request.op!==undefined;
    const respond=(action:ProfileResponse['action'],message:string,profile?:ProfileView)=> {
      const requestId=typeof request?.id==='string' && /^[A-Za-z0-9_-]{1,80}$/.test(request.id)?request.id:'invalid';
      session.envelope.profile={token:session.envelope.epoch+':profile:'+(session.seq+1),requestId,action,message,...(profile?{profile}:{})};
      this.push(actor,session,'System','',message);
    };
    const error = (message: string) => {
      if (at - session.lastFeedback >= this.config.intervalMs) { session.lastFeedback=at; if(profileRequest) respond('error',message);else this.push(actor,session,'System','',message); }
    };
    if (!request) { error('Invalid chat request'); return; }
    const isTpConfirm = typeof request === 'object' && request !== null && (request as Record<string, unknown>).op === 'tp-confirm';
    if (isTpConfirm) {
      const r = request as Record<string, unknown>;
      if (r.v !== 1 || typeof r.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(r.id)) return;
      this.adminAckHandler?.(actor, r.id, r.cell, r.pos);
      return;
    }
    const allowed=profileRequest?(request.op==='profile-save'?['v','id','op','displayName','biography']:['v','id','op']):['v','id','text'];
    if (Object.keys(request).some(k=>!allowed.includes(k)) || request.v !== 1 || typeof request.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(request.id) || (profileRequest?(typeof request.op!=='string' || !['profile-read','profile-save'].includes(request.op)):typeof request.text!=='string')) { error('Invalid chat/profile request'); return; }
    if (session.seen.has(request.id)) return;
    session.seen.add(request.id);
    if (session.seen.size > 64) session.seen.delete(session.seen.values().next().value!);
    if (at - session.lastInput < this.config.intervalMs) { error('Please wait before sending another message'); return; }
    session.lastInput=at;
    if(profileRequest) {
      const result=request.op==='profile-read'?this.identity.profile(actor):this.identity.update(actor,{displayName:request.displayName,biography:request.biography});
      if(!result.ok) { error(result.message);return; }
      respond(request.op==='profile-read'?'open':'saved',request.op==='profile-read'?`RP profile: ${result.data.displayName} | Biography: ${result.data.biography||'(empty)'}`:'Profile saved',result.data);
      return;
    }
    if(typeof request.text!=='string') { error('Invalid chat request');return; }
    if (request.text.length > this.config.maxLength * 2) { error('Invalid or too long chat message'); return; }
    const text=request.text.trim().normalize('NFC');
    if (!text) { error('Chat message is empty'); return; }
    if ([...text].length > this.config.maxLength || /[\x00-\x1f\x7f-\x9f]/.test(request.text) || /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(text)) { error('Invalid or too long chat message'); return; }
    try {
      let kind: ChatKind='Local', sender=this.identityFor(actor).metadata.displayName, formatted=`${sender}: ${text}`;
      if (text.startsWith('/')) {
        const result=await this.commands.dispatch(text,{actorId:actor});
        if (this.sessions.get(actor) !== session || this.adapter.sessionForActor(actor).guid !== session.guid) return;
        if (!result.ok) { error(result.message); return; }
        const command=text.slice(1).split(/\s+/)[0]!.toLowerCase();
        if (command === 'job' || command === 'wallet' || command==='admin' || command==='beacon' || command==='npc' || command==='editor') {
          const data = result.data as { systemMessage: string };
          this.push(actor, session, 'System', '', data.systemMessage);
          return;
        }
        if (command==='whoami') {
          const view=result.data as IdentityView;
          this.push(actor,session,'System','',`RP name: ${view.metadata.displayName}`);
          return;
        }
        if(command==='profile' || command==='setrpname' || command==='setbio') {
          const data=result.data as {systemMessage:string;profile?:ProfileView};
          if(command==='profile' && data.profile) respond('open',data.systemMessage,data.profile);
          else this.push(actor,session,'System','',data.systemMessage);
          return;
        }
        if (!['me','do','roll','try'].includes(command)) { error('Unsupported chat command'); return; }
        const data=result.data as { kind:'ME'|'DO'; sender:string; text:string };
        kind=data.kind; sender=data.sender; formatted=data.text;
      }
      const recipients=selectRecipients(this.adapter,actor,this.config.range);
      for (const recipient of recipients) { try { this.push(recipient,this.session(recipient),kind,sender,formatted); } catch { /* Disconnected recipients are skipped. */ } }
    } catch { error('Chat unavailable: identity, connection or native location is not ready'); }
  }
}
