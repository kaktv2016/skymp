import type {Edge} from '@xyflow/react';
import {
  validateDraftGraph,
  validatePresentation,
  emptyPresentation,
  type Graph,
  type Node,
  type EditorPresentation,
  type VisualGroup,
  type GroupColor
} from '../../rp-gamemode/src/modules/dialogue/graph-model';
import {
  NODE_WIDTH,
  nodeHeight,
  edgesFromNodes,
  type Canvas,
  type BlueprintNode
} from './mapping';
import {nodeInfo, actionLabels, conditionLabels} from './inspection';

export {emptyPresentation, validatePresentation};
export type {EditorPresentation, VisualGroup, GroupColor};

const ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const RESERVED_IDS = new Set(['constructor', 'prototype', '__proto__']);

export function isValidLocalId(value: unknown): value is string {
  return typeof value === 'string' && !RESERVED_IDS.has(value) && ID_PATTERN.test(value);
}

export function makeUniqueId(prefix: string, used: ReadonlySet<string>, randomSuffix?: () => string): string {
  const cleanPrefix = prefix.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^[^a-z]+/, '') || 'node';
  for (let attempt = 0; attempt < 64; attempt++) {
    const raw = randomSuffix ? randomSuffix() : crypto.randomUUID().slice(0, 8);
    const suffix = raw.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || String(attempt + 1);
    const candidate = `${cleanPrefix.slice(0, 48)}-${suffix}`.slice(0, 64);
    if (isValidLocalId(candidate) && !used.has(candidate)) return candidate;
  }
  throw Error('Could not allocate unique identifier');
}

export interface CatalogOptions {
  routes: readonly {id: string; label: string}[];
  permits: readonly {id: string; label: string}[];
  routeIds: readonly string[];
  permitIds: readonly string[];
  actions?: readonly string[];
  conditions?: readonly string[];
}

export interface PendingConnectionSource {
  source: string;
  sourceHandle: string;
}

export interface QuickPaletteItem {
  id: string;
  kind: 'node' | 'group';
  nodeType?: Node['type'];
  action?: Node['action'];
  argument?: string;
  condition?: Node['condition'];
  label: string;
  subtitle: string;
  category: 'CONVERSATION' | 'FLOW & LOGIC' | 'SERVICES' | 'ANNOTATIONS';
  keywords: string;
}

export function canSourceConnect(canvas: Canvas, pending: PendingConnectionSource): boolean {
  const sourceNode = canvas.nodes.find(n => n.id === pending.source)?.data.runtime;
  if (!sourceNode || sourceNode.type === 'end') return false;
  if (sourceNode.type === 'choices') {
    return !!sourceNode.choices?.some(c => 'choice:' + c.id === pending.sourceHandle);
  }
  if (sourceNode.type === 'condition') {
    return pending.sourceHandle === 'next' || pending.sourceHandle === 'otherwise';
  }
  return pending.sourceHandle === 'next';
}

export function buildQuickPaletteItems(
  catalog: CatalogOptions | null | undefined,
  hasEntry: boolean,
  pendingSource?: PendingConnectionSource | null
): QuickPaletteItem[] {
  const connectingFromOutput = !!pendingSource;
  const items: QuickPaletteItem[] = [];

  if (!hasEntry && !connectingFromOutput) {
    items.push({
      id: 'node:entry',
      kind: 'node',
      nodeType: 'entry',
      label: nodeInfo.entry.label,
      subtitle: nodeInfo.entry.hint,
      category: 'FLOW & LOGIC',
      keywords: `entry start เริ่มบทสนทนา จุดเริ่มต้น ${nodeInfo.entry.hint}`
    });
  }

  items.push(
    {
      id: 'node:npc',
      kind: 'node',
      nodeType: 'npc',
      label: nodeInfo.npc.label,
      subtitle: nodeInfo.npc.hint,
      category: 'CONVERSATION',
      keywords: `npc dialogue text speech บทพูด ข้อความ สนทนา ${nodeInfo.npc.hint}`
    },
    {
      id: 'node:choices',
      kind: 'node',
      nodeType: 'choices',
      label: nodeInfo.choices.label,
      subtitle: nodeInfo.choices.hint,
      category: 'CONVERSATION',
      keywords: `choices player response branch ตัวเลือก คำตอบ แตกแขนง ${nodeInfo.choices.hint}`
    },
    {
      id: 'node:condition:courierIdle',
      kind: 'node',
      nodeType: 'condition',
      condition: 'courierIdle',
      label: `${nodeInfo.condition.label} · ${conditionLabels.courierIdle}`,
      subtitle: 'แยกเส้นทางเมื่อผู้เล่นว่างจากงานส่งของ',
      category: 'FLOW & LOGIC',
      keywords: `condition courierIdle ตรวจเงื่อนไข ไม่มีงาน ว่าง ${conditionLabels.courierIdle}`
    },
    {
      id: 'node:condition:always',
      kind: 'node',
      nodeType: 'condition',
      condition: 'always',
      label: `${nodeInfo.condition.label} · ${conditionLabels.always}`,
      subtitle: 'ผ่านเงื่อนไขเสมอสำหรับการทดสอบเส้นทาง',
      category: 'FLOW & LOGIC',
      keywords: `condition always ตรวจเงื่อนไข ผ่านเสมอ ${conditionLabels.always}`
    }
  );

  for (const act of ['contracts', 'rank', 'permits'] as const) {
    items.push({
      id: `node:action:${act}`,
      kind: 'node',
      nodeType: 'action',
      action: act,
      label: `${actionLabels[act]}`,
      subtitle: 'บริการกิลด์ Courier',
      category: 'SERVICES',
      keywords: `action service ${act} บริการกิลด์ ${actionLabels[act]}`
    });
  }

  const routes = catalog?.routes ?? [];
  if (routes.length > 0) {
    for (const route of routes) {
      items.push({
        id: `node:action:accept:${route.id}`,
        kind: 'node',
        nodeType: 'action',
        action: 'accept',
        argument: route.id,
        label: `${actionLabels.accept} · ${route.label}`,
        subtitle: `Route ID: ${route.id}`,
        category: 'SERVICES',
        keywords: `action service accept route รับงาน รับสัญญาส่งของ ${route.id} ${route.label}`
      });
    }
  } else {
    items.push({
      id: 'node:action:accept',
      kind: 'node',
      nodeType: 'action',
      action: 'accept',
      label: actionLabels.accept,
      subtitle: 'รับสัญญาส่งของตามเส้นทางที่กำหนด',
      category: 'SERVICES',
      keywords: `action service accept route รับงาน รับสัญญาส่งของ`
    });
  }

  const permits = catalog?.permits ?? [];
  if (permits.length > 0) {
    for (const permit of permits) {
      items.push({
        id: `node:action:buyPermit:${permit.id}`,
        kind: 'node',
        nodeType: 'action',
        action: 'buyPermit',
        argument: permit.id,
        label: `${actionLabels.buyPermit} · ${permit.label}`,
        subtitle: `Permit ID: ${permit.id}`,
        category: 'SERVICES',
        keywords: `action service buyPermit permit ซื้อใบอนุญาต ${permit.id} ${permit.label}`
      });
    }
  } else {
    items.push({
      id: 'node:action:buyPermit',
      kind: 'node',
      nodeType: 'action',
      action: 'buyPermit',
      label: actionLabels.buyPermit,
      subtitle: 'ซื้อใบอนุญาตกิลด์ที่กำหนด',
      category: 'SERVICES',
      keywords: `action service buyPermit permit ซื้อใบอนุญาต`
    });
  }

  items.push({
    id: 'node:end',
    kind: 'node',
    nodeType: 'end',
    label: nodeInfo.end.label,
    subtitle: nodeInfo.end.hint,
    category: 'FLOW & LOGIC',
    keywords: `end exit close จบบทสนทนา ออก ปิด ${nodeInfo.end.hint}`
  });

  if (!connectingFromOutput) {
    items.push({
      id: 'group:comment',
      kind: 'group',
      label: 'กลุ่มโหนด / กรอบบันทึก (Visual Group & Comment)',
      subtitle: 'คำอธิบายและจัดกลุ่มบนแคนวาส (ไม่ส่งผลต่อ Runtime)',
      category: 'ANNOTATIONS',
      keywords: 'group comment note frame กลุ่ม บันทึก คอมเมนต์ กรอบ คำอธิบาย'
    });
  }

  return items;
}

