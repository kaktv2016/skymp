// ActionListener::OnCustomEvent accepts client event names only with '_' prefix.
export const CHAT_EVENT = '_onRpChatV1';
export const CHAT_INBOX = 'rpChatInboxV1';
export type ChatKind = 'Local' | 'ME' | 'DO' | 'System';
export interface ChatMessage { seq: number; kind: ChatKind; sender: string; text: string; }
export interface CourierWaypoint { id:string; cell:string; pos:readonly [number,number,number]; label:string; style?:string; }
export interface QuestDetails {id:string;targetKey:string;title:string;destination:string;reward:number|null;xpReward:number|null;explicitDoors?:boolean;}
export interface ChatEnvelope { v: 1; epoch: string; messages: ChatMessage[]; profile?:import('../identity/profile-validation').ProfileResponse; commands?:readonly string[]; navigation?:CourierWaypoint|null; quest?:QuestDetails|null;admin?:import('../admin/admin-service').AdminMovement|null; }
export interface ChatConfig {
  openKey: number; maxLength: number; intervalMs: number; range: number;
  inboxLimit: number; historyLimit: number;
  uiUrl: string;
}
export const defaults: ChatConfig = { openKey:65, maxLength:280, intervalMs:750, range:2000, inboxLimit:40, historyLimit:100,
  uiUrl:'file:///C:/Program%20Files%20(x86)/Steam/steamapps/common/Skyrim%20Special%20Edition/Data/Platform/UI/rp-chat/index.html' };
export function chatConfig(overrides: Partial<ChatConfig> = {}): ChatConfig {
  const c = { ...defaults, ...overrides };
  for (const [key,min,max] of [['openKey',2,255],['maxLength',1,400],['intervalMs',100,60000],['inboxLimit',1,100],['historyLimit',1,200]] as const) {
    if (!Number.isInteger(c[key]) || c[key] < min || c[key] > max) throw new TypeError(`Invalid chat ${key}`);
  }
  if (!Number.isFinite(c.range) || c.range < 0 || c.range > 100000) throw new TypeError('Invalid chat range');
  if (typeof c.uiUrl !== 'string' || c.uiUrl.length > 2048 || !/^file:\/\/\/[A-Za-z]:\//.test(c.uiUrl) || /[\x00-\x20\x7f]/.test(c.uiUrl)) throw new TypeError('Invalid isolated chat UI file URL');
  return c;
}