export function filterQuickPalette(items: readonly QuickPaletteItem[], query: string): QuickPaletteItem[] {
  const words = query.normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [...items];
  return items.filter(item => {
    const haystack = `${item.label} ${item.subtitle} ${item.keywords}`.normalize('NFKC').toLocaleLowerCase();
    return words.every(w => haystack.includes(w));
  });
}

export function createDefaultRuntimeNode(
  type: Node['type'],
  usedIds: ReadonlySet<string>,
  options?: {
    action?: Node['action'];
    argument?: string;
    condition?: Node['condition'];
    text?: string;
    defaultRouteId?: string;
    defaultPermitId?: string;
    randomSuffix?: () => string;
  }
): Node {
  const id = type === 'entry' && !usedIds.has('entry')
    ? 'entry'
    : makeUniqueId(type, usedIds, options?.randomSuffix);

  if (type === 'entry') return {id, type: 'entry', next: ''};
  if (type === 'end') return {id, type: 'end'};
  if (type === 'npc') return {id, type: 'npc', text: options?.text ?? '', next: ''};
  if (type === 'condition') {
    return {
      id,
      type: 'condition',
      condition: options?.condition ?? 'always',
      next: '',
      otherwise: ''
    };
  }
  if (type === 'action') {
    const action = options?.action ?? 'contracts';
    const argument = action === 'accept'
      ? (options?.argument ?? options?.defaultRouteId)
      : action === 'buyPermit'
        ? (options?.argument ?? options?.defaultPermitId)
        : undefined;
    return {
      id,
      type: 'action',
      action,
      ...(argument ? {argument} : {}),
      next: ''
    };
  }
  const choiceId = makeUniqueId('choice', usedIds, options?.randomSuffix);
  return {
    id,
    type: 'choices',
    choices: [{id: choiceId, text: 'ตัวเลือกใหม่', next: ''}]
  };
}

export function createQuickNodeOnCanvas(
  canvas: Canvas,
  item: QuickPaletteItem,
  position: {x: number; y: number},
  catalog?: CatalogOptions | null,
  pendingSource?: PendingConnectionSource | null,
  randomSuffix?: () => string
): {canvas: Canvas; nodeId: string} {
  if (item.kind !== 'node' || !item.nodeType) {
    throw Error('Palette item is not a runtime node');
  }
  if (canvas.nodes.length >= 128) {
    throw Error('Maximum 128 nodes');
  }
  if (item.nodeType === 'entry' && canvas.nodes.some(n => n.data.runtime.type === 'entry')) {
    throw Error('Graph already has an entry node');
  }
  if (pendingSource && item.nodeType === 'entry') {
    throw Error('Entry node cannot receive incoming connections');
  }
  if (pendingSource && !canSourceConnect(canvas, pendingSource)) {
    throw Error('Source handle cannot create a connection');
  }

  const usedIds = new Set<string>(canvas.nodes.map(n => n.id));
  for (const n of canvas.nodes) {
    for (const c of n.data.runtime.choices ?? []) usedIds.add(c.id);
  }
  const runtime = createDefaultRuntimeNode(item.nodeType, usedIds, {
    action: item.action,
    argument: item.argument,
    condition: item.condition,
    defaultRouteId: catalog?.routeIds?.[0],
    defaultPermitId: catalog?.permitIds?.[0],
    randomSuffix
  });

  const safePos = {
    x: Math.max(-100000, Math.min(100000, Math.round(position.x))),
    y: Math.max(-100000, Math.min(100000, Math.round(position.y)))
  };
  const newNode: BlueprintNode = {
    id: runtime.id,
    type: 'blueprint',
    position: safePos,
    data: {runtime}
  };

  let nextNodes = [...canvas.nodes, newNode];
  let nextEdges = [...canvas.edges];

  if (pendingSource) {
    const edgeId = `${pendingSource.source}:${pendingSource.sourceHandle}`;
    nextEdges = [
      ...nextEdges.filter(e => !(e.source === pendingSource.source && e.sourceHandle === pendingSource.sourceHandle)),
      {
        id: edgeId,
        source: pendingSource.source,
        sourceHandle: pendingSource.sourceHandle,
        target: runtime.id
      }
    ];
    nextNodes = nextNodes.map(n => {
      if (n.id !== pendingSource.source) return n;
      const src = structuredClone(n.data.runtime);
      if (src.type === 'choices') {
        src.choices = src.choices?.map(c => 'choice:' + c.id === pendingSource.sourceHandle ? {...c, next: runtime.id} : c);
      } else if (pendingSource.sourceHandle === 'otherwise' && src.type === 'condition') {
        src.otherwise = runtime.id;
      } else if (pendingSource.sourceHandle === 'next') {
        src.next = runtime.id;
      }
      return {...n, data: {runtime: src}};
    });
  }

  return {
    canvas: {nodes: nextNodes, edges: nextEdges},
    nodeId: runtime.id
  };
}

export interface EdgeInsertionPlan {
  valid: boolean;
  ambiguous: boolean;
  reason?: string;
  edgeId: string;
  sourceId: string;
  sourceHandle: string;
  targetId: string;
  node: Node;
  position: {x: number; y: number};
  availableOutputs: {handle: string; label: string}[];
  selectedOutput?: string;
}

export function planEdgeInsertion(
  canvas: Canvas,
  edgeId: string,
  nodeInput: Node | Node['type'],
  options?: {
    outgoingHandle?: string;
    action?: Node['action'];
    argument?: string;
    condition?: Node['condition'];
    text?: string;
    position?: {x: number; y: number};
    catalog?: CatalogOptions | null;
    randomSuffix?: () => string;
  }
): EdgeInsertionPlan {
  const edge = canvas.edges.find(e => e.id === edgeId);
  if (!edge || !edge.sourceHandle) {
    return {
      valid: false,
      ambiguous: false,
      reason: 'Original connection does not exist or is missing a source handle',
      edgeId,
      sourceId: edge?.source ?? '',
      sourceHandle: edge?.sourceHandle ?? '',
      targetId: edge?.target ?? '',
      node: typeof nodeInput === 'string' ? {id: 'invalid', type: nodeInput} : nodeInput,
      position: {x: 0, y: 0},
      availableOutputs: []
    };
  }

  const sourceNode = canvas.nodes.find(n => n.id === edge.source);
  const targetNode = canvas.nodes.find(n => n.id === edge.target);
  if (!sourceNode || !targetNode) {
    return {
      valid: false,
      ambiguous: false,
      reason: 'Original connection endpoints are missing',
      edgeId,
      sourceId: edge.source,
      sourceHandle: edge.sourceHandle,
      targetId: edge.target,
      node: typeof nodeInput === 'string' ? {id: 'invalid', type: nodeInput} : nodeInput,
      position: {x: 0, y: 0},
      availableOutputs: []
    };
  }

  if (!canSourceConnect(canvas, {source: edge.source, sourceHandle: edge.sourceHandle}) || targetNode.data.runtime.type === 'entry') {
    return {
      valid: false,
      ambiguous: false,
      reason: 'Original connection handles are invalid',
      edgeId,
      sourceId: edge.source,
      sourceHandle: edge.sourceHandle,
      targetId: edge.target,
      node: typeof nodeInput === 'string' ? {id: 'invalid', type: nodeInput} : nodeInput,
      position: {x: 0, y: 0},
      availableOutputs: []
    };
  }

  const isExistingNode = typeof nodeInput !== 'string' && canvas.nodes.some(n => n.id === nodeInput.id);
  if (!isExistingNode && canvas.nodes.length >= 128) {
    return {
      valid: false,
      ambiguous: false,
      reason: 'Maximum 128 nodes reached',
      edgeId,
      sourceId: edge.source,
      sourceHandle: edge.sourceHandle,
      targetId: edge.target,
      node: typeof nodeInput === 'string' ? {id: 'invalid', type: nodeInput} : nodeInput,
      position: {x: 0, y: 0},
      availableOutputs: []
    };
  }

  const usedIds = new Set<string>(canvas.nodes.map(n => n.id));
  for (const n of canvas.nodes) {
    for (const c of n.data.runtime.choices ?? []) usedIds.add(c.id);
  }

  const node: Node = typeof nodeInput === 'string'
    ? createDefaultRuntimeNode(nodeInput, usedIds, {
        action: options?.action,
        argument: options?.argument,
        condition: options?.condition,
        text: options?.text,
        defaultRouteId: options?.catalog?.routeIds?.[0],
        defaultPermitId: options?.catalog?.permitIds?.[0],
        randomSuffix: options?.randomSuffix
      })
    : structuredClone(nodeInput);

  if (options?.action && node.type === 'action') node.action = options.action;
  if (options?.argument !== undefined && node.type === 'action') node.argument = options.argument;
  if (options?.condition && node.type === 'condition') node.condition = options.condition;
  if (options?.text !== undefined && node.type === 'npc') node.text = options.text;

  const midpoint = options?.position ?? {
    x: Math.round((sourceNode.position.x + targetNode.position.x) / 2),
    y: Math.round((sourceNode.position.y + targetNode.position.y) / 2)
  };

  if (node.id === edge.source || node.id === edge.target) {
    return {
      valid: false,
      ambiguous: false,
      reason: 'Cannot insert an endpoint node onto its own connection',
      edgeId,
      sourceId: edge.source,
      sourceHandle: edge.sourceHandle,
      targetId: edge.target,
      node,
      position: midpoint,
      availableOutputs: []
    };
  }

  if (node.type === 'entry') {
    return {
      valid: false,
      ambiguous: false,
      reason: 'ไม่สามารถแทรกโหนด Entry บนเส้นเชื่อมได้ เนื่องจาก Entry ไม่มีพอร์ตขาเข้า (Entry node cannot receive incoming connections)',
      edgeId,
      sourceId: edge.source,
      sourceHandle: edge.sourceHandle,
      targetId: edge.target,
      node,
      position: midpoint,
      availableOutputs: []
    };
  }

  if (node.type === 'end') {
    return {
      valid: false,
      ambiguous: false,
      reason: 'ไม่สามารถแทรกโหนด End คั่นกลางเส้นเชื่อมได้ เนื่องจาก End ไม่มีพอร์ตขาออกไปยังปลายทางเดิม (End node has no outgoing port)',
      edgeId,
      sourceId: edge.source,
      sourceHandle: edge.sourceHandle,
      targetId: edge.target,
      node,
      position: midpoint,
      availableOutputs: []
    };
  }

  if (node.type === 'action') {
    const allowedActions = ['contracts', 'rank', 'permits', 'accept', 'buyPermit'];
    if (!node.action || !allowedActions.includes(node.action)) {
      return {
        valid: false,
        ambiguous: false,
        reason: 'Unsupported service action',
        edgeId,
        sourceId: edge.source,
        sourceHandle: edge.sourceHandle,
        targetId: edge.target,
        node,
        position: midpoint,
        availableOutputs: [{handle: 'next', label: 'หลังใช้บริการ'}]
      };
    }
    if (node.action === 'accept' && (!node.argument || (options?.catalog?.routeIds && !options.catalog.routeIds.includes(node.argument)))) {
      return {
        valid: false,
        ambiguous: false,
        reason: 'กรุณาเลือกเส้นทางสัญญาส่งของ (Route) ที่ถูกต้องก่อนแทรกโหนด',
        edgeId,
        sourceId: edge.source,
        sourceHandle: edge.sourceHandle,
        targetId: edge.target,
        node,
        position: midpoint,
        availableOutputs: [{handle: 'next', label: 'หลังใช้บริการ'}]
      };
    }
    if (node.action === 'buyPermit' && (!node.argument || (options?.catalog?.permitIds && !options.catalog.permitIds.includes(node.argument)))) {
      return {
        valid: false,
        ambiguous: false,
        reason: 'กรุณาเลือกใบอนุญาต (Permit) ที่ถูกต้องก่อนแทรกโหนด',
        edgeId,
        sourceId: edge.source,
        sourceHandle: edge.sourceHandle,
        targetId: edge.target,
        node,
        position: midpoint,
        availableOutputs: [{handle: 'next', label: 'หลังใช้บริการ'}]
      };
    }
    return {
      valid: true,
      ambiguous: false,
      edgeId,
      sourceId: edge.source,
      sourceHandle: edge.sourceHandle,
      targetId: edge.target,
      node,
      position: midpoint,
      availableOutputs: [{handle: 'next', label: 'หลังใช้บริการ'}],
      selectedOutput: 'next'
    };
  }

  if (node.type === 'condition') {
    const availableOutputs = [
      {handle: 'next', label: 'True · เมื่อเงื่อนไขเป็นจริง'},
      {handle: 'otherwise', label: 'False · เมื่อเงื่อนไขเป็นเท็จ'}
    ];
    const requested = options?.outgoingHandle;
    if (requested !== 'next' && requested !== 'otherwise') {
      return {
        valid: false,
        ambiguous: true,
        reason: 'โหนดตรวจเงื่อนไขมี 2 เส้นทางขาออก (True / False) กรุณาเลือกเส้นทางที่จะเชื่อมต่อไปยังปลายทางเดิมอย่างชัดเจน',
        edgeId,
        sourceId: edge.source,
        sourceHandle: edge.sourceHandle,
        targetId: edge.target,
        node,
        position: midpoint,
        availableOutputs
      };
    }
    return {
      valid: true,
      ambiguous: false,
      edgeId,
      sourceId: edge.source,
      sourceHandle: edge.sourceHandle,
      targetId: edge.target,
      node,
      position: midpoint,
      availableOutputs,
      selectedOutput: requested
    };
  }

  if (node.type === 'choices') {
    const choices = node.choices ?? [];
    if (!choices.length) {
      return {
        valid: false,
        ambiguous: false,
        reason: 'โหนดตัวเลือกผู้เล่นต้องมีอย่างน้อย 1 ตัวเลือกเพื่อเชื่อมต่อไปยังปลายทาง',
        edgeId,
        sourceId: edge.source,
        sourceHandle: edge.sourceHandle,
        targetId: edge.target,
        node,
        position: midpoint,
        availableOutputs: []
      };
    }
    const availableOutputs = choices.map((c, idx) => ({
      handle: `choice:${c.id}`,
      label: `#${idx + 1} · ${c.text || 'Untitled choice'}`
    }));
    const requested = options?.outgoingHandle ?? (choices.length === 1 ? `choice:${choices[0]!.id}` : undefined);
    if (!requested || !availableOutputs.some(o => o.handle === requested)) {
      return {
        valid: false,
        ambiguous: true,
        reason: 'โหนดตัวเลือกมีหลายแขนง กรุณาระบุตัวเลือกที่จะเชื่อมต่อไปยังปลายทางเดิม',
        edgeId,
        sourceId: edge.source,
        sourceHandle: edge.sourceHandle,
        targetId: edge.target,
        node,
        position: midpoint,
        availableOutputs
      };
    }
    return {
      valid: true,
      ambiguous: false,
      edgeId,
      sourceId: edge.source,
      sourceHandle: edge.sourceHandle,
      targetId: edge.target,
      node,
      position: midpoint,
      availableOutputs,
      selectedOutput: requested
    };
  }

  return {
    valid: true,
    ambiguous: false,
    edgeId,
    sourceId: edge.source,
    sourceHandle: edge.sourceHandle,
    targetId: edge.target,
    node,
    position: midpoint,
    availableOutputs: [{handle: 'next', label: 'ดำเนินเรื่องต่อ'}],
    selectedOutput: 'next'
  };
}

export function applyEdgeInsertion(canvas: Canvas, plan: EdgeInsertionPlan): Canvas {
  if (!plan.valid || !plan.selectedOutput) {
    throw Error(plan.reason || 'Invalid edge insertion plan');
  }
  const originalEdge = canvas.edges.find(e => e.id === plan.edgeId);
  if (!originalEdge || originalEdge.source !== plan.sourceId || originalEdge.sourceHandle !== plan.sourceHandle || originalEdge.target !== plan.targetId) {
    throw Error('Original connection changed or no longer exists');
  }

  const insertedRuntime = structuredClone(plan.node);
  if (insertedRuntime.type === 'choices') {
    insertedRuntime.choices = insertedRuntime.choices?.map(c =>
      `choice:${c.id}` === plan.selectedOutput ? {...c, next: plan.targetId} : c
    );
  } else if (insertedRuntime.type === 'condition') {
    if (plan.selectedOutput === 'next') insertedRuntime.next = plan.targetId;
    else insertedRuntime.otherwise = plan.targetId;
  } else if (insertedRuntime.type !== 'end') {
    insertedRuntime.next = plan.targetId;
  }

  const existsOnCanvas = canvas.nodes.some(n => n.id === insertedRuntime.id);
  const updatedNodes: BlueprintNode[] = canvas.nodes.map(n => {
    if (n.id === plan.sourceId) {
      const src = structuredClone(n.data.runtime);
      if (src.type === 'choices') {
        src.choices = src.choices?.map(c => `choice:${c.id}` === plan.sourceHandle ? {...c, next: insertedRuntime.id} : c);
      } else if (src.type === 'condition' && plan.sourceHandle === 'otherwise') {
        src.otherwise = insertedRuntime.id;
      } else if (src.type !== 'end') {
        src.next = insertedRuntime.id;
      }
      return {...n, data: {runtime: src}};
    }
    if (n.id === insertedRuntime.id) {
      return {...n, position: plan.position, data: {runtime: insertedRuntime}};
    }
    return n;
  });

  if (!existsOnCanvas) {
    updatedNodes.push({
      id: insertedRuntime.id,
      type: 'blueprint',
      position: plan.position,
      data: {runtime: insertedRuntime}
    });
  }

  const edge1: Edge = {
    id: `${plan.sourceId}:${plan.sourceHandle}`,
    source: plan.sourceId,
    sourceHandle: plan.sourceHandle,
    target: insertedRuntime.id
  };
  const edge2: Edge = {
    id: `${insertedRuntime.id}:${plan.selectedOutput}`,
    source: insertedRuntime.id,
    sourceHandle: plan.selectedOutput,
    target: plan.targetId
  };

  const remainingEdges = canvas.edges.filter(
    e => e.id !== plan.edgeId &&
      !(e.source === edge1.source && e.sourceHandle === edge1.sourceHandle) &&
      !(e.source === edge2.source && e.sourceHandle === edge2.sourceHandle)
  );

  return {
    nodes: updatedNodes,
    edges: [...remainingEdges, edge1, edge2]
  };
}

export interface ClipboardEnvelope {
  schema: 'frostveil-clipboard-v1';
  nodes: {runtime: Node; position: {x: number; y: number}}[];
  edges: {source: string; sourceHandle: string; target: string}[];
}

export function copySelection(canvas: Canvas, selectedIds: readonly string[]): ClipboardEnvelope {
  const selectedSet = new Set(
    selectedIds.filter(id => {
      const n = canvas.nodes.find(item => item.id === id);
      return !!n && n.data.runtime.type !== 'entry';
    })
  );

  const internalEdges = canvas.edges
    .filter(e => selectedSet.has(e.source) && selectedSet.has(e.target) && !!e.sourceHandle)
    .map(e => ({source: e.source, sourceHandle: e.sourceHandle!, target: e.target}));

  const nodes = canvas.nodes
    .filter(n => selectedSet.has(n.id))
    .map(n => {
      const runtime = structuredClone(n.data.runtime);
      if (runtime.type === 'choices') {
        runtime.choices = (runtime.choices ?? []).map(c => ({
          id: c.id,
          text: c.text,
          next: selectedSet.has(c.next) ? c.next : ''
        }));
      } else if (runtime.type === 'condition') {
        runtime.next = runtime.next && selectedSet.has(runtime.next) ? runtime.next : '';
        runtime.otherwise = runtime.otherwise && selectedSet.has(runtime.otherwise) ? runtime.otherwise : '';
      } else if (runtime.type !== 'end') {
        runtime.next = runtime.next && selectedSet.has(runtime.next) ? runtime.next : '';
      }
      return {
        runtime,
        position: {x: n.position.x, y: n.position.y}
      };
    });

  return {
    schema: 'frostveil-clipboard-v1',
    nodes,
    edges: internalEdges
  };
}

export function validateClipboardEnvelope(
  input: unknown,
  routes: readonly string[],
  permits: readonly string[]
): ClipboardEnvelope {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw Error('Invalid clipboard payload');
  }
  const env = input as ClipboardEnvelope;
  if (
    Object.keys(env).some(k => !['schema', 'nodes', 'edges'].includes(k)) ||
    env.schema !== 'frostveil-clipboard-v1' ||
    !Array.isArray(env.nodes) ||
    !env.nodes.length ||
    env.nodes.length > 127 ||
    !Array.isArray(env.edges) ||
    env.edges.length > 2048
  ) {
    throw Error('Invalid clipboard envelope');
  }

  const nodeIds = new Set<string>();
  const rawNodes: Node[] = [];
  for (const item of env.nodes) {
    if (
      !item ||
      typeof item !== 'object' ||
      !item.runtime ||
      typeof item.runtime !== 'object' ||
      item.runtime.type === 'entry' ||
      !isValidLocalId(item.runtime.id) ||
      nodeIds.has(item.runtime.id) ||
      !item.position ||
      typeof item.position !== 'object' ||
      !Number.isFinite(item.position.x) ||
      !Number.isFinite(item.position.y)
    ) {
      throw Error('Invalid clipboard node entry');
    }
    nodeIds.add(item.runtime.id);
    rawNodes.push(structuredClone(item.runtime));
  }

  // Validate against authoritative draft rules using a synthetic entry wrapper
  const syntheticEntryId = nodeIds.has('entry') ? 'entry-check' : 'entry';
  const tempGraph: Graph = {
    schemaVersion: 1,
    id: 'clipboard-check',
    version: 1,
    entry: syntheticEntryId,
    nodes: [{id: syntheticEntryId, type: 'entry', next: ''}, ...rawNodes]
  };
  validateDraftGraph(tempGraph, routes, permits);

  for (const edge of env.edges) {
    if (
      !edge ||
      typeof edge !== 'object' ||
      !nodeIds.has(edge.source) ||
      !nodeIds.has(edge.target) ||
      typeof edge.sourceHandle !== 'string' ||
      !edge.sourceHandle
    ) {
      throw Error('Invalid clipboard internal connection');
    }
  }

  return structuredClone(env);
}

export function pasteClipboard(
  input: unknown,
  canvas: Canvas,
  routes: readonly string[],
  permits: readonly string[],
  offset: {x: number; y: number} = {x: 48, y: 48},
  randomSuffix?: () => string
): {canvas: Canvas; pastedIds: string[]} {
  const env = validateClipboardEnvelope(input, routes, permits);
  if (canvas.nodes.length + env.nodes.length > 128) {
    throw Error('Maximum 128 nodes');
  }

  const usedIds = new Set<string>(canvas.nodes.map(n => n.id));
  for (const n of canvas.nodes) {
    for (const c of n.data.runtime.choices ?? []) usedIds.add(c.id);
  }

  const nodeIdMap = new Map<string, string>();
  const choiceIdMap = new Map<string, Map<string, string>>();

  for (const item of env.nodes) {
    const newId = makeUniqueId(item.runtime.type, usedIds, randomSuffix);
    usedIds.add(newId);
    nodeIdMap.set(item.runtime.id, newId);
    if (item.runtime.type === 'choices') {
      const cMap = new Map<string, string>();
      for (const c of item.runtime.choices ?? []) {
        const newChoiceId = makeUniqueId('choice', usedIds, randomSuffix);
        usedIds.add(newChoiceId);
        cMap.set(c.id, newChoiceId);
      }
      choiceIdMap.set(item.runtime.id, cMap);
    }
  }

  const newBlueprintNodes: BlueprintNode[] = env.nodes.map(item => {
    const oldNode = item.runtime;
    const newId = nodeIdMap.get(oldNode.id)!;
    const runtime = structuredClone(oldNode);
    runtime.id = newId;

    if (runtime.type === 'choices') {
      const cMap = choiceIdMap.get(oldNode.id)!;
      runtime.choices = (runtime.choices ?? []).map(c => ({
        id: cMap.get(c.id)!,
        text: c.text,
        next: c.next && nodeIdMap.has(c.next) ? nodeIdMap.get(c.next)! : ''
      }));
    } else if (runtime.type === 'condition') {
      runtime.next = runtime.next && nodeIdMap.has(runtime.next) ? nodeIdMap.get(runtime.next)! : '';
      runtime.otherwise = runtime.otherwise && nodeIdMap.has(runtime.otherwise) ? nodeIdMap.get(runtime.otherwise)! : '';
    } else if (runtime.type !== 'end') {
      runtime.next = runtime.next && nodeIdMap.has(runtime.next) ? nodeIdMap.get(runtime.next)! : '';
    }

    return {
      id: newId,
      type: 'blueprint',
      position: {
        x: Math.max(-100000, Math.min(100000, Math.round(item.position.x + offset.x))),
        y: Math.max(-100000, Math.min(100000, Math.round(item.position.y + offset.y)))
      },
      data: {runtime}
    };
  });

  const newEdges = edgesFromNodes(newBlueprintNodes.map(n => n.data.runtime));
  return {
    canvas: {
      nodes: [...canvas.nodes, ...newBlueprintNodes],
      edges: [...canvas.edges, ...newEdges]
    },
    pastedIds: newBlueprintNodes.map(n => n.id)
  };
}

export function duplicateSelection(
  canvas: Canvas,
  selectedIds: readonly string[],
  routes: readonly string[],
  permits: readonly string[],
  offset: {x: number; y: number} = {x: 48, y: 48},
  randomSuffix?: () => string
): {canvas: Canvas; duplicatedIds: string[]; clipboard: ClipboardEnvelope} {
  const clipboard = copySelection(canvas, selectedIds);
  if (!clipboard.nodes.length) {
    throw Error('No duplicable nodes selected');
  }
  const {canvas: nextCanvas, pastedIds} = pasteClipboard(clipboard, canvas, routes, permits, offset, randomSuffix);
  return {canvas: nextCanvas, duplicatedIds: pastedIds, clipboard};
}

export function cutSelection(
  canvas: Canvas,
  presentation: EditorPresentation,
  selectedIds: readonly string[],
  entryId: string
): {canvas: Canvas; presentation: EditorPresentation; clipboard: ClipboardEnvelope} {
  const clipboard = copySelection(canvas, selectedIds);
  if (!clipboard.nodes.length) {
    throw Error('No cuttable nodes selected');
  }
  const {canvas: nextCanvas, presentation: nextPresentation} = deleteSelectedNodes(canvas, presentation, selectedIds, entryId);
  return {canvas: nextCanvas, presentation: nextPresentation, clipboard};
}

export function moveSelectedNodes(
  canvas: Canvas,
  selectedIds: readonly string[],
  delta: {x: number; y: number}
): Canvas {
  if (!selectedIds.length || (delta.x === 0 && delta.y === 0)) return canvas;
  const set = new Set(selectedIds);
  return {
    ...canvas,
    nodes: canvas.nodes.map(n =>
      set.has(n.id)
        ? {
            ...n,
            position: {
              x: Math.max(-100000, Math.min(100000, Math.round(n.position.x + delta.x))),
              y: Math.max(-100000, Math.min(100000, Math.round(n.position.y + delta.y)))
            }
          }
        : n
    )
  };
}

export function deleteSelectedNodes(
  canvas: Canvas,
  presentation: EditorPresentation,
  selectedIds: readonly string[],
  entryId: string
): {canvas: Canvas; presentation: EditorPresentation; removedCount: number} {
  const removable = new Set(
    selectedIds.filter(id => id !== entryId && canvas.nodes.some(n => n.id === id && n.data.runtime.type !== 'entry'))
  );
  if (!removable.size) return {canvas, presentation, removedCount: 0};

  const remainingEdges = canvas.edges.filter(e => !removable.has(e.source) && !removable.has(e.target));
  const remainingNodes = canvas.nodes
    .filter(n => !removable.has(n.id))
    .map(n => {
      const runtime = structuredClone(n.data.runtime);
      if (runtime.type === 'choices') {
        runtime.choices = runtime.choices?.map(c => removable.has(c.next) ? {...c, next: ''} : c);
      } else if (runtime.type === 'condition') {
        if (runtime.next && removable.has(runtime.next)) runtime.next = '';
        if (runtime.otherwise && removable.has(runtime.otherwise)) runtime.otherwise = '';
      } else if (runtime.type !== 'end') {
        if (runtime.next && removable.has(runtime.next)) runtime.next = '';
      }
      return {...n, data: {runtime}};
    });

  const nextPresentation: EditorPresentation = {
    ...presentation,
    groups: presentation.groups.map(g => ({
      ...g,
      nodeIds: g.nodeIds.filter(id => !removable.has(id))
    })),
    bookmarks: presentation.bookmarks.map(b => b.nodeId && removable.has(b.nodeId) ? {id: b.id, name: b.name, viewport: b.viewport} : b)
  };

  return {
    canvas: {nodes: remainingNodes, edges: remainingEdges},
    presentation: nextPresentation,
    removedCount: removable.size
  };
}

export function nodesInRectangle(
  canvas: Canvas,
  rect: {x1: number; y1: number; x2: number; y2: number}
): string[] {
  const minX = Math.min(rect.x1, rect.x2);
  const maxX = Math.max(rect.x1, rect.x2);
  const minY = Math.min(rect.y1, rect.y2);
  const maxY = Math.max(rect.y1, rect.y2);
  return canvas.nodes
    .filter(n => {
      const w = NODE_WIDTH;
      const h = nodeHeight(n.data.runtime);
      return n.position.x < maxX && n.position.x + w > minX && n.position.y < maxY && n.position.y + h > minY;
    })
    .map(n => n.id);
}

export const GROUP_COLOR_INFO: Record<GroupColor, {label: string; hex: string}> = {
  gold: {label: 'Gold · โครงเรื่องหลัก', hex: '#d3b77e'},
  teal: {label: 'Teal · บทสนทนา NPC', hex: '#72c8b9'},
  blue: {label: 'Blue · ทางแยกผู้เล่น', hex: '#7eaeef'},
  purple: {label: 'Purple · บริการกิลด์', hex: '#b5a0db'},
  amber: {label: 'Amber · เงื่อนไข/ตรวจสอบ', hex: '#e7a879'},
  slate: {label: 'Slate · บันทึกช่วยจำ', hex: '#8daba2'}
};

export function createVisualGroup(
  presentation: EditorPresentation,
  canvas: Canvas,
  selectedIds: readonly string[],
  options?: {
    title?: string;
    description?: string;
    color?: GroupColor;
    position?: {x: number; y: number};
    randomSuffix?: () => string;
  }
): {presentation: EditorPresentation; group: VisualGroup} {
  if (presentation.groups.length >= 32) {
    throw Error('Maximum 32 visual groups');
  }
  const usedIds = new Set(presentation.groups.map(g => g.id));
  const id = makeUniqueId('group', usedIds, options?.randomSuffix);
  const memberNodes = canvas.nodes.filter(n => selectedIds.includes(n.id));

  let x = options?.position?.x ?? 120;
  let y = options?.position?.y ?? 80;
  let width = 380;
  let height = 240;

  if (memberNodes.length > 0) {
    const minX = Math.min(...memberNodes.map(n => n.position.x));
    const minY = Math.min(...memberNodes.map(n => n.position.y));
    const maxX = Math.max(...memberNodes.map(n => n.position.x + NODE_WIDTH));
    const maxY = Math.max(...memberNodes.map(n => n.position.y + nodeHeight(n.data.runtime)));
    x = Math.round(minX - 28);
    y = Math.round(minY - 68);
    width = Math.max(340, Math.min(4000, Math.round(maxX - minX + 56)));
    height = Math.max(200, Math.min(4000, Math.round(maxY - minY + 96)));
  }

  const group: VisualGroup = {
    id,
    title: (options?.title ?? (memberNodes.length ? `กลุ่มโหนด (${memberNodes.length})` : 'กรอบบันทึกใหม่')).slice(0, 120),
    description: (options?.description ?? 'บันทึกช่วยจำสำหรับผู้สร้างกราฟ').slice(0, 1024),
    color: options?.color ?? 'gold',
    x: Math.max(-100000, Math.min(100000, x)),
    y: Math.max(-100000, Math.min(100000, y)),
    width,
    height,
    collapsed: false,
    nodeIds: memberNodes.map(n => n.id)
  };

  const nextPresentation = validatePresentation({
    ...presentation,
    groups: [...presentation.groups, group]
  });
  return {presentation: nextPresentation, group};
}

export function updateVisualGroup(
  presentation: EditorPresentation,
  groupId: string,
  patch: Partial<Omit<VisualGroup, 'id'>>
): EditorPresentation {
  const next = {
    ...presentation,
    groups: presentation.groups.map(g => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        ...(patch.title !== undefined ? {title: patch.title.slice(0, 120)} : {}),
        ...(patch.description !== undefined ? {description: patch.description.slice(0, 1024)} : {}),
        ...(patch.color !== undefined ? {color: patch.color} : {}),
        ...(patch.collapsed !== undefined ? {collapsed: !!patch.collapsed} : {}),
        ...(patch.x !== undefined ? {x: Math.max(-100000, Math.min(100000, Math.round(patch.x)))} : {}),
        ...(patch.y !== undefined ? {y: Math.max(-100000, Math.min(100000, Math.round(patch.y)))} : {}),
        ...(patch.width !== undefined ? {width: Math.max(120, Math.min(4000, Math.round(patch.width)))} : {}),
        ...(patch.height !== undefined ? {height: Math.max(72, Math.min(4000, Math.round(patch.height)))} : {}),
        ...(patch.nodeIds !== undefined ? {nodeIds: [...new Set(patch.nodeIds)]} : {})
      };
    })
  };
  return validatePresentation(next);
}

export function moveVisualGroupWithContents(
  canvas: Canvas,
  presentation: EditorPresentation,
  groupId: string,
  delta: {x: number; y: number}
): {canvas: Canvas; presentation: EditorPresentation} {
  const group = presentation.groups.find(g => g.id === groupId);
  if (!group || (delta.x === 0 && delta.y === 0)) return {canvas, presentation};
  const nextPresentation = updateVisualGroup(presentation, groupId, {
    x: group.x + delta.x,
    y: group.y + delta.y
  });
  const nextCanvas = group.nodeIds.length > 0 ? moveSelectedNodes(canvas, group.nodeIds, delta) : canvas;
  return {canvas: nextCanvas, presentation: nextPresentation};
}

export function deleteVisualGroup(
  presentation: EditorPresentation,
  groupId: string
): EditorPresentation {
  return validatePresentation({
    ...presentation,
    groups: presentation.groups.filter(g => g.id !== groupId)
  });
}

export interface GraphTemplateSpec {
  id:
    | 'simple-greeting'
    | 'accept-decline'
    | 'courier-contract'
    | 'condition-choice'
    | 'permit-purchase'
    | 'safe-exit';
  title: string;
  thaiTitle: string;
  description: string;
  requiresRoute?: boolean;
  requiresPermit?: boolean;
}

export const GRAPH_TEMPLATES: readonly GraphTemplateSpec[] = [
  {
    id: 'simple-greeting',
    title: 'Simple NPC Greeting',
    thaiTitle: 'ทักทายพื้นฐาน',
    description: 'NPC กล่าวทักทายผู้เล่นแล้วจบการสนทนาอย่างปลอดภัย'
  },
  {
    id: 'accept-decline',
    title: 'Accept / Decline Conversation',
    thaiTitle: 'บทสนทนา ตกลง / ปฏิเสธ',
    description: 'NPC เสนอทางเลือกให้ผู้เล่นตอบรับหรือปฏิเสธ พร้อมบทพูดแยกตามคำตอบ'
  },
  {
    id: 'courier-contract',
    title: 'Courier Contract Dialogue',
    thaiTitle: 'สนทนารับงานส่งของ Courier',
    description: 'เมนูตรวจดูรายการสัญญาและรับสัญญาส่งของจากแคตตาล็อกจริงของเซิร์ฟเวอร์',
    requiresRoute: true
  },
  {
    id: 'condition-choice',
    title: 'Condition-Based Choice',
    thaiTitle: 'แยกเส้นทางตามสถานะงาน Courier',
    description: 'ตรวจเงื่อนไข courierIdle ก่อนเปิดทางเลือกบริการหรือแจ้งให้ส่งงานเดิมให้เสร็จ'
  },
  {
    id: 'permit-purchase',
    title: 'Permit Information & Purchase',
    thaiTitle: 'ข้อมูลและซื้อใบอนุญาตกิลด์',
    description: 'อธิบายใบอนุญาตกิลด์ ตรวจสอบสิทธิ์ และซื้อใบอนุญาตจากแคตตาล็อกจริง',
    requiresPermit: true
  },
  {
    id: 'safe-exit',
    title: 'Safe Conversation Exit',
    thaiTitle: 'กล่าวลาและจบการสนทนา',
    description: 'โหนดกล่าวลามาตรฐานพร้อมโหนด End สำหรับปิดบทสนทนา'
  }
];

export interface TemplatePreviewResult {
  spec: GraphTemplateSpec;
  nodes: {runtime: Node; position: {x: number; y: number}}[];
  edges: {source: string; sourceHandle: string; target: string}[];
}

export function buildTemplateBlueprint(
  templateId: GraphTemplateSpec['id'],
  options?: {
    routeId?: string;
    permitId?: string;
    catalog?: CatalogOptions | null;
  }
): TemplatePreviewResult {
  const spec = GRAPH_TEMPLATES.find(t => t.id === templateId);
  if (!spec) throw Error('Unknown graph template');

  const routeId = options?.routeId || options?.catalog?.routeIds?.[0] || '';
  const permitId = options?.permitId || options?.catalog?.permitIds?.[0] || '';

  if (spec.requiresRoute && (!routeId || (options?.catalog?.routeIds && !options.catalog.routeIds.includes(routeId)))) {
    throw Error('Template requires a valid Courier route from the catalog');
  }
  if (spec.requiresPermit && (!permitId || (options?.catalog?.permitIds && !options.catalog.permitIds.includes(permitId)))) {
    throw Error('Template requires a valid Guild permit from the catalog');
  }

  const routeLabel = options?.catalog?.routes?.find(r => r.id === routeId)?.label ?? routeId;
  const permitLabel = options?.catalog?.permits?.find(p => p.id === permitId)?.label ?? permitId;

  let nodes: {runtime: Node; position: {x: number; y: number}}[] = [];

  switch (templateId) {
    case 'simple-greeting':
      nodes = [
        {
          runtime: {id: 'tpl-greet', type: 'npc', text: 'สวัสดีนักเดินทาง ยินดีต้อนรับสู่สมาคมแห่ง Frostveil', next: 'tpl-end'},
          position: {x: 0, y: 0}
        },
        {
          runtime: {id: 'tpl-end', type: 'end'},
          position: {x: 420, y: 0}
        }
      ];
      break;

    case 'accept-decline':
      nodes = [
        {
          runtime: {id: 'tpl-offer', type: 'npc', text: 'เรามีภารกิจส่งข่าวสารด่วน คุณพร้อมจะรับฟังรายละเอียดหรือไม่?', next: 'tpl-choice'},
          position: {x: 0, y: 0}
        },
        {
          runtime: {
            id: 'tpl-choice',
            type: 'choices',
            choices: [
              {id: 'tpl-accept', text: 'ตกลง ว่ามาได้เลย', next: 'tpl-yes'},
              {id: 'tpl-decline', text: 'ยังไม่สะดวกในตอนนี้', next: 'tpl-no'}
            ]
          },
          position: {x: 420, y: 0}
        },
        {
          runtime: {id: 'tpl-yes', type: 'npc', text: 'ยอดเยี่ยม เตรียมสัมภาระของคุณให้พร้อม', next: 'tpl-end'},
          position: {x: 840, y: -140}
        },
        {
          runtime: {id: 'tpl-no', type: 'npc', text: 'ไม่เป็นไร หากเปลี่ยนใจสามารถกลับมาหาฉันได้เสมอ', next: 'tpl-end'},
          position: {x: 840, y: 160}
        },
        {
          runtime: {id: 'tpl-end', type: 'end'},
          position: {x: 1260, y: 10}
        }
      ];
      break;

    case 'courier-contract':
      nodes = [
        {
          runtime: {id: 'tpl-clerk', type: 'npc', text: 'ยินดีต้อนรับสู่เคาน์เตอร์สัญญาส่งของ ต้องการตรวจงานหรือรับสัญญาเส้นทางใด?', next: 'tpl-menu'},
          position: {x: 0, y: 0}
        },
        {
          runtime: {
            id: 'tpl-menu',
            type: 'choices',
            choices: [
              {id: 'tpl-list', text: 'ดูสัญญาส่งของทั้งหมด', next: 'tpl-contracts'},
              {id: 'tpl-take', text: `รับงาน: ${routeLabel}`, next: 'tpl-accept'},
              {id: 'tpl-exit', text: 'ออกจากการสนทนา', next: 'tpl-end'}
            ]
          },
          position: {x: 420, y: 0}
        },
        {
          runtime: {id: 'tpl-contracts', type: 'action', action: 'contracts', next: 'tpl-menu'},
          position: {x: 860, y: -160}
        },
        {
          runtime: {id: 'tpl-accept', type: 'action', action: 'accept', argument: routeId, next: 'tpl-menu'},
          position: {x: 860, y: 40}
        },
        {
          runtime: {id: 'tpl-end', type: 'end'},
          position: {x: 860, y: 240}
        }
      ];
      break;

    case 'condition-choice':
      nodes = [
        {
          runtime: {id: 'tpl-check', type: 'condition', condition: 'courierIdle', next: 'tpl-idle', otherwise: 'tpl-busy'},
          position: {x: 0, y: 0}
        },
        {
          runtime: {id: 'tpl-idle', type: 'npc', text: 'ตอนนี้คุณยังไม่มีสัญญาส่งของที่ค้างอยู่ ต้องการตรวจสอบแรงก์หรือดูงานไหม?', next: 'tpl-options'},
          position: {x: 420, y: -140}
        },
        {
          runtime: {id: 'tpl-busy', type: 'npc', text: 'คุณมีสัญญาส่งของที่กำลังดำเนินการอยู่ กรุณาส่งมอบพัสดุเดิมให้เรียบร้อยก่อน', next: 'tpl-end'},
          position: {x: 420, y: 180}
        },
        {
          runtime: {
            id: 'tpl-options',
            type: 'choices',
            choices: [
              {id: 'tpl-rank-btn', text: 'ตรวจแรงก์ Courier', next: 'tpl-rank'},
              {id: 'tpl-close-btn', text: 'รับทราบ ขอบคุณ', next: 'tpl-end'}
            ]
          },
          position: {x: 840, y: -140}
        },
        {
          runtime: {id: 'tpl-rank', type: 'action', action: 'rank', next: 'tpl-options'},
          position: {x: 1260, y: -160}
        },
        {
          runtime: {id: 'tpl-end', type: 'end'},
          position: {x: 1260, y: 140}
        }
      ];
      break;

    case 'permit-purchase':
      nodes = [
        {
          runtime: {id: 'tpl-intro', type: 'npc', text: 'ใบอนุญาตกิลด์ช่วยเปิดเส้นทางขนส่งระดับภูมิภาค ต้องการตรวจสถานะหรือซื้อใบอนุญาตหรือไม่?', next: 'tpl-permit-menu'},
          position: {x: 0, y: 0}
        },
        {
          runtime: {
            id: 'tpl-permit-menu',
            type: 'choices',
            choices: [
              {id: 'tpl-check-permits', text: 'ดูใบอนุญาตกิลด์ที่มี', next: 'tpl-permits-act'},
              {id: 'tpl-buy-permit', text: `ซื้อใบอนุญาต: ${permitLabel}`, next: 'tpl-buy-act'},
              {id: 'tpl-permit-exit', text: 'ไว้คราวหน้า', next: 'tpl-end'}
            ]
          },
          position: {x: 420, y: 0}
        },
        {
          runtime: {id: 'tpl-permits-act', type: 'action', action: 'permits', next: 'tpl-permit-menu'},
          position: {x: 860, y: -160}
        },
        {
          runtime: {id: 'tpl-buy-act', type: 'action', action: 'buyPermit', argument: permitId, next: 'tpl-permit-menu'},
          position: {x: 860, y: 40}
        },
        {
          runtime: {id: 'tpl-end', type: 'end'},
          position: {x: 860, y: 240}
        }
      ];
      break;

    case 'safe-exit':
      nodes = [
        {
          runtime: {id: 'tpl-farewell', type: 'npc', text: 'ขอให้สายลมแห่ง Frostveil นำทางคุณอย่างปลอดภัย แล้วพบกันใหม่', next: 'tpl-end'},
          position: {x: 0, y: 0}
        },
        {
          runtime: {id: 'tpl-end', type: 'end'},
          position: {x: 420, y: 0}
        }
      ];
      break;
  }

  const edges = edgesFromNodes(nodes.map(n => n.runtime)).map(e => ({
    source: e.source,
    sourceHandle: e.sourceHandle!,
    target: e.target
  }));

  return {spec, nodes, edges};
}

export function insertGraphTemplate(
  canvas: Canvas,
  templateId: GraphTemplateSpec['id'],
  options?: {
    routeId?: string;
    permitId?: string;
    catalog?: CatalogOptions | null;
    origin?: {x: number; y: number};
    randomSuffix?: () => string;
  }
): {canvas: Canvas; insertedIds: string[]} {
  const blueprint = buildTemplateBlueprint(templateId, options);
  const routes = options?.catalog?.routeIds ?? (options?.routeId ? [options.routeId] : []);
  const permits = options?.catalog?.permitIds ?? (options?.permitId ? [options.permitId] : []);

  let origin = options?.origin;
  if (!origin) {
    if (canvas.nodes.length === 0) {
      origin = {x: 160, y: 120};
    } else {
      const maxY = Math.max(...canvas.nodes.map(n => n.position.y + nodeHeight(n.data.runtime)));
      const minX = Math.min(...canvas.nodes.map(n => n.position.x));
      origin = {x: minX, y: maxY + 120};
    }
  }

  const envelope: ClipboardEnvelope = {
    schema: 'frostveil-clipboard-v1',
    nodes: blueprint.nodes,
    edges: blueprint.edges
  };

  const {canvas: nextCanvas, pastedIds} = pasteClipboard(
    envelope,
    canvas,
    routes,
    permits,
    origin,
    options?.randomSuffix
  );

  return {canvas: nextCanvas, insertedIds: pastedIds};
}
